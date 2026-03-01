/**
 * 创建举报系统表
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    // 1. 创建举报表
    .createTableIfNotExists('reports', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('reporter_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.enum('target_type', ['pixel', 'user', 'message']).notNullable();
      table.string('target_id', 100).notNullable(); // 被举报对象的ID
      table.enum('reason', ['porn', 'violence', 'political', 'spam', 'abuse', 'hate_speech', 'inappropriate', 'other']).notNullable();
      table.text('description').nullable(); // 详细描述
      table.jsonb('metadata').defaultTo('{}'); // 包含pixel_id, grid_id, lat, lng, thumbnail_url, link等
      table.enum('status', ['pending', 'reviewing', 'resolved', 'rejected']).defaultTo('pending');
      table.uuid('assigned_admin_id').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.text('admin_note').nullable(); // 管理员备注
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.timestamp('resolved_at').nullable();

      // 索引
      table.index(['status', 'created_at'], 'idx_reports_status_time');
      table.index(['reporter_id', 'created_at'], 'idx_reports_reporter');
      table.index(['target_type', 'target_id'], 'idx_reports_target');
      table.index(['assigned_admin_id'], 'idx_reports_admin');
    })

    // 2. 创建举报限制表（防止重复举报和恶意举报）
    .createTableIfNotExists('report_limits', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.string('target_key', 150).notNullable(); // target_type:target_id 的组合
      table.timestamp('first_report_at').defaultTo(knex.fn.now());
      table.integer('report_count').defaultTo(1);
      table.timestamp('last_report_at').defaultTo(knex.fn.now());

      // 复合唯一键：防止同一用户对同一目标多次举报
      table.unique(['user_id', 'target_key'], 'uk_report_limits_user_target');

      // 索引
      table.index(['user_id', 'last_report_at'], 'idx_report_limits_user_time');
    })

    // 3. 创建举报统计表（用于分析和监控）
    .createTableIfNotExists('report_statistics', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.date('report_date').notNullable();
      table.enum('target_type', ['pixel', 'user', 'message']).notNullable();
      table.enum('reason', ['porn', 'violence', 'political', 'spam', 'abuse', 'hate_speech', 'inappropriate', 'other']).notNullable();
      table.integer('report_count').defaultTo(0);
      table.integer('resolved_count').defaultTo(0);
      table.integer('rejected_count').defaultTo(0);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      // 复合唯一键：每天每种类型每种原因只有一条记录
      table.unique(['report_date', 'target_type', 'reason'], 'uk_report_stats_date_type_reason');

      // 索引
      table.index(['report_date', 'target_type'], 'idx_report_stats_date_type');
    })

    // 4. 插入管理员聊天室会话（如果不存在）
    .raw(`
      -- 创建管理员审核聊天室会话
      INSERT INTO conversations (id, type, key, alliance_id, created_at)
      VALUES (gen_random_uuid(), 'global', 'moderation:reports', NULL, NOW())
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
    // 删除管理员聊天室
    .raw(`
      DELETE FROM conversations WHERE key = 'moderation:reports';
    `)

    // 删除表
    .dropTableIfExists('report_statistics')
    .dropTableIfExists('report_limits')
    .dropTableIfExists('reports');
};