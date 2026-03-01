#!/usr/bin/env node

/**
 * 测试真实的手动像素绘制流程
 * 模拟前端用户在地图上点击绘制像素的完整流程
 */

const axios = require('axios');

const CONFIG = {
  BACKEND_URL: 'http://localhost:3001',
  TIMEOUT: 15000
};

// 模拟真实的用户绘制数据
function createRealPixelData() {
  return {
    // 真实的经纬度坐标（广州区域）
    latitude: 23.125678,
    longitude: 113.265432,
    color: '#FF5733',
    userId: '6284d571-36b4-4170-8ec1-746f34dbe905', // 使用数据库中已存在的用户ID
    pixelType: 'basic',
    timestamp: Date.now()
  };
}

async function testManualPixelDrawing() {
  try {
    console.log('🎨 测试真实的手动像素绘制流程');
    console.log('='.repeat(50));

    // 1. 检查服务状态
    console.log('\n📋 步骤1: 检查服务状态');
    const healthResponse = await axios.get(`${CONFIG.BACKEND_URL}/api/health`, { timeout: CONFIG.TIMEOUT });
    console.log('✅ 后端服务正常运行');

    // 2. 获取绘制前的像素数量
    console.log('\n📊 步骤2: 获取当前像素统计');
    const beforeStats = await axios.get(`${CONFIG.BACKEND_URL}/api/pixels/stats`, { timeout: CONFIG.TIMEOUT });
    const beforeCount = beforeStats.data.data.totalPixels;
    console.log(`✅ 当前总像素数: ${beforeCount}`);

    // 3. 创建真实的绘制请求数据
    console.log('\n🎯 步骤3: 准备真实绘制数据');
    const pixelData = createRealPixelData();
    console.log(`📍 绘制位置: ${pixelData.latitude}, ${pixelData.longitude}`);
    console.log(`🎨 绘制颜色: ${pixelData.color}`);
    console.log(`👤 用户ID: ${pixelData.userId}`);

    // 4. 调用手动绘制API
    console.log('\n🖱️ 步骤4: 调用手动绘制API');
    console.log(`📡 发送请求到: ${CONFIG.BACKEND_URL}/api/pixel-draw/manual`);

    try {
      const drawResponse = await axios.post(`${CONFIG.BACKEND_URL}/api/pixel-draw/manual`, pixelData, {
        timeout: CONFIG.TIMEOUT,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'FunnyPixels-Test/1.0'
        }
      });

      console.log(`✅ 绘制请求成功! 状态码: ${drawResponse.status}`);
      console.log('📥 响应数据:', JSON.stringify(drawResponse.data, null, 2));

      // 5. 检查批处理状态
      console.log('\n⏳ 步骤5: 检查批处理服务状态');
      try {
        const batchStatusResponse = await axios.get(`${CONFIG.BACKEND_URL}/api/pixel-draw/batch/status`, {
          timeout: CONFIG.TIMEOUT
        });
        console.log('✅ 批处理服务状态:', batchStatusResponse.data);
      } catch (error) {
        console.log('⚠️ 无法获取批处理状态:', error.response?.data || error.message);
      }

      // 6. 等待批处理完成并验证结果
      console.log('\n🔍 步骤6: 等待批处理完成并验证结果');
      console.log('⏳ 等待5秒让批处理服务处理像素...');

      await new Promise(resolve => setTimeout(resolve, 5000));

      const afterStats = await axios.get(`${CONFIG.BACKEND_URL}/api/pixels/stats`, { timeout: CONFIG.TIMEOUT });
      const afterCount = afterStats.data.data.totalPixels;
      console.log(`✅ 处理后总像素数: ${afterCount}`);

      // 7. 分析结果
      console.log('\n📈 步骤7: 分析结果');
      if (afterCount > beforeCount) {
        const newPixels = afterCount - beforeCount;
        console.log(`🎉 成功! 新增了 ${newPixels} 个像素`);
        console.log('✅ 手动绘制功能正常工作');
      } else {
        console.log('❌ 像素数量没有增加');
        console.log('⚠️ 可能的原因:');
        console.log('   - 批处理服务延迟');
        console.log('   - 权限验证失败');
        console.log('   - 位置验证失败');
        console.log('   - 批处理队列问题');
      }

    } catch (drawError) {
      console.log('❌ 手动绘制API调用失败');
      console.log(`🚫 状态码: ${drawError.response?.status}`);
      console.log(`📝 错误信息:`, drawError.response?.data || drawError.message);

      // 分析具体的错误原因
      if (drawError.response?.status === 401) {
        console.log('💡 可能原因: 用户未认证或token无效');
      } else if (drawError.response?.status === 403) {
        console.log('💡 可能原因: 用户权限不足或绘制限制');
      } else if (drawError.response?.status === 400) {
        console.log('💡 可能原因: 请求数据格式错误或位置无效');
      } else if (drawError.response?.status === 500) {
        console.log('💡 可能原因: 服务器内部错误');
      }
    }

    console.log('\n🏁 测试完成');

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error.message);
    process.exit(1);
  }
}

// 运行测试
testManualPixelDrawing();