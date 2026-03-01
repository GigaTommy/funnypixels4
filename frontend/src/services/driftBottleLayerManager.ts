/**
 * 漂流瓶图层管理器
 *
 * 功能：
 * - 高性能渲染漂流瓶标记
 * - 支持聚合显示（多个瓶子密集时）
 * - 智能加载和卸载（视口范围内）
 * - 完美兼容像素格子渲染
 * - 支持实时更新和动画特效
 *
 * 架构设计：
 * - 使用独立图层（zIndex: 1500，高于像素格子）
 * - 支持标记池复用，减少DOM操作
 * - 实现视口剔除，只渲染可见区域
 * - 提供事件回调接口
 */

import { logger } from '../utils/logger';
import { DriftBottle } from './driftBottleService';
import { DRIFT_BOTTLE_CONFIG } from '../config/driftBottleConfig';
import { MapMarkerInfo } from '../components/map/MapMarkerInfo';

export interface DriftBottleMarkerOptions {
  onClick?: (bottle: DriftBottle) => void;
  onHover?: (bottle: DriftBottle | null) => void;
  enableClustering?: boolean;  // 是否启用聚合
  clusterRadius?: number;       // 聚合半径（像素）
  maxMarkersInViewport?: number; // 视口内最大标记数
  enableAnimation?: boolean;    // 是否启用动画
  enableInfoWindow?: boolean;   // 是否启用信息窗口
  infoWindowContainer?: HTMLElement; // 信息窗口容器
}

export interface BottleCluster {
  center: { lat: number; lng: number };
  bottles: DriftBottle[];
  count: number;
}

/**
 * 漂流瓶图层管理器
 */
export class DriftBottleLayerManager {
  private map: any = null;
  private AMap: any = null;

  // 标记管理
  private markers: Map<string, any> = new Map();
  private clusterMarkers: Map<string, any> = new Map();
  private bottles: Map<string, DriftBottle> = new Map();

  // 信息窗口管理
  private infoWindowContainer: HTMLElement | null = null;
  private hoverInfoWindow: any = null;
  private clickInfoWindow: any = null;
  private currentHoverBottle: DriftBottle | null = null;
  private currentClickBottle: DriftBottle | null = null;

  // 配置
  private options: Required<DriftBottleMarkerOptions>;

  // 性能统计
  private stats = {
    totalBottles: 0,
    visibleBottles: 0,
    clusteredBottles: 0,
    renderTime: 0
  };

  // 视口边界缓存
  private lastViewportBounds: any = null;
  private updateThrottleTimer: NodeJS.Timeout | null = null;

  constructor(map: any, AMap: any, options: DriftBottleMarkerOptions = {}) {
    this.map = map;
    this.AMap = AMap;

    // 默认配置
    this.options = {
      onClick: options.onClick || (() => {}),
      onHover: options.onHover || (() => {}),
      enableClustering: options.enableClustering !== undefined ? options.enableClustering : true,
      clusterRadius: options.clusterRadius || 50,
      maxMarkersInViewport: options.maxMarkersInViewport || 100,
      enableAnimation: options.enableAnimation !== undefined ? options.enableAnimation : true,
      enableInfoWindow: options.enableInfoWindow !== undefined ? options.enableInfoWindow : true,
      infoWindowContainer: options.infoWindowContainer || document.body
    };

    // 初始化信息窗口容器
    this.infoWindowContainer = this.options.infoWindowContainer;

    // 监听地图缩放事件
    if (this.map) {
      this.map.on('zoomend', () => {
        this.handleZoomChange();
      });
    }

    logger.info('🍾 漂流瓶图层管理器已初始化', this.options);
  }

