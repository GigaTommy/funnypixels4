/**
 * K6 WebSocket 压力测试脚本 - Tile-based Rooms 架构
 *
 * 测试目标：
 * - 并发：10,000 VUs
 * - 每个用户连接后订阅 20 个瓦片房间
 * - 每秒模拟 500 条像素更新（broadcastPixelUpdates）
 *
 * 运行命令：
 * k6 run --vus 10000 --duration 5m ws-room-test.js
 *
 * 环境变量：
 * - WS_HOST: WebSocket服务器地址 (默认: ws://localhost:3001)
 * - TEST_DURATION: 测试持续时间 (默认: 5m)
 * - TILES_PER_CLIENT: 每客户端订阅瓦片数 (默认: 20)
 * - PIXELS_PER_SECOND: 每秒像素更新数 (默认: 500)
 */

import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

// 自定义指标
const connectionSuccessRate = new Rate('connection_success_rate');
const firstMessageLatency = new Trend('first_message_latency');
const updatesPerSecond = new Rate('updates_per_second');
const disconnectionRate = new Rate('disconnection_rate');
const reconnectionCount = new Counter('reconnection_count');
const activeConnections = new Gauge('active_connections');
const messagesReceived = new Counter('messages_received');
const messagesSent = new Counter('messages_sent');
const roomSubscriptionSuccess = new Rate('room_subscription_success');
const pixelUpdateLatency = new Trend('pixel_update_latency');

// 测试配置
const WS_HOST = __ENV.WS_HOST || 'ws://localhost:3001';
const WS_PATH = '/ws/tile-updates';
const TILES_PER_CLIENT = parseInt(__ENV.TILES_PER_CLIENT) || 20;
const PIXELS_PER_SECOND = parseInt(__ENV.PIXELS_PER_SECOND) || 500;
const HEARTBEAT_INTERVAL = 30000; // 30秒

// 广州区域范围（用于生成随机瓦片坐标）
const GUANGZHOU_BOUNDS = {
  minLat: 22.5,
  maxLat: 23.8,
  minLng: 113.0,
  maxLng: 114.0
};

/**
 * 生成随机瓦片坐标
 * @param {number} zoom - 缩放级别
 * @returns {Array} - 瓦片坐标数组 ["z/x/y", ...]
 */
function generateRandomTiles(zoom = 14, count = TILES_PER_CLIENT) {
  const tiles = [];

  for (let i = 0; i < count; i++) {
    // 在广州范围内生成随机经纬度
    const lat = GUANGZHOU_BOUNDS.minLat + Math.random() * (GUANGZHOU_BOUNDS.maxLat - GUANGZHOU_BOUNDS.minLat);
    const lng = GUANGZHOU_BOUNDS.minLng + Math.random() * (GUANGZHOU_BOUNDS.maxLng - GUANGZHOU_BOUNDS.minLng);

    // 转换为瓦片坐标
    const x = Math.floor((lng + 180) / 360 * Math.pow(2, zoom));
    const latRad = lat * Math.PI / 180;
    const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * Math.pow(2, zoom));

    tiles.push(`${zoom}/${x}/${y}`);
  }

  return tiles;
}

/**
 * 生成随机像素数据
 * @returns {Object} - 像素对象
 */
function generateRandomPixel() {
  const types = ['color', 'emoji', 'complex'];
  const type = types[Math.floor(Math.random() * types.length)];

  const pixel = {
    id: `pixel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    lat: GUANGZHOU_BOUNDS.minLat + Math.random() * (GUANGZHOU_BOUNDS.maxLat - GUANGZHOU_BOUNDS.minLat),
    lng: GUANGZHOU_BOUNDS.minLng + Math.random() * (GUANGZHOU_BOUNDS.maxLng - GUANGZHOU_BOUNDS.minLng),
    type: type,
    timestamp: Date.now()
  };

  if (type === 'color') {
    pixel.color = `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`;
  } else if (type === 'emoji') {
    const emojis = ['🔥', '🌟', '🍀', '🎯', '🎨', '🚀', '💎', '🌈'];
    pixel.emoji = emojis[Math.floor(Math.random() * emojis.length)];
  } else {
    pixel.file_url = `https://cdn.funnypixels.com/uploads/${pixel.id}.png`;
  }

  return pixel;
}

/**
 * WebSocket客户端类
 */
class WSClient {
  constructor(vuId) {
    this.vuId = vuId;
    this.ws = null;
    this.connected = false;
    this.clientId = null;
    this.subscribedTiles = new Set();
    this.messageCount = 0;
    this.lastMessageTime = null;
    this.reconnects = 0;
    this.heartbeatTimer = null;
  }

