/**
 * 添加用户语言偏好字段
 * 用于支持多语言推送通知和界面本地化
 */

exports.up = function(knex) {
  return knex.schema.table('users', function(table) {
    // 添加语言偏好字段，默认为简体中文（与项目其他部分保持一致）
    table.string('preferred_language', 10).defaultTo('zh-Hans').notNullable();

    // 添加索引以提升查询性能
    table.index('preferred_language', 'idx_users_preferred_language');
  });
};

exports.down = function(knex) {
  return knex.schema.table('users', function(table) {
    table.dropIndex('preferred_language', 'idx_users_preferred_language');
    table.dropColumn('preferred_language');
  });
};
