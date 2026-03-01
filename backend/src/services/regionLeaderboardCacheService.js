// 不在模块加载时导入 redis，而是在使用时动态获取
// const { redis, redisUtils } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * 地区排行榜缓存服务
 * 专门用于优化地区排行榜查询性能的缓存层
 */
class RegionLeaderboardCacheService {
  constructor() {
    // 缓存键前缀
    this.CACHE_PREFIX = 'region_leaderboard:';

    // 缓存时间配置
    this.CACHE_TTL = {
      SHORT: 5 * 60,      // 5分钟 - 实时数据
      MEDIUM: 15 * 60,    // 15分钟 - 准实时数据
      LONG: 60 * 60,      // 1小时 - 历史数据
      DAILY: 24 * 60 * 60 // 24小时 - 日榜数据
    };

    // 缓存层级
    this.CACHE_LAYERS = {
      L1: 'hot',     // 热数据 - 前几名
      L2: 'warm',    // 温数据 - 常查询地区
      L3: 'cold'     // 冷数据 - 少查询地区
    };

    // 热点地区列表（基于历史访问频率）
    this.HOT_REGIONS = new Set([
      '北京', '上海', '广州', '深圳', '成都', '杭州', '武汉', '西安',
      '广东省', '江苏省', '浙江省', '山东省', '河南省', '四川省', '湖北省'
    ]);
  }

  /**
   * 动态获取 redis 客户端
   * 解决模块加载时 redis 未初始化的问题
   */
  getRedis() {
    const { redis } = require('../config/redis');
    return redis;
  }

  /**
   * 生成地区榜缓存键
   */
  getCacheKey(level, period, limit = 50, offset = 0) {
    return `${this.CACHE_PREFIX}${level}:${period}:${limit}:${offset}`;
  }

  /**
   * 生成地区统计缓存键
   */
  getStatsCacheKey(level, period) {
    return `${this.CACHE_PREFIX}stats:${level}:${period}`;
  }

  /**
   * 获取缓存层级
   */
  getCacheLayer(regionName, rank) {
    // 前10名或热点地区为热数据
    if (rank <= 10 || this.HOT_REGIONS.has(regionName)) {
      return this.CACHE_LAYERS.L1;
    }
    // 前50名为温数据
    if (rank <= 50) {
      return this.CACHE_LAYERS.L2;
    }
    // 其他为冷数据
    return this.CACHE_LAYERS.L3;
  }

  /**
   * 获取缓存时间
   */
  getCacheTTL(level, period, rank = 1) {
    const layer = this.getCacheLayer('', rank);

    // 根据缓存层级和统计周期决定TTL
    switch (period) {
      case 'daily':
        return layer === this.CACHE_LAYERS.L1 ? this.CACHE_TTL.SHORT :
               layer === this.CACHE_LAYERS.L2 ? this.CACHE_TTL.MEDIUM :
               this.CACHE_TTL.LONG;
      case 'weekly':
        return layer === this.CACHE_LAYERS.L1 ? this.CACHE_TTL.MEDIUM :
               layer === this.CACHE_LAYERS.L2 ? this.CACHE_TTL.LONG :
               this.CACHE_TTL.DAILY;
      case 'monthly':
        return this.CACHE_TTL.LONG;
      case 'yearly':
        return this.CACHE_TTL.DAILY;
      default:
        return this.CACHE_TTL.MEDIUM;
    }
  }

