/**
 * FunnyPixels Canvas 像素绘制压力测试
 * 使用k6进行多用户并发绘制测试
 *
 * 运行示例:
 * k6 run --vus 100 --duration 5m canvas-draw-load.js
 *
 * 环境变量:
 * - BASE_URL: API基础URL (默认: http://localhost:3001)
 * - TEST_USERS_FILE: 测试用户JSON文件路径
 * - REGION_LAT_MIN: 绘制区域纬度最小值 (默认: 39.9)
 * - REGION_LAT_MAX: 绘制区域纬度最大值 (默认: 40.0)
 * - REGION_LNG_MIN: 绘制区域经度最小值 (默认: 116.3)
 * - REGION_LNG_MAX: 绘制区域经度最大值 (默认: 116.4)
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';
import { SharedArray } from 'k6/data';

// ==================== 配置 ====================

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const REGION_LAT_MIN = parseFloat(__ENV.REGION_LAT_MIN || '39.9');
const REGION_LAT_MAX = parseFloat(__ENV.REGION_LAT_MAX || '40.0');
const REGION_LNG_MIN = parseFloat(__ENV.REGION_LNG_MIN || '116.3');
const REGION_LNG_MAX = parseFloat(__ENV.REGION_LNG_MAX || '116.4');

// ==================== 自定义指标 ====================

const pixelDrawSuccess = new Counter('pixel_draw_success');
const pixelDrawFailure = new Counter('pixel_draw_failure');
const pixelDrawLatency = new Trend('pixel_draw_latency', true);
const pixelConflicts = new Counter('pixel_conflicts');
const authFailures = new Counter('auth_failures');
const drawSuccessRate = new Rate('draw_success_rate');

// ==================== 测试数据 ====================

// 测试用户数据（如果提供了文件则从文件加载）
const testUsers = new SharedArray('users', function() {
  const usersFile = __ENV.TEST_USERS_FILE;
  if (usersFile) {
    return JSON.parse(open(usersFile));
  }

  // 默认生成测试用户
  const users = [];
  for (let i = 0; i < 1000; i++) {
    users.push({
      id: `load_test_user_${i}`,
      email: `loadtest${i}@example.com`,
      password: 'TestPassword123!',
      token: null // 将在setup阶段获取
    });
  }
  return users;
});

// 可用颜色
const colors = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
  '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788'
];

// ==================== 测试配置 ====================

export const options = {
  scenarios: {
    // 场景1: 逐步增加负载
    ramping_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },   // 2分钟升到50用户
        { duration: '5m', target: 50 },   // 稳定5分钟
        { duration: '2m', target: 100 },  // 2分钟升到100用户
        { duration: '5m', target: 100 },  // 稳定5分钟
        { duration: '2m', target: 200 },  // 2分钟升到200用户
        { duration: '5m', target: 200 },  // 稳定5分钟
        { duration: '2m', target: 0 },    // 2分钟降到0
      ],
      gracefulRampDown: '30s',
    },

    // 场景2: 恒定负载（可选，通过注释启用）
    // constant_load: {
    //   executor: 'constant-vus',
    //   vus: 100,
    //   duration: '10m',
    // },

    // 场景3: 突发流量（可选，通过注释启用）
    // spike_test: {
    //   executor: 'ramping-vus',
    //   startVUs: 0,
    //   stages: [
    //     { duration: '10s', target: 50 },
    //     { duration: '1m', target: 50 },
    //     { duration: '10s', target: 500 },  // 突发到500
    //     { duration: '3m', target: 500 },
    //     { duration: '10s', target: 50 },
    //     { duration: '3m', target: 50 },
    //     { duration: '10s', target: 0 },
    //   ],
    // },
  },

  thresholds: {
    // 成功率阈值
    'draw_success_rate': ['rate>0.95'],  // 95%成功率

    // 延迟阈值
    'pixel_draw_latency': [
      'p(95)<500',   // 95%的请求在500ms内完成
      'p(99)<1000',  // 99%的请求在1秒内完成
      'avg<300',     // 平均响应时间小于300ms
    ],

    // HTTP错误率
    'http_req_failed': ['rate<0.05'],  // HTTP错误率小于5%

    // HTTP延迟
    'http_req_duration': [
      'p(95)<600',
      'p(99)<1200',
    ],
  },

  // 不丢弃响应体（需要解析错误信息）
  discardResponseBodies: false,
};

// ==================== 工具函数 ====================

/**
 * 生成随机经纬度坐标
 */
