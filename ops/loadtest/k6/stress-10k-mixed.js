/**
 * FunnyPixels 混合压力测试（读写并发）
 *
 * 场景 A: Writers (默认 300 VU) - 认证用户绘制像素
 * 场景 B: Readers (默认 600 VU) - 模拟地图浏览的读取负载
 *
 * 默认 VU 数基于本地 Mac 单机压测经验（4-5轮迭代调优）：
 *   300 Writers + 600 Readers 可稳定运行，成功率 > 95%
 *   更高 VU 数需要 cluster 模式 + 更大连接池
 *
 * 运行示例:
 *   烟测: k6 run --env SMOKE=true k6/stress-10k-mixed.js
 *   正式: k6 run --out json=reports/stress-10k-$(date +%Y%m%d-%H%M%S).json k6/stress-10k-mixed.js
 *   自定义: k6 run --env WRITER_VUS=500 --env READER_VUS=1000 k6/stress-10k-mixed.js
 *
 * 环境变量:
 *   - BASE_URL: API 基础 URL (默认: http://localhost:3001)
 *   - WRITER_VUS: 写入场景最大 VU 数 (默认: 300)
 *   - READER_VUS: 读取场景最大 VU 数 (默认: 600)
 *   - TEST_USERS_FILE: 测试用户 JSON 文件路径 (默认: ../data/test-users.json)
 *   - SMOKE: 设为 "true" 启用烟测模式 (5 writers + 10 readers, 30s)
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';
import { SharedArray } from 'k6/data';

// ==================== 配置 ====================

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const IS_SMOKE = __ENV.SMOKE === 'true';
const WRITER_MAX_VUS = IS_SMOKE ? 5 : parseInt(__ENV.WRITER_VUS || '300');
const READER_MAX_VUS = IS_SMOKE ? 10 : parseInt(__ENV.READER_VUS || '600');

// 绘制区域 (北京市中心附近)
const REGION = {
  latMin: 39.90, latMax: 39.95,
  lngMin: 116.35, lngMax: 116.42,
};

// MVT 瓦片参数 (zoom 16, 北京附近的瓦片坐标范围)
const TILES = {
  zoom: 16,
  xMin: 54764, xMax: 54770,
  yMin: 26850, yMax: 26856,
};

// ==================== 自定义指标 ====================

// 写入指标
const writeLatency = new Trend('write_latency', true);
const writeSuccess = new Counter('write_success');
const writeFailure = new Counter('write_failure');
const writeSuccessRate = new Rate('write_success_rate');
const writeConflicts = new Counter('write_conflicts_409');
const writeRateLimited = new Counter('write_rate_limited_429');
const writeServerErrors = new Counter('write_server_errors_5xx');
const writeAuthErrors = new Counter('write_auth_errors');

// 读取指标
const readLatency = new Trend('read_latency', true);
const readSuccess = new Counter('read_success');
const readFailure = new Counter('read_failure');
const readSuccessRate = new Rate('read_success_rate');

// 按端点的读取延迟
const bboxLatency = new Trend('bbox_latency', true);
const tileLatency = new Trend('tile_latency', true);
const statsLatency = new Trend('stats_latency', true);
const hotZonesLatency = new Trend('hot_zones_latency', true);
const leaderboardLatency = new Trend('leaderboard_latency', true);
const authMeLatency = new Trend('auth_me_latency', true);

// ==================== 测试用户数据 ====================

const testUsers = new SharedArray('users', function () {
  const usersFile = __ENV.TEST_USERS_FILE || '../data/test-users.json';
  try {
    return JSON.parse(open(usersFile));
  } catch (e) {
    console.error(`Cannot load test users from ${usersFile}: ${e.message}`);
    // 回退: 生成默认用户列表
    const users = [];
    for (let i = 0; i < 1100; i++) {
      users.push({
        id: `load_test_${i}`,
        email: `load_test_${i}@loadtest.example.com`,
        password: 'TestPassword123!',
      });
    }
    return users;
  }
});

const colors = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
  '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788',
];

// ==================== 场景配置 ====================

function buildWriterStages(maxVUs) {
  if (IS_SMOKE) {
    return [
      { duration: '10s', target: maxVUs },
      { duration: '20s', target: maxVUs },
    ];
  }
  return [
    { duration: '2m', target: Math.ceil(maxVUs * 0.2) },   // 0 → 200
    { duration: '2m', target: Math.ceil(maxVUs * 0.2) },   // hold 200
    { duration: '2m', target: Math.ceil(maxVUs * 0.5) },   // 200 → 500
    { duration: '2m', target: Math.ceil(maxVUs * 0.5) },   // hold 500
    { duration: '2m', target: maxVUs },                     // 500 → 1000
    { duration: '10m', target: maxVUs },                    // hold 1000 (peak)
    { duration: '2m', target: Math.ceil(maxVUs * 0.5) },   // 1000 → 500
    { duration: '2m', target: 0 },                          // 500 → 0
  ];
}

function buildReaderStages(maxVUs) {
  if (IS_SMOKE) {
    return [
      { duration: '10s', target: maxVUs },
      { duration: '20s', target: maxVUs },
    ];
  }
  return [
    { duration: '2m', target: Math.ceil(maxVUs * 0.25) },  // 0 → 500
    { duration: '2m', target: Math.ceil(maxVUs * 0.25) },  // hold 500
    { duration: '2m', target: Math.ceil(maxVUs * 0.5) },   // 500 → 1000
    { duration: '2m', target: Math.ceil(maxVUs * 0.5) },   // hold 1000
    { duration: '2m', target: maxVUs },                     // 1000 → 2000
    { duration: '10m', target: maxVUs },                    // hold 2000 (peak)
    { duration: '2m', target: Math.ceil(maxVUs * 0.5) },   // 2000 → 1000
    { duration: '2m', target: 0 },                          // 1000 → 0
  ];
}

export const options = {
  // setup 阶段需要登录大量用户，给足时间
  setupTimeout: IS_SMOKE ? '120s' : '600s',

  // 🔧 确保 handleSummary 能获取 p(50) 和 p(99) 的值
  // k6 默认只提供 avg/min/med/max/p(90)/p(95)
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(50)', 'p(90)', 'p(95)', 'p(99)', 'count'],

  scenarios: {
    writers: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: buildWriterStages(WRITER_MAX_VUS),
      gracefulRampDown: '30s',
      exec: 'writerScenario',
    },
    readers: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: buildReaderStages(READER_MAX_VUS),
      gracefulRampDown: '30s',
      exec: 'readerScenario',
    },
  },

  thresholds: {
    // 写入 SLO
    'write_latency': [
      'p(95)<2000',  // P95 < 2000ms
      'p(99)<5000',  // P99 < 5000ms
    ],
    'write_success_rate': ['rate>0.95'],  // > 95% 成功率

    // 读取 SLO（聚合 + 按端点分解）
    'read_latency': [
      'p(95)<500',   // P95 < 500ms (聚合)
    ],
    'read_success_rate': ['rate>0.95'],   // > 95% 成功率

    // 按端点 SLO
    'tile_latency': ['p(95)<300'],         // MVT Tile P95 < 300ms
    'leaderboard_latency': ['p(95)<500'],  // Leaderboard P95 < 500ms
    'auth_me_latency': ['p(95)<200'],      // Auth/me P95 < 200ms
    'stats_latency': ['p(95)<200'],        // Stats P95 < 200ms
    'hot_zones_latency': ['p(95)<200'],    // Hot Zones P95 < 200ms
    'bbox_latency': ['p(95)<2000'],        // BBOX P95 < 2000ms (非核心端点，放宽)

    // 全局 HTTP 错误率
    'http_req_failed': ['rate<0.05'],      // < 5% 错误率
  },

  discardResponseBodies: false,
};

// ==================== 工具函数 ====================

function randomCoordinate() {
  const lat = REGION.latMin + Math.random() * (REGION.latMax - REGION.latMin);
  const lng = REGION.lngMin + Math.random() * (REGION.lngMax - REGION.lngMin);
  return {
    lat: Math.round(lat * 100000) / 100000,
    lng: Math.round(lng * 100000) / 100000,
  };
}

function randomColor() {
  return colors[Math.floor(Math.random() * colors.length)];
}

function generateBbox() {
  // 生成一个随机的小 bbox (约 0.005 度，~500m 范围)
  const centerLat = REGION.latMin + Math.random() * (REGION.latMax - REGION.latMin);
  const centerLng = REGION.lngMin + Math.random() * (REGION.lngMax - REGION.lngMin);
  const halfSize = 0.0025 + Math.random() * 0.005; // 0.0025 ~ 0.0075 度
  return {
    north: centerLat + halfSize,
    south: centerLat - halfSize,
    east: centerLng + halfSize,
    west: centerLng - halfSize,
    zoom: 14 + Math.floor(Math.random() * 4), // zoom 14-17
  };
}

// 🔧 预生成 BBOX 池：模拟真实用户在有限区域内浏览地图
// 完全随机的 bbox 会导致 Redis 缓存命中率极低（每次都是新 key），不符合真实场景
// 真实用户在有限的热门区域内平移地图，所以使用固定池 + 少量随机扰动
const BBOX_POOL_SIZE = 100;
const bboxPool = Array.from({ length: BBOX_POOL_SIZE }, () => generateBbox());

function randomBbox() {
  // 80% 概率从池中选取（模拟热门区域重复访问，利用 Redis 缓存）
  // 20% 概率生成全新 bbox（模拟用户探索新区域）
  if (Math.random() < 0.8) {
    return bboxPool[Math.floor(Math.random() * bboxPool.length)];
  }
  return generateBbox();
}

function randomTile() {
  return {
    z: TILES.zoom,
    x: TILES.xMin + Math.floor(Math.random() * (TILES.xMax - TILES.xMin)),
    y: TILES.yMin + Math.floor(Math.random() * (TILES.yMax - TILES.yMin)),
  };
}

function classifyWriteError(status) {
  if (status === 409) writeConflicts.add(1);
  else if (status === 429) writeRateLimited.add(1);
  else if (status >= 500) writeServerErrors.add(1);
  else if (status === 401 || status === 403) writeAuthErrors.add(1);
}

// ==================== Setup ====================

export function setup() {
  console.log('========================================');
  console.log('  10K Mixed Stress Test - Setup');
  console.log('========================================');
  console.log(`Target URL: ${BASE_URL}`);
  console.log(`Writer VUs: ${WRITER_MAX_VUS}`);
  console.log(`Reader VUs: ${READER_MAX_VUS}`);
  console.log(`Test users: ${testUsers.length}`);
  console.log(`Smoke mode: ${IS_SMOKE}`);
  console.log('');

  // 登录测试用户获取 JWT Token
  // 烟测模式只登录需要的用户数，正式模式登录全部
  const loginCount = IS_SMOKE ? Math.min(WRITER_MAX_VUS + READER_MAX_VUS, testUsers.length) : testUsers.length;
  console.log(`Logging in ${loginCount} test users...`);
  const tokens = {};
  let loginSuccess = 0;
  let loginFailure = 0;
  const batchSize = 50; // 每批登录数量

  for (let i = 0; i < loginCount; i++) {
    const user = testUsers[i];
    const loginRes = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({
        email: user.email,
        password: user.password || 'TestPassword123!',
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'setup_login' },
      }
    );

    if (loginRes.status === 200) {
      try {
        const body = JSON.parse(loginRes.body);
        tokens[user.id] = body.tokens.accessToken;
        loginSuccess++;
      } catch (e) {
        loginFailure++;
        if (loginFailure <= 3) {
          console.log(`  Login parse error: ${user.email}`);
        }
      }
    } else {
      loginFailure++;
      if (loginFailure <= 5) {
        console.log(`  Login failed: ${user.email}, status=${loginRes.status}, body=${loginRes.body ? loginRes.body.substring(0, 200) : 'empty'}`);
      }
    }

    // 每批暂停避免压垮服务器
    if (i > 0 && i % batchSize === 0) {
      sleep(0.3);
      if (i % 200 === 0) {
        console.log(`  Logged in ${i}/${loginCount} (success: ${loginSuccess}, fail: ${loginFailure})`);
      }
    }
  }

  console.log('');
  console.log(`Login complete: ${loginSuccess} success, ${loginFailure} failure`);

  if (loginSuccess === 0) {
    console.log('FATAL: All logins failed! Check:');
    console.log('  1. Test users imported? (psql -f data/test-users.sql)');
    console.log('  2. Backend running? (node src/server.js)');
    console.log('  3. Auth rate limit raised? (rateLimit.js authLimiter)');
    console.log('  4. BASE_URL correct?');
  }

  // 将 token 列表转为数组供 VU 快速索引
  const tokenList = [];
  for (const userId in tokens) {
    tokenList.push({ userId, token: tokens[userId] });
  }

  console.log(`Token list size: ${tokenList.length}`);
  console.log('========================================');
  console.log('');

  return {
    startTime: Date.now(),
    tokenList,
    loginSuccess,
    loginFailure,
  };
}

export function teardown(data) {
  const durationSec = (Date.now() - data.startTime) / 1000;
  console.log('');
  console.log('========================================');
  console.log(`  Test completed in ${durationSec.toFixed(1)}s`);
  console.log(`  Login: ${data.loginSuccess} success, ${data.loginFailure} failure`);
  console.log('========================================');
}

// ==================== 场景 A: Writers ====================

export function writerScenario(data) {
  if (!data.tokenList || data.tokenList.length === 0) {
    sleep(1);
    return;
  }

  // 每个 VU 分配一个固定用户 (通过 VU ID 取模)
  const idx = (__VU - 1) % data.tokenList.length;
  const { userId, token } = data.tokenList[idx];

  group('pixel_write', function () {
    const coord = randomCoordinate();
    const color = randomColor();

    const payload = JSON.stringify({
      latitude: coord.lat,
      longitude: coord.lng,
      color: color,
    });

    const startTime = Date.now();
    const res = http.post(`${BASE_URL}/api/pixel-draw/manual`, payload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      tags: { name: 'pixel_draw' },
      timeout: '30s',
    });
    const duration = Date.now() - startTime;

    writeLatency.add(duration);

    const ok = check(res, {
      'write status 200': (r) => r.status === 200,
      'write body success': (r) => {
        try {
          return JSON.parse(r.body).success === true;
        } catch (e) {
          return false;
        }
      },
    });

    if (ok) {
      writeSuccess.add(1);
      writeSuccessRate.add(true);
    } else {
      writeFailure.add(1);
      writeSuccessRate.add(false);
      classifyWriteError(res.status);
    }
  });

  // Think time: 2-5 秒
  sleep(2 + Math.random() * 3);
}

// ==================== 场景 B: Readers ====================

export function readerScenario(data) {
  // 按权重随机选择读取端点（匹配 iOS 真实流量分布）
  // MVT 40% | Leaderboard 20% | Auth/me 15% | Stats 10% | Hot Zones 10% | BBOX 5%
  const roll = Math.random();

  if (roll < 0.40) {
    // 40% - MVT 瓦片请求 (主要地图渲染)
    queryTile();
  } else if (roll < 0.60) {
    // 20% - 排行榜 (需要认证)
    queryLeaderboard(data);
  } else if (roll < 0.75) {
    // 15% - Auth/me (每次打开App调用)
    queryAuthMe(data);
  } else if (roll < 0.85) {
    // 10% - 像素统计
    queryStats();
  } else if (roll < 0.95) {
    // 10% - 热区查询
    queryHotZones();
  } else {
    // 5% - BBOX 像素查询 (保留少量测试)
    queryBbox();
  }

  // Think time: 1-3 秒
  sleep(1 + Math.random() * 2);
}

function queryBbox() {
  const bbox = randomBbox();
  const payload = JSON.stringify(bbox);

  const startTime = Date.now();
  const res = http.post(`${BASE_URL}/api/pixels/bbox`, payload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'bbox_query' },
    timeout: '15s',
  });
  const duration = Date.now() - startTime;

  readLatency.add(duration);
  bboxLatency.add(duration);

  const ok = check(res, {
    'bbox status 200': (r) => r.status === 200,
  });

  if (ok) {
    readSuccess.add(1);
    readSuccessRate.add(true);
  } else {
    readFailure.add(1);
    readSuccessRate.add(false);
  }
}

function queryTile() {
  const tile = randomTile();
  const url = `${BASE_URL}/api/tiles/pixels/${tile.z}/${tile.x}/${tile.y}.pbf`;

  const startTime = Date.now();
  const res = http.get(url, {
    tags: { name: 'mvt_tile' },
    timeout: '15s',
  });
  const duration = Date.now() - startTime;

  readLatency.add(duration);
  tileLatency.add(duration);

  // MVT 返回 200 (有数据) 或 204 (无数据) 都算成功
  const ok = check(res, {
    'tile status 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  if (ok) {
    readSuccess.add(1);
    readSuccessRate.add(true);
  } else {
    readFailure.add(1);
    readSuccessRate.add(false);
  }
}

function queryStats() {
  const startTime = Date.now();
  const res = http.get(`${BASE_URL}/api/pixels/stats`, {
    tags: { name: 'pixel_stats' },
    timeout: '15s',
  });
  const duration = Date.now() - startTime;

  readLatency.add(duration);
  statsLatency.add(duration);

  const ok = check(res, {
    'stats status 200': (r) => r.status === 200,
  });

  if (ok) {
    readSuccess.add(1);
    readSuccessRate.add(true);
  } else {
    readFailure.add(1);
    readSuccessRate.add(false);
  }
}

function queryHotZones() {
  const startTime = Date.now();
  const res = http.get(`${BASE_URL}/api/pixels/hot-zones`, {
    tags: { name: 'hot_zones' },
    timeout: '15s',
  });
  const duration = Date.now() - startTime;

  readLatency.add(duration);
  hotZonesLatency.add(duration);

  const ok = check(res, {
    'hot-zones status 200': (r) => r.status === 200,
  });

  if (ok) {
    readSuccess.add(1);
    readSuccessRate.add(true);
  } else {
    readFailure.add(1);
    readSuccessRate.add(false);
  }
}

function queryLeaderboard(data) {
  if (!data.tokenList || data.tokenList.length === 0) return;

  const idx = (__VU - 1) % data.tokenList.length;
  const { token } = data.tokenList[idx];

  // 随机选择排行榜类型和周期
  const periods = ['daily', 'weekly', 'monthly'];
  const period = periods[Math.floor(Math.random() * periods.length)];

  const startTime = Date.now();
  const res = http.get(`${BASE_URL}/api/leaderboard/personal?period=${period}&limit=50`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    tags: { name: 'leaderboard' },
    timeout: '15s',
  });
  const duration = Date.now() - startTime;

  readLatency.add(duration);
  leaderboardLatency.add(duration);

  const ok = check(res, {
    'leaderboard status 200': (r) => r.status === 200,
  });

  if (ok) {
    readSuccess.add(1);
    readSuccessRate.add(true);
  } else {
    readFailure.add(1);
    readSuccessRate.add(false);
  }
}

function queryAuthMe(data) {
  if (!data.tokenList || data.tokenList.length === 0) return;

  const idx = (__VU - 1) % data.tokenList.length;
  const { token } = data.tokenList[idx];

  const startTime = Date.now();
  const res = http.get(`${BASE_URL}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    tags: { name: 'auth_me' },
    timeout: '15s',
  });
  const duration = Date.now() - startTime;

  readLatency.add(duration);
  authMeLatency.add(duration);

  const ok = check(res, {
    'auth/me status 200': (r) => r.status === 200,
  });

  if (ok) {
    readSuccess.add(1);
    readSuccessRate.add(true);
  } else {
    readFailure.add(1);
    readSuccessRate.add(false);
  }
}

// ==================== 自定义报告 ====================

export function handleSummary(data) {
  const m = data.metrics;

  const summary = {
    testName: '10K Mixed Stress Test',
    timestamp: new Date().toISOString(),
    duration_seconds: data.state.testRunDurationMs / 1000,
    config: {
      writer_max_vus: WRITER_MAX_VUS,
      reader_max_vus: READER_MAX_VUS,
      base_url: BASE_URL,
      smoke: IS_SMOKE,
    },
    write_metrics: {
      success: m.write_success?.values?.count || 0,
      failure: m.write_failure?.values?.count || 0,
      success_rate: ((m.write_success_rate?.values?.rate || 0) * 100).toFixed(2) + '%',
      latency_avg: m.write_latency?.values?.avg || 0,
      latency_p50: m.write_latency?.values['p(50)'] || m.write_latency?.values?.med || 0,
      latency_p90: m.write_latency?.values['p(90)'] || 0,
      latency_p95: m.write_latency?.values['p(95)'] || 0,
      latency_p99: m.write_latency?.values['p(99)'] || 0,
      latency_max: m.write_latency?.values?.max || 0,
      conflicts_409: m.write_conflicts_409?.values?.count || 0,
      rate_limited_429: m.write_rate_limited_429?.values?.count || 0,
      server_errors_5xx: m.write_server_errors_5xx?.values?.count || 0,
      auth_errors: m.write_auth_errors?.values?.count || 0,
    },
    read_metrics: {
      success: m.read_success?.values?.count || 0,
      failure: m.read_failure?.values?.count || 0,
      success_rate: ((m.read_success_rate?.values?.rate || 0) * 100).toFixed(2) + '%',
      latency_avg: m.read_latency?.values?.avg || 0,
      latency_p50: m.read_latency?.values['p(50)'] || m.read_latency?.values?.med || 0,
      latency_p90: m.read_latency?.values['p(90)'] || 0,
      latency_p95: m.read_latency?.values['p(95)'] || 0,
      latency_p99: m.read_latency?.values['p(99)'] || 0,
      latency_max: m.read_latency?.values?.max || 0,
      by_endpoint: {
        tile_p95: m.tile_latency?.values['p(95)'] || 0,
        leaderboard_p95: m.leaderboard_latency?.values['p(95)'] || 0,
        auth_me_p95: m.auth_me_latency?.values['p(95)'] || 0,
        stats_p95: m.stats_latency?.values['p(95)'] || 0,
        hot_zones_p95: m.hot_zones_latency?.values['p(95)'] || 0,
        bbox_p95: m.bbox_latency?.values['p(95)'] || 0,
      },
    },
    http_global: {
      total_requests: m.http_reqs?.values?.count || 0,
      rps: m.http_reqs?.values?.rate || 0,
      failed_rate: ((m.http_req_failed?.values?.rate || 0) * 100).toFixed(2) + '%',
      duration_avg: m.http_req_duration?.values?.avg || 0,
      duration_p95: m.http_req_duration?.values['p(95)'] || 0,
      duration_p99: m.http_req_duration?.values['p(99)'] || 0,
    },
    thresholds: {},
  };

  // 提取阈值结果
  if (data.thresholds) {
    for (const [key, val] of Object.entries(data.thresholds)) {
      summary.thresholds[key] = val;
    }
  }

  // SLO 检查
  const writeP95 = m.write_latency?.values['p(95)'] || 0;
  const writeP99 = m.write_latency?.values['p(99)'] || 0;
  const readP95 = m.read_latency?.values['p(95)'] || 0;
  const writeRate = (m.write_success_rate?.values?.rate || 0) * 100;
  const readRate = (m.read_success_rate?.values?.rate || 0) * 100;
  const httpFailRate = (m.http_req_failed?.values?.rate || 0) * 100;

  console.log('');
  console.log('================================================================');
  console.log('  MIXED STRESS TEST - RESULTS');
  console.log(`  Writers: ${WRITER_MAX_VUS} VU / Readers: ${READER_MAX_VUS} VU`);
  console.log('================================================================');
  console.log('');
  console.log('--- WRITE METRICS ---');
  console.log(`  Total:        ${summary.write_metrics.success} success / ${summary.write_metrics.failure} failure`);
  console.log(`  Success Rate: ${summary.write_metrics.success_rate}`);
  console.log(`  Latency Avg:  ${writeAvg(summary)}ms`);
  console.log(`  Latency P50:  ${summary.write_metrics.latency_p50.toFixed(1)}ms`);
  console.log(`  Latency P95:  ${writeP95.toFixed(1)}ms  ${writeP95 < 2000 ? 'PASS' : 'FAIL'} (SLO: <2000ms)`);
  console.log(`  Latency P99:  ${writeP99.toFixed(1)}ms  ${writeP99 < 5000 ? 'PASS' : 'FAIL'} (SLO: <5000ms)`);
  console.log(`  409 Conflicts: ${summary.write_metrics.conflicts_409}`);
  console.log(`  429 Rate-Ltd:  ${summary.write_metrics.rate_limited_429}`);
  console.log(`  5xx Errors:    ${summary.write_metrics.server_errors_5xx}`);
  console.log(`  Auth Errors:   ${summary.write_metrics.auth_errors}`);
  console.log('');
  console.log('--- READ METRICS ---');
  console.log(`  Total:        ${summary.read_metrics.success} success / ${summary.read_metrics.failure} failure`);
  console.log(`  Success Rate: ${summary.read_metrics.success_rate}`);
  console.log(`  Latency P50:  ${summary.read_metrics.latency_p50.toFixed(1)}ms`);
  console.log(`  Latency P95:  ${readP95.toFixed(1)}ms  ${readP95 < 500 ? 'PASS' : 'FAIL'} (SLO: <500ms)`);
  console.log(`  Endpoint P95:`);
  console.log(`    MVT Tile:     ${summary.read_metrics.by_endpoint.tile_p95.toFixed(1)}ms`);
  console.log(`    Leaderboard:  ${summary.read_metrics.by_endpoint.leaderboard_p95.toFixed(1)}ms`);
  console.log(`    Auth/me:      ${summary.read_metrics.by_endpoint.auth_me_p95.toFixed(1)}ms`);
  console.log(`    Stats:        ${summary.read_metrics.by_endpoint.stats_p95.toFixed(1)}ms`);
  console.log(`    Hot Zones:    ${summary.read_metrics.by_endpoint.hot_zones_p95.toFixed(1)}ms`);
  console.log(`    BBOX:         ${summary.read_metrics.by_endpoint.bbox_p95.toFixed(1)}ms`);
  console.log('');
  console.log('--- GLOBAL HTTP ---');
  console.log(`  Total Requests: ${summary.http_global.total_requests}`);
  console.log(`  RPS:            ${summary.http_global.rps.toFixed(1)}`);
  console.log(`  Error Rate:     ${summary.http_global.failed_rate}  ${httpFailRate < 5 ? 'PASS' : 'FAIL'} (SLO: <5%)`);
  console.log('');
  console.log('--- SLO SUMMARY ---');
  const tileP95 = m.tile_latency?.values['p(95)'] || 0;
  const leaderboardP95 = m.leaderboard_latency?.values['p(95)'] || 0;
  const authMeP95 = m.auth_me_latency?.values['p(95)'] || 0;
  const statsP95 = m.stats_latency?.values['p(95)'] || 0;
  const hotZonesP95 = m.hot_zones_latency?.values['p(95)'] || 0;

  const sloResults = [
    { name: 'Write P95 < 2000ms', pass: writeP95 < 2000 },
    { name: 'Write P99 < 5000ms', pass: writeP99 < 5000 },
    { name: 'Read P95 < 500ms', pass: readP95 < 500 },
    { name: 'Tile P95 < 300ms', pass: tileP95 < 300 },
    { name: 'Leaderboard P95 < 500ms', pass: leaderboardP95 < 500 || leaderboardP95 === 0 },
    { name: 'Auth/me P95 < 200ms', pass: authMeP95 < 200 || authMeP95 === 0 },
    { name: 'Stats P95 < 200ms', pass: statsP95 < 200 || statsP95 === 0 },
    { name: 'Hot Zones P95 < 200ms', pass: hotZonesP95 < 200 || hotZonesP95 === 0 },
    { name: 'Write Success > 95%', pass: writeRate > 95 },
    { name: 'Read Success > 95%', pass: readRate > 95 },
    { name: 'HTTP Error < 5%', pass: httpFailRate < 5 },
  ];

  let allPass = true;
  for (const slo of sloResults) {
    const status = slo.pass ? 'PASS' : 'FAIL';
    console.log(`  [${status}] ${slo.name}`);
    if (!slo.pass) allPass = false;
  }

  console.log('');
  console.log(`  Overall: ${allPass ? 'ALL SLOs PASSED' : 'SOME SLOs FAILED'}`);
  console.log('================================================================');
  console.log('');

  // 同时写入 latest 文件（覆盖）和带时间戳的归档文件
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const summaryJson = JSON.stringify(summary, null, 2);
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    'reports/stress-10k-mixed-summary.json': summaryJson,
    [`reports/stress-10k-${ts}-summary.json`]: summaryJson,
  };
}

function writeAvg(summary) {
  return (summary.write_metrics.latency_avg || 0).toFixed(1);
}

// k6 内置的 textSummary
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.3/index.js';