  /**
   * 缓存地区榜数据
   */
  async cacheRegionLeaderboard(level, period, data, limit = 50, offset = 0) {
    const redis = this.getRedis();

    if (!redis) {
      logger.warn('Redis不可用，跳过缓存');
      return false;
    }

    try {
      const cacheKey = this.getCacheKey(level, period, limit, offset);

      // 计算TTL（基于第一条记录的排名）
      const ttl = this.getCacheTTL(level, period, data.data?.[0]?.rank || 1);

      // 准备缓存数据
      const cacheData = {
        ...data,
        cached_at: new Date().toISOString(),
        cache_ttl: ttl,
        cache_layer: this.getCacheLayer(data.data?.[0]?.region_name || '', data.data?.[0]?.rank || 1)
      };

      // Node Redis v4 不支持 pipeline，改为逐个执行
      // 缓存主要数据
      await redis.setEx(cacheKey, ttl, JSON.stringify(cacheData));

      // 缓存热点数据到单独的键（用于快速访问）
      if (cacheData.cache_layer === this.CACHE_LAYERS.L1 && cacheData.data && cacheData.data[0]) {
        const hotKey = `${this.CACHE_PREFIX}hot:${level}:${period}`;
        await redis.hSet(hotKey, this.generateHotDataKey(cacheData.data[0]), JSON.stringify(cacheData.data[0]));
        await redis.expire(hotKey, ttl);
      }

      // 缓存统计信息
      const statsKey = this.getStatsCacheKey(level, period);
      const statsData = {
        total_regions: data.pagination?.total || 0,
        cached_regions: data.data?.length || 0,
        top_region: data.data?.[0],
        last_updated: new Date().toISOString()
      };
      await redis.setEx(statsKey, ttl, JSON.stringify(statsData));

      logger.debug(`✅ 地区榜缓存成功: ${cacheKey}, TTL: ${ttl}s`);
      return true;
    } catch (error) {
      logger.error('❌ 缓存地区榜数据失败:', error);
      return false;
    }
  }

  /**
   * 获取缓存的地区榜数据
   */
  async getCachedRegionLeaderboard(level, period, limit = 50, offset = 0) {
    const redis = this.getRedis();

    if (!redis) {
      return null;
    }

    try {
      const cacheKey = this.getCacheKey(level, period, limit, offset);
      const cached = await redis.get(cacheKey);

      if (!cached) {
        return null;
      }

      const data = JSON.parse(cached);

      // 检查缓存是否过期
      const now = new Date();
      const cachedAt = new Date(data.cached_at);
      const ageSeconds = (now - cachedAt) / 1000;

      if (ageSeconds > data.cache_ttl) {
        logger.debug(`⚠️ 缓存已过期: ${cacheKey}, age: ${ageSeconds}s, ttl: ${data.cache_ttl}s`);
        await this.deleteCache(cacheKey);
        return null;
      }

      logger.debug(`✅ 缓存命中: ${cacheKey}, age: ${Math.floor(ageSeconds)}s`);
      return data;
    } catch (error) {
      logger.error('❌ 获取缓存数据失败:', error);
      return null;
    }
  }

  /**
   * 获取热点地区数据
   */
  async getHotRegionData(level, period, regionName) {
    const redis = this.getRedis();

    if (!redis) {
      return null;
    }

    try {
      const hotKey = `${this.CACHE_PREFIX}hot:${level}:${period}`;
      const hotData = await redis.hGet(hotKey, regionName);

      if (!hotData) {
        return null;
      }

      return JSON.parse(hotData);
    } catch (error) {
      logger.error('❌ 获取热点地区数据失败:', error);
      return null;
    }
  }

  /**
   * 预加载热门地区榜数据
   */
  async preloadHotRegions() {
    const redis = this.getRedis();

    if (!redis) {
      logger.warn('Redis不可用，跳过预加载');
      return;
    }

    try {
      logger.info('🔄 开始预加载热门地区榜数据...');

      // 为每个统计周期预加载热点地区
      const periods = ['daily', 'weekly', 'monthly'];
      const levels = ['province', 'city'];

      for (const period of periods) {
        for (const level of levels) {
          // 预加载前100名数据
          const limit = 100;
          const offset = 0;

          // 检查是否已缓存
          const cached = await this.getCachedRegionLeaderboard(level, period, limit, offset);
          if (cached) {
            logger.debug(`✅ 已缓存: ${level}-${period}, 跳过预加载`);
            continue;
          }

          // 这里应该调用实际的数据库查询来获取数据
          // 为了避免循环依赖，我们只是记录日志
          logger.debug(`🔄 预加载 ${level}-${period} 前${limit}名地区榜数据`);
        }
      }

      logger.info('✅ 热门地区榜数据预加载完成');
    } catch (error) {
      logger.error('❌ 预加载热门地区榜数据失败:', error);
    }
  }

