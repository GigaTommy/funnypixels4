/**
 * 系统告警表 — 存储对账异常、安全告警等需要管理员关注的事件
 */
exports.up = async function (knex) {
  await knex.schema.createTable('system_alerts', (table) => {
    table.increments('id').primary();
    table.string('type', 50).notNullable().index(); // reconciliation, security, system
    table.string('severity', 20).notNullable().defaultTo('warning'); // info, warning, critical
    table.string('title', 255).notNullable();
    table.text('message');
    table.jsonb('details'); // 结构化详情（如不一致用户列表）
    table.boolean('is_resolved').defaultTo(false).index();
    table.string('resolved_by'); // 处理人
    table.text('resolution_note'); // 处理说明
    table.timestamp('resolved_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('system_alerts');
};