  /**
   * 处理地图缩放变化
   */
  private handleZoomChange(): void {
    const zoom = this.map?.getZoom();
    if (!zoom) return;

    // 检查是否在可见缩放范围内
    if (zoom < DRIFT_BOTTLE_CONFIG.MIN_ZOOM_LEVEL || zoom > DRIFT_BOTTLE_CONFIG.MAX_ZOOM_LEVEL) {
      // 超出范围，清除所有标记
      this.clearMarkers();
      logger.debug(`🍾 缩放等级 ${zoom.toFixed(2)} 超出可见范围 [${DRIFT_BOTTLE_CONFIG.MIN_ZOOM_LEVEL}-${DRIFT_BOTTLE_CONFIG.MAX_ZOOM_LEVEL}]，隐藏漂流瓶`);
    } else {
      // 在范围内，重新渲染（会自动应用新大小）
      this.render();
      logger.debug(`🍾 缩放等级 ${zoom.toFixed(2)} 在可见范围内，重新渲染漂流瓶`);
    }
  }

  /**
   * 计算漂流瓶标记大小 - 根据zoom级别动态缩放
   * 算法参考像素emoji的getEmojiSize逻辑
   */
  private getBottleSize(): { container: number; icon: number; badge: number } {
    const zoom = this.map ? this.map.getZoom() : 16;

    // 参考像素emoji的算法：
    // emoji大小 = 0.0001度 * (256 * 2^zoom / 360) * 0.85
    //
    // 漂流瓶大小应该略大于像素emoji，使用类似的缩放算法
    // 基础大小在zoom 16时约为48px

    const pixelsPerDegree = (256 * Math.pow(2, zoom)) / 360;
    const baseGridSize = 0.0001; // 与像素格子相同
    const gridScreenSize = baseGridSize * pixelsPerDegree;

    // 漂流瓶容器大小约为格子屏幕大小的4倍（确保明显可见）
    // 最小值24px确保可见性，最大值64px防止过大
    const containerSize = Math.min(64, Math.max(24, Math.round(gridScreenSize * 4)));

    // 图标大小约为容器的50%
    const iconSize = Math.round(containerSize * 0.5);

    // 徽章大小约为容器的30%
    const badgeSize = Math.max(12, Math.round(containerSize * 0.3));

    logger.debug(`🍾 计算漂流瓶大小: zoom=${zoom.toFixed(2)}, 格子屏幕=${gridScreenSize.toFixed(1)}px, 容器=${containerSize}px, 图标=${iconSize}px`);

    return {
      container: containerSize,
      icon: iconSize,
      badge: badgeSize
    };
  }

  /**
   * 计算聚合标记大小
   */
  private getClusterSize(): { container: number; icon: number } {
    const baseSize = this.getBottleSize();

    // 聚合标记比单个标记大20%
    return {
      container: Math.round(baseSize.container * 1.2),
      icon: Math.round(baseSize.icon * 1.2)
    };
  }

  /**
   * 更新漂流瓶列表
   */
  updateBottles(bottles: DriftBottle[]): void {
    const startTime = performance.now();

    // 更新瓶子数据
    this.bottles.clear();
    bottles.forEach(bottle => {
      this.bottles.set(bottle.bottle_id, bottle);
    });

    this.stats.totalBottles = bottles.length;

    // 重新渲染
    this.render();

    this.stats.renderTime = performance.now() - startTime;

    logger.debug(`🍾 漂流瓶图层更新完成`, {
      total: this.stats.totalBottles,
      visible: this.stats.visibleBottles,
      renderTime: `${this.stats.renderTime.toFixed(2)}ms`
    });
  }

  /**
   * 渲染漂流瓶标记
   */
  private render(): void {
    // 清除现有标记
    this.clearMarkers();

    const bottles = Array.from(this.bottles.values());

    if (bottles.length === 0) {
      return;
    }

    // 检查缩放等级
    const zoom = this.map?.getZoom();
    if (!zoom || zoom < DRIFT_BOTTLE_CONFIG.MIN_ZOOM_LEVEL || zoom > DRIFT_BOTTLE_CONFIG.MAX_ZOOM_LEVEL) {
      logger.debug(`🍾 当前缩放等级 ${zoom?.toFixed(2) || 'unknown'} 不在可见范围 [${DRIFT_BOTTLE_CONFIG.MIN_ZOOM_LEVEL}-${DRIFT_BOTTLE_CONFIG.MAX_ZOOM_LEVEL}]，跳过渲染`);
      return;
    }

    // 获取视口范围
    const visibleBottles = this.getVisibleBottles(bottles);
    this.stats.visibleBottles = visibleBottles.length;

    // 限制数量
    const bottlesToRender = visibleBottles.slice(0, this.options.maxMarkersInViewport);

    // 是否启用聚合
    if (this.options.enableClustering && bottlesToRender.length > 20) {
      this.renderWithClustering(bottlesToRender);
    } else {
      this.renderIndividualMarkers(bottlesToRender);
    }
  }

