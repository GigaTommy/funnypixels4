/**
 * FunnyPixels 混合流量模拟器
 *
 * 模拟真实的用户流量分布:
 * - 60% 休闲用户 (Casual Users)
 * - 30% 活跃用户 (Active Users)
 * - 10% 艺术家用户 (Artist Users)
 *
 * 使用方法:
 * node scenarios/mixed-traffic-simulator.js --users 100 --duration 600
 */

const axios = require('axios');
const WebSocket = require('ws');
const { Command } = require('commander');

// ==================== 配置 ====================

const program = new Command();
program
  .option('-u, --users <number>', '并发用户数', '100')
  .option('-d, --duration <seconds>', '测试持续时间(秒)', '600')
  .option('-b, --base-url <url>', 'API基础URL', 'http://localhost:3001')
  .option('-w, --ws-url <url>', 'WebSocket URL', 'ws://localhost:3001/ws/tile-updates')
  .option('-o, --output <file>', '输出报告文件', null)
  .option('--verbose', '详细日志', false)
  .parse(process.argv);

const options = program.opts();

const TOTAL_USERS = parseInt(options.users);
const DURATION = parseInt(options.duration) * 1000; // 转换为毫秒
const BASE_URL = options.baseUrl;
const WS_URL = options.wsUrl;
const VERBOSE = options.verbose;

// 用户类型分布
const USER_DISTRIBUTION = {
  casual: 0.60,   // 60%
  active: 0.30,   // 30%
  artist: 0.10    // 10%
};

// 用户行为配置
const USER_BEHAVIORS = {
  casual: {
    drawInterval: [30000, 60000],      // 30-60秒绘制一次
    pixelsPerSession: [1, 3],          // 每次1-3个像素
    sessionDuration: [60000, 180000],  // 会话1-3分钟
    browseRatio: 0.7,                  // 70%时间在浏览
    socialRatio: 0.2                   // 20%时间社交互动
  },
  active: {
    drawInterval: [10000, 20000],      // 10-20秒绘制一次
    pixelsPerSession: [3, 8],          // 每次3-8个像素
    sessionDuration: [180000, 600000], // 会话3-10分钟
    browseRatio: 0.4,
    socialRatio: 0.4
  },
  artist: {
    drawInterval: [5000, 10000],       // 5-10秒绘制一次
    pixelsPerSession: [10, 30],        // 每次10-30个像素
    sessionDuration: [600000, 1800000],// 会话10-30分钟
    browseRatio: 0.2,
    socialRatio: 0.3
  }
};

// ==================== 性能指标 ====================

const metrics = {
  users: {
    total: 0,
    casual: 0,
    active: 0,
    artist: 0,
    active_count: 0
  },
  requests: {
    total: 0,
    success: 0,
    failure: 0
  },
  pixels: {
    drawn: 0,
    failed: 0
  },
  websocket: {
    connections: 0,
    disconnections: 0,
    messages_sent: 0,
    messages_received: 0
  },
  latency: {
    draw: [],
    browse: [],
    social: []
  },
  errors: {
    network: 0,
    auth: 0,
    conflict: 0,
    server: 0
  }
};

// ==================== 工具函数 ====================

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function randomColor() {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE'];
  return colors[randomInt(0, colors.length - 1)];
}

function randomCoordinate() {
  // 北京区域
  return {
    lat: randomFloat(39.88, 39.92),
    lng: randomFloat(116.38, 116.42)
  };
}

function log(message, level = 'info') {
  if (!VERBOSE && level === 'debug') return;

  const timestamp = new Date().toISOString();
  const prefix = {
    info: '📝',
    debug: '🔍',
    error: '❌',
    success: '✅',
    warn: '⚠️'
  }[level] || '📝';

  console.log(`${prefix} [${timestamp}] ${message}`);
}

// ==================== 用户模拟类 ====================

class SimulatedUser {
  constructor(id, persona) {
    this.id = id;
    this.persona = persona;
    this.behavior = USER_BEHAVIORS[persona];
    this.token = null;
    this.ws = null;
    this.active = true;
    this.stats = {
      pixels_drawn: 0,
      requests_sent: 0,
      errors: 0
    };

    metrics.users[persona]++;
    metrics.users.total++;
  }

