/**
 * ============================================================================
 * Pub/Sub Redis Client - 可靠性语义声明
 * ============================================================================
 *
 * 【可靠性保证】
 *
 * ⚠️  IMPORTANT: Redis Pub/Sub 是 BEST-EFFORT 语义，不保证消息投递！
 *
 * ✅ 可以保证的行为：
 *   - 订阅者在线时，消息会尽力投递
 *   - 订阅者断线时，未收到的消息会丢失（不会堆积）
 *   - 订阅者重连后，只能收到重连后的消息
 *   - 发布者无法知道消息是否被订阅者接收
 *
 * ❌ 不能保证的行为：
 *   - 不保证消息一定到达订阅者
 *   - 不保证消息投递顺序
 *   - 不保证至少一次投递（at-least-once）
 *   - 不保证精确一次投递（exactly-once）
 *   - 不保证订阅者存活状态
 *
 * 【适用场景】
 *
 * ✅ 推荐用于：
 *   - 实时通知类场景（瓦片更新、聊天消息推送）
 *   - 非关键数据同步（缓存失效通知）
 *   - 用户在线状态更新
 *   - 日志/监控数据广播
 *
 * ❌ 禁止用于：
 *   - 状态变更通知（如果状态丢失会影响业务）
 *   - 数据落库触发（如果丢失会导致数据不一致）
 *   - 结算/计数类操作（如果丢失会导致金额/统计错误）
 *   - 关键业务流程（如果消息丢失会导致业务失败）
 *
 * 【替代方案建议】
 *
 * 如需可靠消息投递，应考虑：
 *   - BullMQ 队列（支持重试、持久化）
 *   - Kafka / RabbitMQ（支持确认机制）
 *   - 数据库轮询（最可靠但性能较低）
 *
 * 【使用原则】
 *
 * 1. Pub/Sub 仅用于"通知"场景，不用于"数据传输"
 * 2. 订阅者必须处理消息丢失的情况
 * 3. 关键业务逻辑不应依赖 Pub/Sub 消息
 * 4. 如果业务对消息丢失敏感，请使用其他可靠消息机制
 *
 * ============================================================================
 *
 * 域：PUBSUB
 * 连接：Node Redis v4 订阅客户端 + 独立发布客户端
 * 前缀：pubsub:
 * 策略：fail-open（Pub/Sub 失败不影响主业务）
 */

import { createClient } from 'redis';
import type { RedisClientType } from 'redis';
import { RedisDomain } from '../types';
import { PUBSUB_DOMAIN_CONFIG } from '../config/base.config';
import { BaseRedisClient } from './BaseRedisClient';
import logger from '../../utils/logger';

/**
 * 订阅消息回调类型
 */
export type SubscribeCallback = (message: string) => void;

/**
 * Pub/Sub 客户端
 */
export class PubSubRedisClient extends BaseRedisClient {
  // Node Redis v4 客户端（订阅专用）
  private subscriber?: RedisClientType;

  // 发布客户端（可以共享 Cache 客户端，但为了隔离，这里独立）
  private publisher?: RedisClientType;

  // 订阅映射
  private subscriptions: Map<string, Set<SubscribeCallback>> = new Map();

  constructor() {
    super(RedisDomain.PUBSUB, PUBSUB_DOMAIN_CONFIG);
  }

  /**
   * 初始化客户端
   */
  async initialize(): Promise<void> {
    try {
      logger.info('[Redis:PubSub] 正在初始化...');

      // 创建订阅客户端（Node Redis v4）
      this.subscriber = createClient({
        socket: {
          host: this.connectionConfig.host,
          port: this.connectionConfig.port,
          connectTimeout: this.connectionConfig.socket.connectTimeout,
          reconnectStrategy: this.connectionConfig.socket.reconnectStrategy,
        },
        password: this.connectionConfig.password,
        database: this.connectionConfig.db,
      });

      // 创建发布客户端
      this.publisher = createClient({
        socket: {
          host: this.connectionConfig.host,
          port: this.connectionConfig.port,
          connectTimeout: this.connectionConfig.socket.connectTimeout,
          reconnectStrategy: this.connectionConfig.socket.reconnectStrategy,
        },
        password: this.connectionConfig.password,
        database: this.connectionConfig.db,
      });

      // 订阅客户端事件
      this.subscriber.on('connect', () => {
        logger.info('[Redis:PubSub:Subscriber] 已连接');
      });

      this.subscriber.on('error', (err) => {
        logger.error('[Redis:PubSub:Subscriber] 连接错误:', err.message);
        this.recordError();
      });

      this.subscriber.on('reconnecting', () => {
        logger.warn('[Redis:PubSub:Subscriber] 正在重连...');
        this.recordReconnect();
      });

      // 发布客户端事件
      this.publisher.on('connect', () => {
        logger.info('[Redis:PubSub:Publisher] 已连接');
      });

      this.publisher.on('error', (err) => {
        logger.error('[Redis:PubSub:Publisher] 连接错误:', err.message);
        this.recordError();
      });

      // 连接两个客户端
      await Promise.all([this.subscriber.connect(), this.publisher.connect()]);

      // 启动健康检查
      this.startHealthCheck();

      logger.info('[Redis:PubSub] ✅ 初始化完成');
    } catch (error) {
      const err = error as Error;
      logger.error('[Redis:PubSub] ❌ 初始化失败:', err.message);
      throw err;
    }
  }