  /**
   * 获取视口内可见的瓶子
   */
  private getVisibleBottles(bottles: DriftBottle[]): DriftBottle[] {
    if (!this.map) return bottles;

    try {
      const bounds = this.map.getBounds();
      if (!bounds) return bottles;

      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();

      return bottles.filter(bottle => {
        return bottle.current_lat >= sw.lat &&
               bottle.current_lat <= ne.lat &&
               bottle.current_lng >= sw.lng &&
               bottle.current_lng <= ne.lng;
      });
    } catch (error) {
      logger.warn('获取视口边界失败，渲染所有瓶子', error);
      return bottles;
    }
  }

  /**
   * 渲染独立标记
   */
  private renderIndividualMarkers(bottles: DriftBottle[]): void {
    bottles.forEach(bottle => {
      const marker = this.createBottleMarker(bottle);
      if (marker) {
        this.markers.set(bottle.bottle_id, marker);
      }
    });
  }

  /**
   * 使用聚合渲染
   */
  private renderWithClustering(bottles: DriftBottle[]): void {
    const clusters = this.clusterBottles(bottles);
    this.stats.clusteredBottles = 0;

    clusters.forEach((cluster, index) => {
      if (cluster.count === 1) {
        // 单个瓶子，渲染普通标记
        const bottle = cluster.bottles[0];
        const marker = this.createBottleMarker(bottle);
        if (marker) {
          this.markers.set(bottle.bottle_id, marker);
        }
      } else {
        // 多个瓶子，渲染聚合标记
        const clusterMarker = this.createClusterMarker(cluster, index);
        if (clusterMarker) {
          this.clusterMarkers.set(`cluster_${index}`, clusterMarker);
          this.stats.clusteredBottles += cluster.count;
        }
      }
    });
  }

  /**
   * 聚合算法（简单的网格聚合）
   */
  private clusterBottles(bottles: DriftBottle[]): BottleCluster[] {
    const clusters: BottleCluster[] = [];
    const processed = new Set<string>();
    const radiusInDegrees = this.pixelsToLatLng(this.options.clusterRadius);

    bottles.forEach(bottle => {
      if (processed.has(bottle.bottle_id)) return;

      // 查找附近的瓶子
      const nearby = bottles.filter(b => {
        if (processed.has(b.bottle_id)) return false;

        const distance = this.calculateDistance(
          bottle.current_lat,
          bottle.current_lng,
          b.current_lat,
          b.current_lng
        );

        return distance <= radiusInDegrees;
      });

      // 创建聚合
      const cluster: BottleCluster = {
        center: {
          lat: nearby.reduce((sum, b) => sum + b.current_lat, 0) / nearby.length,
          lng: nearby.reduce((sum, b) => sum + b.current_lng, 0) / nearby.length
        },
        bottles: nearby,
        count: nearby.length
      };

      clusters.push(cluster);
      nearby.forEach(b => processed.add(b.bottle_id));
    });

    return clusters;
  }

  /**
   * 创建单个漂流瓶标记
   */
  private createBottleMarker(bottle: DriftBottle): any {
    const content = this.createBottleMarkerHTML(bottle);
    const size = this.getBottleSize();

    try {
      const marker = new this.AMap.Marker({
        position: [bottle.current_lng, bottle.current_lat],
        map: this.map,
        content: content,
        offset: new this.AMap.Pixel(-size.container / 2, -size.container / 2),
        zIndex: DRIFT_BOTTLE_CONFIG.MARKER_ZINDEX,
        title: `漂流瓶 ${bottle.bottle_id}`,
        extData: { bottleId: bottle.bottle_id, bottle, type: 'single' }
      });

      // 绑定事件
      marker.on('click', (e: any) => {
        this.options.onClick?.(bottle);

        // 处理点击信息窗口
        if (this.options.enableInfoWindow) {
          this.showClickInfoWindow(bottle, e);
        }
      });

      marker.on('mouseover', (e: any) => {
        this.options.onHover?.(bottle);

        // 处理悬停信息窗口
        if (this.options.enableInfoWindow) {
          this.showHoverInfoWindow(bottle, e);
        }
      });

      marker.on('mouseout', () => {
        this.options.onHover?.(null);

        // 隐藏悬停信息窗口
        this.hideHoverInfoWindow();
      });

      return marker;
    } catch (error) {
      logger.error('创建漂流瓶标记失败', error);
      return null;
    }
  }

