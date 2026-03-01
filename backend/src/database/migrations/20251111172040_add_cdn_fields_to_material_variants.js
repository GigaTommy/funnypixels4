/**
 * 添加CDN字段到material_variants表
 * 支持环境区分：开发环境使用本地文件系统，生产环境使用CDN
 */

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('material_variants', function(table) {
    // CDN访问URL
    table.string('cdn_url', 500)
      .comment('CDN访问URL，开发环境：本地路径(http://localhost/uploads/materials/...)，生产环境：云存储CDN URL')
      .nullable();

    // 存储路径
    table.string('storage_path', 255)
      .comment('存储路径，相对于uploads目录的路径，如：materials/sprite_sheet/abc123.webp')
      .nullable();

    // 文件哈希值
    table.string('file_hash', 64)
      .comment('文件SHA256哈希值，用于去重和完整性验证')
      .nullable();

    // 索引优化
    table.index(['cdn_url'], 'idx_material_variants_cdn_url');
    table.index(['file_hash'], 'idx_material_variants_file_hash');
    table.index(['storage_path'], 'idx_material_variants_storage_path');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('material_variants', function(table) {
    // 删除索引
    table.dropIndex(['cdn_url'], 'idx_material_variants_cdn_url');
    table.dropIndex(['file_hash'], 'idx_material_variants_file_hash');
    table.dropIndex(['storage_path'], 'idx_material_variants_storage_path');

    // 删除字段
    table.dropColumn('cdn_url');
    table.dropColumn('storage_path');
    table.dropColumn('file_hash');
  });
};
