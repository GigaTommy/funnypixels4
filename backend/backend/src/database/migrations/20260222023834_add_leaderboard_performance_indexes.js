/**
 * 添加排行榜性能优化索引
 *
 * 问题：排行榜查询在大数据量时性能下降，缺少覆盖索引
 * 解决方案：添加复合索引优化常见查询模式
 *
 * 影响的查询：
 * - GET /api/leaderboard/personal?period=daily&limit=50&offset=0
 * - GET /api/leaderboard/alliance?period=weekly
 * - GET /api/leaderboard/city?period=monthly
 */

exports.up = async function(knex) {
  console.log('🚀 开始添加排行榜性能优化索引...');

  try {
    // 1. 个人排行榜：period + period_start + rank 复合索引
    // 优化查询：WHERE period = ? AND period_start = ? ORDER BY rank
    console.log('📊 添加个人排行榜复合索引...');
    await knex.raw(`
      CREATE INDEX IF NOT EXISTS idx_leaderboard_personal_period_rank
      ON leaderboard_personal (period, period_start, rank)
    `);

    // 2. 联盟排行榜：period + period_start + rank 复合索引
    console.log('📊 添加联盟排行榜复合索引...');
    await knex.raw(`
      CREATE INDEX IF NOT EXISTS idx_leaderboard_alliance_period_rank
      ON leaderboard_alliance (period, period_start, rank)
    `);

    // 3. 地区排行榜：period + period_start + rank 复合索引
    console.log('📊 添加地区排行榜复合索引...');
    await knex.raw(`
      CREATE INDEX IF NOT EXISTS idx_leaderboard_region_period_rank
      ON leaderboard_region (period, period_start, rank)
    `);

    // 4. 个人排行榜：优化pixel_count排序（如果需要实时排序）
    console.log('📊 添加个人排行榜pixel_count索引...');
    await knex.raw(`
      CREATE INDEX IF NOT EXISTS idx_leaderboard_personal_pixels
      ON leaderboard_personal (period, period_start, pixel_count DESC)
    `);

    // 5. 优化用户查找自己的排名
    // 查询模式：WHERE user_id = ? AND period = ? AND period_start = ?
    console.log('📊 优化用户排名查询索引...');
    await knex.raw(`
      CREATE INDEX IF NOT EXISTS idx_leaderboard_personal_user_lookup
      ON leaderboard_personal (user_id, period, period_start)
      INCLUDE (rank, pixel_count)
    `);

    // 6. 优化联盟排名查询
    console.log('📊 优化联盟排名查询索引...');
    await knex.raw(`
      CREATE INDEX IF NOT EXISTS idx_leaderboard_alliance_lookup
      ON leaderboard_alliance (alliance_id, period, period_start)
      INCLUDE (rank, total_pixels)
    `);

    console.log('✅ 排行榜性能优化索引添加完成');
    console.log('');
    console.log('📈 预期性能提升：');
    console.log('  - 排行榜分页查询: 5-10x faster (特别是大offset)');
    console.log('  - 用户排名查询: 3-5x faster');
    console.log('  - 减少全表扫描，改用索引扫描');

  } catch (error) {
    console.error('❌ 添加排行榜索引失败:', error);
    throw error;
  }
};

exports.down = async function(knex) {
  console.log('🔄 开始回滚排行榜性能索引...');

  try {
    const indexes = [
      'idx_leaderboard_personal_period_rank',
      'idx_leaderboard_alliance_period_rank',
      'idx_leaderboard_region_period_rank',
      'idx_leaderboard_personal_pixels',
      'idx_leaderboard_personal_user_lookup',
      'idx_leaderboard_alliance_lookup'
    ];

    for (const indexName of indexes) {
      try {
        await knex.raw(`DROP INDEX IF EXISTS ${indexName}`);
        console.log(`✅ 删除索引: ${indexName}`);
      } catch (error) {
        console.warn(`⚠️ 删除索引失败: ${indexName}`, error.message);
      }
    }

    console.log('✅ 排行榜性能索引回滚完成');

  } catch (error) {
    console.error('❌ 回滚排行榜索引失败:', error);
    throw error;
  }
};
