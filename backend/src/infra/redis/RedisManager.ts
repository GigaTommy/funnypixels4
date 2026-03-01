/**
 * Redis Manager - 统一入口
 *
 * 职责：
 * 1. 管理 Redis 客户端生命周期（初始化、关闭、重连）
 * 2. 提供 Domain -> Client 映射（注册表模式）
 * 3. 聚合健康检查和指标
 * 4. 协调优雅关闭
 *
 * 使用示例：
 * ```typescript
 * // 初始化（应用启动时）
 * await RedisManager.initialize();
 *
 * // 获取客户端（业务代码中）
 * const cacheClient = RedisManager.getClient(RedisDomain.CACHE);
 * await cacheClient.set('key', 'value');
 *
 * // 优雅关闭（应用关闭时）
 * await RedisManager.close();
 * ```
 */

import { RedisDomain, IRedisManager, IRedisClient, ClientStatus } from './types';
import { CacheRedisClient } from './clients/CacheRedisClient';
import { QueueRedisClient } from './clients/QueueRedisClient';
import { PubSubRedisClient } from './clients/PubSubRedisClient';
import { RateLimitRedisClient } from './clients/RateLimitRedisClient';
import { MetaRedisClient } from './clients/MetaRedisClient';
import { SessionRedisClient } from './clients/SessionRedisClient';

import logger from '../../utils/logger';

/**
 * Redis Manager - 单例模式
 */
class RedisManager implements IRedisManager {
  // 单例实例
  private static instance: RedisManager;

  // 客户端注册表
  private clients: Map<RedisDomain, IRedisClient> = new Map();

  // 初始化状态
  private initialized = false;

  // 关闭状态
  private closing = false;

