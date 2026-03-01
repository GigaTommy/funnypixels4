/**
 * ============================================================================
 * Base Redis Client - 抽象基类边界声明
 * ============================================================================
 *
 * 【设计目的】
 *
 * 本类是所有 Redis 客户端的基础抽象，用于定义通用行为和生命周期管理。
 * 核心目标：提供一致的客户端接口，避免子类重复实现基础功能。
 *
 * 【明确允许的职责】
 *
 * ✅ 连接生命周期管理（初始化、关闭、重连）
 * ✅ 事件监听（connect、error、reconnecting）
 * ✅ 基础配置读取（环境变量、Sentinel 配置）
 * ✅ 健康检查调度（定时器管理）
 * ✅ 通用指标收集（commands、errors、reconnects）
 * ✅ Key 前缀管理（统一 namespace）
 * ✅ 通用错误处理框架（根据 failureStrategy 分发）
 *
 * 【严格禁止的职责】
 *
 * ❌ 禁止业务 Key 拼装逻辑（如 pixel:123、tile:14/123/456）
 *     → 应由各 Domain Client 或 Service 层负责
 *
 * ❌ 禁止自动降级策略实现（如 fallback 到数据库）
 *     → 降级应通过 emit('degrade') 事件通知外层处理
 *     → 本类只负责触发事件，不实现具体降级逻辑
 *
 * ❌ 禁止多 Redis 路由 / 读写分离逻辑
 *     → 路由应由 RedisManager 或专用层负责
 *     → 读写分离应由配置驱动，不应在此实现逻辑
 *
 * ❌ 禁止新增复杂抽象（Strategy、Factory、Router 等）
 *     → 保持简单抽象，避免过度设计
 *
 * ❌ 禁止随业务增长膨胀代码量
 *     → 新增功能应优先考虑子类扩展，而非修改基类
 *     → 基类应保持稳定，避免频繁修改
 *
 * 【代码稳定性承诺】
 *
 * - 本类代码量应保持稳定（约 270-300 行）
 * - 新增 Redis 客户端类型时，优先考虑是否可通过现有机制实现
 * - 如需修改基类，必须评估对所有子类的影响
 * - 本类不应成为"万能 Redis 基类"
 *
 * 【子类扩展指南】
 *
 * 子类应通过以下方式扩展功能：
 * 1. 实现 initialize() / close() - 定义连接逻辑
 * 2. 实现 performHealthCheck() - 定义健康检查逻辑
 * 3. 添加域特定方法 - 如 PubSub 的 subscribe()、RateLimit 的 checkSlidingWindow()
 * 4. 覆盖通用方法时需谨慎 - 避免破坏基类契约
 *
 * ============================================================================
 */

import {
  IRedisClient,
  RedisDomain,
  ClientStatus,
  RedisConnectionConfig,
  RedisMode,
  DomainConfig,
  HealthCheckResult,
  HealthLevel,
} from '../types';
import logger from '../../utils/logger';
import { EventEmitter } from 'events';

/**
 * 基础配置（从环境变量读取）
 */
const getBaseConnectionConfig = (): RedisConnectionConfig => {
  const mode =
    (process.env.REDIS_SENTINEL_ENABLED === 'true' ? 'sentinel' : 'standalone') as RedisMode;

  const config: RedisConnectionConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    mode,

    // Sentinel 配置
    sentinel:
      mode === 'sentinel'
        ? {
            enabled: true,
            masterName: process.env.REDIS_SENTINEL_MASTER_NAME || 'mymaster',
            hosts: (process.env.REDIS_SENTINEL_HOSTS || 'localhost:26379')
              .split(',')
              .map((h) => {
                const [host, port] = h.split(':');
                return { host, port: parseInt(port || '26379') };
              }),
          }
        : undefined,

    // Socket 配置
    socket: {
      connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '10000'),
      lazyConnect: false,
      keepAlive: true,
      reconnectStrategy: (retries: number) => {
        if (retries > 10) {
          logger.error(`[Redis] 重连次数超过限制 (${retries})`);
          return new Error('重连次数超过限制');
        }
        // 指数退避：100ms, 200ms, 400ms, ..., 最大 3s
        return Math.min(retries * 100, 3000);
      },
    },

    // 重试配置
    retries: {
      maxRetriesPerRequest: 3,
    },
  };

  return config;
};

/**
 * 抽象基类
 */
export abstract class BaseRedisClient extends EventEmitter implements IRedisClient {
  // 域标识
  public readonly domain: RedisDomain;

  // 客户端状态
  public status: ClientStatus = ClientStatus.INITIALIZING;

  // 连接配置
  protected connectionConfig: RedisConnectionConfig;

  // 域配置
  protected domainConfig: DomainConfig;

  // 原始客户端（子类必须设置）
  protected _rawClient: unknown = null;

  // 健康检查定时器
  private healthCheckTimer?: NodeJS.Timeout;

  // 指标
  protected metrics: Record<string, number> = {
    commands_total: 0,
    errors_total: 0,
    reconnects_total: 0,
    last_error_time: 0,
    consecutive_errors: 0,  // 连续错误次数（新增）
  };

  // 健康级别缓存
  private cachedHealthLevel: HealthLevel = HealthLevel.UNKNOWN;

  /**
   * 构造函数
   */
  constructor(domain: RedisDomain, domainConfig: DomainConfig) {
    super();
    this.domain = domain;
    this.domainConfig = domainConfig;
    this.connectionConfig = getBaseConnectionConfig();
  }

  /**
   * 初始化客户端（子类必须实现）
   */
  abstract initialize(): Promise<void>;

