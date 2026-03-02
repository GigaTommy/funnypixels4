#!/usr/bin/env node

/**
 * 清理 pixels_history 表中的重复记录
 * 对于相同 grid_id、user_id、history_date 的记录，保留有地理信息的那条
 */

const knex = require('knex')(require('../knexfile').development);
const logger = require('../src/utils/logger');

async function cleanupDuplicates() {
  console.log('=== 开始清理 pixels_history 重复记录 ===\n');

  try {
    // 查找所有重复的记录（按 grid_id, user_id, history_date 分组）
    const duplicates = await knex.raw(`
      SELECT
        grid_id,
        user_id,
        history_date,
        COUNT(*) as count,
        ARRAY_AGG(id ORDER BY city IS NOT NULL DESC, geocoded DESC, id) as ids
      FROM pixels_history
      WHERE history_date = CURRENT_DATE
      GROUP BY grid_id, user_id, history_date
      HAVING COUNT(*) > 1
    `);

    const duplicateGroups = duplicates.rows;

    if (duplicateGroups.length === 0) {
      console.log('✅ 没有发现重复记录');
      await knex.destroy();
      return;
    }

    console.log(`⚠️  发现 ${duplicateGroups.length} 组重复记录\n`);

    let totalDeleted = 0;

    for (const group of duplicateGroups) {
      const ids = group.ids;
      const keepId = ids[0]; // 第一个ID是有地理信息的（ORDER BY city IS NOT NULL DESC）
      const deleteIds = ids.slice(1); // 其他的都删除

      console.log(`处理 grid_id=${group.grid_id} (${group.count} 条记录)`);
      console.log(`  保留: id=${keepId}`);
      console.log(`  删除: ${deleteIds.join(', ')}`);

      // 删除重复记录
      const deleted = await knex('pixels_history')
        .whereIn('id', deleteIds)
        .delete();

      totalDeleted += deleted;
      console.log(`  ✅ 已删除 ${deleted} 条\n`);
    }

    console.log(`\n📊 清理完成:`);
    console.log(`   处理组数: ${duplicateGroups.length}`);
    console.log(`   删除记录: ${totalDeleted} 条`);

  } catch (error) {
    console.error('❌ 清理失败:', error);
  } finally {
    await knex.destroy();
  }
}

cleanupDuplicates();
