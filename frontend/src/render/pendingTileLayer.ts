export interface PendingPixel {
  id: string;
  tileId: string;
  lat: number;
  lng: number;
  color: string;
  createdAt: number;
}

interface PendingTileLayerOptions {
  zIndex?: number;
  expireMs?: number;
}

/**
 * 写入回显的临时瓦片层
 */
export class PendingTileLayer {
  private map: any;
  private canvasLayer: any | null = null;
  private canvas!: HTMLCanvasElement;
  private context!: CanvasRenderingContext2D | null;
  private pendingPixels: Map<string, PendingPixel> = new Map();
  private options: Required<PendingTileLayerOptions>;
  // 性能优化：添加防抖和节流
  private renderScheduled = false;
  private renderTimer: number | null = null;
  private lastRenderTime = 0;
  private readonly MIN_RENDER_INTERVAL = 16; // ~60fps

  constructor(map: any, options: PendingTileLayerOptions = {}) {
    this.map = map;
    this.options = {
      zIndex: options.zIndex ?? 500,
      expireMs: options.expireMs ?? 15_000
    };

    this.initialize();
  }

  private initialize() {
    const AMap = (window as any).AMap;
    if (!AMap || !AMap.CustomLayer) {
      throw new Error('AMap.CustomLayer 不可用，无法创建临时像素层');
    }

    this.canvas = document.createElement('canvas');
    this.resizeCanvas();

    this.canvasLayer = new AMap.CustomLayer(this.canvas, {
      zooms: [3, 20],
      zIndex: this.options.zIndex
    });

    this.canvasLayer.render = () => {
      this.scheduleRender();
    };

    this.map.add(this.canvasLayer);
    // 优化：移除直接触发render的事件监听，改为延迟调度
    this.map.on('moveend', this.scheduleRender);
    this.map.on('zoomend', this.scheduleRender);
    this.map.on('resize', this.handleResize);
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

  addPendingPixel(pixel: PendingPixel) {
    this.pendingPixels.set(pixel.id, pixel);
    this.scheduleRender();
  }

  removeByTile(tileId: string) {
    Array.from(this.pendingPixels.entries()).forEach(([id, pixel]) => {
      if (pixel.tileId === tileId) {
        this.pendingPixels.delete(id);
      }
    });
    this.scheduleRender();
  }

  removeById(id: string) {
    if (this.pendingPixels.delete(id)) {
      this.scheduleRender();
    }
  }

  pruneExpired() {
    const now = Date.now();
    let removed = false;
    this.pendingPixels.forEach((pixel, id) => {
      if (now - pixel.createdAt > this.options.expireMs) {
        this.pendingPixels.delete(id);
        removed = true;
      }
    });
    if (removed) {
      this.scheduleRender();
    }
  }

  /**
   * 调度渲染 - 使用节流防止过度渲染
   */
  private scheduleRender = () => {
    if (this.renderScheduled) return;

    const now = performance.now();
    const timeSinceLastRender = now - this.lastRenderTime;

    if (timeSinceLastRender < this.MIN_RENDER_INTERVAL) {
      // 如果距离上次渲染时间过短，延迟到合适的时机
      if (this.renderTimer) {
        cancelAnimationFrame(this.renderTimer);
      }
      this.renderTimer = requestAnimationFrame(() => {
        this.renderScheduled = false;
        this.renderTimer = null;
        this.scheduleRender();
      });
      this.renderScheduled = true;
    } else {
      // 可以立即渲染
      this.renderScheduled = true;
      this.renderTimer = requestAnimationFrame(() => {
        this.render();
        this.lastRenderTime = performance.now();
        this.renderScheduled = false;
        this.renderTimer = null;
      });
    }
  };

  private render = () => {
    if (!this.context) return;

    this.pruneExpired();

    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 🔧 修复：根据缩放级别动态计算像素大小
    const size = this.getPixelSize();

    this.pendingPixels.forEach((pixel) => {
      const { lat, lng, color } = pixel;
      const position = this.map.lngLatToContainer([lng, lat]);
      if (!position) return;

      this.context!.fillStyle = color;
      this.context!.globalAlpha = 0.6;
      this.context!.fillRect(position.x - size / 2, position.y - size / 2, size, size);
      this.context!.globalAlpha = 1;
    });
  };

  /**
   * 获取像素大小 - 根据地图缩放级别动态计算
   * @returns 像素大小（屏幕像素）
   */
  private getPixelSize(): number {
    try {
      const zoom = this.map.getZoom();
      const geographicSize = 0.0001; // 0.0001度（约11米）
      const pixelsPerDegree = (256 * Math.pow(2, zoom)) / 360;
      const calculatedSize = geographicSize * pixelsPerDegree;

      // 根据缩放级别设置合适的最小尺寸，与canvasLayer保持一致
      const minSize = zoom < 17 ? 12 : 10;
      return Math.max(minSize, Math.round(calculatedSize));
    } catch (error) {
      return 12; // 降级方案
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

  destroy() {
    // 清理渲染计时器
    if (this.renderTimer) {
      cancelAnimationFrame(this.renderTimer);
      this.renderTimer = null;
    }

    if (this.canvasLayer && this.map) {
      this.map.remove(this.canvasLayer);
      this.canvasLayer = null;
    }

    if (this.map) {
      this.map.off('moveend', this.scheduleRender);
      this.map.off('zoomend', this.scheduleRender);
      this.map.off('resize', this.handleResize);
    }

    this.pendingPixels.clear();
  }
}

export default PendingTileLayer;
