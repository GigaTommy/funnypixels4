#!/usr/bin/env node

/**
 * FunnyPixels 性能回归检测
 *
 * 对比基线与当前测试结果，检测性能回归
 * 在 CI/CD 流水线中使用，如果检测到回归则退出码为 1
 *
 * 使用方法:
 * node ci/performance-regression-check.js \
 *   --baseline reports/baseline/gradual-ramp-up.json \
 *   --current reports/current/gradual-ramp-up.json \
 *   --threshold 10
 */

const fs = require('fs');
const { Command } = require('commander');

const program = new Command();
program
  .requiredOption('-b, --baseline <file>', '基线结果 JSON 文件')
  .requiredOption('-c, --current <file>', '当前测试结果 JSON 文件')
  .option('-t, --threshold <percent>', '回归阈值百分比 (默认 10)', '10')
  .option('--strict', '严格模式: 任何回归即失败', false)
  .option('--output <file>', '输出回归报告', null)
  .parse(process.argv);

const opts = program.opts();
const THRESHOLD = parseFloat(opts.threshold);

/**
 * 从 k6 JSON 输出中提取关键指标
 */
function extractMetrics(data) {
  const m = data.metrics || {};

  return {
    // 延迟指标 (ms)
    http_req_duration_avg: m.http_req_duration?.values?.avg ?? null,
    http_req_duration_p95: m.http_req_duration?.values?.['p(95)'] ?? null,
    http_req_duration_p99: m.http_req_duration?.values?.['p(99)'] ?? null,
    http_req_duration_max: m.http_req_duration?.values?.max ?? null,

    // 吞吐量
    http_reqs_count: m.http_reqs?.values?.count ?? null,
    http_reqs_rate: m.http_reqs?.values?.rate ?? null,

    // 错误率
    http_req_failed_rate: m.http_req_failed?.values?.rate ?? null,

    // 业务指标
    pixel_draw_success: m.pixel_draw_success?.values?.count ?? null,
    pixel_draw_failure: m.pixel_draw_failure?.values?.count ?? null,
    draw_success_rate: m.draw_success_rate?.values?.rate ?? null,
    pixel_draw_latency_avg: m.pixel_draw_latency?.values?.avg ?? null,
    pixel_draw_latency_p95: m.pixel_draw_latency?.values?.['p(95)'] ?? null,

    // WebSocket
    ws_connections: m.ws_connections?.values?.count ?? null,
    ws_connection_failures: m.ws_connection_failures?.values?.count ?? null,
  };
}

/**
 * 计算两个指标值之间的变化百分比
 */
function calcChange(baseline, current) {
  if (baseline === null || current === null) return null;
  if (baseline === 0) return current === 0 ? 0 : Infinity;
  return ((current - baseline) / Math.abs(baseline)) * 100;
}

/**
 * 判断指标变化方向：值增大是好还是坏
 */
const METRIC_DIRECTION = {
  // 延迟: 增大 = 坏
  http_req_duration_avg: 'lower_is_better',
  http_req_duration_p95: 'lower_is_better',
  http_req_duration_p99: 'lower_is_better',
  http_req_duration_max: 'lower_is_better',
  pixel_draw_latency_avg: 'lower_is_better',
  pixel_draw_latency_p95: 'lower_is_better',

  // 吞吐量: 增大 = 好
  http_reqs_count: 'higher_is_better',
  http_reqs_rate: 'higher_is_better',
  pixel_draw_success: 'higher_is_better',

  // 成功率: 增大 = 好
  draw_success_rate: 'higher_is_better',

  // 错误率/失败: 增大 = 坏
  http_req_failed_rate: 'lower_is_better',
  pixel_draw_failure: 'lower_is_better',
  ws_connection_failures: 'lower_is_better',

  // 连接数: 中性
  ws_connections: 'neutral',
};

const METRIC_LABELS = {
  http_req_duration_avg: 'HTTP 平均延迟',
  http_req_duration_p95: 'HTTP P95 延迟',
  http_req_duration_p99: 'HTTP P99 延迟',
  http_req_duration_max: 'HTTP 最大延迟',
  http_reqs_count: 'HTTP 请求总数',
  http_reqs_rate: 'HTTP 请求速率',
  http_req_failed_rate: 'HTTP 失败率',
  pixel_draw_success: '像素绘制成功数',
  pixel_draw_failure: '像素绘制失败数',
  draw_success_rate: '绘制成功率',
  pixel_draw_latency_avg: '绘制平均延迟',
  pixel_draw_latency_p95: '绘制 P95 延迟',
  ws_connections: 'WebSocket 连接数',
  ws_connection_failures: 'WebSocket 连接失败数',
};

/**
 * 判断变化是否为回归
 */