  /**
   * 连接WebSocket服务器
   */
  async connect() {
    const url = `${WS_HOST}${WS_PATH}`;
    const startTime = Date.now();

    try {
      this.ws = new WebSocket(url);

      // 连接成功
      this.ws.onopen = () => {
        this.connected = true;
        const connectionTime = Date.now() - startTime;

        console.log(`[VU ${this.vuId}] ✅ WebSocket连接成功 (${connectionTime}ms)`);

        connectionSuccessRate.add(1);
        activeConnections.add(1);

        // 启动心跳
        this.startHeartbeat();
      };

      // 接收消息
      this.ws.onmessage = (event) => {
        const receiveTime = Date.now();

        try {
          const message = JSON.parse(event.data);
          this.messageCount++;
          this.lastMessageTime = receiveTime;
          messagesReceived.add(1);

          // 记录首包延迟
          if (this.messageCount === 1) {
            const latency = receiveTime - startTime;
            firstMessageLatency.add(latency);
            console.log(`[VU ${this.vuId}] 📦 首包延迟: ${latency}ms`);
          }

          // 处理不同类型的消息
          this.handleMessage(message);

        } catch (error) {
          console.error(`[VU ${this.vuId}] ❌ 解析消息失败:`, error);
        }
      };

      // 连接关闭
      this.ws.onclose = () => {
        this.connected = false;
        activeConnections.add(-1);
        disconnectionRate.add(1);

        console.log(`[VU ${this.vuId}] 🔌 WebSocket连接关闭`);

        // 清理心跳
        if (this.heartbeatTimer) {
          clearInterval(this.heartbeatTimer);
        }

        // 自动重连
        if (this.reconnects < 3) {
          this.reconnects++;
          reconnectionCount.add(1);
          console.log(`[VU ${this.vuId}] 🔄 尝试重连 (${this.reconnects}/3)`);
          sleep(1);
          this.connect();
        }
      };

      // 连接错误
      this.ws.onerror = (error) => {
        console.error(`[VU ${this.vuId}] ❌ WebSocket错误:`, error);
        connectionSuccessRate.add(0);
      };

      // 等待连接建立
      await this.waitForConnection();

    } catch (error) {
      console.error(`[VU ${this.vuId}] ❌ 连接失败:`, error);
      connectionSuccessRate.add(0);
    }
  }

  /**
   * 等待连接建立
   */
  async waitForConnection() {
    let attempts = 0;
    const maxAttempts = 30; // 3秒超时

    while (!this.connected && attempts < maxAttempts) {
      sleep(0.1);
      attempts++;
    }

    if (!this.connected) {
      throw new Error('WebSocket连接超时');
    }
  }

  /**
   * 处理接收到的消息
   */
  handleMessage(message) {
    switch (message.type) {
      case 'connected':
        this.clientId = message.clientId;
        console.log(`[VU ${this.vuId}] 🎌 客户端ID: ${this.clientId}`);

        // 连接成功后订阅瓦片
        this.subscribeTiles();
        break;

      case 'tiles-subscribed':
        console.log(`[VU ${this.vuId}] 📋 已订阅 ${message.count} 个瓦片`);
        roomSubscriptionSuccess.add(1);
        break;

      case 'pixel-update':
        // 记录像素更新延迟
        if (message.timestamp) {
          const latency = Date.now() - message.timestamp;
          pixelUpdateLatency.add(latency);
        }

        // 计算每秒更新数
        updatesPerSecond.add(1);
        break;

      case 'pong':
        // 心跳响应
        break;

      default:
        // console.log(`[VU ${this.vuId}] 📨 收到消息: ${message.type}`);
    }
  }

  /**
   * 订阅瓦片房间
   */
  subscribeTiles() {
    if (!this.connected || !this.clientId) return;

    const tiles = generateRandomTiles();
    this.subscribedTiles = new Set(tiles);

    const message = {
      type: 'subscribe-tiles',
      tiles: tiles
    };

    this.ws.send(JSON.stringify(message));
    messagesSent.add(1);

    console.log(`[VU ${this.vuId}] 📮 订阅 ${tiles.length} 个瓦片:`, tiles.slice(0, 3).join(', '), '...');
  }

  /**
   * 启动心跳
   */
  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (this.connected && this.ws) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
        messagesSent.add(1);
      }
    }, HEARTBEAT_INTERVAL);
  }

  /**
   * 关闭连接
   */
  close() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    if (this.ws) {
      this.ws.close();
    }
  }
}

/**
 * 模拟像素更新广播器（VU 1-100）
 */
