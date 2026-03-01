/**
 * ============================================================================
 * Cache Redis Client - 通用缓存原语层
 * ============================================================================
 *
 * 【职责边界声明】
 *
 * ✅ 允许的职责：
 *   - 提供 Redis 通用 KV 操作原语（get/set/del/mget/mset/expire 等）
 *   - 提供 Redis 数据结构操作（Hash/ZSet/List/原子操作等）
 *   - 统一 Key 前缀管理（cache:）
 *   - 统一错误处理和降级策略
 *
 * ❌ 禁止的职责：
 *   - 禁止新增业务语义方法（如 getPixel()、getTile()、getLeaderboard()）
 *   - 禁止承载具体业务逻辑（如 JSON 序列化、数据转换）
 *   - 禁止实现业务特定的 Key 命名规则（如 pixel:123:456）
 *   - 禁止扩大抽象层级（不引入 CacheRepository、CacheStrategy 等）
 *
 * 【业务语义层职责分离】
 *
 * 业务语义缓存应通过独立的 Service/Wrapper 实现：
 *   - PixelCacheService: 组合 CacheRedisClient，封装像素缓存逻辑
 *   - TileCacheService: 组合 CacheRedisClient，封装瓦片缓存逻辑
 *   - LeaderboardCacheService: 组合 CacheRedisClient，封装排行榜缓存逻辑
 *
 * 【使用原则】
 *
 * 1. 本类只提供"怎么存"（KV 操作），不关心"存什么"（业务语义）
 * 2. 调用方负责业务 Key 的组装（如 `cache.set('pixel:123', value)`）
 * 3. 调用方负责数据的序列化/反序列化（如 JSON.stringify/parse）
 * 4. 本类保持轻量，后续不应新增业务方法
 *
 * 【代码稳定性承诺】
 *
 * - 本类代码量应保持稳定，不应随业务增长而膨胀
 * - 新增业务缓存功能应通过外层 Service 实现，而非在此类添加方法
 * - 如需新的 Redis 原语操作，需评估是否所有业务域都需要，否则考虑专用客户端
 *
 * ============================================================================
 *
 * 域：CACHE
 * 连接：Node Redis v4 (redis 包)
 * 前缀：cache:
 * 策略：失败时降级到数据库
 */

import { createClient } from 'redis';
import type { RedisClientType } from 'redis';
import { RedisDomain, ClientStatus } from '../types';
import { CACHE_DOMAIN_CONFIG } from '../config/base.config';
import { BaseRedisClient } from './BaseRedisClient';
import logger from '../../utils/logger';

/**
 * Cache 客户端
 */
export class CacheRedisClient extends BaseRedisClient {
  // Node Redis v4 客户端
  private client?: RedisClientType;

  constructor() {
    super(RedisDomain.CACHE, CACHE_DOMAIN_CONFIG);
  }

  /**
   * 初始化客户端
   */
  async initialize(): Promise<void> {
    try {
      logger.info('[Redis:Cache] 正在初始化...');

      // 创建 Node Redis v4 客户端
      this.client = createClient({
        socket: {
          host: this.connectionConfig.host,
          port: this.connectionConfig.port,
          connectTimeout: this.connectionConfig.socket.connectTimeout,
          reconnectStrategy: this.connectionConfig.socket.reconnectStrategy,
        },
        password: this.connectionConfig.password,
        database: this.connectionConfig.db,
      });

      // 连接成功事件
      this.client.on('connect', () => {
        logger.info('[Redis:Cache] 已连接');
        this.status = ClientStatus.CONNECTED;
        this.emit('connected');
      });

      // 错误事件
      this.client.on('error', (err) => {
        logger.error('[Redis:Cache] 连接错误:', err.message);
        this.status = ClientStatus.ERROR;
        this.recordError();
      });

      // 重连事件
      this.client.on('reconnecting', () => {
        logger.warn('[Redis:Cache] 正在重连...');
        this.status = ClientStatus.RECONNECTING;
        this.recordReconnect();
      });

      // 连接客户端
      await this.client.connect();

      // 启动健康检查
      this.startHealthCheck();

      logger.info('[Redis:Cache] ✅ 初始化完成');
    } catch (error) {
      const err = error as Error;
      logger.error('[Redis:Cache] ❌ 初始化失败:', err.message);
      throw err;
    }
  }

  /**
   * 关闭客户端
   */
  async close(): Promise<void> {
    try {
      this.stopHealthCheck();

      if (this.client) {
        await this.client.quit();
        logger.info('[Redis:Cache] 已关闭');
      }

      this.status = ClientStatus.DISCONNECTED;
    } catch (error) {
      const err = error as Error;
      logger.error('[Redis:Cache] 关闭失败:', err.message);
      throw err;
    }
  }

