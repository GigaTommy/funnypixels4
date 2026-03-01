/**
 * 功能测试脚本
 * 测试优化后的各个功能模块是否正常工作
 */

const axios = require('axios');
const WebSocket = require('ws');

class FeatureTest {
  constructor() {
    this.baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3001';
    this.wsUrl = process.env.TEST_WS_URL || 'ws://localhost:3001';
    this.jwt = process.env.TEST_JWT || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjgxMDJlMGZiLTkyMGUtNDE3ZS1hZTQwLTE3MWM3YzJkYmMxNSIsInVzZXJuYW1lIjoiYmJiIiwiZW1haWwiOiJiYmJAZXhhbXBsZS5jb20iLCJyb2xlIjoidXNlciIsImlhdCI6MTc1Nzg5MjU3MCwiZXhwIjoxNzU3ODk2MTcwfQ.MtXVSeiIG2OmlMgbo-rVLonrZWLaWIvli3P1DMWstFo';
    this.results = [];
  }
  
  /**
   * 运行所有功能测试
   */
  async runAllTests() {
    console.log('🚀 开始功能测试...');
    
    try {
      // 1. 手动绘制模式测试
      await this.testManualDrawing();
      
      // 2. GPS绘制模式测试
      await this.testGpsDrawing();
      
      // 3. 广告批量绘制测试
      await this.testAdBatchDrawing();
      
      // 4. 像素炸弹测试
      await this.testPixelBomb();
      
      // 5. 像素信息卡片测试
      await this.testPixelInfoCard();
      
      // 6. 生成测试报告
      this.generateReport();
      
    } catch (error) {
      console.error('❌ 功能测试失败:', error);
    }
  }
  
  /**
   * 测试手动绘制模式
   */
  async testManualDrawing() {
    console.log('🎨 测试手动绘制模式...');
    
    const testCases = [
      {
        name: '基础手动绘制',
        data: {
          lat: 39.9042,
          lng: 116.4074,
          patternId: 1,
          anchorX: 0,
          anchorY: 0,
          rotation: 0,
          mirror: false
        }
      },
      {
        name: '带图案的手动绘制',
        data: {
          lat: 39.9043,
          lng: 116.4075,
          patternId: 2,
          anchorX: 0.5,
          anchorY: 0.5,
          rotation: 45,
          mirror: true
        }
      }
    ];
    
    for (const testCase of testCases) {
      const result = await this.testManualDrawAPI(testCase.name, testCase.data);
      this.results.push(result);
    }
  }
  
