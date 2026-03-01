#!/usr/bin/env node

/**
 * 使用真实测试用户账号测试像素绘制
 * 使用提供的测试账号: login@test.com / test123456
 */

const axios = require('axios');

const CONFIG = {
  BACKEND_URL: 'http://localhost:3001',
  TIMEOUT: 15000
};

// 真实的测试用户账号
const TEST_USER = {
  username: 'login_test_user',
  password: 'test123456'
};

async function testRealUserPixelDrawing() {
  try {
    console.log('🎨 使用真实测试用户账号测试像素绘制');
    console.log('='.repeat(60));
    console.log(`👤 测试账号: ${TEST_USER.username}`);

    // 1. 检查服务状态
    console.log('\n📋 步骤1: 检查服务状态');
    const healthResponse = await axios.get(`${CONFIG.BACKEND_URL}/api/health`, { timeout: CONFIG.TIMEOUT });
    console.log('✅ 后端服务正常运行');

    // 2. 获取绘制前的像素数量
    console.log('\n📊 步骤2: 获取当前像素统计');
    const beforeStats = await axios.get(`${CONFIG.BACKEND_URL}/api/pixels/stats`, { timeout: CONFIG.TIMEOUT });
    const beforeCount = beforeStats.data.data.totalPixels;
    console.log(`✅ 当前总像素数: ${beforeCount}`);

    // 3. 使用真实测试账号登录
    console.log('\n🔑 步骤3: 使用真实测试账号登录');
    let authToken = null;
    let userInfo = null;

    try {
      const loginResponse = await axios.post(`${CONFIG.BACKEND_URL}/api/auth/login`, {
        username: TEST_USER.username,
        password: TEST_USER.password
      }, {
        timeout: CONFIG.TIMEOUT,
        validateStatus: function (status) {
          return status < 500;
        }
      });

      if (loginResponse.status === 200 && loginResponse.data.success) {
        authToken = loginResponse.data.tokens.accessToken;
        userInfo = loginResponse.data.user;
        console.log('✅ 登录成功！');
        console.log(`👤 用户信息: ${userInfo.username} (ID: ${userInfo.id})`);
        console.log(`📧 邮箱: ${userInfo.email}`);
        console.log(`🎯 总像素数: ${userInfo.total_pixels}`);
        console.log(`🎫 Token: ${authToken.substring(0, 30)}...`);
      } else {
        console.log('❌ 登录失败:', loginResponse.data);
        return;
      }
    } catch (loginError) {
      console.log('❌ 登录请求失败:', loginError.response?.data || loginError.message);
      return;
    }

    // 4. 获取用户绘制状态验证
    console.log('\n🔍 步骤4: 验证用户绘制状态');
    try {
      const validateResponse = await axios.get(`${CONFIG.BACKEND_URL}/api/pixel-draw/validate`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        timeout: CONFIG.TIMEOUT
      });

      console.log('✅ 用户绘制状态验证通过');
      console.log('📊 用户状态:', validateResponse.data);
    } catch (validateError) {
      console.log('⚠️ 用户状态验证失败:', validateError.response?.data || validateError.message);
    }

    // 5. 执行手动像素绘制
    console.log('\n🎯 步骤5: 执行手动像素绘制');
    const pixelData = {
      latitude: 23.125000 + Math.random() * 0.001,
      longitude: 113.265000 + Math.random() * 0.001,
      color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'),
      pixelType: 'basic',
      timestamp: Date.now()
    };

    console.log(`📍 准备绘制像素:`);
    console.log(`   位置: ${pixelData.latitude.toFixed(6)}, ${pixelData.longitude.toFixed(6)}`);
    console.log(`   颜色: ${pixelData.color}`);

    try {
      const drawResponse = await axios.post(`${CONFIG.BACKEND_URL}/api/pixel-draw/manual`, pixelData, {
        timeout: CONFIG.TIMEOUT,
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      console.log(`✅ 绘制请求成功! 状态码: ${drawResponse.status}`);
      console.log('📥 响应数据:', JSON.stringify(drawResponse.data, null, 2));

      if (drawResponse.data.success) {
        console.log('🎉 像素绘制成功！');

        // 6. 验证像素是否被写入数据库
        console.log('\n🔍 步骤6: 验证像素是否被写入数据库');
        console.log('⏳ 等待8秒让批处理服务处理...');

        await new Promise(resolve => setTimeout(resolve, 8000));

        const afterStats = await axios.get(`${CONFIG.BACKEND_URL}/api/pixels/stats`, { timeout: CONFIG.TIMEOUT });
        const afterCount = afterStats.data.data.totalPixels;
        console.log(`✅ 处理后总像素数: ${afterCount}`);

        if (afterCount > beforeCount) {
          const newPixels = afterCount - beforeCount;
          console.log(`🎉 成功! 新增了 ${newPixels} 个像素`);
          console.log('✅ 像素绘制功能完全正常工作！');

          // 检查最新的像素记录
          console.log('\n🔍 步骤7: 检查最新的像素记录');
          const { db } = require('../../backend/src/config/database');
          try {
            const latestPixels = await db('pixels')
              .select('*')
              .orderBy('created_at', 'desc')
              .limit(3);

            console.log('📝 最新的3条像素记录:');
            latestPixels.forEach((pixel, index) => {
              console.log(`  ${index + 1}. ID: ${pixel.id}, 颜色: ${pixel.color}`);
              console.log(`     位置: ${pixel.latitude}, ${pixel.longitude}`);
              console.log(`     用户: ${pixel.user_id}, 时间: ${pixel.created_at}`);
              console.log(`     Grid ID: ${pixel.grid_id}`);
            });

            await db.destroy();
          } catch (dbError) {
            console.log('⚠️ 无法查询最新像素记录:', dbError.message);
          }

        } else {
          console.log('❌ 像素数量没有增加');
          console.log('⚠️ 这表明像素没有被成功写入数据库');
          console.log('💡 可能的原因:');
          console.log('   - 批处理服务有问题');
          console.log('   - 像素数据验证失败');
          console.log('   - 数据库写入失败');
        }
      } else {
        console.log('❌ 像素绘制失败');
        console.log('📝 错误信息:', drawResponse.data.error);
      }

    } catch (drawError) {
      console.log('❌ 像素绘制请求失败');
      console.log(`🚫 状态码: ${drawError.response?.status}`);
      console.log(`📝 错误信息:`, drawError.response?.data || drawError.message);

      // 详细分析错误
      if (drawError.response?.status === 401) {
        console.log('💡 认证token无效或已过期');
      } else if (drawError.response?.status === 403) {
        console.log('💡 用户权限不足或绘制限制');
      } else if (drawError.response?.status === 400) {
        console.log('💡 请求数据格式错误或位置无效');
      } else if (drawError.response?.status === 500) {
        console.log('💡 服务器内部错误');
      }
    }

    console.log('\n🏁 测试完成');

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error.message);
    process.exit(1);
  }
}

// 运行测试
testRealUserPixelDrawing();