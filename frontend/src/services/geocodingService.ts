/**
 * 逆地理编码服务
 *
 * 功能：
 * 1. 集成高德Web Service API（后端已实现）
 * 2. 支持WGS84坐标自动转换
 * 3. 缓存地址信息
 * 4. 批量查询支持
 */

import { logger } from '../utils/logger';
import { api } from './api';

export interface Address {
  formatted: string;
  country?: string;
  province?: string;
  city?: string;
  district?: string;
  street?: string;
  streetNumber?: string;
  adcode?: string;
}

export interface GeocodeResult {
  success: boolean;
  address?: Address;
  error?: string;
}

class GeocodingService {
  private static instance: GeocodingService;
  private addressCache: Map<string, Address> = new Map();
  private pendingRequests: Map<string, Promise<GeocodeResult>> = new Map();

  // 缓存配置
  private readonly CACHE_MAX_SIZE = 1000;
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24小时

  private constructor() {
    logger.info('🗺️ 逆地理编码服务初始化');
  }

  static getInstance(): GeocodingService {
    if (!GeocodingService.instance) {
      GeocodingService.instance = new GeocodingService();
    }
    return GeocodingService.instance;
  }

  /**
   * 生成缓存键
   */
  private getCacheKey(lat: number, lng: number, precision: number = 6): string {
    return `${lat.toFixed(precision)},${lng.toFixed(precision)}`;
  }

  /**
   * 逆地理编码（WGS84坐标）
   */
  async reverseGeocode(lat: number, lng: number): Promise<GeocodeResult> {
    try {
      // 检查缓存
      const cacheKey = this.getCacheKey(lat, lng);
      const cachedAddress = this.addressCache.get(cacheKey);

      if (cachedAddress) {
        logger.debug(`✅ 使用缓存地址: ${cachedAddress.formatted}`);
        return {
          success: true,
          address: cachedAddress
        };
      }

      // 检查是否有正在进行的请求
      const pendingRequest = this.pendingRequests.get(cacheKey);
      if (pendingRequest) {
        logger.debug('等待正在进行的逆地理编码请求...');
        return await pendingRequest;
      }

      // 创建新请求
      const requestPromise = this.performReverseGeocode(lat, lng, cacheKey);
      this.pendingRequests.set(cacheKey, requestPromise);

      try {
        const result = await requestPromise;
        return result;
      } finally {
        this.pendingRequests.delete(cacheKey);
      }

    } catch (error) {
      logger.error('❌ 逆地理编码失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '逆地理编码失败'
      };
    }
  }

  /**
   * 执行逆地理编码请求
   */
  private async performReverseGeocode(lat: number, lng: number, cacheKey: string): Promise<GeocodeResult> {
    try {
      logger.debug(`🔍 逆地理编码请求: (${lat}, ${lng}) [WGS84]`);

      // 直接使用WGS84坐标，统一坐标系
      logger.debug(`📍 使用WGS84坐标: (${lat}, ${lng})`);

      // 调用后端API
      const response = await api.post('/geocode/reverse', {
        lat: lat,
        lng: lng
      });

      if (!response.data || !response.data.success) {
        throw new Error(response.data?.error || '逆地理编码失败');
      }

      const addressData = response.data.data;

      // 构造地址对象
      const address: Address = {
        formatted: addressData.formatted_address || addressData.address || '未知地址',
        country: addressData.addressComponent?.country,
        province: addressData.addressComponent?.province,
        city: addressData.addressComponent?.city,
        district: addressData.addressComponent?.district,
        street: addressData.addressComponent?.street,
        streetNumber: addressData.addressComponent?.streetNumber,
        adcode: addressData.addressComponent?.adcode
      };

      // 缓存地址
      this.cacheAddress(cacheKey, address);

      logger.info(`✅ 逆地理编码成功: ${address.formatted}`);

      return {
        success: true,
        address
      };

    } catch (error) {
      logger.error('❌ 执行逆地理编码请求失败:', error);
      throw error;
    }
  }

  /**
   * 缓存地址
   */
  private cacheAddress(key: string, address: Address): void {
    // 检查缓存大小
    if (this.addressCache.size >= this.CACHE_MAX_SIZE) {
      // 删除最早的缓存项（简单FIFO策略）
      const firstKey = this.addressCache.keys().next().value;
      if (firstKey) {
        this.addressCache.delete(firstKey);
        logger.debug('缓存已满，删除最早的缓存项');
      }
    }

    this.addressCache.set(key, address);
    logger.debug(`地址已缓存: ${key}`);
  }

  /**
   * 批量逆地理编码
   */
  async batchReverseGeocode(
    locations: Array<{ lat: number; lng: number }>
  ): Promise<GeocodeResult[]> {
    logger.info(`📦 批量逆地理编码: ${locations.length} 个位置`);

    const results: GeocodeResult[] = [];

    // 并发请求（最多10个并发）
    const BATCH_SIZE = 10;
    for (let i = 0; i < locations.length; i += BATCH_SIZE) {
      const batch = locations.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(loc => this.reverseGeocode(loc.lat, loc.lng))
      );
      results.push(...batchResults);
    }

    const successCount = results.filter(r => r.success).length;
    logger.info(`✅ 批量逆地理编码完成: ${successCount}/${locations.length} 成功`);

    return results;
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    const size = this.addressCache.size;
    this.addressCache.clear();
    logger.info(`🗑️ 地址缓存已清除: ${size} 条记录`);
  }

  /**
   * 获取缓存统计
   */
  getCacheStats() {
    return {
      size: this.addressCache.size,
      maxSize: this.CACHE_MAX_SIZE,
      ttl: this.CACHE_TTL,
      pendingRequests: this.pendingRequests.size
    };
  }
}

// 导出单例实例
export const geocodingService = GeocodingService.getInstance();

// 默认导出
export default geocodingService;
