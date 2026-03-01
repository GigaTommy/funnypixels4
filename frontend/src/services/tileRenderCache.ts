/**
 * 瓦片渲染缓存系统
 * 将Canvas分成固定大小的瓦片，缓存已渲染内容，实现增量渲染
 * ✅ 优化：集成MaterialLoaderService进行Material预加载和缓存
 */

import { logger } from '../utils/logger';
import { materialLoaderService } from './materialLoaderService';

export interface TilePixel {
  x: number; // 屏幕坐标
  y: number; // 屏幕坐标
  color: string;
  size: number;
  type: 'color' | 'emoji' | 'pattern' | 'image';
  emoji?: string;
  imageData?: string;
  imageSize?: number;
  gridId: string;
  // ✅ Plan B: Material 支持
  patternInfo?: {
    id: string;
    key: string;
    render_type: string;
    material_id: string; // Material系统ID
    material_version: number;
    material_metadata?: any;
  };
}

export interface CachedTile {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  pixels: Map<string, TilePixel>; // gridId -> pixel
  lastUpdate: number;
  isDirty: boolean;
}

export class TileRenderCache {
  // 瓦片大小（像素）- 使用256x256以获得最佳性能
  private readonly TILE_SIZE = 256;

  // 瓦片缓存: tileId -> CachedTile
  private tileCache: Map<string, CachedTile> = new Map();

  // 脏瓦片集合（需要重新渲染）
  private dirtyTiles: Set<string> = new Set();

  // 当前缩放级别
  private currentZoom: number = 10;

  // 最大缓存瓦片数（防止内存溢出）
  private readonly MAX_CACHED_TILES = 500;

  /**
   * 获取像素所属的瓦片ID
   */
  getTileId(x: number, y: number, zoom?: number): string {
    const z = zoom ?? this.currentZoom;
    const tileX = Math.floor(x / this.TILE_SIZE);
    const tileY = Math.floor(y / this.TILE_SIZE);
    return `${z}_${tileX}_${tileY}`;
  }

  /**
   * 解析瓦片ID
   */
  private parseTileId(tileId: string): { zoom: number; tileX: number; tileY: number } {
    const [zoom, tileX, tileY] = tileId.split('_').map(Number);
    return { zoom, tileX, tileY };
  }

  /**
   * 更新缩放级别（标记所有瓦片为脏，而不是清空）
   */
  updateZoom(zoom: number) {
    if (Math.floor(zoom) !== Math.floor(this.currentZoom)) {
      logger.info(`📐 缩放级别变化: ${this.currentZoom} → ${zoom}，标记所有瓦片为脏`);

      // 🔧 修复：不清空缓存，而是标记所有瓦片为脏，让它们在下次渲染时更新
      this.tileCache.forEach((tile, tileId) => {
        tile.isDirty = true;
        this.dirtyTiles.add(tileId);
      });

      this.currentZoom = zoom;
    }
  }

  /**
   * 添加或更新像素
   */
  addPixel(pixel: TilePixel) {
    const tileId = this.getTileId(pixel.x, pixel.y);

    // 获取或创建瓦片
    if (!this.tileCache.has(tileId)) {
      this.createTile(tileId);
    }

    const tile = this.tileCache.get(tileId)!;
    tile.pixels.set(pixel.gridId, pixel);
    tile.lastUpdate = Date.now();

    // 标记为脏
    this.markDirty(tileId);
  }

  /**
   * 批量添加像素
   */
  addPixels(pixels: TilePixel[]) {
    const affectedTiles = new Set<string>();

    pixels.forEach(pixel => {
      const tileId = this.getTileId(pixel.x, pixel.y);
      affectedTiles.add(tileId);

      if (!this.tileCache.has(tileId)) {
        this.createTile(tileId);
      }

      const tile = this.tileCache.get(tileId)!;
      tile.pixels.set(pixel.gridId, pixel);
      tile.lastUpdate = Date.now();
    });

    // 批量标记脏瓦片
    affectedTiles.forEach(tileId => this.markDirty(tileId));

    logger.info(`📦 批量添加 ${pixels.length} 个像素，影响 ${affectedTiles.size} 个瓦片`);
  }

  /**
   * 移除像素
   */
  removePixel(gridId: string, x: number, y: number) {
    const tileId = this.getTileId(x, y);
    const tile = this.tileCache.get(tileId);

    if (tile && tile.pixels.has(gridId)) {
      tile.pixels.delete(gridId);
      this.markDirty(tileId);

      // 如果瓦片为空，删除它
      if (tile.pixels.size === 0) {
        this.tileCache.delete(tileId);
        this.dirtyTiles.delete(tileId);
      }
    }
  }