  /**
   * 执行健康检查
   */
  protected async performHealthCheck(): Promise<boolean> {
    if (!this.client || !this.client.isOpen) {
      return false;
    }

    try {
      const pong = await this.client.ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * 获取原始客户端
   */
  getRawClient(): RedisClientType {
    if (!this.client) {
      throw new Error('[Redis:Cache] 客户端未初始化');
    }
    return this.client;
  }

  // ==================== 基础操作 ====================

  /**
   * 设置缓存
   */
  async set(key: string, value: string | Buffer, ttl?: number): Promise<void> {
    this.recordCommand();

    try {
      const fullKey = this.withPrefix(key);
      const expiry = ttl || this.domainConfig.defaultTTL;

      if (expiry > 0) {
        await this.client.setEx(fullKey, expiry, value);
      } else {
        await this.client.set(fullKey, value);
      }
    } catch (error) {
      this.handleError(error as Error, 'set');
    }
  }

  /**
   * 获取缓存
   */
  async get(key: string): Promise<string | null> {
    this.recordCommand();

    try {
      const fullKey = this.withPrefix(key);
      return await this.client.get(fullKey);
    } catch (error) {
      this.handleError(error as Error, 'get');
      return null;
    }
  }

  /**
   * 删除缓存
   */
  async del(key: string): Promise<void> {
    this.recordCommand();

    try {
      const fullKey = this.withPrefix(key);
      await this.client.del(fullKey);
    } catch (error) {
      this.handleError(error as Error, 'del');
    }
  }

  /**
   * 批量获取
   */
  async mget(keys: string[]): Promise<Array<string | null>> {
    this.recordCommand();

    try {
      const fullKeys = this.withPrefixBatch(keys);
      return await this.client.mGet(fullKeys);
    } catch (error) {
      this.handleError(error as Error, 'mget');
      return keys.map(() => null);
    }
  }

  /**
   * 批量设置
   */
  async mset(kvPairs: Record<string, string>): Promise<void> {
    this.recordCommand();

    try {
      const fullPairs: Record<string, string> = {};
      for (const [key, value] of Object.entries(kvPairs)) {
        fullPairs[this.withPrefix(key)] = value;
      }
      await this.client.mSet(fullPairs);
    } catch (error) {
      this.handleError(error as Error, 'mset');
    }
  }

  /**
   * 检查 key 是否存在
   */
  async exists(key: string): Promise<boolean> {
    this.recordCommand();

    try {
      const fullKey = this.withPrefix(key);
      const result = await this.client.exists(fullKey);
      return result === 1;
    } catch (error) {
      this.handleError(error as Error, 'exists');
      return false;
    }
  }

  /**
   * 设置过期时间
   */
  async expire(key: string, seconds: number): Promise<void> {
    this.recordCommand();

    try {
      const fullKey = this.withPrefix(key);
      await this.client.expire(fullKey, seconds);
    } catch (error) {
      this.handleError(error as Error, 'expire');
    }
  }

  /**
   * 获取剩余 TTL
   */
  async ttl(key: string): Promise<number> {
    this.recordCommand();

    try {
      const fullKey = this.withPrefix(key);
      return await this.client.ttl(fullKey);
    } catch (error) {
      this.handleError(error as Error, 'ttl');
      return -1;
    }
  }

  // ==================== Hash 操作 ====================

  /**
   * HSET
   */
  async hset(key: string, field: string, value: string): Promise<void> {
    this.recordCommand();

    try {
      const fullKey = this.withPrefix(key);
      await this.client.hSet(fullKey, field, value);
    } catch (error) {
      this.handleError(error as Error, 'hset');
    }
  }

  /**
   * HGET
   */
  async hget(key: string, field: string): Promise<string | undefined> {
    this.recordCommand();

    try {
      const fullKey = this.withPrefix(key);
      return await this.client.hGet(fullKey, field);
    } catch (error) {
      this.handleError(error as Error, 'hget');
      return undefined;
    }
  }

  /**
   * HGETALL
   */
  async hgetall(key: string): Promise<Record<string, string>> {
    this.recordCommand();

    try {
      const fullKey = this.withPrefix(key);
      return await this.client.hGetAll(fullKey);
    } catch (error) {
      this.handleError(error as Error, 'hgetall');
      return {};
    }
  }

  /**
   * HDEL
   */
  async hdel(key: string, field: string): Promise<void> {
    this.recordCommand();

    try {
      const fullKey = this.withPrefix(key);
      await this.client.hDel(fullKey, field);
    } catch (error) {
      this.handleError(error as Error, 'hdel');
    }
  }

  // ==================== ZSet 操作（排行榜）====================

  /**
   * ZADD
   */
  async zadd(key: string, score: number, member: string): Promise<void> {
    this.recordCommand();

    try {
      const fullKey = this.withPrefix(key);
      await this.client.zAdd(fullKey, { score, value: member });
    } catch (error) {
      this.handleError(error as Error, 'zadd');
    }
  }

  /**
   * ZRANGE（带分数）
   */
  async zrange(
    key: string,
    start: number,
    stop: number,
    withScores = false
  ): Promise<Array<string | { member: string; score: number }>> {
    this.recordCommand();

    try {
      const fullKey = this.withPrefix(key);
      if (withScores) {
        return await this.client.zRangeWithScores(fullKey, start, stop);
      }
      return await this.client.zRange(fullKey, start, stop);
    } catch (error) {
      this.handleError(error as Error, 'zrange');
      return [];
    }
  }

  /**
   * ZREVRANGE（降序，带分数）
   */
  async zrevrange(
    key: string,
    start: number,
    stop: number,
    withScores = false
  ): Promise<Array<string | { member: string; score: number }>> {
    this.recordCommand();

    try {
      const fullKey = this.withPrefix(key);
      if (withScores) {
        return await this.client.zRevRangeWithScores(fullKey, start, stop);
      }
      return await this.client.zRevRange(fullKey, start, stop);
    } catch (error) {
      this.handleError(error as Error, 'zrevrange');
      return [];
    }
  }

  /**
   * ZREM
   */
  async zrem(key: string, member: string): Promise<void> {
    this.recordCommand();

    try {
      const fullKey = this.withPrefix(key);
      await this.client.zRem(fullKey, member);
    } catch (error) {
      this.handleError(error as Error, 'zrem');
    }
  }

  /**
   * ZCARD
   */
  async zcard(key: string): Promise<number> {
    this.recordCommand();

    try {
      const fullKey = this.withPrefix(key);
      return await this.client.zCard(fullKey);
    } catch (error) {
      this.handleError(error as Error, 'zcard');
      return 0;
    }
  }

  // ==================== List 操作 ====================

  /**
   * LPUSH
   */
  async lpush(key: string, ...values: string[]): Promise<void> {
    this.recordCommand();

    try {
      const fullKey = this.withPrefix(key);
      await this.client.lPush(fullKey, values);
    } catch (error) {
      this.handleError(error as Error, 'lpush');
    }
  }

  /**
   * RPOP
   */
  async rpop(key: string): Promise<string | null> {
    this.recordCommand();

    try {
      const fullKey = this.withPrefix(key);
      return await this.client.rPop(fullKey);
    } catch (error) {
      this.handleError(error as Error, 'rpop');
      return null;
    }
  }

  /**
   * LRANGE
   */
  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    this.recordCommand();

    try {
      const fullKey = this.withPrefix(key);
      return await this.client.lRange(fullKey, start, stop);
    } catch (error) {
      this.handleError(error as Error, 'lrange');
      return [];
    }
  }

  /**
   * LLEN
   */
  async llen(key: string): Promise<number> {
    this.recordCommand();

    try {
      const fullKey = this.withPrefix(key);
      return await this.client.lLen(fullKey);
    } catch (error) {
      this.handleError(error as Error, 'llen');
      return 0;
    }
  }

  // ==================== 原子操作 ====================

  /**
   * INCR
   */
  async incr(key: string): Promise<number> {
    this.recordCommand();

    try {
      const fullKey = this.withPrefix(key);
      return await this.client.incr(fullKey);
    } catch (error) {
      this.handleError(error as Error, 'incr');
      return 0;
    }
  }

  /**
   * INCRBY
   */
  async incrby(key: string, increment: number): Promise<number> {
    this.recordCommand();

    try {
      const fullKey = this.withPrefix(key);
      return await this.client.incrBy(fullKey, increment);
    } catch (error) {
      this.handleError(error as Error, 'incrby');
      return 0;
    }
  }

  /**
   * DECR
   */
  async decr(key: string): Promise<number> {
    this.recordCommand();

    try {
      const fullKey = this.withPrefix(key);
      return await this.client.decr(fullKey);
    } catch (error) {
      this.handleError(error as Error, 'decr');
      return 0;
    }
  }
}

export default CacheRedisClient;
