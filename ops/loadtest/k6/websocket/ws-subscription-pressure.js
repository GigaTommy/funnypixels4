/**
 * FunnyPixels WebSocket 订阅压力测试
 *
 * 测试大量客户端订阅/取消订阅瓦片更新的场景：
 * - 单客户端大量订阅
 * - 热门区域（多客户端订阅同一瓦片）
 * - 频繁切换订阅（模拟用户平移地图）
 * - 服务器广播扇出性能
 *
 * 运行: k6 run k6/websocket/ws-subscription-pressure.js
 */

import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Trend, Rate, Gauge } from 'k6/metrics';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

const WS_URL = __ENV.WS_URL || 'ws://localhost:3001/ws/tile-updates';

// 自定义指标
const subscribeOps = new Counter('ws_subscribe_ops');
const unsubscribeOps = new Counter('ws_unsubscribe_ops');
const subscribeLatency = new Trend('ws_subscribe_latency', true);
const messagesReceived = new Counter('ws_tile_messages_received');
const messageFanout = new Trend('ws_message_fanout_time', true);
const activeSubscriptions = new Gauge('ws_active_subscriptions');
const hotTileMessages = new Counter('ws_hot_tile_messages');

// 热门区域瓦片（多人聚集区域）
const HOT_TILES = ['tile_0_0', 'tile_1_0', 'tile_0_1', 'tile_1_1'];
const COLD_TILE_RANGE = 1000;

export const options = {
  scenarios: {
    // 场景1: 大量订阅同一热门瓦片
    hot_tile_pressure: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '15s', target: 200 },
        { duration: '30s', target: 200 },
        { duration: '10s', target: 0 },
      ],
      exec: 'hotTileSubscription',
    },
    // 场景2: 快速切换订阅（模拟用户平移地图）
    map_pan_simulation: {
      executor: 'constant-vus',
      vus: 100,
      duration: '2m',
      startTime: '1m',
      exec: 'mapPanSimulation',
    },
    // 场景3: 单客户端大量订阅
    mass_subscribe: {
      executor: 'per-vu-iterations',
      vus: 20,
      iterations: 1,
      startTime: '3m30s',
      maxDuration: '2m',
      exec: 'massSubscribe',
    },
  },
  thresholds: {
    ws_subscribe_latency: ['p(95)<1000'],
    ws_tile_messages_received: ['count>0'],
  },
};

function generateTileId(x, y) {
  return `tile_${x}_${y}`;
}

// 场景1: 热门瓦片订阅 - 所有用户都订阅同一区域
export function hotTileSubscription() {
  const res = ws.connect(WS_URL, { timeout: '10s' }, function (socket) {
    socket.on('open', () => {
      const start = Date.now();

      // 订阅所有热门瓦片
      socket.send(JSON.stringify({
        type: 'subscribe',
        tiles: HOT_TILES,
      }));
      subscribeOps.add(HOT_TILES.length);
      subscribeLatency.add(Date.now() - start);
      activeSubscriptions.add(HOT_TILES.length);
    });

    socket.on('message', (data) => {
      messagesReceived.add(1);
      hotTileMessages.add(1);
      try {
        const msg = JSON.parse(data);
        if (msg.serverTimestamp) {
          messageFanout.add(Date.now() - msg.serverTimestamp);
        }
      } catch {}
    });

    // 保持订阅一段时间
    sleep(randomIntBetween(15, 25));

    // 取消订阅
    socket.send(JSON.stringify({
      type: 'unsubscribe',
      tiles: HOT_TILES,
    }));
    unsubscribeOps.add(HOT_TILES.length);
    activeSubscriptions.add(-HOT_TILES.length);

    socket.close();
  });

  check(res, { 'hot tile connect ok': (r) => r && r.status === 101 });
}

