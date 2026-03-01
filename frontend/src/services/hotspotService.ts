/**
 * 热点区域服务 - 专门处理热点相关的API调用
 * 避免在主要文件中混合导入api.ts
 */

import { logger } from '../utils/logger';

export interface Hotspot {
  lat: number;
  lng: number;
  name: string;
  pixelCount?: number;
}

// API返回的热点类型
export interface APIHotspot {
  id: number;
  hotspot_date: string;
  period: string;
  rank: number;
  center_lat: number;
  center_lng: number;
  pixel_count: number;
  unique_users: number;
  region_level?: string;
  region_code?: string;
  region_name?: string;
  meta?: any;
  created_at: string;
  updated_at: string;
}

class HotspotService {
  private static instance: HotspotService;

  // 🚀 热点数据缓存
  private static hotspotsCache = new Map<string, { data: APIHotspot[]; timestamp: number }>();
  private static readonly CACHE_DURATION = 10 * 60 * 1000; // 10分钟缓存

  private constructor() {}

  static getInstance(): HotspotService {
    if (!HotspotService.instance) {
      HotspotService.instance = new HotspotService();
    }
    return HotspotService.instance;
  }

  /**
   * 🚀 获取缓存的热点数据
   */
  private static getCachedHotspots(timeframe: string, limit: number): APIHotspot[] | null {
    const cacheKey = `${timeframe}_${limit}`;
    const cached = HotspotService.hotspotsCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < HotspotService.CACHE_DURATION) {
      logger.info('📦 使用缓存的热点数据');
      return cached.data;
    }

    return null;
  }

  /**
   * 🚀 缓存热点数据
   */
  private static setCachedHotspots(timeframe: string, limit: number, data: APIHotspot[]): void {
    const cacheKey = `${timeframe}_${limit}`;
    HotspotService.hotspotsCache.set(cacheKey, {
      data: [...data],
      timestamp: Date.now()
    });
  }

  /**
   * 🚀 优化版获取热点区域（带缓存）
   */
  async getHotspots(timeframe: 'daily' | 'weekly' | 'monthly' = 'monthly', limit: number = 10): Promise<APIHotspot[]> {
    try {
      // 🚀 优化1：检查缓存
      const cachedData = HotspotService.getCachedHotspots(timeframe, limit);
      if (cachedData) {
        return cachedData;
      }

      // 动态导入api模块
          const apiModule = await import('./api');
      const { GeographicService } = apiModule;
      const hotspots = await GeographicService.getHotspots(timeframe, limit);

      logger.info(`🔥 获取到 ${hotspots?.length || 0} 个热点区域`);

      // 🚀 优化2：缓存成功的数据
      if (hotspots && hotspots.length > 0) {
        HotspotService.setCachedHotspots(timeframe, limit, hotspots);
      }

      return hotspots || [];
    } catch (error) {
      logger.error('获取热点区域失败:', error);
      return [];
    }
  }

  /**
   * 获取动态热点并转换为Hotspot格式
   */
  async getDynamicHotspots(timeframe: 'daily' | 'weekly' | 'monthly' = 'monthly', limit: number = 10): Promise<Hotspot[]> {
    try {
      const hotspotsData = await this.getHotspots(timeframe, limit);

      // 将APIHotspot转换为Hotspot格式
      return hotspotsData.map((hotspot, index) => ({
        lat: hotspot.center_lat,
        lng: hotspot.center_lng,
        name: hotspot.region_name || `热点区域 #${index + 1}`,
        pixelCount: hotspot.pixel_count
      }));
    } catch (error) {
      logger.error('获取动态热点失败:', error);
      return [];
    }
  }

  /**
   * 获取预设热点区域
   */
  getPresetHotspots(): Hotspot[] {
    return [
      { lat: 30.2741, lng: 120.1551, name: '杭州西湖' },
      { lat: 39.9042, lng: 116.4074, name: '北京天安门' },
      { lat: 31.2304, lng: 121.4737, name: '上海外滩' },
      { lat: 23.1291, lng: 113.2644, name: '广州塔' },
      { lat: 22.3193, lng: 114.1694, name: '香港维多利亚港' },
      { lat: 25.0330, lng: 121.5654, name: '台北101' }
    ];
  }

  /**
   * 合并预设热点和动态热点
   */
  async getAllHotspots(timeframe: 'daily' | 'weekly' | 'monthly' = 'monthly', limit: number = 10): Promise<Hotspot[]> {
    const presetHotspots = this.getPresetHotspots();

    try {
      const dynamicHotspots = await this.getDynamicHotspots(timeframe, limit);

      if (dynamicHotspots.length > 0) {
        // 合并预设热点和动态热点
        return [...presetHotspots, ...dynamicHotspots];
      }
    } catch (error) {
      logger.warn('获取动态热点失败，仅使用预设热点:', error);
    }

    return presetHotspots;
  }
}

// 导出单例实例
export const hotspotService = HotspotService.getInstance();