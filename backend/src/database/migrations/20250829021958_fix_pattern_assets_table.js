/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('pattern_assets', function(table) {
    // 添加图案系统所需的关键字段
    table.string('key').unique().comment('图案唯一标识符');
    table.integer('width').defaultTo(32).comment('图案宽度');
    table.integer('height').defaultTo(32).comment('图案高度');
    table.string('encoding').defaultTo('rle').comment('编码格式：rle, png_base64');
    table.text('payload').comment('图案数据载荷');
    table.boolean('verified').defaultTo(false).comment('是否已验证');
    
    // 添加索引以提高查询性能
    table.index(['key']);
    table.index(['verified']);
    table.index(['category']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('pattern_assets', function(table) {
    // 删除添加的字段
    table.dropIndex(['key']);
    table.dropIndex(['verified']);
    table.dropIndex(['category']);
    
    table.dropColumn('key');
    table.dropColumn('width');
    table.dropColumn('height');
    table.dropColumn('encoding');
    table.dropColumn('payload');
    table.dropColumn('verified');
  });
};
