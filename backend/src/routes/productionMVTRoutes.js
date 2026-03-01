/**
 * Production MVT API Routes
 *
 * Features:
 * - ETag support (304 Not Modified)
 * - Brotli/Gzip content negotiation
 * - Immutable caching for high zoom levels
 * - CORS enabled
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const mvtService = require('../services/productionMVTService');
const spriteService = require('../services/spriteService');
const { optionalAuth } = require('../middleware/auth');
const PatternAsset = require('../models/PatternAsset');

// Helper function to get the appropriate CORS origin
const getCORSOrigin = (req) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:8000',
    'http://127.0.0.1:8000',
    'http://localhost:8002',
    'http://127.0.0.1:8002',
    'https://funnypixels.pages.dev',
    'https://funnypixels-frontend.pages.dev'
  ];

  // 如果有 origin 请求头且在允许列表中，返回该 origin
  // 这样可以确保在使用 credentials: 'include' 时正确响应
  if (origin) {
    // 在生产环境中，允许所有 Cloudflare Pages 域名
    if (process.env.NODE_ENV === 'production') {
      if (allowedOrigins.includes(origin) ||
          /^https:\/\/.*\.pages\.dev$/.test(origin) ||
          /^https:\/\/.*\.cloudflare\.com$/.test(origin)) {
        return origin;
      }
    } else {
      // 开发环境中，只允许预定义的 origin
      if (allowedOrigins.includes(origin)) {
        return origin;
      }
    }
  }

  // 如果没有 origin 或不在允许列表中，不设置 CORS 头
  // 让全局的 CORS 中间件处理
  return null;
};

/**
 * GET /api/tiles/pixels/{z}/{x}/{y}.pbf
 * Production MVT endpoint
 */
router.get('/:z/:x/:y.pbf', async (req, res) => {
  const { z, x, y } = req.params;

  const zoom = parseInt(z, 10);
  const tileX = parseInt(x, 10);
  const tileY = parseInt(y, 10);

  // Validate parameters
  if (
    isNaN(zoom) || isNaN(tileX) || isNaN(tileY) ||
    zoom < 0 || zoom > 20 ||
    tileX < 0 || tileX >= Math.pow(2, zoom) ||
    tileY < 0 || tileY >= Math.pow(2, zoom)
  ) {
    return res.status(400).json({ error: 'Invalid tile coordinates' });
  }

  try {
    const acceptEncoding = req.headers['accept-encoding'] || '';
    const { buffer, encoding, etag, isEmpty } = await mvtService.getTile(zoom, tileX, tileY, acceptEncoding);

    // Check ETag (304 Not Modified)
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }

    // Set headers
    const headers = {
      'Content-Type': 'application/x-protobuf',
      'ETag': etag,
      'X-Tile-Coordinates': `${zoom}/${tileX}/${tileY}`
    };

    // 只有当 origin 在允许列表中时才设置 CORS 头
    const corsOrigin = getCORSOrigin(req);
    if (corsOrigin) {
      headers['Access-Control-Allow-Origin'] = corsOrigin;
      headers['Access-Control-Allow-Credentials'] = 'true';
    }

    // High zoom tiles are immutable (aggressive caching)
    if (zoom >= 16) {
      headers['Cache-Control'] = 'public, max-age=31536000, immutable'; // 1 year
    } else {
      headers['Cache-Control'] = 'public, max-age=3600, must-revalidate'; // 1 hour
    }

    // Add encoding header
    if (encoding !== 'identity') {
      headers['Content-Encoding'] = encoding;
    }

    res.set(headers);

    // Empty tiles return 204 No Content
    if (isEmpty) {
      return res.status(204).end();
    }

    res.send(buffer);

  } catch (error) {
    logger.error(`❌ MVT request failed: ${zoom}/${tileX}/${tileY}`, error);
    res.status(500).json({ error: 'Tile generation failed' });
  }
});