  async start() {
    try {
      // 1. 登录
      await this.login();

      // 2. 建立WebSocket连接
      await this.connectWebSocket();

      // 3. 开始用户会话循环
      await this.sessionLoop();

    } catch (error) {
      log(`用户 ${this.id} 启动失败: ${error.message}`, 'error');
      metrics.errors.network++;
    }
  }

  async login() {
    try {
      const response = await axios.post(`${BASE_URL}/api/auth/login`, {
        email: `simuser_${this.id}@example.com`,
        password: 'TestPassword123!'
      }, {
        timeout: 10000
      });

      this.token = response.data.token || `mock_token_${this.id}`;
      log(`用户 ${this.id} (${this.persona}) 登录成功`, 'debug');

      metrics.requests.total++;
      metrics.requests.success++;

    } catch (error) {
      log(`用户 ${this.id} 登录失败: ${error.message}`, 'warn');
      this.token = `mock_token_${this.id}`; // 使用模拟token继续
      metrics.requests.total++;
      metrics.requests.failure++;
      metrics.errors.auth++;
    }
  }

  async connectWebSocket() {
    return new Promise((resolve) => {
      try {
        this.ws = new WebSocket(WS_URL);

        this.ws.on('open', () => {
          log(`用户 ${this.id} WebSocket连接已建立`, 'debug');
          metrics.websocket.connections++;

          // 订阅瓦片更新
          const subscribeMsg = JSON.stringify({
            type: 'subscribe',
            userId: this.id,
            tileId: `tile_${randomInt(1, 100)}`
          });

          this.ws.send(subscribeMsg);
          metrics.websocket.messages_sent++;

          resolve();
        });

        this.ws.on('message', (data) => {
          metrics.websocket.messages_received++;
          log(`用户 ${this.id} 收到消息`, 'debug');
        });

        this.ws.on('error', (error) => {
          log(`用户 ${this.id} WebSocket错误: ${error.message}`, 'warn');
          metrics.errors.network++;
        });

        this.ws.on('close', () => {
          log(`用户 ${this.id} WebSocket连接已关闭`, 'debug');
          metrics.websocket.disconnections++;
        });

        // 超时处理
        setTimeout(resolve, 5000);

      } catch (error) {
        log(`用户 ${this.id} WebSocket连接失败: ${error.message}`, 'warn');
        resolve();
      }
    });
  }

  async sessionLoop() {
    const sessionDuration = randomInt(...this.behavior.sessionDuration);
    const sessionEnd = Date.now() + sessionDuration;

    log(`用户 ${this.id} 开始会话 (${this.persona}), 时长: ${sessionDuration / 1000}秒`, 'debug');
    metrics.users.active_count++;

    while (this.active && Date.now() < sessionEnd) {
      const action = this.selectAction();

      try {
        switch (action) {
          case 'draw':
            await this.drawPixels();
            break;
          case 'browse':
            await this.browseMap();
            break;
          case 'social':
            await this.socialInteraction();
            break;
        }
      } catch (error) {
        log(`用户 ${this.id} 操作失败 (${action}): ${error.message}`, 'warn');
        this.stats.errors++;
      }

      // 思考时间
      const thinkTime = randomInt(...this.behavior.drawInterval);
      await new Promise(resolve => setTimeout(resolve, thinkTime));
    }

    metrics.users.active_count--;
    log(`用户 ${this.id} 会话结束`, 'debug');

    // 关闭WebSocket
    if (this.ws) {
      this.ws.close();
    }
  }

  selectAction() {
    const rand = Math.random();

    if (rand < this.behavior.browseRatio) {
      return 'browse';
    } else if (rand < this.behavior.browseRatio + this.behavior.socialRatio) {
      return 'social';
    } else {
      return 'draw';
    }
  }

  async drawPixels() {
    const pixelCount = randomInt(...this.behavior.pixelsPerSession);
    const startTime = Date.now();

    try {
      for (let i = 0; i < pixelCount; i++) {
        const coord = randomCoordinate();
        const color = randomColor();

        await axios.post(`${BASE_URL}/api/pixel`, {
          latitude: coord.lat,
          longitude: coord.lng,
          userId: this.id,
          color: color,
          drawType: 'manual'
        }, {
          headers: { 'Authorization': `Bearer ${this.token}` },
          timeout: 10000
        });

        this.stats.pixels_drawn++;
        metrics.pixels.drawn++;
        metrics.requests.total++;
        metrics.requests.success++;
      }

      const duration = Date.now() - startTime;
      metrics.latency.draw.push(duration);

      log(`用户 ${this.id} 绘制了 ${pixelCount} 个像素`, 'debug');

    } catch (error) {
      metrics.pixels.failed += pixelCount;
      metrics.requests.total++;
      metrics.requests.failure++;

      if (error.response?.status === 409) {
        metrics.errors.conflict++;
      } else if (error.response?.status >= 500) {
        metrics.errors.server++;
      } else {
        metrics.errors.network++;
      }

      throw error;
    }
  }