  /**
   * 关闭客户端
   */
  async close(): Promise<void> {
    try {
      this.stopHealthCheck();

      const closePromises: Promise<void>[] = [];

      if (this.subscriber) {
        closePromises.push(this.subscriber.quit());
      }

      if (this.publisher) {
        closePromises.push(this.publisher.quit());
      }

      await Promise.all(closePromises);

      this.subscriptions.clear();
      logger.info('[Redis:PubSub] 已关闭');
    } catch (error) {
      const err = error as Error;
      logger.error('[Redis:PubSub] 关闭失败:', err.message);
      throw err;
    }
  }

  /**
   * 执行健康检查
   */
  protected async performHealthCheck(): Promise<boolean> {
    try {
      const results = await Promise.all([
        this.subscriber?.ping(),
        this.publisher?.ping(),
      ]);

      return results.every((r) => r === 'PONG');
    } catch {
      return false;
    }
  }

  /**
   * 计算健康级别（PubSub 域特定逻辑）
   *
   * PubSub 是实时推送组件，对健康要求严格：
   * - 任何连续错误（>0）立即标记为 DEGRADED
   * - RECONNECTING 状态标记为 UNHEALTHY（实时推送中断）
   * - 检查订阅者数量（如果没有订阅，可能是异常状态）
   */
  protected calculateHealthLevel(): import('../types').HealthLevel {
    const { HealthLevel, ClientStatus } = require('../types');

    switch (this.status) {
      case ClientStatus.CONNECTED:
        // PubSub 域对任何错误都敏感
        if (this.metrics.consecutive_errors > 0) {
          return HealthLevel.DEGRADED;
        }

        // 如果已连接但没有订阅，可能是配置问题（标记为 DEGRADED）
        if (this.subscriptions.size === 0) {
          // 注意：这不是错误，只是提示可能需要检查配置
          // 但仍然标记为 HEALTHY（连接正常）
        }

        return HealthLevel.HEALTHY;

      case ClientStatus.RECONNECTING:
        // PubSub 重连期间无法推送消息，视为不健康
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
   * 获取原始订阅客户端
   */
  getRawClient(): { subscriber: RedisClientType; publisher: RedisClientType } {
    if (!this.subscriber || !this.publisher) {
      throw new Error('[Redis:PubSub] 客户端未初始化');
    }
    return { subscriber: this.subscriber, publisher: this.publisher };
  }

  /**
   * 发布消息
   */
  async publish(channel: string, message: string): Promise<number> {
    this.recordCommand();

    try {
      if (!this.publisher) {
        throw new Error('[Redis:PubSub] 发布客户端未初始化');
      }

      const fullChannel = this.withPrefix(channel);
      return await this.publisher.publish(fullChannel, message);
    } catch (error) {
      this.handleError(error as Error, 'publish');
      return 0;
    }
  }

  /**
   * 订阅频道
   */
  async subscribe(channel: string, callback: SubscribeCallback): Promise<void> {
    try {
      if (!this.subscriber) {
        throw new Error('[Redis:PubSub] 订阅客户端未初始化');
      }

      const fullChannel = this.withPrefix(channel);

      // 添加回调
      if (!this.subscriptions.has(fullChannel)) {
        this.subscriptions.set(fullChannel, new Set());
        // 订阅 Redis 频道
        await this.subscriber.subscribe(fullChannel, (message) => {
          const callbacks = this.subscriptions.get(fullChannel);
          if (callbacks) {
            for (const cb of callbacks) {
              try {
                cb(message);
              } catch (error) {
                logger.error(`[Redis:PubSub] 消息处理回调失败:`, error);
              }
            }
          }
        });

        logger.info(`[Redis:PubSub] 已订阅频道: ${fullChannel}`);
      }

      this.subscriptions.get(fullChannel)!.add(callback);
    } catch (error) {
      this.handleError(error as Error, 'subscribe');
    }
  }

  /**
   * 取消订阅
   */
  async unsubscribe(channel: string, callback?: SubscribeCallback): Promise<void> {
    try {
      if (!this.subscriber) {
        return;
      }

      const fullChannel = this.withPrefix(channel);
      const callbacks = this.subscriptions.get(fullChannel);

      if (!callbacks) {
        return;
      }

      if (callback) {
        // 移除特定回调
        callbacks.delete(callback);

        // 如果没有回调了，取消订阅
        if (callbacks.size === 0) {
          await this.subscriber.unsubscribe(fullChannel);
          this.subscriptions.delete(fullChannel);
          logger.info(`[Redis:PubSub] 已取消订阅频道: ${fullChannel}`);
        }
      } else {
        // 移除所有回调
        await this.subscriber.unsubscribe(fullChannel);
        this.subscriptions.delete(fullChannel);
        logger.info(`[Redis:PubSub] 已取消订阅频道: ${fullChannel}`);
      }
    } catch (error) {
      this.handleError(error as Error, 'unsubscribe');
    }
  }

  /**
   * 获取订阅的频道列表
   */
  getSubscribedChannels(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * 获取订阅者数量（每个频道的回调数）
   */
  getSubscriberCount(channel: string): number {
    const fullChannel = this.withPrefix(channel);
    return this.subscriptions.get(fullChannel)?.size || 0;
  }
}

export default PubSubRedisClient;
