/**
 * Production MVT Service
 *
 * Features:
 * - ST_AsMVT native encoding (replaces geojson-vt)
 * - ETag-based caching
 * - Brotli/Gzip compression
 * - P95 < 200ms performance target
 * - LRU + Redis two-tier caching
 */

const { LRUCache } = require('lru-cache');
const crypto = require('crypto');
const zlib = require('zlib');
const { promisify } = require('util');
const logger = require('../utils/logger');
const { getMVTTile, getAffectedTiles } = require('../models/productionPixelTileQuery');
const { redis, redisUtils } = require('../config/redis');

const brotliCompress = promisify(zlib.brotliCompress);
const gzipCompress = promisify(zlib.gzip);

// Two-tier LRU cache (memory + compressed)
const rawCache = new LRUCache({
  max: 500, // 500 tiles in memory
  maxSize: 50 * 1024 * 1024, // 50MB
  sizeCalculation: (value) => value ? value.length : 1,
  ttl: 1000 * 60 * 5 // 5 minutes
});

const compressedCache = new LRUCache({
  max: 2000, // 2000 compressed tiles
  maxSize: 100 * 1024 * 1024, // 100MB
  sizeCalculation: (value) => {
    if (!value) return 1;
    const brSize = value.br ? value.br.length : 0;
    const gzSize = value.gz ? value.gz.length : 0;
    return Math.max(1, brSize + gzSize);
  },
  ttl: 1000 * 60 * 30 // 30 minutes
});

/**
 * Generate MVT tile with caching and compression
 *
 * @param {number} z - Zoom level
 * @param {number} x - Tile X
 * @param {number} y - Tile Y
 * @param {string} acceptEncoding - Client's Accept-Encoding header
 * @returns {Promise<{buffer: Buffer, encoding: string, etag: string}>}
 */
async function getTile(z, x, y, acceptEncoding = '') {
  const tileKey = `${z}/${x}/${y}`;
  const startTime = Date.now();

  try {
    // 1. Check raw memory cache
    let rawTile = rawCache.get(tileKey);

    if (!rawTile) {
      // 2. Check Redis cache
      const redisKey = `mvt:v2:${tileKey}`;
      let cached = null;

      if (redis) {
        const value = await redis.get(redisKey);
        cached = value ? Buffer.from(value, 'base64') : null;
      }

      if (cached) {
        rawTile = cached;
        if (rawTile && rawTile.length > 0) {
          rawCache.set(tileKey, rawTile);
        }
        logger.debug(`📦 Redis cache hit: ${tileKey}`);
      } else {
        // 3. Generate from database
        logger.info(`🔨 Generating MVT: ${tileKey}`);
        rawTile = await getMVTTile(z, x, y);

        // Ensure rawTile is a Buffer (it might be undefined/null from getMVTTile)
        if (!rawTile) {
          rawTile = Buffer.alloc(0);
        }

        // Cache to memory and Redis (only if not empty)
        if (rawTile && rawTile.length > 0) {
          rawCache.set(tileKey, rawTile);
        }

        // Immutable tiles (high zoom) get longer TTL
        const ttl = z >= 16 ? 3600 * 24 : 3600; // 24h or 1h
        if (redis) {
          await redis.setEx(redisKey, ttl, rawTile.toString('base64'));
        }

        const elapsed = Date.now() - startTime;
        logger.info(`✅ MVT generated: ${tileKey} (${elapsed}ms, ${(rawTile.length / 1024).toFixed(2)}KB)`);
      }
    }

    // 4. Handle empty tiles
    if (rawTile.length === 0) {
      return {
        buffer: Buffer.alloc(0),
        encoding: 'identity',
        etag: generateETag(Buffer.alloc(0)),
        isEmpty: true
      };
    }

    // 5. Get or create compressed versions
    let compressed = compressedCache.get(tileKey);

    if (!compressed && rawTile.length > 0) {
      const [br, gz] = await Promise.all([
        brotliCompress(rawTile, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 6 } }),
        gzipCompress(rawTile, { level: 6 })
      ]);

      compressed = { br, gz, raw: rawTile };
      compressedCache.set(tileKey, compressed);
    }

    // 6. Select best encoding based on client support
    let buffer, encoding;

    if (acceptEncoding.includes('br') && compressed && compressed.br) {
      buffer = compressed.br;
      encoding = 'br';
    } else if (acceptEncoding.includes('gzip') && compressed && compressed.gz) {
      buffer = compressed.gz;
      encoding = 'gzip';
    } else {
      buffer = rawTile;
      encoding = 'identity';
    }

    const etag = generateETag(rawTile); // ETag based on raw content

    const elapsed = Date.now() - startTime;
    if (elapsed > 50) {
      logger.debug(`📊 Tile served: ${tileKey} (${elapsed}ms, ${encoding}, ${(buffer.length / 1024).toFixed(2)}KB)`);
    }

    return { buffer, encoding, etag, isEmpty: false };

  } catch (error) {
    logger.error(`❌ MVT service error: ${tileKey}`, error);
    throw error;
  }
}

/**
 * Generate ETag from content hash
 */
function generateETag(buffer) {
  return `"${crypto.createHash('md5').update(buffer).digest('hex')}"`;
}

/**
 * Invalidate tile cache (for WebSocket updates)
 */
async function invalidateTile(z, x, y) {
  const tileKey = `${z}/${x}/${y}`;
  const redisKey = `mvt:v2:${tileKey}`;

  rawCache.delete(tileKey);
  compressedCache.delete(tileKey);
  if (redis) {
    await redis.del(redisKey);
  }

  logger.debug(`🗑️ Invalidated tile: ${tileKey}`);
}

/**
 * Invalidate all tiles affected by pixel update
 */
async function invalidatePixelTiles(lat, lng) {
  const tiles = getAffectedTiles(lat, lng);

  await Promise.all(tiles.map(({ z, x, y }) => invalidateTile(z, x, y)));

  logger.info(`🗑️ Invalidated ${tiles.length} tiles for pixel at (${lat}, ${lng})`);
}

/**
 * Get cache statistics
 */
function getCacheStats() {
  return {
    raw: {
      size: rawCache.size,
      calculatedSize: rawCache.calculatedSize,
      maxSize: rawCache.maxSize
    },
    compressed: {
      size: compressedCache.size,
      calculatedSize: compressedCache.calculatedSize,
      maxSize: compressedCache.maxSize
    }
  };
}

/**
 * Clear all caches
 */
async function clearAllCaches() {
  rawCache.clear();
  compressedCache.clear();

  const keys = await redis.keys('mvt:v2:*');
  if (keys.length > 0) {
    await redis.del(...keys);
  }

  logger.warn('⚠️ All MVT caches cleared');
}

module.exports = {
  getTile,
  invalidateTile,
  invalidatePixelTiles,
  getCacheStats,
  clearAllCaches
};
