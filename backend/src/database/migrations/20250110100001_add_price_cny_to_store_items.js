/**
 * 添加 price_cny 字段到 store_items 表
 * 用于存储人民币价格（可选）
 */

exports.up = function(knex) {
  return knex.schema.alterTable('store_items', function(table) {
    table.decimal('price_cny', 10, 2).nullable().comment('人民币价格（可选）');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('store_items', function(table) {
    table.dropColumn('price_cny');
  });
};
