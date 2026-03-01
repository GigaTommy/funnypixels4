/**
 * 添加CDN字段到pattern_assets表
 * 支持混合CDN架构：本地文件系统 + 云存储
 */

exports.up = function(knex) {
  return knex.schema.alterTable('pattern_assets', function(table) {
    // CDN相关字段
    table.string('file_url', 500)
      .comment('CDN访问URL，支持本地和云存储')
      .nullable();

    table.string('file_path', 255)
      .comment('存储路径，用于云存储对象路径或本地文件相对路径')
      .nullable();

    table.string('file_hash', 64)
      .comment('文件SHA256哈希值，用于去重和完整性验证')
      .nullable();

    table.integer('file_size')
      .comment('文件大小（字节）')
      .nullable();

    // 索引优化
    table.index(['file_hash'], 'idx_pattern_assets_file_hash');
    table.index(['file_url'], 'idx_pattern_assets_file_url');

    // 为CDN字段添加注释说明用途
    table.comment('pattern_assets表包含图案资源信息，支持本地和CDN混合存储');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('pattern_assets', function(table) {
    // 删除CDN相关字段
    table.dropIndex(['file_hash'], 'idx_pattern_assets_file_hash');
    table.dropIndex(['file_url'], 'idx_pattern_assets_file_url');

    table.dropColumn('file_url');
    table.dropColumn('file_path');
    table.dropColumn('file_hash');
    table.dropColumn('file_size');
  });
};