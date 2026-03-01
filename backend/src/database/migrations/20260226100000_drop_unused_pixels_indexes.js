/**
 * 删除 pixels 表中未使用和冗余的索引
 *
 * 背景：pixels 表有 30 个索引（219MB），是表数据（50MB）的 4.3 倍。
 * 每次 INSERT/UPDATE 需更新所有索引，造成严重的写入放大。
 *
 * 基于 pg_stat_user_indexes 的 idx_scan 统计，删除：
 * - 10 个零使用索引（~62MB）
 * - 3 个重复/冗余索引（~17MB）
 * - 2 个低使用且可被其他索引覆盖的索引（~14MB）
 *
 * 删除后：30 → 15 个索引，节省 ~97MB，写入性能预计提升 30-50%
 */

exports.up = async function(knex) {
  // ========== 零使用索引（idx_scan = 0）==========

  // 25MB - MVT 复合索引，从未使用
  await knex.raw('DROP INDEX IF EXISTS idx_pixels_mvt_composite');

  // 14MB - 用户活跃度索引 (user_id, created_at, pixel_type)，从未使用
  await knex.raw('DROP INDEX IF EXISTS idx_pixels_user_activity');

  // 9MB - grid_id btree，被 pixels_grid_id_unique 和 idx_pixels_grid_id_hash 完全覆盖
  await knex.raw('DROP INDEX IF EXISTS idx_pixels_grid_id');

  // 2.8MB - 未地理编码像素部分索引，从未使用
  await knex.raw('DROP INDEX IF EXISTS idx_pixels_not_geocoded');

  // 2.5MB - pattern_id 索引，从未使用
  await knex.raw('DROP INDEX IF EXISTS idx_pixels_pattern_id');

  // 2.5MB - pattern_id text_pattern_ops 索引，从未使用
  await knex.raw('DROP INDEX IF EXISTS idx_pixels_pattern_id_prefix');

  // 2.2MB - alliance_id 索引，从未使用
  await knex.raw('DROP INDEX IF EXISTS pixels_alliance_id_index');

  // 2.1MB - osm_id 索引，仅在 SELECT 中使用，从未作为 WHERE 条件
  await knex.raw('DROP INDEX IF EXISTS pixels_osm_id_idx');

  // 2.1MB - match_quality 索引，仅在 SELECT/CASE 中使用，从未作为 WHERE 条件
  await knex.raw('DROP INDEX IF EXISTS pixels_match_quality_idx');

  // 2.2MB - (pixel_type, related_id) 复合索引，从未使用
  await knex.raw('DROP INDEX IF EXISTS idx_pixels_pixel_type_related_id');

  // ========== 重复/冗余索引 ==========

  // 12MB - 与 idx_pixels_lat_lng_created 定义完全相同 (latitude, longitude, created_at DESC)
  await knex.raw('DROP INDEX IF EXISTS idx_pixels_tile_query');

  // 12MB - (grid_id, version)，version 列从未在 WHERE 中使用，grid_id 已被 unique + hash 索引覆盖
  await knex.raw('DROP INDEX IF EXISTS idx_pixels_grid_id_version');

  // 2.6MB - city btree，被 idx_pixels_city (WHERE city IS NOT NULL) 覆盖
  await knex.raw('DROP INDEX IF EXISTS pixels_city_index');

  // ========== 可被覆盖的低使用索引 ==========

  // 2.2MB, 6 scans - session_id 查询极少（仅 session 结束时统计）
  await knex.raw('DROP INDEX IF EXISTS idx_pixels_session_id');

  // 1.9MB, 16802 scans - 是 idx_pixels_user_created (user_id, created_at) 的前缀，PostgreSQL 可用复合索引替代
  await knex.raw('DROP INDEX IF EXISTS idx_pixels_user_id');
};

exports.down = async function(knex) {
  // 恢复所有删除的索引
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_pixels_mvt_composite ON pixels (created_at DESC) INCLUDE (id, color, pattern_id, lng_quantized, lat_quantized)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_pixels_user_activity ON pixels (user_id, created_at DESC, pixel_type)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_pixels_grid_id ON pixels (grid_id)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_pixels_not_geocoded ON pixels (id) WHERE (geocoded = false OR geocoded IS NULL)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_pixels_pattern_id ON pixels (pattern_id) WHERE (pattern_id IS NOT NULL)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_pixels_pattern_id_prefix ON pixels (pattern_id text_pattern_ops) WHERE (pattern_id IS NOT NULL)');
  await knex.raw('CREATE INDEX IF NOT EXISTS pixels_alliance_id_index ON pixels (alliance_id)');
  await knex.raw('CREATE INDEX IF NOT EXISTS pixels_osm_id_idx ON pixels (osm_id)');
  await knex.raw('CREATE INDEX IF NOT EXISTS pixels_match_quality_idx ON pixels (match_quality)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_pixels_pixel_type_related_id ON pixels (pixel_type, related_id)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_pixels_tile_query ON pixels (latitude, longitude, created_at DESC)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_pixels_grid_id_version ON pixels (grid_id, version)');
  await knex.raw('CREATE INDEX IF NOT EXISTS pixels_city_index ON pixels (city)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_pixels_session_id ON pixels (session_id)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_pixels_user_id ON pixels (user_id)');
};
