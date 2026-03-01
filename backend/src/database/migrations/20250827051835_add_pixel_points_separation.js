/**
 * 添加像素点数分离字段
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('user_pixel_states', function(table) {
    // 添加道具恢复的像素点数字段
    table.integer('item_pixel_points').defaultTo(0).comment('道具恢复的像素点数');
    
    // 添加自然累计的像素点数字段
    table.integer('natural_pixel_points').defaultTo(64).comment('自然累计的像素点数');
    
    // 添加最大自然累计像素点数字段
    table.integer('max_natural_pixel_points').defaultTo(64).comment('最大自然累计像素点数');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('user_pixel_states', function(table) {
    table.dropColumn('item_pixel_points');
    table.dropColumn('natural_pixel_points');
    table.dropColumn('max_natural_pixel_points');
  });
};
