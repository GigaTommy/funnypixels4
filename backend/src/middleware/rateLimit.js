const rateLimit = require('express-rate-limit');
const { getRedis } = require('../config/redis');

// 导入 ipKeyGenerator 助手函数
const { ipKeyGenerator } = require('express-rate-limit');

// 自定义 Redis 存储适配器 - 适配 Upstash Redis
// 每个实例通过 prefix 隔离计数器，避免不同限流器之间的计数交叉污染
class RedisStore {
  constructor(prefix = 'rl') {
    this.prefix = prefix;
    this.windowMs = 60000; // 默认值，会被 init() 覆盖
  }

  // express-rate-limit v7 调用此方法传入配置
  init(options) {
    this.windowMs = options.windowMs;
  }

  _prefixKey(key) {
    return `${this.prefix}:${key}`;
  }

  async increment(key) {
    // 每次调用时获取最新的 redis 实例
    const redisClient = getRedis();
    const prefixedKey = this._prefixKey(key);

    // 如果Redis未初始化，直接使用内存存储
    if (!redisClient) {
      return this.fallbackIncrement(prefixedKey);
    }

    try {
      const ttlSeconds = Math.ceil(this.windowMs / 1000);

      // 原子化操作：INCR + TTL 检查 在同一个 MULTI 中执行（1 次 RTT）
      // 避免 INCR 与 EXPIRE 之间因服务器重启/Redis 断连导致的孤立 key 问题
      const results = await redisClient.multi()
        .incr(prefixedKey)
        .pTTL(prefixedKey)
        .exec();

      const count = results[0];
      const pttl = results[1]; // -1 = 无过期时间（孤立 key），>0 = 剩余毫秒

      // 如果 key 没有过期时间（首次创建 或 孤立 key），设置 TTL
      if (pttl < 0) {
        await redisClient.expire(prefixedKey, ttlSeconds);
      }

      return {
        totalHits: count,
        resetTime: new Date(Date.now() + (pttl > 0 ? pttl : this.windowMs))
      };
    } catch (error) {
      console.error('Redis rate limit error:', error);
      // 降级到内存存储
      return this.fallbackIncrement(prefixedKey);
    }
  }

  async decrement(key) {
    const redisClient = getRedis();
    if (!redisClient) return;
    const prefixedKey = this._prefixKey(key);

    try {
      await redisClient.decr(prefixedKey);
    } catch (error) {
      console.error('Redis decrement error:', error);
    }
  }

  async resetKey(key) {
    const redisClient = getRedis();
    if (!redisClient) return;
    const prefixedKey = this._prefixKey(key);

    try {
      await redisClient.del(prefixedKey);
    } catch (error) {
      console.error('Redis reset error:', error);
    }
  }

  // 降级到内存存储
  fallbackIncrement(prefixedKey) {
    if (!this.memoryStore) {
      this.memoryStore = new Map();
    }

    const now = Date.now();

    if (!this.memoryStore.has(prefixedKey)) {
      this.memoryStore.set(prefixedKey, { count: 0, resetTime: now + this.windowMs });
    }

    const entry = this.memoryStore.get(prefixedKey);
    if (now > entry.resetTime) {
      entry.count = 0;
      entry.resetTime = now + this.windowMs;
    }

    entry.count++;

    return {
      totalHits: entry.count,
      resetTime: new Date(entry.resetTime)
    };
  }
}

// 安全的 key 生成器 - 使用 ipKeyGenerator 助手函数
function safeKeyGenerator(req) {
  try {
    // 优先使用用户ID
    if (req.user && req.user.id) {
      return `user:${req.user.id}`;
    }

    // 否则使用 ipKeyGenerator 助手函数处理 IP 地址
    return `ip:${ipKeyGenerator(req)}`;
  } catch (error) {
    console.error('Key generator error:', error);
    return 'unknown';
  }
}

// 通用限流配置
// 🔧 修复：express-rate-limit v7 不允许共享 Store，每个限流器需要独立实例
// prefix 参数用于隔离不同限流器的 Redis 计数器
const createRateLimiter = (windowMs, max, message = '请求过于频繁，请稍后再试', prefix = 'rl') => {
  return rateLimit({
    // 每个限流器创建独立的 Store 实例，通过 prefix 隔离
    store: new RedisStore(prefix),
    windowMs,
    max,
    message: {
      success: false,
      message,
      code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: safeKeyGenerator,
    skip: (req) => {
      // 跳过健康检查等接口
      return req.path === '/api/health';
    }
  });
};

// 导出限流器
// 🔧 修复：每个限流器使用独立的 Store 实例（express-rate-limit v7 要求）
// 通过 prefix 参数实现 Redis 计数器隔离，避免交叉污染
module.exports = {
  createRateLimiter,
  // 预定义的限流器（每个使用独立的 prefix 隔离计数器）
  authLimiter: createRateLimiter(15 * 60 * 1000, 5000, '登录尝试次数过多，请15分钟后再试', 'rl:auth'), // 临时提高到5000次（压测用），原值: 5
  registerLimiter: createRateLimiter(60 * 60 * 1000, 3, '注册尝试次数过多，请1小时后再试', 'rl:reg'), // 1小时3次
  apiLimiter: createRateLimiter(60 * 1000, 200, 'API请求过于频繁，请稍后再试', 'rl:api'), // 1分钟200次（feed/personalStats/pixelsHistory等共享）
  leaderboardLimiter: createRateLimiter(60 * 1000, 60, '排行榜请求过于频繁，请稍后再试', 'rl:lb'), // 1分钟60次（排行榜专用，聚合接口已将4请求合1）
  pixelLimiter: createRateLimiter(60 * 1000, 300, '像素绘制过于频繁，请稍后再试', 'rl:px'), // 1分钟300次
  chatLimiter: createRateLimiter(10 * 1000, 10, '聊天消息发送过于频繁，请稍后再试', 'rl:chat'), // 10秒10次
  uploadLimiter: createRateLimiter(60 * 1000, 5, '文件上传过于频繁，请稍后再试', 'rl:upload'), // 1分钟5次
  adminLimiter: createRateLimiter(60 * 1000, 1000, '管理员操作过于频繁', 'rl:admin'), // 管理员限制较宽松
};
