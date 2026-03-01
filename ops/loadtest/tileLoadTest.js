/**
 * 瓦片性能负载测试
 * 测试瓦片渲染、WebSocket广播、数据库查询等性能
 */

const WebSocket = require('ws');
const axios = require('axios');
const { performance } = require('perf_hooks');

class TileLoadTest {
  constructor() {
    this.baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3001';
    this.wsUrl = process.env.TEST_WS_URL || 'ws://localhost:3001';
    this.results = [];
    this.connections = [];
    this.startTime = 0;
  }
  
  /**
   * 运行完整测试
   */
  async runFullTest() {
    console.log('🚀 开始瓦片性能完整测试...');
    this.startTime = performance.now();
    
    try {
      // 1. 瓦片加载性能测试
      await this.testTileLoading();
      
      // 2. WebSocket广播性能测试
      await this.testWebSocketBroadcast();
      
      // 3. 并发性能测试
      await this.testConcurrency();
      
      // 4. 内存压力测试
      await this.testMemoryPressure();
      
      // 5. 生成测试报告
      this.generateReport();
      
    } catch (error) {
      console.error('❌ 测试执行失败:', error);
    } finally {
      // 清理资源
      this.cleanup();
    }
  }
  
  /**
   * 测试瓦片加载性能
   */
  async testTileLoading() {
    console.log('📊 测试瓦片加载性能...');
    
    const testCases = [
      { name: '小范围瓦片', tiles: this.generateTileCoords(10, 15, 100, 105, 50, 55) },
      { name: '中范围瓦片', tiles: this.generateTileCoords(10, 15, 100, 110, 50, 60) },
      { name: '大范围瓦片', tiles: this.generateTileCoords(10, 15, 100, 120, 50, 70) }
    ];
    
    for (const testCase of testCases) {
      const result = await this.runTileLoadingTest(testCase.name, testCase.tiles);
      this.results.push(result);
    }
  }
  
  /**
   * 运行瓦片加载测试
   * @param name - 测试名称
   * @param tiles - 瓦片坐标数组
   * @returns 测试结果
   */
  async runTileLoadingTest(name, tiles) {
    const startTime = performance.now();
    const requests = tiles.map(({ z, x, y }) => this.loadTile(z, x, y));
    
    const results = await Promise.allSettled(requests);
    const endTime = performance.now();
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    const totalTime = endTime - startTime;
    const avgTime = totalTime / tiles.length;
    
    const result = {
      test: 'tile_loading',
      name,
      successCount: successful,
      failureCount: failed,
      totalRequests: tiles.length,
      totalTime,
      avgTime,
      successRate: successful / tiles.length
    };
    
    console.log(`✅ ${name}: 成功${successful}个, 失败${failed}个, 平均${avgTime.toFixed(2)}ms`);
    return result;
  }
  
  /**
   * 加载单个瓦片
   * @param z - 缩放级别
   * @param x - X坐标
   * @param y - Y坐标
   * @returns 加载结果
   */
  async loadTile(z, x, y) {
    const startTime = performance.now();
    try {
      const response = await axios.get(`${this.baseUrl}/api/tiles/${z}/${x}/${y}.png`, {
        timeout: 10000,
        responseType: 'arraybuffer'
      });
      const endTime = performance.now();
      
      return {
        success: true,
        time: endTime - startTime,
        size: response.data.length,
        status: response.status
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        status: error.response?.status
      };
    }
  }
  
  /**
   * 测试WebSocket广播性能
   */
  async testWebSocketBroadcast() {
    console.log('📡 测试WebSocket广播性能...');
    
    const testCases = [
      { name: '小规模广播', connections: 10, messages: 100 },
      { name: '中规模广播', connections: 50, messages: 500 },
      { name: '大规模广播', connections: 100, messages: 1000 }
    ];
    
    for (const testCase of testCases) {
      const result = await this.runWebSocketTest(testCase.name, testCase.connections, testCase.messages);
      this.results.push(result);
    }
  }
  
