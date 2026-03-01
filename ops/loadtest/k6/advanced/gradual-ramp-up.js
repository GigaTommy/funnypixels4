/**
 * FunnyPixels 渐进式压力测试
 *
 * 测试目标: 逐步增加负载，从0用户平滑增长到5000用户，持续30分钟
 * 用于评估系统在逐步增压下的表现和资源消耗情况
 *
 * 运行示例:
 * k6 run --out json=reports/gradual-ramp-$(date +%Y%m%d-%H%M%S).json k6/advanced/gradual-ramp-up.js
 *
 * 环境变量:
 * - BASE_URL: API基础URL
 * - MAX_VUS: 最大虚拟用户数 (默认: 5000)
 * - RAMP_DURATION: 增压持续时间(分钟) (默认: 30)
 * - TEST_DATA_FILE: 测试数据文件路径
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend, Rate, Gauge } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// ==================== 配置 ====================

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const MAX_VUS = parseInt(__ENV.MAX_VUS || '5000');
const RAMP_DURATION = parseInt(__ENV.RAMP_DURATION || '30'); // 分钟

// 测试区域配置
const REGIONS = {
  beijing: { lat: [39.88, 39.92], lng: [116.38, 116.42] },
  shanghai: { lat: [31.22, 31.26], lng: [121.47, 121.51] },
  guangzhou: { lat: [23.11, 23.15], lng: [113.24, 113.28] },
  international: { lat: [-85, 85], lng: [-180, 180] }
};

// ==================== 自定义指标 ====================

// 业务指标
const pixelDrawSuccess = new Counter('pixel_draw_success');
const pixelDrawFailure = new Counter('pixel_draw_failure');
const pixelDrawLatency = new Trend('pixel_draw_latency');
const pixelConflicts = new Counter('pixel_conflicts');
const drawSuccessRate = new Rate('draw_success_rate');

// 认证指标
const authSuccess = new Counter('auth_success');
const authFailure = new Counter('auth_failures');
const authLatency = new Trend('auth_latency');

// WebSocket指标
const wsConnections = new Counter('ws_connections');
const wsConnectionFailures = new Counter('ws_connection_failures');
const wsMessageReceived = new Counter('ws_messages_received');
const wsLatency = new Trend('ws_message_latency');

// 系统指标
const activeUsers = new Gauge('active_users');
const requestRate = new Counter('request_rate');
const errorRate = new Rate('error_rate');

// ==================== 测试数据 ====================

const testUsers = new SharedArray('users', function() {
  const file = __ENV.TEST_DATA_FILE || '../data/test-users.json';
  try {
    return JSON.parse(open(file));
  } catch (e) {
    console.warn('测试数据文件未找到，使用默认用户');
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

const colors = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
  '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788',
  '#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6'
];

// ==================== 测试配置 ====================

export const options = {
  scenarios: {
    gradual_ramp_up: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        // 阶段1: 预热期 (0 → 100用户, 5分钟)
        { duration: '5m', target: 100 },

        // 阶段2: 稳定观察 (100用户, 5分钟)
        { duration: '5m', target: 100 },

        // 阶段3: 平滑增压 (100 → 500用户, 5分钟)
        { duration: '5m', target: 500 },

        // 阶段4: 稳定观察 (500用户, 5分钟)
        { duration: '5m', target: 500 },

        // 阶段5: 继续增压 (500 → 1000用户, 5分钟)
        { duration: '5m', target: 1000 },

        // 阶段6: 稳定观察 (1000用户, 5分钟)
        { duration: '5m', target: 1000 },

        // 阶段7: 高压测试 (1000 → 2000用户, 5分钟)
        { duration: '5m', target: 2000 },

        // 阶段8: 稳定观察 (2000用户, 5分钟)
        { duration: '5m', target: 2000 },

        // 阶段9: 极限测试 (2000 → MAX_VUS, 5分钟)
        { duration: '5m', target: MAX_VUS },

        // 阶段10: 极限稳定 (MAX_VUS, 10分钟)
        { duration: '10m', target: MAX_VUS },

        // 阶段11: 平滑降压 (MAX_VUS → 0, 5分钟)
        { duration: '5m', target: 0 },
      ],
      gracefulRampDown: '1m',
      gracefulStop: '30s',
    },
  },

  thresholds: {
    // 业务指标阈值
    'draw_success_rate': [
      'rate>0.95',           // 总体成功率 > 95%
      { threshold: 'rate>0.98', abortOnFail: false }, // 期望 > 98%
    ],

    'pixel_draw_latency': [
      'p(50)<200',           // 50%请求 < 200ms
      'p(95)<500',           // 95%请求 < 500ms
      'p(99)<1000',          // 99%请求 < 1000ms
      'avg<300',             // 平均 < 300ms
    ],

    // HTTP指标阈值
    'http_req_duration': [
      'p(95)<600',
      'p(99)<1200',
      'max<5000',            // 最大响应时间 < 5秒
    ],

    'http_req_failed': ['rate<0.05'], // HTTP错误率 < 5%

    // 系统指标阈值
    'error_rate': ['rate<0.02'],      // 总错误率 < 2%

    // 认证指标
    'auth_latency': [
      'p(95)<800',
      'avg<400',
    ],
  },

  // 扩展选项
  ext: {
    loadimpact: {
      projectID: 3566207,
      name: "FunnyPixels Gradual Ramp-up Test"
    }
  },

  // 汇总配置
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)', 'p(99.9)'],
  summaryTimeUnit: 'ms',
};

// ==================== 工具函数 ====================

function randomCoordinate(region = 'beijing') {
  const r = REGIONS[region] || REGIONS.beijing;
  const lat = r.lat[0] + Math.random() * (r.lat[1] - r.lat[0]);
  const lng = r.lng[0] + Math.random() * (r.lng[1] - r.lng[0]);

  return {
    lat: Math.round(lat * 100000) / 100000,
    lng: Math.round(lng * 100000) / 100000
  };
}

function randomColor() {
  return colors[randomIntBetween(0, colors.length - 1)];
}

function selectRegion() {
  const rand = Math.random();
  if (rand < 0.40) return 'beijing';
  if (rand < 0.70) return 'shanghai';
  if (rand < 0.90) return 'guangzhou';
  return 'international';
}

// ==================== 用户行为函数 ====================

/**
 * 用户登录
 */
