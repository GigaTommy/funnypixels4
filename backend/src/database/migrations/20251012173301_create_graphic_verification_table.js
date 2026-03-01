/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('graphic_verification_challenges', function(table) {
    // 主键
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    // 关联的手机号
    table.string('phone', 20).notNullable().index();

    // 挑战类型: shape, color, object, pattern
    table.string('type', 20).notNullable().index();

    // 问题文本（如：请选择所有的圆形）
    table.text('question').notNullable();

    // 选项JSON格式（包含选项内容、正确答案等）
    table.jsonb('options').notNullable();

    // 正确答案
    table.string('correct_answer', 100).notNullable();

    // 时间限制（秒）
    table.integer('time_limit').defaultTo(60);

    // 难度等级: easy, medium, hard
    table.string('difficulty', 20).defaultTo('medium').index();

    // 是否已使用
    table.boolean('used').defaultTo(false).index();

    // 尝试次数
    table.integer('attempt_count').defaultTo(0);

    // 最大尝试次数
    table.integer('max_attempts').defaultTo(3);

    // 挑战状态: created, attempted, passed, failed, expired
    table.string('status', 20).defaultTo('created').index();

    // 用户选择的答案（JSON格式，记录所有尝试）
    table.jsonb('user_answers').nullable();

    // IP地址（安全审计）
    table.string('ip_address', 45);

    // 用户代理（安全审计）
    table.text('user_agent');

    // 时间戳
    table.timestamp('created_at').defaultTo(knex.fn.now()).index();
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // 过期时间（默认60秒后过期）
    table.timestamp('expires_at').notNullable().index();

    // 完成时间（如果通过验证）
    table.timestamp('completed_at').nullable();

    // 最后尝试时间
    table.timestamp('last_attempt_at').nullable();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('graphic_verification_challenges');
};
