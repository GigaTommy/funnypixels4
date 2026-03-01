/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('alliances', function(table) {
    // 添加flag_payload字段，用于存储旗帜的完整数据
    table.text('flag_payload').nullable().comment('旗帜完整数据载荷');
    
    // 添加索引以提高查询性能
    table.index(['flag_payload'], 'alliances_flag_payload_idx');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('alliances', function(table) {
    // 删除索引
    table.dropIndex(['flag_payload'], 'alliances_flag_payload_idx');
    
    // 删除字段
    table.dropColumn('flag_payload');
  });
};
