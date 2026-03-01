/**
 * QR宝藏图层管理器
 *
 * 功能：
 * - 高性能渲染QR宝藏标记
 * - 支持固定和移动宝藏类型
 * - 显示移动宝藏的首次藏宝位置
 * - 智能加载和卸载（视口范围内）
 * - 完美兼容像素格子渲染
 * - 支持宝藏轨迹显示
 *
 * 架构设计：
 * - 使用独立图层（zIndex: 1450，略低于漂流瓶）
 * - 支持标记池复用，减少DOM操作
 * - 实现视口剔除，只渲染可见区域
 * - 提供事件回调接口
 */

import { logger } from '../utils/logger';
import QRTreasureMapService, { QRTreasure } from './qrTreasureMapService';
import { MapMarkerInfo } from '../components/map/MapMarkerInfo';

export interface QRTreasureMarkerOptions {
  onClick?: (treasure: QRTreasure) => void;
  onHover?: (treasure: QRTreasure | null) => void;
  onFirstHideClick?: (treasure: QRTreasure) => void;
  enableClustering?: boolean;
  clusterRadius?: number;
  maxMarkersInViewport?: number;
  enableAnimation?: boolean;
  showFirstHideLocations?: boolean; // 是否显示移动宝藏的首次藏宝位置
  treasureTypes?: ('fixed' | 'mobile')[];
  enableInfoWindow?: boolean; // 是否启用信息窗口
  infoWindowContainer?: HTMLElement; // 信息窗口容器
}

export interface TreasureCluster {
  center: { lat: number; lng: number };
  treasures: QRTreasure[];
  count: number;
}

/**
 * QR宝藏图层管理器
 */
export class QRTreasureLayerManager {
  private map: any = null;
  private AMap: any = null;

  // 标记管理
  private markers: Map<string, any> = new Map();
  private clusterMarkers: Map<string, any> = new Map();
  private firstHideMarkers: Map<string, any> = new Map(); // 首次藏宝位置标记
  private treasures: Map<string, QRTreasure> = new Map();

  // 信息窗口管理
  private infoWindowContainer: HTMLElement | null = null;
  private hoverInfoWindow: any = null;
  private clickInfoWindow: any = null;
  private currentHoverTreasure: QRTreasure | null = null;
  private currentClickTreasure: QRTreasure | null = null;

  // 配置
  private options: Required<QRTreasureMarkerOptions>;

  // 性能统计
  private stats = {
    totalTreasures: 0,
    visibleTreasures: 0,
    clusteredTreasures: 0,
    firstHideLocations: 0,
    renderTime: 0
  };

  // 视口边界缓存
  private lastViewportBounds: any = null;
  private updateThrottleTimer: NodeJS.Timeout | null = null;

  // 宝藏标记配置
  private static readonly TREASURE_CONFIG = {
    MIN_ZOOM_LEVEL: 12, // 🔧 修复：与像素格子渲染逻辑保持一致，12-20级显示
    MAX_ZOOM_LEVEL: 20,
    MARKER_ZINDEX: 1450,
    CLUSTER_ZINDEX: 1455,
    FIRST_HIDE_ZINDEX: 1445, // 略低于当前位置
    MOBILE_COLOR: '#10B981', // 绿色表示移动宝藏
    FIXED_COLOR: '#F59E0B',  // 琥珀色表示固定宝藏
    FIRST_HIDE_COLOR: '#6B7280' // 灰色表示首次藏宝位置
  };

