#!/usr/bin/env node
/**
 * FunnyPixels 真实用户行为模拟器
 *
 * 模拟真实用户在全球画布上的绘制行为，包括:
 * - 登录/初始化
 * - 浏览地图
 * - 绘制像素
 * - WebSocket订阅
 * - 思考时间
 * - 随机行为
 *
 * 使用方式:
 * node realistic-user-simulator.js --users 100 --duration 600
 */

const axios = require('axios');
const WebSocket = require('ws');
const { program } = require('commander');

// ==================== 配置 ====================

program
  .option('--users <number>', 'Number of concurrent users', '10')
  .option('--duration <seconds>', 'Test duration in seconds', '300')
  .option('--base-url <url>', 'API base URL', 'http://localhost:3001')
  .option('--ws-url <url>', 'WebSocket URL', 'ws://localhost:3001/ws/tile-updates')
  .option('--region <name>', 'Test region (beijing|shanghai|global)', 'beijing')
  .option('--output <file>', 'Output metrics file', null)
  .option('--verbose', 'Verbose logging', false)
  .parse(process.argv);

const options = program.opts();

// 区域配置
const REGIONS = {
  beijing: {
    name: 'Beijing (Tiananmen)',
    lat: [39.90, 39.92],
    lng: [116.39, 116.41],
  },
  shanghai: {
    name: 'Shanghai (Bund)',
    lat: [31.23, 31.25],
    lng: [121.48, 121.50],
  },
  global: {
    name: 'Global (Random)',
    lat: [-85, 85],
    lng: [-180, 180],
  },
};

const region = REGIONS[options.region] || REGIONS.beijing;

// ==================== 性能指标收集 ====================

class MetricsCollector {
  constructor() {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      pixelsDrawn: 0,
      pixelsFailed: 0,
      wsConnections: 0,
      wsDisconnections: 0,
      wsMessagesReceived: 0,
      latencies: [],
      errors: {},
      startTime: Date.now(),
    };
  }

  recordRequest(success, latency, error = null) {
    this.metrics.totalRequests++;
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
      if (error) {
        const errorKey = error.message || error.toString();
        this.metrics.errors[errorKey] = (this.metrics.errors[errorKey] || 0) + 1;
      }
    }
    if (latency) {
      this.metrics.latencies.push(latency);
    }
  }

  recordPixelDraw(success) {
    if (success) {
      this.metrics.pixelsDrawn++;
    } else {
      this.metrics.pixelsFailed++;
    }
  }

  recordWsConnection() {
    this.metrics.wsConnections++;
  }

  recordWsDisconnection() {
    this.metrics.wsDisconnections++;
  }

  recordWsMessage() {
    this.metrics.wsMessagesReceived++;
  }

  getStats() {
    const duration = (Date.now() - this.metrics.startTime) / 1000;
    const sortedLatencies = this.metrics.latencies.sort((a, b) => a - b);
    const p50 = sortedLatencies[Math.floor(sortedLatencies.length * 0.5)] || 0;
    const p95 = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] || 0;
    const p99 = sortedLatencies[Math.floor(sortedLatencies.length * 0.99)] || 0;
    const avg = sortedLatencies.reduce((a, b) => a + b, 0) / sortedLatencies.length || 0;

    return {
      ...this.metrics,
      duration,
      requestsPerSecond: (this.metrics.totalRequests / duration).toFixed(2),
      successRate: ((this.metrics.successfulRequests / this.metrics.totalRequests) * 100).toFixed(2),
      pixelSuccessRate: ((this.metrics.pixelsDrawn / (this.metrics.pixelsDrawn + this.metrics.pixelsFailed)) * 100).toFixed(2),
      latency: {
        avg: avg.toFixed(2),
        p50: p50.toFixed(2),
        p95: p95.toFixed(2),
        p99: p99.toFixed(2),
        min: sortedLatencies[0] || 0,
        max: sortedLatencies[sortedLatencies.length - 1] || 0,
      },
    };
  }

  printStats() {
    const stats = this.getStats();
    console.log('\n' + '='.repeat(80));
    console.log('                        PERFORMANCE METRICS');
    console.log('='.repeat(80));
    console.log(`Test Duration:        ${stats.duration.toFixed(2)}s`);
    console.log(`Total Requests:       ${stats.totalRequests}`);
    console.log(`Successful Requests:  ${stats.successfulRequests} (${stats.successRate}%)`);
    console.log(`Failed Requests:      ${stats.failedRequests}`);
    console.log(`Requests/Second:      ${stats.requestsPerSecond}`);
    console.log('');
    console.log(`Pixels Drawn:         ${stats.pixelsDrawn}`);
    console.log(`Pixels Failed:        ${stats.pixelsFailed}`);
    console.log(`Pixel Success Rate:   ${stats.pixelSuccessRate}%`);
    console.log('');
    console.log(`WS Connections:       ${stats.wsConnections}`);
    console.log(`WS Disconnections:    ${stats.wsDisconnections}`);
    console.log(`WS Messages Received: ${stats.wsMessagesReceived}`);
    console.log('');
    console.log('Latency:');
    console.log(`  Average:            ${stats.latency.avg}ms`);
    console.log(`  P50:                ${stats.latency.p50}ms`);
    console.log(`  P95:                ${stats.latency.p95}ms`);
    console.log(`  P99:                ${stats.latency.p99}ms`);
    console.log(`  Min:                ${stats.latency.min}ms`);
    console.log(`  Max:                ${stats.latency.max}ms`);

    if (Object.keys(stats.errors).length > 0) {
      console.log('');
      console.log('Errors:');
      Object.entries(stats.errors).forEach(([error, count]) => {
        console.log(`  ${error}: ${count}`);
      });
    }
    console.log('='.repeat(80));
  }

  saveToFile(filename) {
    const fs = require('fs');
    const stats = this.getStats();
    fs.writeFileSync(filename, JSON.stringify(stats, null, 2));
    console.log(`\nMetrics saved to: ${filename}`);
  }
}

