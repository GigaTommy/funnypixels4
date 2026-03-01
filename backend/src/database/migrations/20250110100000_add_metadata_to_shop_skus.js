/**
 * 添加 metadata 字段到 shop_skus 表
 * 用于存储商品的扩展元数据信息
 */

exports.up = function(knex) {
  return knex.schema.alterTable('shop_skus', function(table) {
    table.jsonb('metadata').nullable().comment('商品元数据（JSON格式）');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('shop_skus', function(table) {
    table.dropColumn('metadata');
  });
};
