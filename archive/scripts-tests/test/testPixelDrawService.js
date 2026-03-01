#!/usr/bin/env node

/**
 * 直接测试pixelDrawService
 * 找出为什么像素数据没有被添加到批处理队列中
 */

const PixelDrawService = require('../../backend/src/services/pixelDrawService');
const BatchPixelService = require('../../backend/src/services/batchPixelService');

async function testPixelDrawService() {
  try {
    console.log('🔍 直接测试pixelDrawService\n');

    // 1. 检查批处理服务初始状态
    console.log('📊 批处理服务初始状态:');
    console.log(`   像素队列: ${BatchPixelService.pixelBatch.length} 个像素`);
    console.log(`   总批次数: ${BatchPixelService.stats.totalBatches}`);

    // 2. 创建测试像素数据
    const pixelData = {
      latitude: 23.125678,
      longitude: 113.265432,
      userId: '6284d571-36b4-4170-8ec1-746f34dbe905',
      color: '#FF5733',
      pixelType: 'basic',
      drawType: 'manual',
      timestamp: Date.now()
    };

    console.log('\n🎯 测试像素数据:');
    console.log(`   位置: ${pixelData.latitude}, ${pixelData.longitude}`);
    console.log(`   用户: ${pixelData.userId}`);
    console.log(`   颜色: ${pixelData.color}`);
    console.log(`   类型: ${pixelData.drawType}`);

    // 3. 直接调用pixelDrawService
    console.log('\n🔄 直接调用pixelDrawService.handlePixelDraw...');

    const pixelDrawService = new PixelDrawService();

    try {
      const result = await pixelDrawService.handlePixelDraw(pixelData);

      console.log('✅ handlePixelDraw 调用完成');
      console.log('📥 返回结果:', JSON.stringify(result, null, 2));

      // 4. 检查批处理服务状态变化
      console.log('\n📊 handlePixelDraw调用后批处理状态:');
      console.log(`   像素队列: ${BatchPixelService.pixelBatch.length} 个像素`);
      console.log(`   历史队列: ${BatchPixelService.historyBatch.length} 个记录`);
      console.log(`   总批次数: ${BatchPixelService.stats.totalBatches}`);
      console.log(`   总处理像素: ${BatchPixelService.stats.totalPixelsProcessed}`);

      // 5. 手动触发批处理刷新
      console.log('\n🔄 手动触发批处理刷新...');
      const flushResult = await BatchPixelService.forceFlush();
      console.log('刷新结果:', flushResult);

      // 6. 最终检查
      console.log('\n📊 最终批处理状态:');
      console.log(`   像素队列: ${BatchPixelService.pixelBatch.length} 个像素`);
      console.log(`   总批次数: ${BatchPixelService.stats.totalBatches}`);

      // 7. 检查数据库
      console.log('\n🔍 检查数据库...');
      const { db } = require('../../backend/src/config/database');

      const pixelCount = await db('pixels').count('* as count').first();
      console.log(`✅ pixels表记录数: ${pixelCount.count}`);

      const historyCount = await db('pixels_history').count('* as count').first();
      console.log(`✅ pixels_history表记录数: ${historyCount.count}`);

      await db.destroy();

    } catch (drawError) {
      console.error('❌ handlePixelDraw 调用失败:', drawError.message);
      console.error('错误详情:', drawError.stack);
    }

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error(error.stack);
  }
}

testPixelDrawService();