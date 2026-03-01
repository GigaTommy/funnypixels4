const axios = require('axios');

class BombTest {
  constructor() {
    this.baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3001';
    this.jwt = process.env.TEST_JWT || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjgxMDJlMGZiLTkyMGUtNDE3ZS1hZTQwLTE3MWM3YzJkYmMxNSIsInVzZXJuYW1lIjoiYmJiIiwiZW1haWwiOiJiYmJAZXhhbXBsZS5jb20iLCJyb2xlIjoidXNlciIsImlhdCI6MTc1NzkyNDgxNywiZXhwIjoxNzU3OTI4NDE3fQ.ZeBF36CFjwBahB3YG5P5KDJSu5Z4w47j_tug3W7yxu0';
    this.results = [];
  }

  /**
   * 运行炸弹测试
   */
  async runTests() {
    console.log('🚀 开始像素炸弹功能测试...');
    
    try {
      // 测试1: 基本炸弹使用
      await this.testBasicBombUse();
      await this.delay(200); // 等待200ms避免冷却
      
      // 测试2: 不同位置炸弹
      await this.testDifferentLocationBombs();
      await this.delay(200); // 等待200ms避免冷却
      
      // 测试3: 炸弹库存检查
      await this.testBombInventory();
      await this.delay(200); // 等待200ms避免冷却
      
      // 测试4: 炸弹冷却状态
      await this.testBombCooldown();
      await this.delay(200); // 等待200ms避免冷却
      
      // 测试5: 无效炸弹数据测试
      await this.testInvalidBombData();
      
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
   * 测试基本炸弹使用
   */
  async testBasicBombUse() {
    console.log('  🔍 测试: 基本炸弹使用');
    
    try {
      const response = await axios.post(`${this.baseUrl}/api/bomb/use`, {
        x: 100,
        y: 100,
        pattern_id: 'pattern_bomb_001',
        sku_id: 1
      }, {
        headers: {
          'Authorization': `Bearer ${this.jwt}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.success) {
        console.log('  ✅ 基本炸弹使用: 成功');
        console.log(`    💣 炸弹ID: ${response.data.bomb.id}`);
        console.log(`    📍 位置: (${response.data.bomb.x}, ${response.data.bomb.y})`);
        console.log(`    📏 大小: ${response.data.bomb.w}x${response.data.bomb.h}`);
        console.log(`    🎨 图案: ${response.data.bomb.pattern_id}`);
        
        this.results.push({
          test: '基本炸弹使用',
          success: true,
          details: response.data.bomb
        });
      } else {
        console.log('  ❌ 基本炸弹使用: 失败');
        console.log(`    📝 错误: ${response.data.message}`);
        
        this.results.push({
          test: '基本炸弹使用',
          success: false,
          error: response.data.message
        });
      }
    } catch (error) {
      console.log('  ❌ 基本炸弹使用: 请求失败');
      console.log(`    📝 错误详情: ${JSON.stringify(error.response?.data || error.message)}`);
      
      this.results.push({
        test: '基本炸弹使用',
        success: false,
        error: error.response?.data || error.message
      });
    }
  }

  /**
   * 测试不同位置炸弹
   */
  async testDifferentLocationBombs() {
    console.log('  🔍 测试: 不同位置炸弹');
    
    const locations = [
      { name: '北京天安门', x: 200, y: 200 },
      { name: '上海外滩', x: 300, y: 300 },
      { name: '深圳南山', x: 400, y: 400 }
    ];

    for (const location of locations) {
      try {
        const response = await axios.post(`${this.baseUrl}/api/bomb/use`, {
          x: location.x,
          y: location.y,
          pattern_id: 'pattern_bomb_002',
          sku_id: 1
        }, {
          headers: {
            'Authorization': `Bearer ${this.jwt}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.data.success) {
          console.log(`    ✅ ${location.name}: 成功`);
        } else {
          console.log(`    ❌ ${location.name}: 失败 - ${response.data.message}`);
        }
      } catch (error) {
        console.log(`    ❌ ${location.name}: 请求失败 - ${error.response?.data?.message || error.message}`);
      }
      
      // 每个位置之间添加延迟
      await this.delay(200);
    }
  }

  /**
   * 测试炸弹库存
   */
  async testBombInventory() {
    console.log('  🔍 测试: 炸弹库存检查');
    
    try {
      const response = await axios.get(`${this.baseUrl}/api/bomb/inventory`, {
        headers: {
          'Authorization': `Bearer ${this.jwt}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.success) {
        console.log('  ✅ 炸弹库存检查: 成功');
        console.log(`    📦 库存数量: ${response.data.inventory.length}`);
        
        response.data.inventory.forEach((item, index) => {
          console.log(`    💣 炸弹${index + 1}: ${item.name} (数量: ${item.quantity})`);
        });
        
        this.results.push({
          test: '炸弹库存检查',
          success: true,
          inventoryCount: response.data.inventory.length,
          details: response.data.inventory
        });
      } else {
        console.log('  ❌ 炸弹库存检查: 失败');
        console.log(`    📝 错误: ${response.data.message}`);
        
        this.results.push({
          test: '炸弹库存检查',
          success: false,
          error: response.data.message
        });
      }
    } catch (error) {
      console.log('  ❌ 炸弹库存检查: 请求失败');
      console.log(`    📝 错误详情: ${JSON.stringify(error.response?.data || error.message)}`);
      
      this.results.push({
        test: '炸弹库存检查',
        success: false,
        error: error.response?.data || error.message
      });
    }
  }

  /**
   * 测试炸弹冷却状态
   */
  async testBombCooldown() {
    console.log('  🔍 测试: 炸弹冷却状态');
    
    try {
      const response = await axios.get(`${this.baseUrl}/api/bomb/cooldown`, {
        headers: {
          'Authorization': `Bearer ${this.jwt}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.success) {
        console.log('  ✅ 炸弹冷却状态: 成功');
        console.log(`    ⏰ 可使用: ${response.data.can_use ? '是' : '否'}`);
        if (!response.data.can_use) {
          console.log(`    ⏳ 剩余冷却时间: ${response.data.cooldown_remaining}秒`);
        }
        
        this.results.push({
          test: '炸弹冷却状态',
          success: true,
          canUse: response.data.can_use,
          cooldownRemaining: response.data.cooldown_remaining,
          details: response.data
        });
      } else {
        console.log('  ❌ 炸弹冷却状态: 失败');
        console.log(`    📝 错误: ${response.data.message}`);
        
        this.results.push({
          test: '炸弹冷却状态',
          success: false,
          error: response.data.message
        });
      }
    } catch (error) {
      console.log('  ❌ 炸弹冷却状态: 请求失败');
      console.log(`    📝 错误详情: ${JSON.stringify(error.response?.data || error.message)}`);
      
      this.results.push({
        test: '炸弹冷却状态',
        success: false,
        error: error.response?.data || error.message
      });
    }
  }

  /**
   * 测试无效炸弹数据
   */
  async testInvalidBombData() {
    console.log('  🔍 测试: 无效炸弹数据测试');
    
    const invalidCases = [
      { name: '缺少X坐标', data: { y: 100, pattern_id: 'pattern_bomb_001', sku_id: 1 } },
      { name: '缺少Y坐标', data: { x: 100, pattern_id: 'pattern_bomb_001', sku_id: 1 } },
      { name: '缺少SKU ID', data: { x: 100, y: 100, pattern_id: 'pattern_bomb_001' } },
      { name: '无效X坐标', data: { x: 'invalid', y: 100, pattern_id: 'pattern_bomb_001', sku_id: 1 } },
      { name: '无效Y坐标', data: { x: 100, y: 'invalid', pattern_id: 'pattern_bomb_001', sku_id: 1 } }
    ];

    for (const testCase of invalidCases) {
      try {
        const response = await axios.post(`${this.baseUrl}/api/bomb/use`, testCase.data, {
          headers: {
            'Authorization': `Bearer ${this.jwt}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.data.success) {
          console.log(`    ✅ ${testCase.name}: 正确拒绝 - ${response.data.message}`);
        } else {
          console.log(`    ❌ ${testCase.name}: 应该被拒绝但成功了`);
        }
      } catch (error) {
        if (error.response?.status === 400) {
          console.log(`    ✅ ${testCase.name}: 正确拒绝 - ${error.response.data.message}`);
        } else {
          console.log(`    ❌ ${testCase.name}: 意外错误 - ${error.response?.data?.message || error.message}`);
        }
      }
    }
  }

  /**
   * 生成测试报告
   */
  generateReport() {
    console.log('\n📊 像素炸弹测试报告');
    console.log('========================');
    
    const successCount = this.results.filter(r => r.success).length;
    const totalCount = this.results.length;
    const successRate = totalCount > 0 ? (successCount / totalCount * 100).toFixed(1) : 0;
    
    console.log(`总体成功率: ${successRate}% (${successCount}/${totalCount})`);
    console.log('');
    
    this.results.forEach(result => {
      if (result.success) {
        console.log(`✅ ${result.test}`);
        if (result.inventoryCount !== undefined) {
          console.log(`  库存数量: ${result.inventoryCount}`);
        }
        if (result.canUse !== undefined) {
          console.log(`  可使用: ${result.canUse ? '是' : '否'}`);
        }
      } else {
        console.log(`❌ ${result.test}`);
        console.log(`  错误: ${result.error}`);
      }
    });
    
    // 保存详细报告
    const reportData = {
      timestamp: new Date().toISOString(),
      testType: 'bomb_test',
      successRate: successRate,
      totalTests: totalCount,
      successCount: successCount,
      results: this.results
    };
    
    const fs = require('fs');
    const reportPath = `bomb-test-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
    console.log(`\n📄 详细报告已保存: ${reportPath}`);
  }
}

// 运行测试
if (require.main === module) {
  const test = new BombTest();
  test.runTests().catch(console.error);
}

module.exports = BombTest;
