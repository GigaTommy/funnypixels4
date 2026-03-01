/**
 * Queue Redis Client (BullMQ)
 *
 * 域：QUEUE
 * 用途：BullMQ 瓦片渲染队列
 * 特性：
 * - 使用 ioredis（BullMQ 强制要求）
 * - 高可靠、阻塞风险
 * - 支持 Sentinel
 * - 独立连接池
 */

import Redis from 'ioredis';
import { RedisDomain, ClientStatus, BullMQConnectionConfig } from '../types';
import { QUEUE_DOMAIN_CONFIG } from '../config/base.config';
import { BaseRedisClient } from './BaseRedisClient';
import logger from '../../utils/logger';

/**
 * Queue 客户端（ioredis + BullMQ 专用）
 */
export class QueueRedisClient extends BaseRedisClient {
  // ioredis 客户端
  private client?: Redis;

  constructor() {
    super(RedisDomain.QUEUE, QUEUE_DOMAIN_CONFIG);
  }

  /**
   * 初始化客户端
   */
  async initialize(): Promise<void> {
    try {
      logger.info('[Redis:Queue] 正在初始化 BullMQ Redis 客户端...');

      // 创建 ioredis 客户端（BullMQ 要求）
      this.client = new Redis({
        host: this.connectionConfig.host,
        port: this.connectionConfig.port,
        password: this.connectionConfig.password,
        db: this.connectionConfig.db,

        // BullMQ 特定配置
        maxRetriesPerRequest: null,  // BullMQ 要求设为 null
        enableReadyCheck: true,
        lazyConnect: false,

        // Sentinel 配置
        ...this.createSentinelConfig(),
      });

      // 连接成功事件
      this.client.on('connect', () => {
        logger.info('[Redis:Queue] 已连接');
        this.status = ClientStatus.CONNECTED;
        this.emit('connected');
      });

      // 错误事件
      this.client.on('error', (err) => {
        logger.error('[Redis:Queue] 连接错误:', err.message);
        this.status = ClientStatus.ERROR;
        this.recordError();
      });

      // 重连事件
      this.client.on('reconnecting', () => {
        logger.warn('[Redis:Queue] 正在重连...');
        this.status = ClientStatus.RECONNECTING;
        this.recordReconnect();
      });

      // 等待连接就绪
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('连接超时'));
        }, 10000);

        this.client!.once('ready', () => {
          clearTimeout(timeout);
          resolve();
        });

        this.client!.once('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      // 启动健康检查
      this.startHealthCheck();

      logger.info('[Redis:Queue] ✅ 初始化完成');
    } catch (error) {
      const err = error as Error;
      logger.error('[Redis:Queue] ❌ 初始化失败:', err.message);
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
        logger.info('[Redis:Queue] 已关闭');
      }

      this.status = ClientStatus.DISCONNECTED;
    } catch (error) {
      const err = error as Error;
      logger.error('[Redis:Queue] 关闭失败:', err.message);
      throw err;
    }
  }

  /**
   * 执行健康检查
   */
  protected async performHealthCheck(): Promise<boolean> {
    if (!this.client || this.client.status !== 'ready') {
      return false;
    }

    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * 计算健康级别（Queue 域特定逻辑）
   *
   * Queue（BullMQ）是关键异步任务组件，对健康要求更严格：
   * - 任何连续错误（>0）立即标记为 DEGRADED
   * - RECONNECTING 状态直接标记为 UNHEALTHY（队列不可用）
   * - ERROR / DISCONNECTED 状态标记为 UNHEALTHY
   */
  protected calculateHealthLevel(): import('../types').HealthLevel {
    const { HealthLevel } = require('../types');

    switch (this.status) {
      case ClientStatus.CONNECTED:
        // Queue 域对任何错误都敏感
        if (this.metrics.consecutive_errors > 0) {
          return HealthLevel.DEGRADED;
        }
        return HealthLevel.HEALTHY;

      case ClientStatus.RECONNECTING:
        // Queue 重连期间无法处理任务，视为不健康
        return HealthLevel.UNHEALTHY;

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
   * 获取原始 ioredis 客户端
   */
  getRawClient(): Redis {
    if (!this.client) {
      throw new Error('[Redis:Queue] 客户端未初始化');
    }
    return this.client;
  }

  /**
   * 获取 BullMQ 连接配置
   *
   * 用于初始化 BullMQ Queue 和 Worker
   */
  getBullMQConfig(): BullMQConnectionConfig {
    return {
      redis: {
        host: this.connectionConfig.host,
        port: this.connectionConfig.port,
        password: this.connectionConfig.password,
        db: this.connectionConfig.db,
        sentinelEnabled: this.connectionConfig.mode === 'sentinel',
        sentinelHosts: this.connectionConfig.sentinel
          ? this.connectionConfig.sentinel.hosts.map((h) => `${h.host}:${h.port}`).join(',')
          : undefined,
        masterName: this.connectionConfig.sentinel?.masterName,
      },
      queue: {
        connectionOptions: {
          maxRetriesPerRequest: null,
          enableReadyCheck: true,
          lazyConnect: false,
        },
      },
    };
  }

  /**
   * 获取 BullMQ 连接对象
   *
   * 直接返回 ioredis 实例，用于 BullMQ Queue/Worker
   */
  getBullMQConnection(): Redis {
    return this.getRawClient();
  }
}

export default QueueRedisClient;
