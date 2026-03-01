/**
 * 添加OSM字段到pixels_history表
 * 用于OSM城市排行榜功能
 *
 * 添加字段:
 * - osm_id: OSM关系ID
 * - match_quality: 匹配质量 (perfect, excellent, good, fair)
 * - match_source: 匹配来源 (osm_contains, osm_distance, geocoding_fallback)
 */

exports.up = async function(knex) {
  try {
    const tableExists = await knex.raw(`
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'pixels_history'
      AND table_schema = 'public'
    `);

    if (tableExists.rows.length === 0) {
      console.log('pixels_history表不存在，跳过迁移');
      return;
    }

    console.log('正在添加OSM字段到pixels_history表...');

    await knex.raw(`
      ALTER TABLE pixels_history
      ADD COLUMN IF NOT EXISTS osm_id BIGINT,
      ADD COLUMN IF NOT EXISTS match_quality VARCHAR(20),
      ADD COLUMN IF NOT EXISTS match_source VARCHAR(50)
    `);

    console.log('OSM字段添加成功');

    await knex.raw(`COMMENT ON COLUMN pixels_history.osm_id IS 'OSM关系ID'`);
    await knex.raw(`COMMENT ON COLUMN pixels_history.match_quality IS '位置匹配质量 (perfect, excellent, good, fair)'`);
    await knex.raw(`COMMENT ON COLUMN pixels_history.match_source IS '位置匹配来源 (osm_contains, osm_distance, geocoding_fallback)'`);

    try {
      await knex.raw(`CREATE INDEX IF NOT EXISTS idx_pixels_history_osm_id ON pixels_history(osm_id) WHERE osm_id IS NOT NULL`);
      await knex.raw(`CREATE INDEX IF NOT EXISTS idx_pixels_history_match_quality ON pixels_history(match_quality) WHERE match_quality IS NOT NULL`);
      console.log('OSM索引创建成功');
    } catch (indexError) {
      console.warn('警告: 部分索引创建失败:', indexError.message);
    }

    console.log('迁移完成!');

  } catch (error) {
    console.error('迁移失败:', error.message);
    throw error;
  }
};

exports.down = async function(knex) {
  try {
    const tableExists = await knex.raw(`
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'pixels_history'
      AND table_schema = 'public'
    `);

    if (tableExists.rows.length === 0) {
      console.log('pixels_history表不存在，跳过回滚');
      return;
    }

    try {
      await knex.raw(`DROP INDEX IF EXISTS idx_pixels_history_osm_id`);
      await knex.raw(`DROP INDEX IF EXISTS idx_pixels_history_match_quality`);
    } catch (indexError) {
      console.warn('警告: 部分索引删除失败:', indexError.message);
    }

    await knex.raw(`
      ALTER TABLE pixels_history
      DROP COLUMN IF EXISTS osm_id,
      DROP COLUMN IF EXISTS match_quality,
      DROP COLUMN IF EXISTS match_source
    `);

    console.log('OSM字段删除成功');
    console.log('回滚完成!');

  } catch (error) {
    console.error('回滚失败:', error.message);
    throw error;
  }
};
