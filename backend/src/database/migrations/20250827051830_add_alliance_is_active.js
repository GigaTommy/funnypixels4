/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('alliances', function(table) {
    // 添加is_active字段
    table.boolean('is_active').defaultTo(true); // 联盟是否激活
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('alliances', function(table) {
    table.dropColumn('is_active');
  });
};
