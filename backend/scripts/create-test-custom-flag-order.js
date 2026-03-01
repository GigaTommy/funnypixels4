const axios = require('axios');

/**
 * 创建测试自定义旗帜订单
 */
async function createTestCustomFlagOrder() {
  try {
    console.log('🧪 创建测试自定义旗帜订单...\n');
    
    // 1. 用户登录
    console.log('1️⃣ 用户登录...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'bbb',
      password: 'bbbbbb'
    });
    
    const token = loginResponse.data.tokens.accessToken;
    console.log('✅ 用户登录成功');
    
    // 2. 创建自定义旗帜订单
    console.log('\n2️⃣ 创建自定义旗帜订单...');
    const orderResponse = await axios.post('http://localhost:3001/api/custom-flags/orders', {
      patternName: '测试旗帜',
      patternDescription: '这是一个测试旗帜',
      imageData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
    }, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ 自定义旗帜订单创建成功！');
    console.log('📋 订单信息:', JSON.stringify(orderResponse.data, null, 2));
    
  } catch (error) {
    console.error('❌ 创建失败:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', error.response.data);
    }
  }
}

// 运行测试
if (require.main === module) {
  createTestCustomFlagOrder();
}

module.exports = { createTestCustomFlagOrder };