// Handle OPTIONS preflight requests for CORS
router.options('/icon/:scale/:type/:key.png', (req, res) => {
  const corsOrigin = getCORSOrigin(req);
  if (corsOrigin) {
    res.header('Access-Control-Allow-Origin', corsOrigin);
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-idempotency-key, cache-control, Pragma, x-force-refresh, X-Force-Refresh, X-Refresh-Token, X-New-Access-Token, X-Token-Refreshed, x-guest-id');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400'); // 24 hours
  }
  res.status(200).end();
});

/**
 * GET /api/sprites/icon/{scale}/{type}/{key}.png
 * Sprite endpoint (emoji and complex patterns)
 *
 * Examples:
 * - /api/sprites/icon/1/emoji/🔥.png
 * - /api/sprites/icon/2/complex/office.png
 */
router.get('/icon/:scale/:type/:key.png', optionalAuth, async (req, res) => {
  const { scale, type, key } = req.params;
  const scaleNum = parseInt(scale, 10);

  if (isNaN(scaleNum) || scaleNum < 1 || scaleNum > 3) {
    return res.status(400).json({ error: 'Scale must be 1, 2, or 3' });
  }

  if (!['emoji', 'complex', 'color'].includes(type)) {
    return res.status(400).json({ error: 'Type must be emoji, complex, or color' });
  }

  try {
    const pngBuffer = await spriteService.getSprite(decodeURIComponent(key), scaleNum, type);

    // 设置响应头
    // User avatar sprites use short cache (avatar can change), others use 24h immutable cache
    const isUserAvatar = type === 'complex' && decodeURIComponent(key).startsWith('user_avatar_');
    const cacheControl = isUserAvatar
      ? 'public, max-age=300'  // 5 minutes for user avatars
      : 'public, max-age=86400, immutable'; // 24 hours for static patterns
    const headers = {
      'Content-Type': 'image/png',
      'Cache-Control': cacheControl,
      'X-Sprite-Fallback': 'false',
      'X-Sprite-Version': spriteService.SPRITE_VERSION // Cache-busting version
    };

    // 只有当 origin 在允许列表中时才设置 CORS 头
    const corsOrigin = getCORSOrigin(req);
    if (corsOrigin) {
      headers['Access-Control-Allow-Origin'] = corsOrigin;
      headers['Access-Control-Allow-Credentials'] = 'true';
    }

    res.set(headers);
    res.send(pngBuffer);

  } catch (error) {
    // 兜底处理（理论上 renderComplex 已经不会 throw not-found，但保留二次保险）
    logger.warn(`⚠️ Sprite request failed, serving fallback: ${type}/${key}`, error?.message);

    try {
      let fallbackBuffer;
      if (type === 'complex') {
        fallbackBuffer = await spriteService.createOSMFallbackIcon(decodeURIComponent(key), scaleNum);
      } else {
        fallbackBuffer = await spriteService.createFallbackIcon(scaleNum);
      }

      // 设置兜底响应头
      const fallbackHeaders = {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=600, stale-while-revalidate=3600', // 10min, 1hr stale
        'X-Sprite-Fallback': 'true'
      };

      // 只有当 origin 在允许列表中时才设置 CORS 头
      const corsOrigin = getCORSOrigin(req);
      if (corsOrigin) {
        fallbackHeaders['Access-Control-Allow-Origin'] = corsOrigin;
        fallbackHeaders['Access-Control-Allow-Credentials'] = 'true';
      }

      res.set(fallbackHeaders);
      res.status(200).send(fallbackBuffer);

    } catch (fallbackError) {
      logger.error(`❌ Even fallback failed for: ${type}/${key}`, fallbackError);
      res.status(500).json({ error: 'Sprite generation failed' });
    }
  }
});

/**
 * GET /api/sprites/list
 * Get list of all available sprites for preloading
 *
 * Returns manifest of all patterns with their sprite URLs
 * Query params:
 * - scale: 1, 2, or 3 (default: 2)
 * - since: version for incremental updates (optional)
 *
 * Example:
 * - /api/sprites/list?scale=2
 * - /api/sprites/list?scale=2&since=1704067200000
 */
