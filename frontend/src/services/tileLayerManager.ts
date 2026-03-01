import { TileService } from './tileService';
import TileUtils, { TileCoord } from '../utils/tileUtils';
import TileCache from '../cache/tileCache';
import { logger } from '../utils/logger';

export interface TileLayerMetrics {
  visibleTiles: number;
  cachedTiles: number;
  averageLoadTime: number;
  fps: number;
  lastUpdatedAt: number;
}

interface TileLayerManagerOptions {
  zIndex?: number;
  format?: 'png' | 'webp';
  prefetchPadding?: number;
  minZoom?: number; // 🔧 新增：最小缩放级别
  maxZoom?: number; // 🔧 新增：最大缩放级别
  onVisibleTilesChange?: (tileIds: string[]) => void;
  onMetrics?: (metrics: TileLayerMetrics) => void;
}

interface TileLoadInfo {
  start: number;
  resolve?: () => void;
}

/**
 * 管理瓦片渲染的自定义图层
 */
export class TileLayerManager {
  private map: any;
  private tileService: TileService;
  private cache: TileCache;
  private options: Required<Omit<TileLayerManagerOptions, 'onVisibleTilesChange' | 'onMetrics' | 'minZoom' | 'maxZoom'>> & {
    minZoom: number;
    maxZoom: number;
  };
  private canvasLayer: any | null = null;
  private canvas!: HTMLCanvasElement;
  private context!: CanvasRenderingContext2D | null;
  private visibleTiles: Set<string> = new Set();
  private versionMap: Map<string, string | number> = new Map();
  private tileBitmaps: Map<string, ImageBitmap> = new Map();
  private loadingTiles: Map<string, TileLoadInfo> = new Map();
  private retryTiles: Map<string, number> = new Map();
  private destroyed = false;
  private fpsFrameHandle: number | null = null;
  private fpsLastTime = performance.now();
  private fpsCounter = 0;
  private currentFps = 0;
  private loadDurations: number[] = [];
  private metricsCallback?: (metrics: TileLayerMetrics) => void;
  private visibleTilesCallback?: (tileIds: string[]) => void;
  // 性能优化：防抖和节流
  private updateTilesTimer: number | null = null;
  private lastUpdateTime = 0;
  private readonly UPDATE_THROTTLE_MS = 100; // 100ms节流

  constructor(map: any, tileService: TileService, cache: TileCache, options: TileLayerManagerOptions = {}) {
    this.map = map;
    this.tileService = tileService;
    this.cache = cache;
    this.options = {
      zIndex: options.zIndex ?? 120,
      format: options.format ?? 'png',
      prefetchPadding: options.prefetchPadding ?? 1,
      minZoom: options.minZoom ?? 12, // 🔧 优化：默认最小缩放级别12，支持12-18级缩放
      maxZoom: options.maxZoom ?? 18  // 🔧 新增：默认最大缩放级别18，与AmapLayerService保持一致
    };
    this.metricsCallback = options.onMetrics;
    this.visibleTilesCallback = options.onVisibleTilesChange;

    this.initializeLayer();
    this.startFpsMonitor();
  }

  private initializeLayer() {
    const AMap = (window as any).AMap;
    if (!AMap || !AMap.CustomLayer) {
      throw new Error('AMap.CustomLayer 不可用，无法初始化瓦片图层');
    }

    this.canvas = document.createElement('canvas');
    this.resizeCanvas();

    this.canvasLayer = new AMap.CustomLayer(this.canvas, {
      zooms: [this.options.minZoom, this.options.maxZoom], // 🔧 修复：使用配置的缩放级别范围
      zIndex: this.options.zIndex
    });

    this.canvasLayer.render = () => {
      this.render();
    };

    this.map.add(this.canvasLayer);

    this.map.on('moveend', this.handleViewportChange);
    this.map.on('zoomend', this.handleViewportChange);
    this.map.on('resize', this.handleResize);

    window.addEventListener('tileCache:prefetch', this.handlePrefetchRequest as EventListener);
    window.addEventListener('tileInvalidate', this.handleTileInvalidate as EventListener);

    // 初始更新
    this.updateVisibleTiles();
  }

