/**
 * FunnyPixels 耐久性测试 (Soak Test)
 *
 * 测试目标: 长时间运行测试，检测内存泄漏、资源耗尽、性能衰退
 * 测试时长: 4小时（可配置）
 * 典型场景: 验证系统在持续负载下的稳定性
 *
 * 运行示例:
 * k6 run --out json=reports/soak-test-$(date +%Y%m%d-%H%M%S).json k6/advanced/soak-test.js
 *
 * 环境变量:
 * - BASE_URL: API基础URL
 * - TARGET_VUS: 目标用户数 (默认: 1000)
 * - SOAK_DURATION: 持续时间(小时) (默认: 4)
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// ==================== 配置 ====================

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const TARGET_VUS = parseInt(__ENV.TARGET_VUS || '1000');
const SOAK_DURATION_HOURS = parseInt(__ENV.SOAK_DURATION || '4');
const SOAK_DURATION = `${SOAK_DURATION_HOURS * 60}m`;

// ==================== 自定义指标 ====================

const drawSuccess = new Counter('pixel_draw_success');
const drawFailure = new Counter('pixel_draw_failure');
const drawLatency = new Trend('pixel_draw_latency');
const drawSuccessRate = new Rate('draw_success_rate');

// 耐久性专用指标
const memoryLeakIndicator = new Trend('memory_leak_indicator');
const performanceDegradation = new Trend('performance_degradation');
const hourlySuccessRate = new Trend('hourly_success_rate');
const hourlyLatency = new Trend('hourly_latency');

// 资源指标
const connectionErrors = new Counter('connection_errors');
const timeoutErrors = new Counter('timeout_errors');
const serverErrors = new Counter('server_errors');

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
    soak_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        // 阶段1: 缓慢预热 (0 → TARGET_VUS, 10分钟)
        { duration: '10m', target: TARGET_VUS },

        // 阶段2: 长时间稳定运行 (TARGET_VUS, SOAK_DURATION)
        { duration: SOAK_DURATION, target: TARGET_VUS },

        // 阶段3: 缓慢降压 (TARGET_VUS → 0, 10分钟)
        { duration: '10m', target: 0 },
      ],
      gracefulRampDown: '5m',
      gracefulStop: '2m',
    },
  },

  thresholds: {
    // 耐久性测试要求更严格的稳定性
    'draw_success_rate': [
      'rate>0.98',           // 98%成功率
    ],

    // 延迟不应随时间显著增加
    'pixel_draw_latency': [
      'p(50)<250',           // P50 < 250ms
      'p(95)<600',           // P95 < 600ms
      'p(99)<1200',          // P99 < 1200ms
      'avg<350',             // 平均 < 350ms
    ],

    // HTTP错误率应保持低水平
    'http_req_failed': ['rate<0.02'], // 2%错误率

    // 性能不应显著衰退
    'performance_degradation': [
      { threshold: 'p(95)<1.5', abortOnFail: false }, // 性能衰退 < 150%
    ],
  },

  // 超时设置
  maxRedirects: 4,
  batch: 10,
  batchPerHost: 6,
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

// 基线延迟（第一个小时的平均延迟）
let baselineLatency = 0;
let baselineSet = false;

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
    timeout: '20s'
  };

  const startTime = Date.now();
  const res = http.post(url, payload, params);
  const duration = Date.now() - startTime;

  drawLatency.add(duration);

  // 设置基线延迟（第一个小时）
  if (!baselineSet && __ITER > 100) {
    baselineLatency = duration;
    baselineSet = true;
  }

  // 计算性能衰退
  if (baselineSet && baselineLatency > 0) {
    const degradation = duration / baselineLatency;
    performanceDegradation.add(degradation);

    // 检测可能的内存泄漏（延迟持续增加）
    if (degradation > 2.0) {
      memoryLeakIndicator.add(1);
    }
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

    // 分类错误
    if (res.status === 0 || res.error_code === 1050) {
      connectionErrors.add(1);
    } else if (res.status === 504 || res.error.includes('timeout')) {
      timeoutErrors.add(1);
    } else if (res.status >= 500) {
      serverErrors.add(1);
    }
  }

  return success;
}

function getPixels(token) {
  const coord = randomCoordinate();
  const url = `${BASE_URL}/api/pixels?lat=${coord.lat}&lng=${coord.lng}&radius=100`;

  const params = {
    headers: {
      'Authorization': `Bearer ${token}`
    },
    tags: { name: 'get_pixels' }
  };

  const res = http.get(url, params);

  check(res, {
    'get pixels status 200': (r) => r.status === 200,
  });
}

// ==================== Setup & Teardown ====================

export function setup() {
  console.log('🚀 耐久性测试开始');
  console.log(`📊 目标用户数: ${TARGET_VUS}`);
  console.log(`⏱️  持续时间: ${SOAK_DURATION_HOURS}小时`);
  console.log(`🎯 目标URL: ${BASE_URL}`);
  console.log('\n测试目标:');
  console.log('  ✓ 检测内存泄漏');
  console.log('  ✓ 检测性能衰退');
  console.log('  ✓ 验证长期稳定性');
  console.log('  ✓ 监控资源消耗\n');

  console.log('⚠️  注意: 此测试将运行较长时间，请确保:');
  console.log('  • 系统监控已启用');
  console.log('  • 日志收集已配置');
  console.log('  • 磁盘空间充足');
  console.log('  • 网络连接稳定\n');

  return {
    startTime: Date.now(),
    config: {
      targetVUs: TARGET_VUS,
      duration: SOAK_DURATION_HOURS
    }
  };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  const hours = (duration / 3600).toFixed(2);
  console.log(`\n✅ 耐久性测试完成`);
  console.log(`⏱️  总耗时: ${hours}小时`);
}

// ==================== 主测试函数 ====================

export default function() {
  const userIndex = randomIntBetween(0, testUsers.length - 1);
  const user = testUsers[userIndex];
  const token = `test_token_${user.id}`;

  group('Soak Test Session', function() {
    // 模拟真实用户行为
    const actionType = Math.random();

    if (actionType < 0.7) {
      // 70% 绘制像素
      drawPixel(user.id, token);
      sleep(randomIntBetween(2, 5));
    } else if (actionType < 0.9) {
      // 20% 查看像素
      getPixels(token);
      sleep(randomIntBetween(1, 3));
    } else {
      // 10% 批量操作
      for (let i = 0; i < randomIntBetween(2, 4); i++) {
        drawPixel(user.id, token);
        sleep(randomIntBetween(1, 2));
      }
    }
  });

  // 会话间隔
  sleep(randomIntBetween(3, 8));
}

// ==================== 自定义报告 ====================

export function handleSummary(data) {
  const summary = {
    testName: 'Soak Test (Endurance)',
    timestamp: new Date().toISOString(),
    duration: data.state.testRunDurationMs / 1000,
    duration_hours: (data.state.testRunDurationMs / 1000 / 3600).toFixed(2),
    config: {
      target_vus: TARGET_VUS,
      planned_duration: SOAK_DURATION_HOURS
    },

    metrics: {
      draw_success: data.metrics.pixel_draw_success?.values?.count || 0,
      draw_failure: data.metrics.pixel_draw_failure?.values?.count || 0,
      draw_success_rate: (data.metrics.draw_success_rate?.values?.rate || 0) * 100,

      draw_latency_avg: data.metrics.pixel_draw_latency?.values?.avg || 0,
      draw_latency_p50: data.metrics.pixel_draw_latency?.values?.med || 0,
      draw_latency_p95: data.metrics.pixel_draw_latency?.values['p(95)'] || 0,
      draw_latency_p99: data.metrics.pixel_draw_latency?.values['p(99)'] || 0,
      draw_latency_min: data.metrics.pixel_draw_latency?.values?.min || 0,
      draw_latency_max: data.metrics.pixel_draw_latency?.values?.max || 0,

      performance_degradation_avg: data.metrics.performance_degradation?.values?.avg || 0,
      performance_degradation_p95: data.metrics.performance_degradation?.values['p(95)'] || 0,
      memory_leak_indicators: data.metrics.memory_leak_indicator?.values?.count || 0,

      connection_errors: data.metrics.connection_errors?.values?.count || 0,
      timeout_errors: data.metrics.timeout_errors?.values?.count || 0,
      server_errors: data.metrics.server_errors?.values?.count || 0,

      http_reqs: data.metrics.http_reqs?.values?.count || 0,
      http_req_failed_rate: (data.metrics.http_req_failed?.values?.rate || 0) * 100,
    },
  };

  console.log('\n' + '='.repeat(80));
  console.log('🔬 耐久性测试报告');
  console.log('='.repeat(80));
  console.log(`\n📅 测试时间: ${new Date(summary.timestamp).toLocaleString('zh-CN')}`);
  console.log(`⏱️  实际运行: ${summary.duration_hours}小时`);
  console.log(`📊 用户数: ${summary.config.target_vus}`);

  console.log('\n📈 业务指标:');
  console.log(`  ✅ 成功绘制: ${summary.metrics.draw_success}`);
  console.log(`  ❌ 失败绘制: ${summary.metrics.draw_failure}`);
  console.log(`  📊 成功率: ${summary.metrics.draw_success_rate.toFixed(2)}%`);
  console.log(`  📊 总请求数: ${summary.metrics.http_reqs}`);

  console.log('\n⏱️  延迟指标:');
  console.log(`  最小延迟: ${summary.metrics.draw_latency_min.toFixed(2)}ms`);
  console.log(`  平均延迟: ${summary.metrics.draw_latency_avg.toFixed(2)}ms`);
  console.log(`  P50延迟: ${summary.metrics.draw_latency_p50.toFixed(2)}ms`);
  console.log(`  P95延迟: ${summary.metrics.draw_latency_p95.toFixed(2)}ms`);
  console.log(`  P99延迟: ${summary.metrics.draw_latency_p99.toFixed(2)}ms`);
  console.log(`  最大延迟: ${summary.metrics.draw_latency_max.toFixed(2)}ms`);

  console.log('\n🔍 稳定性指标:');
  console.log(`  性能衰退(平均): ${(summary.metrics.performance_degradation_avg * 100 - 100).toFixed(2)}%`);
  console.log(`  性能衰退(P95): ${(summary.metrics.performance_degradation_p95 * 100 - 100).toFixed(2)}%`);
  console.log(`  内存泄漏指标: ${summary.metrics.memory_leak_indicators}`);

  console.log('\n❌ 错误统计:');
  console.log(`  连接错误: ${summary.metrics.connection_errors}`);
  console.log(`  超时错误: ${summary.metrics.timeout_errors}`);
  console.log(`  服务器错误: ${summary.metrics.server_errors}`);
  console.log(`  HTTP错误率: ${summary.metrics.http_req_failed_rate.toFixed(2)}%`);

  console.log('\n' + '='.repeat(80));

  // 稳定性评级
  let rating = 'EXCELLENT';
  let issues = [];

  if (summary.metrics.draw_success_rate < 98) {
    rating = 'POOR';
    issues.push('成功率低于98%');
  }

  if (summary.metrics.performance_degradation_avg > 1.3) {
    rating = rating === 'EXCELLENT' ? 'FAIR' : rating;
    issues.push('性能显著衰退（>30%）');
  }

  if (summary.metrics.memory_leak_indicators > 100) {
    rating = 'POOR';
    issues.push('检测到可能的内存泄漏');
  }

  if (summary.metrics.server_errors > summary.metrics.http_reqs * 0.01) {
    rating = rating === 'EXCELLENT' ? 'GOOD' : rating;
    issues.push('服务器错误率偏高');
  }

  console.log(`\n🏆 稳定性评级: ${rating}`);

  if (issues.length > 0) {
    console.log('\n⚠️  发现的问题:');
    issues.forEach(issue => console.log(`  • ${issue}`));
  } else {
    console.log('\n✅ 系统在长时间运行下表现稳定');
  }

  console.log('\n💡 建议:');
  if (summary.metrics.memory_leak_indicators > 50) {
    console.log('  • 检查应用程序内存使用情况');
    console.log('  • 审查长连接和事件监听器的清理');
  }
  if (summary.metrics.performance_degradation_avg > 1.2) {
    console.log('  • 检查数据库查询性能');
    console.log('  • 审查缓存策略有效性');
  }
  if (summary.metrics.draw_success_rate > 99) {
    console.log('  • 系统稳定性优秀，可考虑增加负载');
  }

  console.log('='.repeat(80) + '\n');

  return {
    'stdout': '',
    'reports/soak-test-summary.json': JSON.stringify(summary, null, 2),
  };
}