  /**
   * 创建聚合标记
   */
  private createClusterMarker(cluster: BottleCluster, index: number): any {
    const content = this.createClusterMarkerHTML(cluster);
    const size = this.getClusterSize();

    try {
      const marker = new this.AMap.Marker({
        position: [cluster.center.lng, cluster.center.lat],
        map: this.map,
        content: content,
        offset: new this.AMap.Pixel(-size.container / 2, -size.container / 2),
        zIndex: DRIFT_BOTTLE_CONFIG.CLUSTER_ZINDEX,
        title: `${cluster.count} 个漂流瓶`,
        extData: { cluster, type: 'cluster' }
      });

      // 点击聚合标记时放大地图
      marker.on('click', () => {
        this.map.setZoomAndCenter(
          this.map.getZoom() + 2,
          [cluster.center.lng, cluster.center.lat]
        );
      });

      return marker;
    } catch (error) {
      logger.error('创建聚合标记失败', error);
      return null;
    }
  }

  /**
   * 创建漂流瓶标记HTML
   */
  private createBottleMarkerHTML(bottle: DriftBottle): string {
    const animationClass = this.options.enableAnimation ? 'drift-bottle-animated' : '';
    const size = this.getBottleSize();

    // 背景圈大小约为容器的85%
    const bgSize = Math.round(size.container * 0.85);
    // 边框宽度根据大小动态调整
    const borderWidth = Math.max(2, Math.round(size.container * 0.06));

    return `
      <div class="drift-bottle-marker ${animationClass}" style="
        position: relative;
        width: ${size.container}px;
        height: ${size.container}px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        filter: drop-shadow(0 ${Math.round(size.container * 0.08)}px ${Math.round(size.container * 0.17)}px rgba(0,0,0,0.3));
      ">
        <!-- 背景光晕 -->
        <div style="
          position: absolute;
          width: ${bgSize}px;
          height: ${bgSize}px;
          background: linear-gradient(135deg, #3B82F6, #60A5FA);
          border-radius: 50%;
          border: ${borderWidth}px solid white;
          box-shadow: 0 0 ${Math.round(size.container * 0.4)}px rgba(59, 130, 246, 0.6);
        "></div>

        <!-- 瓶子图标 -->
        <div style="
          position: relative;
          font-size: ${size.icon}px;
          z-index: 2;
        ">🍾</div>

        <!-- 新消息徽章 -->
        ${bottle.message_count > 0 ? `
          <div style="
            position: absolute;
            top: -2px;
            right: -2px;
            width: ${size.badge}px;
            height: ${size.badge}px;
            background: #EF4444;
            border-radius: 50%;
            border: 2px solid white;
            font-size: ${Math.max(9, Math.round(size.badge * 0.6))}px;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          ">${bottle.message_count}</div>
        ` : ''}
      </div>
    `;
  }

  /**
   * 创建聚合标记HTML
   */
  private createClusterMarkerHTML(cluster: BottleCluster): string {
    const size = this.getClusterSize();
    const borderWidth = Math.max(3, Math.round(size.container * 0.07));

    return `
      <div style="
        position: relative;
        width: ${size.container}px;
        height: ${size.container}px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        filter: drop-shadow(0 ${Math.round(size.container * 0.07)}px ${Math.round(size.container * 0.2)}px rgba(0,0,0,0.4));
      ">
        <!-- 外圈 -->
        <div style="
          position: absolute;
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, #8B5CF6, #A78BFA);
          border-radius: 50%;
          border: ${borderWidth}px solid white;
          box-shadow: 0 0 ${Math.round(size.container * 0.5)}px rgba(139, 92, 246, 0.7);
        "></div>

        <!-- 内容 -->
        <div style="
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        ">
          <div style="font-size: ${size.icon}px;">🍾</div>
          <div style="
            font-size: ${Math.max(10, Math.round(size.icon * 0.7))}px;
            font-weight: bold;
            color: white;
            margin-top: ${Math.round(size.container * -0.07)}px;
          ">${cluster.count}</div>
        </div>
      </div>
    `;
  }

