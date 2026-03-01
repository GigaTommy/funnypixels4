/**
 * Migration: Viral Marketing and VIP System
 * Date: 2026-02-16
 *
 * 添加病毒式营销和VIP会员体系所需的数据库表
 */

exports.up = function(knex) {
  return knex.schema
    // 1. 分享追踪表
    .createTable('share_tracking', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.string('share_type', 50).notNullable(); // 'session', 'achievement', 'profile', 'footprint'
      table.string('share_target', 50).notNullable(); // 'wechat', 'weibo', 'xiaohongshu', 'system', 'reddit', 'x'
      table.uuid('session_id').nullable().references('id').inTable('drawing_sessions').onDelete('SET NULL');
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index(['user_id', 'created_at']);
      table.index(['share_type', 'created_at']);
    })

    // 2. 分享点击追踪表
    .createTable('share_clicks', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.uuid('sharer_id').references('id').inTable('users').onDelete('CASCADE');
      table.string('referral_code', 20).nullable();
      table.string('share_type', 50).notNullable();
      table.uuid('session_id').nullable();
      table.string('ip_address', 50).nullable();
      table.string('user_agent', 255).nullable();
      table.boolean('converted').defaultTo(false); // 是否转化为注册用户
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index(['sharer_id', 'created_at']);
      table.index(['referral_code']);
    })

    // 3. VIP订阅表
    .createTable('vip_subscriptions', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.string('tier', 20).notNullable(); // 'normal', 'premium', 'elite'
      table.timestamp('start_date').notNullable();
      table.timestamp('end_date').notNullable();
      table.boolean('is_active').defaultTo(true);
      table.string('payment_method', 50).nullable(); // 'wechat_pay', 'alipay', 'apple_pay', 'milestone_reward'
      table.string('source', 50).nullable(); // 'purchase', 'trial', 'milestone_reward', 'gift'
      table.decimal('amount_rmb', 10, 2).nullable();
      table.string('order_id', 100).nullable();
      table.boolean('auto_renew').defaultTo(false);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.index(['user_id', 'is_active', 'end_date']);
      table.index(['tier', 'is_active']);
    })

    // 4. VIP每日签到领取记录
    .createTable('vip_daily_claims', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.string('tier', 20).notNullable();
      table.integer('points_claimed').notNullable();
      table.date('claim_date').notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.unique(['user_id', 'claim_date']);
      table.index(['user_id', 'claim_date']);
    })

    // 5. 扩展 referrals 表（添加分层和二级邀请字段）
    .table('referrals', function(table) {
      table.integer('tier_level').nullable(); // 1, 2, 3, 4
      table.boolean('is_second_level').defaultTo(false); // 是否是二级邀请
      table.index(['inviter_id', 'is_second_level']);
    })

    // 6. 用户成就表（如果不存在）
    .raw(`
      CREATE TABLE IF NOT EXISTS user_achievements (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        achievement_id VARCHAR(100) NOT NULL,
        earned_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, achievement_id)
      );
      CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id, earned_at);
    `)

    // 7. 广告分成表
    .createTable('ad_performance', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.uuid('ad_id').nullable(); // 暂时允许为空，后续可以关联 ad_orders
      table.uuid('creator_id').references('id').inTable('users').onDelete('CASCADE');
      table.string('metric_type', 20).notNullable(); // 'impression', 'click', 'conversion'
      table.integer('metric_value').defaultTo(1);
      table.decimal('revenue_share', 10, 2).defaultTo(0); // 创作者分成金额
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index(['creator_id', 'created_at']);
      table.index(['ad_id', 'metric_type']);
    })

    // 8. A/B测试记录表
    .createTable('ab_tests', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.string('experiment_name', 100).notNullable();
      table.string('variant', 50).notNullable(); // 'control', 'variant_a', 'variant_b', etc.
      table.timestamp('assigned_at').defaultTo(knex.fn.now());
      table.jsonb('metadata').nullable(); // 额外数据

      table.index(['experiment_name', 'variant']);
      table.index(['user_id', 'experiment_name']);
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('ab_tests')
    .dropTableIfExists('ad_performance')
    .dropTableIfExists('user_achievements')
    .table('referrals', function(table) {
      table.dropColumn('tier_level');
      table.dropColumn('is_second_level');
    })
    .dropTableIfExists('vip_daily_claims')
    .dropTableIfExists('vip_subscriptions')
    .dropTableIfExists('share_clicks')
    .dropTableIfExists('share_tracking');
};