  /**
   * 创建新瓦片
   */
  private createTile(tileId: string) {
    // 检查缓存大小
    if (this.tileCache.size >= this.MAX_CACHED_TILES) {
      this.evictOldTiles();
    }

    const canvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(this.TILE_SIZE, this.TILE_SIZE)
      : document.createElement('canvas');

    if (canvas instanceof HTMLCanvasElement) {
      canvas.width = this.TILE_SIZE;
      canvas.height = this.TILE_SIZE;
    }

    this.tileCache.set(tileId, {
      canvas,
      pixels: new Map(),
      lastUpdate: Date.now(),
      isDirty: true
    });
  }

  /**
   * 标记瓦片为脏
   */
  markDirty(tileId: string) {
    const tile = this.tileCache.get(tileId);
    if (tile) {
      tile.isDirty = true;
      this.dirtyTiles.add(tileId);
    }
  }

  /**
   * 渲染单个瓦片（仅在标记为脏时）
   * ✅ 优化：预加载Materials + 按material_id分组 + 批量渲染
   */
  async renderTile(tileId: string, renderOptions: {
    pixelSize: number;
    emojiSize: number;
  }): Promise<void> {
    const tile = this.tileCache.get(tileId);
    if (!tile) {
      logger.warn(`⚠️ renderTile: 瓦片不存在 ${tileId}`);
      return;
    }
    if (!tile.isDirty) {
      logger.debug(`⏭️ renderTile: 瓦片未标记为dirty，跳过渲染 ${tileId}`);
      return;
    }

    logger.info(`🎨 renderTile: 开始渲染瓦片 ${tileId}, pixels=${tile.pixels.size}`);

    // ⭐️ 步骤1：预加载Tile所有Material
    await this.preloadTileMaterials(tile.pixels);

    const ctx = tile.canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // 清空瓦片
    ctx.clearRect(0, 0, this.TILE_SIZE, this.TILE_SIZE);

    // 禁用抗锯齿
    ctx.imageSmoothingEnabled = false;

    // ⭐️ 步骤2：按像素类型和material_id分组以减少状态切换
    const pixelGroups = new Map<string, TilePixel[]>();
    const { tileX, tileY } = this.parseTileId(tileId);

    tile.pixels.forEach(pixel => {
      // 生成分组key：优先按material_id，然后按颜色或emoji
      let groupKey = pixel.color || '#4ECDC4';  // fallback 为默认绿色
      if (pixel.type === 'pattern' && pixel.patternInfo?.material_id) {
        groupKey = `material_${pixel.patternInfo.material_id}`;
      } else if (pixel.type === 'emoji') {
        groupKey = `emoji_${pixel.emoji}`;
      } else if (pixel.type === 'image' && pixel.imageData) {
        // 为图像类型创建唯一分组key（使用gridId避免图像混用）
        groupKey = `image_${pixel.gridId}`;
      }

      if (!pixelGroups.has(groupKey)) {
        pixelGroups.set(groupKey, []);
      }
      pixelGroups.get(groupKey)!.push(pixel);
    });

    // ⭐️ 步骤3：批量渲染每组像素（直接使用缓存Image，无异步等待）
    for (const [groupKey, pixels] of pixelGroups) {
      if (groupKey.startsWith('material_')) {
        // Material图案像素
        const materialId = groupKey.substring('material_'.length);
        const image = materialLoaderService.getMaterialImageSync(materialId, 'sprite_sheet');

        if (image) {
          // 🔍 Material图像加载成功，绘制图案
          logger.info('🎨 Material图像加载成功，开始绘制:', {
            materialId,
            imageState: image.complete ? 'loaded' : 'loading',
            imageDimensions: `${image.naturalWidth}x${image.naturalHeight}`,
            pixelCount: pixels.length
          });

          // ✅ 直接绘制缓存的Image对象（同步，无任何异步等待）
          for (const pixel of pixels) {
            const localX = pixel.x - tileX * this.TILE_SIZE;
            const localY = pixel.y - tileY * this.TILE_SIZE;

            // 🔍 调试每个像素的绘制位置
            logger.debug('🖼️ 绘制Material像素:', {
              materialId,
              globalPosition: `(${pixel.x}, ${pixel.y})`,
              localPosition: `(${localX}, ${localY})`,
              size: pixel.size,
              drawPosition: `(${Math.floor(localX - pixel.size / 2)}, ${Math.floor(localY - pixel.size / 2)})`
            });

            ctx.drawImage(
              image,
              Math.floor(localX - pixel.size / 2),
              Math.floor(localY - pixel.size / 2),
              pixel.size,
              pixel.size
            );
          }
        } else {
          // 🔍 Material图像加载失败，降级到颜色渲染
          logger.warn('⚠️ Material图像加载失败，降级到颜色渲染:', {
            materialId,
            fallbackColor: pixels[0].color || '#FF0000',
            pixelCount: pixels.length
          });

          ctx.fillStyle = pixels[0].color || '#4ECDC4';  // fallback 为默认绿色
          for (const pixel of pixels) {
            const localX = pixel.x - tileX * this.TILE_SIZE;
            const localY = pixel.y - tileY * this.TILE_SIZE;
            ctx.fillRect(
              Math.floor(localX - pixel.size / 2),
              Math.floor(localY - pixel.size / 2),
              pixel.size,
              pixel.size
            );
          }
        }
      } else if (groupKey.startsWith('emoji_')) {
        // 🔧 禁用 Canvas 2D Emoji 降级渲染，让 WebGL Emoji Atlas 系统完全接管
        logger.info('🚫 跳过 Canvas 2D emoji 渲染，由 WebGL Emoji Atlas 处理:', {
          emojiGroup: groupKey,
          pixelCount: pixels.length
        });
        continue; // 跳过 Canvas 2D 渲染
      } else if (groupKey.startsWith('image_')) {
        // 图像像素（复杂图案如自定义旗帜）
        for (const pixel of pixels) {
          if (pixel.imageData) {
            try {
              // 使用弃用的方法但仍然有效
              await this.drawImageOnTileCanvas(
                ctx,
                pixel.imageData,
                pixel.x - tileX * this.TILE_SIZE,
                pixel.y - tileY * this.TILE_SIZE,
                pixel.imageSize || pixel.size
              );
            } catch (error) {
              // 图像加载失败，降级为颜色渲染
              ctx.fillStyle = pixel.color || '#4ECDC4';  // fallback 为默认绿色
              const localX = pixel.x - tileX * this.TILE_SIZE;
              const localY = pixel.y - tileY * this.TILE_SIZE;
              ctx.fillRect(
                Math.floor(localX - pixel.size / 2),
                Math.floor(localY - pixel.size / 2),
                pixel.size,
                pixel.size
              );
            }
          }
        }
      } else {
        // 颜色像素
        ctx.fillStyle = groupKey;
        for (const pixel of pixels) {
          const localX = pixel.x - tileX * this.TILE_SIZE;
          const localY = pixel.y - tileY * this.TILE_SIZE;
          ctx.fillRect(
            Math.floor(localX - pixel.size / 2),
            Math.floor(localY - pixel.size / 2),
            pixel.size,
            pixel.size
          );
        }
      }
    }

    // 标记为已渲染
    tile.isDirty = false;
    this.dirtyTiles.delete(tileId);
  }

