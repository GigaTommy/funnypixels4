/**
 * Meta Redis Client
 *
 * 域：META
 * 用途：统计数据、全局计数、配置缓存
 * 特性：
 * - 低频但重要
 * - 持久化（无 TTL）
 * - 失败不影响主业务
 */

import { RedisDomain } from '../types';
import { META_DOMAIN_CONFIG } from '../config/base.config';
import { CacheRedisClient } from './CacheRedisClient';

/**
 * Meta 客户端
 *
 * 复用 Cache 客户端，但使用 META 域配置
 */
export class MetaRedisClient extends CacheRedisClient {
  constructor() {
    super();
    // 覆盖域标识
    (this as any).domain = RedisDomain.META;
    // 覆盖域配置
    (this as any).domainConfig = META_DOMAIN_CONFIG;
  }

  /**
   * 原子递增（用于计数器）
   */
  async incrGlobal(counter: string): Promise<number> {
    return await this.incr(`global:${counter}`);
  }

  /**
   * 原子递增指定值
   */
  async incrByGlobal(counter: string, value: number): Promise<number> {
    return await this.incrby(`global:${counter}`, value);
  }

  /**
   * 获取全局计数器
   */
  async getGlobal(counter: string): Promise<string | null> {
    return await this.get(`global:${counter}`);
  }

  /**
   * 设置统计值
   */
  async setStat(key: string, value: number): Promise<void> {
    await this.set(`stat:${key}`, value.toString());
  }

  /**
   * 获取统计值
   */
  async getStat(key: string): Promise<number> {
    const value = await this.get(`stat:${key}`);
    return value ? parseInt(value, 10) : 0;
  }

  /**
   * 批量获取统计值
   */
  async getStats(keys: string[]): Promise<Record<string, number>> {
    const fullKeys = keys.map((k) => `stat:${k}`);
    const values = await this.mget(fullKeys);

    const result: Record<string, number> = {};
    keys.forEach((key, index) => {
      result[key] = values[index] ? parseInt(values[index]!, 10) : 0;
    });

    return result;
  }

  /**
   * 记录事件（用于分析）
   */
  async recordEvent(event: string, count = 1): Promise<void> {
    await this.incrby(`event:${event}`, count);
  }

  /**
   * 获取事件计数
   */
  async getEventCount(event: string): Promise<number> {
    const value = await this.get(`event:${event}`);
    return value ? parseInt(value, 10) : 0;
  }
}

export default MetaRedisClient;
