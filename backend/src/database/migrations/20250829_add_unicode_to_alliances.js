/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('alliances', function(table) {
    // 添加UNICODE编码字段
    table.string('flag_unicode_char', 10).nullable().comment('旗帜UNICODE字符编码');
    
    // 添加渲染类型字段
    table.string('flag_render_type', 20).defaultTo('color').comment('旗帜渲染类型：color, emoji, complex');
    
    // 添加索引以提高查询性能
    table.index(['flag_unicode_char']);
    table.index(['flag_render_type']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('alliances', function(table) {
    // 删除索引
    table.dropIndex(['flag_unicode_char']);
    table.dropIndex(['flag_render_type']);
    
    // 删除字段
    table.dropColumn('flag_unicode_char');
    table.dropColumn('flag_render_type');
  });
};