  /**
   * 运行WebSocket测试
   * @param name - 测试名称
   * @param connections - 连接数
   * @param messages - 消息数
   * @returns 测试结果
   */
  async runWebSocketTest(name, connections, messages) {
    const startTime = performance.now();
    
    // 创建WebSocket连接
    const wsConnections = [];
    for (let i = 0; i < connections; i++) {
      const ws = new WebSocket(this.wsUrl);
      wsConnections.push(ws);
    }
    
    // 等待连接建立
    await this.waitForConnections(wsConnections);
    
    // 发送测试消息
    const messagePromises = [];
    for (let i = 0; i < messages; i++) {
      const ws = wsConnections[i % connections];
      messagePromises.push(this.sendWebSocketMessage(ws, i));
    }
    
    await Promise.allSettled(messagePromises);
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    
    // 关闭连接
    wsConnections.forEach(ws => ws.close());
    
    const result = {
      test: 'websocket_broadcast',
      name,
      connections,
      messages,
      totalTime,
      avgTime: totalTime / messages,
      messagesPerSecond: messages / (totalTime / 1000)
    };
    
    console.log(`✅ ${name}: ${connections}连接, ${messages}消息, ${(messages / (totalTime / 1000)).toFixed(2)}msg/s`);
    return result;
  }
  
  /**
   * 等待WebSocket连接建立
   * @param connections - 连接数组
   * @returns Promise
   */
  async waitForConnections(connections) {
    return new Promise((resolve) => {
      let connected = 0;
      connections.forEach(ws => {
        ws.on('open', () => {
          connected++;
          if (connected === connections.length) {
            resolve();
          }
        });
      });
    });
  }
  
  /**
   * 发送WebSocket消息
   * @param ws - WebSocket连接
   * @param messageId - 消息ID
   * @returns Promise
   */
  async sendWebSocketMessage(ws, messageId) {
    return new Promise((resolve) => {
      const message = {
        type: 'pixel_update',
        data: {
          id: messageId,
          color: '#ff0000',
          timestamp: Date.now()
        }
      };
      
      ws.send(JSON.stringify(message));
      resolve();
    });
  }
  
  /**
   * 测试并发性能
   */
  async testConcurrency() {
    console.log('⚡ 测试并发性能...');
    
    const testCases = [
      { name: '低并发', users: 50, requestsPerUser: 10 },
      { name: '中并发', users: 100, requestsPerUser: 20 },
      { name: '高并发', users: 200, requestsPerUser: 30 }
    ];
    
    for (const testCase of testCases) {
      const result = await this.runConcurrencyTest(testCase.name, testCase.users, testCase.requestsPerUser);
      this.results.push(result);
    }
  }
  
  /**
   * 运行并发测试
   * @param name - 测试名称
   * @param users - 用户数
   * @param requestsPerUser - 每用户请求数
   * @returns 测试结果
   */
  async runConcurrencyTest(name, users, requestsPerUser) {
    const startTime = performance.now();
    
    const userPromises = [];
    for (let i = 0; i < users; i++) {
      userPromises.push(this.simulateUser(requestsPerUser));
    }
    
    const results = await Promise.allSettled(userPromises);
    const endTime = performance.now();
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    const totalTime = endTime - startTime;
    
    const result = {
      test: 'concurrency',
      name,
      users,
      requestsPerUser,
      successCount: successful,
      failureCount: failed,
      totalTime,
      avgTime: totalTime / users,
      requestsPerSecond: (users * requestsPerUser) / (totalTime / 1000)
    };
    
    console.log(`✅ ${name}: ${users}用户, 成功${successful}个, 失败${failed}个, ${(users * requestsPerUser / (totalTime / 1000)).toFixed(2)}req/s`);
    return result;
  }
  
  /**
   * 模拟用户行为
   * @param requestCount - 请求数量
   * @returns Promise
   */
  async simulateUser(requestCount) {
    const requests = [];
    for (let i = 0; i < requestCount; i++) {
      requests.push(this.loadTile(15, 100 + i, 50 + i));
    }
    return Promise.all(requests);
  }
  
