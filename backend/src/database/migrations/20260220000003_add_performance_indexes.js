/**
 * 性能优化索引：为高频查询添加复合索引
 * - pixels_history: (user_id, history_date) 用于仪表盘统计
 * - leaderboard_personal: (period, period_start, rank) 用于排行榜分页
 * - leaderboard_alliance: (period, period_start, rank) 用于联盟排行
 * - feed_items: (created_at DESC) 用于最新动态
 */
exports.up = async function(knex) {
  // 1. pixels_history 复合索引
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_pixels_history_user_date
    ON pixels_history (user_id, history_date DESC)
  `);

  // 2. leaderboard_personal 复合索引
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_leaderboard_personal_period_rank
    ON leaderboard_personal (period, period_start, rank)
  `);

  // 3. leaderboard_alliance 复合索引
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_leaderboard_alliance_period_rank
    ON leaderboard_alliance (period, period_start, rank)
  `);

  // 4. feed_items 最新动态索引
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_feed_items_created_desc
    ON feed_items (created_at DESC)
  `);
};

exports.down = async function(knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_pixels_history_user_date');
  await knex.raw('DROP INDEX IF EXISTS idx_leaderboard_personal_period_rank');
  await knex.raw('DROP INDEX IF EXISTS idx_leaderboard_alliance_period_rank');
  await knex.raw('DROP INDEX IF EXISTS idx_feed_items_created_desc');
};
