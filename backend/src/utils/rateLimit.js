const { redis, redisUtils } = require('../config/redis');

class RateLimiter {
  constructor(windowMs = 10000, maxRequests = 5) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.memoryStore = new Map(); // 内存存储，用于开发环境
  }

  /**
   * 检查是否超过速率限制
   * @param {string} key 限制键（通常是用户ID）
   * @returns {Promise<boolean>} 是否允许请求
   */
  async isAllowed(key) {
    try {
      if (redis) {
        return await this.checkWithRedis(key);
      } else {
        return await this.checkWithMemory(key);
      }
    } catch (error) {
      console.error('速率限制检查失败:', error);
      // 出错时允许请求
      return true;
    }
  }

  /**
   * 使用Redis检查速率限制
   */
  async checkWithRedis(key) {
    try {
      const now = Date.now();
      const windowStart = now - this.windowMs;

      // 检查Redis是否支持multi操作
      if (redis && typeof redis.multi === 'function') {
        // 使用Redis的ZREMRANGEBYSCORE和ZADD实现滑动窗口
        // Node Redis v4 使用 camelCase 命名
        const multi = redis.multi();

        // 检查是否为 Node Redis v4 (使用 camelCase 方法)
        if (typeof multi.zRemRangeByScore === 'function') {
          multi.zRemRangeByScore(key, windowStart, Date.now());
          multi.zAdd(key, { score: now, value: `${now}-${Math.random()}` });
          multi.zCard(key);
          multi.expire(key, Math.ceil(this.windowMs / 1000));
        } else {
          // 旧版本或其他 Redis 客户端
          multi.zremrangebyscore(key, 0, windowStart);
          multi.zadd(key, now, `${now}-${Math.random()}`);
          multi.zcard(key);
          multi.expire(key, Math.ceil(this.windowMs / 1000));
        }

        const results = await multi.exec();

        // 处理不同版本的返回格式
        let requestCount;
        if (Array.isArray(results)) {
          // Node Redis v4 返回格式: [{ success: true, value: count }, ...]
          requestCount = results[2]?.value || results[2];
        } else {
          // 旧版本格式
          requestCount = results[2][1];
        }

        return requestCount <= this.maxRequests;
      } else {
        // 降级到内存模式
        return await this.checkWithMemory(key);
      }
    } catch (error) {
      console.error('Redis速率限制检查失败:', error);
      // 降级到内存模式
      return await this.checkWithMemory(key);
    }
  }

  /**
   * 使用内存检查速率限制
   */
  async checkWithMemory(key) {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    if (!this.memoryStore.has(key)) {
      this.memoryStore.set(key, []);
    }
    
    const requests = this.memoryStore.get(key);
    
    // 清理过期的请求记录
    const validRequests = requests.filter(timestamp => timestamp > windowStart);
    
    if (validRequests.length >= this.maxRequests) {
      return false;
    }
    
    // 添加新请求
    validRequests.push(now);
    this.memoryStore.set(key, validRequests);
    
    // 清理过期的键
    setTimeout(() => {
      if (this.memoryStore.has(key)) {
        const currentRequests = this.memoryStore.get(key);
        const stillValid = currentRequests.filter(timestamp => timestamp > windowStart);
        if (stillValid.length === 0) {
          this.memoryStore.delete(key);
        } else {
          this.memoryStore.set(key, stillValid);
        }
      }
    }, this.windowMs);
    
    return true;
  }

  /**
   * 获取剩余请求次数
   * @param {string} key 限制键
   * @returns {Promise<number>} 剩余请求次数
   */
  async getRemainingRequests(key) {
    try {
      if (redis) {
        const now = Date.now();
        const windowStart = now - this.windowMs;

        // Node Redis v4 使用 camelCase 方法
        if (typeof redis.zRemRangeByScore === 'function') {
          await redis.zRemRangeByScore(key, windowStart, Date.now());
          const requestCount = await redis.zCard(key);
          return Math.max(0, this.maxRequests - requestCount);
        } else {
          // 旧版本或其他 Redis 客户端
          await redis.zremrangebyscore(key, 0, windowStart);
          const requestCount = await redis.zcard(key);
          return Math.max(0, this.maxRequests - requestCount);
        }
      } else {
        const now = Date.now();
        const windowStart = now - this.windowMs;

        if (!this.memoryStore.has(key)) {
          return this.maxRequests;
        }

        const requests = this.memoryStore.get(key);
        const validRequests = requests.filter(timestamp => timestamp > windowStart);

        return Math.max(0, this.maxRequests - validRequests.length);
      }
    } catch (error) {
      console.error('获取剩余请求次数失败:', error);
      return this.maxRequests;
    }
  }
}

module.exports = RateLimiter;