  /**
   * 测试内存压力
   */
  async testMemoryPressure() {
    console.log('🧠 测试内存压力...');
    
    const startTime = performance.now();
    const memoryBefore = process.memoryUsage();
    
    // 创建大量瓦片请求
    const requests = [];
    for (let i = 0; i < 1000; i++) {
      requests.push(this.loadTile(15, 100 + (i % 10), 50 + (i % 10)));
    }
    
    await Promise.allSettled(requests);
    
    const endTime = performance.now();
    const memoryAfter = process.memoryUsage();
    
    const result = {
      test: 'memory_pressure',
      name: '内存压力测试',
      totalRequests: requests.length,
      totalTime: endTime - startTime,
      memoryBefore,
      memoryAfter,
      memoryDelta: {
        rss: memoryAfter.rss - memoryBefore.rss,
        heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed
      }
    };
    
    console.log(`✅ 内存压力测试: ${requests.length}请求, 内存增长${(result.memoryDelta.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    this.results.push(result);
  }
  
  /**
   * 生成瓦片坐标
   * @param minZ - 最小缩放级别
   * @param maxZ - 最大缩放级别
   * @param minX - 最小X坐标
   * @param maxX - 最大X坐标
   * @param minY - 最小Y坐标
   * @param maxY - 最大Y坐标
   * @returns 瓦片坐标数组
   */
  generateTileCoords(minZ, maxZ, minX, maxX, minY, maxY) {
    const coords = [];
    for (let z = minZ; z <= maxZ; z++) {
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          coords.push({ z, x, y });
        }
      }
    }
    return coords;
  }
  
  /**
   * 生成测试报告
   */
  generateReport() {
    const totalTime = performance.now() - this.startTime;
    
    console.log('\n📈 瓦片性能测试报告');
    console.log('====================');
    console.log(`总测试时间: ${(totalTime / 1000).toFixed(2)}秒`);
    console.log(`测试项目: ${this.results.length}个`);
    
    // 按测试类型分组
    const groupedResults = this.results.reduce((acc, result) => {
      if (!acc[result.test]) {
        acc[result.test] = [];
      }
      acc[result.test].push(result);
      return acc;
    }, {});
    
    // 输出各类型测试结果
    Object.entries(groupedResults).forEach(([testType, results]) => {
      console.log(`\n${testType.toUpperCase()}:`);
      results.forEach(result => {
        console.log(`  ${result.name}:`);
        if (result.successCount !== undefined) {
          console.log(`    成功率: ${(result.successRate * 100).toFixed(2)}%`);
        }
        if (result.avgTime !== undefined) {
          console.log(`    平均时间: ${result.avgTime.toFixed(2)}ms`);
        }
        if (result.requestsPerSecond !== undefined) {
          console.log(`    吞吐量: ${result.requestsPerSecond.toFixed(2)}req/s`);
        }
        if (result.messagesPerSecond !== undefined) {
          console.log(`    消息速率: ${result.messagesPerSecond.toFixed(2)}msg/s`);
        }
        if (result.memoryDelta) {
          console.log(`    内存增长: ${(result.memoryDelta.heapUsed / 1024 / 1024).toFixed(2)}MB`);
        }
      });
    });
    
    // 保存详细报告
    this.saveDetailedReport();
  }
  
  /**
   * 保存详细报告
   */
  saveDetailedReport() {
    const report = {
      timestamp: new Date().toISOString(),
      totalTime: performance.now() - this.startTime,
      results: this.results,
      summary: this.generateSummary()
    };
    
    const fs = require('fs');
    const path = require('path');
    const reportPath = path.join(__dirname, `tile-load-test-${Date.now()}.json`);
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 详细报告已保存: ${reportPath}`);
  }
  
  /**
   * 生成测试摘要
   * @returns 测试摘要
   */
  generateSummary() {
    const summary = {
      totalTests: this.results.length,
      successRate: 0,
      avgResponseTime: 0,
      maxThroughput: 0
    };
    
    let totalSuccess = 0;
    let totalRequests = 0;
    let totalTime = 0;
    let maxThroughput = 0;
    
    this.results.forEach(result => {
      if (result.successCount !== undefined) {
        totalSuccess += result.successCount;
        totalRequests += result.totalRequests || result.requestsPerUser * result.users || 0;
      }
      if (result.avgTime !== undefined) {
        totalTime += result.avgTime;
      }
      if (result.requestsPerSecond !== undefined) {
        maxThroughput = Math.max(maxThroughput, result.requestsPerSecond);
      }
    });
    
    summary.successRate = totalRequests > 0 ? totalSuccess / totalRequests : 0;
    summary.avgResponseTime = this.results.length > 0 ? totalTime / this.results.length : 0;
    summary.maxThroughput = maxThroughput;
    
    return summary;
  }
  
  /**
   * 清理资源
   */
  cleanup() {
    this.connections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });
    this.connections = [];
  }
}

// 运行测试
if (require.main === module) {
  const test = new TileLoadTest();
  test.runFullTest().catch(console.error);
}

module.exports = TileLoadTest;