// 场景2: 地图平移 - 频繁切换订阅的瓦片
export function mapPanSimulation() {
  let currentX = randomIntBetween(0, 100);
  let currentY = randomIntBetween(0, 100);
  let currentTiles = [];

  const res = ws.connect(WS_URL, { timeout: '10s' }, function (socket) {
    socket.on('open', () => {
      // 初始订阅（3x3 视口）
      currentTiles = getViewportTiles(currentX, currentY);
      socket.send(JSON.stringify({ type: 'subscribe', tiles: currentTiles }));
      subscribeOps.add(currentTiles.length);
      activeSubscriptions.add(currentTiles.length);
    });

    socket.on('message', () => {
      messagesReceived.add(1);
    });

    // 模拟 10 次地图平移
    for (let pan = 0; pan < 10; pan++) {
      sleep(randomIntBetween(2, 5));

      // 平移方向
      const dx = randomIntBetween(-2, 2);
      const dy = randomIntBetween(-2, 2);
      currentX = Math.max(0, Math.min(currentX + dx, COLD_TILE_RANGE));
      currentY = Math.max(0, Math.min(currentY + dy, COLD_TILE_RANGE));

      const newTiles = getViewportTiles(currentX, currentY);

      // 取消不在新视口的订阅
      const toUnsub = currentTiles.filter(t => !newTiles.includes(t));
      const toSub = newTiles.filter(t => !currentTiles.includes(t));

      const start = Date.now();

      if (toUnsub.length > 0) {
        socket.send(JSON.stringify({ type: 'unsubscribe', tiles: toUnsub }));
        unsubscribeOps.add(toUnsub.length);
        activeSubscriptions.add(-toUnsub.length);
      }
      if (toSub.length > 0) {
        socket.send(JSON.stringify({ type: 'subscribe', tiles: toSub }));
        subscribeOps.add(toSub.length);
        activeSubscriptions.add(toSub.length);
      }

      subscribeLatency.add(Date.now() - start);
      currentTiles = newTiles;
    }

    // 清理
    socket.send(JSON.stringify({ type: 'unsubscribe', tiles: currentTiles }));
    unsubscribeOps.add(currentTiles.length);
    activeSubscriptions.add(-currentTiles.length);
    socket.close();
  });

  check(res, { 'map pan connect ok': (r) => r && r.status === 101 });
}

// 场景3: 单客户端大量订阅
export function massSubscribe() {
  const TILES_TO_SUBSCRIBE = 500;

  const res = ws.connect(WS_URL, { timeout: '10s' }, function (socket) {
    socket.on('open', () => {
      // 分批订阅大量瓦片
      const batchSize = 50;
      const allTiles = [];

      for (let batch = 0; batch < TILES_TO_SUBSCRIBE / batchSize; batch++) {
        const tiles = [];
        for (let i = 0; i < batchSize; i++) {
          const tileId = generateTileId(
            randomIntBetween(0, COLD_TILE_RANGE),
            randomIntBetween(0, COLD_TILE_RANGE)
          );
          tiles.push(tileId);
          allTiles.push(tileId);
        }

        const start = Date.now();
        socket.send(JSON.stringify({ type: 'subscribe', tiles }));
        subscribeOps.add(tiles.length);
        subscribeLatency.add(Date.now() - start);

        sleep(0.5); // 分批间隔
      }

      activeSubscriptions.add(allTiles.length);

      // 保持一段时间接收消息
      sleep(30);

      // 清理
      socket.send(JSON.stringify({ type: 'unsubscribe', tiles: allTiles }));
      unsubscribeOps.add(allTiles.length);
      activeSubscriptions.add(-allTiles.length);
    });

    socket.on('message', () => {
      messagesReceived.add(1);
    });

    sleep(35);
    socket.close();
  });

  check(res, { 'mass subscribe ok': (r) => r && r.status === 101 });
}

function getViewportTiles(cx, cy) {
  const tiles = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      tiles.push(generateTileId(cx + dx, cy + dy));
    }
  }
  return tiles;
}

export function handleSummary(data) {
  return {
    stdout: `\n订阅压力测试完成\n` +
      `总订阅操作: ${data.metrics.ws_subscribe_ops?.values?.count || 0}\n` +
      `总取消订阅: ${data.metrics.ws_unsubscribe_ops?.values?.count || 0}\n` +
      `接收消息数: ${data.metrics.ws_tile_messages_received?.values?.count || 0}\n`,
    'reports/ws-subscription-pressure.json': JSON.stringify(data, null, 2),
  };
}
