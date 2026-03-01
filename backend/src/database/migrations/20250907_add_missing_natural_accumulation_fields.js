/**
 * 添加缺失的自然累计相关字段
 * 修复生产环境数据库表结构问题
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('user_pixel_states', function(table) {
    // 添加自然累计状态字段
    table.boolean('is_in_natural_accumulation').defaultTo(false).comment('是否处于自然累计状态');
    
    // 添加最后活动时间字段
    table.bigInteger('last_activity_time').defaultTo(knex.raw('EXTRACT(EPOCH FROM NOW())')).comment('最后活动时间');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('user_pixel_states', function(table) {
    table.dropColumn('is_in_natural_accumulation');
    table.dropColumn('last_activity_time');
  });
};
