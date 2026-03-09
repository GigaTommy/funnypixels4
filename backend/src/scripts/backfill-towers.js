/**
 * 回填历史像素数据生成塔
 */
const { db } = require('../config/database');
const TowerAggregationService = require('../services/towerAggregationService');

async function backfillTowers() {
  console.log('🚀 开始回填历史像素数据生成塔...\n');

  try {
    // 1. 清空现有塔数据（重新生成）
    await db('pixel_towers').del();
    await db('user_tower_floors').del();
    console.log('🗑️  已清空现有塔数据\n');

    // 2. 获取所有历史像素（按创建时间排序）
    const pixels = await db('pixels_history')
      .where('action_type', 'draw')
      .whereNotNull('tile_id')
      .whereNotNull('latitude')
      .whereNotNull('longitude')
      .orderBy('created_at', 'asc')
      .select('*');

    console.log(`📊 找到 ${pixels.length} 个历史像素\n`);

    if (pixels.length === 0) {
      console.log('❌ 没有历史数据需要回填');
      process.exit(0);
    }

    // 3. 逐个处理
    let processed = 0;
    const errors = [];

    for (const pixel of pixels) {
      try {
        await TowerAggregationService.onPixelDrawn({
          lat: pixel.latitude,
          lng: pixel.longitude,
          user_id: pixel.user_id,
          color: pixel.color,
          created_at: pixel.created_at,
          tile_id: pixel.tile_id
        });

        processed++;
        if (processed % 100 === 0) {
          console.log(`✅ 已处理 ${processed}/${pixels.length} 个像素 (${Math.round(processed/pixels.length*100)}%)`);
        }
      } catch (error) {
        errors.push({ pixel_id: pixel.id, error: error.message });
        if (errors.length < 10) {
          console.error(`⚠️  处理像素 ${pixel.id} 失败:`, error.message);
        }
      }
    }

    // 4. 统计结果
    const towerCount = await db('pixel_towers').count('* as count').first();
    const userFloorCount = await db('user_tower_floors').count('* as count').first();

    console.log(`\n🎉 回填完成！`);
    console.log(`📈 生成塔数量: ${towerCount.count}`);
    console.log(`👥 用户楼层记录: ${userFloorCount.count}`);
    console.log(`🔢 成功处理: ${processed} 个像素`);
    if (errors.length > 0) {
      console.log(`⚠️  失败: ${errors.length} 个像素`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ 回填失败:', error);
    process.exit(1);
  }
}

backfillTowers();