  /**
   * 预加载Tile中所有不同的Materials
   * 这是Plan B性能优化的关键步骤
   */
  private async preloadTileMaterials(pixels: Map<string, TilePixel>): Promise<void> {
    const materialIds = new Set<string>();

    // 调试：检查pixels的内容
    let samplePixel: TilePixel | null = null;
    let totalPixels = 0;
    let patternTypeCount = 0;
    let hasPatternInfoCount = 0;

    // 收集Tile中所有不同的Material IDs
    for (const pixel of pixels.values()) {
      totalPixels++;
      if (!samplePixel) samplePixel = pixel;

      // 收集pattern类型的Material ID
      if (pixel.type === 'pattern') {
        patternTypeCount++;
        if (pixel.patternInfo?.material_id) {
          hasPatternInfoCount++;
          materialIds.add(pixel.patternInfo.material_id);
          logger.debug(`🔍 收集到Material ID: ${pixel.patternInfo.material_id} from pixel type=${pixel.type}`);
        } else {
          logger.debug(`⚠️ pixel type=${pixel.type} 但缺少 material_id:`, pixel.patternInfo);
        }
      }
    }

    logger.info(`🎨 预加载Tile Materials: 总像素=${totalPixels}, pattern类型=${patternTypeCount}, 有patternInfo=${hasPatternInfoCount}, 收集到 ${materialIds.size} 个唯一Material IDs`);

    if (samplePixel && materialIds.size === 0) {
      logger.warn('⚠️ 没有收集到任何Material IDs，样本像素:', {
        type: samplePixel.type,
        color: samplePixel.color,
        hasPatternInfo: !!samplePixel.patternInfo,
        patternInfo: samplePixel.patternInfo
      });
    }

    if (materialIds.size === 0) return;

    // 批量并行预加载所有Materials
    try {
      const startTime = performance.now();
      await materialLoaderService.preloadMaterials(Array.from(materialIds), 'sprite_sheet');
      const loadTime = performance.now() - startTime;
      logger.debug(`🔄 Tile Materials预加载完成: ${materialIds.size} 个Materials (${loadTime.toFixed(2)}ms)`);
    } catch (error) {
      logger.warn('Tile Materials预加载失败，降级到颜色渲染', error);
    }
  }

