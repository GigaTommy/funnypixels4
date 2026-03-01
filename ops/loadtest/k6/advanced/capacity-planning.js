/**
 * FunnyPixels 容量规划测试
 *
 * 测试目标: 确定不同用户规模下的资源需求，为容量规划提供数据
 * 方法: 阶梯式增压，每个阶段收集详细的性能和资源数据
 *
 * 运行示例:
 * k6 run --out json=reports/capacity-planning-$(date +%Y%m%d-%H%M%S).json k6/advanced/capacity-planning.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend, Rate, Gauge } from 'k6/metrics';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

// 自定义指标
const drawSuccess = new Counter('pixel_draw_success');
const drawLatency = new Trend('pixel_draw_latency');
const drawSuccessRate = new Rate('draw_success_rate');
const activeVUs = new Gauge('active_vus');
const throughput = new Counter('throughput');

export const options = {
  scenarios: {
    capacity_planning: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        // 容量测试阶梯: 100, 250, 500, 1000, 2000, 5000
        { duration: '3m', target: 100 },
        { duration: '5m', target: 100 },   // 稳定期收集数据

        { duration: '2m', target: 250 },
        { duration: '5m', target: 250 },

        { duration: '2m', target: 500 },
        { duration: '5m', target: 500 },

        { duration: '2m', target: 1000 },
        { duration: '5m', target: 1000 },

        { duration: '2m', target: 2000 },
        { duration: '5m', target: 2000 },

        { duration: '2m', target: 5000 },
        { duration: '5m', target: 5000 },

        { duration: '2m', target: 0 },
      ],
    },
  },

  thresholds: {
    'draw_success_rate': ['rate>0.95'],
    'pixel_draw_latency': ['p(95)<800', 'p(99)<1500'],
  },
};

function drawPixel(userId) {
  const url = `${BASE_URL}/api/pixel`;
  const payload = JSON.stringify({
    latitude: 39.9 + Math.random() * 0.01,
    longitude: 116.39 + Math.random() * 0.01,
    userId: userId,
    color: '#FF6B6B',
    drawType: 'manual'
  });

  const res = http.post(url, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  const success = check(res, { 'status 2xx': (r) => r.status >= 200 && r.status < 300 });

  if (success) {
    drawSuccess.add(1);
    throughput.add(1);
  }

  drawSuccessRate.add(success);
  drawLatency.add(res.timings.duration);
  activeVUs.add(__VU);

  return success;
}

export default function() {
  const userId = `capacity_test_${__VU}`;
  drawPixel(userId);
  sleep(randomIntBetween(2, 5));
}

export function handleSummary(data) {
  const summary = {
    testName: 'Capacity Planning',
    timestamp: new Date().toISOString(),
    capacityData: {
      total_requests: data.metrics.throughput?.values?.count || 0,
      success_rate: (data.metrics.draw_success_rate?.values?.rate || 0) * 100,
      avg_latency: data.metrics.pixel_draw_latency?.values?.avg || 0,
      p95_latency: data.metrics.pixel_draw_latency?.values['p(95)'] || 0,
      p99_latency: data.metrics.pixel_draw_latency?.values['p(99)'] || 0,
    },
    recommendations: {
      optimal_capacity: 'Based on test results, analyze metrics to determine',
      scaling_threshold: 'Set alerts when approaching capacity limits',
      resource_requirements: 'Document CPU, memory, DB connections needed per load level'
    }
  };

  console.log('\n📊 容量规划报告');
  console.log('='.repeat(60));
  console.log(`总请求数: ${summary.capacityData.total_requests}`);
  console.log(`成功率: ${summary.capacityData.success_rate.toFixed(2)}%`);
  console.log(`P95延迟: ${summary.capacityData.p95_latency.toFixed(2)}ms`);
  console.log('='.repeat(60) + '\n');

  return {
    'reports/capacity-planning-summary.json': JSON.stringify(summary, null, 2),
  };
}
