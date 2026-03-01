/**
 * 瓦片服务
 * 提供瓦片数据获取、缓存管理、性能监控等功能
 */

import { logger } from '../utils/logger';

interface TileData {
  tileId: string;
  pixels: any[];
  timestamp: number;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

interface TileStats {
  pixelCount: number;
  userCount: number;
  bounds: any;
  zoom: number;
  tileX: number;
  tileY: number;
}

export class TileService {
  private baseUrl: string;
  private cache: Map<string, TileData> = new Map();
  private maxCacheSize = 100;
  private cacheTimeout = 30 * 60 * 1000; // 30分钟 (was 5分钟)
  public onTileRenderComplete?: () => void | Promise<void>;
  private tileVersions: Map<string, string | number> = new Map();
  
  constructor() {
    // 使用环境变量配置
    this.baseUrl = `${import.meta.env.VITE_API_BASE_URL}/api/tiles`;
  }
  
  /**
   * 获取瓦片数据
   * @param tileId - 瓦片ID (格式: "z/x/y")
   * @returns 瓦片数据
   */
  async getTileData(tileId: string): Promise<TileData | null> {
    try {
      // 检查缓存
      const cached = this.cache.get(tileId);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached;
      }

      // 解析瓦片ID
      const parsed = this.parseTileId(tileId);
      if (!parsed) {
        logger.error(`❌ 无效的瓦片ID: ${tileId}`);
        return null;
      }

      // 计算瓦片边界
      const bounds = this.tileToBounds(parsed.z, parsed.x, parsed.y);

      // 🎨 使用/pixels/area端点获取实际像素数据
      const pixelApiUrl = `${import.meta.env.VITE_API_BASE_URL}/api/pixels`;

      const response = await fetch(`${pixelApiUrl}/area`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bounds,
          zoom: parsed.z
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      const tileData: TileData = {
        tileId,
        pixels: data.pixels || [], // 实际像素数据数组
        timestamp: Date.now(),
        bounds
      };

      // 缓存数据
      this.cacheTile(tileId, tileData);

      console.log(`🔍 TileCache 写入: key=${tileId}, pixelCount=${tileData.pixels.length}`);
      logger.debug(`✅ 获取瓦片数据成功 ${tileId}: ${tileData.pixels.length}个像素`);

      return tileData;

    } catch (error) {
      logger.error(`❌ 获取瓦片数据失败 ${tileId}:`, error);
      return null;
    }
  }

