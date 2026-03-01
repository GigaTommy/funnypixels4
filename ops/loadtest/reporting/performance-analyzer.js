#!/usr/bin/env node

/**
 * FunnyPixels 性能分析器
 *
 * 深度分析 k6 测试结果，生成可操作的优化建议：
 * - 识别性能瓶颈
 * - 分析延迟分布模式
 * - 检测异常值和尾部延迟
 * - 对比 SLO 目标
 *
 * 使用方法:
 * node reporting/performance-analyzer.js --input reports/test.json
 */

const fs = require('fs');
const { Command } = require('commander');

const program = new Command();
program
  .requiredOption('-i, --input <file>', '输入 k6 JSON 结果文件')
  .option('--slo <file>', 'SLO 定义文件 (JSON)', null)
  .option('-o, --output <file>', '输出分析报告', null)
  .parse(process.argv);

const opts = program.opts();

// 默认 SLO
const DEFAULT_SLO = {
  availability: 0.995,
  latency_p50: 200,
  latency_p95: 500,
  latency_p99: 1000,
  error_rate: 0.02,
  draw_success_rate: 0.95,
};

function loadData(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.error(`❌ 无法读取: ${filePath} - ${err.message}`);
    process.exit(1);
  }
}

function analyzeLatencyDistribution(metrics) {
  const duration = metrics.http_req_duration?.values || {};
  const analysis = {
    avg: duration.avg || 0,
    min: duration.min || 0,
    med: duration.med || 0,
    p90: duration['p(90)'] || 0,
    p95: duration['p(95)'] || 0,
    p99: duration['p(99)'] || 0,
    max: duration.max || 0,
  };

  // 计算尾部延迟比率
  analysis.tail_ratio_p99_p50 = analysis.med > 0 ? (analysis.p99 / analysis.med).toFixed(1) : 'N/A';
  analysis.tail_ratio_max_p95 = analysis.p95 > 0 ? (analysis.max / analysis.p95).toFixed(1) : 'N/A';

  // 延迟分布形态
  if (analysis.tail_ratio_p99_p50 > 10) {
    analysis.distribution = 'heavy_tail';
    analysis.distribution_desc = '重尾分布 - P99远高于中位数，存在严重尾部延迟问题';
  } else if (analysis.tail_ratio_p99_p50 > 5) {
    analysis.distribution = 'moderate_tail';
    analysis.distribution_desc = '中度尾部延迟 - 建议关注慢查询和资源竞争';
  } else {
    analysis.distribution = 'normal';
    analysis.distribution_desc = '延迟分布正常，尾部延迟在合理范围内';
  }

  return analysis;
}

function checkSLO(metrics, slo) {
  const results = [];
  const m = metrics;

  // 可用性 (1 - 错误率)
  const errorRate = m.http_req_failed?.values?.rate || 0;
  const availability = 1 - errorRate;
  results.push({
    metric: '可用性',
    target: `>= ${(slo.availability * 100).toFixed(1)}%`,
    actual: `${(availability * 100).toFixed(2)}%`,
    pass: availability >= slo.availability,
    severity: availability < slo.availability * 0.99 ? 'critical' : availability < slo.availability ? 'warning' : 'ok',
  });

  // P50 延迟
  const p50 = m.http_req_duration?.values?.med || 0;
  results.push({
    metric: 'P50 延迟',
    target: `< ${slo.latency_p50}ms`,
    actual: `${p50.toFixed(0)}ms`,
    pass: p50 < slo.latency_p50,
    severity: p50 > slo.latency_p50 * 2 ? 'critical' : p50 > slo.latency_p50 ? 'warning' : 'ok',
  });

  // P95 延迟
  const p95 = m.http_req_duration?.values?.['p(95)'] || 0;
  results.push({
    metric: 'P95 延迟',
    target: `< ${slo.latency_p95}ms`,
    actual: `${p95.toFixed(0)}ms`,
    pass: p95 < slo.latency_p95,
    severity: p95 > slo.latency_p95 * 2 ? 'critical' : p95 > slo.latency_p95 ? 'warning' : 'ok',
  });

  // P99 延迟
  const p99 = m.http_req_duration?.values?.['p(99)'] || 0;
  results.push({
    metric: 'P99 延迟',
    target: `< ${slo.latency_p99}ms`,
    actual: `${p99.toFixed(0)}ms`,
    pass: p99 < slo.latency_p99,
    severity: p99 > slo.latency_p99 * 2 ? 'critical' : p99 > slo.latency_p99 ? 'warning' : 'ok',
  });

  // 错误率
  results.push({
    metric: '错误率',
    target: `< ${(slo.error_rate * 100).toFixed(1)}%`,
    actual: `${(errorRate * 100).toFixed(2)}%`,
    pass: errorRate < slo.error_rate,
    severity: errorRate > slo.error_rate * 3 ? 'critical' : errorRate > slo.error_rate ? 'warning' : 'ok',
  });

  // 绘制成功率
  const drawRate = m.draw_success_rate?.values?.rate;
  if (drawRate !== undefined) {
    results.push({
      metric: '绘制成功率',
      target: `>= ${(slo.draw_success_rate * 100).toFixed(0)}%`,
      actual: `${(drawRate * 100).toFixed(2)}%`,
      pass: drawRate >= slo.draw_success_rate,
      severity: drawRate < slo.draw_success_rate * 0.9 ? 'critical' : drawRate < slo.draw_success_rate ? 'warning' : 'ok',
    });
  }

  return results;
}

