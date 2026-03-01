/**
 * FunnyPixels WebSocket 广播延迟测试
 *
 * 测试目标: 测试在100个房间、1000个用户场景下的消息广播延迟
 *
 * 运行示例:
 * k6 run --vus 1000 --duration 10m k6/websocket/ws-broadcast-latency.js
 */

import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

const WS_URL = __ENV.WS_URL || 'ws://localhost:3001/ws/tile-updates';
const ROOM_COUNT = parseInt(__ENV.ROOM_COUNT || '100');

const wsBroadcastLatency = new Trend('ws_broadcast_latency');
const wsMessageReceived = new Counter('ws_messages_received');
const broadcastSuccessRate = new Rate('broadcast_success_rate');

export const options = {
  scenarios: {
    ws_broadcast_test: {
      executor: 'constant-vus',
      vus: 1000,
      duration: '10m',
    },
  },

  thresholds: {
    'ws_broadcast_latency': ['p(95)<200', 'p(99)<500'],
    'broadcast_success_rate': ['rate>0.99'],
  },
};

export default function() {
  const roomId = `room_${randomIntBetween(1, ROOM_COUNT)}`;
  const userId = `user_${__VU}`;

  ws.connect(WS_URL, {}, function(socket) {
    socket.on('open', () => {
      // 加入房间
      socket.send(JSON.stringify({
        type: 'join',
        roomId: roomId,
        userId: userId
      }));
    });

    socket.on('message', (data) => {
      const receiveTime = Date.now();

      try {
        const msg = JSON.parse(data);

        if (msg.type === 'broadcast' && msg.sentAt) {
          const latency = receiveTime - msg.sentAt;
          wsBroadcastLatency.add(latency);
          wsMessageReceived.add(1);
          broadcastSuccessRate.add(latency < 1000);
        }
      } catch (e) {
        console.error(`解析消息失败: ${e.message}`);
        broadcastSuccessRate.add(false);
      }
    });

    // 定期发送测试消息
    socket.setInterval(() => {
      socket.send(JSON.stringify({
        type: 'broadcast',
        roomId: roomId,
        userId: userId,
        sentAt: Date.now(),
        data: 'test broadcast message'
      }));
    }, randomIntBetween(3000, 7000));

    sleep(300); // 保持连接5分钟
    socket.close();
  });
}

export function handleSummary(data) {
  const summary = {
    testName: 'WebSocket Broadcast Latency Test',
    timestamp: new Date().toISOString(),
    rooms: ROOM_COUNT,
    metrics: {
      messages_received: data.metrics.ws_messages_received?.values?.count || 0,
      broadcast_success_rate: (data.metrics.broadcast_success_rate?.values?.rate || 0) * 100,
      broadcast_latency_avg: data.metrics.ws_broadcast_latency?.values?.avg || 0,
      broadcast_latency_p50: data.metrics.ws_broadcast_latency?.values?.med || 0,
      broadcast_latency_p95: data.metrics.ws_broadcast_latency?.values['p(95)'] || 0,
      broadcast_latency_p99: data.metrics.ws_broadcast_latency?.values['p(99)'] || 0,
    }
  };

  console.log('\n📡 WebSocket广播延迟测试报告');
  console.log('='.repeat(60));
  console.log(`房间数: ${summary.rooms}`);
  console.log(`消息数: ${summary.metrics.messages_received}`);
  console.log(`成功率: ${summary.metrics.broadcast_success_rate.toFixed(2)}%`);
  console.log(`\n延迟统计:`);
  console.log(`  平均: ${summary.metrics.broadcast_latency_avg.toFixed(2)}ms`);
  console.log(`  P50: ${summary.metrics.broadcast_latency_p50.toFixed(2)}ms`);
  console.log(`  P95: ${summary.metrics.broadcast_latency_p95.toFixed(2)}ms`);
  console.log(`  P99: ${summary.metrics.broadcast_latency_p99.toFixed(2)}ms`);
  console.log('='.repeat(60) + '\n');

  return {
    'reports/ws-broadcast-latency-summary.json': JSON.stringify(summary, null, 2),
  };
}
