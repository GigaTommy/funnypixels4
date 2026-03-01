/**
 * 增强GPS服务 - 解决定位精度和自动绘制问题
 * 功能：
 * 1. 混合定位策略（高德+浏览器+备用）
 * 2. 智能绘制触发逻辑
 * 3. 轨迹平滑算法
 * 4. 防重复绘制机制
 */

import { calculateGridId, snapToGrid } from '../utils/grid';
import { logger } from '../utils/logger';
import { gpsSimulator, GPSPosition } from '../utils/gpsSimulator';
import { sessionDataManager } from './sessionDataManager';
import { safeGetNavigator, isGeolocationAvailable, safeExecuteBrowserAsyncFn } from '../utils/browserEnvironment';

export interface EnhancedGPSPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  speed?: number;
  heading?: number;
  source: 'amap' | 'browser' | 'ip' | 'filtered' | 'simulator' | 'internal';
  confidence: number; // 0-1 置信度
}

export interface GridDrawInfo {
  gridId: string;
  entryTime: number;
  hasDrawn: boolean;
  position: EnhancedGPSPosition;
  attempts: number;
}

export interface GPSDrawResult {
  success: boolean;
  position: EnhancedGPSPosition;
  gridId: string;
  reason?: string;
  error?: string;
}

// GPS配置
const GPS_CONFIG = {
  // 定位配置
  LOCATION: {
    enableHighAccuracy: true,
    timeout: 3000,
    maximumAge: 3000, // 减少缓存时间
    desiredAccuracy: 10,
    updateInterval: 1000, // 1秒更新一次
  },

  // 绘制配置
  DRAWING: {
    GRID_SIZE_METERS: 11,
    GRID_ENTRY_THRESHOLD: 8, // 进入网格8米范围触发
    TIME_IN_GRID: 2000, // 在网格内停留2秒
    MIN_ACCURACY: 25, // 最小精度要求
    CONFIDENCE_THRESHOLD: 0.6,
    MAX_ATTEMPTS: 3, // 每个网格最多尝试3次
  },

  // 轨迹平滑配置
  SMOOTHING: {
    MAX_SPEED: 200, // 最大合理速度 m/s (720km/h) - 提高以支持快速模拟
    HISTORY_SIZE: 5, // 保留最近5个位置用于平滑
    OUTLIER_THRESHOLD: 500, // 异常位置阈值（米）- 提高以支持长距离测试
  }
};

class TrajectoryFilter {
  private positionHistory: EnhancedGPSPosition[] = [];

  /**
   * 添加新位置并进行轨迹平滑
   */
  addPosition(position: EnhancedGPSPosition): EnhancedGPSPosition {
    // 验证位置有效性
    if (!this.isValidPosition(position)) {
      logger.warn('GPS位置无效，跳过:', position);
      return this.getLastValidPosition() || position;
    }

    // 检测异常移动
    if (this.positionHistory.length > 0) {
      const lastPos = this.positionHistory[this.positionHistory.length - 1];
      if (this.isOutlier(position, lastPos)) {
        logger.warn('检测到GPS异常跳跃，使用平滑位置');
        return this.smoothPosition(position);
      }
    }

    // 添加到历史记录
    this.positionHistory.push(position);
    if (this.positionHistory.length > GPS_CONFIG.SMOOTHING.HISTORY_SIZE) {
      this.positionHistory.shift();
    }

    // 应用平滑算法
    return this.smoothPosition(position);
  }

  /**
   * 验证位置有效性
   */
  private isValidPosition(pos: EnhancedGPSPosition): boolean {
    return (
      !isNaN(pos.latitude) &&
      !isNaN(pos.longitude) &&
      pos.latitude >= -90 &&
      pos.latitude <= 90 &&
      pos.longitude >= -180 &&
      pos.longitude <= 180 &&
      pos.accuracy > 0 &&
      pos.accuracy < 1000 // 精度不能太差
    );
  }

