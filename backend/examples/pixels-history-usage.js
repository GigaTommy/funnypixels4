/**
 * 像素历史系统使用示例
 * 演示如何使用像素历史服务的各种功能
 */

const pixelsHistoryService = require('../src/services/pixelsHistoryService');

async function demonstrateUsage() {
  console.log('🎯 像素历史系统使用示例');
  console.log('='.repeat(50));

  try {
    // 1. 记录单个像素历史
    console.log('\n1. 记录单个像素历史');
    const pixelData = {
      latitude: 39.9042,
      longitude: 116.4074,
      color: '#FF0000',
      user_id: '550e8400-e29b-41d4-a716-446655440000',
      grid_id: 'grid_123_456',
      pattern_id: 'emoji_heart',
      pattern_anchor_x: 0,
      pattern_anchor_y: 0,
      pattern_rotation: 0,
      pattern_mirror: false
    };

    const result1 = await pixelsHistoryService.recordPixelHistory(
      pixelData,
      'draw',
      { version: 1 }
    );
    console.log('✅ 单个像素历史记录结果:', result1.message);

    // 2. 批量记录像素历史
    console.log('\n2. 批量记录像素历史');
    const batchPixels = [
      {
        latitude: 39.9042,
        longitude: 116.4074,
        color: '#FF0000',
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        grid_id: 'grid_123_456'
      },
      {
        latitude: 39.9043,
        longitude: 116.4075,
        color: '#00FF00',
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        grid_id: 'grid_123_457'
      },
      {
        latitude: 39.9044,
        longitude: 116.4076,
        color: '#0000FF',
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        grid_id: 'grid_123_458'
      }
    ];

    const result2 = await pixelsHistoryService.batchRecordPixelHistory(
      batchPixels,
      'bomb',
      { regionId: 1 }
    );
    console.log('✅ 批量像素历史记录结果:', result2.message);

    // 3. 异步记录像素历史
    console.log('\n3. 异步记录像素历史');
    const result3 = await pixelsHistoryService.asyncRecordPixelHistory(
      pixelData,
      'draw',
      { version: 1 }
    );
    console.log('✅ 异步像素历史记录结果:', result3.message);

    // 4. 获取用户像素历史
    console.log('\n4. 获取用户像素历史');
    const userHistory = await pixelsHistoryService.getUserPixelHistory('550e8400-e29b-41d4-a716-446655440000', {
      limit: 10,
      offset: 0
    });
    console.log('✅ 用户历史记录数量:', userHistory.data.length);

    // 5. 获取像素位置历史
    console.log('\n5. 获取像素位置历史');
    const locationHistory = await pixelsHistoryService.getPixelLocationHistory(
      'grid_123_456',
      { limit: 5 }
    );
    console.log('✅ 位置历史记录数量:', locationHistory.data.length);

    // 6. 获取用户行为统计
    console.log('\n6. 获取用户行为统计');
    const userStats = await pixelsHistoryService.getUserBehaviorStats('550e8400-e29b-41d4-a716-446655440000', {
      startDate: '2025-01-01',
      endDate: '2025-01-31'
    });
    console.log('✅ 用户行为统计:', userStats.data);

    // 7. 获取区域活跃度统计
    console.log('\n7. 获取区域活跃度统计');
    const regionStats = await pixelsHistoryService.getRegionActivityStats({
      startDate: '2025-01-01',
      endDate: '2025-01-31'
    });
    console.log('✅ 区域活跃度统计记录数量:', regionStats.data.length);

    // 8. 处理队列
    console.log('\n8. 处理队列中的历史记录');
    const queueResult = await pixelsHistoryService.processQueue();
    console.log('✅ 队列处理结果:', queueResult.message);

    // 9. 创建月度分区
    console.log('\n9. 创建月度分区');
    const partitionResult = await pixelsHistoryService.createMonthlyPartition(
      new Date('2025-02-01')
    );
    console.log('✅ 分区创建结果:', partitionResult.message);

    // 10. 获取统计信息
    console.log('\n10. 获取统计信息');
    const statsResult = await pixelsHistoryService.getUserBehaviorStats('550e8400-e29b-41d4-a716-446655440000');
    console.log('✅ 统计信息:', {
      totalPixels: statsResult.data.total_pixels,
      activeDays: statsResult.data.active_days,
      uniqueLocations: statsResult.data.unique_locations
    });

    console.log('\n🎉 所有示例执行完成！');

  } catch (error) {
    console.error('❌ 示例执行失败:', error);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  demonstrateUsage()
    .then(() => {
      console.log('\n✅ 示例执行完成');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ 示例执行失败:', error);
      process.exit(1);
    });
}

module.exports = { demonstrateUsage };
