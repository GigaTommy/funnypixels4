/**
 * 添加真实像素统计字段到users表
 * 用于存储剔除道具类像素后的真实绘制统计数据
 */
exports.up = function(knex) {
  return knex.schema.alterTable('users', function(table) {
    // 添加真实像素统计字段
    table.integer('real_total_pixels').defaultTo(0).comment('真实绘制总像素数（剔除道具类像素）');
    table.integer('real_current_pixels').defaultTo(0).comment('真实绘制当前占有像素数（剔除道具类像素）');

    // 添加索引
    table.index(['real_total_pixels'], 'idx_users_real_total_pixels');
    table.index(['real_current_pixels'], 'idx_users_real_current_pixels');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('users', function(table) {
    // 删除索引
    table.dropIndex(['real_total_pixels'], 'idx_users_real_total_pixels');
    table.dropIndex(['real_current_pixels'], 'idx_users_real_current_pixels');

    // 删除字段
    table.dropColumn('real_total_pixels');
    table.dropColumn('real_current_pixels');
  });
};