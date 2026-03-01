#!/usr/bin/env node

/**
 * 直接检查批处理服务的状态
 */

const BatchPixelService = require('../../backend/src/services/batchPixelService');

async function checkBatchService() {
  try {
    console.log('🔍 检查批处理服务状态\n');

    // 获取批处理服务单例实例
    const batchService = BatchPixelService;

    console.log('📊 批处理服务配置:');
    console.log(`   批量大小: ${batchService.batchSize}`);
    console.log(`   刷新间隔: ${batchService.flushInterval}ms`);
    console.log(`   最大批量大小: ${batchService.maxBatchSize}`);

    console.log('\n📈 当前队列状态:');
    console.log(`   像素队列: ${batchService.pixelBatch.length} 个像素`);
    console.log(`   历史队列: ${batchService.historyBatch.length} 个记录`);
    console.log(`   缓存队列: ${batchService.cacheUpdateBatch.length} 个更新`);
    console.log(`   是否正在刷新: ${batchService.isFlushing}`);

    console.log('\n📊 性能统计:');
    console.log(`   总批次数: ${batchService.stats.totalBatches}`);
    console.log(`   总处理像素: ${batchService.stats.totalPixelsProcessed}`);
    console.log(`   总历史记录: ${batchService.stats.totalHistoryRecords}`);
    console.log(`   失败操作: ${batchService.stats.failedOperations}`);

    // 手动触发一次刷新
    console.log('\n🔄 手动触发刷新...');
    const flushResult = await batchService.forceFlush();
    console.log('刷新结果:', flushResult);

    console.log('\n✅ 批处理服务检查完成');

  } catch (error) {
    console.error('❌ 检查失败:', error.message);
    console.error(error.stack);
  }
}

checkBatchService();