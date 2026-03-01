const { redis, redisUtils } = require('../config/redis');
const logger = require('../utils/logger');
const performanceService = require('./driftBottlePerformanceService');

/**
 * 漂流瓶v2 Redis缓存服务
 * 移除了背包/库存缓存, 新增旅途卡片/配额/遭遇缓存
 */
class DriftBottleCacheService {
  static getInstance() {
    if (!DriftBottleCacheService.instance) {
      DriftBottleCacheService.instance = new DriftBottleCacheService();
    }
    return DriftBottleCacheService.instance;
  }

  constructor() {
    this.TTL = {
      MESSAGES: 3600,
      LATEST_MESSAGE: 1800,
      BOTTLE_INFO: 1800,
      NEARBY_BOTTLES: 60,        // 改为60s (6小时漂流一次, 位置变化慢)
      HOT_BOTTLES: 600,
      USER_STATS: 3600,
      BOTTLE_STATS: 3600,
      // 新增
      JOURNEY_CARDS: 900,        // 15分钟
      JOURNEY_DETAIL: 1800,      // 30分钟
      USER_QUOTA: 300,           // 5分钟
      ENCOUNTER_PUSHED: 1800,    // 30分钟防重复
      UNREAD_COUNT: 600          // 10分钟
    };

    this.KEY_PREFIX = 'drift_bottle:';
    this.MESSAGE_PREFIX = 'drift_bottle_msg:';
    this.USER_PREFIX = 'drift_bottle_user:';
    this.NEARBY_PREFIX = 'drift_bottle_nearby:';
    this.HOT_PREFIX = 'drift_bottle_hot:';
    this.STATS_PREFIX = 'drift_bottle_stats:';
    // 新增前缀
    this.JOURNEY_PREFIX = 'drift_bottle_journey:';
    this.QUOTA_PREFIX = 'drift_bottle_quota:';
    this.ENCOUNTER_PREFIX = 'drift_bottle_encounter:';
  }

  buildKey(prefix, ...parts) {
    return `${prefix}${parts.join(':')}`;
  }

  // ─── 漂流瓶基本信息缓存 ───────────────────────────────────

  async cacheBottleInfo(bottleId, bottleData) {
    try {
      const key = this.buildKey(this.KEY_PREFIX, bottleId);
      const dynamicTTL = performanceService.getDynamicTTL(this.TTL.BOTTLE_INFO);
      await redisUtils.setex(key, dynamicTTL, JSON.stringify(bottleData));
    } catch (error) {
      logger.error('缓存漂流瓶信息失败', { bottleId, error: error.message });
    }
  }

  async getBottleInfo(bottleId) {
    const operation = async () => {
      const key = this.buildKey(this.KEY_PREFIX, bottleId);
      const cached = await redis.get(key);
      performanceService.metrics.cacheHits++;
      return cached ? JSON.parse(cached) : null;
    };

    const fallback = async () => {
      performanceService.metrics.cacheMisses++;
      return null;
    };

    try {
      return await performanceService.withCacheMonitoring(operation, 'getBottleInfo', fallback);
    } catch (error) {
      performanceService.metrics.cacheMisses++;
      return null;
    }
  }

  // ─── 消息缓存 ─────────────────────────────────────────────

  async cacheBottleMessages(bottleId, messages) {
    try {
      const key = this.buildKey(this.MESSAGE_PREFIX, bottleId, 'list');
      await redisUtils.setex(key, this.TTL.MESSAGES, JSON.stringify(messages));

      if (messages && messages.length > 0) {
        const latestKey = this.buildKey(this.MESSAGE_PREFIX, bottleId, 'latest');
        await redisUtils.setex(latestKey, this.TTL.LATEST_MESSAGE, JSON.stringify(messages[messages.length - 1]));
      }
    } catch (error) {
      logger.error('缓存消息失败', { bottleId, error: error.message });
    }
  }

  async getBottleMessages(bottleId) {
    try {
      const key = this.buildKey(this.MESSAGE_PREFIX, bottleId, 'list');
      const cached = await redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      return null;
    }
  }

  async getLatestMessage(bottleId) {
    try {
      const key = this.buildKey(this.MESSAGE_PREFIX, bottleId, 'latest');
      const cached = await redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      return null;
    }
  }

  // ─── 附近漂流瓶缓存 ──────────────────────────────────────

  async cacheNearbyBottles(lat, lng, bottles, radiusKm = 10) {
    try {
      const latKey = lat.toFixed(4);
      const lngKey = lng.toFixed(4);
      const key = this.buildKey(this.NEARBY_PREFIX, latKey, lngKey, radiusKm);
      await redisUtils.setex(key, this.TTL.NEARBY_BOTTLES, JSON.stringify(bottles));
    } catch (error) {
      logger.error('缓存附近漂流瓶失败', { error: error.message });
    }
  }

