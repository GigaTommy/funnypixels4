const axios = require('axios');

class ManualDrawTest {
  constructor() {
    this.baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3001';
    this.jwt = process.env.TEST_JWT || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjgxMDJlMGZiLTkyMGUtNDE3ZS1hZTQwLTE3MWM3YzJkYmMxNSIsInVzZXJuYW1lIjoiYmJiIiwiZW1haWwiOiJiYmJAZXhhbXBsZS5jb20iLCJyb2xlIjoidXNlciIsImlhdCI6MTc1NzkyNDgxNywiZXhwIjoxNzU3OTI4NDE3fQ.ZeBF36CFjwBahB3YG5P5KDJSu5Z4w47j_tug3W7yxu0';
    this.results = [];
  }

  /**
   * 运行手动绘制测试
   */
  async runTests() {
    console.log('🚀 开始手动绘制功能测试...');
    
    try {
      // 测试1: 基本手动绘制
      await this.testBasicManualDraw();
      await this.delay(200); // 等待200ms避免冷却
      
      // 测试2: 带图案的手动绘制
      await this.testPatternManualDraw();
      await this.delay(200); // 等待200ms避免冷却
      
      // 测试3: 边界坐标测试
      await this.testBoundaryCoordinates();
      await this.delay(200); // 等待200ms避免冷却
      
      // 测试4: 无效数据测试
      await this.testInvalidData();
      
      // 生成报告
      this.generateReport();
      
    } catch (error) {
      console.error('❌ 测试过程中发生错误:', error);
    }
  }

