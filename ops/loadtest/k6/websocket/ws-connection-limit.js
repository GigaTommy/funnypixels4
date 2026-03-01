/**
 * FunnyPixels WebSocket 连接数极限测试
 *
 * 测试目标: 测试系统能够支持的最大WebSocket并发连接数
 * 目标: 10000+ 并发WebSocket连接
 *
 * 运行示例:
 * k6 run --vus 10000 --duration 10m k6/websocket/ws-connection-limit.js
 */

import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

const WS_URL = __ENV.WS_URL || 'ws://localhost:3001/ws/tile-updates';
const MAX_CONNECTIONS = parseInt(__ENV.MAX_CONNECTIONS || '10000');

// 自定义指标
const wsConnections = new Counter('ws_connections');
const wsConnectionFailures = new Counter('ws_connection_failures');
const wsConnectionDuration = new Trend('ws_connection_duration');
const wsMessagesSent = new Counter('ws_messages_sent');
const wsMessagesReceived = new Counter('ws_messages_received');
const wsConnectionSuccessRate = new Rate('ws_connection_success_rate');
const wsPingLatency = new Trend('ws_ping_latency');

export const options = {
  scenarios: {
    ws_connection_limit: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 1000 },
        { duration: '3m', target: 1000 },
        { duration: '2m', target: 5000 },
        { duration: '5m', target: 5000 },
        { duration: '2m', target: MAX_CONNECTIONS },
        { duration: '10m', target: MAX_CONNECTIONS },
        { duration: '2m', target: 0 },
      ],
    },
  },

  thresholds: {
    'ws_connection_success_rate': ['rate>0.95'],
    'ws_connection_duration': ['p(95)<3000'],
    'ws_ping_latency': ['p(95)<100'],
  },
};

export default function() {
  const userId = `ws_test_user_${__VU}`;
  const tileId = `tile_${randomIntBetween(1, 100)}`;

  const startTime = Date.now();

  const res = ws.connect(WS_URL, {
    headers: {
      'User-Agent': 'FunnyPixels-K6-WS-Test/1.0'
    },
    tags: { name: 'ws_connect' },
  }, function(socket) {
    const connectionTime = Date.now() - startTime;
    wsConnectionDuration.add(connectionTime);
    wsConnections.add(1);
    wsConnectionSuccessRate.add(true);

    socket.on('open', () => {
      console.log(`[VU ${__VU}] WebSocket连接已建立`);

      // 订阅瓦片更新
      const subscribeMsg = JSON.stringify({
        type: 'subscribe',
        tileId: tileId,
        userId: userId
      });

      socket.send(subscribeMsg);
      wsMessagesSent.add(1);
    });

    socket.on('message', (data) => {
      wsMessagesReceived.add(1);

      try {
        const msg = JSON.parse(data);

        // 处理ping/pong
        if (msg.type === 'ping') {
          const pongMsg = JSON.stringify({
            type: 'pong',
            timestamp: Date.now()
          });

          const pingStart = Date.now();
          socket.send(pongMsg);
          wsPingLatency.add(Date.now() - pingStart);
          wsMessagesSent.add(1);
        }

        // 处理像素更新
        if (msg.type === 'pixel_update') {
          console.log(`[VU ${__VU}] 收到像素更新: ${msg.pixel?.color}`);
        }
      } catch (e) {
        console.error(`[VU ${__VU}] 解析消息失败: ${e.message}`);
      }
    });

    socket.on('close', () => {
      console.log(`[VU ${__VU}] WebSocket连接已关闭`);
    });

    socket.on('error', (e) => {
      console.error(`[VU ${__VU}] WebSocket错误: ${e.error()}`);
      wsConnectionFailures.add(1);
    });

    // 保持连接活跃
    socket.setTimeout(() => {
      console.log(`[VU ${__VU}] 维持连接...`);
    }, 30000);

    // 模拟真实用户行为：定期发送心跳
    const heartbeatInterval = randomIntBetween(25000, 35000);
    socket.setInterval(() => {
      const heartbeat = JSON.stringify({
        type: 'heartbeat',
        userId: userId,
        timestamp: Date.now()
      });
      socket.send(heartbeat);
      wsMessagesSent.add(1);
    }, heartbeatInterval);
  });

  check(res, {
    'ws connected successfully': (r) => r && r.status === 101,
  });

  if (!res || res.status !== 101) {
    wsConnectionFailures.add(1);
    wsConnectionSuccessRate.add(false);
  }
}

export function handleSummary(data) {
  const summary = {
    testName: 'WebSocket Connection Limit Test',
    timestamp: new Date().toISOString(),
    maxConnections: MAX_CONNECTIONS,
    metrics: {
      total_connections: data.metrics.ws_connections?.values?.count || 0,
      connection_failures: data.metrics.ws_connection_failures?.values?.count || 0,
      connection_success_rate: (data.metrics.ws_connection_success_rate?.values?.rate || 0) * 100,
      connection_duration_avg: data.metrics.ws_connection_duration?.values?.avg || 0,
      connection_duration_p95: data.metrics.ws_connection_duration?.values['p(95)'] || 0,
      messages_sent: data.metrics.ws_messages_sent?.values?.count || 0,
      messages_received: data.metrics.ws_messages_received?.values?.count || 0,
      ping_latency_avg: data.metrics.ws_ping_latency?.values?.avg || 0,
      ping_latency_p95: data.metrics.ws_ping_latency?.values['p(95)'] || 0,
    }
  };

  console.log('\n' + '='.repeat(80));
  console.log('🔌 WebSocket连接极限测试报告');
  console.log('='.repeat(80));
  console.log(`\n📊 目标连接数: ${summary.maxConnections}`);
  console.log(`✅ 成功连接: ${summary.metrics.total_connections}`);
  console.log(`❌ 失败连接: ${summary.metrics.connection_failures}`);
  console.log(`📈 成功率: ${summary.metrics.connection_success_rate.toFixed(2)}%`);
  console.log(`\n⏱️  连接建立时间:`);
  console.log(`  平均: ${summary.metrics.connection_duration_avg.toFixed(2)}ms`);
  console.log(`  P95: ${summary.metrics.connection_duration_p95.toFixed(2)}ms`);
  console.log(`\n💬 消息统计:`);
  console.log(`  发送: ${summary.metrics.messages_sent}`);
  console.log(`  接收: ${summary.metrics.messages_received}`);
  console.log(`\n🏓 Ping延迟:`);
  console.log(`  平均: ${summary.metrics.ping_latency_avg.toFixed(2)}ms`);
  console.log(`  P95: ${summary.metrics.ping_latency_p95.toFixed(2)}ms`);
  console.log('='.repeat(80) + '\n');

  let rating = 'EXCELLENT';
  if (summary.metrics.connection_success_rate < 95) {
    rating = 'POOR';
  } else if (summary.metrics.connection_success_rate < 98) {
    rating = 'FAIR';
  } else if (summary.metrics.connection_duration_p95 > 3000) {
    rating = 'GOOD';
  }

  console.log(`🏆 WebSocket承载能力评级: ${rating}\n`);

  return {
    'reports/ws-connection-limit-summary.json': JSON.stringify(summary, null, 2),
  };
}