  private handleResize = () => {
    this.resizeCanvas();
    this.requestRender();
  };

  private resizeCanvas() {
    const size = this.map.getSize?.();
    if (!size) return;

    this.canvas.width = size.width;
    this.canvas.height = size.height;
    this.context = this.canvas.getContext('2d', { willReadFrequently: true });
  }

  private handleViewportChange = () => {
    this.scheduleUpdateVisibleTiles();
  };

  /**
   * 调度更新可见瓦片 - 带节流
   */
  private scheduleUpdateVisibleTiles() {
    const now = performance.now();

    // 如果距离上次更新时间过短，延迟处理
    if (now - this.lastUpdateTime < this.UPDATE_THROTTLE_MS) {
      if (this.updateTilesTimer) {
        clearTimeout(this.updateTilesTimer);
      }
      this.updateTilesTimer = window.setTimeout(() => {
        this.updateVisibleTiles();
        this.updateTilesTimer = null;
      }, this.UPDATE_THROTTLE_MS);
    } else {
      // 立即更新
      this.lastUpdateTime = now;
      this.updateVisibleTiles();
    }
  }

  private async updateVisibleTiles() {
    if (this.destroyed) return;

    const bounds = this.map.getBounds?.();
    const rawZoom = this.map.getZoom?.();
    if (!bounds || typeof rawZoom !== 'number') return;

    // 限制缩放级别范围，防止生成无效的瓦片坐标
    const zoom = Math.max(3, Math.min(20, Math.floor(rawZoom)));
    if (zoom !== rawZoom) {
      logger.debug(`TileLayerManager: 缩放级别从 ${rawZoom} 调整到 ${zoom}`);
    }

    // 🔧 修复：检查缩放级别是否满足显示条件
    if (zoom < this.options.minZoom || zoom > this.options.maxZoom) {
      logger.debug(`TileLayerManager: 缩放级别不满足条件 (${zoom} < ${this.options.minZoom} 或 > ${this.options.maxZoom})，清除画布和bitmap缓存`);

      // ✅ 清除画布显示
      if (this.context) {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }

      // ✅ 清除bitmap缓存，防止像素泄漏到其他区域
      const bitmapsToClear = Array.from(this.tileBitmaps.values());
      this.tileBitmaps.clear();
      // 延迟关闭bitmap，避免在渲染过程中产生竞态条件
      setTimeout(() => {
        bitmapsToClear.forEach((bitmap) => {
          try {
            bitmap.close?.();
          } catch (e) {
            // 忽略已经关闭的bitmap
          }
        });
      }, 0);
      logger.debug(`TileLayerManager: 已清除所有bitmap缓存，防止渲染隔离问题`);

      // 清空可见瓦片集合，停止渲染
      this.visibleTiles.clear();
      this.visibleTilesCallback?.([]);
      this.emitMetrics();

      return; // 🔧 直接返回，不加载新瓦片
    }

    // 验证bounds对象是否有必要的方法
    if (!bounds.getNorthEast || !bounds.getSouthWest) {
      logger.warn('TileLayerManager: bounds对象缺少必要的方法');
      return;
    }

    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();

    // 验证坐标是否有效
    if (!ne || !sw || typeof ne.lat !== 'number' || typeof sw.lat !== 'number') {
      logger.warn('TileLayerManager: 无效的边界坐标');
      return;
    }

    logger.debug(`TileLayerManager: 更新可见瓦片，zoom=${zoom}, bounds=`, {
      north: ne.lat,
      south: sw.lat,
      east: ne.lng,
      west: sw.lng
    });

    const tileCoords = TileUtils.getTilesInViewport({
      north: ne.lat,
      south: sw.lat,
      east: ne.lng,
      west: sw.lng
    }, zoom, 0);

    const tileIds = tileCoords.map((tile) => TileUtils.getTileId(tile.x, tile.y, tile.z));
    const nextVisible = new Set(tileIds);

    const changed = tileIds.length !== this.visibleTiles.size || tileIds.some((id) => !this.visibleTiles.has(id));
    if (changed) {
      this.visibleTiles = nextVisible;
      this.visibleTilesCallback?.(tileIds);
      this.emitMetrics();
      this.requestRender();
      this.prefetchAroundViewport(tileCoords, zoom);
    }

    // 加载可见瓦片
    tileIds.forEach((tileId) => {
      this.loadTile(tileId, 'visible');
    });
  }

