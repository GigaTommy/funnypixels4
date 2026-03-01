/**
 * 修复迁移：处理已存在索引的问题
 */
exports.up = function(knex) {
  return knex.raw(`
    -- 检查并删除已存在的索引（如果存在）
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_regions_coordinates') THEN
        DROP INDEX IF EXISTS idx_regions_coordinates;
      END IF;
    END $$;

    -- 重新创建索引（如果不存在）
    CREATE INDEX IF NOT EXISTS idx_regions_coordinates
    ON regions (center_lat, center_lng);
  `);
};

exports.down = function(knex) {
  return knex.raw(`
    DROP INDEX IF EXISTS idx_regions_coordinates;
  `);
};