  async getNearbyBottles(lat, lng, radiusKm = 10) {
    try {
      const latKey = lat.toFixed(4);
      const lngKey = lng.toFixed(4);
      const key = this.buildKey(this.NEARBY_PREFIX, latKey, lngKey, radiusKm);
      const cached = await redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      return null;
    }
  }

  // ─── 旅途卡片缓存 ────────────────────────────────────────

  async cacheJourneyCards(userId, page, data) {
    try {
      const key = this.buildKey(this.JOURNEY_PREFIX, userId, 'list', page);
      await redisUtils.setex(key, this.TTL.JOURNEY_CARDS, JSON.stringify(data));
    } catch (error) {
      logger.error('缓存旅途卡片失败', { error: error.message });
    }
  }

  async getJourneyCards(userId, page) {
    try {
      const key = this.buildKey(this.JOURNEY_PREFIX, userId, 'list', page);
      const cached = await redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      return null;
    }
  }

  async cacheJourneyDetail(bottleId, data) {
    try {
      const key = this.buildKey(this.JOURNEY_PREFIX, 'detail', bottleId);
      await redisUtils.setex(key, this.TTL.JOURNEY_DETAIL, JSON.stringify(data));
    } catch (error) {
      logger.error('缓存旅途详情失败', { error: error.message });
    }
  }

  async getJourneyDetail(bottleId) {
    try {
      const key = this.buildKey(this.JOURNEY_PREFIX, 'detail', bottleId);
      const cached = await redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      return null;
    }
  }

  // ─── 配额缓存 ─────────────────────────────────────────────

  async cacheUserQuota(userId, quotaData) {
    try {
      const key = this.buildKey(this.QUOTA_PREFIX, userId);
      await redisUtils.setex(key, this.TTL.USER_QUOTA, JSON.stringify(quotaData));
    } catch (error) {
      logger.error('缓存用户配额失败', { error: error.message });
    }
  }

  async getUserQuota(userId) {
    try {
      const key = this.buildKey(this.QUOTA_PREFIX, userId);
      const cached = await redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      return null;
    }
  }

  // ─── 遭遇防重复缓存 ──────────────────────────────────────

  async markEncounterPushed(userId, bottleId) {
    try {
      const key = this.buildKey(this.ENCOUNTER_PREFIX, userId, bottleId);
      await redisUtils.setex(key, this.TTL.ENCOUNTER_PUSHED, '1');
    } catch (error) {
      logger.error('标记遭遇推送失败', { error: error.message });
    }
  }

  async isEncounterPushed(userId, bottleId) {
    try {
      const key = this.buildKey(this.ENCOUNTER_PREFIX, userId, bottleId);
      const cached = await redis.get(key);
      return !!cached;
    } catch (error) {
      return false;
    }
  }

  // ─── 未读计数缓存 ────────────────────────────────────────

  async cacheUnreadCount(userId, count) {
    try {
      const key = this.buildKey(this.USER_PREFIX, userId, 'unread_journey');
      await redisUtils.setex(key, this.TTL.UNREAD_COUNT, count.toString());
    } catch (error) {
      logger.error('缓存未读数失败', { error: error.message });
    }
  }

  async getUnreadCount(userId) {
    try {
      const key = this.buildKey(this.USER_PREFIX, userId, 'unread_journey');
      const cached = await redis.get(key);
      return cached ? parseInt(cached, 10) : null;
    } catch (error) {
      return null;
    }
  }

  // ─── 缓存失效 ─────────────────────────────────────────────

  async invalidateBottle(bottleId) {
    try {
      const pipeline = redis.pipeline();
      pipeline.del(this.buildKey(this.KEY_PREFIX, bottleId));
      pipeline.del(this.buildKey(this.MESSAGE_PREFIX, bottleId, 'list'));
      pipeline.del(this.buildKey(this.MESSAGE_PREFIX, bottleId, 'latest'));
      pipeline.del(this.buildKey(this.JOURNEY_PREFIX, 'detail', bottleId));
      await pipeline.exec();
    } catch (error) {
      logger.error('失效漂流瓶缓存失败', { bottleId, error: error.message });
    }
  }

  async invalidateNearbyBottles(lat, lng, radiusKm = 10) {
    try {
      const latKey = lat.toFixed(4);
      const lngKey = lng.toFixed(4);
      const nearbyRadii = [0.5, 1, 5, 10, 20, 50];

      for (const radius of nearbyRadii) {
        const key = this.buildKey(this.NEARBY_PREFIX, latKey, lngKey, radius);
        await redis.del(key);
      }

      // 失效周围坐标点
      const offsets = [0.01, -0.01];
      for (const latOff of offsets) {
        for (const lngOff of offsets) {
          const k = this.buildKey(this.NEARBY_PREFIX, (lat + latOff).toFixed(4), (lng + lngOff).toFixed(4), radiusKm);
          await redis.del(k);
        }
      }
    } catch (error) {
      logger.error('失效附近缓存失败', { error: error.message });
    }
  }

