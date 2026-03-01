/**
 * Migration: 添加缺失的性能索引
 * 修复 profile、leaderboard、MVT 查询的慢查询问题
 */

exports.up = function(knex) {
  return knex.raw(`
    -- pattern_assets.key: MVT tile 查询 JOIN 使用
    CREATE INDEX IF NOT EXISTS idx_pattern_assets_key ON pattern_assets(key);

    -- privacy_settings.user_id: MVT 和 leaderboard 查询使用
    CREATE INDEX IF NOT EXISTS idx_privacy_settings_user_id ON privacy_settings(user_id);

    -- user_follows 复合索引: profile 关注数统计
    CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows(follower_id);
    CREATE INDEX IF NOT EXISTS idx_user_follows_following ON user_follows(following_id);

    -- user_likes 复合索引: profile 点赞查询
    CREATE INDEX IF NOT EXISTS idx_user_likes_user_target ON user_likes(user_id, target_type, target_id);
    CREATE INDEX IF NOT EXISTS idx_user_likes_target ON user_likes(target_type, target_id);

    -- alliance_members.user_id: profile 联盟查询
    CREATE INDEX IF NOT EXISTS idx_alliance_members_user_id ON alliance_members(user_id);
  `);
};

exports.down = function(knex) {
  return knex.raw(`
    DROP INDEX IF EXISTS idx_pattern_assets_key;
    DROP INDEX IF EXISTS idx_privacy_settings_user_id;
    DROP INDEX IF EXISTS idx_user_follows_follower;
    DROP INDEX IF EXISTS idx_user_follows_following;
    DROP INDEX IF EXISTS idx_user_likes_user_target;
    DROP INDEX IF EXISTS idx_user_likes_target;
    DROP INDEX IF EXISTS idx_alliance_members_user_id;
  `);
};