  /**
   * 清除所有标记
   */
  private clearMarkers(): void {
    // 清除信息窗口
    this.clearInfoWindows();

    // 清除普通标记
    this.markers.forEach(marker => {
      if (this.map && marker) {
        this.map.remove(marker);
      }
    });
    this.markers.clear();

    // 清除聚合标记
    this.clusterMarkers.forEach(marker => {
      if (this.map && marker) {
        this.map.remove(marker);
      }
    });
    this.clusterMarkers.clear();
  }

  /**
   * 移除指定瓶子的标记
   */
  removeBottle(bottleId: string): void {
    // 从数据中移除
    this.bottles.delete(bottleId);

    // 从地图中移除标记
    const marker = this.markers.get(bottleId);
    if (marker && this.map) {
      this.map.remove(marker);
      this.markers.delete(bottleId);
    }

    logger.debug(`🍾 已移除漂流瓶标记: ${bottleId}`);
  }

  /**
   * 添加单个瓶子
   */
  addBottle(bottle: DriftBottle): void {
    this.bottles.set(bottle.bottle_id, bottle);

    // 如果在视口内，立即渲染
    const visible = this.getVisibleBottles([bottle]);
    if (visible.length > 0) {
      const marker = this.createBottleMarker(bottle);
      if (marker) {
        this.markers.set(bottle.bottle_id, marker);
      }
    }
  }

  /**
   * 监听地图视口变化（节流）
   */
  onViewportChange(): void {
    if (this.updateThrottleTimer) {
      clearTimeout(this.updateThrottleTimer);
    }

    this.updateThrottleTimer = setTimeout(() => {
      this.render();
    }, 300); // 300ms节流
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    this.clearMarkers();

    if (this.updateThrottleTimer) {
      clearTimeout(this.updateThrottleTimer);
    }

    this.bottles.clear();
    this.clearInfoWindows();
    this.infoWindowContainer = null;
    this.map = null;
    this.AMap = null;

    logger.info('🍾 漂流瓶图层管理器已销毁');
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * 辅助方法：计算两点距离（度数）
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const dLat = lat2 - lat1;
    const dLng = lng2 - lng1;
    return Math.sqrt(dLat * dLat + dLng * dLng);
  }

  /**
   * 辅助方法：像素转经纬度距离
   */
  private pixelsToLatLng(pixels: number): number {
    if (!this.map) return 0.001;

    try {
      const zoom = this.map.getZoom();
      // 简化计算：每个缩放级别的像素对应的度数
      const degreesPerPixel = 360 / (256 * Math.pow(2, zoom));
      return pixels * degreesPerPixel;
    } catch (error) {
      return 0.001;
    }
  }

