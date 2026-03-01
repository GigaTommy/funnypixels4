/**
 * 智能分层缓存服务
 * 实现L1/L2/L3三级缓存架构，最大化缓存命中率
 *
 * L1缓存: 内存缓存 (最快，容量小)
 * L2缓存: Redis缓存 (较快，容量中等)
 * L3缓存: 数据库缓存 (较慢，容量大)
 */

const { redis, redisUtils } = require('../config/redis');
const { db } = require('../config/database');
const logger = require('../utils/logger');

/**
 * 智能缓存策略配置
 */
const CACHE_CONFIG = {
  // L1缓存配置 (内存)
  L1: {
    maxSize: parseInt(process.env.L1_CACHE_MAX_SIZE) || 1000, // 最大条目数
    ttl: parseInt(process.env.L1_CACHE_TTL) || 300, // 5分钟
    cleanupInterval: parseInt(process.env.L1_CACHE_CLEANUP_INTERVAL) || 60000 // 1分钟清理一次
  },

  // L2缓存配置 (Redis)
  L2: {
    ttl: parseInt(process.env.L2_CACHE_TTL) || 3600, // 1小时
    maxSize: parseInt(process.env.L2_CACHE_MAX_SIZE) || 10000, // 最大条目数
    keyPrefix: 'icache:l2:'
  },

  // L3缓存配置 (数据库)
  L3: {
    ttl: parseInt(process.env.L3_CACHE_TTL) || 86400, // 24小时
    table: 'cache_entries',
    cleanupInterval: parseInt(process.env.L3_CACHE_CLEANUP_INTERVAL) || 3600000 // 1小时清理一次
  }
};

/**
 * 智能分层缓存服务
 */
class IntelligentCacheService {
  constructor() {
    // L1内存缓存
    this.l1Cache = new Map();
    this.l1AccessTimes = new Map();
    this.l1Timers = new Map();

    // 缓存统计
    this.stats = {
      l1: { hits: 0, misses: 0, sets: 0, evictions: 0 },
      l2: { hits: 0, misses: 0, sets: 0, evictions: 0 },
      l3: { hits: 0, misses: 0, sets: 0, evictions: 0 },
      total: { requests: 0, responseTime: 0 }
    };

    // 启动清理任务
    this.startCleanupTasks();

    logger.info('🧠 智能分层缓存服务初始化完成', {
      l1MaxSize: CACHE_CONFIG.L1.maxSize,
      l1TTL: CACHE_CONFIG.L1.ttl,
      l2TTL: CACHE_CONFIG.L2.ttl,
      l3TTL: CACHE_CONFIG.L3.ttl
    });
  }

  /**
   * 获取缓存值 (智能三级查找)
   * @param {string} key 缓存键
   * @param {Function} fallbackProvider 缓存未命中时的数据获取函数
   * @param {Object} options 缓存选项
   * @returns {Promise<any>} 缓存值
   */
  async get(key, fallbackProvider = null, options = {}) {
    const startTime = Date.now();
    this.stats.total.requests++;

    try {
      // L1缓存查找 (内存)
      const l1Result = this.getL1(key);
      if (l1Result !== null) {
        this.stats.l1.hits++;
        this.updateResponseTime(startTime);
        logger.debug('🎯 L1缓存命中', { key });
        return l1Result;
      }
      this.stats.l1.misses++;

      // L2缓存查找 (Redis)
      const l2Result = await this.getL2(key);
      if (l2Result !== null) {
        this.stats.l2.hits++;
        // 回填到L1缓存
        this.setL1(key, l2Result, options.l1TTL);
        this.updateResponseTime(startTime);
        logger.debug('🎯 L2缓存命中', { key });
        return l2Result;
      }
      this.stats.l2.misses++;

      // L3缓存查找 (数据库)
      const l3Result = await this.getL3(key);
      if (l3Result !== null) {
        this.stats.l3.hits++;
        // 回填到L2和L1缓存
        await this.setL2(key, l3Result, options.l2TTL);
        this.setL1(key, l3Result, options.l1TTL);
        this.updateResponseTime(startTime);
        logger.debug('🎯 L3缓存命中', { key });
        return l3Result;
      }
      this.stats.l3.misses++;

      // 所有缓存都未命中，使用fallback函数获取数据
      if (fallbackProvider && typeof fallbackProvider === 'function') {
        logger.debug('❌ 缓存全部未命中，使用fallback获取数据', { key });
        const data = await fallbackProvider();

        // 存储到所有缓存层
        await this.set(key, data, options);

        this.updateResponseTime(startTime);
        return data;
      }

      this.updateResponseTime(startTime);
      return null;

    } catch (error) {
      logger.error('智能缓存获取失败', { key, error: error.message });
      this.updateResponseTime(startTime);
      return null;
    }
  }

