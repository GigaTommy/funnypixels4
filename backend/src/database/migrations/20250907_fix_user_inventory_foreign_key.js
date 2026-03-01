/**
 * 修复 user_inventory 表的外键约束
 * 将外键从 shop_skus 改为 store_items
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('user_inventory', function(table) {
    // 删除旧的外键约束
    table.dropForeign(['item_id'], 'user_inventory_item_id_foreign');
    
    // 添加新的外键约束，引用 store_items 表
    table.foreign('item_id').references('id').inTable('store_items').onDelete('CASCADE');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('user_inventory', function(table) {
    // 删除新的外键约束
    table.dropForeign(['item_id'], 'user_inventory_item_id_foreign');
    
    // 恢复旧的外键约束，引用 shop_skus 表
    table.foreign('item_id').references('id').inTable('shop_skus').onDelete('CASCADE');
  });
};
