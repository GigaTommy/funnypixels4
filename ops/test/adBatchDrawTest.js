/**
 * 广告批量绘制功能测试
 * 测试广告批量绘制的接口调用逻辑和功能
 */

const axios = require('axios');

class AdBatchDrawTest {
  constructor() {
    this.baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3001';
    this.jwt = process.env.TEST_JWT || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjgxMDJlMGZiLTkyMGUtNDE3ZS1hZTQwLTE3MWM3YzJkYmMxNSIsInVzZXJuYW1lIjoiYmJiIiwiZW1haWwiOiJiYmJAZXhhbXBsZS5jb20iLCJyb2xlIjoidXNlciIsImlhdCI6MTc1NzkyNDgxNywiZXhwIjoxNzU3OTI4NDE3fQ.ZeBF36CFjwBahB3YG5P5KDJSu5Z4w47j_tug3W7yxu0';
    this.results = [];
  }

  /**
   * 运行广告批量绘制测试
   */
  async runTest() {
    console.log('🚀 开始广告批量绘制功能测试...');
    
    try {
      // 1. 测试小批量广告绘制
      await this.testSmallBatchAdDraw();
      
      // 2. 测试大批量广告绘制
      await this.testLargeBatchAdDraw();
      
      // 3. 测试边界情况
      await this.testEdgeCases();
      
      // 4. 生成测试报告
      this.generateReport();
      
    } catch (error) {
      console.error('❌ 广告批量绘制测试失败:', error);
    }
  }

  /**
   * 测试小批量广告绘制
   */
  async testSmallBatchAdDraw() {
    console.log('📢 测试小批量广告绘制...');
    
    const testData = {
      pixels: [
        { lat: 39.9046, lng: 116.4078, patternId: 1, anchorX: 0, anchorY: 0, rotation: 0, mirror: false },
        { lat: 39.9047, lng: 116.4079, patternId: 1, anchorX: 0, anchorY: 0, rotation: 0, mirror: false },
        { lat: 39.9048, lng: 116.4080, patternId: 1, anchorX: 0, anchorY: 0, rotation: 0, mirror: false }
      ],
      drawType: 'ad'
    };

    const result = await this.testBatchDrawAPI('小批量广告绘制', testData);
    this.results.push(result);
  }

  /**
   * 测试大批量广告绘制
   */
  async testLargeBatchAdDraw() {
    console.log('📢 测试大批量广告绘制...');
    
    const pixels = Array.from({ length: 10 }, (_, i) => ({
      lat: 39.9049 + i * 0.0001,
      lng: 116.4081 + i * 0.0001,
      patternId: 2,
      anchorX: 0.5,
      anchorY: 0.5,
      rotation: i * 30,
      mirror: i % 2 === 0
    }));

    const testData = {
      pixels,
      drawType: 'ad'
    };

    const result = await this.testBatchDrawAPI('大批量广告绘制', testData);
    this.results.push(result);
  }

  /**
   * 测试边界情况
   */
  async testEdgeCases() {
    console.log('📢 测试边界情况...');
    
    // 测试空数组
    const emptyArrayResult = await this.testBatchDrawAPI('空数组测试', {
      pixels: [],
      drawType: 'ad'
    });
    this.results.push(emptyArrayResult);

    // 测试超过100个像素
    const largeArrayResult = await this.testBatchDrawAPI('超过100个像素测试', {
      pixels: Array.from({ length: 101 }, (_, i) => ({
        lat: 39.9050 + i * 0.0001,
        lng: 116.4082 + i * 0.0001,
        patternId: 1
      })),
      drawType: 'ad'
    });
    this.results.push(largeArrayResult);

    // 测试无效数据
    const invalidDataResult = await this.testBatchDrawAPI('无效数据测试', {
      pixels: [
        { lat: 'invalid', lng: 116.4083, patternId: 1 },
        { lat: 39.9051, lng: 'invalid', patternId: 1 }
      ],
      drawType: 'ad'
    });
    this.results.push(invalidDataResult);
  }

  /**
   * 测试批量绘制API
   */
  async testBatchDrawAPI(name, data) {
    try {
      console.log(`  🔍 测试: ${name}`);
      
      const response = await axios.post(`${this.baseUrl}/api/pixel-draw/batch`, data, {
        headers: {
          'Authorization': `Bearer ${this.jwt}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });

      const result = {
        test: 'ad_batch_draw',
        name,
        success: response.data.success,
        status: response.status,
        data: response.data.data,
        error: response.data.error,
        responseTime: response.headers['x-response-time'] || 'N/A'
      };

      console.log(`  ✅ ${name}: ${response.data.success ? '成功' : '失败'}`);
      if (response.data.data) {
        console.log(`    📊 总像素: ${response.data.data.totalPixels || 'N/A'}`);
        console.log(`    ✅ 成功: ${response.data.data.successCount || 'N/A'}`);
        console.log(`    ❌ 失败: ${response.data.data.failureCount || 'N/A'}`);
        console.log(`    ⏱️ 处理时间: ${response.data.data.processingTime || 'N/A'}ms`);
      }
      
      return result;

    } catch (error) {
      const result = {
        test: 'ad_batch_draw',
        name,
        success: false,
        status: error.response?.status || 0,
        error: error.message,
        responseTime: 'N/A'
      };

      console.log(`  ❌ ${name}: ${error.message}`);
      if (error.response?.data) {
        console.log(`    📝 错误详情: ${JSON.stringify(error.response.data)}`);
      }
      
      return result;
    }
  }

  /**
   * 生成测试报告
   */
  generateReport() {
    console.log('\n📊 广告批量绘制测试报告');
    console.log('========================');
    
    const successCount = this.results.filter(r => r.success).length;
    const totalCount = this.results.length;
    const successRate = (successCount / totalCount * 100).toFixed(1);
    
    console.log(`总体成功率: ${successRate}% (${successCount}/${totalCount})`);
    console.log('');
    
    this.results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${result.name}`);
      if (!result.success && result.error) {
        console.log(`  错误: ${result.error}`);
      }
      if (result.data && result.data.processingTime) {
        console.log(`  处理时间: ${result.data.processingTime}ms`);
      }
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
      testType: 'ad_batch_draw',
      totalTests: this.results.length,
      successCount: this.results.filter(r => r.success).length,
      successRate: (this.results.filter(r => r.success).length / this.results.length * 100).toFixed(1),
      results: this.results
    };
    
    const fs = require('fs');
    const path = require('path');
    const reportPath = path.join(__dirname, `ad-batch-draw-test-${Date.now()}.json`);
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 详细报告已保存: ${reportPath}`);
  }
}

// 运行测试
if (require.main === module) {
  const test = new AdBatchDrawTest();
  test.runTest().catch(console.error);
}

module.exports = AdBatchDrawTest;
