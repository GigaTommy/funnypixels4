/**
 * BBOX像素查询服务
 * 为未来MVT迁移做准备，使用BBOX查询像素
 */

import { logger } from '../utils/logger';

export interface BboxQueryParams {
  north: number;
  south: number;
  east: number;
  west: number;
  zoom: number;
}

export interface PixelData {
  id: string;
  lat: number;
  lng: number;
  color: string;
  pattern_id?: string;
  render_type?: 'color' | 'emoji' | 'complex';
  unicode_char?: string;
  material_id?: string;
}

export class BboxPixelService {
  private static instance: BboxPixelService;
  private cache: Map<string, { data: PixelData[]; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 5000; // 5秒缓存
  private readonly API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL}/api/pixels`;

  static getInstance(): BboxPixelService {
    if (!BboxPixelService.instance) {
      BboxPixelService.instance = new BboxPixelService();
    }
    return BboxPixelService.instance;
  }

  /**
   * 查询指定边界框内的像素
   */
  async queryPixelsInBounds(params: BboxQueryParams): Promise<PixelData[]> {
    // 生成缓存键
    const cacheKey = this.generateCacheKey(params);

    // 检查缓存
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      logger.debug(`📦 BBOX缓存命中: ${cacheKey}`);
      return cached.data;
    }

    try {
      // 发送BBOX查询请求
      const response = await fetch(`${this.API_BASE_URL}/bbox`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          north: params.north,
          south: params.south,
          east: params.east,
          west: params.west,
          zoom: params.zoom
        })
      });

      if (!response.ok) {
        throw new Error(`BBOX查询失败: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      const pixels = result.pixels || [];

      // 缓存结果
      this.cache.set(cacheKey, {
        data: pixels,
        timestamp: Date.now()
      });

      // 清理过期缓存
      this.cleanupCache();

      logger.debug(`🔍 BBOX查询完成: ${params.zoom}级, ${pixels.length}个像素`);
      return pixels;

    } catch (error) {
      logger.error('❌ BBOX查询失败:', error);
      return [];
    }
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(params: BboxQueryParams): string {
    // 四舍五入到小数点后5位，避免微小变化导致缓存失效
    const n = Math.round(params.north * 100000);
    const s = Math.round(params.south * 100000);
    const e = Math.round(params.east * 100000);
    const w = Math.round(params.west * 100000);
    const z = Math.round(params.zoom);

    return `${z}/${n}/${s}/${e}/${w}`;
  }

  /**
   * 清理过期缓存
   */
  private cleanupCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.CACHE_DURATION) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.cache.delete(key));

    if (expiredKeys.length > 0) {
      logger.debug(`🧹 清理过期BBOX缓存: ${expiredKeys.length}个`);
    }
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: 100 // 最大缓存数量
    };
  }

  /**
   * 清空所有缓存
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('🗑️ BBOX缓存已清空');
  }
}

export default BboxPixelService.getInstance();