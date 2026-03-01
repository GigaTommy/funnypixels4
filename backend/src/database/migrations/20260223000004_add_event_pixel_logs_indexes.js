/**
 * P0-3: 为活动像素日志添加性能索引
 *
 * 背景：贡献统计查询需要快速聚合event_pixel_logs
 * 场景：用户查看个人贡献统计、联盟排名时需要高性能查询
 * 解决方案：添加复合索引优化聚合查询
 */

exports.up = async function(knex) {
  console.log('🚀 开始添加活动像素日志索引...');

  try {
    // 1. 添加event_id + user_id复合索引（用于个人贡献查询）
    console.log('📊 添加event_id + user_id复合索引...');
    await knex.raw(`
      CREATE INDEX IF NOT EXISTS idx_event_pixel_logs_event_user
      ON event_pixel_logs (event_id, user_id)
    `);
    console.log('✅ idx_event_pixel_logs_event_user创建成功');

    // 2. 添加event_id + alliance_id复合索引（用于联盟排名查询）
    console.log('📊 添加event_id + alliance_id复合索引...');
    await knex.raw(`
      CREATE INDEX IF NOT EXISTS idx_event_pixel_logs_event_alliance
      ON event_pixel_logs (event_id, alliance_id)
      WHERE alliance_id IS NOT NULL
    `);
    console.log('✅ idx_event_pixel_logs_event_alliance创建成功');

    // 3. 添加event_id + created_at索引（用于时间序列查询）
    console.log('📊 添加event_id + created_at索引...');
    await knex.raw(`
      CREATE INDEX IF NOT EXISTS idx_event_pixel_logs_event_time
      ON event_pixel_logs (event_id, created_at DESC)
    `);
    console.log('✅ idx_event_pixel_logs_event_time创建成功');

    // 4. 查询性能提升分析
    console.log('');
    console.log('✅ 活动像素日志索引添加完成！');
    console.log('📈 预期性能提升:');
    console.log('  - 个人贡献查询: 10-50倍加速');
    console.log('  - 联盟排名查询: 20-100倍加速');
    console.log('  - 时间序列查询: 5-20倍加速');
    console.log('');
    console.log('💡 优化的查询场景:');
    console.log('  - SELECT COUNT(*) FROM event_pixel_logs WHERE event_id=? AND user_id=?');
    console.log('  - SELECT user_id, COUNT(*) FROM event_pixel_logs WHERE event_id=? GROUP BY user_id');
    console.log('  - SELECT alliance_id, COUNT(*) FROM event_pixel_logs WHERE event_id=? AND alliance_id IS NOT NULL GROUP BY alliance_id');

  } catch (error) {
    console.error('❌ 添加索引失败:', error);
    throw error;
  }
};

exports.down = async function(knex) {
  console.log('🔄 开始回滚活动像素日志索引...');

  try {
    await knex.raw('DROP INDEX IF EXISTS idx_event_pixel_logs_event_user');
    console.log('✅ 删除索引: idx_event_pixel_logs_event_user');

    await knex.raw('DROP INDEX IF EXISTS idx_event_pixel_logs_event_alliance');
    console.log('✅ 删除索引: idx_event_pixel_logs_event_alliance');

    await knex.raw('DROP INDEX IF EXISTS idx_event_pixel_logs_event_time');
    console.log('✅ 删除索引: idx_event_pixel_logs_event_time');

    console.log('✅ 活动像素日志索引回滚完成');

  } catch (error) {
    console.error('❌ 回滚索引失败:', error);
    throw error;
  }
};
