/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('pattern_assets', function(table) {
    // 添加UNICODE编码字段
    table.string('unicode_char', 10).nullable().comment('UNICODE字符编码');
    
    // 添加渲染类型字段
    table.string('render_type', 20).defaultTo('color').comment('渲染类型：color, emoji, complex');
    
    // 添加索引以提高查询性能
    table.index(['unicode_char']);
    table.index(['render_type']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('pattern_assets', function(table) {
    // 删除索引
    table.dropIndex(['unicode_char']);
    table.dropIndex(['render_type']);
    
    // 删除字段
    table.dropColumn('unicode_char');
    table.dropColumn('render_type');
  });
};
