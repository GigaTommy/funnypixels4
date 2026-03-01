const { redis } = require('../config/redis');
const UserFollow = require('../models/UserFollow');

class PrivateMessageLimiter {
  constructor() {
    // 使用统一的Redis配置
    this.useRedis = process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL || process.env.NODE_ENV === 'production';

    if (this.useRedis) {
      this.redis = redis; // 使用统一配置的Redis客户端
    } else {
      // 内存存储（仅用于开发环境）
      this.memoryStore = new Map();
    }

    // 配置限额 - 开发环境使用更宽松的限制
    const isDevelopment = process.env.NODE_ENV === 'development' || process.env.LOCAL_VALIDATION === 'true';

    this.config = {
      dailyMessageLimit: parseInt(process.env.PM_DAILY_MESSAGE_LIMIT) || (isDevelopment ? 100 : 20), // 开发环境更多消息
      dailyTargetLimit: parseInt(process.env.PM_DAILY_TARGET_LIMIT) || (isDevelopment ? 20 : 5),   // 开发环境更多对象
      rateLimitWindow: 60 * 1000, // 1分钟内速率限制窗口
      rateLimitCount: isDevelopment ? 20 : 5 // 开发环境1分钟内最多20条，生产环境5条
    };
  }

  // 获取Redis键名
  getDailyMessageKey(userId) {
    const today = new Date().toISOString().split('T')[0];
    return `pm:daily:count:${userId}:${today}`;
  }

  getDailyTargetsKey(userId) {
    const today = new Date().toISOString().split('T')[0];
    return `pm:daily:targets:${userId}:${today}`;
  }

  getRateLimitKey(userId) {
    const minute = Math.floor(Date.now() / (60 * 1000));
    return `pm:rate:${userId}:${minute}`;
  }

  // 检查是否互关（互关用户不受限制）
  async isMutualFollow(senderId, receiverId) {
    try {
      const [isFollowing, isFollowedBy] = await Promise.all([
        UserFollow.isFollowing(senderId, receiverId),
        UserFollow.isFollowing(receiverId, senderId)
      ]);
      return isFollowing && isFollowedBy;
    } catch (error) {
      console.error('检查互关状态失败:', error);
      return false;
    }
  }

  // Redis操作
  async redisGet(key) {
    try {
      return await this.redis.get(key);
    } catch (error) {
      console.error('Redis GET 失败:', error);
      return null;
    }
  }

  async redisSet(key, value, expireInSeconds = null) {
    try {
      if (expireInSeconds) {
        return await this.redis.setex(key, expireInSeconds, value);
      }
      return await this.redis.set(key, value);
    } catch (error) {
      console.error('Redis SET 失败:', error);
      return false;
    }
  }

  async redisIncr(key, expireInSeconds = null) {
    try {
      const result = await this.redis.incr(key);
      if (expireInSeconds && result === 1) {
        await this.redis.expire(key, expireInSeconds);
      }
      return result;
    } catch (error) {
      console.error('Redis INCR 失败:', error);
      return 0;
    }
  }

  async redisSadd(key, member, expireInSeconds = null) {
    try {
      const result = await this.redis.sadd(key, member);
      if (expireInSeconds && result === 1) {
        await this.redis.expire(key, expireInSeconds);
      }
      return result;
    } catch (error) {
      console.error('Redis SADD 失败:', error);
      return 0;
    }
  }

  async redisScard(key) {
    try {
      return await this.redis.scard(key);
    } catch (error) {
      console.error('Redis SCARD 失败:', error);
      return 0;
    }
  }

  // 内存存储操作（开发环境）
  memoryGet(key) {
    const data = this.memoryStore.get(key);
    if (data && data.expires && Date.now() > data.expires) {
      this.memoryStore.delete(key);
      return null;
    }
    return data ? data.value : null;
  }

  memorySet(key, value, expireInSeconds = null) {
    const expires = expireInSeconds ? Date.now() + (expireInSeconds * 1000) : null;
    this.memoryStore.set(key, { value, expires });
  }

  memoryIncr(key, expireInSeconds = null) {
    const current = parseInt(this.memoryGet(key)) || 0;
    const newValue = current + 1;
    this.memorySet(key, newValue.toString(), expireInSeconds);
    return newValue;
  }

  memorySadd(key, member, expireInSeconds = null) {
    const current = this.memoryGet(key);
    let set = new Set(current ? JSON.parse(current) : []);
    const isNew = !set.has(member);
    set.add(member);
    this.memorySet(key, JSON.stringify([...set]), expireInSeconds);
    return isNew ? 1 : 0;
  }

  memoryScard(key) {
    const current = this.memoryGet(key);
    return current ? JSON.parse(current).length : 0;
  }

  // 统一的存储接口
  async getValue(key) {
    return this.useRedis ? await this.redisGet(key) : this.memoryGet(key);
  }

  async setValue(key, value, expireInSeconds = null) {
    return this.useRedis ?
      await this.redisSet(key, value, expireInSeconds) :
      this.memorySet(key, value, expireInSeconds);
  }

  async increment(key, expireInSeconds = null) {
    return this.useRedis ?
      await this.redisIncr(key, expireInSeconds) :
      this.memoryIncr(key, expireInSeconds);
  }

  async addToSet(key, member, expireInSeconds = null) {
    return this.useRedis ?
      await this.redisSadd(key, member, expireInSeconds) :
      this.memorySadd(key, member, expireInSeconds);
  }

  async getSetSize(key) {
    return this.useRedis ?
      await this.redisScard(key) :
      this.memoryScard(key);
  }