  private prefetchAroundViewport(tiles: TileCoord[], zoom: number) {
    const padding = this.options.prefetchPadding;
    const additionalTiles = new Set<string>();

    tiles.forEach((tile) => {
      const neighbors = TileUtils.getTileNeighbors(tile.x, tile.y, zoom);
      neighbors.forEach((neighbor) => {
        if (Math.abs(neighbor.x - tile.x) <= padding && Math.abs(neighbor.y - tile.y) <= padding) {
          const id = TileUtils.getTileId(neighbor.x, neighbor.y, neighbor.z);
          if (!this.visibleTiles.has(id)) {
            additionalTiles.add(id);
          }
        }
      });
    });

    const ids = Array.from(additionalTiles);
    this.cache.preload(ids, (id) => this.versionMap.get(id));
  }

  private startFpsMonitor() {
    const tick = () => {
      if (this.destroyed) return;

      this.fpsCounter += 1;
      const now = performance.now();
      if (now - this.fpsLastTime >= 1000) {
        this.currentFps = this.fpsCounter * 1000 / (now - this.fpsLastTime);
        this.fpsCounter = 0;
        this.fpsLastTime = now;
        this.emitMetrics();
      }

      this.fpsFrameHandle = requestAnimationFrame(tick);
    };

    this.fpsFrameHandle = requestAnimationFrame(tick);
  }

  private stopFpsMonitor() {
    if (this.fpsFrameHandle) {
      cancelAnimationFrame(this.fpsFrameHandle);
      this.fpsFrameHandle = null;
    }
  }

  private requestRender() {
    if (!this.canvasLayer) return;

    if (typeof this.canvasLayer.reFresh === 'function') {
      this.canvasLayer.reFresh();
    } else if (typeof this.canvasLayer.reDraw === 'function') {
      this.canvasLayer.reDraw();
    }
  }

  private async loadTile(tileId: string, priority: 'visible' | 'prefetch' = 'visible') {
    if (this.loadingTiles.has(tileId)) {
      return;
    }

    const version = this.versionMap.get(tileId);
    const cached = await this.cache.get(tileId, version);
    if (cached) {
      this.tileBitmaps.set(tileId, cached.bitmap);
      this.emitMetrics();
      if (priority === 'visible') {
        this.requestRender();
      }
      return;
    }

    const loadInfo: TileLoadInfo = { start: performance.now() };
    this.loadingTiles.set(tileId, loadInfo);

    try {
      const response = await this.tileService.fetchTileBinary(tileId, {
        version,
        format: this.options.format,
        priority
      });

      if (!response) return;

      const { buffer, contentType } = response;

      // 检查是否是空瓦片或无效数据
      if (buffer.byteLength < 100) {
        logger.debug(`瓦片 ${tileId} 数据太小，可能是空瓦片`);
        return;
      }

      try {
        const blob = new Blob([buffer], { type: contentType ?? 'image/png' });
        const bitmap = await createImageBitmap(blob);
        await this.cache.set(tileId, bitmap, { version, rawData: buffer });
        this.tileBitmaps.set(tileId, bitmap);
        // 成功加载，清理重试记录
        this.retryTiles.delete(tileId);
      } catch (imageError) {
        logger.debug(`瓦片 ${tileId} 图像解码失败，可能是服务端正在渲染:`, imageError);
        // 增加重试计数
        const retryCount = this.retryTiles.get(tileId) || 0;
        if (retryCount < 3) {
          this.retryTiles.set(tileId, retryCount + 1);
          // 延迟重试，给服务器时间渲染瓦片
          setTimeout(() => {
            this.loadTile(tileId, priority);
          }, 2000 * (retryCount + 1)); // 递增延迟：2s, 4s, 6s
        } else {
          // 超过重试次数，清理重试记录
          this.retryTiles.delete(tileId);
        }
        return;
      }

      const duration = performance.now() - loadInfo.start;
      this.loadDurations.push(duration);
      if (this.loadDurations.length > 50) {
        this.loadDurations.shift();
      }

      this.emitMetrics();
      if (priority === 'visible') {
        this.requestRender();
      }
    } catch (error) {
      logger.warn('瓦片加载失败', tileId, error);
    } finally {
      this.loadingTiles.delete(tileId);
    }
  }