  constructor(map: any, AMap: any, options: QRTreasureMarkerOptions = {}) {
    this.map = map;
    this.AMap = AMap;

    // 默认配置
    this.options = {
      onClick: options.onClick || (() => {}),
      onHover: options.onHover || (() => {}),
      onFirstHideClick: options.onFirstHideClick || (() => {}),
      enableClustering: options.enableClustering !== undefined ? options.enableClustering : true,
      clusterRadius: options.clusterRadius || 60,
      maxMarkersInViewport: options.maxMarkersInViewport || 80,
      enableAnimation: options.enableAnimation !== undefined ? options.enableAnimation : true,
      showFirstHideLocations: options.showFirstHideLocations !== undefined ? options.showFirstHideLocations : true,
      treasureTypes: options.treasureTypes || ['fixed', 'mobile'],
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

    logger.info('💎 QR宝藏图层管理器已初始化', this.options);
  }

  /**
   * 处理地图缩放变化
   */
  private handleZoomChange(): void {
    const zoom = this.map?.getZoom();
    if (!zoom) return;

    if (zoom < QRTreasureLayerManager.TREASURE_CONFIG.MIN_ZOOM_LEVEL ||
        zoom > QRTreasureLayerManager.TREASURE_CONFIG.MAX_ZOOM_LEVEL) {
      this.clearMarkers();
      logger.debug(`💎 缩放等级 ${zoom.toFixed(2)} 超出可见范围，隐藏QR宝藏`);
    } else {
      this.render();
      logger.debug(`💎 缩放等级 ${zoom.toFixed(2)} 在可见范围内，重新渲染QR宝藏`);
    }
  }

  /**
   * 计算宝藏标记大小
   */
  private getTreasureSize(): { container: number; icon: number; badge: number } {
    const zoom = this.map ? this.map.getZoom() : 16;

    const pixelsPerDegree = (256 * Math.pow(2, zoom)) / 360;
    const baseGridSize = 0.0001;
    const gridScreenSize = baseGridSize * pixelsPerDegree;

    // 宝藏容器大小约为格子屏幕大小的3.5倍
    const containerSize = Math.min(56, Math.max(20, Math.round(gridScreenSize * 3.5)));
    const iconSize = Math.round(containerSize * 0.6);
    const badgeSize = Math.max(10, Math.round(containerSize * 0.35));

    return {
      container: containerSize,
      icon: iconSize,
      badge: badgeSize
    };
  }

  /**
   * 更新宝藏列表
   */
  updateTreasures(treasures: QRTreasure[]): void {
    const startTime = performance.now();

    logger.debug(`💎 更新宝藏数据，接收到 ${treasures.length} 个宝藏`);

    // 更新宝藏数据（过滤指定类型）
    this.treasures.clear();
    treasures.forEach(treasure => {
      logger.debug(`💎 处理宝藏: ${treasure.treasure_id}, 类型: ${treasure.treasure_type}, 位置: (${treasure.hide_lat}, ${treasure.hide_lng})`);
      if (this.options.treasureTypes.includes(treasure.treasure_type)) {
        this.treasures.set(treasure.treasure_id, treasure);
      } else {
        logger.debug(`💎 宝藏类型不匹配，跳过: ${treasure.treasure_type}, 允许的类型: ${this.options.treasureTypes}`);
      }
    });

    this.stats.totalTreasures = this.treasures.size;
    logger.debug(`💎 过滤后剩余 ${this.stats.totalTreasures} 个宝藏`);

    // 重新渲染
    this.render();

    this.stats.renderTime = performance.now() - startTime;

    logger.debug(`💎 QR宝藏图层更新完成`, {
      total: this.stats.totalTreasures,
      visible: this.stats.visibleTreasures,
      firstHide: this.stats.firstHideLocations,
      renderTime: `${this.stats.renderTime.toFixed(2)}ms`
    });
  }

  /**
   * 渲染宝藏标记
   */
  private render(): void {
    this.clearMarkers();

    const treasures = Array.from(this.treasures.values());
    if (treasures.length === 0) {
      logger.debug('💎 没有宝藏数据可渲染');
      return;
    }

    // 检查缩放等级
    const zoom = this.map?.getZoom();
    logger.debug(`💎 当前地图缩放级别: ${zoom}, 最小要求: ${QRTreasureLayerManager.TREASURE_CONFIG.MIN_ZOOM_LEVEL}`);

    if (!zoom || zoom < QRTreasureLayerManager.TREASURE_CONFIG.MIN_ZOOM_LEVEL ||
        zoom > QRTreasureLayerManager.TREASURE_CONFIG.MAX_ZOOM_LEVEL) {
      logger.debug(`💎 缩放级别不符合要求，跳过渲染。当前: ${zoom}, 要求: ${QRTreasureLayerManager.TREASURE_CONFIG.MIN_ZOOM_LEVEL}-${QRTreasureLayerManager.TREASURE_CONFIG.MAX_ZOOM_LEVEL}`);
      return;
    }

    // 获取视口范围内的宝藏
    const visibleTreasures = this.getVisibleTreasures(treasures);
    this.stats.visibleTreasures = visibleTreasures.length;

    // 限制数量
    const treasuresToRender = visibleTreasures.slice(0, this.options.maxMarkersInViewport);

    // 渲染当前位置
    if (this.options.enableClustering && treasuresToRender.length > 15) {
      this.renderWithClustering(treasuresToRender);
    } else {
      this.renderIndividualMarkers(treasuresToRender);
    }

    // 渲染首次藏宝位置（如果启用）
    if (this.options.showFirstHideLocations) {
      this.renderFirstHideLocations(treasuresToRender);
    }
  }

  /**
   * 获取视口内可见的宝藏
   */
  private getVisibleTreasures(treasures: QRTreasure[]): QRTreasure[] {
    if (!this.map) return treasures;

    try {
      const bounds = this.map.getBounds();
      if (!bounds) return treasures;

      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();

      return treasures.filter(treasure => {
        return treasure.hide_lat >= sw.lat &&
               treasure.hide_lat <= ne.lat &&
               treasure.hide_lng >= sw.lng &&
               treasure.hide_lng <= ne.lng;
      });
    } catch (error) {
      logger.warn('获取视口边界失败，渲染所有宝藏', error);
      return treasures;
    }
  }

  /**
   * 渲染独立标记
   */
  private renderIndividualMarkers(treasures: QRTreasure[]): void {
    treasures.forEach(treasure => {
      const marker = this.createTreasureMarker(treasure);
      if (marker) {
        this.markers.set(treasure.treasure_id, marker);
      }
    });
  }

  /**
   * 使用聚合渲染
   */
  private renderWithClustering(treasures: QRTreasure[]): void {
    const clusters = this.clusterTreasures(treasures);
    this.stats.clusteredTreasures = 0;

    clusters.forEach((cluster, index) => {
      if (cluster.count === 1) {
        const treasure = cluster.treasures[0];
        const marker = this.createTreasureMarker(treasure);
        if (marker) {
          this.markers.set(treasure.treasure_id, marker);
        }
      } else {
        const clusterMarker = this.createClusterMarker(cluster, index);
        if (clusterMarker) {
          this.clusterMarkers.set(`cluster_${index}`, clusterMarker);
          this.stats.clusteredTreasures += cluster.count;
        }
      }
    });
  }

  /**
   * 渲染首次藏宝位置
   */
  private renderFirstHideLocations(treasures: QRTreasure[]): void {
    this.stats.firstHideLocations = 0;

    treasures.forEach(treasure => {
      // 只为移动宝藏且位置有变化的宝藏显示首次藏宝点
      if (treasure.treasure_type === 'mobile' &&
          treasure.first_hide_lat &&
          treasure.first_hide_lng &&
          (treasure.first_hide_lat !== treasure.hide_lat ||
           treasure.first_hide_lng !== treasure.hide_lng)) {

        const marker = this.createFirstHideMarker(treasure);
        if (marker) {
          this.firstHideMarkers.set(`${treasure.treasure_id}_first`, marker);
          this.stats.firstHideLocations++;
        }
      }
    });
  }

  /**
   * 聚合算法
   */
  private clusterTreasures(treasures: QRTreasure[]): TreasureCluster[] {
    const clusters: TreasureCluster[] = [];
    const processed = new Set<string>();
    const radiusInDegrees = this.pixelsToLatLng(this.options.clusterRadius);

    treasures.forEach(treasure => {
      if (processed.has(treasure.treasure_id)) return;

      const nearby = treasures.filter(t => {
        if (processed.has(t.treasure_id)) return false;

        const distance = this.calculateDistance(
          treasure.hide_lat,
          treasure.hide_lng,
          t.hide_lat,
          t.hide_lng
        );

        return distance <= radiusInDegrees;
      });

      const cluster: TreasureCluster = {
        center: {
          lat: nearby.reduce((sum, t) => sum + t.hide_lat, 0) / nearby.length,
          lng: nearby.reduce((sum, t) => sum + t.hide_lng, 0) / nearby.length
        },
        treasures: nearby,
        count: nearby.length
      };

      clusters.push(cluster);
      nearby.forEach(t => processed.add(t.treasure_id));
    });

    return clusters;
  }

  /**
   * 创建单个宝藏标记
   */
  private createTreasureMarker(treasure: QRTreasure): any {
    const content = this.createTreasureMarkerHTML(treasure);
    const size = this.getTreasureSize();

    try {
      const marker = new this.AMap.Marker({
        position: [treasure.hide_lng, treasure.hide_lat],
        map: this.map,
        content: content,
        offset: new this.AMap.Pixel(-size.container / 2, -size.container / 2),
        zIndex: QRTreasureLayerManager.TREASURE_CONFIG.MARKER_ZINDEX,
        title: `${this.getTreasureTypeText(treasure)} - ${treasure.title}`,
        extData: { treasureId: treasure.treasure_id, treasure, type: 'single' }
      });

      // 绑定事件
      marker.on('click', (e: any) => {
        this.options.onClick?.(treasure);

        // 处理点击信息窗口
        if (this.options.enableInfoWindow) {
          this.showClickInfoWindow(treasure, e);
        }
      });

      marker.on('mouseover', (e: any) => {
        this.options.onHover?.(treasure);

        // 处理悬停信息窗口
        if (this.options.enableInfoWindow) {
          this.showHoverInfoWindow(treasure, e);
        }
      });

      marker.on('mouseout', () => {
        this.options.onHover?.(null);

        // 隐藏悬停信息窗口
        this.hideHoverInfoWindow();
      });

      return marker;
    } catch (error) {
      logger.error('创建宝藏标记失败', error);
      return null;
    }
  }

  /**
   * 创建聚合标记
   */
  private createClusterMarker(cluster: TreasureCluster, index: number): any {
    const content = this.createClusterMarkerHTML(cluster);
    const size = this.getTreasureSize();

    try {
      const marker = new this.AMap.Marker({
        position: [cluster.center.lng, cluster.center.lat],
        map: this.map,
        content: content,
        offset: new this.AMap.Pixel(-size.container / 2, -size.container / 2),
        zIndex: QRTreasureLayerManager.TREASURE_CONFIG.CLUSTER_ZINDEX,
        title: `${cluster.count} 个宝藏`,
        extData: { cluster, type: 'cluster' }
      });

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
   * 创建首次藏宝位置标记
   */
  private createFirstHideMarker(treasure: QRTreasure): any {
    const content = this.createFirstHideMarkerHTML(treasure);
    const size = this.getTreasureSize();

    try {
      const marker = new this.AMap.Marker({
        position: [treasure.first_hide_lng, treasure.first_hide_lat],
        map: this.map,
        content: content,
        offset: new this.AMap.Pixel(-size.container / 2, -size.container / 2),
        zIndex: QRTreasureLayerManager.TREASURE_CONFIG.FIRST_HIDE_ZINDEX,
        title: `首次藏宝位置 - ${treasure.title}`,
        extData: { treasureId: treasure.treasure_id, treasure, type: 'first_hide' }
      });

      marker.on('click', () => {
        this.options.onFirstHideClick?.(treasure);
      });

      return marker;
    } catch (error) {
      logger.error('创建首次藏宝位置标记失败', error);
      return null;
    }
  }

  /**
   * 创建宝藏标记HTML
   */
  private createTreasureMarkerHTML(treasure: QRTreasure): string {
    const animationClass = this.options.enableAnimation ? 'treasure-animated' : '';
    const size = this.getTreasureSize();
    const color = treasure.treasure_type === 'mobile' ?
      QRTreasureLayerManager.TREASURE_CONFIG.MOBILE_COLOR :
      QRTreasureLayerManager.TREASURE_CONFIG.FIXED_COLOR;

    const bgSize = Math.round(size.container * 0.85);
    const borderWidth = Math.max(2, Math.round(size.container * 0.06));

    return `
      <div class="treasure-marker ${animationClass}" style="
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
          background: linear-gradient(135deg, ${color}, ${color}DD);
          border-radius: 50%;
          border: ${borderWidth}px solid white;
          box-shadow: 0 0 ${Math.round(size.container * 0.4)}px ${color}66;
        "></div>

        <!-- 宝藏图标 -->
        <div style="
          position: relative;
          font-size: ${size.icon}px;
          z-index: 2;
        ">${treasure.treasure_type === 'mobile' ? '🚲' : '📦'}</div>

        <!-- 移动次数徽章 -->
        ${treasure.treasure_type === 'mobile' && treasure.move_count > 0 ? `
          <div style="
            position: absolute;
            top: -2px;
            right: -2px;
            width: ${size.badge}px;
            height: ${size.badge}px;
            background: ${QRTreasureLayerManager.TREASURE_CONFIG.MOBILE_COLOR};
            border-radius: 50%;
            border: 2px solid white;
            font-size: ${Math.max(8, Math.round(size.badge * 0.6))}px;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          ">${treasure.move_count}</div>
        ` : ''}
      </div>
    `;
  }

  /**
   * 创建聚合标记HTML
   */
  private createClusterMarkerHTML(cluster: TreasureCluster): string {
    const size = this.getTreasureSize();
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
          <div style="font-size: ${size.icon}px;">💎</div>
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
   * 创建首次藏宝位置标记HTML
   */
  private createFirstHideMarkerHTML(treasure: QRTreasure): string {
    const size = this.getTreasureSize();
    const color = QRTreasureLayerManager.TREASURE_CONFIG.FIRST_HIDE_COLOR;

    return `
      <div style="
        position: relative;
        width: ${size.container}px;
        height: ${size.container}px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        opacity: 0.7;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
      ">
        <!-- 背景圈 -->
        <div style="
          position: absolute;
          width: ${Math.round(size.container * 0.7)}px;
          height: ${Math.round(size.container * 0.7)}px;
          background: ${color};
          border-radius: 50%;
          border: 2px solid white;
        "></div>

        <!-- 起始位置图标 -->
        <div style="
          position: relative;
          font-size: ${Math.round(size.icon * 0.7)}px;
          z-index: 2;
        ">📍</div>
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

    // 清除首次藏宝位置标记
    this.firstHideMarkers.forEach(marker => {
      if (this.map && marker) {
        this.map.remove(marker);
      }
    });
    this.firstHideMarkers.clear();
  }

  /**
   * 移除指定宝藏的标记
   */
  removeTreasure(treasureId: string): void {
    this.treasures.delete(treasureId);

    const marker = this.markers.get(treasureId);
    if (marker && this.map) {
      this.map.remove(marker);
      this.markers.delete(treasureId);
    }

    const firstHideMarker = this.firstHideMarkers.get(`${treasureId}_first`);
    if (firstHideMarker && this.map) {
      this.map.remove(firstHideMarker);
      this.firstHideMarkers.delete(`${treasureId}_first`);
    }
  }

  /**
   * 添加单个宝藏
   */
  addTreasure(treasure: QRTreasure): void {
    if (!this.options.treasureTypes.includes(treasure.treasure_type)) {
      return;
    }

    this.treasures.set(treasure.treasure_id, treasure);

    const visible = this.getVisibleTreasures([treasure]);
    if (visible.length > 0) {
      const marker = this.createTreasureMarker(treasure);
      if (marker) {
        this.markers.set(treasure.treasure_id, marker);
      }
    }

    // 渲染首次藏宝位置
    if (this.options.showFirstHideLocations &&
        treasure.treasure_type === 'mobile' &&
        treasure.first_hide_lat &&
        treasure.first_hide_lng &&
        (treasure.first_hide_lat !== treasure.hide_lat ||
         treasure.first_hide_lng !== treasure.hide_lng)) {

      const firstHideMarker = this.createFirstHideMarker(treasure);
      if (firstHideMarker) {
        this.firstHideMarkers.set(`${treasure.treasure_id}_first`, firstHideMarker);
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
    }, 300);
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    this.clearMarkers();

    if (this.updateThrottleTimer) {
      clearTimeout(this.updateThrottleTimer);
    }

    this.treasures.clear();
    this.clearInfoWindows();
    this.infoWindowContainer = null;
    this.map = null;
    this.AMap = null;

    logger.info('💎 QR宝藏图层管理器已销毁');
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * 获取宝藏类型文本
   */
  private getTreasureTypeText(treasure: QRTreasure): string {
    if (treasure.treasure_type === 'mobile') {
      return `移动宝藏 (${treasure.move_count || 0}次移动)`;
    } else {
      return `固定宝藏`;
    }
  }

  /**
   * 辅助方法：计算两点距离
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
      const degreesPerPixel = 360 / (256 * Math.pow(2, zoom));
      return pixels * degreesPerPixel;
    } catch (error) {
      return 0.001;
    }
  }

  /**
   * 显示悬停信息窗口
   */
  private showHoverInfoWindow(treasure: QRTreasure, event: any): void {
    if (!this.infoWindowContainer) return;

    // 清除之前的悬停窗口
    this.hideHoverInfoWindow();

    this.currentHoverTreasure = treasure;

    // 获取鼠标位置
    const clientX = event.originalEvent?.clientX || event.clientX || 0;
    const clientY = event.originalEvent?.clientY || event.clientY || 0;

    // 创建信息窗口
    this.hoverInfoWindow = document.createElement('div');
    this.hoverInfoWindow.style.position = 'fixed';
    this.hoverInfoWindow.style.left = `${clientX + 10}px`;
    this.hoverInfoWindow.style.top = `${clientY - 10}px`;
    this.hoverInfoWindow.style.zIndex = '1000';
    this.hoverInfoWindow.style.pointerEvents = 'auto';

    this.infoWindowContainer.appendChild(this.hoverInfoWindow);

    // 使用React渲染信息窗口内容
    import('react').then(React => {
      import('react-dom/client').then(ReactDOM => {
        const root = ReactDOM.createRoot(this.hoverInfoWindow);
        root.render(React.createElement(MapMarkerInfo, {
          type: 'treasure',
          position: { lat: treasure.hide_lat, lng: treasure.hide_lng },
          title: treasure.title,
          itemId: treasure.treasure_id,
          treasureInfo: {
            treasureType: treasure.treasure_type,
            moveCount: treasure.move_count,
            description: treasure.description,
            hint: treasure.hint,
            rewardValue: treasure.reward_value,
            hiderName: treasure.hider_name,
            hiddenAt: treasure.created_at
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
    this.currentHoverTreasure = null;
  }

  /**
   * 显示点击信息窗口
   */
  private showClickInfoWindow(treasure: QRTreasure, event: any): void {
    if (!this.infoWindowContainer) return;

    // 关闭之前的点击窗口
    this.hideClickInfoWindow();

    this.currentClickTreasure = treasure;

    // 获取点击位置
    const clientX = event.originalEvent?.clientX || event.clientX || 0;
    const clientY = event.originalEvent?.clientY || event.clientY || 0;

    // 创建信息窗口
    this.clickInfoWindow = document.createElement('div');
    this.clickInfoWindow.style.position = 'fixed';
    this.clickInfoWindow.style.left = `${clientX}px`;
    this.clickInfoWindow.style.top = `${clientY}px`;
    this.clickInfoWindow.style.zIndex = '1001';
    this.clickInfoWindow.style.pointerEvents = 'auto';

    this.infoWindowContainer.appendChild(this.clickInfoWindow);

    // 使用React渲染信息窗口内容
    import('react').then(React => {
      import('react-dom/client').then(ReactDOM => {
        const root = ReactDOM.createRoot(this.clickInfoWindow);
        root.render(React.createElement(MapMarkerInfo, {
          type: 'treasure',
          position: { lat: treasure.hide_lat, lng: treasure.hide_lng },
          title: treasure.title,
          itemId: treasure.treasure_id,
          treasureInfo: {
            treasureType: treasure.treasure_type,
            moveCount: treasure.move_count,
            description: treasure.description,
            hint: treasure.hint,
            rewardValue: treasure.reward_value,
            hiderName: treasure.hider_name,
            hiddenAt: treasure.created_at
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
    this.currentClickTreasure = null;
  }

  /**
   * 清除所有信息窗口
   */
  private clearInfoWindows(): void {
    this.hideHoverInfoWindow();
    this.hideClickInfoWindow();
  }
}