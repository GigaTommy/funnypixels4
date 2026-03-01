/**
 * FunnyPixels WebSocket 重连风暴测试
 *
 * 模拟大量客户端同时断线重连的场景（如服务器重启、网络抖动）
 * 测试服务器在重连风暴下的承受能力和恢复时间
 *
 * 运行: k6 run k6/websocket/ws-reconnect-storm.js
 */

import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Trend, Rate, Gauge } from 'k6/metrics';

const WS_URL = __ENV.WS_URL || 'ws://localhost:3001/ws/tile-updates';

// 自定义指标
const reconnectAttempts = new Counter('ws_reconnect_attempts');
const reconnectSuccess = new Counter('ws_reconnect_success');
const reconnectFailed = new Counter('ws_reconnect_failed');
const reconnectLatency = new Trend('ws_reconnect_latency', true);
const reconnectRate = new Rate('ws_reconnect_success_rate');
const concurrentConnections = new Gauge('ws_concurrent_connections');
const messagesAfterReconnect = new Counter('ws_messages_after_reconnect');

export const options = {
  scenarios: {
    // 阶段1: 建立初始连接
    initial_connect: {
      executor: 'shared-iterations',
      vus: 100,
      iterations: 100,
      startTime: '0s',
      maxDuration: '30s',
      exec: 'initialConnect',
    },
    // 阶段2: 模拟全部断线后同时重连（重连风暴）
    reconnect_storm: {
      executor: 'per-vu-iterations',
      vus: 500,
      iterations: 5, // 每个 VU 重连 5 次
      startTime: '30s',
      maxDuration: '5m',
      exec: 'reconnectStorm',
    },
    // 阶段3: 渐进式重连（带退避策略）
    gradual_reconnect: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 100 },
        { duration: '10s', target: 300 },
        { duration: '10s', target: 500 },
        { duration: '20s', target: 500 },
        { duration: '10s', target: 0 },
      ],
      startTime: '6m',
      exec: 'gradualReconnect',
    },
  },
  thresholds: {
    ws_reconnect_success_rate: ['rate>0.90'],
    ws_reconnect_latency: ['p(95)<5000'],
  },
};

// 阶段1: 建立初始连接并保持
export function initialConnect() {
  const start = Date.now();
  const res = ws.connect(WS_URL, {}, function (socket) {
    concurrentConnections.add(1);

    socket.on('open', () => {
      socket.send(JSON.stringify({
        type: 'subscribe',
        tiles: [`tile_${__VU}_${Math.floor(Math.random() * 100)}`],
      }));
    });

    socket.on('message', () => {
      messagesAfterReconnect.add(1);
    });

    // 保持连接 25 秒
    sleep(25);
    socket.close();
    concurrentConnections.add(-1);
  });

  check(res, { 'initial connect ok': (r) => r && r.status === 101 });
}

// 阶段2: 重连风暴 - 无退避，立即重连
export function reconnectStorm() {
  reconnectAttempts.add(1);
  const start = Date.now();

  const res = ws.connect(WS_URL, { timeout: '10s' }, function (socket) {
    const connectTime = Date.now() - start;
    reconnectLatency.add(connectTime);
    concurrentConnections.add(1);

    socket.on('open', () => {
      reconnectSuccess.add(1);
      reconnectRate.add(true);

      // 重连后立即重新订阅
      socket.send(JSON.stringify({
        type: 'subscribe',
        tiles: [`tile_storm_${__VU}_${__ITER}`],
      }));
    });

    socket.on('message', () => {
      messagesAfterReconnect.add(1);
    });

    socket.on('error', () => {
      reconnectFailed.add(1);
      reconnectRate.add(false);
    });

    // 短暂保持连接后断开，模拟反复重连
    sleep(2 + Math.random() * 3);
    socket.close();
    concurrentConnections.add(-1);
  });

  if (!res || res.status !== 101) {
    reconnectFailed.add(1);
    reconnectRate.add(false);
    reconnectLatency.add(Date.now() - start);
  }

  // 极短延迟后再次重连（模拟无退避的客户端）
  sleep(0.1 + Math.random() * 0.5);
}

// 阶段3: 带指数退避的重连
export function gradualReconnect() {
  let backoff = 1; // 初始退避 1 秒
  const maxBackoff = 30;
  const maxRetries = 5;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    reconnectAttempts.add(1);
    const start = Date.now();

    const res = ws.connect(WS_URL, { timeout: '10s' }, function (socket) {
      const connectTime = Date.now() - start;
      reconnectLatency.add(connectTime);
      concurrentConnections.add(1);

      socket.on('open', () => {
        reconnectSuccess.add(1);
        reconnectRate.add(true);
        backoff = 1; // 成功后重置退避

        socket.send(JSON.stringify({
          type: 'subscribe',
          tiles: [`tile_gradual_${__VU}`],
        }));
      });

      socket.on('message', () => {
        messagesAfterReconnect.add(1);
      });

      // 保持连接
      sleep(5 + Math.random() * 10);
      socket.close();
      concurrentConnections.add(-1);
    });

    if (!res || res.status !== 101) {
      reconnectFailed.add(1);
      reconnectRate.add(false);
      reconnectLatency.add(Date.now() - start);

      // 指数退避 + 抖动
      const jitter = Math.random() * backoff * 0.3;
      sleep(backoff + jitter);
      backoff = Math.min(backoff * 2, maxBackoff);
    } else {
      break; // 连接成功，退出重试
    }
  }
}

export function handleSummary(data) {
  const reconnectP95 = data.metrics.ws_reconnect_latency?.values?.['p(95)'] || 0;
  const successRate = data.metrics.ws_reconnect_success_rate?.values?.rate || 0;

  let rating = 'EXCELLENT';
  if (successRate < 0.80) rating = 'POOR';
  else if (successRate < 0.90) rating = 'FAIR';
  else if (reconnectP95 > 5000) rating = 'FAIR';
  else if (reconnectP95 > 2000) rating = 'GOOD';

  return {
    stdout: `\n${'='.repeat(50)}\n` +
      `重连风暴测试结果: ${rating}\n` +
      `重连成功率: ${(successRate * 100).toFixed(1)}%\n` +
      `重连 P95 延迟: ${reconnectP95.toFixed(0)}ms\n` +
      `${'='.repeat(50)}\n`,
    'reports/ws-reconnect-storm.json': JSON.stringify(data, null, 2),
  };
}
