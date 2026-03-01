/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('sms_verification_codes', function(table) {
    // 主键
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    // 手机号
    table.string('phone', 20).notNullable().index();

    // 验证码
    table.string('code', 10).notNullable();

    // 验证码类型: login, register, reset_password
    table.string('type', 20).notNullable().defaultTo('login');

    // 是否已使用
    table.boolean('used').defaultTo(false).index();

    // 发送次数（防刷机制）
    table.integer('send_count').defaultTo(1);

    // IP地址（防刷机制）
    table.string('ip_address', 45);

    // 用户代理（防刷机制）
    table.text('user_agent');

    // 发送状态: sent, failed, pending
    table.string('status', 20).defaultTo('sent').index();

    // 错误信息（如果发送失败）
    table.text('error_message');

    // 外部服务返回的消息ID
    table.string('message_id', 100);

    // 时间戳
    table.timestamp('created_at').defaultTo(knex.fn.now()).index();
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // 过期时间（5分钟后过期）
    table.timestamp('expires_at').notNullable().index();

    // 使用时间（如果已使用）
    table.timestamp('used_at').nullable();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('sms_verification_codes');
};
