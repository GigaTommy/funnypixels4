/**
 * Pixel Cache Service - 像素缓存业务语义层
 *
 * 【职责】
 * - 封装像素数据的缓存逻辑
 * - 负责 Key 命名（pixel:）
 * - 负责 JSON 序列化/反序列化
 * - 组合 CacheRedisClient，不继承
 *
 * 【使用示例】
 * ```typescript
 * const pixelCache = new PixelCacheService();
 * await pixelCache.set('123', { color: 'red', userId: '456' });
 * const pixel = await pixelCache.get('123');
 * ```
 */

import RedisManager from '../RedisManager';
import type { CacheRedisClient } from './CacheRedisClient';

/**
 * 像素数据接口
 */
export interface PixelData {
  id: string;
  color: string;
  userId: string;
  username?: string;
  timestamp: number;
}

/**
 * 像素缓存服务
 */
export class PixelCacheService {
  private cache: CacheRedisClient;

  constructor() {
    this.cache = RedisManager.getCache();
  }

  /**
   * Key 命名: pixel:{pixelId}
   */
  private makeKey(pixelId: string): string {
    return `pixel:${pixelId}`;
  }

  /**
   * 设置像素缓存
   */
  async set(pixelId: string, data: PixelData, ttl = 3600): Promise<void> {
    const value = JSON.stringify(data);
    await this.cache.set(this.makeKey(pixelId), value, ttl);
  }

  /**
   * 获取像素缓存
   */
  async get(pixelId: string): Promise<PixelData | null> {
    const value = await this.cache.get(this.makeKey(pixelId));
    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as PixelData;
    } catch {
      return null;
    }
  }

  /**
   * 批量获取像素缓存
   */
  async mget(pixelIds: string[]): Promise<Map<string, PixelData>> {
    const keys = pixelIds.map((id) => this.makeKey(id));
    const values = await this.cache.mget(keys);

    const result = new Map<string, PixelData>();

    for (let i = 0; i < pixelIds.length; i++) {
      const pixelId = pixelIds[i];
      const value = values[i];

      if (value) {
        try {
          result.set(pixelId, JSON.parse(value) as PixelData);
        } catch {
          // 解析失败，跳过
        }
      }
    }

    return result;
  }

  /**
   * 删除像素缓存
   */
  async del(pixelId: string): Promise<void> {
    await this.cache.del(this.makeKey(pixelId));
  }

  /**
   * 批量删除像素缓存
   */
  async delMultiple(pixelIds: string[]): Promise<void> {
    for (const id of pixelIds) {
      await this.del(id);
    }
  }

  /**
   * 检查像素缓存是否存在
   */
  async exists(pixelId: string): Promise<boolean> {
    return await this.cache.exists(this.makeKey(pixelId));
  }
}

export default PixelCacheService;
