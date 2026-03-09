/**
 * 回填历史像素数据生成塔
 */
const db = require('../src/db');
const TowerAggregationService = require('../src/services/towerAggregationService');

async function backfillTowers() {
  console.log('🚀 开始回填历史像素数据生成塔...\n');

  try {
    // 1. 获取所有历史像素（按tile_id分组）
    const pixels = await db('pixels_history')
      .where('action_type', 'draw')
      .whereNotNull('tile_id')
      .orderBy('created_at', 'asc')
      .select('*');

    console.log(`📊 找到 ${pixels.length} 个历史像素`);

    if (pixels.length === 0) {
      console.log('❌ 没有历史数据需要回填');
      process.exit(0);
    }

    // 2. 逐个处理
    let processed = 0;
    for (const pixel of pixels) {
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
        console.log(`✅ 已处理 ${processed}/${pixels.length} 个像素...`);
      }
    }

    // 3. 统计结果
    const towerCount = await db('pixel_towers').count('* as count').first();
    console.log(`\n🎉 回填完成！`);
    console.log(`📈 生成了 ${towerCount.count} 座塔`);
    console.log(`🔢 处理了 ${processed} 个像素`);

    process.exit(0);
  } catch (error) {
    console.error('❌ 回填失败:', error);
    process.exit(1);
  }
}

backfillTowers();