  /**
   * 显示悬停信息窗口
   */
  private showHoverInfoWindow(bottle: DriftBottle, event: any): void {
    if (!this.infoWindowContainer) return;

    // 清除之前的悬停窗口
    this.hideHoverInfoWindow();

    this.currentHoverBottle = bottle;

    // 获取鼠标位置
    const clientX = event.originalEvent?.clientX || event.clientX || 0;
    const clientY = event.originalEvent?.clientY || event.clientY || 0;

    // 创建信息窗口
    this.hoverInfoWindow = document.createElement('div');
    this.hoverInfoWindow.style.position = 'fixed';
    this.hoverInfoWindow.style.left = `${clientX + 10}px`;
    this.hoverInfoWindow.style.top = `${clientY - 10}px`;
    this.hoverInfoWindow.style.zIndex = '210'; // 🔥 优化：使用标准z-index规范，漂流瓶悬停信息
    this.hoverInfoWindow.style.pointerEvents = 'auto';

    this.infoWindowContainer.appendChild(this.hoverInfoWindow);

    // 使用React渲染信息窗口内容
    import('react').then(React => {
      import('react-dom/client').then(ReactDOM => {
        const root = ReactDOM.createRoot(this.hoverInfoWindow);
        root.render(React.createElement(MapMarkerInfo, {
          type: 'drift-bottle',
          position: { lat: bottle.current_lat, lng: bottle.current_lng },
          title: `漂流瓶 ${bottle.bottle_id.slice(0, 8)}...`,
          itemId: bottle.bottle_id,
          bottleInfo: {
            pickupCount: bottle.pickup_count,
            totalDistance: bottle.total_distance,
            messageCount: bottle.message_count,
            currentCity: bottle.current_city,
            currentCountry: bottle.current_country,
            originCity: bottle.origin_city,
            originCountry: bottle.origin_country,
            createdAt: bottle.created_at
          },
          isVisible: true,
          anchorPoint: { x: clientX + 10, y: clientY - 10 },
          mode: 'hover',
          onClose: () => {
            this.hideHoverInfoWindow();
          }
        }));
      });
    });
  }

  /**
   * 隐藏悬停信息窗口
   */
  private hideHoverInfoWindow(): void {
    if (this.hoverInfoWindow && this.infoWindowContainer) {
      this.infoWindowContainer.removeChild(this.hoverInfoWindow);
      this.hoverInfoWindow = null;
    }
    this.currentHoverBottle = null;
  }

  /**
   * 显示点击信息窗口
   */
  private showClickInfoWindow(bottle: DriftBottle, event: any): void {
    if (!this.infoWindowContainer) return;

    // 关闭之前的点击窗口
    this.hideClickInfoWindow();

    this.currentClickBottle = bottle;

    // 获取点击位置
    const clientX = event.originalEvent?.clientX || event.clientX || 0;
    const clientY = event.originalEvent?.clientY || event.clientY || 0;

    // 创建信息窗口
    this.clickInfoWindow = document.createElement('div');
    this.clickInfoWindow.style.position = 'fixed';
    this.clickInfoWindow.style.left = `${clientX}px`;
    this.clickInfoWindow.style.top = `${clientY}px`;
    this.clickInfoWindow.style.zIndex = '220'; // 🔥 优化：使用标准z-index规范，漂流瓶点击信息
    this.clickInfoWindow.style.pointerEvents = 'auto';

    this.infoWindowContainer.appendChild(this.clickInfoWindow);

    // 使用React渲染信息窗口内容
    import('react').then(React => {
      import('react-dom/client').then(ReactDOM => {
        const root = ReactDOM.createRoot(this.clickInfoWindow);
        root.render(React.createElement(MapMarkerInfo, {
          type: 'drift-bottle',
          position: { lat: bottle.current_lat, lng: bottle.current_lng },
          title: `漂流瓶 ${bottle.bottle_id.slice(0, 8)}...`,
          itemId: bottle.bottle_id,
          bottleInfo: {
            pickupCount: bottle.pickup_count,
            totalDistance: bottle.total_distance,
            messageCount: bottle.message_count,
            currentCity: bottle.current_city,
            currentCountry: bottle.current_country,
            originCity: bottle.origin_city,
            originCountry: bottle.origin_country,
            createdAt: bottle.created_at
          },
          isVisible: true,
          anchorPoint: { x: clientX, y: clientY },
          mode: 'click',
          onClose: () => {
            this.hideClickInfoWindow();
          }
        }));
      });
    });
  }

  /**
   * 隐藏点击信息窗口
   */
  private hideClickInfoWindow(): void {
    if (this.clickInfoWindow && this.infoWindowContainer) {
      this.infoWindowContainer.removeChild(this.clickInfoWindow);
      this.clickInfoWindow = null;
    }
    this.currentClickBottle = null;
  }

  /**
   * 清除所有信息窗口
   */
  private clearInfoWindows(): void {
    this.hideHoverInfoWindow();
    this.hideClickInfoWindow();
  }
}