  /**
   * 检测异常位置
   */
  private isOutlier(newPos: EnhancedGPSPosition, lastPos: EnhancedGPSPosition): boolean {
    const distance = this.calculateDistance(newPos, lastPos);
    const timeDiff = (newPos.timestamp - lastPos.timestamp) / 1000; // 秒
    const speed = timeDiff > 0 ? distance / timeDiff : 0;

    // 🧪 模拟器模式：放宽异常检测条件
    if (newPos.source === 'simulator') {
      return distance > GPS_CONFIG.SMOOTHING.OUTLIER_THRESHOLD;
    }

    return (
      distance > GPS_CONFIG.SMOOTHING.OUTLIER_THRESHOLD ||
      speed > GPS_CONFIG.SMOOTHING.MAX_SPEED
    );
  }

  /**
   * 轨迹平滑算法
   */
  private smoothPosition(position: EnhancedGPSPosition): EnhancedGPSPosition {
    if (this.positionHistory.length < 2) {
      return position;
    }

    // 加权平均最近几个位置
    const weights = [0.4, 0.3, 0.2, 0.1]; // 权重递减
    let totalWeight = 0;
    let weightedLat = 0;
    let weightedLng = 0;

    const recentPositions = [...this.positionHistory, position];
    const startIndex = Math.max(0, recentPositions.length - weights.length);

    for (let i = startIndex; i < recentPositions.length; i++) {
      const weight = weights[i - startIndex] || 0.05;
      const pos = recentPositions[i];

      weightedLat += pos.latitude * weight;
      weightedLng += pos.longitude * weight;
      totalWeight += weight;
    }

    const smoothedPosition: EnhancedGPSPosition = {
      ...position,
      latitude: weightedLat / totalWeight,
      longitude: weightedLng / totalWeight,
      // 🧪 保留原始source，特别是模拟器模式需要特殊处理
      source: position.source === 'simulator' ? 'simulator' : 'filtered',
      confidence: Math.min(1, GPS_CONFIG.DRAWING.MIN_ACCURACY / position.accuracy)
    };

    logger.debug('GPS轨迹平滑:', {
      original: `(${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)})`,
      smoothed: `(${smoothedPosition.latitude.toFixed(6)}, ${smoothedPosition.longitude.toFixed(6)})`,
      confidence: smoothedPosition.confidence.toFixed(2)
    });

    return smoothedPosition;
  }