  /**
   * 设置缓存值 (存储到所有层级)
   * @param {string} key 缓存键
   * @param {any} value 缓存值
   * @param {Object} options 缓存选项
   */
  async set(key, value, options = {}) {
    try {
      const l1TTL = options.l1TTL || CACHE_CONFIG.L1.ttl;
      const l2TTL = options.l2TTL || CACHE_CONFIG.L2.ttl;
      const l3TTL = options.l3TTL || CACHE_CONFIG.L3.ttl;

      // 设置到所有缓存层
      this.setL1(key, value, l1TTL);
      await this.setL2(key, value, l2TTL);
      await this.setL3(key, value, l3TTL);

      logger.debug('💾 缓存已设置到所有层级', { key, l1TTL, l2TTL, l3TTL });
    } catch (error) {
      logger.error('智能缓存设置失败', { key, error: error.message });
    }
  }

  /**
   * 删除缓存值 (从所有层级删除)
   * @param {string} key 缓存键
   */
  async delete(key) {
    try {
      // 从所有缓存层删除
      this.deleteL1(key);
      await this.deleteL2(key);
      await this.deleteL3(key);

      logger.debug('🗑️ 缓存已从所有层级删除', { key });
    } catch (error) {
      logger.error('智能缓存删除失败', { key, error: error.message });
    }
  }

  /**
   * 批量获取缓存值
   * @param {Array} keys 缓存键数组
   * @param {Function} fallbackProvider 批量数据获取函数
   * @param {Object} options 缓存选项
   * @returns {Promise<Object>} 键值对对象
   */
  async mget(keys, fallbackProvider = null, options = {}) {
    const results = {};
    const missingKeys = [];

    try {
      // 并行查找L1缓存
      for (const key of keys) {
        const l1Result = this.getL1(key);
        if (l1Result !== null) {
          results[key] = l1Result;
          this.stats.l1.hits++;
        } else {
          missingKeys.push(key);
          this.stats.l1.misses++;
        }
      }

      // 如果还有缺失的键，查找L2缓存
      if (missingKeys.length > 0) {
        const l2Results = await this.mgetL2(missingKeys);
        const stillMissingKeys = [];

        for (const key of missingKeys) {
          if (l2Results[key] !== null) {
            results[key] = l2Results[key];
            this.stats.l2.hits++;
            // 回填到L1
            this.setL1(key, l2Results[key], options.l1TTL);
          } else {
            stillMissingKeys.push(key);
            this.stats.l2.misses++;
          }
        }

        // 如果还有缺失的键，查找L3缓存
        if (stillMissingKeys.length > 0) {
          const l3Results = await this.mgetL3(stillMissingKeys);
          const finalMissingKeys = [];

          for (const key of stillMissingKeys) {
            if (l3Results[key] !== null) {
              results[key] = l3Results[key];
              this.stats.l3.hits++;
              // 回填到L2和L1
              await this.setL2(key, l3Results[key], options.l2TTL);
              this.setL1(key, l3Results[key], options.l1TTL);
            } else {
              finalMissingKeys.push(key);
              this.stats.l3.misses++;
            }
          }

          // 使用fallback获取剩余的数据
          if (finalMissingKeys.length > 0 && fallbackProvider) {
            const fallbackData = await fallbackProvider(finalMissingKeys);
            Object.assign(results, fallbackData);

            // 存储到所有缓存层
            for (const key of finalMissingKeys) {
              if (fallbackData[key] !== undefined) {
                await this.set(key, fallbackData[key], options);
              }
            }
          }
        }
      }

      return results;

    } catch (error) {
      logger.error('批量智能缓存获取失败', { keys, error: error.message });
      return {};
    }
  }

  /**
   * 批量设置缓存值
   * @param {Object} keyValuePairs 键值对对象
   * @param {Object} options 缓存选项
   */
  async mset(keyValuePairs, options = {}) {
    try {
      const keys = Object.keys(keyValuePairs);

      // 并行设置到所有缓存层
      const promises = [
        this.msetL1(keyValuePairs, options.l1TTL),
        this.msetL2(keyValuePairs, options.l2TTL),
        this.msetL3(keyValuePairs, options.l3TTL)
      ];

      await Promise.all(promises);

      logger.debug('💾 批量缓存已设置到所有层级', { keyCount: keys.length });
    } catch (error) {
      logger.error('批量智能缓存设置失败', { error: error.message });
    }
  }

