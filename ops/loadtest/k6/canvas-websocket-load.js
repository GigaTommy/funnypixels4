/**
 * FunnyPixels Canvas WebSocket压力测试
 * 测试WebSocket连接、订阅和实时消息广播性能
 *
 * 运行示例:
 * k6 run --vus 100 --duration 5m canvas-websocket-load.js
 *
 * 环境变量:
 * - WS_URL: WebSocket URL (默认: ws://localhost:3001/ws/tile-updates)
 * - TILES_PER_CLIENT: 每个客户端订阅的瓦片数 (默认: 9)
 * - CENTER_LAT: 中心纬度 (默认: 39.9)
 * - CENTER_LNG: 中心经度 (默认: 116.4)
 */

import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// ==================== 配置 ====================

const WS_URL = __ENV.WS_URL || 'ws://localhost:3001/ws/tile-updates';
const TILES_PER_CLIENT = parseInt(__ENV.TILES_PER_CLIENT || '9');
const CENTER_LAT = parseFloat(__ENV.CENTER_LAT || '39.9');
const CENTER_LNG = parseFloat(__ENV.CENTER_LNG || '116.4');
const ZOOM_LEVEL = parseInt(__ENV.ZOOM_LEVEL || '14');

// ==================== 自定义指标 ====================

const wsConnectionSuccess = new Counter('ws_connection_success');
const wsConnectionFailure = new Counter('ws_connection_failure');
const wsConnectionDuration = new Trend('ws_connection_duration', true);
const wsMessageReceived = new Counter('ws_message_received');
const wsMessageLatency = new Trend('ws_message_latency', true);
const wsSubscribeSuccess = new Counter('ws_subscribe_success');
const wsSubscribeFailure = new Counter('ws_subscribe_failure');
const wsPingPongLatency = new Trend('ws_ping_pong_latency', true);
const wsConnectionRate = new Rate('ws_connection_rate');

// ==================== 测试配置 ====================

export const options = {
  scenarios: {
    // WebSocket连接压力测试
    websocket_connections: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },     // 1分钟升到50连接
        { duration: '3m', target: 50 },     // 稳定3分钟
        { duration: '1m', target: 200 },    // 1分钟升到200连接
        { duration: '3m', target: 200 },    // 稳定3分钟
        { duration: '1m', target: 500 },    // 1分钟升到500连接
        { duration: '5m', target: 500 },    // 稳定5分钟
        { duration: '1m', target: 1000 },   // 1分钟升到1000连接
        { duration: '5m', target: 1000 },   // 稳定5分钟
        { duration: '1m', target: 0 },      // 1分钟降到0
      ],
    },
  },

  thresholds: {
    // 连接成功率
    'ws_connection_rate': ['rate>0.95'],

    // 连接建立时间
    'ws_connection_duration': [
      'p(95)<3000',  // 95%的连接在3秒内建立
      'avg<1000',    // 平均连接时间1秒
    ],

    // 消息延迟
    'ws_message_latency': [
      'p(95)<200',   // 95%的消息在200ms内收到
      'p(99)<500',   // 99%的消息在500ms内收到
    ],

    // Ping-Pong延迟
    'ws_ping_pong_latency': [
      'p(95)<100',
      'avg<50',
    ],
  },
};

// ==================== 工具函数 ====================

/**
 * 计算瓦片坐标 (Web Mercator投影)
 */
function latLngToTile(lat, lng, zoom) {
  const x = Math.floor((lng + 180) / 360 * Math.pow(2, zoom));
  const latRad = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * Math.pow(2, zoom));
  return { x, y, z: zoom };
}

/**
 * 生成周围瓦片列表
 */
function getSurroundingTiles(centerLat, centerLng, zoom, count = 9) {
  const centerTile = latLngToTile(centerLat, centerLng, zoom);
  const tiles = [];

  // 3x3网格
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      tiles.push({
        x: centerTile.x + dx,
        y: centerTile.y + dy,
        z: zoom,
        key: `${zoom}/${centerTile.x + dx}/${centerTile.y + dy}`,
      });
    }
  }

  return tiles.slice(0, count);
}

/**
 * 生成随机偏移的坐标
 */
function randomNearbyCoordinate(centerLat, centerLng, offsetDegrees = 0.01) {
  const lat = centerLat + (Math.random() - 0.5) * 2 * offsetDegrees;
  const lng = centerLng + (Math.random() - 0.5) * 2 * offsetDegrees;
  return { lat, lng };
}

// ==================== 主测试函数 ====================