  /**
   * 在瓦片Canvas上绘制图像
   * ✅ 已弃用：改用Material系统的缓存Image对象
   */
  private async drawImageOnTileCanvas(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    imageData: string,
    x: number,
    y: number,
    size: number
  ): Promise<void> {
    logger.warn('drawImageOnTileCanvas已弃用，应使用Material系统的缓存Image');
    // 向后兼容：仍然支持旧的base64图像渲染
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, Math.floor(x - size / 2), Math.floor(y - size / 2), size, size);
        resolve();
      };
      img.onerror = reject;
      img.src = imageData;
    });
  }

  /**
   * 渲染所有脏瓦片
   */
  async renderDirtyTiles(renderOptions: { pixelSize: number; emojiSize: number }): Promise<number> {
    const dirtyTileList = Array.from(this.dirtyTiles);
    if (dirtyTileList.length === 0) return 0;

    logger.info(`🎨 渲染 ${dirtyTileList.length} 个脏瓦片...`);

    // 并行渲染所有脏瓦片
    await Promise.all(dirtyTileList.map(tileId => this.renderTile(tileId, renderOptions)));

    return dirtyTileList.length;
  }

  /**
   * 合成瓦片到主Canvas
   */
  composeTilesToCanvas(
    mainCtx: CanvasRenderingContext2D,
    viewportBounds: { minX: number; minY: number; maxX: number; maxY: number }
  ): number {
    // 计算可见瓦片范围
    const minTileX = Math.floor(viewportBounds.minX / this.TILE_SIZE);
    const minTileY = Math.floor(viewportBounds.minY / this.TILE_SIZE);
    const maxTileX = Math.ceil(viewportBounds.maxX / this.TILE_SIZE);
    const maxTileY = Math.ceil(viewportBounds.maxY / this.TILE_SIZE);

    let compositedTiles = 0;

    // 只合成可见瓦片
    for (let tileX = minTileX; tileX <= maxTileX; tileX++) {
      for (let tileY = minTileY; tileY <= maxTileY; tileY++) {
        const tileId = `${Math.floor(this.currentZoom)}_${tileX}_${tileY}`;
        const tile = this.tileCache.get(tileId);

        if (tile && tile.pixels.size > 0) {
          // 绘制瓦片到主Canvas
          mainCtx.drawImage(
            tile.canvas as any,
            tileX * this.TILE_SIZE,
            tileY * this.TILE_SIZE
          );
          compositedTiles++;
        }
      }
    }

    return compositedTiles;
  }

  /**
   * 清空缓存
   */
  clearCache() {
    logger.info(`🗑️ 清空瓦片缓存: ${this.tileCache.size} 个瓦片`);
    this.tileCache.clear();
    this.dirtyTiles.clear();
  }

  /**
   * 驱逐旧瓦片（LRU策略）
   */
  private evictOldTiles() {
    const tiles = Array.from(this.tileCache.entries())
      .sort((a, b) => a[1].lastUpdate - b[1].lastUpdate);

    // 删除最老的20%
    const toDelete = Math.floor(tiles.length * 0.2);
    for (let i = 0; i < toDelete; i++) {
      this.tileCache.delete(tiles[i][0]);
      this.dirtyTiles.delete(tiles[i][0]);
    }

    logger.info(`🗑️ LRU驱逐 ${toDelete} 个旧瓦片`);
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      totalTiles: this.tileCache.size,
      dirtyTiles: this.dirtyTiles.size,
      totalPixels: Array.from(this.tileCache.values()).reduce((sum, tile) => sum + tile.pixels.size, 0),
      cacheHitRate: this.calculateCacheHitRate()
    };
  }

  /**
   * 计算缓存命中率
   */
  private calculateCacheHitRate(): number {
    if (this.tileCache.size === 0) return 0;
    const cleanTiles = this.tileCache.size - this.dirtyTiles.size;
    return (cleanTiles / this.tileCache.size) * 100;
  }
}

// 导出单例
export const tileRenderCache = new TileRenderCache();