  /**
   * 瓦片坐标转地理边界 (WGS84/EPSG:4326)
   * @param z - 缩放级别
   * @param x - 瓦片X坐标
   * @param y - 瓦片Y坐标
   * @returns 地理边界（WGS84坐标系）
   */
  private tileToBounds(z: number, x: number, y: number): { north: number; south: number; east: number; west: number } {
    const n = Math.pow(2, z);

    // 计算WGS-84坐标（标准Web Mercator投影）
    const lonDeg = x / n * 360.0 - 180.0;
    const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n)));
    const latDeg = latRad * 180.0 / Math.PI;

    const lonDegRight = (x + 1) / n * 360.0 - 180.0;
    const latRadBottom = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n)));
    const latDegBottom = latRadBottom * 180.0 / Math.PI;

    // 直接返回WGS84边界
    return {
      north: latDeg,
      south: latDegBottom,
      east: lonDegRight,
      west: lonDeg
    };
  }
  
  /**
   * 获取瓦片统计信息
   * @param tileId - 瓦片ID
   * @returns 瓦片统计信息
   */
  async getTileStats(tileId: string): Promise<TileStats | null> {
    try {
      const response = await fetch(`${this.baseUrl}/${tileId}/info`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || '获取瓦片统计失败');
      }
      
      return data.stats;
      
    } catch (error) {
      logger.error(`❌ 获取瓦片统计失败 ${tileId}:`, error);
      return null;
    }
  }
  
  /**
   * 预加载瓦片
   * @param tileIds - 瓦片ID数组
   * @returns 预加载结果
   */
  async preloadTiles(tileIds: string[]): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;
    
    const promises = tileIds.map(async (tileId) => {
      try {
        await this.getTileData(tileId);
        success++;
      } catch (error) {
        logger.warn(`⚠️ 预加载瓦片失败 ${tileId}:`, error);
        failed++;
      }
    });
    
    await Promise.allSettled(promises);
    
    logger.debug(`📦 瓦片预加载完成: 成功${success}个, 失败${failed}个`);
    
    return { success, failed };
  }
  
  /**
   * 智能清除瓦片缓存 - 避免不必要的缓存清除
   * @param pattern - 缓存键模式
   * @param force - 是否强制清除
   * @returns 清除结果
   */
  async clearTileCache(pattern: string = 'tile:hot:*', force: boolean = false): Promise<boolean> {
    try {
      // 智能缓存策略：只在必要时清除
      if (!force) {
        const cacheAge = Date.now() - (this.lastCacheCleared || 0);
        const minClearInterval = 5 * 60 * 1000; // 5分钟最小清除间隔

        if (cacheAge < minClearInterval) {
          logger.debug(`⏱️ 缓存清除间隔过短，跳过清除 (${Math.round(cacheAge / 1000)}s < ${minClearInterval / 1000}s)`);
          return true;
        }
      }

      const response = await fetch(`${this.baseUrl}/clear-cache`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ pattern })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || '清除瓦片缓存失败');
      }

      // 智能清除本地缓存：只清除过期的
      this.evictExpiredCache();
      this.lastCacheCleared = Date.now();

      logger.debug(`🧹 瓦片缓存已清除: ${data.clearedKeys}个键`);
      return true;

    } catch (error) {
      logger.error('❌ 清除瓦片缓存失败:', error);
      return false;
    }
  }

  private lastCacheCleared: number = 0;

  /**
   * 清除过期的本地缓存
   */
  private evictExpiredCache(): void {
    const now = Date.now();
    let evictedCount = 0;

    for (const [tileId, data] of this.cache.entries()) {
      if (now - data.timestamp > this.cacheTimeout) {
        this.cache.delete(tileId);
        this.clearTileVersion(tileId);
        evictedCount++;
      }
    }

    if (evictedCount > 0) {
      logger.debug(`🗑️ 清除过期缓存: ${evictedCount}个瓦片`);
    }
  }
  
  /**
   * 缓存瓦片数据
   * @param tileId - 瓦片ID
   * @param data - 瓦片数据
   */
  private cacheTile(tileId: string, data: TileData) {
    // 检查缓存大小
    if (this.cache.size >= this.maxCacheSize) {
      this.evictOldestTile();
    }
    
    this.cache.set(tileId, data);
  }
  
  /**
   * 清除最旧的瓦片缓存
   */
  private evictOldestTile() {
    let oldestTileId = '';
    let oldestTime = Date.now();
    
    for (const [tileId, data] of this.cache) {
      if (data.timestamp < oldestTime) {
        oldestTime = data.timestamp;
        oldestTileId = tileId;
      }
    }
    
    if (oldestTileId) {
      this.cache.delete(oldestTileId);
    }
  }
  
  /**
   * 获取缓存统计信息
   * @returns 缓存统计信息
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      timeout: this.cacheTimeout
    };
  }
  
  /**
   * 检查瓦片是否已缓存
   * @param tileId - 瓦片ID
   * @returns 是否已缓存
   */
  isCached(tileId: string): boolean {
    const cached = this.cache.get(tileId);
    return cached !== undefined && Date.now() - cached.timestamp < this.cacheTimeout;
  }
  
  /**
   * 获取瓦片URL
   * @param x - 瓦片X坐标
   * @param y - 瓦片Y坐标
   * @param z - 缩放级别
   * @returns 瓦片URL
   */
  getTileUrl(x: number, y: number, z: number, options: { version?: string | number; format?: 'png' | 'webp' } = {}): string {
    const params = new URLSearchParams();
    const version = options.version ?? this.getTileVersion(`${z}/${x}/${y}`);
    if (version !== undefined) {
      params.set('v', String(version));
    }

    if (options.format && options.format !== 'png') {
      params.set('format', options.format);
    }

    const query = params.toString();
    return `${this.baseUrl}/${z}/${x}/${y}.png${query ? `?${query}` : ''}`;
  }
  
  /**
   * 验证瓦片ID格式
   * @param tileId - 瓦片ID
   * @returns 是否有效
   */
  isValidTileId(tileId: string): boolean {
    const parts = tileId.split('/');
    if (parts.length !== 3) return false;

    const [z, x, y] = parts.map(Number);

    // 检查基本数值有效性
    if (isNaN(z) || isNaN(x) || isNaN(y)) return false;

    // 检查缩放级别范围
    if (z < 0 || z > 22) return false;

    // 检查瓦片坐标范围
    const maxTileCoord = Math.pow(2, z);
    if (x < 0 || x >= maxTileCoord || y < 0 || y >= maxTileCoord) {
      logger.warn(`TileService: 瓦片坐标超出范围 ${tileId}, max=${maxTileCoord}`);
      return false;
    }

    return true;
  }
  
  /**
   * 解析瓦片ID
   * @param tileId - 瓦片ID
   * @returns 瓦片坐标
   */
  parseTileId(tileId: string): { x: number; y: number; z: number } | null {
    if (!this.isValidTileId(tileId)) return null;

    const parts = tileId.split('/');
    return {
      z: parseInt(parts[0]),
      x: parseInt(parts[1]),
      y: parseInt(parts[2])
    };
  }

  setTileVersion(tileId: string, version: string | number) {
    this.tileVersions.set(tileId, version);
  }

  getTileVersion(tileId: string): string | number | undefined {
    return this.tileVersions.get(tileId);
  }

  clearTileVersion(tileId?: string) {
    if (tileId) {
      this.tileVersions.delete(tileId);
      return;
    }
    this.tileVersions.clear();
  }

  async fetchTileBinary(
    tileId: string,
    options: { version?: string | number; format?: 'png' | 'webp'; priority?: 'visible' | 'prefetch' } = {}
  ): Promise<{ buffer: ArrayBuffer; contentType?: string } | null> {
    if (!this.isValidTileId(tileId)) {
      logger.warn('fetchTileBinary received invalid tile id', tileId);
      return null;
    }

    const parsed = this.parseTileId(tileId);
    if (!parsed) {
      logger.warn('fetchTileBinary failed to parse tile id', tileId);
      return null;
    }

    const url = this.getTileUrl(parsed.x, parsed.y, parsed.z, options);
    logger.debug(`fetchTileBinary: 请求瓦片 ${tileId} -> ${url}`);

    try {
      const response = await fetch(url, {
        headers: {
          Accept: options.format === 'webp' ? 'image/webp,image/png;q=0.8,*/*;q=0.5' : 'image/png,image/webp;q=0.8,*/*;q=0.5'
        },
        cache: options.priority === 'visible' ? 'default' : 'force-cache'
      });

      if (!response.ok) {
        if (response.status === 503 || response.status === 202) {
          // 瓦片正在渲染中，返回空结果而不是错误
          logger.debug(`瓦片 ${tileId} 正在渲染中 (${response.status})`);
          return null;
        }
        throw new Error(`Tile request failed: ${response.status} ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const contentType = response.headers.get('Content-Type') ?? undefined;

      // 检查响应头中的瓦片状态
      const tileStatus = response.headers.get('X-Tile-Status');
      if (tileStatus === 'rendering' || tileStatus === 'stale') {
        logger.debug(`瓦片 ${tileId} 状态: ${tileStatus}`);
        // 对于正在渲染或陈旧的瓦片，可能需要特殊处理
      }

      if (options.version !== undefined) {
        this.setTileVersion(tileId, options.version);
      }

      return { buffer, contentType };
    } catch (error) {
      logger.warn('fetchTileBinary error', error);
      if (options.format === 'webp') {
        return this.fetchTileBinary(tileId, { ...options, format: 'png' });
      }
      return null;
    }
  }
}

export default TileService;
