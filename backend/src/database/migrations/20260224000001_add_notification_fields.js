/**
 * 为 notifications 表添加缺失字段
 * - data: JSONB 字段，存储通知的额外数据
 * - read_at: TIMESTAMP 字段，记录已读时间
 */

exports.up = function(knex) {
  return knex.schema.table('notifications', function(table) {
    // 添加 data 字段（JSONB 类型）
    table.jsonb('data').nullable().comment('通知附加数据（JSON格式）');

    // 添加 read_at 字段
    table.timestamp('read_at').nullable().comment('已读时间');

    // 添加 updated_at 字段
    table.timestamp('updated_at').defaultTo(knex.fn.now()).comment('更新时间');
  });
};

exports.down = function(knex) {
  return knex.schema.table('notifications', function(table) {
    table.dropColumn('data');
    table.dropColumn('read_at');
    table.dropColumn('updated_at');
  });
};
