/**
 * Redis 配置 - 生产级部署
 *
 * 支持模式：
 * - 开发环境：单实例 Docker Redis
 * - 生产环境：主从 + Sentinel 哨兵
 */

const redis = require('redis');
const logger = require('../utils/logger');

// Redis 客户端实例
let redisClient = null;
let subscriberClient = null;  // 专门用于 Pub/Sub 的客户端

// 连接状态
let isConnected = false;
let isSubscriberConnected = false;

/**
 * 创建 Redis 客户端连接
 */
async function createRedisClient(options = {}) {
  const {
    isSubscriber = false,
    name = 'main'
  } = options;

  try {
    // Redis 连接配置
    const redisConfig = {
      socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error(`${name}: Redis 重连次数超过限制，停止重连`);
            return new Error('重连次数超过限制');
          }
          // 指数退避：1s, 2s, 4s, 8s, ...
          return Math.min(retries * 100, 3000);
        },
        connectTimeout: 10000,  // 10秒连接超时
        lazyConnect: false      // 自动连接
      },
      password: process.env.REDIS_PASSWORD || undefined,
      database: parseInt(process.env.REDIS_DB || '0'),

      // 连接池配置
      maxRetriesPerRequest: 3,

      // 命名（用于日志）
      name: name
    };

    // Sentinel 配置（生产环境）
    if (process.env.REDIS_SENTINEL_ENABLED === 'true') {
      const sentinelHosts = (process.env.REDIS_SENTINEL_HOSTS || 'localhost:26379').split(',');
      const sentinelPorts = sentinelHosts.map(h => {
        const [host, port] = h.split(':');
        return { host, port: parseInt(port || '26379') };
      });

      redisConfig.sentinel = {
        name: process.env.REDIS_SENTINEL_MASTER_NAME || 'mymaster',
        sentinelIterator: function*() {
          for (const sentinel of sentinelPorts) {
            yield sentinel;
          }
        },
        sentinelRetryStrategy: (retries) => {
          if (retries > 3) {
            return new Error('Sentinel 连接重试超过限制');
          }
          return Math.min(retries * 100, 2000);
        }
      };

      logger.info(`🔧 Redis Sentinel 模式: master=${redisConfig.sentinel.name}, hosts=${sentinelHosts.join(',')}`);
    }

    const client = redis.createClient(redisConfig);

    // 连接成功
    client.on('connect', () => {
      logger.info(`✅ Redis [${name}] 连接成功: ${redisConfig.socket.host}:${redisConfig.socket.port}`);
      if (name === 'main') isConnected = true;
      if (name === 'subscriber') isSubscriberConnected = true;
    });

    // 连接错误
    client.on('error', (err) => {
      logger.error(`❌ Redis [${name}] 连接错误:`, err.message);
      if (err.message.includes('ECONNREFUSED')) {
        logger.error(`   请检查 Redis 服务是否运行在 ${redisConfig.socket.host}:${redisConfig.socket.port}`);
      }
    });

    // 准备就绪
    client.on('ready', () => {
      logger.info(`✅ Redis [${name}] 准备就绪`);
    });

    // 连接关闭
    client.on('end', () => {
      logger.warn(`⚠️  Redis [${name}] 连接关闭`);
      if (name === 'main') isConnected = false;
      if (name === 'subscriber') isSubscriberConnected = false;
    });

    // 监听重连
    client.on('reconnecting', () => {
      logger.info(`🔄 Redis [${name}] 正在重连...`);
    });

    // 连接客户端
    await client.connect();

    return client;
  } catch (error) {
    logger.error(`❌ Redis [${name}] 创建客户端失败:`, error);
    throw error;
  }
}

/**
 * 初始化 Redis 连接
 */