  // ============ L1缓存操作 (内存) ============

  /**
   * L1缓存获取
   */
  getL1(key) {
    if (this.l1Cache.has(key)) {
      // 更新访问时间
      this.l1AccessTimes.set(key, Date.now());
      return this.l1Cache.get(key);
    }
    return null;
  }

  /**
   * L1缓存设置
   */
  setL1(key, value, ttl = CACHE_CONFIG.L1.ttl) {
    // 如果缓存已满，执行LRU淘汰
    if (this.l1Cache.size >= CACHE_CONFIG.L1.maxSize) {
      this.evictLRU();
    }

    // 设置缓存
    this.l1Cache.set(key, value);
    this.l1AccessTimes.set(key, Date.now());
    this.stats.l1.sets++;

    // 设置过期定时器
    if (ttl > 0) {
      const existingTimer = this.l1Timers.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(() => {
        this.deleteL1(key);
      }, ttl * 1000);

      this.l1Timers.set(key, timer);
    }
  }

  /**
   * L1缓存删除
   */
  deleteL1(key) {
    const timer = this.l1Timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.l1Timers.delete(key);
    }

    this.l1Cache.delete(key);
    this.l1AccessTimes.delete(key);
  }

  /**
   * L1批量获取
   */
  mgetL1(keys) {
    const results = {};
    for (const key of keys) {
      const value = this.getL1(key);
      if (value !== null) {
        results[key] = value;
      }
    }
    return results;
  }

  /**
   * L1批量设置
   */
  msetL1(keyValuePairs, ttl = CACHE_CONFIG.L1.ttl) {
    for (const [key, value] of Object.entries(keyValuePairs)) {
      this.setL1(key, value, ttl);
    }
  }

  /**
   * LRU淘汰策略
   */
  evictLRU() {
    let oldestKey = null;
    let oldestTime = Date.now();

    for (const [key, accessTime] of this.l1AccessTimes) {
      if (accessTime < oldestTime) {
        oldestTime = accessTime;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.deleteL1(oldestKey);
      this.stats.l1.evictions++;
      logger.debug('🗑️ L1缓存LRU淘汰', { key: oldestKey });
    }
  }

  // ============ L2缓存操作 (Redis) ============

  /**
   * L2缓存获取
   */
  async getL2(key) {
    try {
      const redisKey = CACHE_CONFIG.L2.keyPrefix + key;
      const value = await redis.get(redisKey);

      if (value) {
        return JSON.parse(value);
      }
      return null;
    } catch (error) {
      logger.warn('L2缓存获取失败', { key, error: error.message });
      return null;
    }
  }

  /**
   * L2缓存设置
   */
  async setL2(key, value, ttl = CACHE_CONFIG.L2.ttl) {
    try {
      const redisKey = CACHE_CONFIG.L2.keyPrefix + key;
      const serializedValue = JSON.stringify(value);

      if (ttl > 0) {
        await redis.setex(redisKey, ttl, serializedValue);
      } else {
        await redis.set(redisKey, serializedValue);
      }

      this.stats.l2.sets++;
    } catch (error) {
      logger.warn('L2缓存设置失败', { key, error: error.message });
    }
  }

  /**
   * L2缓存删除
   */
  async deleteL2(key) {
    try {
      const redisKey = CACHE_CONFIG.L2.keyPrefix + key;
      await redis.del(redisKey);
    } catch (error) {
      logger.warn('L2缓存删除失败', { key, error: error.message });
    }
  }

  /**
   * L2批量获取
   */
  async mgetL2(keys) {
    try {
      const redisKeys = keys.map(key => CACHE_CONFIG.L2.keyPrefix + key);
      const values = await redis.mget(...redisKeys);

      const results = {};
      for (let i = 0; i < keys.length; i++) {
        if (values[i]) {
          try {
            results[keys[i]] = JSON.parse(values[i]);
          } catch (parseError) {
            logger.warn('L2缓存值解析失败', { key: keys[i], error: parseError.message });
          }
        }
      }

      return results;
    } catch (error) {
      logger.warn('L2批量获取失败', { keys, error: error.message });
      return {};
    }
  }

  /**
   * L2批量设置
   */
  async msetL2(keyValuePairs, ttl = CACHE_CONFIG.L2.ttl) {
    try {
      const pipeline = redis.pipeline();

      for (const [key, value] of Object.entries(keyValuePairs)) {
        const redisKey = CACHE_CONFIG.L2.keyPrefix + key;
        const serializedValue = JSON.stringify(value);

        if (ttl > 0) {
          pipeline.setex(redisKey, ttl, serializedValue);
        } else {
          pipeline.set(redisKey, serializedValue);
        }
      }

      await pipeline.exec();
    } catch (error) {
      logger.warn('L2批量设置失败', { error: error.message });
    }
  }

  // ============ L3缓存操作 (数据库) ============

  /**
   * L3缓存获取
   */
  async getL3(key) {
    try {
      const result = await db(CACHE_CONFIG.L3.table)
        .where('key', key)
        .where('expires_at', '>', new Date())
        .first();

      if (result) {
        return JSON.parse(result.value);
      }
      return null;
    } catch (error) {
      logger.warn('L3缓存获取失败', { key, error: error.message });
      return null;
    }
  }

  /**
   * L3缓存设置
   */
  async setL3(key, value, ttl = CACHE_CONFIG.L3.ttl) {
    try {
      const expiresAt = new Date(Date.now() + ttl * 1000);
      const serializedValue = JSON.stringify(value);

      await db(CACHE_CONFIG.L3.table)
        .insert({
          key,
          value: serializedValue,
          expires_at: expiresAt,
          created_at: new Date()
        })
        .onConflict('key')
        .merge({
          value: serializedValue,
          expires_at: expiresAt,
          updated_at: new Date()
        });

      this.stats.l3.sets++;
    } catch (error) {
      logger.warn('L3缓存设置失败', { key, error: error.message });
    }
  }

  /**
   * L3缓存删除
   */
  async deleteL3(key) {
    try {
      await db(CACHE_CONFIG.L3.table).where('key', key).del();
    } catch (error) {
      logger.warn('L3缓存删除失败', { key, error: error.message });
    }
  }

  /**
   * L3批量获取
   */
  async mgetL3(keys) {
    try {
      const results = await db(CACHE_CONFIG.L3.table)
        .whereIn('key', keys)
        .where('expires_at', '>', new Date())
        .select('key', 'value');

      const keyValuePairs = {};
      for (const row of results) {
        try {
          keyValuePairs[row.key] = JSON.parse(row.value);
        } catch (parseError) {
          logger.warn('L3缓存值解析失败', { key: row.key, error: parseError.message });
        }
      }

      return keyValuePairs;
    } catch (error) {
      logger.warn('L3批量获取失败', { keys, error: error.message });
      return {};
    }
  }

  /**
   * L3批量设置
   */
  async msetL3(keyValuePairs, ttl = CACHE_CONFIG.L3.ttl) {
    try {
      const expiresAt = new Date(Date.now() + ttl * 1000);
      const records = Object.entries(keyValuePairs).map(([key, value]) => ({
        key,
        value: JSON.stringify(value),
        expires_at: expiresAt,
        created_at: new Date(),
        updated_at: new Date()
      }));

      // 批量插入或更新
      await db(CACHE_CONFIG.L3.table)
        .insert(records)
        .onConflict('key')
        .merge({
          value: db.raw('EXCLUDED.value'),
          expires_at: db.raw('EXCLUDED.expires_at'),
          updated_at: db.raw('EXCLUDED.updated_at')
        });
    } catch (error) {
      logger.warn('L3批量设置失败', { error: error.message });
    }
  }

  // ============ 管理和维护 ============

  /**
   * 启动清理任务
   */
  startCleanupTasks() {
    // L1缓存清理
    setInterval(() => {
      this.cleanupL1();
    }, CACHE_CONFIG.L1.cleanupInterval);

    // L3缓存清理
    setInterval(() => {
      this.cleanupL3();
    }, CACHE_CONFIG.L3.cleanupInterval);

    logger.debug('🧹 缓存清理任务已启动');
  }

  /**
   * 清理过期的L1缓存
   */
  cleanupL1() {
    const now = Date.now();
    const keysToDelete = [];

    for (const [key, accessTime] of this.l1AccessTimes) {
      // 删除超过TTL且没有定时器的项
      const timer = this.l1Timers.get(key);
      if (!timer && (now - accessTime > CACHE_CONFIG.L1.ttl * 1000)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.deleteL1(key);
    }

    if (keysToDelete.length > 0) {
      logger.debug('🧹 L1缓存清理完成', { deletedCount: keysToDelete.length });
    }
  }

  /**
   * 清理过期的L3缓存
   */
  async cleanupL3() {
    try {
      const deletedCount = await db(CACHE_CONFIG.L3.table)
        .where('expires_at', '<=', new Date())
        .del();

      if (deletedCount > 0) {
        logger.debug('🧹 L3缓存清理完成', { deletedCount });
      }
    } catch (error) {
      logger.error('L3缓存清理失败', { error: error.message });
    }
  }

  /**
   * 获取缓存统计信息
   */
  getStats() {
    const l1HitRate = this.stats.l1.hits + this.stats.l1.misses > 0 ?
      ((this.stats.l1.hits / (this.stats.l1.hits + this.stats.l1.misses)) * 100).toFixed(2) + '%' : '0%';

    const l2HitRate = this.stats.l2.hits + this.stats.l2.misses > 0 ?
      ((this.stats.l2.hits / (this.stats.l2.hits + this.stats.l2.misses)) * 100).toFixed(2) + '%' : '0%';

    const l3HitRate = this.stats.l3.hits + this.stats.l3.misses > 0 ?
      ((this.stats.l3.hits / (this.stats.l3.hits + this.stats.l3.misses)) * 100).toFixed(2) + '%' : '0%';

    const totalHitRate = this.stats.total.requests > 0 ?
      (((this.stats.l1.hits + this.stats.l2.hits + this.stats.l3.hits) / this.stats.total.requests) * 100).toFixed(2) + '%' : '0%';

    return {
      l1: {
        ...this.stats.l1,
        hitRate: l1HitRate,
        currentSize: this.l1Cache.size,
        maxSize: CACHE_CONFIG.L1.maxSize
      },
      l2: {
        ...this.stats.l2,
        hitRate: l2HitRate
      },
      l3: {
        ...this.stats.l3,
        hitRate: l3HitRate
      },
      total: {
        ...this.stats.total,
        hitRate: totalHitRate,
        avgResponseTime: this.stats.total.requests > 0 ?
          (this.stats.total.responseTime / this.stats.total.requests).toFixed(2) + 'ms' : '0ms'
      },
      config: CACHE_CONFIG,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 重置统计信息
   */
  resetStats() {
    this.stats = {
      l1: { hits: 0, misses: 0, sets: 0, evictions: 0 },
      l2: { hits: 0, misses: 0, sets: 0, evictions: 0 },
      l3: { hits: 0, misses: 0, sets: 0, evictions: 0 },
      total: { requests: 0, responseTime: 0 }
    };

    logger.info('📊 智能缓存统计信息已重置');
  }

  /**
   * 清空所有缓存
   */
  async clearAll() {
    try {
      // 清空L1缓存
      this.l1Cache.clear();
      this.l1AccessTimes.clear();

      // 清空L1定时器
      for (const timer of this.l1Timers.values()) {
        clearTimeout(timer);
      }
      this.l1Timers.clear();

      // 清空L2缓存 (Redis)
      const pattern = CACHE_CONFIG.L2.keyPrefix + '*';
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }

      // 清空L3缓存 (数据库)
      await db(CACHE_CONFIG.L3.table).del();

      logger.info('🧹 所有智能缓存已清空');
    } catch (error) {
      logger.error('清空所有缓存失败', { error: error.message });
    }
  }

  /**
   * 更新响应时间统计
   */
  updateResponseTime(startTime) {
    const responseTime = Date.now() - startTime;
    this.stats.total.responseTime += responseTime;
  }

  /**
   * 预热缓存
   * @param {Array} cacheItems 预热缓存项数组 [{key, value, ttl}, ...]
   */
  async warmup(cacheItems) {
    try {
      logger.info('🔥 开始缓存预热', { itemCount: cacheItems.length });

      const promises = cacheItems.map(item =>
        this.set(item.key, item.value, { ttl: item.ttl })
      );

      await Promise.all(promises);

      logger.info('✅ 缓存预热完成', { itemCount: cacheItems.length });
    } catch (error) {
      logger.error('缓存预热失败', { error: error.message });
    }
  }
}

// 创建单例实例
const intelligentCacheService = new IntelligentCacheService();

module.exports = intelligentCacheService;