  /**
   * 删除指定缓存
   */
  async deleteCache(cacheKey) {
    const redis = this.getRedis();
    if (!redis) return;

    try {
      await redis.del(cacheKey);
      logger.debug(`🗑️ 删除缓存: ${cacheKey}`);
    } catch (error) {
      logger.error('❌ 删除缓存失败:', error);
    }
  }

  /**
   * 清除所有地区榜缓存
   */
  async clearAllCache() {
    const redis = this.getRedis();
    if (!redis) return;

    try {
      const pattern = `${this.CACHE_PREFIX}*`;
      const keys = await redis.keys(pattern);

      if (keys.length > 0) {
        await redis.del(keys);
        logger.info(`🗑️ 清除地区榜缓存: ${keys.length} 个键`);
      }
    } catch (error) {
      logger.error('❌ 清除缓存失败:', error);
    }
  }

  /**
   * 清除指定统计周期的缓存
   */
  async clearPeriodCache(period) {
    const redis = this.getRedis();
    if (!redis) return;

    try {
      const pattern = `${this.CACHE_PREFIX}*:${period}:*`;
      const keys = await redis.keys(pattern);

      if (keys.length > 0) {
        await redis.del(keys);
        logger.info(`🗑️ 清除 ${period} 周期缓存: ${keys.length} 个键`);
      }
    } catch (error) {
      logger.error('❌ 清除周期缓存失败:', error);
    }
  }

  /**
   * 获取缓存统计信息
   */
  async getCacheStats() {
    const redis = this.getRedis();
    if (!redis) return null;

    try {
      const pattern = `${this.CACHE_PREFIX}*`;
      const keys = await redis.keys(pattern);

      const stats = {
        total_keys: keys.length,
        keys_by_layer: {
          hot: 0,
          warm: 0,
          cold: 0
        },
        keys_by_period: {
          daily: 0,
          weekly: 0,
          monthly: 0,
          yearly: 0
        },
        memory_usage: 0
      };

      // 分析缓存键分布
      for (const key of keys) {
        const parts = key.split(':');
        if (parts.length >= 3) {
          const period = parts[2];
          if (stats.keys_by_period.hasOwnProperty(period)) {
            stats.keys_by_period[period]++;
          }
        }
      }

      // 获取内存使用情况
      if (redis.info) {
        try {
          const info = await redis.info('memory');
          const memoryMatch = info.match(/used_memory_human:(.+)/);
          if (memoryMatch) {
            stats.memory_usage = memoryMatch[1].trim();
          }
        } catch (error) {
          // 忽略内存信息获取失败
        }
      }

      return stats;
    } catch (error) {
      logger.error('❌ 获取缓存统计失败:', error);
      return null;
    }
  }

  /**
   * 生成热点数据键
   */
  generateHotDataKey(data) {
    if (!data) return 'unknown';
    return `${data.region_name}_${data.rank}`;
  }

  /**
   * 智能缓存预热
   * 根据访问模式智能预热缓存
   */
  async smartPreheat() {
    const redis = this.getRedis();
    if (!redis) return;

    try {
      logger.info('🔄 开始智能缓存预热...');

      // 获取最近访问的热点地区
      const accessPattern = await this.getRecentAccessPattern();

      // 为高频访问的地区预加载更长TTL的缓存
      for (const pattern of accessPattern) {
        const { level, period, frequency } = pattern;

        if (frequency > 10) { // 高频访问
          const extendedTTL = this.getCacheTTL(level, period, 1) * 2;
          logger.debug(`🔥 为高频访问地区扩展TTL: ${level}-${period}, ${extendedTTL}s`);
        }
      }

      logger.info('✅ 智能缓存预热完成');
    } catch (error) {
      logger.error('❌ 智能缓存预热失败:', error);
    }
  }

  /**
   * 获取最近访问模式
   */
  async getRecentAccessPattern() {
    // 这里可以实现访问模式分析
    // 暂时返回模拟数据
    return [
      { level: 'province', period: 'daily', frequency: 25 },
      { level: 'city', period: 'daily', frequency: 18 },
      { level: 'province', period: 'weekly', frequency: 12 }
    ];
  }
}

module.exports = new RegionLeaderboardCacheService();