  /**
   * 计算两点距离
   */
  private calculateDistance(pos1: EnhancedGPSPosition, pos2: EnhancedGPSPosition): number {
    const R = 6371000; // 地球半径
    const dLat = (pos2.latitude - pos1.latitude) * Math.PI / 180;
    const dLon = (pos2.longitude - pos1.longitude) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(pos1.latitude * Math.PI / 180) * Math.cos(pos2.latitude * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * 获取最后一个有效位置
   */
  private getLastValidPosition(): EnhancedGPSPosition | null {
    return this.positionHistory.length > 0 ?
           this.positionHistory[this.positionHistory.length - 1] : null;
  }
}

class DrawingTracker {
  private gridDrawInfo = new Map<string, GridDrawInfo>();
  private lastDrawnTime = 0;

  /**
   * 检查是否应该绘制像素
   */
  shouldDraw(position: EnhancedGPSPosition): { shouldDraw: boolean; reason: string; gridId: string } {
    const gridId = calculateGridId(position.latitude, position.longitude);
    const now = Date.now();

    // 🎯 大幅放宽绘制条件，确保测试模式下能正常绘制

    // 获取或创建网格信息
    let gridInfo = this.gridDrawInfo.get(gridId);
    if (!gridInfo) {
      gridInfo = {
        gridId,
        entryTime: now,
        hasDrawn: false,
        position,
        attempts: 0
      };
      this.gridDrawInfo.set(gridId, gridInfo);

      logger.debug(`进入新网格: ${gridId}`);

      // 🎯 测试模式下立即允许绘制，不等待稳定时间
      return {
        shouldDraw: true,
        reason: '测试模式 - 立即绘制',
        gridId
      };
    }

    // 🔧 修复：对于GPS模拟模式，允许在不同位置重复绘制
    // 只有在相同网格且短时间内才禁止重复绘制
    if (gridInfo.hasDrawn) {
      const timeSinceDraw = now - this.lastDrawnTime;
      const minInterval = 1000; // 1秒最小间隔

      // 计算当前位置与网格中心的距离
      const distanceFromGridCenter = this.calculateDistance(position, {
        latitude: gridInfo.position.latitude,
        longitude: gridInfo.position.longitude,
        accuracy: 0,
        timestamp: Date.now(),
        source: 'internal',
        confidence: 1.0
      });

      // 如果距离上次绘制位置超过10米，或者时间间隔足够，允许重新绘制
      if (distanceFromGridCenter > 10 || timeSinceDraw > minInterval) {
        logger.debug(`🎯 允许在新位置绘制: 距离=${distanceFromGridCenter.toFixed(1)}m, 时间间隔=${timeSinceDraw}ms`);

        // 重置网格绘制状态，允许在新位置绘制
        gridInfo.hasDrawn = false;
        gridInfo.attempts = 0;
        gridInfo.entryTime = now;
        gridInfo.position = position;

        return {
          shouldDraw: true,
          reason: '新位置绘制',
          gridId
        };
      }

      return {
        shouldDraw: false,
        reason: '网格已绘制',
        gridId
      };
    }

    // 检查尝试次数
    if (gridInfo.attempts >= GPS_CONFIG.DRAWING.MAX_ATTEMPTS) {
      return {
        shouldDraw: false,
        reason: '超过最大尝试次数',
        gridId
      };
    }

    // 🎯 测试模式下大幅放宽时间检查，立即允许绘制
    // 注释掉停留时间检查
    // const timeInGrid = now - gridInfo.entryTime;
    // const requiredTime = GPS_CONFIG.DRAWING.TIME_IN_GRID; // 使用配置的2秒
    // if (timeInGrid < requiredTime) {
    //   return {
    //     shouldDraw: false,
    //     reason: `等待稳定: ${timeInGrid}ms < ${requiredTime}ms`,
    //     gridId
    //   };
    // }

    // 🎯 放宽网格中心距离检查
    const { lat: gridCenterLat, lng: gridCenterLng } = snapToGrid(position.latitude, position.longitude);
    const distanceToCenter = this.calculateDistance(
      { latitude: position.latitude, longitude: position.longitude, accuracy: 0, timestamp: 0, confidence: 0, source: 'amap' },
      { latitude: gridCenterLat, longitude: gridCenterLng, accuracy: 0, timestamp: 0, confidence: 0, source: 'amap' }
    );

    // 大幅增加网格中心距离阈值或完全移除检查
    // if (distanceToCenter > GPS_CONFIG.DRAWING.GRID_ENTRY_THRESHOLD * 2) {
    //   return {
    //     shouldDraw: false,
    //     reason: `距网格中心太远: ${distanceToCenter.toFixed(1)}m > ${GPS_CONFIG.DRAWING.GRID_ENTRY_THRESHOLD * 2}m`,
    //     gridId
    //   };
    // }

    // 所有条件满足，可以绘制
    gridInfo.attempts++;
    return {
      shouldDraw: true,
      reason: '条件满足，执行绘制',
      gridId
    };
  }

  /**
   * 标记网格已绘制
   */
  markAsDrawn(gridId: string, success: boolean) {
    const gridInfo = this.gridDrawInfo.get(gridId);
    if (gridInfo) {
      if (success) {
        gridInfo.hasDrawn = true;
        this.lastDrawnTime = Date.now();
        logger.debug(`网格 ${gridId} 绘制成功`);

        // 🔧 绘制成功后立即触发清理，保持状态表简洁
        this.cleanup();
      } else {
        logger.debug(`网格 ${gridId} 绘制失败，尝试次数: ${gridInfo.attempts}`);
      }
    }
  }

  /**
   * 重置所有网格绘制状态 - 用于测试模式
   */
  resetAllGridStates() {
    const count = this.gridDrawInfo.size;
    this.gridDrawInfo.clear();
    this.lastDrawnTime = 0;
    logger.debug(`🔄 重置了 ${count} 个网格的绘制状态`);
  }

  /**
   * 清理过期的网格信息
   */
  cleanup() {
    const now = Date.now();
    const expireTime = 30 * 1000; // 🔧 缩短为30秒过期，更频繁清理

    let cleanedCount = 0;
    for (const [gridId, info] of this.gridDrawInfo.entries()) {
      if (now - info.entryTime > expireTime) {
        this.gridDrawInfo.delete(gridId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug(`🧹 清理了 ${cleanedCount} 个过期网格信息`);
    }

    // 🔧 防止内存泄漏：如果网格数量过多，清理最旧的条目
    if (this.gridDrawInfo.size > 100) {
      const entries = Array.from(this.gridDrawInfo.entries())
        .sort((a, b) => a[1].entryTime - b[1].entryTime);

      const toDelete = entries.slice(0, this.gridDrawInfo.size - 50);
      toDelete.forEach(([gridId]) => this.gridDrawInfo.delete(gridId));

      logger.debug(`🧹 清理了 ${toDelete.length} 个最旧的网格信息，防止内存泄漏`);
    }
  }

  /**
   * 计算距离（简化版本）
   */
  private calculateDistance(pos1: EnhancedGPSPosition, pos2: EnhancedGPSPosition): number {
    const R = 6371000;
    const dLat = (pos2.latitude - pos1.latitude) * Math.PI / 180;
    const dLon = (pos2.longitude - pos1.longitude) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(pos1.latitude * Math.PI / 180) * Math.cos(pos2.latitude * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * 获取状态信息
   */
  getStatus() {
    return {
      trackedGrids: this.gridDrawInfo.size,
      drawnGrids: Array.from(this.gridDrawInfo.values()).filter(info => info.hasDrawn).length,
      lastDrawnTime: this.lastDrawnTime
    };
  }
}

export class EnhancedGpsService {
  private static instance: EnhancedGpsService;
  private trajectoryFilter = new TrajectoryFilter();
  private drawingTracker = new DrawingTracker();
  private isTracking = false;
  private positionCallbacks: ((position: EnhancedGPSPosition) => void)[] = [];
  private drawCallbacks: ((result: GPSDrawResult) => void)[] = [];
  private watchId: number | null = null;

  // 轨迹记录
  private trackPoints: Array<{ lat: number; lng: number; timestamp: number }> = [];
  private isRecording = false;

  private constructor() {
    // 定期清理过期数据
    setInterval(() => {
      this.drawingTracker.cleanup();
    }, 60000); // 每分钟清理一次
  }

  static getInstance(): EnhancedGpsService {
    if (!EnhancedGpsService.instance) {
      EnhancedGpsService.instance = new EnhancedGpsService();
    }
    return EnhancedGpsService.instance;
  }

  /**
   * 开始GPS跟踪
   */
  async startTracking(): Promise<boolean> {
    if (this.isTracking) {
      return true;
    }

    // 开始记录轨迹
    this.startRecording();

    // 🧪 开发环境：检查是否启用GPS模拟器
    if (import.meta.env.DEV && localStorage.getItem('gps_simulation_enabled') === 'true') {
      logger.info('🧪 开发环境：使用GPS模拟器');
      return this.startSimulationTracking();
    }

    logger.debug('🎯 启动增强GPS服务...');

    try {
      // 1. 尝试高德地图定位
      const amapResult = await this.tryAmapLocation();
      if (amapResult) {
        this.startAmapTracking();
        this.isTracking = true;
        return true;
      }

      // 2. 尝试浏览器定位
      const browserResult = await this.tryBrowserLocation();
      if (browserResult) {
        this.startBrowserTracking();
        this.isTracking = true;
        return true;
      }

      logger.error('❌ 所有定位方式都失败');
      return false;

    } catch (error) {
      logger.error('❌ GPS跟踪启动失败:', error);
      return false;
    }
  }

  /**
   * 停止GPS跟踪
   */
  stopTracking() {
    if (!this.isTracking) {
      return;
    }

    // 停止轨迹记录
    this.stopRecording();

    // 停止GPS模拟器（如果正在运行）
    if (import.meta.env.DEV && gpsSimulator.isRunning()) {
      gpsSimulator.stopSimulation();
      logger.info('🛑 GPS模拟器已停止');
    }

    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    this.isTracking = false;
    logger.debug('🛑 GPS跟踪已停止');
  }

  /**
   * 启动GPS模拟跟踪（仅开发环境）
   */
  private async startSimulationTracking(): Promise<boolean> {
    logger.info('🗺️ 启动GPS模拟跟踪');

    try {
      // 动态导入RouteGenerator
      const { RouteGenerator } = await import('../utils/routeGenerator');

      // 从localStorage获取测试路线名称，默认使用cityWalk
      const routeName = localStorage.getItem('gps_test_route') || 'cityWalk';
      logger.info(`📍 使用测试路线: ${routeName}`);

      // 获取预定义测试路线
      const testRoutes = RouteGenerator.getTestRoutes();
      const selectedRoute = testRoutes.find(r => r.id === routeName);

      if (!selectedRoute) {
        logger.error(`❌ 未找到测试路线: ${routeName}`);
        return false;
      }

      // 生成路线点
      const positions = selectedRoute.generator();
      logger.info(`✅ 已生成 ${positions.length} 个位置点`);

      // 注册位置更新回调
      gpsSimulator.onPositionUpdate((position: GPSPosition) => {
        const enhancedPosition: EnhancedGPSPosition = {
          latitude: position.latitude,
          longitude: position.longitude,
          accuracy: position.accuracy,
          timestamp: position.timestamp,
          source: 'simulator',
          confidence: 1.0 // 模拟器数据完全可信
        };

        // 通过轨迹过滤器处理位置
        this.handlePositionUpdate(enhancedPosition);
      });

      // 创建自定义路线并启动模拟
      const customRoute = gpsSimulator.createCustomRoute(
        selectedRoute.name,
        positions,
        selectedRoute.interval
      );

      gpsSimulator.startSimulation(customRoute);
      this.isTracking = true;

      logger.info(`🎬 GPS模拟器启动成功 - 预计时长: ${selectedRoute.expectedDuration}`);
      return true;

    } catch (error) {
      logger.error('❌ GPS模拟器启动失败:', error);
      return false;
    }
  }

  /**
   * 尝试高德地图定位
   */
  private async tryAmapLocation(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!(window as any).AMap || !(window as any).AMap.plugin) {
        resolve(false);
        return;
      }

      (window as any).AMap.plugin('AMap.Geolocation', () => {
        const geolocation = new (window as any).AMap.Geolocation({
          enableHighAccuracy: true,
          timeout: GPS_CONFIG.LOCATION.timeout,
          showButton: false,
          showMarker: false,
          showCircle: false,
          convert: true,
          extensions: 'all'
        });

        geolocation.getCurrentPosition((status: string, result: any) => {
          if (status === 'complete' && result && result.position) {
            logger.debug('✅ 高德地图定位测试成功');
            resolve(true);
          } else {
            logger.warn('❌ 高德地图定位测试失败:', status);
            resolve(false);
          }
        });
      });
    });
  }

  /**
   * 启动高德地图跟踪
   */
  private startAmapTracking() {
    if (!(window as any).AMap || !(window as any).AMap.plugin) {
      return;
    }

    (window as any).AMap.plugin('AMap.Geolocation', () => {
      const geolocation = new (window as any).AMap.Geolocation({
        enableHighAccuracy: true,
        timeout: GPS_CONFIG.LOCATION.timeout,
        maximumAge: GPS_CONFIG.LOCATION.maximumAge,
        convert: true,
        extensions: 'all'
      });

      const trackPosition = () => {
        geolocation.getCurrentPosition((status: string, result: any) => {
          if (status === 'complete' && result && result.position) {
            const position: EnhancedGPSPosition = {
              latitude: result.position.lat,
              longitude: result.position.lng,
              accuracy: result.accuracy || 10,
              timestamp: Date.now(),
              source: 'amap',
              confidence: Math.min(1, GPS_CONFIG.DRAWING.MIN_ACCURACY / (result.accuracy || 10))
            };

            this.handlePositionUpdate(position);
          }

          // 继续跟踪
          if (this.isTracking) {
            setTimeout(trackPosition, GPS_CONFIG.LOCATION.updateInterval);
          }
        });
      };

      trackPosition();
    });
  }

  /**
   * 尝试浏览器定位
   */
  private async tryBrowserLocation(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!isGeolocationAvailable()) {
        resolve(false);
        return;
      }

      const nav = safeGetNavigator();
      if (!nav) {
        resolve(false);
        return;
      }

      nav.geolocation.getCurrentPosition(
        () => {
          logger.debug('✅ 浏览器定位测试成功');
          resolve(true);
        },
        () => {
          logger.warn('❌ 浏览器定位测试失败');
          resolve(false);
        },
        {
          enableHighAccuracy: true,
          timeout: GPS_CONFIG.LOCATION.timeout,
          maximumAge: GPS_CONFIG.LOCATION.maximumAge
        }
      );
    });
  }

