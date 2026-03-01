#!/usr/bin/env node

/**
 * FunnyPixels 网络延迟注入测试
 *
 * 在应用层面模拟网络延迟，测试系统在不同延迟条件下的表现：
 * - 固定延迟注入
 * - 随机延迟抖动
 * - 渐进式延迟增加
 * - 间歇性超时
 *
 * 使用方法:
 * node chaos/network-latency-injection.js --target http://localhost:3001 --latency 200 --duration 60
 */

const axios = require('axios');
const { Command } = require('commander');

const program = new Command();
program
  .requiredOption('--target <url>', 'API 目标地址', 'http://localhost:3001')
  .option('--latency <ms>', '基础延迟 (ms)', '200')
  .option('--jitter <ms>', '延迟抖动 (ms)', '100')
  .option('-d, --duration <sec>', '测试持续时间 (秒)', '60')
  .option('-c, --concurrency <n>', '并发请求数', '20')
  .option('--scenario <type>', '场景: fixed|jitter|progressive|intermittent', 'progressive')
  .parse(process.argv);

const opts = program.opts();
const BASE_LATENCY = parseInt(opts.latency);
const JITTER = parseInt(opts.jitter);
const DURATION = parseInt(opts.duration) * 1000;
const CONCURRENCY = parseInt(opts.concurrency);
const TARGET = opts.target;

const stats = {
  requests_total: 0,
  requests_success: 0,
  requests_timeout: 0,
  requests_error: 0,
  latencies: [],
  injected_delays: [],
  phases: [],
  start_time: null,
};

// API 端点列表（模拟真实流量）
const ENDPOINTS = [
  { method: 'GET', path: '/api/health', weight: 30 },
  { method: 'GET', path: '/api/pixels/tile/0/0', weight: 40 },
  { method: 'GET', path: '/api/leaderboard/personal', weight: 15 },
  { method: 'GET', path: '/api/auth/me', weight: 15 },
];

function pickEndpoint() {
  const roll = Math.random() * 100;
  let cumulative = 0;
  for (const ep of ENDPOINTS) {
    cumulative += ep.weight;
    if (roll < cumulative) return ep;
  }
  return ENDPOINTS[0];
}

/**
 * 延迟注入策略
 */
const SCENARIOS = {
  // 固定延迟
  fixed: (elapsed) => BASE_LATENCY,

  // 随机抖动
  jitter: (elapsed) => BASE_LATENCY + (Math.random() * 2 - 1) * JITTER,

  // 渐进式增加 (0ms → BASE_LATENCY → 2x → 回落)
  progressive: (elapsed) => {
    const progress = elapsed / DURATION;
    if (progress < 0.2) return BASE_LATENCY * progress * 5; // 渐进增加
    if (progress < 0.5) return BASE_LATENCY; // 稳定期
    if (progress < 0.7) return BASE_LATENCY * (1 + (progress - 0.5) * 5); // 恶化期
    if (progress < 0.85) return BASE_LATENCY * 2; // 高延迟期
    return BASE_LATENCY * (1 - (progress - 0.85) * 6.67); // 恢复期
  },

  // 间歇性超时 (80%正常, 20%超时)
  intermittent: (elapsed) => {
    if (Math.random() < 0.2) return 5000 + Math.random() * 5000; // 超时
    return Math.random() * 50; // 正常
  },
};

/**
 * 在请求前注入延迟
 */
async function injectDelay(scenario, elapsed) {
  const delay = Math.max(0, SCENARIOS[scenario](elapsed));
  stats.injected_delays.push(delay);
  if (delay > 0) {
    await new Promise(r => setTimeout(r, delay));
  }
  return delay;
}

async function makeRequest(scenario, elapsed) {
  const ep = pickEndpoint();
  const injectedDelay = await injectDelay(scenario, elapsed);

  stats.requests_total++;
  const start = Date.now();

  try {
    const response = await axios({
      method: ep.method,
      url: `${TARGET}${ep.path}`,
      timeout: 10000,
      validateStatus: () => true,
    });

    const totalLatency = Date.now() - start;
    stats.latencies.push(totalLatency);

    if (response.status < 500) {
      stats.requests_success++;
    } else {
      stats.requests_error++;
    }
  } catch (err) {
    const totalLatency = Date.now() - start;
    stats.latencies.push(totalLatency);

    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      stats.requests_timeout++;
    } else {
      stats.requests_error++;
    }
  }
}

