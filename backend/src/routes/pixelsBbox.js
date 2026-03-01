/**
 * 像素BBOX查询路由
 * 3-layer query strategy: L1 Redis response cache → L2 Redis GEOSEARCH → L3 B-Tree DB fallback
 */

const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { redisUtils } = require('../config/database');
const { getRedis } = require('../config/redis');
const logger = require('../utils/logger');
const { createRateLimiter } = require('../middleware/rateLimit');
const patternAssetsCache = require('../services/patternAssetsCacheService');

/**
 * Quantize bounds to zoom-level precision to improve cache hit rate
 */
function quantizeBounds(north, south, east, west, zoom) {
  const precision = zoom >= 18 ? 4 : zoom >= 15 ? 3 : 2;
  const factor = Math.pow(10, precision);
  return {
    n: Math.round(north * factor),
    s: Math.round(south * factor),
    e: Math.round(east * factor),
    w: Math.round(west * factor)
  };
}

/**
 * L2: Redis GEOSEARCH query — returns transformed pixels or null if unavailable
 */
async function queryRedisGeo(north, south, east, west, maxPixels) {
  const redis = getRedis();
  if (!redis) return null;

  try {
    // Convert BBOX to center + dimensions for GEOSEARCH BYBOX
    const centerLat = (north + south) / 2;
    const centerLng = (east + west) / 2;
    const heightM = (north - south) * 111320;
    const widthM = (east - west) * 111320 * Math.cos(centerLat * Math.PI / 180);

    // GEOSEARCH with coordinates
    const geoResults = await redis.geoSearchWith(
      'pixels:geo',
      { longitude: centerLng, latitude: centerLat },
      { width: widthM, height: heightM, unit: 'm' },
      ['WITHCOORD'],
      { COUNT: maxPixels }
    );

    if (!geoResults || geoResults.length === 0) return [];

    // Batch fetch pattern_ids from pixels:meta hash
    const gridIds = geoResults.map(r => r.member);
    const patternIds = await redis.hmGet('pixels:meta', gridIds);

    // Combine with in-memory pattern_assets cache
    const transformedPixels = geoResults.map((r, i) => {
      const patternId = patternIds[i] || null;
      const pa = patternId ? patternAssetsCache.getByKey(patternId) : null;
      return {
        id: r.member,
        lat: parseFloat(r.coordinates.latitude),
        lng: parseFloat(r.coordinates.longitude),
        color: pa?.color || '#808080',
        pattern_id: patternId,
        render_type: pa?.render_type || 'color',
        material_id: pa?.material_id || null,
        unicode_char: pa?.unicode_char || null
      };
    });

    return transformedPixels;
  } catch (err) {
    logger.warn('Redis GEOSEARCH failed (falling back to DB):', err.message);
    return null;
  }
}

/**
 * L3: B-Tree DB fallback — uses idx_pixels_lat_lng_created
 */
async function queryDbBTree(north, south, east, west, maxPixels) {
  const { rows: pixels } = await db.raw(`
    SELECT grid_id, latitude, longitude, color, pattern_id
    FROM pixels
    WHERE latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?
    LIMIT ?
  `, [south, north, west, east, maxPixels]);

  return pixels.map(pixel => {
    const pa = pixel.pattern_id ? patternAssetsCache.getByKey(pixel.pattern_id) : null;
    return {
      id: pixel.grid_id,
      lat: parseFloat(pixel.latitude),
      lng: parseFloat(pixel.longitude),
      color: pixel.color || '#808080',
      pattern_id: pixel.pattern_id,
      render_type: pa ? pa.render_type : 'color',
      material_id: pa ? pa.material_id : null,
      unicode_char: pa ? pa.unicode_char : null
    };
  });
}

/**
 * POST /api/pixels/bbox
 * L1: Redis response cache (TTL=30s) → L2: Redis GEOSEARCH → L3: B-Tree DB fallback
 */
router.post('/bbox', createRateLimiter(60 * 1000, 6000, '地图请求过于频繁，请稍后再试', 'rl:bbox'), async (req, res) => {
  try {
    const { north, south, east, west, zoom } = req.body;

    // Validate parameters
    if (!north || !south || !east || !west || !zoom) {
      return res.status(400).json({
        success: false,
        error: '缺少必需参数: north, south, east, west, zoom'
      });
    }

    if (north <= south || east <= west) {
      return res.status(400).json({
        success: false,
        error: '无效的边界参数'
      });
    }

    if (zoom < 0 || zoom > 22) {
      return res.status(400).json({
        success: false,
        error: '无效的缩放级别'
      });
    }

    // L1: Redis response cache
    const quantized = quantizeBounds(north, south, east, west, zoom);
    const cacheKey = `bbox:${zoom}:${quantized.n}:${quantized.s}:${quantized.e}:${quantized.w}`;
    try {
      const cached = await redisUtils.get(cacheKey);
      if (cached) {
        const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
        return res.json(parsed);
      }
    } catch (cacheErr) {
      logger.warn('BBOX cache read failed:', cacheErr.message);
    }

    // Zoom-based pixel limit
    const maxPixels = zoom >= 18 ? 5000 : zoom >= 16 ? 3000 : zoom >= 14 ? 2000 : 1000;

    // L2: Redis GEOSEARCH → L3: B-Tree DB fallback
    let transformedPixels = await queryRedisGeo(north, south, east, west, maxPixels);
    if (transformedPixels === null) {
      transformedPixels = await queryDbBTree(north, south, east, west, maxPixels);
    }

    const response = {
      success: true,
      pixels: transformedPixels,
      count: transformedPixels.length,
      bounds: { north, south, east, west },
      zoom
    };

    // Write response to L1 cache (TTL=30s)
    try {
      await redisUtils.setex(cacheKey, 30, JSON.stringify(response));
    } catch (cacheErr) {
      logger.warn('BBOX cache write failed:', cacheErr.message);
    }

    res.json(response);

  } catch (error) {
    logger.error('BBOX query failed:', error);
    res.status(500).json({
      success: false,
      error: '查询失败',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/pixels/stats
 */
router.post('/stats', createRateLimiter(60 * 1000, 120, '统计请求过于频繁，请稍后再试', 'rl:bbox-stats'), async (req, res) => {
  try {
    const { north, south, east, west, zoom } = req.body;

    if (!north || !south || !east || !west) {
      return res.status(400).json({
        success: false,
        error: '缺少必需参数'
      });
    }

    const stats = await db('pixels')
      .whereBetween('latitude', [south, north])
      .whereBetween('longitude', [west, east])
      .select(
        db.raw('COUNT(*) as total'),
        db.raw('COUNT(DISTINCT user_id) as unique_users'),
        db.raw('COUNT(DISTINCT pattern_id) as unique_patterns'),
        db.raw('MAX(created_at) as latest_pixel'),
        db.raw('MIN(created_at) as earliest_pixel')
      )
      .first();

    res.json({
      success: true,
      stats,
      bounds: { north, south, east, west }
    });

  } catch (error) {
    logger.error('Stats query failed:', error);
    res.status(500).json({
      success: false,
      error: '查询失败'
    });
  }
});

module.exports = router;