  /**
   * 延迟函数
   */
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 测试基本手动绘制
   */
  async testBasicManualDraw() {
    console.log('  🔍 测试: 基本手动绘制');
    
    try {
      const response = await axios.post(`${this.baseUrl}/api/pixel-draw/manual`, {
        lat: 39.9042,
        lng: 116.4074,
        color: '#FF0000',
        patternId: 'color_red'
      }, {
        headers: {
          'Authorization': `Bearer ${this.jwt}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.success) {
        console.log('  ✅ 基本手动绘制: 成功');
        console.log(`    📍 坐标: (${response.data.data.pixel?.latitude}, ${response.data.data.pixel?.longitude})`);
        console.log(`    🎨 颜色: ${response.data.data.pixel?.color}`);
        console.log(`    ⏱️ 处理时间: ${response.data.data.processingTime}ms`);
        
        this.results.push({
          test: '基本手动绘制',
          success: true,
          processingTime: response.data.data.processingTime,
          details: response.data.data
        });
      } else {
        console.log('  ❌ 基本手动绘制: 失败');
        console.log(`    📝 错误: ${response.data.error}`);
        
        this.results.push({
          test: '基本手动绘制',
          success: false,
          error: response.data.error
        });
      }
    } catch (error) {
      console.log('  ❌ 基本手动绘制: 请求失败');
      console.log(`    📝 错误详情: ${JSON.stringify(error.response?.data || error.message)}`);
      
      this.results.push({
        test: '基本手动绘制',
        success: false,
        error: error.response?.data || error.message
      });
    }
  }

  /**
   * 测试带图案的手动绘制
   */
  async testPatternManualDraw() {
    console.log('  🔍 测试: 带图案的手动绘制');
    
    try {
      const response = await axios.post(`${this.baseUrl}/api/pixel-draw/manual`, {
        lat: 39.9043,
        lng: 116.4075,
        color: '#00FF00',
        patternId: 'pattern_heart',
        anchorX: 0,
        anchorY: 0,
        rotation: 0,
        mirror: false
      }, {
        headers: {
          'Authorization': `Bearer ${this.jwt}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.success) {
        console.log('  ✅ 带图案的手动绘制: 成功');
        console.log(`    📍 坐标: (${response.data.data.pixel?.latitude}, ${response.data.data.pixel?.longitude})`);
        console.log(`    🎨 图案: ${response.data.data.pixel?.pattern_id}`);
        console.log(`    ⏱️ 处理时间: ${response.data.data.processingTime}ms`);
        
        this.results.push({
          test: '带图案的手动绘制',
          success: true,
          processingTime: response.data.data.processingTime,
          details: response.data.data
        });
      } else {
        console.log('  ❌ 带图案的手动绘制: 失败');
        console.log(`    📝 错误: ${response.data.error}`);
        
        this.results.push({
          test: '带图案的手动绘制',
          success: false,
          error: response.data.error
        });
      }
    } catch (error) {
      console.log('  ❌ 带图案的手动绘制: 请求失败');
      console.log(`    📝 错误详情: ${JSON.stringify(error.response?.data || error.message)}`);
      
      this.results.push({
        test: '带图案的手动绘制',
        success: false,
        error: error.response?.data || error.message
      });
    }
  }

  /**
   * 测试边界坐标
   */
  async testBoundaryCoordinates() {
    console.log('  🔍 测试: 边界坐标测试');
    
    const testCases = [
      { name: '北京天安门', lat: 39.9042, lng: 116.4074 },
      { name: '上海外滩', lat: 31.2304, lng: 121.4737 },
      { name: '深圳南山', lat: 22.5431, lng: 113.9344 }
    ];

    for (const testCase of testCases) {
      try {
        const response = await axios.post(`${this.baseUrl}/api/pixel-draw/manual`, {
          lat: testCase.lat,
          lng: testCase.lng,
          color: '#0000FF',
          patternId: 'color_blue'
        }, {
          headers: {
            'Authorization': `Bearer ${this.jwt}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.data.success) {
          console.log(`    ✅ ${testCase.name}: 成功`);
        } else {
          console.log(`    ❌ ${testCase.name}: 失败 - ${response.data.error}`);
        }
      } catch (error) {
        console.log(`    ❌ ${testCase.name}: 请求失败 - ${error.response?.data?.error || error.message}`);
      }
      
      // 每个测试之间添加延迟
      await this.delay(200);
    }
  }

  /**
   * 测试无效数据
   */
  async testInvalidData() {
    console.log('  🔍 测试: 无效数据测试');
    
    const invalidCases = [
      { name: '无效纬度', data: { lat: 'invalid', lng: 116.4074, color: '#FF0000' } },
      { name: '无效经度', data: { lat: 39.9042, lng: 'invalid', color: '#FF0000' } },
      { name: '超出范围纬度', data: { lat: 200, lng: 116.4074, color: '#FF0000' } },
      { name: '超出范围经度', data: { lat: 39.9042, lng: 200, color: '#FF0000' } },
      { name: '缺少颜色', data: { lat: 39.9042, lng: 116.4074 } }
    ];

    for (const testCase of invalidCases) {
      try {
        const response = await axios.post(`${this.baseUrl}/api/pixel-draw/manual`, testCase.data, {
          headers: {
            'Authorization': `Bearer ${this.jwt}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.data.success) {
          console.log(`    ✅ ${testCase.name}: 正确拒绝 - ${response.data.error}`);
        } else {
          console.log(`    ❌ ${testCase.name}: 应该被拒绝但成功了`);
        }
      } catch (error) {
        if (error.response?.status === 400) {
          console.log(`    ✅ ${testCase.name}: 正确拒绝 - ${error.response.data.error}`);
        } else {
          console.log(`    ❌ ${testCase.name}: 意外错误 - ${error.response?.data?.error || error.message}`);
        }
      }
    }
  }

  /**
   * 生成测试报告
   */
  generateReport() {
    console.log('\n📊 手动绘制测试报告');
    console.log('========================');
    
    const successCount = this.results.filter(r => r.success).length;
    const totalCount = this.results.length;
    const successRate = totalCount > 0 ? (successCount / totalCount * 100).toFixed(1) : 0;
    
    console.log(`总体成功率: ${successRate}% (${successCount}/${totalCount})`);
    console.log('');
    
    this.results.forEach(result => {
      if (result.success) {
        console.log(`✅ ${result.test}`);
        if (result.processingTime) {
          console.log(`  处理时间: ${result.processingTime}ms`);
        }
      } else {
        console.log(`❌ ${result.test}`);
        console.log(`  错误: ${result.error}`);
      }
    });
    
    // 保存详细报告
    const reportData = {
      timestamp: new Date().toISOString(),
      testType: 'manual_draw',
      successRate: successRate,
      totalTests: totalCount,
      successCount: successCount,
      results: this.results
    };
    
    const fs = require('fs');
    const reportPath = `manual-draw-test-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
    console.log(`\n📄 详细报告已保存: ${reportPath}`);
  }
}

// 运行测试
if (require.main === module) {
  const test = new ManualDrawTest();
  test.runTests().catch(console.error);
}

module.exports = ManualDrawTest;
