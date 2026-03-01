/**
 * 每日打卡系统数据库迁移
 * 包括签到记录表和每日任务表
 */

exports.up = function(knex) {
  return knex.schema
    // 1. 用户签到记录表
    .createTableIfNotExists('user_checkins', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').notNullable()
        .references('id').inTable('users').onDelete('CASCADE');

      // 签到日期（使用date类型，便于查询）
      table.date('checkin_date').notNullable();

      // 签到时间（完整时间戳）
      table.timestamp('checkin_time').defaultTo(knex.fn.now());

      // 连续签到天数（快照）
      table.integer('consecutive_days').defaultTo(1);

      // 本次签到获得的奖励
      table.integer('coins_earned').defaultTo(10);

      // 额外奖励（连续签到奖励等）
      table.integer('bonus_coins').defaultTo(0);

      // 是否领取奖励
      table.boolean('reward_claimed').defaultTo(true);

      // 签到类型：normal, makeup（补签）
      table.string('checkin_type', 20).defaultTo('normal');

      // 元数据（可存储签到位置等）
      table.json('metadata');

      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      // 索引
      table.index(['user_id', 'checkin_date'], 'idx_user_checkin_date');
      table.index('checkin_date', 'idx_checkin_date');

      // 唯一约束：每个用户每天只能签到一次
      table.unique(['user_id', 'checkin_date'], 'unique_user_daily_checkin');
    })

    // 2. 用户签到统计表（聚合数据，提升查询性能）
    .createTableIfNotExists('user_checkin_stats', function(table) {
      table.uuid('user_id').notNullable().primary()
        .references('id').inTable('users').onDelete('CASCADE');

      // 当前连续签到天数
      table.integer('current_streak').defaultTo(0);

      // 最长连续签到天数
      table.integer('longest_streak').defaultTo(0);

      // 总签到天数
      table.integer('total_checkins').defaultTo(0);

      // 最后签到日期
      table.date('last_checkin_date');

      // 本月签到天数
      table.integer('monthly_checkins').defaultTo(0);

      // 本月重置时间（用于自动重置月度统计）
      table.date('monthly_reset_date');

      // 总获得星尘（通过签到）
      table.integer('total_coins_earned').defaultTo(0);

      // 补签次数
      table.integer('makeup_count').defaultTo(0);

      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.index('last_checkin_date', 'idx_last_checkin');
    })

    // 3. 每日任务表
    .createTableIfNotExists('daily_tasks', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

      // 任务标识（唯一）
      table.string('task_key', 50).notNullable().unique();

      // 任务名称
      table.string('task_name', 100).notNullable();

      // 任务描述
      table.text('task_description');

      // 任务类型：create（创作）, like（点赞）, share（分享）, explore（探索）
      table.string('task_type', 20).notNullable();

      // 目标数量（如：点赞3次）
      table.integer('target_count').defaultTo(1);

      // 奖励星尘
      table.integer('reward_coins').defaultTo(10);

      // 任务排序
      table.integer('sort_order').defaultTo(0);

      // 是否启用
      table.boolean('is_active').defaultTo(true);

      // 任务图标（可选）
      table.string('icon', 100);

      // 任务配置（JSON，可扩展）
      table.json('config');

      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.index('task_type', 'idx_task_type');
      table.index('is_active', 'idx_task_active');
    })

    // 4. 用户每日任务完成记录表
    .createTableIfNotExists('user_daily_task_progress', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

      table.uuid('user_id').notNullable()
        .references('id').inTable('users').onDelete('CASCADE');

      table.uuid('task_id').notNullable()
        .references('id').inTable('daily_tasks').onDelete('CASCADE');

      // 任务日期
      table.date('task_date').notNullable();

      // 当前进度
      table.integer('current_progress').defaultTo(0);

      // 目标进度
      table.integer('target_progress').notNullable();

      // 是否完成
      table.boolean('is_completed').defaultTo(false);

      // 完成时间
      table.timestamp('completed_at');

      // 是否领取奖励
      table.boolean('reward_claimed').defaultTo(false);

      // 领取时间
      table.timestamp('claimed_at');

      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      // 索引
      table.index(['user_id', 'task_date'], 'idx_user_task_date');
      table.index('task_date', 'idx_task_date');

      // 唯一约束：每个用户每天每个任务只有一条记录
      table.unique(['user_id', 'task_id', 'task_date'], 'unique_user_daily_task');
    })

    // 5. 签到奖励配置表（可动态调整奖励）
    .createTableIfNotExists('checkin_reward_rules', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

      // 规则类型：daily（每日）, streak（连续）, monthly（月度）
      table.string('rule_type', 20).notNullable();

      // 规则名称
      table.string('rule_name', 100).notNullable();

      // 触发条件（连续天数、月签到次数等）
      table.integer('trigger_value');

      // 奖励星尘
      table.integer('reward_coins').defaultTo(0);

      // 奖励钻石
      table.integer('reward_gems').defaultTo(0);

      // 奖励道具ID（可选）
      table.integer('reward_item_id').unsigned()
        .references('id').inTable('store_items').onDelete('SET NULL');

      // 奖励道具数量
      table.integer('reward_item_count').defaultTo(0);

      // 规则描述
      table.text('description');

      // 是否启用
      table.boolean('is_active').defaultTo(true);

      // 排序
      table.integer('sort_order').defaultTo(0);

      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.index(['rule_type', 'is_active'], 'idx_rule_type_active');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('checkin_reward_rules')
    .dropTableIfExists('user_daily_task_progress')
    .dropTableIfExists('daily_tasks')
    .dropTableIfExists('user_checkin_stats')
    .dropTableIfExists('user_checkins');
};
