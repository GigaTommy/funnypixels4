/**
 * 为排行榜表添加metadata字段
 * 用于存储OSM匹配信息和其他扩展数据
 */

exports.up = async function(knex) {
  try {
    console.log('📝 为leaderboard_region表添加metadata字段...');

    // 为leaderboard_region表添加metadata字段
    await knex.raw(`
      ALTER TABLE leaderboard_region
      ADD COLUMN IF NOT EXISTS metadata JSONB
    `);

    // 添加字段注释
    await knex.raw(`
      COMMENT ON COLUMN leaderboard_region.metadata IS '元数据字段，存储OSM匹配信息、数据来源等扩展信息'
    `);

    // 创建GIN索引用于JSONB查询优化
    await knex.raw(`
      CREATE INDEX IF NOT EXISTS idx_leaderboard_region_metadata_gin
      ON leaderboard_region USING GIN (metadata)
    `);

    // 创建特定字段的索引（使用btree索引，因为GIN不支持text字段的默认操作符）
    await knex.raw(`
      CREATE INDEX IF NOT EXISTS idx_leaderboard_region_metadata_osm_matched
      ON leaderboard_region USING BTREE ((metadata->>'is_osm_matched'))
    `);

    await knex.raw(`
      CREATE INDEX IF NOT EXISTS idx_leaderboard_region_metadata_match_quality
      ON leaderboard_region USING BTREE ((metadata->>'match_quality'))
    `);

    // 为JSONB内部字段创建GIN索引（用于复杂的JSON查询）
    await knex.raw(`
      CREATE INDEX IF NOT EXISTS idx_leaderboard_region_metadata_is_osm_matched_gin
      ON leaderboard_region USING GIN ((metadata) jsonb_path_ops)
    `);

    console.log('✅ leaderboard_region表metadata字段添加成功');

  } catch (error) {
    console.error('❌ 添加metadata字段失败:', error.message);
    throw error;
  }
};

exports.down = async function(knex) {
  try {
    console.log('🔄 回滚leaderboard_region表metadata字段...');

    // 删除索引
    await knex.raw(`DROP INDEX IF EXISTS idx_leaderboard_region_metadata_gin`);
    await knex.raw(`DROP INDEX IF EXISTS idx_leaderboard_region_metadata_osm_matched`);
    await knex.raw(`DROP INDEX IF EXISTS idx_leaderboard_region_metadata_match_quality`);
    await knex.raw(`DROP INDEX IF EXISTS idx_leaderboard_region_metadata_is_osm_matched_gin`);

    // 删除字段
    await knex.raw(`ALTER TABLE leaderboard_region DROP COLUMN IF EXISTS metadata`);

    console.log('✅ leaderboard_region表metadata字段回滚成功');

  } catch (error) {
    console.error('❌ 回滚metadata字段失败:', error.message);
    throw error;
  }
};