  async browseMap() {
    const startTime = Date.now();

    try {
      const coord = randomCoordinate();
      const zoom = randomInt(12, 16);
      const tileX = Math.floor(coord.lng);
      const tileY = Math.floor(coord.lat);

      await axios.get(`${BASE_URL}/api/tiles/${zoom}/${tileX}/${tileY}.mvt`, {
        headers: { 'Authorization': `Bearer ${this.token}` },
        timeout: 10000,
        responseType: 'arraybuffer'
      });

      const duration = Date.now() - startTime;
      metrics.latency.browse.push(duration);

      metrics.requests.total++;
      metrics.requests.success++;

      log(`用户 ${this.id} 浏览地图`, 'debug');

    } catch (error) {
      metrics.requests.total++;
      metrics.requests.failure++;
      throw error;
    }
  }

  async socialInteraction() {
    const startTime = Date.now();

    try {
      // 查看排行榜
      await axios.get(`${BASE_URL}/api/leaderboard?type=weekly`, {
        headers: { 'Authorization': `Bearer ${this.token}` },
        timeout: 10000
      });

      // 查看个人统计
      await axios.get(`${BASE_URL}/api/user/${this.id}/stats`, {
        headers: { 'Authorization': `Bearer ${this.token}` },
        timeout: 10000
      });

      const duration = Date.now() - startTime;
      metrics.latency.social.push(duration);

      metrics.requests.total += 2;
      metrics.requests.success += 2;

      log(`用户 ${this.id} 社交互动`, 'debug');

    } catch (error) {
      metrics.requests.total += 2;
      metrics.requests.failure += 2;
      throw error;
    }
  }

  stop() {
    this.active = false;
    if (this.ws) {
      this.ws.close();
    }
  }
}

// ==================== 用户类型选择 ====================

function selectUserPersona() {
  const rand = Math.random();

  if (rand < USER_DISTRIBUTION.casual) {
    return 'casual';
  } else if (rand < USER_DISTRIBUTION.casual + USER_DISTRIBUTION.active) {
    return 'active';
  } else {
    return 'artist';
  }
}

// ==================== 统计计算 ====================

function calculateStats() {
  const successRate = (metrics.requests.success / metrics.requests.total * 100).toFixed(2);
  const pixelSuccessRate = (metrics.pixels.drawn / (metrics.pixels.drawn + metrics.pixels.failed) * 100).toFixed(2);

  const avgDrawLatency = metrics.latency.draw.length > 0
    ? (metrics.latency.draw.reduce((a, b) => a + b, 0) / metrics.latency.draw.length).toFixed(2)
    : 0;

  const p95DrawLatency = metrics.latency.draw.length > 0
    ? metrics.latency.draw.sort((a, b) => a - b)[Math.floor(metrics.latency.draw.length * 0.95)]
    : 0;

  return {
    successRate,
    pixelSuccessRate,
    avgDrawLatency,
    p95DrawLatency
  };
}