async function initializeRedis() {
  try {
    logger.info('🔧 正在初始化 Redis 连接...');
    logger.info(`   配置: host=${process.env.REDIS_HOST || 'localhost'}, port=${process.env.REDIS_PORT || '6379'}`);
    logger.info(`   Sentinel: ${process.env.REDIS_SENTINEL_ENABLED === 'true' ? '启用' : '禁用'}`);

    // 创建主客户端
    redisClient = await createRedisClient({ name: 'main' });

    // 创建订阅专用客户端（Pub/Sub 不能使用主客户端）
    subscriberClient = await createRedisClient({ name: 'subscriber', isSubscriber: true });

    logger.info('✅ Redis 初始化完成');

    // 测试连接
    await testConnection();

    return {
      redis: redisClient,
      subscriber: subscriberClient
    };
  } catch (error) {
    logger.error('❌ Redis 初始化失败:', error);

    // 在开发环境中，如果 Redis 连接失败，可以选择继续运行（降级到内存模式）
    if (process.env.NODE_ENV === 'development') {
      logger.warn('⚠️  开发环境 Redis 连接失败，某些功能可能不可用');
      return {
        redis: null,
        subscriber: null
      };
    }

    throw error;
  }
}

/**
 * 测试 Redis 连接
 */
async function testConnection() {
  if (!redisClient) {
    logger.warn('⚠️  Redis 客户端未初始化');
    return false;
  }

  try {
    const pong = await redisClient.ping();
    logger.info(`✅ Redis 连接测试成功: PING → ${pong}`);
    return true;
  } catch (error) {
    logger.error('❌ Redis 连接测试失败:', error);
    return false;
  }
}

/**
 * 获取 Redis 健康状态
 */
async function getHealthStatus() {
  const status = {
    connected: isConnected,
    subscriberConnected: isSubscriberConnected,
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || '6379',
    mode: process.env.REDIS_SENTINEL_ENABLED === 'true' ? 'sentinel' : 'standalone',
    info: null,
    error: null
  };

  if (redisClient && isConnected) {
    try {
      const info = await redisClient.info('server');
      status.info = parseRedisInfo(info);
    } catch (error) {
      status.error = error.message;
    }
  }

  return status;
}

/**
 * 解析 Redis INFO 输出
 */
function parseRedisInfo(infoString) {
  const info = {};
  const lines = infoString.split('\r\n');

  for (const line of lines) {
    if (line && !line.startsWith('#')) {
      const [key, value] = line.split(':');
      if (key && value) {
        info[key] = value;
      }
    }
  }

  return {
    version: info.redis_version,
    uptime: info.uptime_in_seconds,
    connectedClients: info.connected_clients,
    usedMemory: info.used_memory_human,
    totalMemory: info.maxmemory_human,
    opsPerSecond: info.instantaneous_ops_per_sec
  };
}

/**
 * 优雅关闭 Redis 连接
 */
async function closeRedis() {
  logger.info('🔧 正在关闭 Redis 连接...');

  const promises = [];

  if (redisClient) {
    promises.push(redisClient.quit().catch(err => {
      logger.warn('关闭主客户端时出错:', err.message);
    }));
  }

  if (subscriberClient) {
    promises.push(subscriberClient.quit().catch(err => {
      logger.warn('关闭订阅客户端时出错:', err.message);
    }));
  }

  await Promise.all(promises);

  isConnected = false;
  isSubscriberConnected = false;

  logger.info('✅ Redis 连接已关闭');
}

/**
 * 统一的 Redis 工具函数
 */