function login(user) {
  const url = `${BASE_URL}/api/auth/login`;
  const payload = JSON.stringify({
    email: user.email,
    password: user.password
  });

  const params = {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'login' }
  };

  const startTime = Date.now();
  const res = http.post(url, payload, params);
  const duration = Date.now() - startTime;

  authLatency.add(duration);

  const success = check(res, {
    'login status 200': (r) => r.status === 200,
    'login has token': (r) => {
      try {
        return JSON.parse(r.body).token !== undefined;
      } catch (e) {
        return false;
      }
    }
  });

  if (success) {
    authSuccess.add(1);
    try {
      return JSON.parse(res.body).token;
    } catch (e) {
      return null;
    }
  } else {
    authFailure.add(1);
    errorRate.add(true);
    return null;
  }
}

/**
 * 绘制像素
 */
function drawPixel(userId, token, region) {
  const coord = randomCoordinate(region);
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
    tags: { name: 'draw_pixel' }
  };

  const startTime = Date.now();
  const res = http.post(url, payload, params);
  const duration = Date.now() - startTime;

  pixelDrawLatency.add(duration);
  requestRate.add(1);

  const success = check(res, {
    'draw status 2xx': (r) => r.status >= 200 && r.status < 300,
    'draw has pixel': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success === true || body.pixel !== undefined;
      } catch (e) {
        return false;
      }
    }
  });

  if (success) {
    pixelDrawSuccess.add(1);
    drawSuccessRate.add(true);
    errorRate.add(false);
  } else {
    pixelDrawFailure.add(1);
    drawSuccessRate.add(false);
    errorRate.add(true);

    if (res.status === 409) {
      pixelConflicts.add(1);
    }
  }

  return success;
}

/**
 * 批量绘制
 */
