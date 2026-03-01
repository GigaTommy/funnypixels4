/**
 * GPS模拟器 - 用于开发环境测试GPS绘制功能
 * 模拟真实的GPS定位数据，用于测试GPS绘制模式
 */

import { logger } from './logger';

export interface GPSPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export interface GPSRoute {
  name: string;
  positions: GPSPosition[];
  interval: number; // 毫秒
}

export class GPSSimulator {
  private static instance: GPSSimulator;
  private isSimulating = false;
  private currentRoute: GPSRoute | null = null;
  private currentIndex = 0;
  private intervalId: NodeJS.Timeout | null = null;
  private callbacks: ((position: GPSPosition) => void)[] = [];
  private drawCallbacks: ((result: { success: boolean; position: GPSPosition; error?: string }) => void)[] = [];
  private amapCanvasCallback: ((position: GPSPosition) => void) | null = null;

  private constructor() {}

  static getInstance(): GPSSimulator {
    if (!GPSSimulator.instance) {
      GPSSimulator.instance = new GPSSimulator();
    }
    return GPSSimulator.instance;
  }

  /**
   * 预定义的测试路线
   */
  static getTestRoutes(): GPSRoute[] {
    return [
      {
        name: "北京天安门广场测试路线",
        positions: [
          { latitude: 39.90923, longitude: 116.397428, accuracy: 5, timestamp: Date.now() }, // 天安门
          { latitude: 39.90945, longitude: 116.398200, accuracy: 5, timestamp: Date.now() }, // 向东移动
          { latitude: 39.90980, longitude: 116.399000, accuracy: 5, timestamp: Date.now() }, // 继续向东
          { latitude: 39.91020, longitude: 116.400000, accuracy: 5, timestamp: Date.now() }  // 终点
        ],
        interval: 3000 // 3秒间隔
      },
      {
        name: "上海外滩测试路线",
        positions: [
          { latitude: 31.2397, longitude: 121.4999, accuracy: 5, timestamp: Date.now() },
          { latitude: 31.2400, longitude: 121.5002, accuracy: 5, timestamp: Date.now() },
          { latitude: 31.2403, longitude: 121.5005, accuracy: 5, timestamp: Date.now() },
          { latitude: 31.2406, longitude: 121.5008, accuracy: 5, timestamp: Date.now() },
          { latitude: 31.2409, longitude: 121.5011, accuracy: 5, timestamp: Date.now() },
          { latitude: 31.2412, longitude: 121.5014, accuracy: 5, timestamp: Date.now() },
          { latitude: 31.2415, longitude: 121.5017, accuracy: 5, timestamp: Date.now() },
          { latitude: 31.2418, longitude: 121.5020, accuracy: 5, timestamp: Date.now() }
        ],
        interval: 2000 // 2秒间隔
      },
      {
        name: "深圳福田中心区测试路线",
        positions: [
          { latitude: 22.5431, longitude: 114.0579, accuracy: 5, timestamp: Date.now() },
          { latitude: 22.5434, longitude: 114.0582, accuracy: 5, timestamp: Date.now() },
          { latitude: 22.5437, longitude: 114.0585, accuracy: 5, timestamp: Date.now() },
          { latitude: 22.5440, longitude: 114.0588, accuracy: 5, timestamp: Date.now() },
          { latitude: 22.5443, longitude: 114.0591, accuracy: 5, timestamp: Date.now() },
          { latitude: 22.5446, longitude: 114.0594, accuracy: 5, timestamp: Date.now() }
        ],
        interval: 2500 // 2.5秒间隔
      }
    ];
  }

  /**
   * 开始GPS模拟
   */
  startSimulation(route: GPSRoute): void {
    if (this.isSimulating) {
      this.stopSimulation();
    }

    this.currentRoute = route;
    this.currentIndex = 0;
    this.isSimulating = true;

    logger.info(`🗺️ 开始GPS模拟: ${route.name}`);
    logger.info(`📍 路线包含 ${route.positions.length} 个位置点`);
    logger.info(`⏱️ 更新间隔: ${route.interval}ms`);

    // 立即发送第一个位置
    this.sendCurrentPosition();

    // 设置定时器发送后续位置
    this.intervalId = setInterval(() => {
      this.nextPosition();
    }, route.interval);
  }

  /**
   * 停止GPS模拟
   */
  stopSimulation(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isSimulating = false;
    this.currentRoute = null;
    this.currentIndex = 0;

    // 🔧 清除所有回调，防止残留的位置更新
    logger.info(`🛑 GPS模拟已停止，清除 ${this.callbacks.length} 个位置回调`);
    this.callbacks = [];
    this.drawCallbacks = [];
    this.amapCanvasCallback = null;
  }

