/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('pattern_assets', function(table) {
    // 添加软删除字段
    table.timestamp('deleted_at').nullable().comment('软删除时间戳');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('pattern_assets', function(table) {
    // 删除软删除字段
    table.dropColumn('deleted_at');
  });
};
