/**
 * 手动添加排行榜性能索引脚本
 * 用于直接执行索引创建，不依赖迁移系统
 */

const { db } = require('../src/config/database');

async function addIndexes() {
  console.log('🚀 开始添加排行榜性能优化索引...\n');

  try {
    // 1. 个人排行榜：period + period_start + rank 复合索引
    console.log('📊 添加个人排行榜复合索引...');
    await db.raw(`
      CREATE INDEX IF NOT EXISTS idx_leaderboard_personal_period_rank
      ON leaderboard_personal (period, period_start, rank)
    `);
    console.log('✅ idx_leaderboard_personal_period_rank');

    // 2. 联盟排行榜：period + period_start + rank 复合索引
    console.log('\n📊 添加联盟排行榜复合索引...');
    await db.raw(`
      CREATE INDEX IF NOT EXISTS idx_leaderboard_alliance_period_rank
      ON leaderboard_alliance (period, period_start, rank)
    `);
    console.log('✅ idx_leaderboard_alliance_period_rank');

    // 3. 地区排行榜：period + period_start + rank 复合索引
    console.log('\n📊 添加地区排行榜复合索引...');
    await db.raw(`
      CREATE INDEX IF NOT EXISTS idx_leaderboard_region_period_rank
      ON leaderboard_region (period, period_start, rank)
    `);
    console.log('✅ idx_leaderboard_region_period_rank');

    // 4. 个人排行榜：优化pixel_count排序
    console.log('\n📊 添加个人排行榜pixel_count索引...');
    await db.raw(`
      CREATE INDEX IF NOT EXISTS idx_leaderboard_personal_pixels
      ON leaderboard_personal (period, period_start, pixel_count DESC)
    `);
    console.log('✅ idx_leaderboard_personal_pixels');

    // 5. 优化用户查找自己的排名（使用INCLUDE需要PostgreSQL 11+）
    console.log('\n📊 优化用户排名查询索引...');
    try {
      await db.raw(`
        CREATE INDEX IF NOT EXISTS idx_leaderboard_personal_user_lookup
        ON leaderboard_personal (user_id, period, period_start)
        INCLUDE (rank, pixel_count)
      `);
      console.log('✅ idx_leaderboard_personal_user_lookup (with INCLUDE)');
    } catch (error) {
      // 如果INCLUDE不支持，使用普通复合索引
      console.log('⚠️  INCLUDE clause not supported, using regular composite index');
      await db.raw(`
        CREATE INDEX IF NOT EXISTS idx_leaderboard_personal_user_lookup
        ON leaderboard_personal (user_id, period, period_start, rank, pixel_count)
      `);
      console.log('✅ idx_leaderboard_personal_user_lookup (composite)');
    }

    // 6. 优化联盟排名查询
    console.log('\n📊 优化联盟排名查询索引...');
    try {
      await db.raw(`
        CREATE INDEX IF NOT EXISTS idx_leaderboard_alliance_lookup
        ON leaderboard_alliance (alliance_id, period, period_start)
        INCLUDE (rank, total_pixels)
      `);
      console.log('✅ idx_leaderboard_alliance_lookup (with INCLUDE)');
    } catch (error) {
      console.log('⚠️  INCLUDE clause not supported, using regular composite index');
      await db.raw(`
        CREATE INDEX IF NOT EXISTS idx_leaderboard_alliance_lookup
        ON leaderboard_alliance (alliance_id, period, period_start, rank, total_pixels)
      `);
      console.log('✅ idx_leaderboard_alliance_lookup (composite)');
    }

    console.log('\n\n✅ 所有排行榜性能优化索引添加完成！');
    console.log('\n📈 预期性能提升：');
    console.log('  - 排行榜分页查询: 5-10x faster (特别是大offset)');
    console.log('  - 用户排名查询: 3-5x faster');
    console.log('  - 减少全表扫描，改用索引扫描\n');

    // 显示索引信息
    console.log('📊 验证索引创建结果：');
    const result = await db.raw(`
      SELECT
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename IN ('leaderboard_personal', 'leaderboard_alliance', 'leaderboard_region')
        AND indexname LIKE 'idx_leaderboard%'
      ORDER BY tablename, indexname
    `);

    console.log('\n已创建的索引:');
    result.rows.forEach(row => {
      console.log(`  - ${row.tablename}.${row.indexname}`);
    });

  } catch (error) {
    console.error('\n❌ 添加排行榜索引失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

// 运行脚本
addIndexes().then(() => {
  console.log('\n🎉 脚本执行完成！');
  process.exit(0);
}).catch(error => {
  console.error('❌ 脚本执行失败:', error);
  process.exit(1);
});