async function worker(scenario) {
  while (Date.now() - stats.start_time < DURATION) {
    const elapsed = Date.now() - stats.start_time;
    await makeRequest(scenario, elapsed);
    await new Promise(r => setTimeout(r, Math.random() * 100));
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
    console.error(`   可用场景: ${Object.keys(SCENARIOS).join(', ')}`);
    process.exit(1);
  }

  console.log('🌪️  FunnyPixels 网络延迟注入测试\n');
  console.log(`   目标:     ${TARGET}`);
  console.log(`   场景:     ${scenario}`);
  console.log(`   基础延迟: ${BASE_LATENCY}ms (抖动: ±${JITTER}ms)`);
  console.log(`   并发数:   ${CONCURRENCY}`);
  console.log(`   持续时间: ${DURATION / 1000}s\n`);

  // 验证目标可达
  try {
    await axios.get(`${TARGET}/api/health`, { timeout: 5000 });
    console.log('✅ 目标服务可达\n');
  } catch {
    console.log('⚠️  目标服务不可达，仍然继续测试\n');
  }

  stats.start_time = Date.now();

  const progressInterval = setInterval(() => {
    const elapsed = (Date.now() - stats.start_time) / 1000;
    const rps = stats.requests_total / elapsed;
    const avgDelay = stats.injected_delays.length > 0
      ? stats.injected_delays.slice(-100).reduce((a, b) => a + b, 0) / Math.min(stats.injected_delays.length, 100)
      : 0;
    process.stdout.write(
      `\r  [${elapsed.toFixed(0)}s] RPS: ${rps.toFixed(0)} | ` +
      `成功: ${stats.requests_success} | 超时: ${stats.requests_timeout} | ` +
      `注入延迟: ${avgDelay.toFixed(0)}ms`
    );
  }, 1000);

  const workers = Array.from({ length: CONCURRENCY }, () => worker(scenario));
  await Promise.all(workers);
  clearInterval(progressInterval);
  console.log('\n');

  // 输出结果
  const duration = (Date.now() - stats.start_time) / 1000;
  const total = stats.requests_total;

  console.log('='.repeat(60));
  console.log('📊 延迟注入测试结果');
  console.log('='.repeat(60));
  console.log(`\n  场景:          ${scenario}`);
  console.log(`  总请求数:      ${total.toLocaleString()}`);
  console.log(`  成功:          ${stats.requests_success.toLocaleString()} (${((stats.requests_success / total) * 100).toFixed(1)}%)`);
  console.log(`  超时:          ${stats.requests_timeout.toLocaleString()} (${((stats.requests_timeout / total) * 100).toFixed(1)}%)`);
  console.log(`  错误:          ${stats.requests_error.toLocaleString()}`);
  console.log(`  RPS:           ${(total / duration).toFixed(0)}`);

  console.log(`\n  端到端延迟 (含注入):`);
  console.log(`    P50:         ${percentile(stats.latencies, 50).toFixed(0)}ms`);
  console.log(`    P95:         ${percentile(stats.latencies, 95).toFixed(0)}ms`);
  console.log(`    P99:         ${percentile(stats.latencies, 99).toFixed(0)}ms`);

  console.log(`\n  注入延迟统计:`);
  console.log(`    平均:        ${percentile(stats.injected_delays, 50).toFixed(0)}ms`);
  console.log(`    最大:        ${Math.max(...stats.injected_delays, 0).toFixed(0)}ms`);

  // 评估系统韧性
  const timeoutRate = stats.requests_timeout / total;
  let resilience = 'EXCELLENT';
  if (timeoutRate > 0.20) resilience = 'POOR';
  else if (timeoutRate > 0.10) resilience = 'FAIR';
  else if (timeoutRate > 0.05) resilience = 'GOOD';

  console.log(`\n  系统韧性评级: ${resilience}`);
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('❌ 测试失败:', err.message);
  process.exit(1);
});