function batchDraw(userId, token, pixelCount, region) {
  const pixels = [];
  for (let i = 0; i < pixelCount; i++) {
    const coord = randomCoordinate(region);
    pixels.push({
      latitude: coord.lat,
      longitude: coord.lng,
      color: randomColor()
    });
  }

  const url = `${BASE_URL}/api/pixels/batch`;
  const payload = JSON.stringify({
    userId: userId,
    drawType: 'manual',
    pixels: pixels
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    tags: { name: 'batch_draw' }
  };

  const res = http.post(url, payload, params);
  requestRate.add(1);

  const success = check(res, {
    'batch status 2xx': (r) => r.status >= 200 && r.status < 300
  });

  if (success) {
    pixelDrawSuccess.add(pixelCount);
  } else {
    pixelDrawFailure.add(pixelCount);
    errorRate.add(true);
  }

  return success;
}

/**
 * 获取地图瓦片
 */
function getTiles(token, region) {
  const coord = randomCoordinate(region);
  const zoom = randomIntBetween(12, 16);

  const url = `${BASE_URL}/api/tiles/${zoom}/${Math.floor(coord.lat)}/${Math.floor(coord.lng)}.mvt`;

  const params = {
    headers: {
      'Authorization': `Bearer ${token}`
    },
    tags: { name: 'get_tiles' }
  };

  const res = http.get(url, params);
  requestRate.add(1);

  check(res, {
    'tiles status 200': (r) => r.status === 200
  });
}

// ==================== Setup & Teardown ====================

export function setup() {
  console.log('🚀 渐进式压力测试开始');
  console.log(`📊 最大并发用户: ${MAX_VUS}`);
  console.log(`⏱️  增压时长: ${RAMP_DURATION}分钟`);
  console.log(`🎯 目标URL: ${BASE_URL}`);
  console.log(`👥 测试用户数: ${testUsers.length}`);
  console.log('\n测试阶段:');
  console.log('  1. 预热期: 0→100用户 (5分钟)');
  console.log('  2. 平滑增压: 100→500用户 (5分钟)');
  console.log('  3. 继续增压: 500→1000用户 (5分钟)');
  console.log('  4. 高压测试: 1000→2000用户 (5分钟)');
  console.log(`  5. 极限测试: 2000→${MAX_VUS}用户 (5分钟)`);
  console.log(`  6. 极限稳定: ${MAX_VUS}用户 (10分钟)`);
  console.log('  7. 平滑降压: →0用户 (5分钟)\n');

  return {
    startTime: Date.now(),
    testConfig: {
      maxVus: MAX_VUS,
      rampDuration: RAMP_DURATION
    }
  };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`\n✅ 渐进式压力测试完成`);
  console.log(`⏱️  总耗时: ${(duration / 60).toFixed(2)}分钟`);
}

// ==================== 主测试函数 ====================

export default function() {
  // 选择随机用户
  const userIndex = randomIntBetween(0, testUsers.length - 1);
  const user = testUsers[userIndex];
  const region = selectRegion();

  // 模拟真实用户会话
  group('User Session', function() {
    // 1. 登录（部分用户需要重新登录）
    let token;
    if (Math.random() < 0.1) { // 10%的请求需要登录
      token = login(user);
      if (!token) {
        return; // 登录失败，结束会话
      }
      sleep(randomIntBetween(1, 2));
    } else {
      // 使用模拟token
      token = `test_token_${user.id}`;
    }

    activeUsers.add(1);

    // 2. 浏览地图
    group('Browse Map', function() {
      getTiles(token, region);
      sleep(randomIntBetween(1, 3));
    });

    // 3. 绘制像素
    group('Draw Pixels', function() {
      const drawCount = randomIntBetween(1, 3);
      for (let i = 0; i < drawCount; i++) {
        drawPixel(user.id, token, region);
        sleep(randomIntBetween(2, 5)); // 思考时间
      }
    });

    // 4. 偶尔批量绘制
    if (Math.random() < 0.15) { // 15%概率批量绘制
      group('Batch Draw', function() {
        batchDraw(user.id, token, randomIntBetween(3, 10), region);
        sleep(randomIntBetween(3, 6));
      });
    }

    // 5. 再次浏览
    if (Math.random() < 0.5) {
      group('Browse Again', function() {
        getTiles(token, region);
      });
    }
  });

  // 会话间隔
  sleep(randomIntBetween(3, 8));
}

// ==================== 自定义报告 ====================

