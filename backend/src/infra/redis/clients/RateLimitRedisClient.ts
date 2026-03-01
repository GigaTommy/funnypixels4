/**
 * RateLimit Redis Client
 *
 * 域：RATELIMIT
 * 用途：API 限流、像素绘制限流
 * 特性：
 * - 使用 Node Redis v4
 * - 高频 ZSET 操作（滑动窗口）
 * - fail-open 策略（限流失败 = 开放访问）
 * - 支持原子操作
 */

import { createClient } from 'redis';
import type { RedisClientType } from 'redis';
import { RedisDomain } from '../types';
import { RATELIMIT_DOMAIN_CONFIG } from '../config/base.config';
import { CacheRedisClient } from './CacheRedisClient';
import logger from '../../utils/logger';

/**
 * 限流结果
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

/**
 * RateLimit 客户端
 *
 * 复用 Cache 客户端的大部分功能，但添加了限流特定的方法
 */
export class RateLimitRedisClient extends CacheRedisClient {
  constructor() {
    // 使用 RATELIMIT 域配置覆盖 Cache 配置
    super();
    // 重新设置域标识
    (this as any).domain = RedisDomain.RATELIMIT;
    // 重新设置域配置
    (this as any).domainConfig = RATELIMIT_DOMAIN_CONFIG;
  }

  /**
   * 滑动窗口限流检查
   *
   * @param key 限流键（通常是 userId 或 IP）
   * @param limit 限制数量
   * @param window 时间窗口（秒）
   * @returns 是否允许请求
   */
  async checkSlidingWindow(
    key: string,
    limit: number,
    window: number
  ): Promise<RateLimitResult> {
    this.recordCommand();

    try {
      const fullKey = this.withPrefix(key);
      const client = this.getRawClient();

      const now = Date.now();
      const windowStart = now - window * 1000;

      // 使用 multi 事务
      const multi = client.multi();

      // 清理窗口外的记录
      multi.zRemRangeByScore(fullKey, 0, windowStart);

      // 添加当前请求
      multi.zAdd(fullKey, { score: now, value: `${now}-${Math.random()}` });

      // 设置过期时间
      multi.expire(fullKey, window);

      // 统计窗口内的请求数
      multi.zCard(fullKey);

      // 执行事务
      const results = await multi.exec();

      if (!results) {
        // 事务失败，采用 fail-open 策略
        logger.warn('[Redis:RateLimit] 事务执行失败，采用 fail-open 策略');
        return {
          allowed: true,
          remaining: limit,
          resetTime: now + window * 1000,
        };
      }

      // Node Redis v4 返回格式: [{ success: true, value: result }, ...]
      const requestCount = (results[3]?.value as number) || 0;
      const remaining = Math.max(0, limit - requestCount);
      const resetTime = now + window * 1000;

      return {
        allowed: requestCount < limit,
        remaining,
        resetTime,
      };
    } catch (error) {
      // 限流检查失败，采用 fail-open 策略
      this.handleError(error as Error, 'checkSlidingWindow');
      return {
        allowed: true,
        remaining: limit,
        resetTime: Date.now() + window * 1000,
      };
    }
  }

  /**
   * 固定窗口限流检查（简化版）
   *
   * @param key 限流键
   * @param limit 限制数量
   * @param window 时间窗口（秒）
   * @returns 是否允许请求
   */
  async checkFixedWindow(
    key: string,
    limit: number,
    window: number
  ): Promise<RateLimitResult> {
    this.recordCommand();

    try {
      const fullKey = this.withPrefix(key);
      const client = this.getRawClient();

      const now = Math.floor(Date.now() / 1000);
      const windowStart = now - window;

      // 使用 Lua 脚本保证原子性
      const luaScript = `
        local key = KEYS[1]
        local now = tonumber(ARGV[1])
        local window = tonumber(ARGV[2])
        local limit = tonumber(ARGV[3])

        -- 清理旧窗口
        redis.call('DEL', key .. ':' .. (now - window))

        local current = redis.call('GET', key .. ':' .. now)
        if current == false then
          current = 0
        else
          current = tonumber(current)
        end

        if current < limit then
          redis.call('INCR', key .. ':' .. now)
          redis.call('EXPIRE', key .. ':' .. now, window)
          return {1, limit - current - 1, now + window}
        else
          return {0, 0, now + window}
        end
      `;

      const result = await client.eval(
        luaScript,
        {
          keys: [fullKey],
          arguments: [now.toString(), window.toString(), limit.toString()],
        }
      ) as [number, number, number];

      const [allowed, remaining, resetTime] = result;

      return {
        allowed: allowed === 1,
        remaining,
        resetTime: resetTime * 1000,
      };
    } catch (error) {
      // 限流检查失败，采用 fail-open 策略
      this.handleError(error as Error, 'checkFixedWindow');
      return {
        allowed: true,
        remaining: limit,
        resetTime: Date.now() + window * 1000,
      };
    }
  }