const redisUtils = {
  // 基本操作
  async get(key) {
    if (!redisClient) throw new Error('Redis 未连接');
    return await redisClient.get(key);
  },

  async set(key, value) {
    if (!redisClient) throw new Error('Redis 未连接');
    return await redisClient.set(key, value);
  },

  async del(key) {
    if (!redisClient) throw new Error('Redis 未连接');
    return await redisClient.del(key);
  },

  async exists(key) {
    if (!redisClient) throw new Error('Redis 未连接');
    return await redisClient.exists(key);
  },

  async keys(pattern) {
    if (!redisClient) throw new Error('Redis 未连接');
    return await redisClient.keys(pattern);
  },

  // 过期时间
  async expire(key, seconds) {
    if (!redisClient) throw new Error('Redis 未连接');
    return await redisClient.expire(key, seconds);
  },

  async ttl(key) {
    if (!redisClient) throw new Error('Redis 未连接');
    return await redisClient.ttl(key);
  },

  async setex(key, seconds, value) {
    if (!redisClient) throw new Error('Redis 未连接');
    return await redisClient.setEx(key, seconds, value);
  },

  // Hash 操作（支持单字段和对象批量设置）
  async hset(key, fieldOrObject, value) {
    if (!redisClient) throw new Error('Redis 未连接');
    if (typeof fieldOrObject === 'object' && fieldOrObject !== null) {
      // 批量设置: hset(key, { field1: val1, field2: val2 })
      const entries = Object.entries(fieldOrObject);
      if (entries.length === 0) return 0;
      const flat = [];
      for (const [f, v] of entries) {
        flat.push(f, String(v ?? ''));
      }
      return await redisClient.hSet(key, flat);
    }
    return await redisClient.hSet(key, fieldOrObject, String(value ?? ''));
  },

  async hget(key, field) {
    if (!redisClient) throw new Error('Redis 未连接');
    return await redisClient.hGet(key, field);
  },

  async hgetall(key) {
    if (!redisClient) throw new Error('Redis 未连接');
    return await redisClient.hGetAll(key);
  },

  async hdel(key, field) {
    if (!redisClient) throw new Error('Redis 未连接');
    return await redisClient.hDel(key, field);
  },

  async hincrby(key, field, increment) {
    if (!redisClient) throw new Error('Redis 未连接');
    return await redisClient.hIncrBy(key, field, increment);
  },

  // List 操作
  async lpush(key, ...values) {
    if (!redisClient) throw new Error('Redis 未连接');
    return await redisClient.lPush(key, values);
  },

  async rpop(key) {
    if (!redisClient) throw new Error('Redis 未连接');
    return await redisClient.rPop(key);
  },

  async llen(key) {
    if (!redisClient) throw new Error('Redis 未连接');
    return await redisClient.lLen(key);
  },

  async lrange(key, start, stop) {
    if (!redisClient) throw new Error('Redis 未连接');
    return await redisClient.lRange(key, start, stop);
  },

  async ltrim(key, start, stop) {
    if (!redisClient) throw new Error('Redis 未连接');
    return await redisClient.lTrim(key, start, stop);
  },

  // Set 操作
  async sadd(key, ...members) {
    if (!redisClient) throw new Error('Redis 未连接');
    return await redisClient.sAdd(key, members);
  },

  async srem(key, ...members) {
    if (!redisClient) throw new Error('Redis 未连接');
    return await redisClient.sRem(key, members);
  },

  async sismember(key, member) {
    if (!redisClient) throw new Error('Redis 未连接');
    return await redisClient.sIsMember(key, member);
  },

  async smembers(key) {
    if (!redisClient) throw new Error('Redis 未连接');
    return await redisClient.sMembers(key);
  },

  // Sorted Set 操作 (用于排行榜、速率限制等)
  async zadd(key, score, member) {
    if (!redisClient) throw new Error('Redis 未连接');
    return await redisClient.zAdd(key, { score, value: member });
  },

  async zremrangebyscore(key, min, max) {
    if (!redisClient) throw new Error('Redis 未连接');
    return await redisClient.zRemRangeByScore(key, min, max);
  },

  async zcard(key) {
    if (!redisClient) throw new Error('Redis 未连接');
    return await redisClient.zCard(key);
  },

  async zrange(key, start, stop, withScores = false) {
    if (!redisClient) throw new Error('Redis 未连接');
    if (withScores) {
      return await redisClient.zRangeWithScores(key, start, stop);
    }
    return await redisClient.zRange(key, start, stop);
  },

  async zrevrange(key, start, stop, withScores = false) {
    if (!redisClient) throw new Error('Redis 未连接');
    if (withScores) {
      return await redisClient.zRevRangeWithScores(key, start, stop);
    }
    return await redisClient.zRevRange(key, start, stop);
  },

  async zincrby(key, increment, member) {
    if (!redisClient) throw new Error('Redis 未连接');
    return await redisClient.zIncrBy(key, increment, member);
  },

  // 原子操作
  async incr(key) {
    if (!redisClient) throw new Error('Redis 未连接');
    return await redisClient.incr(key);
  },

  async decr(key) {
    if (!redisClient) throw new Error('Redis 未连接');
    return await redisClient.decr(key);
  },

  async incrby(key, increment) {
    if (!redisClient) throw new Error('Redis 未连接');
    return await redisClient.incrBy(key, increment);
  },

  async setnx(key, value) {
    if (!redisClient) throw new Error('Redis 未连接');
    return await redisClient.setNX(key, value);
  },

  // Lua 脚本执行（用于原子操作）
  async eval(script, keys, args) {
    if (!redisClient) throw new Error('Redis 未连接');
    return await redisClient.eval(script, {
      keys: keys || [],
      arguments: (args || []).map(a => String(a))
    });
  },

  // Set 弹出操作
  async spop(key, count) {
    if (!redisClient) throw new Error('Redis 未连接');
    if (count && count > 1) {
      return await redisClient.sPop(key, count);
    }
    return await redisClient.sPop(key);
  },

  // Pub/Sub (使用专用客户端)
  async publish(channel, message) {
    if (!redisClient) throw new Error('Redis 未连接');
    return await redisClient.publish(channel, message);
  },

  async subscribe(channel, callback) {
    if (!subscriberClient) throw new Error('Redis 订阅客户端未连接');

    subscriberClient.subscribe(channel, (message) => {
      callback(message);
    });

    return true;
  },

  async unsubscribe(channel) {
    if (!subscriberClient) throw new Error('Redis 订阅客户端未连接');
    return await subscriberClient.unsubscribe(channel);
  },

  // Pipeline (批量操作)
  pipeline() {
    if (!redisClient) throw new Error('Redis 未连接');

    const multi = redisClient.multi();
    const operations = [];

    return {
      setex(key, seconds, value) {
        multi.setEx(key, seconds, value);
        operations.push({ type: 'setex', key, seconds, value });
        return this;
      },
      set(key, value) {
        multi.set(key, value);
        operations.push({ type: 'set', key, value });
        return this;
      },
      hset(key, field, value) {
        multi.hSet(key, field, value);
        operations.push({ type: 'hset', key, field, value });
        return this;
      },
      expire(key, seconds) {
        multi.expire(key, seconds);
        operations.push({ type: 'expire', key, seconds });
        return this;
      },
      zRemRangeByScore(key, min, max) {
        multi.zRemRangeByScore(key, min, max);
        operations.push({ type: 'zremrangebyscore', key, min, max });
        return this;
      },
      zAdd(key, score, member) {
        multi.zAdd(key, { score, value: member });
        operations.push({ type: 'zadd', key, score, member });
        return this;
      },
      zCard(key) {
        multi.zCard(key);
        operations.push({ type: 'zcard', key });
        return this;
      },
      exec: async () => {
        const results = await multi.exec();
        // Node Redis v4 返回格式: [{ success: true, value: result }, ...]
        return results.map(r => r?.value);
      }
    };
  }
};

// 模块导出
module.exports = {
  initializeRedis,
  // 使用函数而不是 getter，避免解构时缓存 null 值
  getRedis: () => redisClient,
  getSubscriber: () => subscriberClient,
  // 兼容旧代码的 getter
  get redis() {
    return redisClient;
  },
  get subscriber() {
    return subscriberClient;
  },
  get isConnected() {
    return isConnected;
  },
  get isSubscriberConnected() {
    return isSubscriberConnected;
  },
  redisUtils,
  getHealthStatus,
  closeRedis,
  testConnection
};