  /**
   * 测试手动绘制API
   */
  async testManualDrawAPI(name, data) {
    try {
      const response = await axios.post(`${this.baseUrl}/api/pixel-draw/manual`, data, {
        headers: {
          'Authorization': `Bearer ${this.jwt}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      const result = {
        test: 'manual_drawing',
        name,
        success: response.data.success,
        status: response.status,
        data: response.data.data,
        error: response.data.error
      };
      
      console.log(`✅ ${name}: ${response.data.success ? '成功' : '失败'}`);
      return result;
      
    } catch (error) {
      const result = {
        test: 'manual_drawing',
        name,
        success: false,
        status: error.response?.status || 0,
        error: error.message
      };
      
      console.log(`❌ ${name}: ${error.message}`);
      return result;
    }
  }
  
  /**
   * 测试GPS绘制模式
   */
  async testGpsDrawing() {
    console.log('🎯 测试GPS绘制模式...');
    
    const testCases = [
      {
        name: '基础GPS绘制',
        data: {
          lat: 39.9044,
          lng: 116.4076,
          patternId: 1,
          anchorX: 0,
          anchorY: 0,
          rotation: 0,
          mirror: false
        }
      },
      {
        name: 'GPS轨迹绘制',
        data: {
          lat: 39.9045,
          lng: 116.4077,
          patternId: 3,
          anchorX: 0.5,
          anchorY: 0.5,
          rotation: 90,
          mirror: false
        }
      }
    ];
    
    for (const testCase of testCases) {
      const result = await this.testGpsDrawAPI(testCase.name, testCase.data);
      this.results.push(result);
    }
  }
  
  /**
   * 测试GPS绘制API
   */
  async testGpsDrawAPI(name, data) {
    try {
      const response = await axios.post(`${this.baseUrl}/api/pixel-draw/gps`, data, {
        headers: {
          'Authorization': `Bearer ${this.jwt}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      const result = {
        test: 'gps_drawing',
        name,
        success: response.data.success,
        status: response.status,
        data: response.data.data,
        error: response.data.error
      };
      
      console.log(`✅ ${name}: ${response.data.success ? '成功' : '失败'}`);
      return result;
      
    } catch (error) {
      const result = {
        test: 'gps_drawing',
        name,
        success: false,
        status: error.response?.status || 0,
        error: error.message
      };
      
      console.log(`❌ ${name}: ${error.message}`);
      return result;
    }
  }
  
  /**
   * 测试广告批量绘制
   */
  async testAdBatchDrawing() {
    console.log('📢 测试广告批量绘制...');
    
    const testCases = [
      {
        name: '小批量广告绘制',
        data: {
          pixels: [
            { lat: 39.9046, lng: 116.4078, patternId: 1, anchorX: 0, anchorY: 0, rotation: 0, mirror: false },
            { lat: 39.9047, lng: 116.4079, patternId: 1, anchorX: 0, anchorY: 0, rotation: 0, mirror: false },
            { lat: 39.9048, lng: 116.4080, patternId: 1, anchorX: 0, anchorY: 0, rotation: 0, mirror: false }
          ],
          drawType: 'ad'
        }
      },
      {
        name: '大批量广告绘制',
        data: {
          pixels: Array.from({ length: 10 }, (_, i) => ({
            lat: 39.9049 + i * 0.0001,
            lng: 116.4081 + i * 0.0001,
            patternId: 2,
            anchorX: 0.5,
            anchorY: 0.5,
            rotation: i * 30,
            mirror: i % 2 === 0
          })),
          drawType: 'ad'
        }
      }
    ];
    
    for (const testCase of testCases) {
      const result = await this.testBatchDrawAPI(testCase.name, testCase.data);
      this.results.push(result);
    }
  }
  
  /**
   * 测试批量绘制API
   */
  async testBatchDrawAPI(name, data) {
    try {
      const response = await axios.post(`${this.baseUrl}/api/pixel-draw/batch`, data, {
        headers: {
          'Authorization': `Bearer ${this.jwt}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });
      
      const result = {
        test: 'batch_drawing',
        name,
        success: response.data.success,
        status: response.status,
        data: response.data.data,
        error: response.data.error
      };
      
      console.log(`✅ ${name}: ${response.data.success ? '成功' : '失败'}`);
      return result;
      
    } catch (error) {
      const result = {
        test: 'batch_drawing',
        name,
        success: false,
        status: error.response?.status || 0,
        error: error.message
      };
      
      console.log(`❌ ${name}: ${error.message}`);
      return result;
    }
  }
  
  /**
   * 测试像素炸弹
   */
  async testPixelBomb() {
    console.log('💣 测试像素炸弹...');
    
    const testCases = [
      {
        name: '颜色炸弹',
        data: {
          centerLat: 39.9050,
          centerLng: 116.4082,
          bombType: 'color_bomb',
          areaSize: 6,
          color: '#FF0000'
        }
      },
      {
        name: '图案炸弹',
        data: {
          centerLat: 39.9051,
          centerLng: 116.4083,
          bombType: 'pattern_bomb',
          areaSize: 8,
          patternId: 1
        }
      }
    ];
    
    for (const testCase of testCases) {
      const result = await this.testBombAPI(testCase.name, testCase.data);
      this.results.push(result);
    }
  }
  
  /**
   * 测试炸弹API
   */
  async testBombAPI(name, data) {
    try {
      const response = await axios.post(`${this.baseUrl}/api/bomb/use`, data, {
        headers: {
          'Authorization': `Bearer ${this.jwt}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      const result = {
        test: 'pixel_bomb',
        name,
        success: response.data.success,
        status: response.status,
        data: response.data.data,
        error: response.data.error
      };
      
      console.log(`✅ ${name}: ${response.data.success ? '成功' : '失败'}`);
      return result;
      
    } catch (error) {
      const result = {
        test: 'pixel_bomb',
        name,
        success: false,
        status: error.response?.status || 0,
        error: error.message
      };
      
      console.log(`❌ ${name}: ${error.message}`);
      return result;
    }
  }
  
  /**
   * 测试像素信息卡片
   */
  async testPixelInfoCard() {
    console.log('📋 测试像素信息卡片...');
    
    const testCases = [
      {
        name: '获取像素详情',
        gridId: 'grid_1164074_399042'
      },
      {
        name: '获取不存在的像素',
        gridId: 'grid_999999_999999'
      }
    ];
    
    for (const testCase of testCases) {
      const result = await this.testPixelInfoAPI(testCase.name, testCase.gridId);
      this.results.push(result);
    }
  }
  
  /**
   * 测试像素信息API
   */
  async testPixelInfoAPI(name, gridId) {
    try {
      const response = await axios.get(`${this.baseUrl}/api/pixels/${gridId}`, {
        headers: {
          'Authorization': `Bearer ${this.jwt}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      const result = {
        test: 'pixel_info',
        name,
        success: response.data.success,
        status: response.status,
        data: response.data.data,
        error: response.data.error
      };
      
      console.log(`✅ ${name}: ${response.data.success ? '成功' : '失败'}`);
      return result;
      
    } catch (error) {
      const result = {
        test: 'pixel_info',
        name,
        success: false,
        status: error.response?.status || 0,
        error: error.message
      };
      
      console.log(`❌ ${name}: ${error.message}`);
      return result;
    }
  }
  
  /**
   * 测试WebSocket连接
   */
  async testWebSocketConnection() {
    console.log('📡 测试WebSocket连接...');
    
    return new Promise((resolve) => {
      const ws = new WebSocket(this.wsUrl);
      let connected = false;
      
      ws.on('open', () => {
        connected = true;
        console.log('✅ WebSocket连接成功');
        ws.close();
        resolve({ success: true, message: 'WebSocket连接正常' });
      });
      
      ws.on('error', (error) => {
        console.log('❌ WebSocket连接失败:', error.message);
        resolve({ success: false, message: error.message });
      });
      
      setTimeout(() => {
        if (!connected) {
          console.log('❌ WebSocket连接超时');
          resolve({ success: false, message: '连接超时' });
        }
      }, 5000);
    });
  }
  
  /**
   * 测试瓦片API
   */
  async testTileAPI() {
    console.log('🎨 测试瓦片API...');
    
    const testCases = [
      { z: 15, x: 100, y: 50 },
      { z: 16, x: 200, y: 100 },
      { z: 17, x: 400, y: 200 }
    ];
    
    for (const testCase of testCases) {
      try {
        const response = await axios.get(`${this.baseUrl}/api/tiles/${testCase.z}/${testCase.x}/${testCase.y}.png`, {
          timeout: 10000,
          responseType: 'arraybuffer'
        });
        
        const result = {
          test: 'tile_api',
          name: `瓦片${testCase.z}/${testCase.x}/${testCase.y}`,
          success: response.status === 200,
          status: response.status,
          size: response.data.length,
          error: null
        };
        
        console.log(`✅ 瓦片${testCase.z}/${testCase.x}/${testCase.y}: ${response.status === 200 ? '成功' : '失败'}`);
        this.results.push(result);
        
      } catch (error) {
        const result = {
          test: 'tile_api',
          name: `瓦片${testCase.z}/${testCase.x}/${testCase.y}`,
          success: false,
          status: error.response?.status || 0,
          size: 0,
          error: error.message
        };
        
        console.log(`❌ 瓦片${testCase.z}/${testCase.x}/${testCase.y}: ${error.message}`);
        this.results.push(result);
      }
    }
  }
  
  /**
   * 生成测试报告
   */
  generateReport() {
    console.log('\n📊 功能测试报告');
    console.log('================');
    
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
      const successCount = results.filter(r => r.success).length;
      const totalCount = results.length;
      const successRate = (successCount / totalCount * 100).toFixed(1);
      
      console.log(`  成功率: ${successRate}% (${successCount}/${totalCount})`);
      
      results.forEach(result => {
        const status = result.success ? '✅' : '❌';
        console.log(`  ${status} ${result.name}`);
        if (!result.success && result.error) {
          console.log(`    错误: ${result.error}`);
        }
      });
    });
    
    // 总体统计
    const totalSuccess = this.results.filter(r => r.success).length;
    const totalTests = this.results.length;
    const overallSuccessRate = (totalSuccess / totalTests * 100).toFixed(1);
    
    console.log(`\n总体成功率: ${overallSuccessRate}% (${totalSuccess}/${totalTests})`);
    
    // 保存详细报告
    this.saveDetailedReport();
  }
  
  /**
   * 保存详细报告
   */
  saveDetailedReport() {
    const report = {
      timestamp: new Date().toISOString(),
      totalTests: this.results.length,
      successCount: this.results.filter(r => r.success).length,
      results: this.results,
      summary: this.generateSummary()
    };
    
    const fs = require('fs');
    const path = require('path');
    const reportPath = path.join(__dirname, `feature-test-${Date.now()}.json`);
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 详细报告已保存: ${reportPath}`);
  }
  
  /**
   * 生成测试摘要
   */
  generateSummary() {
    const summary = {
      totalTests: this.results.length,
      successCount: this.results.filter(r => r.success).length,
      successRate: 0,
      testTypes: {}
    };
    
    summary.successRate = summary.totalTests > 0 ? 
      (summary.successCount / summary.totalTests * 100).toFixed(1) : 0;
    
    // 按测试类型统计
    this.results.forEach(result => {
      if (!summary.testTypes[result.test]) {
        summary.testTypes[result.test] = { total: 0, success: 0 };
      }
      summary.testTypes[result.test].total++;
      if (result.success) {
        summary.testTypes[result.test].success++;
      }
    });
    
    return summary;
  }
}

// 运行测试
if (require.main === module) {
  const test = new FeatureTest();
  test.runAllTests().catch(console.error);
}

module.exports = FeatureTest;
