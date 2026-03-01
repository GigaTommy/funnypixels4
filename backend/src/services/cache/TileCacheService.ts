/**
 * Tile Cache Service - 瓦片缓存业务语义层
 *
 * 【职责】
 * - 封装 MVT 瓦片的缓存逻辑
 * - 负责 Key 命名（tile:）
 * - 负责 Buffer 序列化/反序列化
 * - 组合 CacheRedisClient，不继承
 */

import RedisManager from '../RedisManager';
import type { CacheRedisClient } from './CacheRedisClient';

/**
 * 瓦片数据接口
 */
export interface TileData {
  tileId: string;  // 格式: "z/x/y"
  buffer: Buffer;
  mimeType: string;
  compressed: boolean;
  version: number;
}

/**
 * 瓦片元数据接口
 */
export interface TileMetadata {
  tileId: string;
  version: number;
  lastModified: number;
  pixelCount: number;
}

/**
 * 瓦片缓存服务
 */
export class TileCacheService {
  private cache: CacheRedisClient;

  constructor() {
    this.cache = RedisManager.getCache();
  }

  /**
   * Key 命名
   * - tile:data:{z}/{x}/{y}  - 瓦片数据
   * - tile:meta:{z}/{x}/{y}  - 瓦片元数据
   */
  private makeDataKey(tileId: string): string {
    return `tile:data:${tileId}`;
  }

  private makeMetaKey(tileId: string): string {
    return `tile:meta:${tileId}`;
  }

  /**
   * 设置瓦片数据
   */
  async setData(tileId: string, data: TileData, ttl = 3600): Promise<void> {
    const value = JSON.stringify({
      buffer: data.buffer.toString('base64'),
      mimeType: data.mimeType,
      compressed: data.compressed,
      version: data.version,
    });

    await this.cache.set(this.makeDataKey(tileId), value, ttl);
  }

  /**
   * 获取瓦片数据
   */
  async getData(tileId: string): Promise<TileData | null> {
    const value = await this.cache.get(this.makeDataKey(tileId));
    if (!value) {
      return null;
    }

    try {
      const parsed = JSON.parse(value);
      return {
        tileId,
        buffer: Buffer.from(parsed.buffer, 'base64'),
        mimeType: parsed.mimeType,
        compressed: parsed.compressed,
        version: parsed.version,
      };
    } catch {
      return null;
    }
  }

  /**
   * 设置瓦片元数据
   */
  async setMeta(tileId: string, meta: TileMetadata, ttl = 3600): Promise<void> {
    const value = JSON.stringify(meta);
    await this.cache.set(this.makeMetaKey(tileId), value, ttl);
  }

  /**
   * 获取瓦片元数据
   */
  async getMeta(tileId: string): Promise<TileMetadata | null> {
    const value = await this.cache.get(this.makeMetaKey(tileId));
    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as TileMetadata;
    } catch {
      return null;
    }
  }

  /**
   * 同时获取瓦片数据和元数据
   */
  async getWithDataAndMeta(tileId: string): Promise<{ data: TileData | null; meta: TileMetadata | null }> {
    const keys = [this.makeDataKey(tileId), this.makeMetaKey(tileId)];
    const values = await this.cache.mget(keys);

    let data: TileData | null = null;
    let meta: TileMetadata | null = null;

    if (values[0]) {
      try {
        const parsed = JSON.parse(values[0]!);
        data = {
          tileId,
          buffer: Buffer.from(parsed.buffer, 'base64'),
          mimeType: parsed.mimeType,
          compressed: parsed.compressed,
          version: parsed.version,
        };
      } catch {
        // 解析失败
      }
    }

    if (values[1]) {
      try {
        meta = JSON.parse(values[1]!) as TileMetadata;
      } catch {
        // 解析失败
      }
    }

    return { data, meta };
  }

  /**
   * 删除瓦片缓存（数据和元数据）
   */
  async invalidate(tileId: string): Promise<void> {
    await this.cache.del(this.makeDataKey(tileId));
    await this.cache.del(this.makeMetaKey(tileId));
  }

  /**
   * 批量删除瓦片缓存
   */
  async invalidateMultiple(tileIds: string[]): Promise<void> {
    for (const id of tileIds) {
      await this.invalidate(id);
    }
  }
}

export default TileCacheService;
