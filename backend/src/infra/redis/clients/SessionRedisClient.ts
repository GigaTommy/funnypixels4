/**
 * Session Redis Client
 *
 * 域：SESSION
 * 用途：用户会话、心跳、绘图状态
 * 特性：
 * - 中等频率
 * - 可降级到内存存储
 * - 固定 TTL（会话超时）
 */

import { RedisDomain } from '../types';
import { SESSION_DOMAIN_CONFIG } from '../config/base.config';
import { CacheRedisClient } from './CacheRedisClient';

/**
 * 会话数据接口
 */
export interface SessionData {
  userId: string;
  username?: string;
  lastActivity: number;
  pixelPoints?: number;
  metadata?: Record<string, any>;
}

/**
 * Session 客户端
 */
export class SessionRedisClient extends CacheRedisClient {
  // 内存降级缓存
  private memoryFallback: Map<string, SessionData> = new Map();

  constructor() {
    super();
    // 覆盖域标识
    (this as any).domain = RedisDomain.SESSION;
    // 覆盖域配置
    (this as any).domainConfig = SESSION_DOMAIN_CONFIG;
  }

  /**
   * 设置会话
   */
  async setSession(
    sessionId: string,
    data: SessionData,
    ttl?: number
  ): Promise<void> {
    const value = JSON.stringify(data);
    await this.set(sessionId, value, ttl);

    // 同步到内存缓存
    this.memoryFallback.set(sessionId, data);
  }

  /**
   * 获取会话
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    try {
      const value = await this.get(sessionId);
      if (value) {
        const data = JSON.parse(value) as SessionData;
        this.memoryFallback.set(sessionId, data);
        return data;
      }
    } catch (error) {
      // Redis 失败，尝试从内存缓存获取
      (this as any).handleError(error as Error, 'getSession');
    }

    // 降级到内存缓存
    return this.memoryFallback.get(sessionId) || null;
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionId: string): Promise<void> {
    await this.del(sessionId);
    this.memoryFallback.delete(sessionId);
  }

  /**
   * 更新会话心跳
   */
  async heartbeat(sessionId: string, ttl?: number): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      session.lastActivity = Date.now();
      await this.setSession(sessionId, session, ttl);
    }
  }

  /**
   * 检查会话是否活跃
   */
  async isSessionActive(sessionId: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return false;
    }

    // 检查是否超时（默认 1 小时）
    const timeout = 3600 * 1000;
    const now = Date.now();
    return now - session.lastActivity < timeout;
  }

  /**
   * 获取活跃会话列表（从内存缓存）
   */
  getActiveSessions(): string[] {
    const now = Date.now();
    const timeout = 3600 * 1000;

    return Array.from(this.memoryFallback.keys()).filter((sessionId) => {
      const session = this.memoryFallback.get(sessionId);
      return session && now - session.lastActivity < timeout;
    });
  }

  /**
   * 清理过期会话（内存缓存）
   */
  cleanupExpiredSessions(): void {
    const now = Date.now();
    const timeout = 3600 * 1000;

    for (const [sessionId, session] of this.memoryFallback.entries()) {
      if (now - session.lastActivity >= timeout) {
        this.memoryFallback.delete(sessionId);
      }
    }
  }

  /**
   * 获取内存缓存大小
   */
  getMemoryCacheSize(): number {
    return this.memoryFallback.size;
  }

  /**
   * 清空内存缓存
   */
  clearMemoryCache(): void {
    this.memoryFallback.clear();
  }
}

export default SessionRedisClient;