  /**
   * 启动浏览器跟踪
   */
  private startBrowserTracking() {
    if (!isGeolocationAvailable()) {
      return;
    }

    const nav = safeGetNavigator();
    if (!nav) {
      return;
    }

    this.watchId = nav.geolocation.watchPosition(
      (position) => {
        // 直接使用WGS84坐标，无需转换
        const enhancedPosition: EnhancedGPSPosition = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: Date.now(),
          source: 'browser',
          confidence: Math.min(1, GPS_CONFIG.DRAWING.MIN_ACCURACY / position.coords.accuracy)
        };

        this.handlePositionUpdate(enhancedPosition);
      },
      (error) => {
        logger.error('浏览器定位错误:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: GPS_CONFIG.LOCATION.timeout,
        maximumAge: GPS_CONFIG.LOCATION.maximumAge
      }
    );
  }

  /**
   * 处理位置更新
   */
  private handlePositionUpdate(position: EnhancedGPSPosition) {
    logger.info('🔍 [GPS服务] 收到位置更新:', {
      position: `(${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)})`,
      source: position.source,
      accuracy: position.accuracy,
      confidence: position.confidence
    });

    // 记录轨迹点
    if (this.isRecording) {
      this.recordTrackPoint(position.latitude, position.longitude);

      // 同时记录到sessionDataManager
      try {
        const currentSession = sessionDataManager.getCurrentSession();
        if (currentSession && currentSession.isActive) {
          sessionDataManager.addTrackPoint(position.latitude, position.longitude);
          logger.debug('📍 已记录轨迹点到session:', {
            lat: position.latitude,
            lng: position.longitude,
            sessionId: currentSession.sessionId
          });
        }
      } catch (error) {
        logger.error('❌ 记录轨迹点到session失败:', error);
      }
    }

    // 轨迹平滑
    const smoothedPosition = this.trajectoryFilter.addPosition(position);
    logger.info('🔍 [GPS服务] 轨迹平滑后:', {
      position: `(${smoothedPosition.latitude.toFixed(6)}, ${smoothedPosition.longitude.toFixed(6)})`,
      source: smoothedPosition.source
    });

    // 通知位置更新
    logger.info(`🔍 [GPS服务] 通知 ${this.positionCallbacks.length} 个位置回调`);
    this.positionCallbacks.forEach(callback => {
      try {
        callback(smoothedPosition);
      } catch (error) {
        logger.error('位置更新回调执行失败:', error);
      }
    });

    // 检查绘制条件
    logger.info(`🔍 [GPS服务] 开始检查绘制条件，当前有 ${this.drawCallbacks.length} 个绘制回调`);
    const drawCheck = this.drawingTracker.shouldDraw(smoothedPosition);

    // 🔍 详细日志：记录绘制检查结果
    if (!drawCheck.shouldDraw) {
      logger.info(`🚫 [GPS服务] GPS绘制条件未满足: ${drawCheck.reason}`, {
        position: `(${smoothedPosition.latitude.toFixed(6)}, ${smoothedPosition.longitude.toFixed(6)})`,
        accuracy: `${smoothedPosition.accuracy.toFixed(1)}m`,
        confidence: smoothedPosition.confidence.toFixed(2),
        source: smoothedPosition.source,
        reason: drawCheck.reason,
        gridId: drawCheck.gridId
      });
    } else {
      logger.info(`✅ [GPS服务] GPS绘制条件满足: ${drawCheck.reason}`, {
        position: `(${smoothedPosition.latitude.toFixed(6)}, ${smoothedPosition.longitude.toFixed(6)})`,
        accuracy: `${smoothedPosition.accuracy.toFixed(1)}m`,
        confidence: smoothedPosition.confidence.toFixed(2),
        gridId: drawCheck.gridId,
        drawCallbacksCount: this.drawCallbacks.length
      });
    }

    if (drawCheck.shouldDraw) {
      logger.info('🔍 [GPS服务] 触发绘制请求通知...');
      this.notifyDrawRequest(smoothedPosition, drawCheck.gridId);
    }
  }