  async invalidateBottleRelatedCaches(bottleId, userId = null, lat = null, lng = null) {
    try {
      const pipeline = redis.pipeline();

      pipeline.del(this.buildKey(this.KEY_PREFIX, bottleId));
      pipeline.del(this.buildKey(this.MESSAGE_PREFIX, bottleId, 'list'));
      pipeline.del(this.buildKey(this.MESSAGE_PREFIX, bottleId, 'latest'));
      pipeline.del(this.buildKey(this.JOURNEY_PREFIX, 'detail', bottleId));

      if (userId) {
        pipeline.del(this.buildKey(this.USER_PREFIX, userId, 'unread_journey'));
        pipeline.del(this.buildKey(this.QUOTA_PREFIX, userId));
        pipeline.del(this.buildKey(this.USER_PREFIX, userId, 'stats'));
        // 失效旅途卡片列表缓存(多页)
        for (let page = 1; page <= 10; page++) {
          pipeline.del(this.buildKey(this.JOURNEY_PREFIX, userId, 'list', page));
        }
      }

      if (lat && lng) {
        await this.invalidateNearbyBottles(lat, lng);
      }

      pipeline.del(this.buildKey(this.HOT_PREFIX, 'list'));
      pipeline.del(this.buildKey(this.STATS_PREFIX, 'system'));

      await pipeline.exec();
    } catch (error) {
      logger.error('智能失效缓存失败', { bottleId, error: error.message });
    }
  }

  async invalidateUserRelatedCaches(userId) {
    try {
      const patterns = [
        this.USER_PREFIX + userId + ':*',
        this.JOURNEY_PREFIX + userId + ':*',
        this.QUOTA_PREFIX + userId
      ];

      for (const pattern of patterns) {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      }
    } catch (error) {
      logger.error('失效用户缓存失败', { userId, error: error.message });
    }
  }

  // ─── 热门/统计缓存(保留) ──────────────────────────────────

  async cacheHotBottles(bottles) {
    try {
      const key = this.buildKey(this.HOT_PREFIX, 'list');
      await redisUtils.setex(key, this.TTL.HOT_BOTTLES, JSON.stringify(bottles));
    } catch (error) {
      logger.error('缓存热门漂流瓶失败', { error: error.message });
    }
  }

  async getHotBottles() {
    try {
      const key = this.buildKey(this.HOT_PREFIX, 'list');
      const cached = await redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      return null;
    }
  }

  async cacheUserStats(userId, stats) {
    try {
      const key = this.buildKey(this.USER_PREFIX, userId, 'stats');
      await redisUtils.setex(key, this.TTL.USER_STATS, JSON.stringify(stats));
    } catch (error) {
      logger.error('缓存用户统计失败', { error: error.message });
    }
  }

  async getUserStats(userId) {
    try {
      const key = this.buildKey(this.USER_PREFIX, userId, 'stats');
      const cached = await redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      return null;
    }
  }

  async getCacheStats() {
    try {
      const keys = await redis.keys(this.KEY_PREFIX + '*');
      return { totalBottleCache: keys.length };
    } catch (error) {
      return { totalBottleCache: 0 };
    }
  }

  async batchCacheBottleInfos(bottles) {
    try {
      if (!bottles || bottles.length === 0) return;
      const pipeline = redis.pipeline();
      bottles.forEach(bottle => {
        if (bottle && bottle.bottle_id) {
          const key = this.buildKey(this.KEY_PREFIX, bottle.bottle_id);
          pipeline.setex(key, this.TTL.BOTTLE_INFO, JSON.stringify(bottle));
        }
      });
      await pipeline.exec();
    } catch (error) {
      logger.error('批量缓存失败', { error: error.message });
    }
  }

  async warmupCache(bottleIds = []) {
    try {
      const { db } = require('../config/database');
      if (bottleIds.length > 0) {
        const bottles = await db('drift_bottles').whereIn('bottle_id', bottleIds).where('is_active', true);
        await this.batchCacheBottleInfos(bottles);
      }
    } catch (error) {
      logger.error('缓存预热失败', { error: error.message });
    }
  }

  async clearAllCache() {
    try {
      const patterns = [
        this.KEY_PREFIX + '*',
        this.MESSAGE_PREFIX + '*',
        this.USER_PREFIX + '*',
        this.NEARBY_PREFIX + '*',
        this.HOT_PREFIX + '*',
        this.STATS_PREFIX + '*',
        this.JOURNEY_PREFIX + '*',
        this.QUOTA_PREFIX + '*',
        this.ENCOUNTER_PREFIX + '*'
      ];

      for (const pattern of patterns) {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      }
      logger.info('所有漂流瓶缓存已清理');
    } catch (error) {
      logger.error('清理缓存失败', { error: error.message });
    }
  }
}

module.exports = DriftBottleCacheService.getInstance();
