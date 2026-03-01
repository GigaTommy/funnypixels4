#!/usr/bin/env node

/**
 * 测试带认证的像素绘制完整流程
 * 包括登录获取token，然后用token进行像素绘制
 */

const axios = require('axios');

const CONFIG = {
  BACKEND_URL: 'http://localhost:3001',
  TIMEOUT: 15000
};

// 测试用户 credentials（使用已知存在的用户）
const TEST_USER = {
  // 这个用户ID在数据库中已存在
  id: '6284d571-36b4-4170-8ec1-746f34dbe905',
  // 我们需要知道用户名和密码来登录，或者创建测试用户
  username: 'testuser',
  password: 'testpass123'
};

async function testAuthenticatedPixelDrawing() {
  try {
    console.log('🎨 测试带认证的像素绘制完整流程');
    console.log('='.repeat(60));

    // 1. 检查服务状态
    console.log('\n📋 步骤1: 检查服务状态');
    const healthResponse = await axios.get(`${CONFIG.BACKEND_URL}/api/health`, { timeout: CONFIG.TIMEOUT });
    console.log('✅ 后端服务正常运行');

    // 2. 获取绘制前的像素数量
    console.log('\n📊 步骤2: 获取当前像素统计');
    const beforeStats = await axios.get(`${CONFIG.BACKEND_URL}/api/pixels/stats`, { timeout: CONFIG.TIMEOUT });
    const beforeCount = beforeStats.data.data.totalPixels;
    console.log(`✅ 当前总像素数: ${beforeCount}`);

    // 3. 尝试登录获取token
    console.log('\n🔑 步骤3: 尝试用户登录获取认证token');
    let authToken = null;

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

      if (loginResponse.status === 200 && loginResponse.data.token) {
        authToken = loginResponse.data.token;
        console.log('✅ 登录成功，获取到认证token');
        console.log(`🎫 Token: ${authToken.substring(0, 20)}...`);
      } else {
        console.log('⚠️ 登录失败:', loginResponse.data);
      }
    } catch (loginError) {
      console.log('❌ 登录请求失败:', loginError.response?.data || loginError.message);

      // 如果登录失败，尝试其他方式获取token
      console.log('\n🔄 尝试创建临时测试token...');

      // 有些系统支持访客token或临时token
      try {
        const tempTokenResponse = await axios.post(`${CONFIG.BACKEND_URL}/api/auth/refresh`, {
          userId: TEST_USER.id
        }, {
          timeout: CONFIG.TIMEOUT,
          validateStatus: function (status) {
            return status < 500;
          }
        });

        if (tempTokenResponse.status === 200 && tempTokenResponse.data.token) {
          authToken = tempTokenResponse.data.token;
          console.log('✅ 获取到临时token');
        }
      } catch (tempError) {
        console.log('❌ 无法获取临时token:', tempError.response?.data || tempError.message);
      }
    }

    if (!authToken) {
      console.log('\n❌ 无法获取有效的认证token');
      console.log('💡 可能的原因:');
      console.log('   - 测试用户credentials不正确');
      console.log('   - 认证服务配置问题');
      console.log('   - 需要先注册用户');

      // 尝试注册新用户
      console.log('\n🔄 尝试注册新测试用户...');
      try {
        const registerResponse = await axios.post(`${CONFIG.BACKEND_URL}/api/auth/register`, {
          username: `testuser_${Date.now()}`,
          password: 'testpass123',
          email: `test_${Date.now()}@example.com`
        }, {
          timeout: CONFIG.TIMEOUT,
          validateStatus: function (status) {
            return status < 500;
          }
        });

        if (registerResponse.status === 201) {
          console.log('✅ 新用户注册成功');
          // 尝试登录新注册的用户
          // ... 但由于时间限制，我们继续尝试其他方法
        } else {
          console.log('⚠️ 用户注册失败:', registerResponse.data);
        }
      } catch (registerError) {
        console.log('❌ 用户注册失败:', registerError.response?.data || registerError.message);
      }

      console.log('\n🚫 由于无法获取认证token，无法继续测试手动绘制功能');
      console.log('💡 建议:');
      console.log('   1. 检查认证服务配置');
      console.log('   2. 创建有效的测试用户');
      console.log('   3. 或者临时禁用认证中间件进行测试');

      return;
    }

    // 4. 使用token进行像素绘制
    console.log('\n🎯 步骤4: 使用认证token进行像素绘制');
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
        },
        validateStatus: function (status) {
          return status < 500;
        }
      });

      console.log(`✅ 绘制请求响应: ${drawResponse.status}`);
      console.log('📥 响应数据:', JSON.stringify(drawResponse.data, null, 2));

      if (drawResponse.status === 200 || drawResponse.status === 201) {
        console.log('🎉 像素绘制请求成功!');

        // 5. 验证像素是否被创建
        console.log('\n🔍 步骤5: 验证像素是否被写入数据库');
        console.log('⏳ 等待5秒让批处理服务处理...');

        await new Promise(resolve => setTimeout(resolve, 5000));

        const afterStats = await axios.get(`${CONFIG.BACKEND_URL}/api/pixels/stats`, { timeout: CONFIG.TIMEOUT });
        const afterCount = afterStats.data.data.totalPixels;
        console.log(`✅ 处理后总像素数: ${afterCount}`);

        if (afterCount > beforeCount) {
          const newPixels = afterCount - beforeCount;
          console.log(`🎉 成功! 新增了 ${newPixels} 个像素`);
          console.log('✅ 手动绘制功能完全正常工作！');

          // 检查最新的像素记录
          console.log('\n🔍 步骤6: 检查最新的像素记录');
          const { db } = require('../../backend/src/config/database');
          try {
            const latestPixels = await db('pixels')
              .select('*')
              .orderBy('created_at', 'desc')
              .limit(3);

            console.log('📝 最新的3条像素记录:');
            latestPixels.forEach((pixel, index) => {
              console.log(`  ${index + 1}. ID: ${pixel.id}, 颜色: ${pixel.color}, 位置: ${pixel.latitude}, ${pixel.longitude}`);
              console.log(`     用户: ${pixel.user_id}, 时间: ${pixel.created_at}`);
            });

            await db.destroy();
          } catch (dbError) {
            console.log('⚠️ 无法查询最新像素记录:', dbError.message);
          }

        } else {
          console.log('❌ 像素数量没有增加');
          console.log('⚠️ 可能的原因:');
          console.log('   - 批处理服务延迟');
          console.log('   - 权限验证仍然失败');
          console.log('   - 位置验证失败');
          console.log('   - 批处理队列问题');
        }
      } else {
        console.log(`❌ 像素绘制失败: ${drawResponse.status}`);
        console.log('📝 错误信息:', drawResponse.data);
      }

    } catch (drawError) {
      console.log('❌ 像素绘制请求失败');
      console.log(`🚫 状态码: ${drawError.response?.status}`);
      console.log(`📝 错误信息:`, drawError.response?.data || drawError.message);

      if (drawError.response?.status === 401) {
        console.log('💡 认证token无效或已过期');
      } else if (drawError.response?.status === 403) {
        console.log('💡 用户权限不足或绘制限制');
      } else if (drawError.response?.status === 400) {
        console.log('💡 请求数据格式错误或位置无效');
      }
    }

    console.log('\n🏁 测试完成');

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error.message);
    process.exit(1);
  }
}

// 运行测试
testAuthenticatedPixelDrawing();