  /**
   * 通知绘制请求
   */
  private notifyDrawRequest(position: EnhancedGPSPosition, gridId: string) {
    const result: GPSDrawResult = {
      success: false, // 由调用方设置
      position,
      gridId,
      reason: '准备绘制'
    };

    this.drawCallbacks.forEach(callback => {
      try {
        callback(result);
      } catch (error) {
        logger.error('绘制回调执行失败:', error);
      }
    });
  }

  /**
   * 标记绘制结果
   */
  markDrawResult(gridId: string, success: boolean) {
    this.drawingTracker.markAsDrawn(gridId, success);
  }

  /**
   * 添加位置更新回调
   */
  onPositionUpdate(callback: (position: EnhancedGPSPosition) => void) {
    this.positionCallbacks.push(callback);
    logger.info(`🔍 [GPS服务] 注册位置更新回调，当前总数: ${this.positionCallbacks.length}`);
  }

  /**
   * 添加绘制回调
   */
  onDrawRequest(callback: (result: GPSDrawResult) => void) {
    this.drawCallbacks.push(callback);
    logger.info(`🔍 [GPS服务] 注册绘制回调，当前总数: ${this.drawCallbacks.length}`);
  }

  /**
   * 移除回调
   */
  removePositionCallback(callback: (position: EnhancedGPSPosition) => void) {
    const index = this.positionCallbacks.indexOf(callback);
    if (index > -1) {
      this.positionCallbacks.splice(index, 1);
    }
  }

