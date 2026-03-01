const { redis, redisUtils } = require('../config/database');
const { db } = require('../config/database');

class IdempotencyManager {
  /**
   * 检查并设置幂等键
   * @param {string} key 幂等键
   * @param {number} ttlSeconds 过期时间（秒）
   * @returns {Promise<boolean>} 是否为新键
   */
  static async checkAndSet(key, ttlSeconds = 3600) {
    try {
      console.log(`🔑 检查幂等键: ${key}`);
      
      // 优先使用Redis
      if (redisUtils && typeof redisUtils.setex === 'function') {
        // 使用setnx和expire的组合
        const exists = await redisUtils.exists(key);
        console.log(`🔑 幂等键存在检查: ${key} = ${exists}`);
        
        if (exists) {
          console.log(`🔑 幂等键已存在: ${key}`);
          return false; // 键已存在
        }
        
        // 尝试设置键
        const result = await redisUtils.setex(key, ttlSeconds, '1');
        console.log(`🔑 幂等键设置结果: ${key} = ${result}`);
        
        // Upstash Redis可能返回不同的值，检查是否成功
        const success = result === 'OK' || result === 'ok' || result === true || result === 1;
        console.log(`🔑 幂等键设置成功: ${key} = ${success}`);
        
        return success;
      } else {
        console.log(`🔑 Redis不可用，降级到数据库: ${key}`);
        // 降级到数据库
        return await this.checkAndSetInDB(key, ttlSeconds);
      }
    } catch (error) {
      console.error('幂等键检查失败:', error);
      console.error('错误详情:', {
        message: error.message,
        stack: error.stack,
        key: key
      });
      // 出错时降级到数据库
      return await this.checkAndSetInDB(key, ttlSeconds);
    }
  }

  /**
   * 在数据库中检查并设置幂等键
   */
  static async checkAndSetInDB(key, ttlSeconds) {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    
    console.log(`🔑 数据库幂等键检查: ${key}, 过期时间: ${expiresAt.toISOString()}`);
    
    try {
      await db('idempotency_keys').insert({
        key,
        expires_at: expiresAt
      });
      console.log(`🔑 数据库幂等键设置成功: ${key}`);
      return true;
    } catch (error) {
      // 如果键已存在，返回false
      if (error.code === '23505') { // PostgreSQL unique constraint violation
        console.log(`🔑 数据库幂等键已存在: ${key}`);
        return false;
      }
      console.error(`🔑 数据库幂等键设置失败: ${key}`, error);
      throw error;
    }
  }

  /**
   * 清理过期的幂等键
   */
  static async cleanupExpired() {
    try {
      if (redisUtils) {
        // Redis会自动清理过期键
        return;
      } else {
        // 清理数据库中的过期键
        await db('idempotency_keys')
          .where('expires_at', '<', new Date())
          .del();
      }
    } catch (error) {
      console.error('清理过期幂等键失败:', error);
    }
  }
}

module.exports = IdempotencyManager;