  /**
   * 关闭客户端（子类必须实现）
   */
  abstract close(): Promise<void>;

  /**
   * 健康检查（简单版）
   */
  async healthCheck(): Promise<boolean> {
    try {
      // 子类实现具体的健康检查逻辑
      const result = await this.performHealthCheck();
      this.status = result ? ClientStatus.CONNECTED : ClientStatus.ERROR;
      return result;
    } catch (error) {
      this.status = ClientStatus.ERROR;
      this.recordError();
      return false;
    }
  }

  /**
   * 详细健康检查（增强版）
   */
  getDetailedHealth(): HealthCheckResult {
    const now = Date.now();
    const lastErrorAge = this.metrics.last_error_time > 0
      ? now - this.metrics.last_error_time
      : 0;

    const result: HealthCheckResult = {
      healthy: this.status === ClientStatus.CONNECTED,
      status: this.status,
      lastErrorTime: this.metrics.last_error_time,
      lastErrorAge,
      consecutiveErrors: this.metrics.consecutive_errors,
      totalErrors: this.metrics.errors_total,
      totalReconnects: this.metrics.reconnects_total,
      healthLevel: this.calculateHealthLevel(),
    };

    return result;
  }

  /**
   * 执行健康检查（子类可选实现）
   */
  protected async performHealthCheck(): Promise<boolean> {
    // 默认实现：子类可以覆盖
    return true;
  }

  /**
   * 计算健康级别（子类可覆盖）
   *
   * 默认逻辑：
   * - CONNECTED → HEALTHY
   * - RECONNECTING → DEGRADED（正在恢复）
   * - ERROR / DISCONNECTED → UNHEALTHY
   * - 连续错误 > 5 → DEGRADED
   */
  protected calculateHealthLevel(): HealthLevel {
    switch (this.status) {
      case ClientStatus.CONNECTED:
        // 如果有连续错误，降级为 DEGRADED
        if (this.metrics.consecutive_errors > 5) {
          return HealthLevel.DEGRADED;
        }
        return HealthLevel.HEALTHY;

      case ClientStatus.RECONNECTING:
        return HealthLevel.DEGRADED;

      case ClientStatus.INITIALIZING:
        return HealthLevel.UNKNOWN;

      case ClientStatus.ERROR:
      case ClientStatus.DISCONNECTED:
        return HealthLevel.UNHEALTHY;

      default:
        return HealthLevel.UNKNOWN;
    }
  }

  /**
   * 更新健康级别缓存
   */
  private updateHealthLevel(): void {
    this.cachedHealthLevel = this.calculateHealthLevel();
  }

  /**
   * 获取域配置
   */
  getConfig(): DomainConfig {
    return { ...this.domainConfig };
  }

  /**
   * 获取原始客户端
   */
  getRawClient(): unknown {
    return this._rawClient;
  }

  /**
   * 获取指标
   */
  getMetrics(): Record<string, number> {
    return { ...this.metrics };
  }

  /**
   * 启动健康检查
   */
  protected startHealthCheck(): void {
    if (this.healthCheckTimer) {
      return; // 已启动
    }

    this.healthCheckTimer = setInterval(async () => {
      await this.healthCheck();
    }, this.domainConfig.healthCheckInterval);
  }

  /**
   * 停止健康检查
   */
  protected stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }

  /**
   * 记录命令执行
   */
  protected recordCommand(): void {
    this.metrics.commands_total++;
  }

  /**
   * 记录错误
   */
  protected recordError(): void {
    this.metrics.errors_total++;
    this.metrics.last_error_time = Date.now();
    this.metrics.consecutive_errors++;

    // 连续错误会影响健康级别
    this.updateHealthLevel();
  }

  /**
   * 记录重连
   */
  protected recordReconnect(): void {
    this.metrics.reconnects_total++;

    // 重连成功，重置连续错误计数
    this.metrics.consecutive_errors = 0;
    this.updateHealthLevel();
  }

  /**
   * 应用 Key 前缀
   */
  protected withPrefix(key: string): string {
    return `${this.domainConfig.keyPrefix}${key}`;
  }

  /**
   * 批量应用 Key 前缀
   */
  protected withPrefixBatch(keys: string[]): string[] {
    return keys.map((k) => this.withPrefix(k));
  }

  /**
   * 处理错误（根据故障策略）
   */
  protected handleError(error: Error, operation: string): void {
    this.recordError();

    const prefix = `[Redis:${this.domain}]`;

    switch (this.domainConfig.failureStrategy) {
      case 'fail-open':
        // 失败开放：记录错误但不抛出异常
        logger.warn(`${prefix} ${operation} 失败（fail-open）:`, error.message);
        break;

      case 'fail-closed':
        // 失败关闭：记录错误并抛出异常
        logger.error(`${prefix} ${operation} 失败（fail-closed）:`, error.message);
        throw error;

      case 'degrade':
        // 降级：记录警告，尝试降级策略
        logger.warn(`${prefix} ${operation} 失败，启用降级策略:`, error.message);
        this.emit('degrade', { error, operation });
        break;
    }
  }

  /**
   * 创建 Sentinel 连接配置（用于 ioredis）
   */
  protected createSentinelConfig() {
    if (
      this.connectionConfig.mode !== 'sentinel' ||
      !this.connectionConfig.sentinel
    ) {
      return undefined;
    }

    return {
      sentinels: this.connectionConfig.sentinel.hosts,
      name: this.connectionConfig.sentinel.masterName,
    };
  }
}

export default BaseRedisClient;
