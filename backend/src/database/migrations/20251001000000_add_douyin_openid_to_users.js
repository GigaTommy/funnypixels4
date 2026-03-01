const { Knex } = require('knex');

/**
 * @param {Knex} knex
 */
exports.up = function(knex) {
  return knex.schema.table('users', function(table) {
    // 添加抖音openid字段
    table.string('douyin_openid', 100).unique();
    // 添加抖音昵称字段
    table.string('douyin_nickname', 100);
    // 添加抖音头像URL字段
    table.string('douyin_avatar_url', 500);
  });
};

/**
 * @param {Knex} knex
 */
exports.down = function(knex) {
  return knex.schema.table('users', function(table) {
    table.dropColumn('douyin_openid');
    table.dropColumn('douyin_nickname');
    table.dropColumn('douyin_avatar_url');
  });
};