// ==================== 工具函数 ====================

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function randomInt(min, max) {
  return Math.floor(randomBetween(min, max));
}

function randomCoordinate(region) {
  const lat = randomBetween(region.lat[0], region.lat[1]);
  const lng = randomBetween(region.lng[0], region.lng[1]);

  // 对齐到网格 (0.00001度精度)
  return {
    lat: Math.round(lat * 100000) / 100000,
    lng: Math.round(lng * 100000) / 100000,
  };
}

function randomColor() {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE'];
  return colors[randomInt(0, colors.length)];
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function log(...args) {
  if (options.verbose) {
    console.log(`[${new Date().toISOString()}]`, ...args);
  }
}

// ==================== 虚拟用户类 ====================

class VirtualUser {
  constructor(id, baseUrl, wsUrl, region, metrics) {
    this.id = id;
    this.userId = `load_test_user_${id}`;
    this.baseUrl = baseUrl;
    this.wsUrl = wsUrl;
    this.region = region;
    this.metrics = metrics;
    this.token = `test_token_${id}`;
    this.ws = null;
    this.active = true;
    this.pixelPoints = 100; // 初始点数
  }

  async run() {
    log(`User ${this.id} starting...`);

    try {
      // 1. 初始化用户状态
      await this.initializeUser();
      await sleep(randomInt(1000, 3000));

      // 2. 建立WebSocket连接
      await this.connectWebSocket();
      await sleep(randomInt(500, 1500));

      // 3. 主循环: 绘制像素
      while (this.active) {
        // 随机选择行为
        const action = Math.random();

        if (action < 0.7) {
          // 70% 概率: 单个像素绘制
          await this.drawSinglePixel();
          await sleep(randomInt(2000, 5000)); // 思考时间
        } else if (action < 0.9) {
          // 20% 概率: 批量绘制
          await this.drawBatchPixels(randomInt(3, 8));
          await sleep(randomInt(5000, 10000));
        } else {
          // 10% 概率: 休息
          await sleep(randomInt(10000, 20000));
        }

        // 随机重新订阅瓦片 (模拟移动地图)
        if (Math.random() < 0.1) {
          await this.resubscribeTiles();
        }
      }
    } catch (error) {
      log(`User ${this.id} error:`, error.message);
    } finally {
      this.cleanup();
    }
  }

  async initializeUser() {
    const startTime = Date.now();
    try {
      const response = await axios.post(`${this.baseUrl}/api/pixel/init`, {
        userId: this.userId,
      }, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      });

      const latency = Date.now() - startTime;
      this.metrics.recordRequest(true, latency);

      this.pixelPoints = response.data.totalPoints || 100;
      log(`User ${this.id} initialized: ${this.pixelPoints} points`);
    } catch (error) {
      const latency = Date.now() - startTime;
      this.metrics.recordRequest(false, latency, error);
      log(`User ${this.id} init failed:`, error.message);
    }
  }

  async drawSinglePixel() {
    if (this.pixelPoints <= 0) {
      log(`User ${this.id} has no pixel points`);
      return;
    }

    const coord = randomCoordinate(this.region);
    const color = randomColor();

    const startTime = Date.now();
    try {
      const response = await axios.post(`${this.baseUrl}/api/pixel`, {
        latitude: coord.lat,
        longitude: coord.lng,
        userId: this.userId,
        color: color,
        drawType: 'manual',
      }, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      const latency = Date.now() - startTime;
      const success = response.data.success === true;

      this.metrics.recordRequest(true, latency);
      this.metrics.recordPixelDraw(success);

      if (success) {
        this.pixelPoints--;
        log(`User ${this.id} drew pixel at (${coord.lat}, ${coord.lng})`);
      }
    } catch (error) {
      const latency = Date.now() - startTime;
      this.metrics.recordRequest(false, latency, error);
      this.metrics.recordPixelDraw(false);
      log(`User ${this.id} draw failed:`, error.message);
    }
  }

  async drawBatchPixels(count) {
    if (this.pixelPoints < count) {
      log(`User ${this.id} has insufficient points for batch draw`);
      return;
    }

    const pixels = [];
    for (let i = 0; i < count; i++) {
      const coord = randomCoordinate(this.region);
      pixels.push({
        latitude: coord.lat,
        longitude: coord.lng,
        color: randomColor(),
      });
    }

    const startTime = Date.now();
    try {
      const response = await axios.post(`${this.baseUrl}/api/pixels/batch`, {
        userId: this.userId,
        drawType: 'manual',
        pixels: pixels,
      }, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      });

      const latency = Date.now() - startTime;
      const success = response.data.success === true;

      this.metrics.recordRequest(true, latency);
      this.metrics.recordPixelDraw(success);

      if (success) {
        this.pixelPoints -= count;
        log(`User ${this.id} batch drew ${count} pixels`);
      }
    } catch (error) {
      const latency = Date.now() - startTime;
      this.metrics.recordRequest(false, latency, error);
      this.metrics.recordPixelDraw(false);
      log(`User ${this.id} batch draw failed:`, error.message);
    }
  }

  async connectWebSocket() {
    return new Promise((resolve) => {
      try {
        this.ws = new WebSocket(this.wsUrl);

        this.ws.on('open', () => {
          log(`User ${this.id} WebSocket connected`);
          this.metrics.recordWsConnection();

          // 订阅周围瓦片
          this.subscribeTiles();
          resolve();
        });

        this.ws.on('message', (data) => {
          this.metrics.recordWsMessage();
          try {
            const message = JSON.parse(data);
            if (message.type === 'pixel-update') {
              log(`User ${this.id} received pixel update`);
            }
          } catch (e) {
            // ignore
          }
        });

        this.ws.on('error', (error) => {
          log(`User ${this.id} WebSocket error:`, error.message);
        });

        this.ws.on('close', () => {
          log(`User ${this.id} WebSocket closed`);
          this.metrics.recordWsDisconnection();
        });

        // 心跳
        this.heartbeatInterval = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
          }
        }, 30000);
      } catch (error) {
        log(`User ${this.id} WebSocket connection failed:`, error.message);
        resolve();
      }
    });
  }

  subscribeTiles() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const centerCoord = randomCoordinate(this.region);
    const tiles = this.getTilesAroundCoord(centerCoord.lat, centerCoord.lng, 14);

    this.ws.send(JSON.stringify({
      type: 'subscribe-tiles',
      tiles: tiles,
    }));

    log(`User ${this.id} subscribed to ${tiles.length} tiles`);
  }

  async resubscribeTiles() {
    this.subscribeTiles();
    await sleep(100);
  }

  getTilesAroundCoord(lat, lng, zoom) {
    const centerTile = this.latLngToTile(lat, lng, zoom);
    const tiles = [];

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        tiles.push(`${zoom}/${centerTile.x + dx}/${centerTile.y + dy}`);
      }
    }

    return tiles;
  }

  latLngToTile(lat, lng, zoom) {
    const x = Math.floor((lng + 180) / 360 * Math.pow(2, zoom));
    const latRad = lat * Math.PI / 180;
    const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * Math.pow(2, zoom));
    return { x, y };
  }

  stop() {
    this.active = false;
  }

  cleanup() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.ws) {
      this.ws.close();
    }
    log(`User ${this.id} stopped`);
  }
}