function generateRecommendations(latency, sloResults, metrics) {
  const recommendations = [];

  // 基于延迟分布
  if (latency.distribution === 'heavy_tail') {
    recommendations.push({
      priority: 'HIGH',
      area: '延迟优化',
      issue: `P99/P50 比率达到 ${latency.tail_ratio_p99_p50}x，存在严重尾部延迟`,
      suggestions: [
        '检查数据库慢查询日志，优化 P99 查询',
        '增加连接池大小或优化连接复用',
        '考虑添加请求超时和熔断机制',
        '检查 GC 暂停是否导致延迟抖动',
      ],
    });
  }

  // 基于 SLO 违规
  const criticals = sloResults.filter(r => r.severity === 'critical');
  if (criticals.length > 0) {
    recommendations.push({
      priority: 'CRITICAL',
      area: 'SLO 违规',
      issue: `${criticals.length} 项 SLO 指标严重违规`,
      suggestions: criticals.map(c => `${c.metric}: 实际 ${c.actual} vs 目标 ${c.target}`),
    });
  }

  // 基于吞吐量
  const reqs = metrics.http_reqs?.values || {};
  if (reqs.rate && reqs.rate < 100) {
    recommendations.push({
      priority: 'MEDIUM',
      area: '吞吐量',
      issue: `RPS 仅 ${reqs.rate.toFixed(0)}，可能存在处理瓶颈`,
      suggestions: [
        '检查 CPU 和内存使用率',
        '确认数据库连接池未耗尽',
        '检查是否存在全局锁或序列化处理',
      ],
    });
  }

  // WebSocket 分析
  const wsFailures = metrics.ws_connection_failures?.values?.count || 0;
  const wsTotal = metrics.ws_connections?.values?.count || 0;
  if (wsTotal > 0 && wsFailures / wsTotal > 0.05) {
    recommendations.push({
      priority: 'HIGH',
      area: 'WebSocket',
      issue: `WebSocket 连接失败率 ${((wsFailures / wsTotal) * 100).toFixed(1)}%`,
      suggestions: [
        '检查最大连接数限制 (ulimit)',
        '确认 WebSocket 服务器资源配置',
        '检查代理/负载均衡器 WebSocket 超时设置',
      ],
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      priority: 'INFO',
      area: '整体',
      issue: '未发现明显性能问题',
      suggestions: ['当前性能表现良好，建议持续监控'],
    });
  }

  return recommendations;
}

function main() {
  console.log('🔬 FunnyPixels 性能分析器\n');

  const data = loadData(opts.input);
  const metrics = data.metrics || {};
  const slo = opts.slo ? loadData(opts.slo) : DEFAULT_SLO;

  // 1. 延迟分布分析
  console.log('📈 延迟分布分析');
  console.log('-'.repeat(50));
  const latency = analyzeLatencyDistribution(metrics);
  console.log(`  平均: ${latency.avg.toFixed(1)}ms | P50: ${latency.med.toFixed(1)}ms | P95: ${latency.p95.toFixed(1)}ms | P99: ${latency.p99.toFixed(1)}ms`);
  console.log(`  尾部比率: P99/P50 = ${latency.tail_ratio_p99_p50}x | Max/P95 = ${latency.tail_ratio_max_p95}x`);
  console.log(`  分布: ${latency.distribution_desc}\n`);

  // 2. SLO 检查
  console.log('🎯 SLO 合规检查');
  console.log('-'.repeat(50));
  const sloResults = checkSLO(metrics, slo);
  for (const r of sloResults) {
    const icon = r.pass ? '✅' : r.severity === 'critical' ? '🔴' : '🟡';
    console.log(`  ${icon} ${r.metric.padEnd(14)} ${r.actual.padEnd(12)} (目标: ${r.target})`);
  }
  const sloPass = sloResults.filter(r => r.pass).length;
  console.log(`\n  通过: ${sloPass}/${sloResults.length}\n`);

  // 3. 优化建议
  console.log('💡 优化建议');
  console.log('-'.repeat(50));
  const recommendations = generateRecommendations(latency, sloResults, metrics);
  for (const rec of recommendations) {
    const icon = rec.priority === 'CRITICAL' ? '🔴' : rec.priority === 'HIGH' ? '🟠' : rec.priority === 'MEDIUM' ? '🟡' : '🟢';
    console.log(`\n  ${icon} [${rec.priority}] ${rec.area}`);
    console.log(`     问题: ${rec.issue}`);
    for (const s of rec.suggestions) {
      console.log(`     → ${s}`);
    }
  }

  // 输出文件
  if (opts.output) {
    const report = {
      timestamp: new Date().toISOString(),
      input: opts.input,
      latency_analysis: latency,
      slo_results: sloResults,
      recommendations,
      summary: {
        slo_pass_rate: `${sloPass}/${sloResults.length}`,
        distribution: latency.distribution,
        critical_issues: recommendations.filter(r => r.priority === 'CRITICAL').length,
      },
    };
    fs.writeFileSync(opts.output, JSON.stringify(report, null, 2));
    console.log(`\n📝 报告已保存: ${opts.output}`);
  }

  console.log('');
}

main();
