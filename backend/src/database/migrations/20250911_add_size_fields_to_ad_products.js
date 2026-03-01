const { Knex } = require('knex');

/**
 * 为 ad_products 表添加尺寸字段
 * @param {Knex} knex
 */
exports.up = async function(knex) {
  // 检查字段是否已存在，如果存在则跳过
  const hasSizeType = await knex.schema.hasColumn('ad_products', 'size_type');
  const hasWidth = await knex.schema.hasColumn('ad_products', 'width');
  const hasHeight = await knex.schema.hasColumn('ad_products', 'height');
  
  if (hasSizeType && hasWidth && hasHeight) {
    console.log('✅ ad_products 表的尺寸字段已存在，跳过迁移');
    return;
  }
  
  return knex.schema.alterTable('ad_products', function(table) {
    // 只添加不存在的字段
    if (!hasSizeType) {
      table.string('size_type', 20).defaultTo('rectangle'); // 'rectangle' 或 'square'
    }
    if (!hasWidth) {
      table.integer('width').defaultTo(20); // 宽度
    }
    if (!hasHeight) {
      table.integer('height').defaultTo(10); // 高度
    }
  });
};

/**
 * @param {Knex} knex
 */
exports.down = function(knex) {
  return knex.schema.alterTable('ad_products', function(table) {
    table.dropColumn('size_type');
    table.dropColumn('width');
    table.dropColumn('height');
  });
};
