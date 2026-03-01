/**
 * 地图移动管理器
 * 统一管理所有地图移动操作，避免setCenter和panTo重复调用
 */

import { logger } from './logger';

interface MoveOptions {
  zoom?: number;
  animate?: boolean;
  duration?: number;
  callback?: () => void;
}

class MapMoveManager {
  private map: any;
  private isMoving: boolean = false;
  private moveQueue: Array<() => void> = [];
  private currentMoveId: number = 0;

  constructor(mapInstance: any) {
    this.map = mapInstance;
  }

  /**
   * 检查地图是否正在移动
   */
  isMapMoving(): boolean {
    return this.isMoving;
  }

  /**
   * 移动到指定位置
   * @param lng 经度
   * @param lat 纬度
   * @param options 移动选项
   */
  async moveTo(lng: number, lat: number, options: MoveOptions = {}): Promise<void> {
    const moveId = ++this.currentMoveId;
    
    return new Promise((resolve, reject) => {
      // 如果地图正在移动，将操作加入队列
      if (this.isMoving) {
        logger.info('🗺️ 地图正在移动中，将操作加入队列');
        this.moveQueue.push(() => this.executeMove(lng, lat, options, moveId, resolve, reject));
        return;
      }

      this.executeMove(lng, lat, options, moveId, resolve, reject);
    });
  }

  /**
   * 执行地图移动
   */
  private async executeMove(
    lng: number, 
    lat: number, 
    options: MoveOptions, 
    moveId: number, 
    resolve: () => void, 
    reject: (error: any) => void
  ): Promise<void> {
    // 检查是否是当前最新的移动操作
    if (moveId !== this.currentMoveId) {
      logger.info('🗺️ 移动操作已过期，跳过执行');
      resolve();
      return;
    }

    // 检查地图实例
    if (!this.map || typeof this.map.setCenter !== 'function') {
      const error = new Error('地图实例无效或未初始化');
      logger.error('❌ 地图移动失败:', error);
      reject(error);
      return;
    }

    // 检查地图是否完全加载
    try {
      const center = this.map.getCenter();
      const zoom = this.map.getZoom();
      if (!center || typeof zoom !== 'number') {
        const error = new Error('地图未完全加载，请稍后重试');
        logger.error('❌ 地图移动失败:', error);
        reject(error);
        return;
      }
    } catch (error) {
      logger.error('❌ 地图状态检查失败:', error);
      reject(new Error('地图状态异常，请稍后重试'));
      return;
    }

    // 验证坐标
    if (typeof lng !== 'number' || typeof lat !== 'number' || 
        isNaN(lng) || isNaN(lat) || 
        lng < -180 || lng > 180 || 
        lat < -90 || lat > 90) {
      const error = new Error(`无效的坐标: (${lng}, ${lat})`);
      logger.error('❌ 地图移动失败:', error);
      reject(error);
      return;
    }

    try {
      this.isMoving = true;
      logger.info(`🗺️ 开始地图移动到: (${lat.toFixed(6)}, ${lng.toFixed(6)})`);

      const duration = options.duration || 1000;
      const shouldAnimate = options.animate !== false;

      // 🔥 MapLibre GL适配：优先使用flyTo实现平滑动画
      if (shouldAnimate && typeof this.map.flyTo === 'function') {
        // MapLibre GL的flyTo方法
        const flyToOptions: any = {
          center: [lng, lat],
          duration: duration,
          essential: true // 确保动画执行
        };

        if (options.zoom && typeof options.zoom === 'number') {
          flyToOptions.zoom = options.zoom;
        }

        // 监听移动完成事件
        const onMoveEnd = () => {
          if (moveId === this.currentMoveId) {
            this.map.off('moveend', onMoveEnd);
            this.isMoving = false;
            logger.info(`✅ 地图移动完成: (${lat.toFixed(6)}, ${lng.toFixed(6)})`);

            if (options.callback && typeof options.callback === 'function') {
              options.callback();
            }

            resolve();
            this.processNextMove();
          }
        };

        this.map.once('moveend', onMoveEnd);
        this.map.flyTo(flyToOptions);

      } else {
        // 降级方案：使用setCenter（同步方式）
        this.map.setCenter([lng, lat]);

        if (options.zoom && typeof options.zoom === 'number') {
          this.map.setZoom(options.zoom);
        }

        // 模拟移动完成
        setTimeout(() => {
          if (moveId === this.currentMoveId) {
            this.isMoving = false;
            logger.info(`✅ 地图移动完成: (${lat.toFixed(6)}, ${lng.toFixed(6)})`);

            if (options.callback && typeof options.callback === 'function') {
              options.callback();
            }

            resolve();
            this.processNextMove();
          }
        }, duration);
      }

    } catch (error) {
      this.isMoving = false;
      logger.error('❌ 地图移动失败:', error);
      reject(error);
      this.processNextMove();
    }
  }

  /**
   * 处理队列中的下一个移动操作
   */
  private processNextMove(): void {
    if (this.moveQueue.length > 0) {
      const nextMove = this.moveQueue.shift();
      if (nextMove) {
        logger.info('🗺️ 处理队列中的下一个移动操作');
        nextMove();
      }
    }
  }

  /**
   * 清空移动队列
   */
  clearQueue(): void {
    logger.info(`🗺️ 清空移动队列，共${this.moveQueue.length}个待处理操作`);
    this.moveQueue = [];
  }

  /**
   * 获取队列长度
   */
  getQueueLength(): number {
    return this.moveQueue.length;
  }
}

export default MapMoveManager;