  private render() {
    if (!this.context) return;

    const bounds = this.map.getBounds?.();
    const zoom = this.map.getZoom?.();
    if (!bounds || typeof zoom !== 'number') return;

    // 🔧 修复：检查缩放级别是否满足显示条件
    if (zoom < this.options.minZoom || zoom > this.options.maxZoom) {
      // ✅ 清除画布
      this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

      // ✅ 清除bitmap缓存，防止像素泄漏
      const bitmapsToClear = Array.from(this.tileBitmaps.values());
      this.tileBitmaps.clear();
      // 延迟关闭bitmap，避免在渲染过程中产生竞态条件
      setTimeout(() => {
        bitmapsToClear.forEach((bitmap) => {
          try {
            bitmap.close?.();
          } catch (e) {
            // 忽略已经关闭的bitmap
          }
        });
      }, 0);

      return;
    }

    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.visibleTiles.forEach((tileId) => {
      const bitmap = this.tileBitmaps.get(tileId);
      if (!bitmap) return;

      const parsed = TileUtils.parseTileId(tileId);
      if (!parsed) return;

      // ✅ 修复：验证瓦片zoom级别是否匹配当前地图zoom
      if (parsed.z !== Math.floor(zoom)) {
        logger.debug(`TileLayerManager: 跳过不匹配zoom级别的瓦片 ${tileId} (瓦片zoom=${parsed.z}, 地图zoom=${zoom})`);
        return;
      }

      const { bounds: tileBounds } = TileUtils.getTileCoverage(parsed.x, parsed.y, parsed.z);

      // ✅ 修复：验证瓦片边界是否与当前视窗有交集
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      const viewportBounds = {
        north: ne.lat,
        south: sw.lat,
        east: ne.lng,
        west: sw.lng
      };

      // 检查瓦片是否在视窗内
      const tileInViewport =
        tileBounds.north >= viewportBounds.south &&
        tileBounds.south <= viewportBounds.north &&
        tileBounds.east >= viewportBounds.west &&
        tileBounds.west <= viewportBounds.east;

      if (!tileInViewport) {
        logger.debug(`TileLayerManager: 跳过不在视窗内的瓦片 ${tileId}`);
        return;
      }

      const topLeft = this.map.lngLatToContainer([tileBounds.west, tileBounds.north]);
      const bottomRight = this.map.lngLatToContainer([tileBounds.east, tileBounds.south]);

      if (!topLeft || !bottomRight) return;

      const width = bottomRight.x - topLeft.x;
      const height = bottomRight.y - topLeft.y;

      // ✅ 验证渲染尺寸是否合理
      if (width <= 0 || height <= 0 || width > this.canvas.width * 2 || height > this.canvas.height * 2) {
        logger.debug(`TileLayerManager: 跳过异常尺寸的瓦片 ${tileId} (宽=${width}, 高=${height})`);
        return;
      }

      // ✅ 验证bitmap是否仍然有效（防止detached错误）
      try {
        // 测试bitmap是否可用
        if (bitmap.width <= 0 || bitmap.height <= 0) {
          logger.debug(`TileLayerManager: 跳过无效尺寸的bitmap ${tileId} (宽=${bitmap.width}, 高=${bitmap.height})`);
          return;
        }
      } catch (e) {
        // bitmap已经被分离或无效
        logger.debug(`TileLayerManager: bitmap已分离或无效 ${tileId}`, e);
        this.tileBitmaps.delete(tileId);
        return;
      }

      this.context!.drawImage(bitmap, topLeft.x, topLeft.y, width, height);
    });
  }

