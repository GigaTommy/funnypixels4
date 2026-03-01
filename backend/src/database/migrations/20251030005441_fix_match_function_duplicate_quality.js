/**
 * 修复所有PostGIS匹配函数的字段数不匹配和SRID错误
 *
 * 问题：
 * 1. match_point_to_admin_contains 和 match_point_to_admin_distance 缺少 match_quality 字段
 * 2. 所有函数都需要正确的 SRID 转换（4326 -> 3857）
 *
 * 解决方案：
 * 重新创建所有三个函数，确保字段一致性和正确的坐标系统转换
 */

exports.up = async function(knex) {
  try {
    console.log('🔧 修复所有PostGIS匹配函数...');

    // 删除所有旧函数（使用 CASCADE 删除依赖）
    await knex.raw('DROP FUNCTION IF EXISTS match_point_to_admin_contains CASCADE');
    await knex.raw('DROP FUNCTION IF EXISTS match_point_to_admin_distance CASCADE');
    await knex.raw('DROP FUNCTION IF EXISTS match_point_to_admin_smart CASCADE');

    // 1. 创建 match_point_to_admin_contains 函数（精确匹配，包含 match_quality）
    await knex.raw(`
      CREATE OR REPLACE FUNCTION match_point_to_admin_contains(lat DOUBLE PRECISION, lng DOUBLE PRECISION)
      RETURNS TABLE (
        osm_id BIGINT,
        name TEXT,
        admin_level INTEGER,
        country TEXT,
        province TEXT,
        city TEXT,
        matched_method TEXT,
        distance_m DOUBLE PRECISION,
        match_quality TEXT
      ) AS $$
      BEGIN
          RETURN QUERY
          WITH pt AS (
            SELECT ST_Transform(ST_SetSRID(ST_MakePoint(lng, lat), 4326), 3857)::geometry AS geom
          )
          SELECT
              p.osm_id,
              p.name,
              p.admin_level::INTEGER,
              '中国'::TEXT as country,
              NULL::TEXT as province,
              p.name as city,
              'contains'::TEXT as matched_method,
              0.0::DOUBLE PRECISION as distance_m,
              'perfect'::TEXT as match_quality
          FROM planet_osm_polygon p, pt
          WHERE p.admin_level = '6'
            AND p.boundary = 'administrative'
            AND p.name IS NOT NULL
            AND ST_Contains(p.way, pt.geom)
          LIMIT 1;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // 2. 创建 match_point_to_admin_distance 函数（距离回退，包含 match_quality）
    await knex.raw(`
      CREATE OR REPLACE FUNCTION match_point_to_admin_distance(lat DOUBLE PRECISION, lng DOUBLE PRECISION, max_distance_m INTEGER DEFAULT 20000)
      RETURNS TABLE (
        osm_id BIGINT,
        name TEXT,
        admin_level INTEGER,
        country TEXT,
        province TEXT,
        city TEXT,
        matched_method TEXT,
        distance_m DOUBLE PRECISION,
        match_quality TEXT
      ) AS $$
      BEGIN
          RETURN QUERY
          WITH pt AS (
            SELECT ST_Transform(ST_SetSRID(ST_MakePoint(lng, lat), 4326), 3857)::geometry AS geom
          ),
          candidates AS (
            SELECT
              p.osm_id,
              p.name,
              p.admin_level::INTEGER,
              p.way,
              ST_Distance(ST_Centroid(p.way), pt.geom) AS center_dist_m
            FROM planet_osm_polygon p, pt
            WHERE p.admin_level = '6'
              AND p.boundary = 'administrative'
              AND p.name IS NOT NULL
              AND ST_DWithin(ST_Centroid(p.way), pt.geom, max_distance_m)
            ORDER BY center_dist_m
            LIMIT 50
          )
          SELECT
              c.osm_id,
              c.name,
              c.admin_level,
              '中国'::TEXT as country,
              NULL::TEXT as province,
              c.name as city,
              'distance'::TEXT as matched_method,
              ST_Distance(c.way, (SELECT geom FROM pt))::DOUBLE PRECISION as distance_m,
              CASE
                  WHEN ST_Distance(c.way, (SELECT geom FROM pt)) <= 1000 THEN 'excellent'
                  WHEN ST_Distance(c.way, (SELECT geom FROM pt)) <= 5000 THEN 'good'
                  WHEN ST_Distance(c.way, (SELECT geom FROM pt)) <= 10000 THEN 'fair'
                  ELSE 'poor'
              END::TEXT as match_quality
          FROM candidates c
          WHERE ST_Distance(c.way, (SELECT geom FROM pt)) <= max_distance_m
          ORDER BY distance_m
          LIMIT 1;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // 3. 创建 match_point_to_admin_smart 函数（智能匹配）
    await knex.raw(`
      CREATE OR REPLACE FUNCTION match_point_to_admin_smart(lat DOUBLE PRECISION, lng DOUBLE PRECISION, max_distance_m INTEGER DEFAULT 20000)
      RETURNS TABLE (
        osm_id BIGINT,
        name TEXT,
        admin_level INTEGER,
        country TEXT,
        province TEXT,
        city TEXT,
        matched_method TEXT,
        distance_m DOUBLE PRECISION,
        match_quality TEXT
      ) AS $$
      BEGIN
          -- 首先尝试点在多边形内的精确匹配
          RETURN QUERY SELECT * FROM match_point_to_admin_contains(lat, lng);

          -- 如果没有找到，尝试距离回退匹配
          IF NOT FOUND THEN
              RETURN QUERY SELECT * FROM match_point_to_admin_distance(lat, lng, max_distance_m);
          END IF;
      END;
      $$ LANGUAGE plpgsql;
    `);

    console.log('✅ 所有PostGIS匹配函数修复完成');

  } catch (error) {
    console.error('❌ 修复函数失败:', error.message);
    throw error;
  }
};

exports.down = async function(knex) {
  try {
    console.log('🔄 回滚 match_point_to_admin_smart 函数修复...');

    // 回滚时删除函数
    await knex.raw('DROP FUNCTION IF EXISTS match_point_to_admin_smart(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER)');

    console.log('✅ 函数修复回滚完成');

  } catch (error) {
    console.error('❌ 函数修复回滚失败:', error.message);
    throw error;
  }
};
