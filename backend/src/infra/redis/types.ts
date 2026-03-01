/**
 * Redis Infrastructure - Type Definitions
 *
 * 定义 Redis 客户端隔离的核心类型
 */

/**
 * Redis 域标识
 * 每个域代表一个独立的工作负载，使用专用的 Redis 客户端
 */
export enum RedisDomain {
  CACHE = 'cache',           // 核心缓存：像素、瓦片、排行榜、Pattern
  QUEUE = 'queue',           // BullMQ 队列：瓦片渲染任务
  PUBSUB = 'pubsub',         // Pub/Sub：WebSocket 实时推送
  RATELIMIT = 'ratelimit',   // 速率限制：API 限流、像素绘制限流
  META = 'meta',             // 元数据：统计、全局计数
  SESSION = 'session',       // 会话：用户状态、心跳
}

/**
 * Redis 部署模式
 */
export enum RedisMode {
  STANDALONE = 'standalone',   // 单机模式
  SENTINEL = 'sentinel',       // 主从 + Sentinel
  CLUSTER = 'cluster',         // Redis Cluster（未来）
}

/**
 * 客户端状态
 */
export enum ClientStatus {
  INITIALIZING = 'initializing',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
}

/**
 * 健康检查结果（增强版）
 */
export interface HealthCheckResult {
  /** 是否健康（综合判断） */
  healthy: boolean;

  /** 客户端状态 */
  status: ClientStatus;

  /** 最后一次错误时间戳 */
  lastErrorTime: number;

  /** 最后一次错误距今时间（ms） */
  lastErrorAge: number;

  /** 连续错误次数 */
  consecutiveErrors: number;

  /** 总错误次数 */
  totalErrors: number;

  /** 总重连次数 */
  totalReconnects: number;

  /** 域健康级别 */
  healthLevel: HealthLevel;
}

/**
 * 域健康级别
 * 不同域对健康的容忍度不同
 */
export enum HealthLevel {
  /** 健康 - 完全可用 */
  HEALTHY = 'healthy',

  /** 降级 - 部分功能可用 */
  DEGRADED = 'degraded',

  /** 不健康 - 不可用 */
  UNHEALTHY = 'unhealthy',

  /** 未知 - 无法判断 */
  UNKNOWN = 'unknown',
}

/**
 * Redis 连接配置
 */
export interface RedisConnectionConfig {
  /** 基础连接参数 */
  host: string;
  port: number;
  password?: string;
  db?: number;

  /** 部署模式 */
  mode: RedisMode;

  /** Sentinel 配置（mode = sentinel 时使用）*/
  sentinel?: {
    enabled: boolean;
    masterName: string;
    hosts: Array<{ host: string; port: number }>;
  };

  /** Socket 配置 */
  socket: {
    connectTimeout: number;      // 连接超时（ms）
    lazyConnect: boolean;        // 延迟连接
    keepAlive: boolean;          // TCP keep-alive
    reconnectStrategy?: (retries: number) => number | Error;  // 重连策略
  };

  /** 重试配置 */
  retries: {
    maxRetriesPerRequest: number; // 每个请求的最大重试次数
  };
}

/**
 * 域特定配置
 * 每个 Domain 有独立的性能和可靠性要求
 */
export interface DomainConfig {
  /** 连接池大小 */
  poolSize: number;

  /** 命名空间前缀 */
  keyPrefix: string;

  /** 默认 TTL（秒）*/
  defaultTTL: number;

  /** 故障策略 */
  failureStrategy: 'fail-open' | 'fail-closed' | 'degrade';

  /** 是否启用指标收集 */
  metricsEnabled: boolean;

  /** 健康检查间隔（ms）*/
  healthCheckInterval: number;
}

/**
 * 客户端接口
 * 所有 Redis 客户端必须实现此接口
 */
export interface IRedisClient {
  /** 域标识 */
  readonly domain: RedisDomain;

  /** 客户端状态 */
  readonly status: ClientStatus;

  /** 初始化客户端 */
  initialize(): Promise<void>;

  /** 关闭客户端 */
  close(): Promise<void>;

  /** 简单健康检查（向后兼容）*/
  healthCheck(): Promise<boolean>;

  /** 详细健康检查（新增）*/
  getDetailedHealth(): HealthCheckResult;

  /** 获取配置 */
  getConfig(): DomainConfig;

  /** 获取原始客户端（用于特殊操作）*/
  getRawClient(): unknown;
}

/**
 * Redis Manager 接口
 */
export interface IRedisManager {
  /** 获取指定域的客户端 */
  getClient(domain: RedisDomain): IRedisClient;

  /** 初始化所有客户端 */
  initialize(): Promise<void>;

  /** 关闭所有客户端 */
  close(): Promise<void>;

  /** 获取所有客户端的健康状态 */
  getHealthStatus(): Record<RedisDomain, boolean>;

  /** 获取所有客户端的指标 */
  getMetrics(): Record<string, number>;
}

/**
 * BullMQ 连接配置（专用）
 */
export interface BullMQConnectionConfig {
  /** Redis 连接配置（使用 ioredis）*/
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
    sentinelEnabled?: boolean;
    sentinelHosts?: string;
    masterName?: string;
  };

  /** 队列配置 */
  queue: {
    connectionOptions: {
      maxRetriesPerRequest: null;  // BullMQ 要求设为 null
      enableReadyCheck: true;
      lazyConnect: false;
    };
  };
}
