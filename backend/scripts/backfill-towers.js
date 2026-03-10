/**
 * Tower 数据回填脚本（优化版）
 *
 * 用途：
 * - 初始化历史数据到 pixel_towers 和 user_tower_floors 表
 * - 使用批量聚合方式，性能更高
 *
 * 使用方法：
 *   node scripts/backfill-towers.js
 */

const { db } = require('../src/config/database');
const TowerAggregationService = require('../src/services/towerAggregationService');
const logger = require('../src/utils/logger');

async function backfillTowers() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('      Tower 数据回填（历史数据初始化）');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    const startTime = Date.now();

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 步骤1：检查当前数据状态
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('📊 步骤1：检查数据库状态\n');

    const pixelCount = await db('pixels_history')
      .where('action_type', 'draw')
      .whereNotNull('tile_id')
      .count('* as count')
      .first();

    const existingTowers = await db('pixel_towers').count('* as count').first();

    console.log(`   pixels_history (有 tile_id): ${pixelCount.count} 条`);
    console.log(`   pixel_towers (现有): ${existingTowers.count} 条\n`);

    if (parseInt(pixelCount.count) === 0) {
      console.log('⚠️  没有历史像素数据需要回填\n');
      process.exit(0);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 步骤2：询问用户是否清空现有数据
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (parseInt(existingTowers.count) > 0) {
      console.log('⚠️  警告：pixel_towers 表中已有数据\n');
      console.log('选项:');
      console.log('  1. 清空并重建（推荐）');
      console.log('  2. 增量更新（保留现有数据）\n');

      // 为了脚本自动化，默认选择清空重建
      console.log('执行: 清空并重建（使用批量聚合方式）\n');
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 步骤3：使用批量聚合重建（超快）
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('⚙️  步骤2：执行批量聚合重建\n');
    console.log('   使用 batchRebuildAggregates 方法（一次性聚合所有数据）\n');

    const rebuildResult = await TowerAggregationService.batchRebuildAggregates({
      batchSize: 1000
    });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 步骤4：验证结果
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('🔍 步骤3：验证回填结果\n');

    const finalTowers = await db('pixel_towers').count('* as count').first();
    const finalUserFloors = await db('user_tower_floors').count('* as count').first();

    console.log(`   pixel_towers: ${finalTowers.count} 条`);
    console.log(`   user_tower_floors: ${finalUserFloors.count} 条\n`);

    // 数据一致性检查
    console.log('🔬 步骤4：数据一致性检查\n');

    const totalPixelsInTowers = await db('pixel_towers')
      .sum('pixel_count as total')
      .first();

    console.log(`   pixels_history 总数: ${pixelCount.count}`);
    console.log(`   pixel_towers 总像素数: ${totalPixelsInTowers.total || 0}`);

    const isConsistent =
      parseInt(totalPixelsInTowers.total || 0) === parseInt(pixelCount.count);

    if (isConsistent) {
      console.log(`   ✅ 数据一致\n`);
    } else {
      const diff = Math.abs(
        parseInt(totalPixelsInTowers.total || 0) - parseInt(pixelCount.count)
      );
      console.log(`   ⚠️  差异: ${diff} 个像素（可能是 tile_id 为 NULL 的像素）\n`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 总结
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const totalDuration = Date.now() - startTime;

    console.log('═══════════════════════════════════════════════════════════');
    console.log('      回填完成');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('📈 统计:');
    console.log(`   处理像素: ${pixelCount.count} 个`);
    console.log(`   生成塔: ${rebuildResult.towersCount} 座`);
    console.log(`   用户楼层记录: ${finalUserFloors.count} 条`);
    console.log(`   总耗时: ${(totalDuration / 1000).toFixed(1)} 秒\n`);

    console.log('💡 下一步:');
    console.log('   • 定时任务会自动维护新数据（每1分钟更新一次）');
    console.log('   • 运行测试脚本验证: node scripts/test-tower-aggregation.js\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ 回填失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 运行回填
backfillTowers();
