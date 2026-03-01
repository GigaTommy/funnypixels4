const { redis } = require('../config/redis');
const performanceMetrics = require('../monitoring/performanceMetrics');
const prometheusMetrics = require('../monitoring/prometheusMetrics');

const TILE_DATA_PREFIX = 'tile:data:';
const TILE_META_PREFIX = 'tile:meta:';
const TILE_RENDERING_PREFIX = 'tile:rendering:';

const DEFAULT_TTL = parseInt(process.env.TILE_CACHE_TTL || '3600', 10); // 1 hour by default (was 10 minutes)
const RENDER_LOCK_TTL = parseInt(process.env.TILE_RENDER_LOCK_TTL || '120', 10); // prevent duplicate jobs for 2 minutes

class TileCacheService {
  static async getTile(tileId) {
    const [metaRaw, dataRaw] = await Promise.all([
      redis.get(`${TILE_META_PREFIX}${tileId}`),
      redis.get(`${TILE_DATA_PREFIX}${tileId}`)
    ]);

    const metadata = metaRaw ? JSON.parse(metaRaw) : null;

    if (dataRaw) {
      const buffer = Buffer.from(dataRaw, 'base64');
      performanceMetrics.recordTileCacheHit(true);
      prometheusMetrics.recordTileCacheHit('redis', true);
      return { buffer, metadata, layer: 'redis' };
    }

    performanceMetrics.recordTileCacheHit(false);
    prometheusMetrics.recordTileCacheHit('redis', false);
    return { buffer: null, metadata, layer: 'redis' };
  }

  static async setTile(tileId, buffer, metadata, ttl = DEFAULT_TTL) {
    if (!buffer || !metadata) {
      return;
    }

    const expiresIn = Math.max(ttl, 60);

    await Promise.all([
      redis.set(`${TILE_DATA_PREFIX}${tileId}`, buffer.toString('base64')),
      redis.set(`${TILE_META_PREFIX}${tileId}`, JSON.stringify(metadata))
    ]);

    await Promise.all([
      redis.expire(`${TILE_DATA_PREFIX}${tileId}`, expiresIn),
      redis.expire(`${TILE_META_PREFIX}${tileId}`, expiresIn)
    ]);
  }

  static async setMetadata(tileId, metadata, ttl = DEFAULT_TTL) {
    if (!metadata) {
      return;
    }
    const expiresIn = Math.max(ttl, 60);
    await redis.set(`${TILE_META_PREFIX}${tileId}`, JSON.stringify(metadata));
    await redis.expire(`${TILE_META_PREFIX}${tileId}`, expiresIn);
  }

  static async invalidate(tileId) {
    await redis.del(`${TILE_DATA_PREFIX}${tileId}`);
    await redis.del(`${TILE_META_PREFIX}${tileId}`);
  }

  static async markRendering(tileId) {
    const key = `${TILE_RENDERING_PREFIX}${tileId}`;
    const value = Date.now().toString();

    if (typeof redis.setNX === 'function') {
      const result = await redis.setNX(key, value);
      if (result === 1) {
        await redis.expire(key, RENDER_LOCK_TTL);
        return true;
      }
      return false;
    }

    if (typeof redis.setnx === 'function') {
      const result = await redis.setnx(key, value);
      if (result === 1) {
        await redis.expire(key, RENDER_LOCK_TTL);
        return true;
      }
      return false;
    }

    const exists = await redis.exists(key);
    if (exists) {
      return false;
    }

    await redis.set(key, value);
    await redis.expire(key, RENDER_LOCK_TTL);
    return true;
  }

  static async clearRendering(tileId) {
    await redis.del(`${TILE_RENDERING_PREFIX}${tileId}`);
  }

  static async isRendering(tileId) {
    const exists = await redis.exists(`${TILE_RENDERING_PREFIX}${tileId}`);
    return exists === 1;
  }
}

module.exports = TileCacheService;