  /**
   * Token Bucket 限流（令牌桶）
   *
   * @param key 限流键
   * @param capacity 桶容量
   * @param refillRate 填充速率（令牌/秒）
   * @returns 是否允许请求
   */
  async checkTokenBucket(
    key: string,
    capacity: number,
    refillRate: number
  ): Promise<RateLimitResult> {
    this.recordCommand();

    try {
      const fullKey = this.withPrefix(key);
      const client = this.getRawClient();

      const now = Date.now();

      // 使用 Lua 脚本保证原子性
      const luaScript = `
        local key = KEYS[1]
        local now = tonumber(ARGV[1])
        local capacity = tonumber(ARGV[2])
        local refillRate = tonumber(ARGV[3])

        local bucket = redis.call('HMGET', key, 'tokens', 'lastRefill')
        local tokens = tonumber(bucket[1]) or capacity
        local lastRefill = tonumber(bucket[2]) or now

        -- 计算需要添加的令牌数
        local elapsed = (now - lastRefill) / 1000
        local refill = math.floor(elapsed * refillRate)

        if refill > 0 then
          tokens = math.min(capacity, tokens + refill)
          lastRefill = now
        end

        if tokens >= 1 then
          tokens = tokens - 1
          redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', lastRefill)
          redis.call('EXPIRE', key, math.ceil(capacity / refillRate) + 1)
          return {1, tokens, lastRefill}
        else
          redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', lastRefill)
          redis.call('EXPIRE', key, math.ceil(capacity / refillRate) + 1)
          return {0, 0, lastRefill}
        end
      `;

      const result = await client.eval(
        luaScript,
        {
          keys: [fullKey],
          arguments: [now.toString(), capacity.toString(), refillRate.toString()],
        }
      ) as [number, number, number];

      const [allowed, remaining, resetTime] = result;

      return {
        allowed: allowed === 1,
        remaining,
        resetTime,
      };
    } catch (error) {
      // 限流检查失败，采用 fail-open 策略
      this.handleError(error as Error, 'checkTokenBucket');
      return {
        allowed: true,
        remaining: capacity,
        resetTime: Date.now(),
      };
    }
  }

  /**
   * 重置限流计数器
   */
  async reset(key: string): Promise<void> {
    this.recordCommand();

    try {
      const fullKey = this.withPrefix(key);
      await this.getRawClient().del(fullKey);
    } catch (error) {
      this.handleError(error as Error, 'reset');
    }
  }

  /**
   * 计算健康级别（RateLimit 域特定逻辑）
   *
   * RateLimit 采用 fail-open 策略，对健康容忍度较高：
   * - 即使有连续错误，只要连接正常就标记为 HEALTHY
   * - 只有 ERROR/DISCONNECTED 状态才标记为 UNHEALTHY
   * - RECONNECTING 状态仍标记为 DEGRADED（限流可能失效，但不影响主业务）
   */
  protected calculateHealthLevel(): import('../types').HealthLevel {
    const { HealthLevel, ClientStatus } = require('../types');

    switch (this.status) {
      case ClientStatus.CONNECTED:
        // RateLimit fail-open：即使有错误，仍视为健康
        // 因为限流失败 = 开放访问，业务仍可继续
        return HealthLevel.HEALTHY;

      case ClientStatus.RECONNECTING:
        // 限流暂时失效，但业务可继续
        return HealthLevel.DEGRADED;

      case ClientStatus.INITIALIZING:
        return HealthLevel.UNKNOWN;

      case ClientStatus.ERROR:
      case ClientStatus.DISCONNECTED:
        // 彻底失去连接，标记为不健康
        return HealthLevel.UNHEALTHY;

      default:
        return HealthLevel.UNKNOWN;
    }
  }
}

export default RateLimitRedisClient;
