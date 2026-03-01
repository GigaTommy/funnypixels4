/**
 * 修复列数不匹配和地理坐标语法问题
 * 确保所有函数返回正确的列数和坐标顺序
 */

exports.up = async function(knex) {
  try {
    console.log('🔧 修复PostGIS函数的列数和坐标语法问题...');

    // 删除现有的函数
    await knex.raw('DROP FUNCTION IF EXISTS match_point_to_admin_contains(FLOAT, FLOAT)');
    await knex.raw('DROP FUNCTION IF EXISTS match_point_to_admin_distance(FLOAT, FLOAT, INTEGER)');
    await knex.raw('DROP FUNCTION IF EXISTS match_point_to_admin_smart(FLOAT, FLOAT, INTEGER)');

    // 重新创建修正后的函数：点在多边形内精确匹配（返回9列）
    await knex.raw(`
      CREATE OR REPLACE FUNCTION match_point_to_admin_contains(lat FLOAT, lng FLOAT)
      RETURNS TABLE (
        osm_id BIGINT,
        name TEXT,
        admin_level INTEGER,
        country TEXT,
        province TEXT,
        city TEXT,
        matched_method TEXT,
        distance_m FLOAT,
        match_quality TEXT
      ) AS $$
      BEGIN
          RETURN QUERY
          WITH pt AS (
            SELECT ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geometry AS geom
          )
          SELECT
              p.osm_id,
              p.name,
              p.admin_level::INTEGER,
              '中国' as country,
              NULL as province,
              p.name as city,
              'contains'::TEXT as matched_method,
              0.0::FLOAT as distance_m,
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

    // 重新创建修正后的函数：距离回退匹配（返回9列）
    await knex.raw(`
      CREATE OR REPLACE FUNCTION match_point_to_admin_distance(lat FLOAT, lng FLOAT, max_distance_m INTEGER DEFAULT 20000)
      RETURNS TABLE (
        osm_id BIGINT,
        name TEXT,
        admin_level INTEGER,
        country TEXT,
        province TEXT,
        city TEXT,
        matched_method TEXT,
        distance_m FLOAT,
        match_quality TEXT
      ) AS $$
      BEGIN
          RETURN QUERY
          WITH pt AS (
            SELECT ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geometry AS geom
          ),
          candidates AS (
            SELECT
              p.osm_id,
              p.name,
              p.admin_level::INTEGER,
              p.way,
              ST_Distance(
                  ST_Centroid(p.way)::geography,
                  pt.geom::geography
              ) AS center_dist_m
            FROM planet_osm_polygon p, pt
            WHERE p.admin_level = '6'
              AND p.boundary = 'administrative'
              AND p.name IS NOT NULL
              AND ST_DWithin(
                  ST_Centroid(p.way)::geography,
                  pt.geom::geography,
                  max_distance_m
              )
            ORDER BY center_dist_m
            LIMIT 50
          )
          SELECT
              c.osm_id,
              c.name,
              c.admin_level,
              '中国' as country,
              NULL as province,
              c.name as city,
              'distance'::TEXT as matched_method,
              ST_Distance(c.way::geography, (SELECT geom FROM pt)::geography)::FLOAT as distance_m,
              CASE
                  WHEN ST_Distance(c.way::geography, (SELECT geom FROM pt)::geography) <= 1000 THEN 'excellent'
                  WHEN ST_Distance(c.way::geography, (SELECT geom FROM pt)::geography) <= 5000 THEN 'good'
                  WHEN ST_Distance(c.way::geography, (SELECT geom FROM pt)::geography) <= 10000 THEN 'fair'
                  ELSE 'poor'
              END as match_quality
          FROM candidates c
          WHERE ST_Distance(c.way::geography, (SELECT geom FROM pt)::geography) <= max_distance_m
          ORDER BY distance_m
          LIMIT 1;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // 重新创建修正后的主函数：智能匹配（统一返回9列）
    await knex.raw(`
      CREATE OR REPLACE FUNCTION match_point_to_admin_smart(lat FLOAT, lng FLOAT, max_distance_m INTEGER DEFAULT 20000)
      RETURNS TABLE (
        osm_id BIGINT,
        name TEXT,
        admin_level INTEGER,
        country TEXT,
        province TEXT,
        city TEXT,
        matched_method TEXT,
        distance_m FLOAT,
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

    console.log('✅ PostGIS函数列数和坐标语法修复完成');

  } catch (error) {
    console.error('❌ PostGIS函数修复失败:', error.message);
    throw error;
  }
};

exports.down = async function(knex) {
  try {
    console.log('🔄 回滚PostGIS函数修复...');

    await knex.raw('DROP FUNCTION IF EXISTS match_point_to_admin_contains(FLOAT, FLOAT)');
    await knex.raw('DROP FUNCTION IF EXISTS match_point_to_admin_distance(FLOAT, FLOAT, INTEGER)');
    await knex.raw('DROP FUNCTION IF EXISTS match_point_to_admin_smart(FLOAT, FLOAT, INTEGER)');

    console.log('✅ PostGIS函数修复回滚完成');

  } catch (error) {
    console.error('❌ PostGIS函数修复回滚失败:', error.message);
    throw error;
  }
};