#!/usr/bin/env node

/**
 * FunnyPixels 瓶颈检测器
 *
 * 分析多个测试结果，自动识别系统瓶颈：
 * - 对比不同负载级别下的指标变化
 * - 识别拐点（性能开始恶化的负载水平）
 * - 推断瓶颈类型（CPU、内存、IO、连接池、锁竞争）
 *
 * 使用方法:
 * node reporting/bottleneck-detector.js --input reports/ --output reports/bottleneck-report.json
 */

const fs = require('fs');
const path = require('path');
const { Command } = require('commander');

const program = new Command();
program
  .requiredOption('-i, --input <dir>', '包含多个 k6 JSON 结果的目录')
  .option('-o, --output <file>', '输出报告文件', null)
  .parse(process.argv);

const opts = program.opts();

function findJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => path.join(dir, f));
}

function loadResult(filePath) {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!data.metrics) return null;

    const m = data.metrics;
    return {
      file: path.basename(filePath),
      vus_max: m.vus_max?.values?.value || m.vus?.values?.max || 0,
      http_reqs_rate: m.http_reqs?.values?.rate || 0,
      http_duration_avg: m.http_req_duration?.values?.avg || 0,
      http_duration_p95: m.http_req_duration?.values?.['p(95)'] || 0,
      http_duration_p99: m.http_req_duration?.values?.['p(99)'] || 0,
      http_failed_rate: m.http_req_failed?.values?.rate || 0,
      iterations_rate: m.iterations?.values?.rate || 0,
    };
  } catch {
    return null;
  }
}

function detectInflectionPoint(results) {
  if (results.length < 3) return null;

  // 按 VU 数排序
  const sorted = [...results].sort((a, b) => a.vus_max - b.vus_max);

  // 找延迟拐点：延迟增长率突然加速的点
  let maxAcceleration = 0;
  let inflectionIdx = -1;

  for (let i = 2; i < sorted.length; i++) {
    const rate1 = (sorted[i - 1].http_duration_p95 - sorted[i - 2].http_duration_p95) /
                  Math.max(1, sorted[i - 1].vus_max - sorted[i - 2].vus_max);
    const rate2 = (sorted[i].http_duration_p95 - sorted[i - 1].http_duration_p95) /
                  Math.max(1, sorted[i].vus_max - sorted[i - 1].vus_max);
    const acceleration = rate2 - rate1;

    if (acceleration > maxAcceleration) {
      maxAcceleration = acceleration;
      inflectionIdx = i - 1;
    }
  }

  if (inflectionIdx >= 0) {
    return {
      vus: sorted[inflectionIdx].vus_max,
      p95_at_inflection: sorted[inflectionIdx].http_duration_p95,
      rps_at_inflection: sorted[inflectionIdx].http_reqs_rate,
      description: `在约 ${sorted[inflectionIdx].vus_max} VU 时延迟开始显著增长`,
    };
  }

  return null;
}

function inferBottleneckType(results) {
  const bottlenecks = [];
  const sorted = [...results].sort((a, b) => a.vus_max - b.vus_max);

  if (sorted.length < 2) return bottlenecks;

  const low = sorted[0];
  const high = sorted[sorted.length - 1];

  // 吞吐量饱和：RPS 不随 VU 增加而增长
  if (high.vus_max > low.vus_max * 3 && high.http_reqs_rate < low.http_reqs_rate * 1.5) {
    bottlenecks.push({
      type: 'throughput_saturation',
      confidence: 'HIGH',
      description: 'RPS 不随并发数增长 - 系统吞吐量已达上限',
      likely_cause: 'CPU 饱和、连接池耗尽或应用层串行化',
      recommendation: '检查 CPU 使用率、数据库连接池大小、是否存在全局锁',
    });
  }

  // 延迟指数增长：可能是队列效应
  if (high.http_duration_p95 > low.http_duration_p95 * 10) {
    bottlenecks.push({
      type: 'queuing_delay',
      confidence: 'HIGH',
      description: `P95 延迟从 ${low.http_duration_p95.toFixed(0)}ms 增长到 ${high.http_duration_p95.toFixed(0)}ms (${(high.http_duration_p95 / low.http_duration_p95).toFixed(0)}x)`,
      likely_cause: '请求排队等待资源（数据库连接、线程池）',
      recommendation: '增加连接池大小、添加请求限流、考虑水平扩展',
    });
  }

  // 错误率飙升
  if (high.http_failed_rate > 0.05 && low.http_failed_rate < 0.01) {
    bottlenecks.push({
      type: 'error_cliff',
      confidence: 'HIGH',
      description: `错误率从 ${(low.http_failed_rate * 100).toFixed(1)}% 飙升到 ${(high.http_failed_rate * 100).toFixed(1)}%`,
      likely_cause: '资源耗尽导致请求失败（连接超时、内存不足）',
      recommendation: '检查应用错误日志、数据库连接超时设置、内存使用',
    });
  }

  // P99/P95 比率异常：锁竞争
  for (const r of sorted) {
    if (r.http_duration_p99 > r.http_duration_p95 * 5) {
      bottlenecks.push({
        type: 'lock_contention',
        confidence: 'MEDIUM',
        description: `在 ${r.vus_max} VU 时 P99/P95 比率为 ${(r.http_duration_p99 / r.http_duration_p95).toFixed(1)}x`,
        likely_cause: '可能存在锁竞争或资源争用',
        recommendation: '检查数据库锁等待、Redis 大 key 操作、应用层互斥锁',
      });
      break;
    }
  }

  return bottlenecks;
}

