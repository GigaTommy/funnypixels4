/**
 * FunnyPixels 尖峰流量测试
 *
 * 测试目标: 模拟突发流量，测试系统在短时间内承受5倍流量时的表现
 * 典型场景: 营销活动、社交媒体爆款、新功能发布
 *
 * 运行示例:
 * k6 run --out json=reports/spike-test-$(date +%Y%m%d-%H%M%S).json k6/advanced/spike-test.js
 *
 * 环境变量:
 * - BASE_URL: API基础URL
 * - BASELINE_VUS: 基线用户数 (默认: 100)
 * - SPIKE_MULTIPLIER: 尖峰倍数 (默认: 5)
 * - SPIKE_DURATION: 尖峰持续时间(秒) (默认: 60)
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend, Rate, Gauge } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// ==================== 配置 ====================

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const BASELINE_VUS = parseInt(__ENV.BASELINE_VUS || '100');
const SPIKE_MULTIPLIER = parseInt(__ENV.SPIKE_MULTIPLIER || '5');
const SPIKE_DURATION = `${parseInt(__ENV.SPIKE_DURATION || '60')}s`;
const SPIKE_VUS = BASELINE_VUS * SPIKE_MULTIPLIER;

// ==================== 自定义指标 ====================

const drawSuccess = new Counter('pixel_draw_success');
const drawFailure = new Counter('pixel_draw_failure');
const drawLatency = new Trend('pixel_draw_latency');
const drawSuccessRate = new Rate('draw_success_rate');

const spikePhaseActive = new Gauge('spike_phase_active');
const systemOverloadErrors = new Counter('system_overload_errors');
const queueingTime = new Trend('queueing_time');
const recoveryTime = new Trend('recovery_time');

// ==================== 测试数据 ====================

const testUsers = new SharedArray('users', function() {
  const file = __ENV.TEST_DATA_FILE || '../data/test-users.json';
  try {
    return JSON.parse(open(file));
  } catch (e) {
    const users = [];
    for (let i = 0; i < 10000; i++) {
      users.push({
        id: `load_test_${i}`,
        email: `loadtest${i}@example.com`,
        password: 'TestPassword123!',
        username: `TestUser${i}`
      });
    }
    return users;
  }
});

const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'];

// ==================== 测试配置 ====================

export const options = {
  scenarios: {
    spike_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        // 阶段1: 建立基线 (0 → BASELINE_VUS, 2分钟)
        { duration: '2m', target: BASELINE_VUS },

        // 阶段2: 基线稳定 (BASELINE_VUS, 3分钟)
        { duration: '3m', target: BASELINE_VUS },

        // 阶段3: 尖峰冲击 (BASELINE_VUS → SPIKE_VUS, 10秒)
        { duration: '10s', target: SPIKE_VUS },

        // 阶段4: 尖峰持续 (SPIKE_VUS, SPIKE_DURATION)
        { duration: SPIKE_DURATION, target: SPIKE_VUS },

        // 阶段5: 快速回落 (SPIKE_VUS → BASELINE_VUS, 10秒)
        { duration: '10s', target: BASELINE_VUS },

        // 阶段6: 恢复观察 (BASELINE_VUS, 5分钟)
        { duration: '5m', target: BASELINE_VUS },

        // 阶段7: 平滑结束 (BASELINE_VUS → 0, 1分钟)
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
      gracefulStop: '15s',
    },
  },

  thresholds: {
    // 尖峰期间允许较低的成功率
    'draw_success_rate': [
      { threshold: 'rate>0.90', abortOnFail: false }, // 尖峰期间 90%
    ],

    // 延迟允许升高但不应超过合理范围
    'pixel_draw_latency': [
      'p(50)<500',           // P50 < 500ms
      'p(95)<2000',          // P95 < 2秒（尖峰期间允许）
      'p(99)<5000',          // P99 < 5秒
      'avg<1000',            // 平均 < 1秒
    ],

    // HTTP错误率
    'http_req_failed': ['rate<0.15'], // 尖峰期间允许15%错误

    // 系统不应完全崩溃
    'http_req_duration': [
      'max<30000',           // 最大响应时间 < 30秒
    ],
  },

  // 增加连接和请求超时
  httpDebug: 'full',
  noConnectionReuse: false,
  userAgent: 'FunnypixelsSpike Test/1.0',
};

// ==================== 工具函数 ====================

function randomCoordinate() {
  const lat = 39.9 + Math.random() * 0.02;
  const lng = 116.39 + Math.random() * 0.02;
  return {
    lat: Math.round(lat * 100000) / 100000,
    lng: Math.round(lng * 100000) / 100000
  };
}

function randomColor() {
  return colors[randomIntBetween(0, colors.length - 1)];
}

// ==================== 用户行为函数 ====================

function drawPixel(userId, token) {
  const coord = randomCoordinate();
  const color = randomColor();

  const url = `${BASE_URL}/api/pixel`;
  const payload = JSON.stringify({
    latitude: coord.lat,
    longitude: coord.lng,
    userId: userId,
    color: color,
    drawType: 'manual'
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    tags: { name: 'draw_pixel' },
    timeout: '30s' // 尖峰期间增加超时
  };

  const startTime = Date.now();
  const res = http.post(url, payload, params);
  const duration = Date.now() - startTime;

  drawLatency.add(duration);

  // 检测排队时间（如果有）
  const queueTime = res.timings.waiting || 0;
  if (queueTime > 100) {
    queueingTime.add(queueTime);
  }

  const success = check(res, {
    'draw status 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  if (success) {
    drawSuccess.add(1);
    drawSuccessRate.add(true);
  } else {
    drawFailure.add(1);
    drawSuccessRate.add(false);

    // 检测系统过载错误
    if (res.status === 503 || res.status === 504 || res.status === 429) {
      systemOverloadErrors.add(1);
    }
  }

  return success;
}

// ==================== Setup & Teardown ====================

export function setup() {
  console.log('🚀 尖峰流量测试开始');
  console.log(`📊 基线用户数: ${BASELINE_VUS}`);
  console.log(`⚡ 尖峰用户数: ${SPIKE_VUS} (${SPIKE_MULTIPLIER}x)`);
  console.log(`⏱️  尖峰持续: ${SPIKE_DURATION}`);
  console.log(`🎯 目标URL: ${BASE_URL}`);
  console.log('\n测试阶段:');
  console.log(`  1. 建立基线: 0→${BASELINE_VUS}用户 (2分钟)`);
  console.log(`  2. 基线稳定: ${BASELINE_VUS}用户 (3分钟)`);
  console.log(`  3. 尖峰冲击: ${BASELINE_VUS}→${SPIKE_VUS}用户 (10秒) ⚡`);
  console.log(`  4. 尖峰持续: ${SPIKE_VUS}用户 (${SPIKE_DURATION})`);
  console.log(`  5. 快速回落: ${SPIKE_VUS}→${BASELINE_VUS}用户 (10秒)`);
  console.log(`  6. 恢复观察: ${BASELINE_VUS}用户 (5分钟)\n`);

  return {
    startTime: Date.now(),
    config: {
      baseline: BASELINE_VUS,
      spike: SPIKE_VUS,
      multiplier: SPIKE_MULTIPLIER
    }
  };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`\n✅ 尖峰流量测试完成`);
  console.log(`⏱️  总耗时: ${(duration / 60).toFixed(2)}分钟`);
}

// ==================== 主测试函数 ====================

export default function(data) {
  const userIndex = randomIntBetween(0, testUsers.length - 1);
  const user = testUsers[userIndex];
  const token = `test_token_${user.id}`;

  // 检测是否在尖峰阶段
  const currentVUs = __VU;
  const isSpike = currentVUs > BASELINE_VUS * 1.5;
  spikePhaseActive.add(isSpike ? 1 : 0);

  group('Spike Test Session', function() {
    // 在尖峰期间增加请求频率
    const requestCount = isSpike ? randomIntBetween(2, 5) : randomIntBetween(1, 2);

    for (let i = 0; i < requestCount; i++) {
      drawPixel(user.id, token);

      // 尖峰期间减少等待时间
      const thinkTime = isSpike ? randomIntBetween(0, 1) : randomIntBetween(1, 3);
      sleep(thinkTime);
    }
  });

  // 会话间隔
  const sessionGap = isSpike ? randomIntBetween(1, 2) : randomIntBetween(3, 5);
  sleep(sessionGap);
}

// ==================== 自定义报告 ====================

export function handleSummary(data) {
  const summary = {
    testName: 'Spike Traffic Test',
    timestamp: new Date().toISOString(),
    duration: data.state.testRunDurationMs / 1000,
    config: {
      baseline_vus: BASELINE_VUS,
      spike_vus: SPIKE_VUS,
      spike_multiplier: SPIKE_MULTIPLIER,
      spike_duration: SPIKE_DURATION
    },

    metrics: {
      draw_success: data.metrics.pixel_draw_success?.values?.count || 0,
      draw_failure: data.metrics.pixel_draw_failure?.values?.count || 0,
      draw_success_rate: (data.metrics.draw_success_rate?.values?.rate || 0) * 100,

      draw_latency_avg: data.metrics.pixel_draw_latency?.values?.avg || 0,
      draw_latency_p50: data.metrics.pixel_draw_latency?.values?.med || 0,
      draw_latency_p95: data.metrics.pixel_draw_latency?.values['p(95)'] || 0,
      draw_latency_p99: data.metrics.pixel_draw_latency?.values['p(99)'] || 0,
      draw_latency_max: data.metrics.pixel_draw_latency?.values?.max || 0,

      system_overload_errors: data.metrics.system_overload_errors?.values?.count || 0,
      queueing_time_avg: data.metrics.queueing_time?.values?.avg || 0,

      http_reqs: data.metrics.http_reqs?.values?.count || 0,
      http_req_failed_rate: (data.metrics.http_req_failed?.values?.rate || 0) * 100,
    },
  };

  console.log('\n' + '='.repeat(80));
  console.log('⚡ 尖峰流量测试报告');
  console.log('='.repeat(80));
  console.log(`\n📅 测试时间: ${new Date(summary.timestamp).toLocaleString('zh-CN')}`);
  console.log(`⏱️  测试时长: ${(summary.duration / 60).toFixed(2)}分钟`);
  console.log(`📊 基线/尖峰: ${BASELINE_VUS} / ${SPIKE_VUS}用户 (${SPIKE_MULTIPLIER}x)`);

  console.log('\n📈 业务指标:');
  console.log(`  ✅ 成功绘制: ${summary.metrics.draw_success}`);
  console.log(`  ❌ 失败绘制: ${summary.metrics.draw_failure}`);
  console.log(`  📊 成功率: ${summary.metrics.draw_success_rate.toFixed(2)}%`);

  console.log('\n⏱️  延迟指标:');
  console.log(`  平均延迟: ${summary.metrics.draw_latency_avg.toFixed(2)}ms`);
  console.log(`  P50延迟: ${summary.metrics.draw_latency_p50.toFixed(2)}ms`);
  console.log(`  P95延迟: ${summary.metrics.draw_latency_p95.toFixed(2)}ms`);
  console.log(`  P99延迟: ${summary.metrics.draw_latency_p99.toFixed(2)}ms`);
  console.log(`  最大延迟: ${summary.metrics.draw_latency_max.toFixed(2)}ms`);

  console.log('\n🔥 系统压力指标:');
  console.log(`  过载错误: ${summary.metrics.system_overload_errors}`);
  console.log(`  平均排队: ${summary.metrics.queueing_time_avg.toFixed(2)}ms`);
  console.log(`  HTTP错误率: ${summary.metrics.http_req_failed_rate.toFixed(2)}%`);

  console.log('\n' + '='.repeat(80));

  // 尖峰测试评级
  let rating = 'EXCELLENT';
  let recommendation = '系统能够很好地处理尖峰流量';

  if (summary.metrics.draw_success_rate < 85) {
    rating = 'POOR';
    recommendation = '需要增加系统容量或实施限流措施';
  } else if (summary.metrics.draw_success_rate < 90) {
    rating = 'FAIR';
    recommendation = '建议增加自动扩容或优化资源分配';
  } else if (summary.metrics.draw_success_rate < 95) {
    rating = 'GOOD';
    recommendation = '系统表现良好，可考虑进一步优化';
  }

  console.log(`\n🏆 尖峰承载能力: ${rating}`);
  console.log(`💡 建议: ${recommendation}`);
  console.log('='.repeat(80) + '\n');

  return {
    'stdout': '',
    'reports/spike-test-summary.json': JSON.stringify(summary, null, 2),
  };
}
