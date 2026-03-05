const { db } = require('../config/database');
const { redisUtils } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * 地图热力图控制器
 * 提供基于像素绘制活动的GeoJSON热力图数据
 * 根据zoom级别对像素按网格聚合，返回带权重的点集合
 */
class MapHeatmapController {
  /**
   * 获取热力图数据
   * GET /api/map/heatmap?zoom=12&bounds=lat1,lng1,lat2,lng2&period=24h
   *
   * 返回 GeoJSON FeatureCollection，每个 Feature 是一个聚合网格中心点，
   * 带有 weight（绘制次数）属性
   */
  static async getHeatmapData(req, res) {
    try {
      const { zoom = '12', bounds, period = '24h' } = req.query;

      const zoomLevel = parseInt(zoom);
      if (isNaN(zoomLevel) || zoomLevel < 0 || zoomLevel > 22) {
        return res.status(400).json({
          success: false,
          message: 'zoom 参数无效，必须为 0-22 之间的整数'
        });
      }

      // 解析 bounds: lat1,lng1,lat2,lng2 (sw_lat,sw_lng,ne_lat,ne_lng)
      if (!bounds) {
        return res.status(400).json({
          success: false,
          message: 'bounds 参数必填，格式: lat1,lng1,lat2,lng2'
        });
      }

      const boundsParts = bounds.split(',').map(Number);
      if (boundsParts.length !== 4 || boundsParts.some(isNaN)) {
        return res.status(400).json({
          success: false,
          message: 'bounds 格式无效，需要4个数值: lat1,lng1,lat2,lng2'
        });
      }

      const [swLat, swLng, neLat, neLng] = boundsParts;

      // 验证边界范围合理性
      if (Math.abs(neLat - swLat) > 90 || Math.abs(neLng - swLng) > 360) {
        return res.status(400).json({
          success: false,
          message: 'bounds 范围过大'
        });
      }

      // 验证 period
      const validPeriods = ['1h', '6h', '24h', '7d', '30d'];
      if (!validPeriods.includes(period)) {
        return res.status(400).json({
          success: false,
          message: `period 参数无效，可选值: ${validPeriods.join(', ')}`
        });
      }

      // 构建缓存 key: 将 bounds 四舍五入到 2 位小数以提高缓存命中率
      const roundedBounds = boundsParts.map(v => Math.round(v * 100) / 100).join(',');
      const cacheKey = `heatmap:${zoomLevel}:${roundedBounds}:${period}`;

      // 尝试从 Redis 缓存读取
      try {
        const cached = await redisUtils.get(cacheKey);
        if (cached) {
          logger.debug(`热力图缓存命中: ${cacheKey}`);
          return res.json(JSON.parse(cached));
        }
      } catch (redisError) {
        // Redis 不可用时继续查询数据库
        logger.warn('热力图 Redis 缓存读取失败:', redisError.message);
      }

      // 确定网格大小（度数）
      const gridSize = MapHeatmapController._getGridSize(zoomLevel);

      // 计算时间范围
      const periodMs = MapHeatmapController._parsePeriod(period);
      const sinceDate = new Date(Date.now() - periodMs);

      // 查询聚合数据
      const features = await MapHeatmapController._queryAggregatedData(
        swLat, swLng, neLat, neLng,
        gridSize, sinceDate, period
      );

      // 构建 GeoJSON FeatureCollection
      const geojson = {
        type: 'FeatureCollection',
        features: features.map(row => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [parseFloat(row.center_lng), parseFloat(row.center_lat)]
          },
          properties: {
            weight: parseInt(row.draw_count),
            users: parseInt(row.unique_users || 0)
          }
        }))
      };

      const response = {
        success: true,
        data: geojson,
        meta: {
          zoom: zoomLevel,
          period,
          gridSizeKm: MapHeatmapController._gridSizeToKm(gridSize),
          featureCount: features.length,
          generatedAt: new Date().toISOString()
        }
      };

      // 写入 Redis 缓存（5 分钟 TTL）
      try {
        await redisUtils.setex(cacheKey, 300, JSON.stringify(response));
      } catch (redisError) {
        logger.warn('热力图 Redis 缓存写入失败:', redisError.message);
      }

      res.json(response);

    } catch (error) {
      logger.error('获取热力图数据失败:', error);
      res.status(500).json({
        success: false,
        message: '获取热力图数据失败',
        error: process.env.NODE_ENV === 'development' ? error.message : '内部服务器错误'
      });
    }
  }

  /**
   * 根据 zoom 级别返回网格大小（以经纬度度数表示）
   * @private
   */
  static _getGridSize(zoom) {
    if (zoom <= 8) {
      // ~50km → 约 0.5 度
      return 0.5;
    } else if (zoom <= 12) {
      // ~5km → 约 0.05 度
      return 0.05;
    } else {
      // ~500m → 约 0.005 度
      return 0.005;
    }
  }

  /**
   * 将网格大小转换为近似公里数（用于 meta 信息）
   * @private
   */
  static _gridSizeToKm(gridSize) {
    // 1 度 ≈ 111 km（在赤道附近）
    return Math.round(gridSize * 111 * 10) / 10;
  }

  /**
   * 解析 period 字符串为毫秒
   * @private
   */
  static _parsePeriod(period) {
    const map = {
      '1h': 1 * 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };
    return map[period] || map['24h'];
  }

  /**
   * 查询聚合热力图数据
   * 优先从 pixels 表查询（实时数据），如果 period 较长则使用 pixels_history 表
   * @private
   */
  static async _queryAggregatedData(swLat, swLng, neLat, neLng, gridSize, sinceDate, period) {
    // 对于较短周期使用 pixels 表（有 updated_at），长周期使用 pixels_history
    const useHistoryTable = ['7d', '30d'].includes(period);
    const tableName = useHistoryTable ? 'pixels_history' : 'pixels';
    const dateColumn = useHistoryTable ? 'created_at' : 'updated_at';

    // 限制返回的网格数量，防止数据量过大
    const maxGridCells = 2000;

    const result = await db.raw(`
      SELECT
        ROUND(CAST(latitude / ? AS NUMERIC), 0) * ? AS center_lat,
        ROUND(CAST(longitude / ? AS NUMERIC), 0) * ? AS center_lng,
        COUNT(*) AS draw_count,
        COUNT(DISTINCT user_id) AS unique_users
      FROM ??
      WHERE latitude IS NOT NULL
        AND longitude IS NOT NULL
        AND latitude BETWEEN ? AND ?
        AND longitude BETWEEN ? AND ?
        AND ?? >= ?
      GROUP BY
        ROUND(CAST(latitude / ? AS NUMERIC), 0),
        ROUND(CAST(longitude / ? AS NUMERIC), 0)
      HAVING COUNT(*) >= 1
      ORDER BY draw_count DESC
      LIMIT ?
    `, [
      gridSize, gridSize,         // center_lat calculation
      gridSize, gridSize,         // center_lng calculation
      tableName,                  // table name
      swLat, neLat,               // latitude range
      swLng, neLng,               // longitude range
      dateColumn, sinceDate,      // time filter
      gridSize,                   // GROUP BY lat
      gridSize,                   // GROUP BY lng
      maxGridCells                // LIMIT
    ]);

    return result.rows || [];
  }
}

module.exports = MapHeatmapController;
