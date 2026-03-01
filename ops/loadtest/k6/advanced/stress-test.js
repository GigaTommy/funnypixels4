/**
 * FunnyPixels 压力极限测试 (Stress Test)
 *
 * 测试目标: 找到系统的崩溃点，确定最大承载能力
 * 方法: 持续增加负载直到系统开始出现显著错误
 *
 * 运行示例:
 * k6 run --out json=reports/stress-test-$(date +%Y%m%d-%H%M%S).json k6/advanced/stress-test.js
 *
 * 环境变量:
 * - BASE_URL: API基础URL
 * - START_VUS: 起始用户数 (默认: 100)
 * - MAX_VUS: 最大用户数 (默认: 10000)
 * - STEP_DURATION: 每阶段持续时间(分钟) (默认: 3)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// ==================== 配置 ====================

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const START_VUS = parseInt(__ENV.START_VUS || '100');
const MAX_VUS = parseInt(__ENV.MAX_VUS || '10000');
const STEP_DURATION = `${parseInt(__ENV.STEP_DURATION || '3')}m`;

// ==================== 自定义指标 ====================

const drawSuccess = new Counter('pixel_draw_success');
const drawFailure = new Counter('pixel_draw_failure');
const drawLatency = new Trend('pixel_draw_latency');
const drawSuccessRate = new Rate('draw_success_rate');
const systemCrashIndicator = new Rate('system_crash_indicator');

// ==================== 测试配置 ====================

export const options = {
  scenarios: {
    stress_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: STEP_DURATION, target: START_VUS },
        { duration: STEP_DURATION, target: START_VUS * 2 },
        { duration: STEP_DURATION, target: START_VUS * 4 },
        { duration: STEP_DURATION, target: START_VUS * 8 },
        { duration: STEP_DURATION, target: START_VUS * 16 },
        { duration: STEP_DURATION, target: MAX_VUS },
        { duration: '2m', target: 0 },
      ],
      gracefulRampDown: '1m',
    },
  },

  thresholds: {
    'draw_success_rate': [
      { threshold: 'rate>0.70', abortOnFail: false }, // 压力测试允许30%失败
    ],
    'pixel_draw_latency': [
      { threshold: 'p(95)<10000', abortOnFail: false }, // P95 < 10秒
    ],
  },
};

// ==================== 测试数据 ====================

const testUsers = new SharedArray('users', function() {
  const users = [];
  for (let i = 0; i < 10000; i++) {
    users.push({
      id: `stress_test_${i}`,
      email: `stress${i}@example.com`,
      password: 'TestPassword123!'
    });
  }
  return users;
});

const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1'];

// ==================== 工具函数 ====================

function randomCoordinate() {
  const lat = 39.9 + Math.random() * 0.02;
  const lng = 116.39 + Math.random() * 0.02;
  return {
    lat: Math.round(lat * 100000) / 100000,
    lng: Math.round(lng * 100000) / 100000
  };
}

function drawPixel(userId, token) {
  const coord = randomCoordinate();
  const color = colors[randomIntBetween(0, colors.length - 1)];

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
    timeout: '30s'
  };

  const startTime = Date.now();
  const res = http.post(url, payload, params);
  const duration = Date.now() - startTime;

  drawLatency.add(duration);

  const success = check(res, {
    'draw status 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  if (success) {
    drawSuccess.add(1);
    drawSuccessRate.add(true);
    systemCrashIndicator.add(false);
  } else {
    drawFailure.add(1);
    drawSuccessRate.add(false);

    // 检测系统崩溃迹象
    if (res.status === 0 || res.status >= 500 || duration > 10000) {
      systemCrashIndicator.add(true);
    } else {
      systemCrashIndicator.add(false);
    }
  }

  return success;
}

// ==================== Setup ====================

export function setup() {
  console.log('🚀 压力极限测试开始');
  console.log(`📊 起始/最大用户: ${START_VUS} / ${MAX_VUS}`);
  console.log(`⏱️  每阶段时长: ${STEP_DURATION}`);
  console.log(`🎯 目标: 找到系统崩溃点\n`);
  return { startTime: Date.now() };
}

export function teardown(data) {
  console.log(`\n✅ 压力测试完成，耗时: ${((Date.now() - data.startTime) / 60000).toFixed(2)}分钟`);
}

// ==================== 主测试 ====================

export default function() {
  const userIndex = randomIntBetween(0, testUsers.length - 1);
  const user = testUsers[userIndex];
  const token = `stress_token_${user.id}`;

  drawPixel(user.id, token);
  sleep(randomIntBetween(1, 3));
}

// ==================== 报告 ====================

export function handleSummary(data) {
  const summary = {
    testName: 'Stress Test',
    timestamp: new Date().toISOString(),
    metrics: {
      draw_success: data.metrics.pixel_draw_success?.values?.count || 0,
      draw_failure: data.metrics.pixel_draw_failure?.values?.count || 0,
      success_rate: (data.metrics.draw_success_rate?.values?.rate || 0) * 100,
      crash_rate: (data.metrics.system_crash_indicator?.values?.rate || 0) * 100,
      latency_p95: data.metrics.pixel_draw_latency?.values['p(95)'] || 0,
      latency_max: data.metrics.pixel_draw_latency?.values?.max || 0,
    }
  };

  console.log('\n' + '='.repeat(80));
  console.log('💥 压力极限测试报告');
  console.log('='.repeat(80));
  console.log(`\n成功率: ${summary.metrics.success_rate.toFixed(2)}%`);
  console.log(`崩溃率: ${summary.metrics.crash_rate.toFixed(2)}%`);
  console.log(`P95延迟: ${summary.metrics.latency_p95.toFixed(2)}ms`);
  console.log(`最大延迟: ${summary.metrics.latency_max.toFixed(2)}ms`);
  console.log('='.repeat(80) + '\n');

  return {
    'reports/stress-test-summary.json': JSON.stringify(summary, null, 2),
  };
}