  /**
   * 添加位置更新回调
   */
  onPositionUpdate(callback: (position: GPSPosition) => void): void {
    this.callbacks.push(callback);
  }

  /**
   * 移除位置更新回调
   */
  removePositionUpdateCallback(callback: (position: GPSPosition) => void): void {
    const index = this.callbacks.indexOf(callback);
    if (index > -1) {
      this.callbacks.splice(index, 1);
    }
  }

  /**
   * 添加绘制结果回调
   */
  onDrawResult(callback: (result: { success: boolean; position: GPSPosition; error?: string }) => void): void {
    this.drawCallbacks.push(callback);
  }

  /**
   * 移除绘制结果回调
   */
  removeDrawResultCallback(callback: (result: { success: boolean; position: GPSPosition; error?: string }) => void): void {
    const index = this.drawCallbacks.indexOf(callback);
    if (index > -1) {
      this.drawCallbacks.splice(index, 1);
    }
  }

  /**
   * 通知绘制结果
   */
  notifyDrawResult(success: boolean, position: GPSPosition, error?: string): void {
    const result = { success, position, error };
    this.drawCallbacks.forEach(callback => {
      try {
        callback(result);
      } catch (error) {
        logger.error('GPS模拟绘制结果回调执行失败:', error);
      }
    });
  }

  /**
   * 注册AmapCanvas的回调（用于地图跟随和绘制）
   */
  setAmapCanvasCallback(callback: (position: GPSPosition) => void): void {
    this.amapCanvasCallback = callback;
    logger.info('🗺️ GPS模拟器已注册AmapCanvas回调');
  }

  /**
   * 移除AmapCanvas的回调
   */
  removeAmapCanvasCallback(): void {
    this.amapCanvasCallback = null;
    logger.info('🗺️ GPS模拟器已移除AmapCanvas回调');
  }

  /**
   * 发送下一个位置
   */
  private nextPosition(): void {
    if (!this.currentRoute) return;

    this.currentIndex++;
    if (this.currentIndex >= this.currentRoute.positions.length) {
      // 路线完成，重新开始
      this.currentIndex = 0;
      logger.info('🔄 GPS模拟路线完成，重新开始');
    }

    this.sendCurrentPosition();
  }

  /**
   * 发送当前位置
   */
  private sendCurrentPosition(): void {
    if (!this.currentRoute) return;

    const position = this.currentRoute.positions[this.currentIndex];
    const currentPosition = {
      ...position,
      timestamp: Date.now()
    };

    logger.info(`📍 GPS模拟位置 ${this.currentIndex + 1}/${this.currentRoute.positions.length}:`, {
      lat: currentPosition.latitude.toFixed(6),
      lng: currentPosition.longitude.toFixed(6),
      accuracy: currentPosition.accuracy
    });

    // 通知所有回调
    this.callbacks.forEach(callback => {
      try {
        callback(currentPosition);
      } catch (error) {
        logger.error('GPS模拟回调执行失败:', error);
      }
    });

    // 通知AmapCanvas回调（用于地图跟随和绘制）
    if (this.amapCanvasCallback) {
      try {
        logger.info('🗺️ GPS模拟器通知AmapCanvas:', currentPosition);
        this.amapCanvasCallback(currentPosition);
      } catch (error) {
        logger.error('GPS模拟AmapCanvas回调执行失败:', error);
      }
    }
  }

  /**
   * 检查是否正在模拟
   */
  isRunning(): boolean {
    return this.isSimulating;
  }

  /**
   * 获取当前模拟状态
   */
  getStatus(): {
    isSimulating: boolean;
    currentRoute: string | null;
    currentIndex: number;
    totalPositions: number;
  } {
    return {
      isSimulating: this.isSimulating,
      currentRoute: this.currentRoute?.name || null,
      currentIndex: this.currentIndex,
      totalPositions: this.currentRoute?.positions.length || 0
    };
  }

  /**
   * 创建自定义路线
   */
  createCustomRoute(
    name: string,
    positions: Omit<GPSPosition, 'timestamp'>[],
    interval: number = 3000
  ): GPSRoute {
    return {
      name,
      positions: positions.map(pos => ({
        ...pos,
        timestamp: Date.now()
      })),
      interval
    };
  }
}

// 导出单例实例
export const gpsSimulator = GPSSimulator.getInstance();

// 开发环境下的全局GPS模拟器
if (typeof window !== 'undefined') {
  (window as any).gpsSimulator = gpsSimulator;
  logger.info('🗺️ GPS模拟器已加载到全局对象 window.gpsSimulator');
}