function isRegression(metric, changePercent) {
  if (changePercent === null) return false;
  const direction = METRIC_DIRECTION[metric] || 'neutral';

  if (direction === 'lower_is_better') {
    return changePercent > THRESHOLD;
  } else if (direction === 'higher_is_better') {
    return changePercent < -THRESHOLD;
  }
  return false;
}

/**
 * 主函数
 */
function main() {
  console.log('🔍 FunnyPixels 性能回归检测\n');
  console.log(`   基线: ${opts.baseline}`);
  console.log(`   当前: ${opts.current}`);
  console.log(`   阈值: ${THRESHOLD}%`);
  console.log(`   模式: ${opts.strict ? '严格' : '标准'}\n`);

  // 读取文件
  let baselineData, currentData;
  try {
    baselineData = JSON.parse(fs.readFileSync(opts.baseline, 'utf8'));
  } catch (e) {
    console.error(`❌ 无法读取基线文件: ${opts.baseline}`);
    process.exit(1);
  }
  try {
    currentData = JSON.parse(fs.readFileSync(opts.current, 'utf8'));
  } catch (e) {
    console.error(`❌ 无法读取当前结果文件: ${opts.current}`);
    process.exit(1);
  }

  const baselineMetrics = extractMetrics(baselineData);
  const currentMetrics = extractMetrics(currentData);

  // 对比结果
  const results = [];
  let regressionCount = 0;
  let improvementCount = 0;

  for (const [metric, baselineValue] of Object.entries(baselineMetrics)) {
    const currentValue = currentMetrics[metric];
    const change = calcChange(baselineValue, currentValue);
    const regression = isRegression(metric, change);
    const direction = METRIC_DIRECTION[metric] || 'neutral';

    if (regression) regressionCount++;
    if (change !== null && !regression && Math.abs(change) > THRESHOLD) {
      if (direction === 'lower_is_better' && change < -THRESHOLD) improvementCount++;
      if (direction === 'higher_is_better' && change > THRESHOLD) improvementCount++;
    }

    results.push({
      metric,
      label: METRIC_LABELS[metric] || metric,
      baseline: baselineValue,
      current: currentValue,
      change,
      regression,
      direction,
    });
  }

  // 输出结果
  console.log('=' .repeat(80));
  console.log('指标'.padEnd(22) + '基线'.padEnd(14) + '当前'.padEnd(14) + '变化'.padEnd(12) + '状态');
  console.log('-'.repeat(80));

  for (const r of results) {
    if (r.baseline === null && r.current === null) continue;

    const baseline = r.baseline !== null ? formatValue(r.metric, r.baseline) : 'N/A';
    const current = r.current !== null ? formatValue(r.metric, r.current) : 'N/A';
    const change = r.change !== null ? `${r.change >= 0 ? '+' : ''}${r.change.toFixed(1)}%` : 'N/A';

    let status = '  ';
    if (r.regression) status = '🔴 回归';
    else if (r.change !== null && Math.abs(r.change) > THRESHOLD) {
      const improved = (r.direction === 'lower_is_better' && r.change < 0) ||
                       (r.direction === 'higher_is_better' && r.change > 0);
      if (improved) status = '🟢 改善';
    }

    console.log(
      r.label.padEnd(22) +
      baseline.padEnd(14) +
      current.padEnd(14) +
      change.padEnd(12) +
      status
    );
  }

  console.log('='.repeat(80));
  console.log(`\n📊 总结: ${regressionCount} 项回归, ${improvementCount} 项改善\n`);

  // 生成报告文件
  if (opts.output) {
    const report = {
      timestamp: new Date().toISOString(),
      baseline_file: opts.baseline,
      current_file: opts.current,
      threshold: THRESHOLD,
      strict_mode: opts.strict,
      regressions: regressionCount,
      improvements: improvementCount,
      details: results.filter(r => r.baseline !== null || r.current !== null),
    };
    fs.writeFileSync(opts.output, JSON.stringify(report, null, 2));
    console.log(`📝 报告已保存: ${opts.output}`);
  }

  // 退出码
  if (regressionCount > 0) {
    console.log(`\n❌ 检测到 ${regressionCount} 项性能回归，超出 ${THRESHOLD}% 阈值`);
    if (opts.strict || regressionCount >= 3) {
      console.log('   CI/CD 流水线标记为失败\n');
      process.exit(1);
    } else {
      console.log('   ⚠️  非严格模式下回归数量 < 3，标记为警告\n');
      process.exit(0);
    }
  } else {
    console.log('✅ 未检测到性能回归\n');
    process.exit(0);
  }
}

function formatValue(metric, value) {
  if (value === null) return 'N/A';
  if (metric.includes('rate') && value < 1) return (value * 100).toFixed(2) + '%';
  if (metric.includes('duration') || metric.includes('latency')) return value.toFixed(1) + 'ms';
  if (Number.isInteger(value)) return value.toLocaleString();
  return value.toFixed(2);
}

main();