// ==================== 主函数 ====================

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('🎨 FunnyPixels 混合流量模拟器');
  console.log('='.repeat(70));
  console.log(`\n配置:`);
  console.log(`  并发用户: ${TOTAL_USERS}`);
  console.log(`  测试时长: ${DURATION / 1000}秒`);
  console.log(`  基础URL: ${BASE_URL}`);
  console.log(`  WebSocket: ${WS_URL}`);
  console.log(`\n用户分布:`);
  console.log(`  休闲用户: ${(USER_DISTRIBUTION.casual * 100).toFixed(0)}%`);
  console.log(`  活跃用户: ${(USER_DISTRIBUTION.active * 100).toFixed(0)}%`);
  console.log(`  艺术家: ${(USER_DISTRIBUTION.artist * 100).toFixed(0)}%`);
  console.log('='.repeat(70) + '\n');

  const startTime = Date.now();
  const users = [];

  // 创建并启动用户
  log(`启动 ${TOTAL_USERS} 个模拟用户...`, 'info');

  for (let i = 0; i < TOTAL_USERS; i++) {
    const persona = selectUserPersona();
    const user = new SimulatedUser(`sim_${i}`, persona);
    users.push(user);

    // 异步启动，避免阻塞
    user.start().catch(err => {
      log(`用户 ${user.id} 异常: ${err.message}`, 'error');
    });

    // 分批启动，避免雪崩
    if ((i + 1) % 50 === 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      log(`已启动 ${i + 1} 个用户...`, 'info');
    }
  }

  log('所有用户已启动', 'success');

  // 定期打印统计
  const statsInterval = setInterval(() => {
    const stats = calculateStats();
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);

    console.log('\n' + '-'.repeat(70));
    console.log(`⏱️  运行时间: ${elapsed}秒 | 活跃用户: ${metrics.users.active_count}`);
    console.log(`📊 请求: ${metrics.requests.total} (成功: ${stats.successRate}%)`);
    console.log(`🎨 像素: ${metrics.pixels.drawn} (成功率: ${stats.pixelSuccessRate}%)`);
    console.log(`⏱️  延迟: 平均 ${stats.avgDrawLatency}ms, P95 ${stats.p95DrawLatency}ms`);
    console.log(`🔌 WebSocket: 连接 ${metrics.websocket.connections}, 消息 ${metrics.websocket.messages_received}`);
    console.log('-'.repeat(70));

  }, 10000); // 每10秒打印一次

  // 等待测试完成
  await new Promise(resolve => setTimeout(resolve, DURATION));

  // 停止所有用户
  log('停止所有用户...', 'info');
  users.forEach(user => user.stop());

  clearInterval(statsInterval);

  // 最终报告
  const finalStats = calculateStats();
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n' + '='.repeat(70));
  console.log('📊 测试完成 - 最终报告');
  console.log('='.repeat(70));
  console.log(`\n⏱️  总耗时: ${totalTime}秒`);
  console.log(`\n👥 用户统计:`);
  console.log(`  总用户数: ${metrics.users.total}`);
  console.log(`  休闲用户: ${metrics.users.casual}`);
  console.log(`  活跃用户: ${metrics.users.active}`);
  console.log(`  艺术家: ${metrics.users.artist}`);
  console.log(`\n📊 请求统计:`);
  console.log(`  总请求数: ${metrics.requests.total}`);
  console.log(`  成功请求: ${metrics.requests.success} (${finalStats.successRate}%)`);
  console.log(`  失败请求: ${metrics.requests.failure}`);
  console.log(`\n🎨 像素统计:`);
  console.log(`  绘制成功: ${metrics.pixels.drawn}`);
  console.log(`  绘制失败: ${metrics.pixels.failed}`);
  console.log(`  成功率: ${finalStats.pixelSuccessRate}%`);
  console.log(`\n⏱️  延迟统计:`);
  console.log(`  平均延迟: ${finalStats.avgDrawLatency}ms`);
  console.log(`  P95延迟: ${finalStats.p95DrawLatency}ms`);
  console.log(`\n🔌 WebSocket统计:`);
  console.log(`  连接数: ${metrics.websocket.connections}`);
  console.log(`  断开数: ${metrics.websocket.disconnections}`);
  console.log(`  发送消息: ${metrics.websocket.messages_sent}`);
  console.log(`  接收消息: ${metrics.websocket.messages_received}`);
  console.log(`\n❌ 错误统计:`);
  console.log(`  网络错误: ${metrics.errors.network}`);
  console.log(`  认证错误: ${metrics.errors.auth}`);
  console.log(`  冲突错误: ${metrics.errors.conflict}`);
  console.log(`  服务器错误: ${metrics.errors.server}`);
  console.log('='.repeat(70) + '\n');

  // 保存报告
  if (options.output) {
    const report = {
      timestamp: new Date().toISOString(),
      duration: totalTime,
      configuration: {
        total_users: TOTAL_USERS,
        base_url: BASE_URL,
        ws_url: WS_URL
      },
      metrics: metrics,
      statistics: finalStats
    };

    const fs = require('fs');
    fs.writeFileSync(options.output, JSON.stringify(report, null, 2));
    log(`报告已保存到: ${options.output}`, 'success');
  }

  process.exit(0);
}

// ==================== 启动 ====================

main().catch(error => {
  log(`测试失败: ${error.message}`, 'error');
  console.error(error);
  process.exit(1);
});