  refreshTile(tileId: string, version?: string | number) {
    if (version !== undefined) {
      this.versionMap.set(tileId, version);
    }
    this.cache.invalidate(tileId).catch((error) => {
      logger.warn('清理瓦片缓存失败', tileId, error);
    });
    this.loadTile(tileId, 'visible');
  }

  setTileVersion(tileId: string, version: string | number) {
    this.versionMap.set(tileId, version);
  }

  bulkSetTileVersions(updates: Array<{ tileId: string; version: string | number }>) {
    updates.forEach((update) => {
      this.versionMap.set(update.tileId, update.version);
    });
  }

  private emitMetrics() {
    if (!this.metricsCallback) return;

    const averageLoadTime = this.loadDurations.length
      ? this.loadDurations.reduce((sum, value) => sum + value, 0) / this.loadDurations.length
      : 0;

    this.metricsCallback({
      visibleTiles: this.visibleTiles.size,
      cachedTiles: this.cache.getMemoryUsage(),
      averageLoadTime,
      fps: this.currentFps,
      lastUpdatedAt: Date.now()
    });
  }

  private handlePrefetchRequest = async (event: Event) => {
    const detail = (event as CustomEvent).detail as { tileId: string; version?: string | number };
    await this.loadTile(detail.tileId, 'prefetch');
  };

  private handleTileInvalidate = async (event: Event) => {
    const detail = (event as CustomEvent).detail as {
      tileIds: string[];
      pixelGridId?: string;
      reason?: string;
      timestamp?: number;
    };

    logger.debug(`🔄 收到瓦片失效通知: ${detail.tileIds.length}个瓦片`, detail);

    for (const tileId of detail.tileIds) {
      // 清理缓存中的瓦片
      await this.cache.invalidate(tileId);

      // 移除内存中的bitmap
      const bitmap = this.tileBitmaps.get(tileId);
      if (bitmap) {
        this.tileBitmaps.delete(tileId);
        // 延迟关闭bitmap，避免竞态条件
        setTimeout(() => {
          try {
            bitmap.close?.();
          } catch (e) {
            // 忽略已经关闭的bitmap
          }
        }, 0);
      }

      // 如果是可见瓦片，立即重新加载
      if (this.visibleTiles.has(tileId)) {
        logger.debug(`♻️ 重新加载可见瓦片: ${tileId}`);
        await this.loadTile(tileId, 'visible');
      }
    }

    // 触发重绘
    this.requestRender();
  };

  destroy() {
    this.destroyed = true;
    this.stopFpsMonitor();

    // 清理更新计时器
    if (this.updateTilesTimer) {
      clearTimeout(this.updateTilesTimer);
      this.updateTilesTimer = null;
    }

    window.removeEventListener('tileCache:prefetch', this.handlePrefetchRequest as EventListener);
    window.removeEventListener('tileInvalidate', this.handleTileInvalidate as EventListener);

    if (this.canvasLayer && this.map) {
      this.map.remove(this.canvasLayer);
      this.canvasLayer = null;
    }

    if (this.map) {
      this.map.off('moveend', this.handleViewportChange);
      this.map.off('zoomend', this.handleViewportChange);
      this.map.off('resize', this.handleResize);
    }

    const bitmapsToClear = Array.from(this.tileBitmaps.values());
    this.tileBitmaps.clear();
    // 立即关闭bitmap，因为此时对象正在被销毁
    bitmapsToClear.forEach((bitmap) => {
      try {
        bitmap.close?.();
      } catch (e) {
        // 忽略已经关闭的bitmap
      }
    });
    this.loadingTiles.clear();
    this.retryTiles.clear();
  }
}

export default TileLayerManager;