export default function() {
  // 生成随机客户端位置
  const clientPosition = randomNearbyCoordinate(CENTER_LAT, CENTER_LNG);
  const tilesToSubscribe = getSurroundingTiles(clientPosition.lat, clientPosition.lng, ZOOM_LEVEL, TILES_PER_CLIENT);

  let connectionEstablished = false;
  let messagesReceived = 0;
  let subscribeConfirmed = false;

  const startTime = Date.now();

  // 建立WebSocket连接
  const res = ws.connect(WS_URL, {
    tags: { name: 'ws_tile_updates' },
  }, function(socket) {
    // 连接建立
    const connectionTime = Date.now() - startTime;
    wsConnectionDuration.add(connectionTime);
    connectionEstablished = true;

    socket.on('open', function() {
      console.log(`✅ WebSocket connected: ${socket.url}`);
      wsConnectionSuccess.add(1);
      wsConnectionRate.add(true);
    });

    socket.on('message', function(data) {
      const messageTime = Date.now();

      try {
        const message = JSON.parse(data);

        // 处理不同类型的消息
        switch (message.type) {
          case 'connected':
            console.log(`🔗 Client ID: ${message.clientId}`);

            // 发送瓦片订阅请求
            const subscribeMessage = {
              type: 'subscribe-tiles',
              tiles: tilesToSubscribe.map(t => t.key),
            };
            socket.send(JSON.stringify(subscribeMessage));
            break;

          case 'tiles-subscribed':
            console.log(`✅ Subscribed to ${message.count} tiles`);
            wsSubscribeSuccess.add(1);
            subscribeConfirmed = true;
            break;

          case 'pixel-update':
            // 像素更新消息
            messagesReceived++;
            wsMessageReceived.add(1);

            if (message.timestamp) {
              const latency = messageTime - message.timestamp;
              wsMessageLatency.add(latency);
            }
            break;

          case 'pong':
            // Pong响应
            if (message.timestamp) {
              const latency = messageTime - message.timestamp;
              wsPingPongLatency.add(latency);
            }
            break;

          default:
            // 其他消息
            console.log(`📨 Received: ${message.type}`);
        }
      } catch (e) {
        console.error(`❌ Failed to parse message: ${e.message}`);
      }
    });

    socket.on('error', function(e) {
      console.error(`❌ WebSocket error: ${e.error()}`);
      wsConnectionFailure.add(1);
      wsConnectionRate.add(false);
    });

    socket.on('close', function() {
      console.log(`🔌 WebSocket closed`);
    });

    // 定期发送心跳
    socket.setInterval(function() {
      if (socket.readyState === 1) { // OPEN
        const pingMessage = {
          type: 'ping',
          timestamp: Date.now(),
        };
        socket.send(JSON.stringify(pingMessage));
      }
    }, 30000); // 30秒

    // 保持连接一段时间
    socket.setTimeout(function() {
      console.log(`⏰ Test duration completed, closing connection`);
      socket.close();
    }, randomIntBetween(60000, 120000)); // 1-2分钟
  });

  // 检查连接结果
  check(res, {
    'websocket connection established': () => connectionEstablished,
    'subscription confirmed': () => subscribeConfirmed,
    'received messages': () => messagesReceived > 0,
  });

  // 如果连接失败，记录指标
  if (!connectionEstablished) {
    wsConnectionFailure.add(1);
    wsConnectionRate.add(false);
  }

  if (!subscribeConfirmed) {
    wsSubscribeFailure.add(1);
  }

  // 等待一段时间再建立下一个连接
  sleep(randomIntBetween(5, 15));
}

// ==================== Setup & Teardown ====================

export function setup() {
  console.log('🚀 开始WebSocket负载测试...');
  console.log(`📍 测试中心: Lat ${CENTER_LAT}, Lng ${CENTER_LNG}`);
  console.log(`🗺️  缩放级别: ${ZOOM_LEVEL}`);
  console.log(`📍 每客户端订阅瓦片数: ${TILES_PER_CLIENT}`);
  console.log(`🎯 目标URL: ${WS_URL}`);

  return {
    startTime: Date.now(),
  };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`✅ WebSocket测试完成，总耗时: ${duration.toFixed(2)}秒`);
}

// ==================== 自定义报告 ====================

export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    duration: data.state.testRunDurationMs / 1000,
    metrics: {
      ws_connection_success: data.metrics.ws_connection_success?.values?.count || 0,
      ws_connection_failure: data.metrics.ws_connection_failure?.values?.count || 0,
      ws_connection_rate: data.metrics.ws_connection_rate?.values?.rate || 0,
      ws_subscribe_success: data.metrics.ws_subscribe_success?.values?.count || 0,
      ws_subscribe_failure: data.metrics.ws_subscribe_failure?.values?.count || 0,
      ws_message_received: data.metrics.ws_message_received?.values?.count || 0,
      avg_connection_duration: data.metrics.ws_connection_duration?.values?.avg || 0,
      p95_connection_duration: data.metrics.ws_connection_duration?.values['p(95)'] || 0,
      avg_message_latency: data.metrics.ws_message_latency?.values?.avg || 0,
      p95_message_latency: data.metrics.ws_message_latency?.values['p(95)'] || 0,
      p99_message_latency: data.metrics.ws_message_latency?.values['p(99)'] || 0,
      avg_ping_pong_latency: data.metrics.ws_ping_pong_latency?.values?.avg || 0,
    },
    thresholds: data.thresholds,
  };

  console.log('\n📊 WebSocket测试摘要:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 连接成功: ${summary.metrics.ws_connection_success}`);
  console.log(`❌ 连接失败: ${summary.metrics.ws_connection_failure}`);
  console.log(`📈 连接成功率: ${(summary.metrics.ws_connection_rate * 100).toFixed(2)}%`);
  console.log(`✅ 订阅成功: ${summary.metrics.ws_subscribe_success}`);
  console.log(`❌ 订阅失败: ${summary.metrics.ws_subscribe_failure}`);
  console.log(`📨 收到消息数: ${summary.metrics.ws_message_received}`);
  console.log(`⏱️  平均连接时间: ${summary.metrics.avg_connection_duration.toFixed(2)}ms`);
  console.log(`⏱️  P95连接时间: ${summary.metrics.p95_connection_duration.toFixed(2)}ms`);
  console.log(`⏱️  平均消息延迟: ${summary.metrics.avg_message_latency.toFixed(2)}ms`);
  console.log(`⏱️  P95消息延迟: ${summary.metrics.p95_message_latency.toFixed(2)}ms`);
  console.log(`⏱️  P99消息延迟: ${summary.metrics.p99_message_latency.toFixed(2)}ms`);
  console.log(`💓 平均Ping-Pong延迟: ${summary.metrics.avg_ping_pong_latency.toFixed(2)}ms`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  return {
    'stdout': JSON.stringify(summary, null, 2),
    'websocket-summary.json': JSON.stringify(summary, null, 2),
  };
}
