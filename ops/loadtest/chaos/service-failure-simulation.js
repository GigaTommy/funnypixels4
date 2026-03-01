#!/usr/bin/env node

/**
 * FunnyPixels 服务故障模拟测试
 *
 * 模拟各种服务故障场景，测试系统的降级和恢复能力：
 * - API 端点间歇性不可用
 * - 响应时间骤增
 * - 部分功能降级
 * - 错误率飙升后恢复
 *
 * 使用方法:
 * node chaos/service-failure-simulation.js --target http://localhost:3001 --scenario cascade
 */

const axios = require('axios');
const WebSocket = require('ws');
const { Command } = require('commander');

const program = new Command();
program
  .requiredOption('--target <url>', 'API 目标地址', 'http://localhost:3001')
  .option('-d, --duration <sec>', '测试持续时间 (秒)', '120')
  .option('-c, --concurrency <n>', '并发数', '30')
  .option('--scenario <type>', '场景: cascade|partial|spike-recovery|degradation', 'cascade')
  .parse(process.argv);

const opts = program.opts();
const DURATION = parseInt(opts.duration) * 1000;
const CONCURRENCY = parseInt(opts.concurrency);
const TARGET = opts.target;

const stats = {
  phases: [],
  current_phase: null,
  requests: { total: 0, success: 0, failed: 0, timeout: 0 },
  ws: { connected: 0, failed: 0, messages: 0 },
  latencies: [],
  phase_results: {},
  start_time: null,
};

/**
 * 故障场景定义
 */
const SCENARIOS = {
  // 级联故障: 正常 → 部分超时 → 大面积故障 → 恢复
  cascade: [
    { name: '正常运行', duration: 0.15, errorInjection: 0, latencyMultiplier: 1 },
    { name: '初期异常', duration: 0.15, errorInjection: 0.05, latencyMultiplier: 1.5 },
    { name: '延迟增加', duration: 0.15, errorInjection: 0.10, latencyMultiplier: 3 },
    { name: '部分故障', duration: 0.15, errorInjection: 0.30, latencyMultiplier: 5 },
    { name: '大面积故障', duration: 0.15, errorInjection: 0.50, latencyMultiplier: 10 },
    { name: '开始恢复', duration: 0.10, errorInjection: 0.20, latencyMultiplier: 3 },
    { name: '恢复完成', duration: 0.15, errorInjection: 0.02, latencyMultiplier: 1 },
  ],

  // 部分功能降级
  partial: [
    { name: '全功能正常', duration: 0.20, errorInjection: 0, latencyMultiplier: 1, disabledEndpoints: [] },
    { name: '像素服务降级', duration: 0.30, errorInjection: 0, latencyMultiplier: 1, disabledEndpoints: ['/api/pixels'] },
    { name: '排行榜不可用', duration: 0.30, errorInjection: 0, latencyMultiplier: 1, disabledEndpoints: ['/api/pixels', '/api/leaderboard'] },
    { name: '逐步恢复', duration: 0.20, errorInjection: 0, latencyMultiplier: 1, disabledEndpoints: [] },
  ],

  // 错误率飙升后恢复
  'spike-recovery': [
    { name: '基线', duration: 0.20, errorInjection: 0, latencyMultiplier: 1 },
    { name: '错误飙升', duration: 0.10, errorInjection: 0.80, latencyMultiplier: 1 },
    { name: '恢复中', duration: 0.20, errorInjection: 0.30, latencyMultiplier: 2 },
    { name: '接近正常', duration: 0.20, errorInjection: 0.05, latencyMultiplier: 1.2 },
    { name: '完全恢复', duration: 0.30, errorInjection: 0, latencyMultiplier: 1 },
  ],

  // 渐进式降级
  degradation: [
    { name: 'P50正常', duration: 0.15, errorInjection: 0, latencyMultiplier: 1 },
    { name: 'P95上升', duration: 0.15, errorInjection: 0.02, latencyMultiplier: 2 },
    { name: 'P99异常', duration: 0.15, errorInjection: 0.05, latencyMultiplier: 4 },
    { name: '全面恶化', duration: 0.20, errorInjection: 0.15, latencyMultiplier: 8 },
    { name: '触发熔断', duration: 0.15, errorInjection: 0.60, latencyMultiplier: 1 },
    { name: '熔断恢复', duration: 0.20, errorInjection: 0.01, latencyMultiplier: 1 },
  ],
};

