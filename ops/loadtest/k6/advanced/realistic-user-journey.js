/**
 * FunnyPixels 真实用户旅程测试
 *
 * 测试目标: 模拟真实用户的完整行为路径
 * 包含: 登录 → 浏览地图 → 查看他人作品 → 绘制像素 → 社交互动 → 查看统计 → 登出
 *
 * 运行示例:
 * k6 run --vus 100 --duration 10m k6/advanced/realistic-user-journey.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { randomIntBetween, randomItem } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

// 用户类型权重
const USER_PERSONAS = {
  casual: 0.60,      // 60% 休闲用户
  active: 0.30,      // 30% 活跃用户
  artist: 0.10       // 10% 艺术家用户
};

// 自定义指标
const userJourneyComplete = new Counter('user_journey_complete');
const userJourneyFailed = new Counter('user_journey_failed');
const loginDuration = new Trend('login_duration');
const browsingDuration = new Trend('browsing_duration');
const drawingDuration = new Trend('drawing_duration');
const socialDuration = new Trend('social_duration');

const testUsers = new SharedArray('users', function() {
  const users = [];
  for (let i = 0; i < 1000; i++) {
    users.push({
      id: `journey_user_${i}`,
      email: `journey${i}@example.com`,
      password: 'TestPassword123!',
      username: `JourneyUser${i}`
    });
  }
  return users;
});

const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'];

export const options = {
  scenarios: {
    realistic_journey: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },
        { duration: '10m', target: 50 },
        { duration: '2m', target: 100 },
        { duration: '10m', target: 100 },
        { duration: '2m', target: 0 },
      ],
    },
  },

  thresholds: {
    'user_journey_complete': ['count>100'],
    'login_duration': ['p(95)<1000'],
    'drawing_duration': ['p(95)<500'],
  },
};

// 选择用户类型
function selectUserPersona() {
  const rand = Math.random();
  if (rand < USER_PERSONAS.casual) return 'casual';
  if (rand < USER_PERSONAS.casual + USER_PERSONAS.active) return 'active';
  return 'artist';
}

// 登录
function userLogin(user) {
  const startTime = Date.now();

  const res = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: user.email,
    password: user.password
  }), {
    headers: { 'Content-Type': 'application/json' }
  });

  loginDuration.add(Date.now() - startTime);

  if (check(res, { 'login success': (r) => r.status === 200 })) {
    try {
      return JSON.parse(res.body).token;
    } catch (e) {
      return null;
    }
  }
  return null;
}

// 浏览地图
function browseMap(token, persona) {
  const startTime = Date.now();

  group('Browse Map', function() {
    // 获取瓦片数据
    const zoom = randomIntBetween(12, 16);
    const tileX = randomIntBetween(100, 120);
    const tileY = randomIntBetween(80, 100);

    http.get(`${BASE_URL}/api/tiles/${zoom}/${tileX}/${tileY}.mvt`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    sleep(persona === 'casual' ? randomIntBetween(1, 3) : randomIntBetween(3, 6));

    // 获取附近像素
    http.get(`${BASE_URL}/api/pixels?lat=39.9&lng=116.39&radius=100`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
  });

  browsingDuration.add(Date.now() - startTime);
}

// 绘制像素
function drawPixels(userId, token, persona) {
  const startTime = Date.now();

  group('Draw Pixels', function() {
    let pixelCount;
    if (persona === 'casual') {
      pixelCount = randomIntBetween(1, 3);      // 休闲用户: 1-3个像素
    } else if (persona === 'active') {
      pixelCount = randomIntBetween(3, 8);      // 活跃用户: 3-8个像素
    } else {
      pixelCount = randomIntBetween(10, 20);    // 艺术家: 10-20个像素
    }

    for (let i = 0; i < pixelCount; i++) {
      const payload = JSON.stringify({
        latitude: 39.9 + Math.random() * 0.01,
        longitude: 116.39 + Math.random() * 0.01,
        userId: userId,
        color: randomItem(colors),
        drawType: 'manual'
      });

      http.post(`${BASE_URL}/api/pixel`, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      sleep(persona === 'artist' ? randomIntBetween(1, 2) : randomIntBetween(2, 4));
    }
  });

  drawingDuration.add(Date.now() - startTime);
}

// 社交互动
function socialInteraction(userId, token, persona) {
  const startTime = Date.now();

  group('Social Interaction', function() {
    // 查看排行榜
    http.get(`${BASE_URL}/api/leaderboard?type=weekly`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    sleep(randomIntBetween(2, 4));

    // 查看个人统计
    http.get(`${BASE_URL}/api/user/${userId}/stats`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    // 活跃用户和艺术家会查看更多内容
    if (persona !== 'casual') {
      sleep(randomIntBetween(1, 3));

      // 查看成就
      http.get(`${BASE_URL}/api/user/${userId}/achievements`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
    }
  });

  socialDuration.add(Date.now() - startTime);
}

// 主测试函数
export default function() {
  const user = randomItem(testUsers);
  const persona = selectUserPersona();

  group('User Journey', function() {
    // 1. 登录
    const token = userLogin(user);
    if (!token) {
      userJourneyFailed.add(1);
      return;
    }

    sleep(randomIntBetween(1, 2));

    // 2. 浏览地图
    browseMap(token, persona);
    sleep(randomIntBetween(2, 5));

    // 3. 绘制像素
    drawPixels(user.id, token, persona);
    sleep(randomIntBetween(3, 6));

    // 4. 再次浏览（查看自己的作品）
    if (Math.random() < 0.7) {
      browseMap(token, persona);
      sleep(randomIntBetween(2, 4));
    }

    // 5. 社交互动
    if (persona !== 'casual' || Math.random() < 0.3) {
      socialInteraction(user.id, token, persona);
      sleep(randomIntBetween(2, 5));
    }

    // 6. 可能继续绘制
    if (persona === 'artist' || (persona === 'active' && Math.random() < 0.5)) {
      drawPixels(user.id, token, persona);
    }

    userJourneyComplete.add(1);
  });

  // 会话间隔
  sleep(randomIntBetween(5, 15));
}

export function handleSummary(data) {
  const summary = {
    testName: 'Realistic User Journey',
    timestamp: new Date().toISOString(),
    journeys: {
      completed: data.metrics.user_journey_complete?.values?.count || 0,
      failed: data.metrics.user_journey_failed?.values?.count || 0,
    },
    timings: {
      login_p95: data.metrics.login_duration?.values['p(95)'] || 0,
      browsing_p95: data.metrics.browsing_duration?.values['p(95)'] || 0,
      drawing_p95: data.metrics.drawing_duration?.values['p(95)'] || 0,
      social_p95: data.metrics.social_duration?.values['p(95)'] || 0,
    }
  };

  console.log('\n🎭 真实用户旅程测试报告');
  console.log('='.repeat(60));
  console.log(`完成旅程: ${summary.journeys.completed}`);
  console.log(`失败旅程: ${summary.journeys.failed}`);
  console.log(`登录P95: ${summary.timings.login_p95.toFixed(2)}ms`);
  console.log(`浏览P95: ${summary.timings.browsing_p95.toFixed(2)}ms`);
  console.log(`绘制P95: ${summary.timings.drawing_p95.toFixed(2)}ms`);
  console.log('='.repeat(60) + '\n');

  return {
    'reports/realistic-journey-summary.json': JSON.stringify(summary, null, 2),
  };
}
