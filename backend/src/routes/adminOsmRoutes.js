const express = require('express');
const { db } = require('../config/database');
const logger = require('../utils/logger');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

/**
 * 管理员OSM数据管理路由
 */

// 触发OSM数据填充（需要管理员权限）
router.post('/fill-osm-data', authenticateToken, requireAdmin, async (req, res) => {
  try {
    logger.info('🌍 管理员触发OSM数据填充...');

    const { batchSize = 1000, maxBatches = 10 } = req.body;

    // 检查planet_osm_polygon表
    const tableExists = await db.raw(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'planet_osm_polygon'
      ) as exists
    `);

    if (!tableExists.rows[0].exists) {
      return res.json({
        success: false,
        message: 'planet_osm_polygon 表不存在，无法进行OSM匹配'
      });
    }

    // 统计需要处理的数据
    const countResult = await db.raw(`
      SELECT COUNT(*) as total
      FROM pixels_history
      WHERE (osm_id IS NULL OR match_quality IS NULL)
        AND latitude IS NOT NULL
        AND longitude IS NOT NULL
        AND latitude BETWEEN 18 AND 54
        AND longitude BETWEEN 73 AND 135
    `);

    const total = parseInt(countResult.rows[0].total);

    if (total === 0) {
      return res.json({
        success: true,
        message: '所有记录已匹配，无需处理',
        data: { total: 0, processed: 0 }
      });
    }

    // 限制单次处理的批次数
    const batchesToProcess = Math.min(maxBatches, Math.ceil(total / batchSize));
    let successCount = 0;

    logger.info(`开始处理 ${batchesToProcess} 批次，每批 ${batchSize} 条`);

    for (let i = 0; i < batchesToProcess; i++) {
      try {
        const result = await db.raw(`
          WITH unmatched_pixels AS (
            SELECT id, latitude, longitude
            FROM pixels_history
            WHERE (osm_id IS NULL OR match_quality IS NULL)
              AND latitude IS NOT NULL
              AND longitude IS NOT NULL
              AND latitude BETWEEN 18 AND 54
              AND longitude BETWEEN 73 AND 135
            ORDER BY id
            LIMIT $1
          ),
          matched_data AS (
            SELECT
              up.id,
              m.osm_id,
              m.admin_level,
              m.matched_method,
              m.distance_m,
              m.match_quality,
              m.city,
              m.province,
              m.country
            FROM unmatched_pixels up
            CROSS JOIN LATERAL (
              SELECT * FROM match_point_to_admin_smart(
                up.latitude::FLOAT,
                up.longitude::FLOAT,
                20000
              )
            ) m
          )
          UPDATE pixels_history ph
          SET
            osm_id = md.osm_id,
            admin_level = md.admin_level,
            matched_method = md.matched_method,
            distance_m = md.distance_m,
            match_quality = md.match_quality,
            city = COALESCE(md.city, ph.city),
            province = COALESCE(md.province, ph.province),
            country = COALESCE(md.country, ph.country),
            match_source = 'postgis_osm',
            match_version = '1.0'
          FROM matched_data md
          WHERE ph.id = md.id
            AND md.osm_id IS NOT NULL
          RETURNING ph.id
        `, [batchSize]);

        successCount += result.rows.length;
        logger.info(`批次 ${i + 1}/${batchesToProcess} 完成: ${result.rows.length} 条`);

      } catch (error) {
        logger.error(`批次 ${i + 1} 处理失败:`, error);
      }
    }

    res.json({
      success: true,
      message: `成功处理 ${successCount} 条记录`,
      data: {
        total,
        processed: successCount,
        batchesProcessed: batchesToProcess,
        remaining: total - successCount
      }
    });

  } catch (error) {
    logger.error('❌ OSM数据填充失败:', error);
    res.status(500).json({
      success: false,
      message: 'OSM数据填充失败',
      error: error.message
    });
  }
});

// 检查OSM数据状态
router.get('/osm-status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const status = {};

    // 检查planet_osm_polygon表
    const tableExists = await db.raw(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'planet_osm_polygon'
      ) as exists
    `);

    status.planet_osm_polygon_exists = tableExists.rows[0].exists;

    if (tableExists.rows[0].exists) {
      const cityCount = await db.raw(`
        SELECT COUNT(*) as count
        FROM planet_osm_polygon
        WHERE admin_level = '6'
      `);
      status.osm_cities = parseInt(cityCount.rows[0].count);
    }

    // 检查pixels_history匹配情况
    const matchStats = await db.raw(`
      SELECT
        COUNT(*) as total,
        COUNT(osm_id) as matched,
        ROUND(COUNT(osm_id) * 100.0 / NULLIF(COUNT(*), 0), 2) as percentage
      FROM pixels_history
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    `);

    status.pixels_history = matchStats.rows[0];

    // 匹配质量分布
    if (parseInt(matchStats.rows[0].matched) > 0) {
      const qualityDist = await db.raw(`
        SELECT
          match_quality,
          COUNT(*) as count
        FROM pixels_history
        WHERE match_quality IS NOT NULL
        GROUP BY match_quality
      `);
      status.match_quality_distribution = qualityDist.rows;
    }

    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    logger.error('❌ 获取OSM状态失败:', error);
    res.status(500).json({
      success: false,
      message: '获取OSM状态失败',
      error: error.message
    });
  }
});

module.exports = router;
