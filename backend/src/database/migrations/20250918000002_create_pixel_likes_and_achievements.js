/**
 * 创建像素点赞和成就系统表
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    // 1. 创建pixel_likes表
    .createTableIfNotExists('pixel_likes', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('pixel_id', 50).notNullable(); // 像素ID，格式：px_x_y
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.uuid('pixel_owner_id').notNullable().references('id').inTable('users').onDelete('CASCADE'); // 像素所有者
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('deleted_at').nullable(); // 软删除支持取消点赞

      // 唯一约束：防止重复点赞
      table.unique(['pixel_id', 'user_id'], 'uk_pixel_likes_pixel_user');

      // 索引
      table.index(['pixel_id', 'deleted_at'], 'idx_pixel_likes_pixel');
      table.index(['user_id', 'created_at'], 'idx_pixel_likes_user_time');
      table.index(['pixel_owner_id', 'deleted_at'], 'idx_pixel_likes_owner');
    })

    // 2. 处理user_achievements表
    .raw(`
      -- 检查并创建user_achievements表，添加缺失的字段
      DO $$
      BEGIN
        -- 如果表不存在，创建它
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_achievements') THEN
          CREATE TABLE user_achievements (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            like_received_count BIGINT DEFAULT 0,
            like_given_count BIGINT DEFAULT 0,
            pixels_drawn_count BIGINT DEFAULT 0,
            days_active_count INTEGER DEFAULT 0,
            achievements_unlocked JSONB DEFAULT '[]',
            last_updated TIMESTAMP DEFAULT NOW(),
            created_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(user_id)
          );
        ELSE
          -- 如果表存在，添加缺失的字段
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_achievements' AND column_name = 'like_given_count') THEN
            ALTER TABLE user_achievements ADD COLUMN like_given_count BIGINT DEFAULT 0;
          END IF;

          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_achievements' AND column_name = 'pixels_drawn_count') THEN
            ALTER TABLE user_achievements ADD COLUMN pixels_drawn_count BIGINT DEFAULT 0;
          END IF;

          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_achievements' AND column_name = 'days_active_count') THEN
            ALTER TABLE user_achievements ADD COLUMN days_active_count INTEGER DEFAULT 0;
          END IF;

          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_achievements' AND column_name = 'achievements_unlocked') THEN
            ALTER TABLE user_achievements ADD COLUMN achievements_unlocked JSONB DEFAULT '[]';
          END IF;
        END IF;

        -- 添加索引（如果不存在）
        CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);

        -- 只在字段存在时创建索引
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_achievements' AND column_name = 'like_received_count') THEN
          CREATE INDEX IF NOT EXISTS idx_user_achievements_like_received ON user_achievements(like_received_count DESC);
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_achievements' AND column_name = 'like_given_count') THEN
          CREATE INDEX IF NOT EXISTS idx_user_achievements_like_given ON user_achievements(like_given_count DESC);
        END IF;
      END $$;
    `)

    // 3. 创建achievement_definitions表（成就定义）
    .createTableIfNotExists('achievement_definitions', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('key', 50).unique().notNullable(); // 成就唯一键
      table.string('name', 100).notNullable(); // 成就名称
      table.text('description').notNullable(); // 成就描述
      table.string('icon_url').nullable(); // 成就图标
      table.enum('category', ['likes', 'social', 'pixels', 'activity', 'special']).notNullable();
      table.enum('rarity', ['common', 'uncommon', 'rare', 'epic', 'legendary']).defaultTo('common');
      table.jsonb('criteria').notNullable(); // 解锁条件
      table.jsonb('rewards').defaultTo('{}'); // 奖励内容
      table.boolean('is_active').defaultTo(true);
      table.timestamp('created_at').defaultTo(knex.fn.now());

      // 索引
      table.index(['category', 'is_active'], 'idx_achievement_definitions_category');
      table.index(['rarity', 'is_active'], 'idx_achievement_definitions_rarity');
    })

    // 4. 创建user_achievement_progress表（成就进度跟踪）
    .createTableIfNotExists('user_achievement_progress', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.uuid('achievement_id').notNullable().references('id').inTable('achievement_definitions').onDelete('CASCADE');
      table.integer('current_progress').defaultTo(0);
      table.integer('target_progress').notNullable();
      table.boolean('is_completed').defaultTo(false);
      table.timestamp('completed_at').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      // 复合主键
      table.unique(['user_id', 'achievement_id'], 'uk_user_achievement_progress');

      // 索引
      table.index(['user_id', 'is_completed'], 'idx_user_achievement_progress_user');
      table.index(['achievement_id', 'is_completed'], 'idx_user_achievement_progress_achievement');
    })

    // 5. 插入基础成就定义
    .raw(`
      INSERT INTO achievement_definitions (key, name, description, category, rarity, criteria, rewards) VALUES
      -- 点赞相关成就
      ('first_like_received', '初次被赞', '收到第一个点赞', 'likes', 'common',
       '{"type": "like_received_count", "target": 1}',
       '{"points": 10, "title": "受欢迎的新手"}'),

      ('popular_pixel', '人气像素', '单个像素收到10个点赞', 'likes', 'uncommon',
       '{"type": "pixel_likes", "target": 10}',
       '{"points": 50, "badge": "popular_creator"}'),

      ('like_magnet', '点赞磁铁', '总共收到100个点赞', 'likes', 'rare',
       '{"type": "like_received_count", "target": 100}',
       '{"points": 200, "special_color": "#FFD700"}'),

      -- 社交相关成就
      ('social_butterfly', '社交达人', '关注50个用户', 'social', 'uncommon',
       '{"type": "following_count", "target": 50}',
       '{"points": 30, "profile_badge": "social"}'),

      ('influencer', '影响者', '拥有100个粉丝', 'social', 'rare',
       '{"type": "followers_count", "target": 100}',
       '{"points": 150, "special_title": "影响者"}'),

      -- 像素绘制相关成就
      ('pixel_artist', '像素艺术家', '绘制100个像素', 'pixels', 'common',
       '{"type": "pixels_drawn_count", "target": 100}',
       '{"points": 100, "brush_effect": "sparkle"}'),

      ('master_painter', '绘画大师', '绘制1000个像素', 'pixels', 'epic',
       '{"type": "pixels_drawn_count", "target": 1000}',
       '{"points": 500, "special_palette": "master_colors"}'),

      -- 活跃度相关成就
      ('daily_visitor', '每日访客', '连续7天活跃', 'activity', 'common',
       '{"type": "consecutive_days", "target": 7}',
       '{"points": 50, "daily_bonus": 1.1}'),

      ('dedicated_user', '忠实用户', '连续30天活跃', 'activity', 'rare',
       '{"type": "consecutive_days", "target": 30}',
       '{"points": 300, "vip_status": true}')

      ON CONFLICT (key) DO NOTHING;
    `);
};

/**
 * 回滚迁移
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema
    // 删除表
    .dropTableIfExists('user_achievement_progress')
    .dropTableIfExists('achievement_definitions')
    .dropTableIfExists('pixel_likes')
    .raw(`
      -- 清理user_achievements表中的新字段（如果存在）
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_achievements' AND column_name = 'like_given_count') THEN
          ALTER TABLE user_achievements DROP COLUMN like_given_count;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_achievements' AND column_name = 'pixels_drawn_count') THEN
          ALTER TABLE user_achievements DROP COLUMN pixels_drawn_count;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_achievements' AND column_name = 'days_active_count') THEN
          ALTER TABLE user_achievements DROP COLUMN days_active_count;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_achievements' AND column_name = 'achievements_unlocked') THEN
          ALTER TABLE user_achievements DROP COLUMN achievements_unlocked;
        END IF;
      END $$;
    `);
};