// ==================== 主程序 ====================

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║        FunnyPixels Realistic User Behavior Simulator         ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Configuration:`);
  console.log(`  Users:           ${options.users}`);
  console.log(`  Duration:        ${options.duration}s`);
  console.log(`  Base URL:        ${options.baseUrl}`);
  console.log(`  WebSocket URL:   ${options.wsUrl}`);
  console.log(`  Test Region:     ${region.name}`);
  console.log(`  Lat Range:       [${region.lat[0]}, ${region.lat[1]}]`);
  console.log(`  Lng Range:       [${region.lng[0]}, ${region.lng[1]}]`);
  console.log('');

  const metrics = new MetricsCollector();
  const users = [];

  // 创建虚拟用户
  console.log(`Creating ${options.users} virtual users...`);
  for (let i = 0; i < parseInt(options.users); i++) {
    const user = new VirtualUser(i, options.baseUrl, options.wsUrl, region, metrics);
    users.push(user);
  }

  // 启动虚拟用户 (逐步启动，避免同时启动造成压力)
  console.log('Starting virtual users...');
  for (let i = 0; i < users.length; i++) {
    users[i].run().catch(err => {
      console.error(`User ${i} error:`, err.message);
    });
    await sleep(randomInt(100, 500)); // 错开启动时间
  }

  console.log(`All users started. Test will run for ${options.duration}s...`);
  console.log('Press Ctrl+C to stop early.\n');

  // 定期打印统计信息
  const statsInterval = setInterval(() => {
    const stats = metrics.getStats();
    console.log(`[${new Date().toISOString()}] ` +
      `Requests: ${stats.totalRequests} | ` +
      `Success: ${stats.successRate}% | ` +
      `Pixels: ${stats.pixelsDrawn} | ` +
      `Avg Latency: ${stats.latency.avg}ms | ` +
      `WS Msgs: ${stats.wsMessagesReceived}`
    );
  }, 10000); // 每10秒

  // 等待测试完成
  await sleep(parseInt(options.duration) * 1000);

  // 停止所有用户
  console.log('\nStopping all users...');
  users.forEach(user => user.stop());
  await sleep(5000); // 等待清理完成

  clearInterval(statsInterval);

  // 打印最终统计
  metrics.printStats();

  // 保存到文件
  if (options.output) {
    metrics.saveToFile(options.output);
  }

  console.log('\nTest completed!');
  process.exit(0);
}

// 处理中断信号
process.on('SIGINT', () => {
  console.log('\n\nReceived SIGINT, stopping test...');
  process.exit(0);
});

// 运行主程序
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
