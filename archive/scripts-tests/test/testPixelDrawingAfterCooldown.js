#!/usr/bin/env node

/**
 * 等待冷却时间后测试像素绘制
 */

const axios = require('axios');

const CONFIG = {
  BACKEND_URL: 'http://localhost:3001',
  TIMEOUT: 15000
};

const TEST_USER = {
  username: 'login_test_user',
  password: 'test123456'
};

async function testAfterCooldown() {
  try {
    console.log('⏳ 等待冷却时间后测试像素绘制');

    // 1. 登录获取token
    const loginResponse = await axios.post(`${CONFIG.BACKEND_URL}/api/auth/login`, {
      username: TEST_USER.username,
      password: TEST_USER.password
    }, { timeout: CONFIG.TIMEOUT });

    const authToken = loginResponse.data.tokens.accessToken;
    console.log('✅ 登录成功');

    // 2. 检查用户状态
    const validateResponse = await axios.get(`${CONFIG.BACKEND_URL}/api/pixel-draw/validate`, {
      headers: { 'Authorization': `Bearer ${authToken}` },
      timeout: CONFIG.TIMEOUT
    });

    const userState = validateResponse.data.data;
    console.log('📊 用户状态:');
    console.log(`   可绘制: ${userState.canDraw}`);
    console.log(`   像素点: ${userState.totalPoints}`);
    console.log(`   冷却时间: ${userState.freezeTimeLeft}秒`);
    console.log(`   最后活动: ${userState.lastActivityTime}`);

    if (!userState.canDraw) {
      console.log(`❌ 用户仍在冷却中，需要等待 ${userState.freezeTimeLeft} 秒`);
      console.log('⏳ 等待冷却时间结束...');

      // 等待冷却时间
      const waitTime = (userState.freezeTimeLeft || 5) + 2;
      console.log(`⏰ 等待 ${waitTime} 秒...`);
      await new Promise(resolve => setTimeout(resolve, waitTime * 1000));

      // 重新检查状态
      const newValidateResponse = await axios.get(`${CONFIG.BACKEND_URL}/api/pixel-draw/validate`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
        timeout: CONFIG.TIMEOUT
      });

      const newUserState = newValidateResponse.data.data;
      console.log('🔄 冷却后状态:');
      console.log(`   可绘制: ${newUserState.canDraw}`);
      console.log(`   像素点: ${newUserState.totalPoints}`);
      console.log(`   冷却时间: ${newUserState.freezeTimeLeft}秒`);
    }

    // 3. 尝试绘制像素
    if (userState.canDraw || userState.freezeTimeLeft <= 0) {
      console.log('\n🎯 尝试绘制像素...');

      const pixelData = {
        latitude: 23.125000 + Math.random() * 0.001,
        longitude: 113.265000 + Math.random() * 0.001,
        color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'),
        pixelType: 'basic',
        timestamp: Date.now()
      };

      const drawResponse = await axios.post(`${CONFIG.BACKEND_URL}/api/pixel-draw/manual`, pixelData, {
        timeout: CONFIG.TIMEOUT,
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      console.log(`✅ 绘制响应: ${drawResponse.status}`);
      console.log('📥 响应:', JSON.stringify(drawResponse.data, null, 2));

      if (drawResponse.data.success) {
        console.log('🎉 像素绘制成功！');

        // 4. 等待批处理完成
        console.log('\n⏳ 等待10秒让批处理服务处理...');
        await new Promise(resolve => setTimeout(resolve, 10000));

        // 5. 检查像素数量
        const statsResponse = await axios.get(`${CONFIG.BACKEND_URL}/api/pixels/stats`, { timeout: CONFIG.TIMEOUT });
        console.log(`📊 当前总像素数: ${statsResponse.data.data.totalPixels}`);
      }

    } else {
      console.log('❌ 无法绘制，用户仍在冷却中');
    }

  } catch (error) {
    console.error('❌ 测试失败:', error.response?.data || error.message);
  }
}

testAfterCooldown();