  // 检查私信发送权限
  async checkPrivateMessagePermission(senderId, receiverId) {
    try {
      // 1. 检查是否互关（互关不受限制）
      const isMutual = await this.isMutualFollow(senderId, receiverId);
      if (isMutual) {
        return {
          allowed: true,
          reason: 'mutual_follow',
          limits: null
        };
      }

      // 2. 检查速率限制（1分钟内最多5条）
      const rateLimitKey = this.getRateLimitKey(senderId);
      const rateLimitCount = parseInt(await this.getValue(rateLimitKey)) || 0;

      if (rateLimitCount >= this.config.rateLimitCount) {
        return {
          allowed: false,
          reason: 'rate_limit_exceeded',
          limits: {
            rateLimitCount: rateLimitCount,
            rateLimitMax: this.config.rateLimitCount,
            rateLimitWindow: this.config.rateLimitWindow
          }
        };
      }

      // 3. 检查每日消息数量限制
      const dailyMessageKey = this.getDailyMessageKey(senderId);
      const dailyMessageCount = parseInt(await this.getValue(dailyMessageKey)) || 0;

      if (dailyMessageCount >= this.config.dailyMessageLimit) {
        return {
          allowed: false,
          reason: 'daily_message_limit_exceeded',
          limits: {
            dailyMessageCount: dailyMessageCount,
            dailyMessageLimit: this.config.dailyMessageLimit
          }
        };
      }

      // 4. 检查每日发送对象数量限制
      const dailyTargetsKey = this.getDailyTargetsKey(senderId);
      const dailyTargetCount = await this.getSetSize(dailyTargetsKey);

      // 如果是新对象且会超过限制
      const hasTargetedToday = await this.getValue(dailyTargetsKey);
      const currentTargets = hasTargetedToday ? JSON.parse(hasTargetedToday) : [];
      const isNewTarget = !currentTargets.includes(receiverId);

      if (isNewTarget && dailyTargetCount >= this.config.dailyTargetLimit) {
        return {
          allowed: false,
          reason: 'daily_target_limit_exceeded',
          limits: {
            dailyTargetCount: dailyTargetCount,
            dailyTargetLimit: this.config.dailyTargetLimit
          }
        };
      }

      // 5. 检查通过，返回当前限额信息
      return {
        allowed: true,
        reason: 'within_limits',
        limits: {
          dailyMessageCount: dailyMessageCount,
          dailyMessageLimit: this.config.dailyMessageLimit,
          dailyTargetCount: dailyTargetCount,
          dailyTargetLimit: this.config.dailyTargetLimit,
          rateLimitCount: rateLimitCount,
          rateLimitMax: this.config.rateLimitCount,
          isNewTarget: isNewTarget
        }
      };
    } catch (error) {
      console.error('检查私信权限失败:', error);
      return {
        allowed: false,
        reason: 'system_error',
        limits: null
      };
    }
  }

  // 记录私信发送（在消息发送成功后调用）
  async recordPrivateMessage(senderId, receiverId) {
    try {
      const expireInSeconds = 24 * 60 * 60; // 24小时过期
      const rateLimitExpire = 60; // 1分钟过期

      // 1. 增加每日消息计数
      const dailyMessageKey = this.getDailyMessageKey(senderId);
      await this.increment(dailyMessageKey, expireInSeconds);

      // 2. 添加到每日目标集合
      const dailyTargetsKey = this.getDailyTargetsKey(senderId);
      await this.addToSet(dailyTargetsKey, receiverId, expireInSeconds);

      // 3. 增加速率限制计数
      const rateLimitKey = this.getRateLimitKey(senderId);
      await this.increment(rateLimitKey, rateLimitExpire);

      console.log(`记录私信发送: ${senderId} -> ${receiverId}`);
      return true;
    } catch (error) {
      console.error('记录私信发送失败:', error);
      return false;
    }
  }

  // 获取用户当前限额状态
  async getUserLimitStatus(userId) {
    try {
      const dailyMessageKey = this.getDailyMessageKey(userId);
      const dailyTargetsKey = this.getDailyTargetsKey(userId);
      const rateLimitKey = this.getRateLimitKey(userId);

      const [dailyMessageCount, dailyTargetCount, rateLimitCount] = await Promise.all([
        parseInt(await this.getValue(dailyMessageKey)) || 0,
        await this.getSetSize(dailyTargetsKey),
        parseInt(await this.getValue(rateLimitKey)) || 0
      ]);

      return {
        dailyMessageCount,
        dailyMessageLimit: this.config.dailyMessageLimit,
        dailyMessageRemaining: Math.max(0, this.config.dailyMessageLimit - dailyMessageCount),

        dailyTargetCount,
        dailyTargetLimit: this.config.dailyTargetLimit,
        dailyTargetRemaining: Math.max(0, this.config.dailyTargetLimit - dailyTargetCount),

        rateLimitCount,
        rateLimitMax: this.config.rateLimitCount,
        rateLimitRemaining: Math.max(0, this.config.rateLimitCount - rateLimitCount),

        isMessageLimitReached: dailyMessageCount >= this.config.dailyMessageLimit,
        isTargetLimitReached: dailyTargetCount >= this.config.dailyTargetLimit,
        isRateLimitReached: rateLimitCount >= this.config.rateLimitCount
      };
    } catch (error) {
      console.error('获取用户限额状态失败:', error);
      return null;
    }
  }

  // 清理过期数据（可选的定时任务）
  async cleanup() {
    if (!this.useRedis && this.memoryStore) {
      const now = Date.now();
      for (const [key, data] of this.memoryStore.entries()) {
        if (data.expires && now > data.expires) {
          this.memoryStore.delete(key);
        }
      }
    }
  }
}

// 创建单例
const privateMessageLimiter = new PrivateMessageLimiter();

module.exports = privateMessageLimiter;