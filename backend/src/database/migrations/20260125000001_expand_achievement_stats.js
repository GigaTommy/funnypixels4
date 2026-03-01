/**
 * 扩展用户成就统计字段
 * 添加GPS会话、联盟贡献、商店购买等统计
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.raw(`
    DO $$
    BEGIN
      -- 添加GPS会话统计
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_achievements' AND column_name = 'gps_sessions_count') THEN
        ALTER TABLE user_achievements ADD COLUMN gps_sessions_count BIGINT DEFAULT 0;
      END IF;

      -- 添加联盟贡献统计
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_achievements' AND column_name = 'alliance_contributions') THEN
        ALTER TABLE user_achievements ADD COLUMN alliance_contributions BIGINT DEFAULT 0;
      END IF;

      -- 添加商店购买统计
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_achievements' AND column_name = 'shop_purchases_count') THEN
        ALTER TABLE user_achievements ADD COLUMN shop_purchases_count BIGINT DEFAULT 0;
      END IF;

      -- 添加updated_at字段（如果不存在）
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_achievements' AND column_name = 'updated_at') THEN
        ALTER TABLE user_achievements ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
      END IF;

      -- 创建索引以优化查询
      CREATE INDEX IF NOT EXISTS idx_user_achievements_gps_sessions ON user_achievements(gps_sessions_count DESC);
      CREATE INDEX IF NOT EXISTS idx_user_achievements_alliance ON user_achievements(alliance_contributions DESC);
      CREATE INDEX IF NOT EXISTS idx_user_achievements_shop ON user_achievements(shop_purchases_count DESC);
    END $$;
  `);
};

/**
 * 回滚迁移
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.raw(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_achievements' AND column_name = 'gps_sessions_count') THEN
        ALTER TABLE user_achievements DROP COLUMN gps_sessions_count;
      END IF;

      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_achievements' AND column_name = 'alliance_contributions') THEN
        ALTER TABLE user_achievements DROP COLUMN alliance_contributions;
      END IF;

      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_achievements' AND column_name = 'shop_purchases_count') THEN
        ALTER TABLE user_achievements DROP COLUMN shop_purchases_count;
      END IF;

      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_achievements' AND column_name = 'updated_at') THEN
        ALTER TABLE user_achievements DROP COLUMN updated_at;
      END IF;
    END $$;
  `);
};
