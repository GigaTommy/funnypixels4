/**
 * 添加OSM字段到pixels表
 * 与pixels_history表保持一致
 *
 * 添加字段:
 * - osm_id: OSM关系ID
 * - match_quality: 匹配质量 (perfect, excellent, good, fair)
 * - match_source: 匹配来源 (osm_contains, osm_distance, geocoding_fallback)
 */

exports.up = async function(knex) {
  await knex.raw(`
    ALTER TABLE pixels
    ADD COLUMN IF NOT EXISTS osm_id BIGINT,
    ADD COLUMN IF NOT EXISTS match_quality VARCHAR(20),
    ADD COLUMN IF NOT EXISTS match_source VARCHAR(50)
  `);

  await knex.raw(`COMMENT ON COLUMN pixels.osm_id IS 'OSM关系ID'`);
  await knex.raw(`COMMENT ON COLUMN pixels.match_quality IS '位置匹配质量'`);
  await knex.raw(`COMMENT ON COLUMN pixels.match_source IS '位置匹配来源'`);

  await knex.raw(`CREATE INDEX IF NOT EXISTS pixels_osm_id_idx ON pixels(osm_id)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS pixels_match_quality_idx ON pixels(match_quality)`);
};

exports.down = async function(knex) {
  await knex.raw(`DROP INDEX IF EXISTS pixels_osm_id_idx`);
  await knex.raw(`DROP INDEX IF EXISTS pixels_match_quality_idx`);
  await knex.raw(`
    ALTER TABLE pixels
    DROP COLUMN IF EXISTS osm_id,
    DROP COLUMN IF EXISTS match_quality,
    DROP COLUMN IF EXISTS match_source
  `);
};