export function handleSummary(data) {
  const summary = {
    testName: 'Gradual Ramp-Up Test',
    timestamp: new Date().toISOString(),
    duration: data.state.testRunDurationMs / 1000,
    maxVUs: MAX_VUS,

    metrics: {
      // 业务指标
      pixel_draw_success: data.metrics.pixel_draw_success?.values?.count || 0,
      pixel_draw_failure: data.metrics.pixel_draw_failure?.values?.count || 0,
      draw_success_rate: (data.metrics.draw_success_rate?.values?.rate || 0) * 100,
      pixel_conflicts: data.metrics.pixel_conflicts?.values?.count || 0,

      // 延迟指标
      pixel_draw_latency_avg: data.metrics.pixel_draw_latency?.values?.avg || 0,
      pixel_draw_latency_p50: data.metrics.pixel_draw_latency?.values?.med || 0,
      pixel_draw_latency_p95: data.metrics.pixel_draw_latency?.values['p(95)'] || 0,
      pixel_draw_latency_p99: data.metrics.pixel_draw_latency?.values['p(99)'] || 0,

      // 认证指标
      auth_success: data.metrics.auth_success?.values?.count || 0,
      auth_failures: data.metrics.auth_failures?.values?.count || 0,
      auth_latency_avg: data.metrics.auth_latency?.values?.avg || 0,

      // HTTP指标
      http_reqs: data.metrics.http_reqs?.values?.count || 0,
      http_req_duration_avg: data.metrics.http_req_duration?.values?.avg || 0,
      http_req_duration_p95: data.metrics.http_req_duration?.values['p(95)'] || 0,
      http_req_failed_rate: (data.metrics.http_req_failed?.values?.rate || 0) * 100,

      // 系统指标
      error_rate: (data.metrics.error_rate?.values?.rate || 0) * 100,
      request_rate: data.metrics.request_rate?.values?.count || 0,
    },

    thresholds: data.metrics,
  };

  console.log('\n' + '='.repeat(80));
  console.log('📊 渐进式压力测试报告');
  console.log('='.repeat(80));
  console.log(`\n📅 测试时间: ${new Date(summary.timestamp).toLocaleString('zh-CN')}`);
  console.log(`⏱️  测试时长: ${(summary.duration / 60).toFixed(2)}分钟`);
  console.log(`👥 最大并发: ${summary.maxVUs}用户`);

  console.log('\n📈 业务指标:');
  console.log(`  ✅ 成功绘制: ${summary.metrics.pixel_draw_success}`);
  console.log(`  ❌ 失败绘制: ${summary.metrics.pixel_draw_failure}`);
  console.log(`  📊 成功率: ${summary.metrics.draw_success_rate.toFixed(2)}%`);
  console.log(`  ⚠️  冲突次数: ${summary.metrics.pixel_conflicts}`);

  console.log('\n⏱️  延迟指标:');
  console.log(`  平均延迟: ${summary.metrics.pixel_draw_latency_avg.toFixed(2)}ms`);
  console.log(`  P50延迟: ${summary.metrics.pixel_draw_latency_p50.toFixed(2)}ms`);
  console.log(`  P95延迟: ${summary.metrics.pixel_draw_latency_p95.toFixed(2)}ms`);
  console.log(`  P99延迟: ${summary.metrics.pixel_draw_latency_p99.toFixed(2)}ms`);

  console.log('\n🔐 认证指标:');
  console.log(`  成功认证: ${summary.metrics.auth_success}`);
  console.log(`  失败认证: ${summary.metrics.auth_failures}`);
  console.log(`  平均延迟: ${summary.metrics.auth_latency_avg.toFixed(2)}ms`);

  console.log('\n🌐 HTTP指标:');
  console.log(`  总请求数: ${summary.metrics.http_reqs}`);
  console.log(`  平均响应: ${summary.metrics.http_req_duration_avg.toFixed(2)}ms`);
  console.log(`  P95响应: ${summary.metrics.http_req_duration_p95.toFixed(2)}ms`);
  console.log(`  错误率: ${summary.metrics.http_req_failed_rate.toFixed(2)}%`);

  console.log('\n💡 系统指标:');
  console.log(`  总错误率: ${summary.metrics.error_rate.toFixed(2)}%`);
  console.log(`  总请求数: ${summary.metrics.request_rate}`);

  console.log('\n' + '='.repeat(80));

  // 性能评级
  let rating = 'EXCELLENT';
  if (summary.metrics.draw_success_rate < 95 || summary.metrics.error_rate > 5) {
    rating = 'POOR';
  } else if (summary.metrics.pixel_draw_latency_p95 > 1000 || summary.metrics.error_rate > 2) {
    rating = 'FAIR';
  } else if (summary.metrics.pixel_draw_latency_p95 > 500 || summary.metrics.error_rate > 1) {
    rating = 'GOOD';
  }

  console.log(`\n🏆 性能评级: ${rating}`);
  console.log('='.repeat(80) + '\n');

  return {
    'stdout': '',
    'reports/gradual-ramp-summary.json': JSON.stringify(summary, null, 2),
  };
}