function estimateCapacity(results) {
  const sorted = [...results].sort((a, b) => a.vus_max - b.vus_max);

  // 找到满足 SLO 的最大负载
  const SLO_P95 = 500;
  const SLO_ERROR = 0.02;

  let maxSafeVUs = 0;
  let maxSafeRPS = 0;

  for (const r of sorted) {
    if (r.http_duration_p95 < SLO_P95 && r.http_failed_rate < SLO_ERROR) {
      maxSafeVUs = r.vus_max;
      maxSafeRPS = r.http_reqs_rate;
    }
  }

  return {
    max_safe_vus: maxSafeVUs,
    max_safe_rps: Math.round(maxSafeRPS),
    recommended_limit: Math.round(maxSafeVUs * 0.7), // 70% 安全余量
    slo_used: { p95_limit: SLO_P95, error_limit: SLO_ERROR },
  };
}

function main() {
  console.log('🔍 FunnyPixels 瓶颈检测器\n');

  const jsonFiles = findJsonFiles(opts.input);
  console.log(`📂 扫描: ${opts.input} (${jsonFiles.length} 个文件)`);

  const results = jsonFiles.map(loadResult).filter(Boolean);
  console.log(`   有效结果: ${results.length}\n`);

  if (results.length === 0) {
    console.log('⚠️  未找到有效的测试结果');
    process.exit(0);
  }

  // 排序显示
  const sorted = [...results].sort((a, b) => a.vus_max - b.vus_max);
  console.log('📊 负载概览');
  console.log('-'.repeat(70));
  console.log('文件'.padEnd(30) + 'VU'.padEnd(8) + 'RPS'.padEnd(10) + 'P95'.padEnd(10) + '错误率');
  console.log('-'.repeat(70));
  for (const r of sorted) {
    console.log(
      r.file.padEnd(30) +
      `${r.vus_max}`.padEnd(8) +
      `${r.http_reqs_rate.toFixed(0)}`.padEnd(10) +
      `${r.http_duration_p95.toFixed(0)}ms`.padEnd(10) +
      `${(r.http_failed_rate * 100).toFixed(2)}%`
    );
  }

  // 拐点检测
  console.log('\n🎯 拐点检测');
  console.log('-'.repeat(50));
  const inflection = detectInflectionPoint(results);
  if (inflection) {
    console.log(`  拐点: ${inflection.description}`);
    console.log(`  P95: ${inflection.p95_at_inflection.toFixed(0)}ms | RPS: ${inflection.rps_at_inflection.toFixed(0)}`);
  } else {
    console.log('  未检测到明显拐点（数据不足或负载范围不够大）');
  }

  // 瓶颈推断
  console.log('\n🚧 瓶颈分析');
  console.log('-'.repeat(50));
  const bottlenecks = inferBottleneckType(results);
  if (bottlenecks.length === 0) {
    console.log('  ✅ 未检测到明显瓶颈');
  } else {
    for (const b of bottlenecks) {
      const icon = b.confidence === 'HIGH' ? '🔴' : '🟡';
      console.log(`\n  ${icon} [${b.confidence}] ${b.type}`);
      console.log(`     ${b.description}`);
      console.log(`     可能原因: ${b.likely_cause}`);
      console.log(`     建议: ${b.recommendation}`);
    }
  }

  // 容量估算
  console.log('\n📐 容量估算');
  console.log('-'.repeat(50));
  const capacity = estimateCapacity(results);
  console.log(`  SLO 条件下最大安全负载: ${capacity.max_safe_vus} VU (${capacity.max_safe_rps} RPS)`);
  console.log(`  推荐限流值 (70%余量):   ${capacity.recommended_limit} VU`);

  // 输出
  if (opts.output) {
    const report = {
      timestamp: new Date().toISOString(),
      results: sorted,
      inflection,
      bottlenecks,
      capacity,
    };
    fs.writeFileSync(opts.output, JSON.stringify(report, null, 2));
    console.log(`\n📝 报告已保存: ${opts.output}`);
  }

  console.log('');
}

main();