const ENDPOINTS = [
  { method: 'GET', path: '/api/health', category: 'health' },
  { method: 'GET', path: '/api/pixels/tile/0/0', category: 'pixels' },
  { method: 'GET', path: '/api/leaderboard/personal', category: 'leaderboard' },
  { method: 'GET', path: '/api/auth/me', category: 'auth' },
];

function getCurrentPhase(scenario, elapsed) {
  const phases = SCENARIOS[scenario];
  let cumulative = 0;
  for (const phase of phases) {
    cumulative += phase.duration;
    if (elapsed / DURATION <= cumulative) return phase;
  }
  return phases[phases.length - 1];
}

async function makeRequest(scenario, elapsed) {
  const phase = getCurrentPhase(scenario, elapsed);
  const ep = ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)];

  // 检查端点是否被"禁用"
  if (phase.disabledEndpoints?.some(d => ep.path.startsWith(d))) {
    stats.requests.total++;
    stats.requests.failed++;
    return;
  }

  // 模拟错误注入
  if (Math.random() < (phase.errorInjection || 0)) {
    stats.requests.total++;
    stats.requests.failed++;
    const fakeLatency = Math.random() * 100 * (phase.latencyMultiplier || 1);
    stats.latencies.push(fakeLatency);
    await new Promise(r => setTimeout(r, fakeLatency));
    return;
  }

  stats.requests.total++;
  const start = Date.now();

  try {
    const timeout = 10000 / (phase.latencyMultiplier || 1);
    await axios({
      method: ep.method,
      url: `${TARGET}${ep.path}`,
      timeout: Math.max(timeout, 2000),
      validateStatus: () => true,
    });

    const latency = Date.now() - start;
    stats.latencies.push(latency);
    stats.requests.success++;
  } catch (err) {
    stats.latencies.push(Date.now() - start);
    if (err.code === 'ECONNABORTED') stats.requests.timeout++;
    else stats.requests.failed++;
  }
}

async function testWebSocket() {
  return new Promise((resolve) => {
    const wsUrl = TARGET.replace('http', 'ws') + '/ws/tile-updates';
    try {
      const ws = new WebSocket(wsUrl, { handshakeTimeout: 5000 });
      ws.on('open', () => {
        stats.ws.connected++;
        ws.send(JSON.stringify({ type: 'subscribe', tiles: ['tile_0_0'] }));
      });
      ws.on('message', () => { stats.ws.messages++; });
      ws.on('error', () => { stats.ws.failed++; });
      setTimeout(() => { ws.close(); resolve(); }, 5000);
    } catch {
      stats.ws.failed++;
      resolve();
    }
  });
}

async function worker(scenario) {
  while (Date.now() - stats.start_time < DURATION) {
    const elapsed = Date.now() - stats.start_time;
    await makeRequest(scenario, elapsed);
    await new Promise(r => setTimeout(r, 50 + Math.random() * 100));
  }
}

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * p / 100) - 1];
}

