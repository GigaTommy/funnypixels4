/**
 * Material加载和缓存服务
 * 负责管理自定义图案Material的缓存和预加载
 * 实现Plan B的三层缓存策略
 */

import { logger } from '../utils/logger';

export interface MaterialVariant {
  id: number;
  material_id: number;
  variant_type: 'sprite_sheet' | 'distance_field' | 'source';
  format: string;
  width: number;
  height: number;
  size_bytes: number;
  checksum: string;
  payload: string; // base64
  metadata: any;
  version: number;
  is_active: boolean;
}

export interface MaterialImage {
  imageElement: HTMLImageElement;
  loadedAt: number;
  variant: MaterialVariant;
  hitCount: number;
}

export class MaterialLoaderService {
  // 第1层：内存缓存 (Material ID → Image对象)
  private materialImageCache = new Map<string, MaterialImage>();

  // 第2层：加载中的Promise缓存 (Material ID → Promise)
  private loadingPromises = new Map<string, Promise<HTMLImageElement>>();

  // 统计信息
  private stats = {
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    imagesCreated: 0,
    totalLoadTime: 0,
    preloadBatchSize: 0
  };

  // Material API基础URL
  private apiBaseUrl = '/api/materials';

  // 缓存最大条目数（LRU驱逐）
  private readonly MAX_CACHE_SIZE = 100;