  /**
   * 私有构造函数（单例模式）
   */
  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): RedisManager {
    if (!RedisManager.instance) {
      RedisManager.instance = new RedisManager();
    }
    return RedisManager.instance;
  }

  /**
   * 初始化所有 Redis 客户端
   *
   * 按优先级顺序初始化：
   * 1. Meta（低依赖，先初始化）
   * 2. Session（用户依赖）
   * 3. Cache、RateLimit（核心功能）
   * 4. PubSub（WebSocket）
   * 5. Queue（异步任务，最后初始化）
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('[RedisManager] 已经初始化，跳过重复初始化');
      return;
    }

    if (this.closing) {
      throw new Error('[RedisManager] 正在关闭，无法初始化');
    }

    logger.info('[RedisManager] 开始初始化 Redis 客户端...');

    const initOrder: RedisDomain[] = [
      RedisDomain.META,
      RedisDomain.SESSION,
      RedisDomain.CACHE,
      RedisDomain.RATELIMIT,
      RedisDomain.PUBSUB,
      RedisDomain.QUEUE,
    ];

    const errors: Array<{ domain: RedisDomain; error: Error }> = [];

    for (const domain of initOrder) {
      try {
        const client = this.createClient(domain);
        await client.initialize();
        this.clients.set(domain, client);
        logger.info(`[RedisManager] ✅ ${domain} 客户端初始化成功`);
      } catch (error) {
        const err = error as Error;
        logger.error(`[RedisManager] ❌ ${domain} 客户端初始化失败:`, err.message);
        errors.push({ domain, error: err });

        // 根据域的重要性决定是否继续
        if (domain === RedisDomain.CACHE || domain === RedisDomain.SESSION) {
          // Cache 和 Session 是核心，失败则终止
          throw new Error(`[RedisManager] 核心 ${domain} 初始化失败，无法启动`);
        }
        // 其他域失败，记录错误但继续初始化
      }
    }

    this.initialized = true;

    if (errors.length > 0) {
      logger.warn(`[RedisManager] ${errors.length} 个客户端初始化失败，但应用可以继续运行`, {
        failed: errors.map(e => e.domain),
      });
    } else {
      logger.info('[RedisManager] 🎉 所有 Redis 客户端初始化完成');
    }
  }

  /**
   * 创建指定域的客户端
   */
  private createClient(domain: RedisDomain): IRedisClient {
    switch (domain) {
      case RedisDomain.CACHE:
        return new CacheRedisClient();
      case RedisDomain.QUEUE:
        return new QueueRedisClient();
      case RedisDomain.PUBSUB:
        return new PubSubRedisClient();
      case RedisDomain.RATELIMIT:
        return new RateLimitRedisClient();
      case RedisDomain.META:
        return new MetaRedisClient();
      case RedisDomain.SESSION:
        return new SessionRedisClient();
      default:
        throw new Error(`[RedisManager] 未知域: ${domain}`);
    }
  }

  /**
   * 获取指定域的客户端
   *
   * @param domain - Redis 域标识
   * @returns Redis 客户端实例
   * @throws 如果客户端未初始化
   */
  getClient(domain: RedisDomain): IRedisClient {
    const client = this.clients.get(domain);

    if (!client) {
      throw new Error(
        `[RedisManager] ${domain} 客户端未初始化。` +
        `请确保在调用 getClient() 之前已调用 initialize()`
      );
    }

    return client;
  }

  /**
   * 便捷方法：获取 Cache 客户端
   */
  static getCache(): CacheRedisClient {
    return RedisManager.getInstance().getClient(RedisDomain.CACHE) as CacheRedisClient;
  }

  /**
   * 便捷方法：获取 Queue 客户端（BullMQ）
   */
  static getQueue(): QueueRedisClient {
    return RedisManager.getInstance().getClient(RedisDomain.QUEUE) as QueueRedisClient;
  }

  /**
   * 便捷方法：获取 PubSub 客户端
   */
  static getPubSub(): PubSubRedisClient {
    return RedisManager.getInstance().getClient(RedisDomain.PUBSUB) as PubSubRedisClient;
  }

  /**
   * 便捷方法：获取 RateLimit 客户端
   */
  static getRateLimit(): RateLimitRedisClient {
    return RedisManager.getInstance().getClient(RedisDomain.RATELIMIT) as RateLimitRedisClient;
  }

  /**
   * 便捷方法：获取 Session 客户端
   */
  static getSession(): SessionRedisClient {
    return RedisManager.getInstance().getClient(RedisDomain.SESSION) as SessionRedisClient;
  }

  /**
   * 便捷方法：获取 Meta 客户端
   */
  static getMeta(): MetaRedisClient {
    return RedisManager.getInstance().getClient(RedisDomain.META) as MetaRedisClient;
  }

  /**
   * 获取所有客户端的健康状态
   */
  getHealthStatus(): Record<RedisDomain, boolean> {
    const status: Record<string, boolean> = {};

    for (const [domain, client] of this.clients.entries()) {
      status[domain] = client.status === ClientStatus.CONNECTED;
    }

    return status as Record<RedisDomain, boolean>;
  }

  /**
   * 获取所有客户端的详细健康状态（新增）
   */
  getDetailedHealthStatus(): Record<RedisDomain, any> {
    const status: Record<string, any> = {};

    for (const [domain, client] of this.clients.entries()) {
      // 使用子类的 getDetailedHealth 方法
      status[domain] = (client as any).getDetailedHealth?.() || {
        healthy: false,
        status: client.status,
        healthLevel: 'unknown',
      };
    }

    return status as Record<RedisDomain, any>;
  }

  /**
   * 获取所有客户端的指标
   */
  getMetrics(): Record<string, number> {
    const metrics: Record<string, number> = {
      // 全局指标
      total_clients: this.clients.size,
      connected_clients: 0,
    };

    for (const [domain, client] of this.clients.entries()) {
      // 累计连接数
      if (client.status === ClientStatus.CONNECTED) {
        metrics.connected_clients++;
      }

      // 各域特定指标（由客户端实现）
      const clientMetrics = (client as any).getMetrics?.() || {};
      Object.assign(metrics, clientMetrics);
    }

    return metrics;
  }

  /**
   * 优雅关闭所有客户端
   *
   * 按相反顺序关闭：
   * 1. Queue（停止接收新任务）
   * 2. PubSub（断开订阅）
   * 3. Cache、RateLimit
   * 4. Session
   * 5. Meta
   */
  async close(): Promise<void> {
    if (this.closing) {
      logger.warn('[RedisManager] 正在关闭，跳过重复关闭');
      return;
    }

    this.closing = true;
    logger.info('[RedisManager] 开始优雅关闭所有 Redis 客户端...');

    const closeOrder: RedisDomain[] = [
      RedisDomain.QUEUE,
      RedisDomain.PUBSUB,
      RedisDomain.RATELIMIT,
      RedisDomain.CACHE,
      RedisDomain.SESSION,
      RedisDomain.META,
    ];

    for (const domain of closeOrder) {
      const client = this.clients.get(domain);
      if (client) {
        try {
          await client.close();
          logger.info(`[RedisManager] ✅ ${domain} 客户端已关闭`);
        } catch (error) {
          const err = error as Error;
          logger.error(`[RedisManager] ❌ ${domain} 客户端关闭失败:`, err.message);
        }
      }
    }

    this.clients.clear();
    this.initialized = false;
    this.closing = false;

    logger.info('[RedisManager] 🎉 所有 Redis 客户端已关闭');
  }
}

/**
 * 导出单例实例
 */
export default RedisManager.getInstance();

/**
 * 同时导出类（用于类型引用）
 */
export { RedisManager };