function randomCoordinate() {
  const lat = REGION_LAT_MIN + Math.random() * (REGION_LAT_MAX - REGION_LAT_MIN);
  const lng = REGION_LNG_MIN + Math.random() * (REGION_LNG_MAX - REGION_LNG_MIN);

  // 对齐到像素网格 (0.00001度 ≈ 1米)
  const snapLat = Math.round(lat * 100000) / 100000;
  const snapLng = Math.round(lng * 100000) / 100000;

  return { lat: snapLat, lng: snapLng };
}

/**
 * 随机选择颜色
 */
function randomColor() {
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * 从setup数据中获取用户Token
 */
function getUserToken(userId, setupData) {
  if (setupData && setupData.tokens && setupData.tokens[userId]) {
    return setupData.tokens[userId];
  }
  return null;
}

/**
 * 初始化用户状态
 */
function initUserPixelState(userId, token) {
  const url = `${BASE_URL}/api/pixel/init`;
  const payload = JSON.stringify({ userId });
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    tags: { name: 'init_user_state' },
  };

  const res = http.post(url, payload, params);
  return check(res, {
    'init status 200': (r) => r.status === 200,
    'user has pixel points': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.totalPoints > 0;
      } catch (e) {
        return false;
      }
    },
  });
}

/**
 * 绘制单个像素
 * 使用 POST /api/pixel-draw/manual 端点
 * userId由JWT Token自动提供，无需在body中传递
 */
function drawPixel(userId, token, coordinate, color) {
  const url = `${BASE_URL}/api/pixel-draw/manual`;
  const payload = JSON.stringify({
    latitude: coordinate.lat,
    longitude: coordinate.lng,
    color: color,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    tags: { name: 'draw_pixel' },
  };

  const startTime = Date.now();
  const res = http.post(url, payload, params);
  const duration = Date.now() - startTime;

  pixelDrawLatency.add(duration);

  const success = check(res, {
    'draw status 200': (r) => r.status === 200,
    'pixel created': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success === true && body.data && body.data.pixel;
      } catch (e) {
        return false;
      }
    },
  });

  if (success) {
    pixelDrawSuccess.add(1);
    drawSuccessRate.add(true);
  } else {
    pixelDrawFailure.add(1);
    drawSuccessRate.add(false);

    // 分析失败原因
    if (res.status === 409) {
      pixelConflicts.add(1);
    } else if (res.status === 401 || res.status === 403) {
      authFailures.add(1);
    }
  }

  return { success, response: res };
}

/**
 * 批量绘制像素
 * 使用 POST /api/pixel-draw/batch 端点
 * userId由JWT Token自动提供
 */
function batchDrawPixels(userId, token, pixelCount) {
  const pixels = [];
  for (let i = 0; i < pixelCount; i++) {
    const coord = randomCoordinate();
    pixels.push({
      latitude: coord.lat,
      longitude: coord.lng,
      color: randomColor(),
    });
  }

  const url = `${BASE_URL}/api/pixel-draw/batch`;
  const payload = JSON.stringify({
    pixels: pixels,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    tags: { name: 'batch_draw_pixels' },
  };

  const res = http.post(url, payload, params);

  const success = check(res, {
    'batch draw status 200': (r) => r.status === 200,
    'batch success': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success === true;
      } catch (e) {
        return false;
      }
    },
  });

  if (success) {
    pixelDrawSuccess.add(pixelCount);
  } else {
    pixelDrawFailure.add(pixelCount);
  }

  return { success, response: res };
}

// ==================== Setup & Teardown ====================

export function setup() {
  console.log('🚀 开始负载测试准备...');
  console.log(`📍 测试区域: Lat[${REGION_LAT_MIN}, ${REGION_LAT_MAX}], Lng[${REGION_LNG_MIN}, ${REGION_LNG_MAX}]`);
  console.log(`👥 测试用户数: ${testUsers.length}`);
  console.log(`🎯 目标URL: ${BASE_URL}`);

  // 登录所有测试用户获取真实JWT Token
  console.log('🔐 正在为测试用户获取认证Token...');
  const tokens = {};
  let loginSuccess = 0;
  let loginFailure = 0;

  for (let i = 0; i < testUsers.length; i++) {
    const user = testUsers[i];
    const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
      email: user.email,
      password: user.password || 'TestPassword123!',
    }), {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'login' },
    });

    if (loginRes.status === 200) {
      try {
        const body = JSON.parse(loginRes.body);
        tokens[user.id] = body.tokens.accessToken;
        loginSuccess++;
      } catch (e) {
        loginFailure++;
        if (i < 3) {
          console.log(`❌ 解析登录响应失败: ${user.email}`);
        }
      }
    } else {
      loginFailure++;
      if (i < 3) {
        console.log(`❌ 登录失败: ${user.email}, Status: ${loginRes.status}, Body: ${loginRes.body}`);
      }
    }

    // 每10个用户暂停一下，避免setup阶段压垮服务器
    if (i > 0 && i % 10 === 0) {
      sleep(0.5);
    }
  }

  console.log(`🔐 登录完成: 成功 ${loginSuccess}, 失败 ${loginFailure}`);
  if (loginSuccess === 0) {
    console.log('⚠️ 所有用户登录失败！请检查：');
    console.log('  1. 测试用户是否已导入数据库 (npm run generate:users:sql)');
    console.log('  2. 后端服务是否正常运行');
    console.log('  3. BASE_URL 是否正确');
  }

  return {
    startTime: Date.now(),
    testUsers: testUsers.length,
    tokens: tokens,
    loginSuccess: loginSuccess,
    loginFailure: loginFailure,
  };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`✅ 测试完成，总耗时: ${duration.toFixed(2)}秒`);
  console.log(`🔐 登录统计: 成功 ${data.loginSuccess}, 失败 ${data.loginFailure}`);
}