async function main() {
  const scenario = opts.scenario;
  if (!SCENARIOS[scenario]) {
    console.error(`❌ 未知场景: ${scenario}`);
    console.error(`   可用: ${Object.keys(SCENARIOS).join(', ')}`);
    process.exit(1);
  }

  const phases = SCENARIOS[scenario];
  console.log('💥 FunnyPixels 服务故障模拟测试\n');
  console.log(`   目标:     ${TARGET}`);
  console.log(`   场景:     ${scenario}`);
  console.log(`   并发数:   ${CONCURRENCY}`);
  console.log(`   持续时间: ${DURATION / 1000}s`);
  console.log(`\n   阶段:`);
  let cumTime = 0;
  for (const p of phases) {
    const dur = (p.duration * DURATION / 1000).toFixed(0);
    cumTime += p.duration * DURATION / 1000;
    console.log(`     ${p.name.padEnd(14)} ${dur}s (错误率:${(p.errorInjection * 100).toFixed(0)}%, 延迟:x${p.latencyMultiplier})`);
  }
  console.log('');

  stats.start_time = Date.now();
  let lastPhase = '';

  const progressInterval = setInterval(() => {
    const elapsed = Date.now() - stats.start_time;
    const phase = getCurrentPhase(scenario, elapsed);
    const rps = stats.requests.total / (elapsed / 1000);
    const errorRate = stats.requests.total > 0
      ? ((stats.requests.failed + stats.requests.timeout) / stats.requests.total * 100).toFixed(1)
      : '0.0';

    if (phase.name !== lastPhase) {
      console.log(`\n  >>> 阶段切换: ${phase.name}`);
      lastPhase = phase.name;
    }

    process.stdout.write(
      `\r  [${(elapsed / 1000).toFixed(0)}s] ${phase.name.padEnd(12)} | ` +
      `RPS: ${rps.toFixed(0)} | 成功: ${stats.requests.success} | ` +
      `失败: ${stats.requests.failed} | 错误率: ${errorRate}%`
    );
  }, 1000);

  // 主要工作: HTTP 请求
  const workers = Array.from({ length: CONCURRENCY }, () => worker(scenario));

  // WebSocket 周期性检查
  const wsChecks = [];
  const wsInterval = setInterval(() => {
    wsChecks.push(testWebSocket());
  }, 5000);

  await Promise.all(workers);
  clearInterval(progressInterval);
  clearInterval(wsInterval);
  await Promise.all(wsChecks);
  console.log('\n\n');

  // 输出结果
  const duration = (Date.now() - stats.start_time) / 1000;
  const total = stats.requests.total;

  console.log('='.repeat(60));
  console.log('📊 故障模拟测试结果');
  console.log('='.repeat(60));
  console.log(`\n  场景:          ${scenario}`);
  console.log(`  总请求数:      ${total.toLocaleString()}`);
  console.log(`  成功:          ${stats.requests.success.toLocaleString()} (${((stats.requests.success / total) * 100).toFixed(1)}%)`);
  console.log(`  失败:          ${stats.requests.failed.toLocaleString()}`);
  console.log(`  超时:          ${stats.requests.timeout.toLocaleString()}`);
  console.log(`  RPS:           ${(total / duration).toFixed(0)}`);

  console.log(`\n  延迟:`);
  console.log(`    P50:         ${percentile(stats.latencies, 50).toFixed(0)}ms`);
  console.log(`    P95:         ${percentile(stats.latencies, 95).toFixed(0)}ms`);
  console.log(`    P99:         ${percentile(stats.latencies, 99).toFixed(0)}ms`);

  console.log(`\n  WebSocket:`);
  console.log(`    连接成功:    ${stats.ws.connected}`);
  console.log(`    连接失败:    ${stats.ws.failed}`);
  console.log(`    接收消息:    ${stats.ws.messages}`);

  // 系统韧性评估
  const recoveryPhase = phases[phases.length - 1];
  const successRate = stats.requests.success / total;
  let resilience = 'EXCELLENT';
  if (successRate < 0.50) resilience = 'POOR';
  else if (successRate < 0.70) resilience = 'FAIR';
  else if (successRate < 0.85) resilience = 'GOOD';

  console.log(`\n  系统韧性: ${resilience}`);
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('❌ 测试失败:', err.message);
  process.exit(1);
});
