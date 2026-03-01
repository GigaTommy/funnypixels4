const express = require('express');
const { db } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * 检查OpenStreetMap数据状态的API路由
 */
router.get('/status', async (req, res) => {
  try {
    logger.info('📊 检查OSM数据状态...');

    const status = {
      timestamp: new Date().toISOString(),
      checks: {}
    };

    // 1. 检查planet_osm_polygon表
    try {
      const tableExists = await db.raw(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'planet_osm_polygon'
        ) as exists
      `);

      status.checks.planet_osm_polygon = {
        exists: tableExists.rows[0].exists
      };

      if (tableExists.rows[0].exists) {
        const osmStats = await db.raw(`
          SELECT
            COUNT(*) as total_polygons,
            COUNT(*) FILTER (WHERE admin_level = '6') as level_6_cities,
            COUNT(*) FILTER (WHERE admin_level = '8') as level_8_districts
          FROM planet_osm_polygon
        `);

        status.checks.planet_osm_polygon.stats = osmStats.rows[0];
      }
    } catch (error) {
      status.checks.planet_osm_polygon = { error: error.message };
    }

    // 2. 检查PostGIS扩展
    try {
      const postgisExists = await db.raw(`
        SELECT EXISTS (
          SELECT FROM pg_extension
          WHERE extname = 'postgis'
        ) as exists
      `);

      status.checks.postgis = {
        exists: postgisExists.rows[0].exists
      };

      if (postgisExists.rows[0].exists) {
        const version = await db.raw(`SELECT PostGIS_Version() as version`);
        status.checks.postgis.version = version.rows[0].version;
      }
    } catch (error) {
      status.checks.postgis = { error: error.message };
    }

    // 3. 检查PostGIS函数
    const functions = [
      'match_point_to_admin_contains',
      'match_point_to_admin_distance',
      'match_point_to_admin_smart'
    ];

    status.checks.postgis_functions = {};

    for (const funcName of functions) {
      try {
        const funcExists = await db.raw(`
          SELECT EXISTS (
            SELECT FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public'
              AND p.proname = $1
          ) as exists
        `, [funcName]);

        status.checks.postgis_functions[funcName] = funcExists.rows[0].exists;
      } catch (error) {
        status.checks.postgis_functions[funcName] = false;
      }
    }

    // 4. 检查pixels_history表的OSM字段
    try {
      const columns = await db.raw(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'pixels_history'
          AND column_name IN ('osm_id', 'admin_level', 'matched_method', 'match_quality')
      `);

      status.checks.pixels_history_osm_fields = {
        exists: columns.rows.length > 0,
        fields: columns.rows.map(r => r.column_name)
      };
    } catch (error) {
      status.checks.pixels_history_osm_fields = { error: error.message };
    }

    // 5. 统计匹配情况
    try {
      const matchStats = await db.raw(`
        SELECT
          COUNT(*) as total_pixels,
          COUNT(osm_id) as matched_pixels,
          ROUND(COUNT(osm_id) * 100.0 / NULLIF(COUNT(*), 0), 2) as match_percentage
        FROM pixels_history
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        LIMIT 1
      `);

      status.checks.match_stats = matchStats.rows[0];
    } catch (error) {
      status.checks.match_stats = { error: error.message };
    }

    // 6. 生成建议
    const recommendations = [];

    if (!status.checks.planet_osm_polygon?.exists) {
      recommendations.push({
        level: 'warning',
        message: 'planet_osm_polygon表不存在，将使用回退方案'
      });
    }

    if (!status.checks.postgis?.exists) {
      recommendations.push({
        level: 'error',
        message: 'PostGIS扩展未安装'
      });
    }

    const matchPercentage = parseFloat(status.checks.match_stats?.match_percentage || 0);
    if (matchPercentage < 50) {
      recommendations.push({
        level: 'warning',
        message: `OSM匹配率仅${matchPercentage}%，建议运行填充脚本`
      });
    } else if (matchPercentage >= 100) {
      recommendations.push({
        level: 'success',
        message: '所有像素已完成OSM匹配'
      });
    }

    status.recommendations = recommendations;

    logger.info('✅ OSM数据状态检查完成');

    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    logger.error('❌ OSM数据状态检查失败:', error);
    res.status(500).json({
      success: false,
      message: 'OSM数据状态检查失败',
      error: error.message
    });
  }
});

module.exports = router;