function pixelUpdateBroadcaster() {
  const ws = new WebSocket(`${WS_HOST}${WS_PATH}`);
  let sentCount = 0;

  ws.onopen = () => {
    console.log('[Broadcaster] 📡 像素更新广播器已启动');

    // 订阅一些瓦片以触发广播
    const tiles = generateRandomTiles(14, 50);
    ws.send(JSON.stringify({
      type: 'subscribe-tiles',
      tiles: tiles
    }));

    // 定期发送像素更新（模拟用户操作）
    const interval = setInterval(() => {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        clearInterval(interval);
        return;
      }

      // 生成批量像素更新
      const batchSize = Math.ceil(PIXELS_PER_SECOND / 10); // 每100ms发送一批
      const pixels = [];

      for (let i = 0; i < batchSize; i++) {
        pixels.push(generateRandomPixel());
      }

      // 这里应该调用后端的 broadcastPixelUpdates 方法
      // 由于是WebSocket客户端，我们发送特殊消息触发服务端广播
      ws.send(JSON.stringify({
        type: 'simulate-broadcast',
        pixels: pixels
      }));

      sentCount += pixels.length;
      messagesSent.add(pixels.length);

    }, 100); // 每100ms发送一次，达到每秒500条的目标

    // 运行一段时间后停止
    setTimeout(() => {
      clearInterval(interval);
      ws.close();
      console.log(`[Broadcaster] 📊 总共发送了 ${sentCount} 个像素更新`);
    }, 60000); // 运行1分钟
  };

  ws.onerror = (error) => {
    console.error('[Broadcaster] ❌ 错误:', error);
  };
}

// 主测试逻辑
export default function () {
  const vuId = __VU;

  // VU 1-100 作为广播器
  if (vuId <= 100) {
    pixelUpdateBroadcaster();
    sleep(2);
    return;
  }

  // VU 101-10000 作为普通客户端
  const client = new WSClient(vuId);

  // 连接WebSocket
  client.connect();

  // 运行测试
  const testDuration = 60; // 每个VU运行60秒
  const endTime = Date.now() + testDuration * 1000;

  while (Date.now() < endTime) {
    // 随机发送一些测试消息
    if (Math.random() < 0.1) { // 10%概率
      if (client.connected && client.ws) {
        client.ws.send(JSON.stringify({
          type: 'ping',
          timestamp: Date.now()
        }));
        messagesSent.add(1);
      }
    }

    sleep(1);
  }

  // 清理
  client.close();
}

// 测试开始时的初始化
export function setup() {
  console.log('🚀 K6 WebSocket Tile Rooms 压力测试开始');
  console.log(`📊 测试配置:`);
  console.log(`   - 并发用户: ${__VUS}`);
  console.log(`   - 每用户瓦片数: ${TILES_PER_CLIENT}`);
  console.log(`   - 每秒像素更新: ${PIXELS_PER_SECOND}`);
  console.log(`   - WebSocket地址: ${WS_HOST}`);
  console.log(`   - 测试区域: 广州`);
}

// 测试结束时的清理
export function teardown() {
  console.log('🏁 K6 WebSocket Tile Rooms 压力测试结束');
  console.log('📈 测试结果:');
  console.log(`   - 连接成功率: ${(connectionSuccessRate.rate * 100).toFixed(2)}%`);
  console.log(`   - 平均首包延迟: ${(firstMessageLatency.avg || 0).toFixed(2)}ms`);
  console.log(`   - 掉线率: ${(disconnectionRate.rate * 100).toFixed(2)}%`);
  console.log(`   - 总重连次数: ${reconnectionCount.count}`);
  console.log(`   - 消息接收总数: ${messagesReceived.count}`);
  console.log(`   - 消息发送总数: ${messagesSent.count}`);
  console.log(`   - 平均像素更新延迟: ${(pixelUpdateLatency.avg || 0).toFixed(2)}ms`);
}

// 选项配置
export const options = {
  vus: 10000,
  duration: '5m',

  // 阶段性加载
  stages: [
    { duration: '30s', target: 1000 },   // 30秒内增加到1000用户
    { duration: '1m', target: 3000 },    // 1分钟内增加到3000用户
    { duration: '1m', target: 5000 },    // 1分钟内增加到5000用户
    { duration: '1m', target: 7000 },    // 1分钟内增加到7000用户
    { duration: '1m', target: 10000 },   // 1分钟内增加到10000用户
    { duration: '30s', target: 0 }       // 30秒内减少到0用户
  ],

  // 阈值设置
  thresholds: {
    'connection_success_rate': ['rate>0.95'],     // 连接成功率 > 95%
    'first_message_latency': ['p(95)<500'],       // 95%的首包延迟 < 500ms
    'disconnection_rate': ['rate<0.05'],          // 掉线率 < 5%
    'pixel_update_latency': ['p(95)<200'],       // 95%的像素更新延迟 < 200ms
    'http_req_duration': ['p(95)<100']           // HTTP请求延迟
  },

  // 输出格式
  summaryTrendStats: ['avg', 'min', 'max', 'p(90)', 'p(95)', 'p(99)'],
  summaryTimeUnit: 'ms'
};