  // 空闲清理间隔（毫秒）
  private readonly IDLE_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5分钟
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startIdleCleanup();
  }

  /**
   * 预加载单个Material Image
   * 实现三层缓存策略：缓存 → 加载Promise缓存 → 网络请求
   */
  async preloadMaterialImage(materialId: string, variantType: 'sprite_sheet' | 'distance_field' | 'source' = 'sprite_sheet'): Promise<HTMLImageElement> {
    const startTime = performance.now();
    this.stats.totalRequests++;

    const cacheKey = `${materialId}_${variantType}`;

    // ✅ 第1层：缓存命中 → 直接返回
    if (this.materialImageCache.has(cacheKey)) {
      const cached = this.materialImageCache.get(cacheKey)!;
      cached.hitCount++;
      this.stats.cacheHits++;
      logger.debug(`📦 Material缓存命中: ${cacheKey} (${cached.hitCount} hits)`);
      return cached.imageElement;
    }

    // ✅ 第2层：加载中 → 复用Promise（避免重复请求）
    if (this.loadingPromises.has(cacheKey)) {
      logger.debug(`⏳ Material加载中，复用Promise: ${cacheKey}`);
      return this.loadingPromises.get(cacheKey)!;
    }

    // ✅ 第3层：首次加载 → 网络请求
    this.stats.cacheMisses++;
    const promise = this.fetchAndCreateImage(materialId, variantType, cacheKey);
    this.loadingPromises.set(cacheKey, promise);

    try {
      const image = await promise;
      const loadTime = performance.now() - startTime;
      this.stats.totalLoadTime += loadTime;

      // 缓存到第1层
      this.materialImageCache.set(cacheKey, {
        imageElement: image,
        loadedAt: Date.now(),
        variant: {} as MaterialVariant, // 在fetchAndCreateImage中设置
        hitCount: 0
      });

      // 检查缓存大小，进行LRU驱逐
      if (this.materialImageCache.size > this.MAX_CACHE_SIZE) {
        this.evictLRUItem();
      }

      logger.info(`✅ Material加载完成: ${cacheKey} (${loadTime.toFixed(2)}ms)`);
      return image;
    } finally {
      this.loadingPromises.delete(cacheKey);
    }
  }

  /**
   * 获取已缓存的Material Image（同步方法）
   * 用于渲染时快速获取，无异步等待
   */
  getMaterialImageSync(materialId: string, variantType: 'sprite_sheet' | 'distance_field' | 'source' = 'sprite_sheet'): HTMLImageElement | null {
    const cacheKey = `${materialId}_${variantType}`;
    const cached = this.materialImageCache.get(cacheKey);
    return cached ? cached.imageElement : null;
  }

  /**
   * 获取Material及其所有variants
   * 预加载整个Material的所有variants
   */
  async preloadMaterialVariants(materialId: string): Promise<{
    spriteSheet: HTMLImageElement | null;
    distanceField: HTMLImageElement | null;
    source: HTMLImageElement | null;
  }> {
    const [spriteSheet, distanceField, source] = await Promise.all([
      this.preloadMaterialImage(materialId, 'sprite_sheet').catch(err => {
        logger.warn(`预加载 sprite_sheet 失败: ${materialId}`, err);
        return null as any;
      }),
      this.preloadMaterialImage(materialId, 'distance_field').catch(err => {
        logger.warn(`预加载 distance_field 失败: ${materialId}`, err);
        return null as any;
      }),
      this.preloadMaterialImage(materialId, 'source').catch(err => {
        logger.warn(`预加载 source 失败: ${materialId}`, err);
        return null as any;
      })
    ]);

    return { spriteSheet, distanceField, source };
  }

  /**
   * 批量预加载Materials
   * 用于Tile渲染前一次性预加载所有Material
   */
  async preloadMaterials(materialIds: string[], variantType: 'sprite_sheet' | 'distance_field' | 'source' = 'sprite_sheet'): Promise<Map<string, HTMLImageElement | null>> {
    const startTime = performance.now();
    this.stats.preloadBatchSize = materialIds.length;

    logger.info(`🔄 批量预加载 ${materialIds.length} 个Materials...`);

    // 并行预加载所有Materials
    const results = await Promise.allSettled(
      materialIds.map(id => this.preloadMaterialImage(id, variantType))
    );

    const resultMap = new Map<string, HTMLImageElement | null>();

    results.forEach((result, index) => {
      const materialId = materialIds[index];
      if (result.status === 'fulfilled') {
        resultMap.set(materialId, result.value);
      } else {
        logger.warn(`预加载Material失败: ${materialId}`, result.reason);
        resultMap.set(materialId, null);
      }
    });

    const loadTime = performance.now() - startTime;
    logger.info(`✅ 批量预加载完成: ${materialIds.length} 个Materials (${loadTime.toFixed(2)}ms)`);

    return resultMap;
  }

  /**
   * 从网络获取Material数据并创建Image对象
   */
  private async fetchAndCreateImage(
    materialId: string,
    variantType: 'sprite_sheet' | 'distance_field' | 'source',
    cacheKey: string
  ): Promise<HTMLImageElement> {
    return new Promise(async (resolve, reject) => {
      try {
        // ✅ API查询：获取Material variant数据
        const url = `${this.apiBaseUrl}/${materialId}/variants?variant_type=${variantType}`;
        const response = await fetch(url);

        // 🔧 修复：处理404错误，优雅降级
        if (!response.ok) {
          if (response.status === 404) {
            // 材质variant不存在（常见于custom_flag等用户自定义材质）
            logger.warn(`⚠️ Material variant不存在: ${materialId} (${variantType})，跳过加载`);
            // 返回一个透明的1x1像素图片作为占位符
            const placeholderImg = new Image();
            placeholderImg.onload = () => resolve(placeholderImg);
            placeholderImg.onerror = () => reject(new Error(`占位符加载失败`));
            // 1x1透明PNG的base64数据
            placeholderImg.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
            return;
          }
          throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
        }

        const apiResponse = await response.json();

        // 处理Material API返回的数据结构
        if (!apiResponse.success || !apiResponse.data) {
          throw new Error(`Material API返回无效数据: ${JSON.stringify(apiResponse)}`);
        }

        const { payload, format } = apiResponse.data;

        if (!payload) {
          throw new Error('Material payload为空');
        }

        // ✅ 一次性创建Image对象（这是所有预加载的Image中唯一的创建点）
        const img = new Image();
        img.onload = () => {
          this.stats.imagesCreated++;
          logger.debug(`🖼️ Image对象创建: ${cacheKey}`);
          resolve(img);
        };
        img.onerror = () => {
          reject(new Error(`Image加载失败: ${cacheKey}`));
        };

        // ✅ 一次性base64转换
        // 🔧 关键修复：确保MIME类型正确（image/png而不是png）
        const mimeType = format.startsWith('image/') ? format : `image/${format}`;
        img.src = `data:${mimeType};base64,${payload}`;
      } catch (error) {
        logger.error(`Material加载失败: ${cacheKey}`, error);
        reject(error);
      }
    });
  }

  /**
   * LRU驱逐 - 删除最少使用的缓存项
   */
  private evictLRUItem() {
    let lruKey = '';
    let lruItem = null;
    let minHits = Infinity;
    let oldestTime = Infinity;

    for (const [key, item] of this.materialImageCache) {
      // 优先驱逐未被使用的（hitCount=0），其次驱逐最老的
      if (item.hitCount < minHits || (item.hitCount === minHits && item.loadedAt < oldestTime)) {
        minHits = item.hitCount;
        oldestTime = item.loadedAt;
        lruKey = key;
        lruItem = item;
      }
    }

    if (lruKey) {
      this.materialImageCache.delete(lruKey);
      logger.debug(`🗑️ LRU驱逐Material缓存: ${lruKey} (hits: ${lruItem.hitCount})`);
    }
  }

  /**
   * 启动空闲清理定时器
   * 定期清理过期或无用的缓存
   */
  private startIdleCleanup() {
    this.cleanupTimer = setInterval(() => {
      this.cleanupIdleCache();
    }, this.IDLE_CLEANUP_INTERVAL);
  }

  /**
   * 清理空闲缓存
   */
  private cleanupIdleCache() {
    const now = Date.now();
    const MAX_IDLE_TIME = 10 * 60 * 1000; // 10分钟未被使用
    let cleanedCount = 0;

    for (const [key, item] of this.materialImageCache) {
      const idleTime = now - item.loadedAt;
      // 如果长时间未被使用且hit count低，则删除
      if (idleTime > MAX_IDLE_TIME && item.hitCount < 3) {
        this.materialImageCache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info(`🧹 清理空闲Material缓存: ${cleanedCount} 个`);
    }
  }

  /**
   * 清空所有缓存
   */
  clearCache() {
    logger.info(`🗑️ 清空Material缓存: ${this.materialImageCache.size} 个项`);
    this.materialImageCache.clear();
    this.loadingPromises.clear();
  }

  /**
   * 获取预预热建议
   * 返回应该预加载的Material IDs列表
   */
  getPreheatSuggestions(): string[] {
    const suggestions: string[] = [];
    const maxItems = Math.min(20, this.materialImageCache.size * 0.5);

    // 推荐缓存中hit count最高的Materials
    const sorted = Array.from(this.materialImageCache.entries())
      .sort((a, b) => b[1].hitCount - a[1].hitCount)
      .slice(0, maxItems);

    return sorted.map(([key]) => key.split('_')[0]); // 提取Material ID
  }

  /**
   * 销毁服务（清理资源）
   */
  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clearCache();
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const avgLoadTime = this.stats.totalRequests > 0
      ? this.stats.totalLoadTime / this.stats.cacheMisses || 0
      : 0;

    const hitRate = this.stats.totalRequests > 0
      ? ((this.stats.cacheHits / this.stats.totalRequests) * 100).toFixed(2)
      : '0.00';

    return {
      cacheSize: this.materialImageCache.size,
      totalRequests: this.stats.totalRequests,
      cacheHits: this.stats.cacheHits,
      cacheMisses: this.stats.cacheMisses,
      hitRate: `${hitRate}%`,
      imagesCreated: this.stats.imagesCreated,
      averageLoadTime: `${avgLoadTime.toFixed(2)}ms`,
      preloadBatchSize: this.stats.preloadBatchSize,
      loadingPromises: this.loadingPromises.size
    };
  }

  /**
   * 打印调试信息
   */
  debugInfo() {
    const stats = this.getStats();
    console.group('📊 MaterialLoaderService 统计信息');
    console.table({
      '缓存大小': `${stats.cacheSize}/${this.MAX_CACHE_SIZE}`,
      '总请求数': stats.totalRequests,
      '缓存命中': `${stats.cacheHits}/${stats.totalRequests}`,
      '命中率': stats.hitRate,
      'Image对象数': stats.imagesCreated,
      '平均加载时间': stats.averageLoadTime,
      '加载中的Promise': stats.loadingPromises
    });
    console.table(Array.from(this.materialImageCache.entries()).map(([key, item]) => ({
      'Cache Key': key,
      'Hits': item.hitCount,
      '加载时间': new Date(item.loadedAt).toLocaleTimeString()
    })));
    console.groupEnd();
  }
}

// 导出单例
export const materialLoaderService = new MaterialLoaderService();
