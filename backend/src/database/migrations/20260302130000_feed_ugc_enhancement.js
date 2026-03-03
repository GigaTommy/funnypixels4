/**
 * Migration: Feed UGC Enhancement
 * Date: 2026-03-02
 *
 * 扩展动态模块，支持用户生成内容（UGC）和社交功能增强
 */

exports.up = function(knex) {
  return knex.schema
    // 1. 创建话题标签多语言映射表（独立表，先创建）
    .createTable('hashtag_mappings', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.string('canonical_tag', 50).notNullable(); // 规范标签（英文小写）
      table.string('language', 10).notNullable(); // 'en', 'zh-Hans', 'ja', 'de'
      table.string('localized_tag', 50).notNullable(); // 本地化标签
      table.integer('usage_count').defaultTo(0);
      table.timestamp('last_used_at').defaultTo(knex.fn.now());
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.unique(['canonical_tag', 'language']);
      table.index('canonical_tag');
      table.index('localized_tag');
      table.index('usage_count');
    })

    // 2. 创建挑战活动表（独立表，先创建）
    .createTable('challenges', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));

      // 多语言标题和描述
      table.jsonb('title').notNullable();
      // 示例: {"en": "Spring Festival Challenge", "zh": "春节创作挑战"}

      table.jsonb('description').nullable();
      // 示例: {"en": "Create pixel art...", "zh": "创作像素艺术..."}

      // 主题图片
      table.string('theme_image_url', 500).nullable();

      // 时间范围
      table.timestamp('start_time').notNullable();
      table.timestamp('end_time').notNullable();

      // 规则和奖励
      table.jsonb('rules').nullable();
      table.jsonb('rewards').nullable();

      // 创建者
      table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');

      // 状态
      table.string('status', 20).defaultTo('active'); // 'active', 'ended', 'draft'

      // 参与人数（冗余字段，提升性能）
      table.integer('participant_count').defaultTo(0);

      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.index(['status', 'start_time']);
      table.index('end_time');
      table.index('created_by');
    })

    // 3. 创建挑战参与记录表
    .createTable('challenge_participations', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.uuid('challenge_id').notNullable().references('id').inTable('challenges').onDelete('CASCADE');
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.uuid('session_id').nullable().references('id').inTable('drawing_sessions').onDelete('SET NULL');
      table.uuid('feed_item_id').nullable().references('id').inTable('feed_items').onDelete('SET NULL');
      table.timestamp('submitted_at').defaultTo(knex.fn.now());
      table.integer('votes').defaultTo(0); // 投票数（用于排行榜）

      table.unique(['challenge_id', 'user_id']); // 每个用户只能参与一次
      table.index('challenge_id');
      table.index('user_id');
      table.index(['challenge_id', 'votes']); // 排行榜查询
    })

    // 4. 创建动态收藏表
    .createTable('feed_bookmarks', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.uuid('feed_item_id').notNullable().references('id').inTable('feed_items').onDelete('CASCADE');
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.unique(['user_id', 'feed_item_id']); // 防止重复收藏
      table.index('user_id');
      table.index(['user_id', 'created_at']); // 收藏列表查询
    })

    // 5. 创建投票记录表
    .createTable('poll_votes', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.uuid('feed_item_id').notNullable().references('id').inTable('feed_items').onDelete('CASCADE');
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.integer('option_index').notNullable(); // 选择的选项索引
      table.timestamp('voted_at').defaultTo(knex.fn.now());

      table.unique(['feed_item_id', 'user_id']); // 每个用户只能投票一次
      table.index('feed_item_id');
      table.index('user_id');
    })

    // 注意：reports表已在之前的迁移中创建（20250918000003_create_reports_system.js）

    // 6. 扩展 feed_items 表（最后执行，因为依赖challenges表）
    .alterTable('feed_items', function(table) {
      // 媒体文件（图片、视频）
      table.jsonb('media').nullable();
      // 示例: [{"type": "image", "url": "...", "thumbnail": "..."}, ...]

      // 话题标签（规范化后的标签）
      table.specificType('hashtags', 'TEXT[]').nullable();

      // 位置名称（显示用）
      table.string('location_name', 200).nullable();

      // 投票数据
      table.jsonb('poll_data').nullable();
      // 示例: {"question": "...", "options": ["A", "B"], "votes": [10, 20], "end_time": "..."}

      // 关联挑战ID
      table.uuid('challenge_id').nullable().references('id').inTable('challenges').onDelete('SET NULL');

      // 是否精选
      table.boolean('is_featured').defaultTo(false);

      // 热度分数（用于推荐算法）
      table.integer('engagement_score').defaultTo(0);

      // 添加索引
      table.index('hashtags', 'feed_items_hashtags_gin', 'GIN');
      table.index('engagement_score');
      table.index('is_featured');
    });
};

exports.down = function(knex) {
  return knex.schema
    // 1. 先删除 feed_items 的扩展字段（移除外键依赖）
    .alterTable('feed_items', function(table) {
      table.dropColumn('media');
      table.dropColumn('hashtags');
      table.dropColumn('location_name');
      table.dropColumn('poll_data');
      table.dropColumn('challenge_id');
      table.dropColumn('is_featured');
      table.dropColumn('engagement_score');
    })
    // 2. 删除依赖表（注意：reports表不在此迁移中创建，不要删除）
    .dropTableIfExists('poll_votes')
    .dropTableIfExists('feed_bookmarks')
    .dropTableIfExists('challenge_participations')
    // 3. 删除主表
    .dropTableIfExists('challenges')
    .dropTableIfExists('hashtag_mappings');
};