router.get('/list', async (req, res) => {
  try {
    const scale = parseInt(req.query.scale, 10) || 2;
    const since = req.query.since;

    if (scale < 1 || scale > 3) {
      return res.status(400).json({ error: 'Scale must be 1, 2, or 3' });
    }

    let manifest;
    if (since) {
      // Incremental update
      manifest = await PatternAsset.getChanges(since);
    } else {
      // Full manifest
      manifest = await PatternAsset.getManifest();
    }

    // Build response with sprite URLs
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const sprites = manifest.patterns.map(pattern => {
      // Determine sprite type based on render_type
      let spriteType = 'emoji';
      if (pattern.render_type === 'complex') {
        spriteType = 'complex';
      } else if (pattern.render_type === 'color') {
        spriteType = 'color';
      }

      // Build sprite URL
      const key = pattern.render_type === 'emoji' ? (pattern.unicode_char || pattern.key) : pattern.key;
      const spriteUrl = `${baseUrl}/api/sprites/icon/${scale}/${spriteType}/${encodeURIComponent(key)}.png`;

      return {
        id: pattern.id,
        key: pattern.key,
        name: pattern.name,
        category: pattern.category,
        render_type: pattern.render_type,
        unicode_char: pattern.unicode_char,
        color: pattern.color,
        sprite_url: spriteUrl,
        width: pattern.width,
        height: pattern.height,
        updated_at: pattern.updated_at,
        hash: pattern.hash
      };
    });

    // Set CORS headers
    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300, must-revalidate', // 5 minutes
      'X-Sprite-Version': manifest.version
    };

    const corsOrigin = getCORSOrigin(req);
    if (corsOrigin) {
      headers['Access-Control-Allow-Origin'] = corsOrigin;
      headers['Access-Control-Allow-Credentials'] = 'true';
    }

    res.set(headers);

    // If this is an incremental update with no changes, return 304
    if (since && sprites.length === 0) {
      return res.status(304).end();
    }

    res.json({
      version: manifest.version,
      incremental: !!since,
      count: sprites.length,
      sprites
    });

  } catch (error) {
    logger.error('❌ Failed to get sprites list:', error);
    res.status(500).json({ error: 'Failed to get sprites list' });
  }
});

/**
 * GET /api/tiles/pixels/cache/stats
 * Cache statistics (admin)
 */
router.get('/cache/stats', (req, res) => {
  res.json({
    mvt: mvtService.getCacheStats(),
    sprites: spriteService.getCacheStats()
  });
});

/**
 * POST /api/tiles/pixels/cache/clear
 * Clear sprite cache (for debugging/testing)
 * 🔧 修复emoji padding后需要清除缓存才能生效
 */
router.post('/cache/clear', (req, res) => {
  try {
    const beforeSize = spriteService.getCacheStats().size;
    spriteService.clearCache();
    const afterSize = spriteService.getCacheStats().size;

    logger.info(`🗑️ Sprite cache cleared: ${beforeSize} items -> ${afterSize} items`);

    res.json({
      success: true,
      message: 'Sprite cache cleared',
      before: beforeSize,
      after: afterSize
    });
  } catch (error) {
    logger.error('❌ Failed to clear sprite cache:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

/**
 * POST /api/tiles/pixels/cache/invalidate
 * Invalidate cache for pixel update
 */
router.post('/cache/invalidate', async (req, res) => {
  const { lat, lng } = req.body;

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ error: 'lat and lng must be numbers' });
  }

  try {
    await mvtService.invalidatePixelTiles(lat, lng);
    res.json({ success: true });
  } catch (error) {
    logger.error('❌ Cache invalidation failed', error);
    res.status(500).json({ error: 'Invalidation failed' });
  }
});

/**
 * DELETE /api/tiles/pixels/cache/all
 * Clear all caches (admin only)
 */
router.delete('/cache/all', async (req, res) => {
  try {
    await mvtService.clearAllCaches();
    spriteService.clearCache();
    res.json({ success: true, message: 'All caches cleared' });
  } catch (error) {
    logger.error('❌ Cache clear failed', error);
    res.status(500).json({ error: 'Cache clear failed' });
  }
});

module.exports = router;
