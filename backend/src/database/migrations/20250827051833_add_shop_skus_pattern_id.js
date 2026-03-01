/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('shop_skus', function(table) {
    // 添加pattern_id字段
    table.string('pattern_id', 100).nullable(); // 图案ID
    table.boolean('active').defaultTo(true); // 是否激活
    table.boolean('verified').defaultTo(false); // 是否验证
    table.string('type', 50).nullable(); // 类型（如flag_pattern）
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('shop_skus', function(table) {
    table.dropColumn('pattern_id');
    table.dropColumn('active');
    table.dropColumn('verified');
    table.dropColumn('type');
  });
};