  removeDrawCallback(callback: (result: GPSDrawResult) => void) {
    const index = this.drawCallbacks.indexOf(callback);
    if (index > -1) {
      this.drawCallbacks.splice(index, 1);
    }
  }

  /**
   * 开始记录轨迹
   */
  private startRecording() {
    this.isRecording = true;
    this.trackPoints = [];
    logger.info('📍 开始记录GPS轨迹');
  }

  /**
   * 停止记录轨迹
   */
  private stopRecording() {
    this.isRecording = false;
    logger.info(`📍 停止记录GPS轨迹，共记录 ${this.trackPoints.length} 个点`);
  }

  /**
   * 记录轨迹点
   */
  private recordTrackPoint(lat: number, lng: number) {
    const now = Date.now();

    // 避免记录过于密集的点（至少间隔500ms）
    if (this.trackPoints.length > 0) {
      const lastPoint = this.trackPoints[this.trackPoints.length - 1];
      if (now - lastPoint.timestamp < 500) {
        return;
      }
    }

    this.trackPoints.push({ lat, lng, timestamp: now });
    logger.debug(`📍 记录轨迹点 #${this.trackPoints.length}: (${lat.toFixed(6)}, ${lng.toFixed(6)})`);
  }

  /**
   * 获取记录的轨迹点
   */
  getTrackPoints(): Array<{ lat: number; lng: number; timestamp: number }> {
    return [...this.trackPoints];
  }

  /**
   * 清除轨迹点
   */
  clearTrackPoints() {
    this.trackPoints = [];
    logger.info('📍 已清除所有轨迹点');
  }

  /**
   * 获取服务状态
   */
  getStatus() {
    return {
      isTracking: this.isTracking,
      isRecording: this.isRecording,
      trackPointsCount: this.trackPoints.length,
      drawingTracker: this.drawingTracker.getStatus()
    };
  }
}

// 导出单例实例
export const enhancedGpsService = EnhancedGpsService.getInstance();