/**
 * 图案缓存服务
 * 管理Redis中的图案缓存，提供高效的缓存策略
 */

const { redis } = require('../config/redis');
const logger = require('../utils/logger');

class PatternCacheService {
  constructor() {
    this.redis = redis;
    
    // 缓存配置
    this.config = {
      keyPrefix: 'pattern:',
      metaPrefix: 'pattern:meta:',
      statsPrefix: 'pattern:stats:',
      ttl: {
        hot: 24 * 60 * 60,      // 24小时 - 热数据
        warm: 7 * 24 * 60 * 60, // 7天 - 温数据
        cold: 30 * 24 * 60 * 60 // 30天 - 冷数据
      },
      maxMemory: 100 * 1024 * 1024, // 100MB最大内存使用
      batchSize: 100
    };
    
    // 缓存统计
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalRequests: 0
    };
  }

  /**
   * 获取图案缓存
   * @param {string} patternId - 图案ID
   * @param {string} resolution - 分辨率
   * @param {string} format - 格式
   * @returns {Object} 图案数据
   */
  async get(patternId, resolution = 'original', format = 'webp') {
    try {
      this.stats.totalRequests++;
      
      const key = this.buildKey(patternId, resolution, format);
      const metaKey = this.buildMetaKey(patternId);
      
      // 获取图案数据
      const patternData = await this.redis.get(key);
      if (!patternData) {
        this.stats.misses++;
        return null;
      }
      
      // 获取元数据
      const metadata = await this.redis.get(metaKey);
      
      // 更新访问统计
      await this.updateAccessStats(patternId);
      
      this.stats.hits++;
      
      return {
        id: patternId,
        data: patternData,
        metadata: metadata ? JSON.parse(metadata) : {},
        cached: true,
        resolution,
        format
      };
      
    } catch (error) {
      logger.error(`缓存获取失败: ${patternId}`, error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * 设置图案缓存
   * @param {string} patternId - 图案ID
   * @param {Object} pattern - 图案数据
   * @param {string} resolution - 分辨率
   * @param {string} format - 格式
   * @param {string} priority - 优先级
   */
  async set(patternId, pattern, resolution = 'original', format = 'webp', priority = 'normal') {
    try {
      const key = this.buildKey(patternId, resolution, format);
      const metaKey = this.buildMetaKey(patternId);
      
      // 确定TTL
      const ttl = this.getTTL(priority);
      
      // 存储图案数据
      await this.redis.setex(key, ttl, pattern.data || pattern.payload);
      
      // 存储元数据
      const metadata = {
        ...pattern.metadata,
        patternId,
        resolution,
        format,
        priority,
        cachedAt: Date.now(),
        accessCount: 0,
        lastAccessed: Date.now()
      };
      
      await this.redis.setex(metaKey, ttl, JSON.stringify(metadata));
      
      // 更新缓存统计
      await this.updateCacheStats(patternId, pattern, priority);
      
      logger.debug(`缓存设置成功: ${patternId} (${resolution}, ${format})`);
      
    } catch (error) {
      logger.error(`缓存设置失败: ${patternId}`, error);
      throw error;
    }
  }

  /**
   * 批量获取图案缓存
   * @param {Array} patternIds - 图案ID数组
   * @param {string} resolution - 分辨率
   * @param {string} format - 格式
   * @returns {Map} 图案数据映射
   */
  async batchGet(patternIds, resolution = 'original', format = 'webp') {
    const results = new Map();
    
    try {
      if (patternIds.length === 0) {
        return results;
      }
      
      // 构建键数组
      const keys = patternIds.map(id => this.buildKey(id, resolution, format));
      const metaKeys = patternIds.map(id => this.buildMetaKey(id));
      
      // 批量获取
      const [patternData, metadata] = await Promise.all([
        this.redis.mget(keys),
        this.redis.mget(metaKeys)
      ]);
      
      // 处理结果
      for (let i = 0; i < patternIds.length; i++) {
        const patternId = patternIds[i];
        const data = patternData[i];
        const meta = metadata[i];
        
        if (data) {
          results.set(patternId, {
            id: patternId,
            data,
            metadata: meta ? JSON.parse(meta) : {},
            cached: true,
            resolution,
            format
          });
          
          // 更新访问统计
          this.updateAccessStats(patternId);
          this.stats.hits++;
        } else {
          this.stats.misses++;
        }
      }
      
      this.stats.totalRequests += patternIds.length;
      
      return results;
      
    } catch (error) {
      logger.error('批量缓存获取失败:', error);
      this.stats.misses += patternIds.length;
      return results;
    }
  }

  /**
   * 批量设置图案缓存
   * @param {Map} patterns - 图案数据映射
   * @param {string} resolution - 分辨率
   * @param {string} format - 格式
   * @param {string} priority - 优先级
   */
  async batchSet(patterns, resolution = 'original', format = 'webp', priority = 'normal') {
    try {
      if (patterns.size === 0) {
        return;
      }
      
      const pipeline = this.redis.pipeline();
      const ttl = this.getTTL(priority);
      
      for (const [patternId, pattern] of patterns) {
        const key = this.buildKey(patternId, resolution, format);
        const metaKey = this.buildMetaKey(patternId);
        
        // 添加图案数据
        pipeline.setex(key, ttl, pattern.data || pattern.payload);
        
        // 添加元数据
        const metadata = {
          ...pattern.metadata,
          patternId,
          resolution,
          format,
          priority,
          cachedAt: Date.now(),
          accessCount: 0,
          lastAccessed: Date.now()
        };
        
        pipeline.setex(metaKey, ttl, JSON.stringify(metadata));
      }
      
      await pipeline.exec();
      
      logger.info(`批量缓存设置完成: ${patterns.size}个图案`);
      
    } catch (error) {
      logger.error('批量缓存设置失败:', error);
      throw error;
    }
  }

  /**
   * 删除图案缓存
   * @param {string} patternId - 图案ID
   * @param {string} resolution - 分辨率
   * @param {string} format - 格式
   */
  async del(patternId, resolution = 'original', format = 'webp') {
    try {
      const key = this.buildKey(patternId, resolution, format);
      const metaKey = this.buildMetaKey(patternId);
      
      await Promise.all([
        this.redis.del(key),
        this.redis.del(metaKey)
      ]);
      
      logger.debug(`缓存删除成功: ${patternId}`);
      
    } catch (error) {
      logger.error(`缓存删除失败: ${patternId}`, error);
      throw error;
    }
  }

  /**
   * 批量删除图案缓存
   * @param {Array} patternIds - 图案ID数组
   * @param {string} resolution - 分辨率
   * @param {string} format - 格式
   */
  async batchDel(patternIds, resolution = 'original', format = 'webp') {
    try {
      if (patternIds.length === 0) {
        return;
      }
      
      const keys = patternIds.flatMap(id => [
        this.buildKey(id, resolution, format),
        this.buildMetaKey(id)
      ]);
      
      await this.redis.del(...keys);
      
      logger.info(`批量缓存删除完成: ${patternIds.length}个图案`);
      
    } catch (error) {
      logger.error('批量缓存删除失败:', error);
      throw error;
    }
  }

  /**
   * 检查缓存是否存在
   * @param {string} patternId - 图案ID
   * @param {string} resolution - 分辨率
   * @param {string} format - 格式
   * @returns {boolean} 是否存在
   */
  async exists(patternId, resolution = 'original', format = 'webp') {
    try {
      const key = this.buildKey(patternId, resolution, format);
      const exists = await this.redis.exists(key);
      return exists === 1;
      
    } catch (error) {
      logger.error(`缓存存在检查失败: ${patternId}`, error);
      return false;
    }
  }

  /**
   * 获取缓存统计
   * @param {string} patternId - 图案ID
   * @returns {Object} 缓存统计
   */
  async getStats(patternId) {
    try {
      const metaKey = this.buildMetaKey(patternId);
      const metadata = await this.redis.get(metaKey);
      
      if (!metadata) {
        return null;
      }
      
      const meta = JSON.parse(metadata);
      
      return {
        patternId,
        accessCount: meta.accessCount || 0,
        lastAccessed: meta.lastAccessed || 0,
        cachedAt: meta.cachedAt || 0,
        priority: meta.priority || 'normal',
        ttl: this.getTTL(meta.priority)
      };
      
    } catch (error) {
      logger.error(`缓存统计获取失败: ${patternId}`, error);
      return null;
    }
  }

  /**
   * 获取全局缓存统计
   * @returns {Object} 全局统计
   */
  getGlobalStats() {
    const hitRate = this.stats.totalRequests > 0 
      ? this.stats.hits / this.stats.totalRequests 
      : 0;
    
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      totalRequests: this.stats.totalRequests,
      hitRate: Math.round(hitRate * 100) / 100
    };
  }

  /**
   * 清理过期缓存
   * @param {string} patternId - 图案ID
   */
  async cleanupExpired(patternId) {
    try {
      const metaKey = this.buildMetaKey(patternId);
      const metadata = await this.redis.get(metaKey);
      
      if (!metadata) {
        return;
      }
      
      const meta = JSON.parse(metadata);
      const ttl = this.getTTL(meta.priority);
      const now = Date.now();
      
      // 检查是否过期
      if (now - meta.cachedAt > ttl * 1000) {
        await this.del(patternId);
        this.stats.evictions++;
        
        logger.debug(`清理过期缓存: ${patternId}`);
      }
      
    } catch (error) {
      logger.error(`清理过期缓存失败: ${patternId}`, error);
    }
  }

  /**
   * 批量清理过期缓存
   * @param {Array} patternIds - 图案ID数组
   */
  async batchCleanupExpired(patternIds) {
    try {
      const cleanupPromises = patternIds.map(id => this.cleanupExpired(id));
      await Promise.allSettled(cleanupPromises);
      
      logger.info(`批量清理过期缓存完成: ${patternIds.length}个图案`);
      
    } catch (error) {
      logger.error('批量清理过期缓存失败:', error);
    }
  }

  /**
   * 预热缓存
   * @param {Array} patternIds - 图案ID数组
   * @param {string} priority - 优先级
   */
  async warmup(patternIds, priority = 'hot') {
    try {
      logger.info(`开始预热缓存: ${patternIds.length}个图案`);
      
      // 这里应该从数据库获取图案数据
      // 暂时跳过具体实现
      
      logger.info(`缓存预热完成: ${patternIds.length}个图案`);
      
    } catch (error) {
      logger.error('缓存预热失败:', error);
      throw error;
    }
  }

  /**
   * 更新访问统计
   * @param {string} patternId - 图案ID
   */
  async updateAccessStats(patternId) {
    try {
      const metaKey = this.buildMetaKey(patternId);
      const metadata = await this.redis.get(metaKey);
      
      if (metadata) {
        const meta = JSON.parse(metadata);
        meta.accessCount = (meta.accessCount || 0) + 1;
        meta.lastAccessed = Date.now();
        
        await this.redis.setex(metaKey, this.getTTL(meta.priority), JSON.stringify(meta));
      }
      
    } catch (error) {
      logger.error(`访问统计更新失败: ${patternId}`, error);
    }
  }

  /**
   * 更新缓存统计
   * @param {string} patternId - 图案ID
   * @param {Object} pattern - 图案数据
   * @param {string} priority - 优先级
   */
  async updateCacheStats(patternId, pattern, priority) {
    try {
      const statsKey = this.buildStatsKey(patternId);
      const stats = {
        patternId,
        size: this.calculateSize(pattern),
        priority,
        cachedAt: Date.now(),
        accessCount: 0,
        lastAccessed: Date.now()
      };
      
      await this.redis.setex(statsKey, this.getTTL(priority), JSON.stringify(stats));
      
    } catch (error) {
      logger.error(`缓存统计更新失败: ${patternId}`, error);
    }
  }

  /**
   * 构建缓存键
   * @param {string} patternId - 图案ID
   * @param {string} resolution - 分辨率
   * @param {string} format - 格式
   * @returns {string} 缓存键
   */
  buildKey(patternId, resolution, format) {
    return `${this.config.keyPrefix}${patternId}:${resolution}:${format}`;
  }

  /**
   * 构建元数据键
   * @param {string} patternId - 图案ID
   * @returns {string} 元数据键
   */
  buildMetaKey(patternId) {
    return `${this.config.metaPrefix}${patternId}`;
  }

  /**
   * 构建统计键
   * @param {string} patternId - 图案ID
   * @returns {string} 统计键
   */
  buildStatsKey(patternId) {
    return `${this.config.statsPrefix}${patternId}`;
  }

  /**
   * 获取TTL
   * @param {string} priority - 优先级
   * @returns {number} TTL秒数
   */
  getTTL(priority) {
    return this.config.ttl[priority] || this.config.ttl.warm;
  }

  /**
   * 计算数据大小
   * @param {Object} pattern - 图案数据
   * @returns {number} 数据大小
   */
  calculateSize(pattern) {
    const data = pattern.data || pattern.payload || '';
    return Buffer.byteLength(data, 'utf8');
  }

  /**
   * 重置统计
   */
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalRequests: 0
    };
  }

  /**
   * 获取内存使用情况
   * @returns {Object} 内存使用情况
   */
  async getMemoryUsage() {
    try {
      const info = await this.redis.info('memory');
      const lines = info.split('\r\n');
      const memoryInfo = {};
      
      for (const line of lines) {
        if (line.includes(':')) {
          const [key, value] = line.split(':');
          memoryInfo[key] = value;
        }
      }
      
      return {
        usedMemory: parseInt(memoryInfo.used_memory) || 0,
        usedMemoryHuman: memoryInfo.used_memory_human || '0B',
        maxMemory: parseInt(memoryInfo.maxmemory) || 0,
        maxMemoryHuman: memoryInfo.maxmemory_human || '0B'
      };
      
    } catch (error) {
      logger.error('内存使用情况获取失败:', error);
      return null;
    }
  }
}

module.exports = PatternCacheService;
