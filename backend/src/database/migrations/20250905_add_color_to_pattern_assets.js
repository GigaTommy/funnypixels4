/**
 * 添加color字段到pattern_assets表
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('pattern_assets', function(table) {
    // 添加color字段
    table.string('color', 7).nullable().comment('图案颜色值');
    
    // 添加索引以提高查询性能
    table.index(['color']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('pattern_assets', function(table) {
    // 删除索引
    table.dropIndex(['color']);
    
    // 删除字段
    table.dropColumn('color');
  });
};
