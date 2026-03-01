/**
 * Redis 域配置
 *
 * 每个 Domain 的特定配置，包括：
 * - 连接池大小
 * - Key 前缀（命名空间隔离）
 * - 默认 TTL
 * - 故障策略
 * - 健康检查间隔
 */

import { DomainConfig } from '../types';

/**
 * Cache 域配置
 *
 * 用途：像素缓存、瓦片缓存、排行榜、Pattern 缓存
 * 特性：高并发、短 TTL、可降级到数据库
 */
export const CACHE_DOMAIN_CONFIG: DomainConfig = {
  poolSize: 10,                  // 较大连接池，支持高并发
  keyPrefix: 'cache:',           // 命名空间前缀
  defaultTTL: 3600,              // 默认 1 小时
  failureStrategy: 'degrade',    // 失败时降级到数据库
  metricsEnabled: true,
  healthCheckInterval: 30000,    // 30 秒健康检查
};

/**
 * Queue 域配置
 *
 * 用途：BullMQ 瓦片渲染队列
 * 特性：高可靠、阻塞风险、ioredis 强绑定
 */
export const QUEUE_DOMAIN_CONFIG: DomainConfig = {
  poolSize: 2,                   // BullMQ 不需要大连接池
  keyPrefix: 'queue:',           // BullMQ 管理自己的 key 前缀
  defaultTTL: 0,                 // 队列任务持久化，无 TTL
  failureStrategy: 'fail-closed', // 队列失败必须报错
  metricsEnabled: true,
  healthCheckInterval: 60000,    // 60 秒健康检查
};

/**
 * Pub/Sub 域配置
 *
 * 用途：WebSocket 实时推送
 * 特性：长连接、订阅模式、断线重连
 */
export const PUBSUB_DOMAIN_CONFIG: DomainConfig = {
  poolSize: 1,                   // 订阅客户端只需要一个连接
  keyPrefix: 'pubsub:',          // Pub/Sub 使用 channel，不使用 key 前缀
  defaultTTL: 0,                 // Pub/Sub 消息不持久化
  failureStrategy: 'fail-open',  // Pub/Sub 失败不影响主业务
  metricsEnabled: true,
  healthCheckInterval: 30000,    // 30 秒健康检查
};

/**
 * RateLimit 域配置
 *
 * 用途：API 限流、像素绘制限流
 * 特性：高频 ZSET 操作、fail-open 策略
 */
export const RATELIMIT_DOMAIN_CONFIG: DomainConfig = {
  poolSize: 5,                   // 中等连接池
  keyPrefix: 'ratelimit:',       // 限流计数器前缀
  defaultTTL: 0,                 // 动态 TTL（滑动窗口）
  failureStrategy: 'fail-open',  // 限流失败 = 开放访问（避免误杀）
  metricsEnabled: true,
  healthCheckInterval: 30000,    // 30 秒健康检查
};

/**
 * Meta 域配置
 *
 * 用途：统计数据、全局计数
 * 特性：低频但重要、持久化
 */
export const META_DOMAIN_CONFIG: DomainConfig = {
  poolSize: 2,                   // 小连接池
  keyPrefix: 'meta:',            // 元数据前缀
  defaultTTL: 0,                 // 持久化，无 TTL
  failureStrategy: 'fail-open',  // 统计失败不影响主业务
  metricsEnabled: true,
  healthCheckInterval: 60000,    // 60 秒健康检查
};

/**
 * Session 域配置
 *
 * 用途：用户会话、心跳
 * 特性：中等频率、可降级到内存
 */
export const SESSION_DOMAIN_CONFIG: DomainConfig = {
  poolSize: 3,                   // 中等连接池
  keyPrefix: 'session:',         // 会话前缀
  defaultTTL: 3600,              // 默认 1 小时
  failureStrategy: 'degrade',    // 可降级到内存存储
  metricsEnabled: true,
  healthCheckInterval: 30000,    // 30 秒健康检查
};