// ==================== 主测试函数 ====================

export default function(data) {
  // 每个VU随机选择一个用户
  const userIndex = Math.floor(Math.random() * testUsers.length);
  const user = testUsers[userIndex];
  const token = getUserToken(user.id, data);

  // 跳过没有获取到Token的用户
  if (!token) {
    authFailures.add(1);
    sleep(1);
    return;
  }

  group('Canvas Drawing Flow', function() {
    // 步骤1: 初始化用户状态（可选，首次使用时需要）
    // initUserPixelState(user.id, token);
    // sleep(0.5);

    // 步骤2: 绘制像素
    group('Draw Single Pixel', function() {
      const coord = randomCoordinate();
      const color = randomColor();
      const result = drawPixel(user.id, token, coord, color);

      if (!result.success) {
        console.log(`❌ 绘制失败: ${user.id}, Status: ${result.response.status}`);
      }
    });

    // 模拟用户思考时间
    sleep(Math.random() * 2 + 1); // 1-3秒

    // 步骤3: 可选 - 批量绘制
    if (Math.random() < 0.2) { // 20%的概率批量绘制
      group('Batch Draw Pixels', function() {
        batchDrawPixels(user.id, token, 5);
      });
      sleep(Math.random() * 3 + 2); // 2-5秒
    }
  });

  // 模拟用户浏览时间
  sleep(Math.random() * 3 + 2); // 2-5秒
}

// ==================== 自定义报告 ====================

export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    duration: data.state.testRunDurationMs / 1000,
    metrics: {
      pixel_draw_success: data.metrics.pixel_draw_success?.values?.count || 0,
      pixel_draw_failure: data.metrics.pixel_draw_failure?.values?.count || 0,
      pixel_conflicts: data.metrics.pixel_conflicts?.values?.count || 0,
      auth_failures: data.metrics.auth_failures?.values?.count || 0,
      draw_success_rate: data.metrics.draw_success_rate?.values?.rate || 0,
      avg_latency: data.metrics.pixel_draw_latency?.values?.avg || 0,
      p95_latency: data.metrics.pixel_draw_latency?.values['p(95)'] || 0,
      p99_latency: data.metrics.pixel_draw_latency?.values['p(99)'] || 0,
      http_req_failed_rate: data.metrics.http_req_failed?.values?.rate || 0,
    },
    thresholds: data.thresholds,
  };

  console.log('\n📊 测试摘要:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 成功绘制: ${summary.metrics.pixel_draw_success}`);
  console.log(`❌ 失败绘制: ${summary.metrics.pixel_draw_failure}`);
  console.log(`⚠️  冲突次数: ${summary.metrics.pixel_conflicts}`);
  console.log(`🔐 认证失败: ${summary.metrics.auth_failures}`);
  console.log(`📈 成功率: ${(summary.metrics.draw_success_rate * 100).toFixed(2)}%`);
  console.log(`⏱️  平均延迟: ${summary.metrics.avg_latency.toFixed(2)}ms`);
  console.log(`⏱️  P95延迟: ${summary.metrics.p95_latency.toFixed(2)}ms`);
  console.log(`⏱️  P99延迟: ${summary.metrics.p99_latency.toFixed(2)}ms`);
  console.log(`🌐 HTTP错误率: ${(summary.metrics.http_req_failed_rate * 100).toFixed(2)}%`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  return {
    'stdout': JSON.stringify(summary, null, 2),
    'summary.json': JSON.stringify(summary, null, 2),
  };
}
