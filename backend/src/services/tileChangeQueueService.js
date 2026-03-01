const { getRedis } = require('../config/redis');
const TileUtils = require('../utils/tileUtils');
const logger = require('../utils/logger');

const DEFAULT_ZOOM_LEVELS = [12, 14, 15, 16, 18];
const DEFAULT_TTL_SECONDS = 300;

function buildChangePayload(pixel, tileId) {
  return {
    tile_id: tileId,
    grid_id: pixel.grid_id,
    gridId: pixel.grid_id,
    latitude: pixel.latitude,
    longitude: pixel.longitude,
    color: pixel.color,
    pattern_id: pixel.pattern_id,
    pattern_anchor_x: pixel.pattern_anchor_x ?? 0,
    pattern_anchor_y: pixel.pattern_anchor_y ?? 0,
    pattern_rotation: pixel.pattern_rotation ?? 0,
    pattern_mirror: pixel.pattern_mirror ?? false,
    user_id: pixel.user_id,
    pixel_type: pixel.pixel_type ?? 'basic',
    related_id: pixel.related_id ?? null,
    updated_at: pixel.updated_at || new Date().toISOString(),
    timestamp: Date.now()
  };
}

function collectTileIds(latitude, longitude, zoomLevels = DEFAULT_ZOOM_LEVELS) {
  const ids = new Set();
  for (const zoom of zoomLevels) {
    try {
      ids.add(TileUtils.latLngToTileId(latitude, longitude, zoom));
    } catch (error) {
      logger.warn('Failed to compute tile id', { latitude, longitude, zoom, error: error.message });
    }
  }
  return Array.from(ids);
}

async function enqueuePixelChange(pixel, options = {}) {
  if (!pixel) {
    return;
  }

  // 获取最新的 redis 实例
  const redisClient = getRedis();

  // Redis不可用时跳过瓦片变更队列
  if (!redisClient) {
    logger.debug('Redis not available, skipping tile change enqueue');
    return;
  }

  const zoomLevels = options.zoomLevels || DEFAULT_ZOOM_LEVELS;
  const ttlSeconds = options.ttlSeconds || DEFAULT_TTL_SECONDS;

  const tileIds = collectTileIds(pixel.latitude, pixel.longitude, zoomLevels);

  if (tileIds.length === 0) {
    return;
  }

  await Promise.allSettled(tileIds.map(async (tileId) => {
    try {
      const key = `tile:changes:${tileId}`;
      const payload = JSON.stringify(buildChangePayload(pixel, tileId));
      await redisClient.lPush(key, payload);
      await redisClient.expire(key, ttlSeconds);
    } catch (error) {
      logger.error('Failed to enqueue tile change', {
        tileId,
        pixelId: pixel.id,
        gridId: pixel.grid_id,
        error: error.message
      });
    }
  }));
}

async function enqueuePixelChanges(pixels, options = {}) {
  if (!Array.isArray(pixels) || pixels.length === 0) {
    return;
  }

  await Promise.allSettled(pixels.map(pixel => enqueuePixelChange(pixel, options)));
}

module.exports = {
  enqueuePixelChange,
  enqueuePixelChanges,
  collectTileIds,
  DEFAULT_ZOOM_LEVELS,
  DEFAULT_TTL_SECONDS
};
