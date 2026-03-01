/**
 * GPS服务适配器 - 统一WGS84坐标系统
 *
 * 极简版本：移除所有复杂的GPS适配逻辑，直接提供基础接口
 */

import { logger } from '../utils/logger';

export type GPSServiceType = 'unified'; // 统一使用WGS84

export interface UnifiedGPSPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  speed?: number;
  heading?: number;
  source: string;
  confidence: number;
  coordinateSystem: 'WGS84'; // 统一使用WGS84
}

export interface UnifiedGPSDrawResult {
  success: boolean;
  position: UnifiedGPSPosition;
  gridId: string;
  reason?: string;
  error?: string;
}

/**
 * GPS服务适配器 - 极简WGS84实现
 */
class GPSServiceAdapter {
  private static instance: GPSServiceAdapter;
  private gpsType: GPSServiceType = 'unified';

  // 回调管理
  private positionCallbacks: ((position: UnifiedGPSPosition) => void)[] = [];
  private drawCallbacks: ((result: UnifiedGPSDrawResult) => void)[] = [];
  private currentPosition: UnifiedGPSPosition | null = null;

  private constructor() {
    logger.info('🎯 初始化极简GPS适配器 (WGS84坐标系)');
  }

  static getInstance(): GPSServiceAdapter {
    if (!GPSServiceAdapter.instance) {
      GPSServiceAdapter.instance = new GPSServiceAdapter();
    }
    return GPSServiceAdapter.instance;
  }

  /**
   * 开始GPS定位
   */
  async startGPS(options?: any): Promise<void> {
    try {
      logger.info('✅ GPS定位已启动 (极简模式)');
      // 这里可以添加实际的浏览器GPS定位逻辑
    } catch (error) {
      logger.error('❌ GPS定位启动失败:', error);
      throw error;
    }
  }

  /**
   * 停止GPS定位
   */
  stopGPS(): void {
    logger.info('⏹️ GPS定位已停止 (极简模式)');
  }

  /**
   * 手动绘制像素
   */
  async drawPixel(options: {
    lat: number;
    lng: number;
    color?: string;
    patternId?: string;
  }): Promise<UnifiedGPSDrawResult> {
    try {
      // 极简实现，只返回基本信息
      const gridId = `grid_${Math.floor(options.lat * 1000)}_${Math.floor(options.lng * 1000)}`;

      const result: UnifiedGPSDrawResult = {
        success: true,
        position: {
          latitude: options.lat,
          longitude: options.lng,
          accuracy: 10,
          timestamp: Date.now(),
          source: 'manual',
          confidence: 0.9,
          coordinateSystem: 'WGS84'
        },
        gridId,
        reason: 'Manual draw'
      };

      logger.debug('🎨 手动绘制完成:', result);
      return result;
    } catch (error) {
      logger.error('❌ 手动绘制失败:', error);
      throw error;
    }
  }

  /**
   * GPS绘制像素
   */
  async drawPixelGPS(options: {
    color?: string;
    patternId?: string;
    sessionId?: string;
  }): Promise<UnifiedGPSDrawResult> {
    if (!this.currentPosition) {
      throw new Error('No current GPS position available');
    }

    try {
      const gridId = `grid_${Math.floor(this.currentPosition.latitude * 1000)}_${Math.floor(this.currentPosition.longitude * 1000)}`;

      const result: UnifiedGPSDrawResult = {
        success: true,
        position: this.currentPosition,
        gridId,
        reason: 'GPS draw'
      };

      logger.debug('🎯 GPS绘制完成:', result);
      return result;
    } catch (error) {
      logger.error('❌ GPS绘制失败:', error);
      throw error;
    }
  }

  /**
   * 注册位置更新回调
   */
  onPositionUpdate(callback: (position: UnifiedGPSPosition) => void): () => void {
    this.positionCallbacks.push(callback);
    return () => {
      const index = this.positionCallbacks.indexOf(callback);
      if (index > -1) {
        this.positionCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * 注册绘制请求回调
   */
  onDrawRequest(callback: (result: UnifiedGPSDrawResult) => void): () => void {
    this.drawCallbacks.push(callback);
    return () => {
      const index = this.drawCallbacks.indexOf(callback);
      if (index > -1) {
        this.drawCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * 获取当前位置
   */
  getCurrentPosition(): UnifiedGPSPosition | null {
    return this.currentPosition;
  }

  /**
   * 设置当前位置（用于模拟或更新）
   */
  setCurrentPosition(position: { lat: number; lng: number; accuracy?: number }): void {
    this.currentPosition = {
      latitude: position.lat,
      longitude: position.lng,
      accuracy: position.accuracy || 10,
      timestamp: Date.now(),
      source: 'manual',
      confidence: 0.8,
      coordinateSystem: 'WGS84'
    };

    // 通知所有回调
    this.notifyPositionCallbacks(this.currentPosition);
  }

  /**
   * 获取轨迹点
   */
  getTrackPoints(): UnifiedGPSPosition[] {
    return this.currentPosition ? [this.currentPosition] : [];
  }

  /**
   * 清空轨迹
   */
  clearTrack(): void {
    this.currentPosition = null;
    logger.info('🗑️ 轨迹已清空');
  }

  /**
   * 重置网格绘制状态
   */
  resetAllGridStates(): void {
    logger.info('🔄 网格绘制状态已重置');
  }

  /**
   * 转换坐标（直接返回WGS84）
   */
  convertCoordinate(lat: number, lng: number, toSystem: 'WGS84'): { lat: number; lng: number } {
    // 统一使用WGS84坐标，无需转换
    return { lat, lng };
  }

  /**
   * 获取最后位置
   */
  getLastPosition(): { lat: number; lng: number } | null {
    return this.currentPosition ? {
      lat: this.currentPosition.latitude,
      lng: this.currentPosition.longitude
    } : null;
  }

  /**
   * 设置GPS类型
   */
  setGPSType(type: GPSServiceType): void {
    if (type !== 'unified') {
      logger.warn('⚠️ 仅支持unified GPS类型');
      return;
    }
    this.gpsType = type;
    logger.info('🎯 GPS类型已设置为: unified (WGS84)');
  }

  /**
   * 获取GPS类型
   */
  getGPSType(): GPSServiceType {
    return this.gpsType;
  }

  /**
   * 模拟GPS位置
   */
  simulatePosition(lat: number, lng: number, accuracy?: number): void {
    this.setCurrentPosition({ lat, lng, accuracy });
    logger.debug(`🎭 模拟GPS位置: (${lat}, ${lng})`);
  }

  /**
   * 获取GPS状态
   */
  getStatus(): {
    isActive: boolean;
    currentPosition: UnifiedGPSPosition | null;
    trackPoints: number;
    confidence: number;
  } {
    return {
      isActive: !!this.currentPosition,
      currentPosition: this.currentPosition,
      trackPoints: this.currentPosition ? 1 : 0,
      confidence: this.currentPosition?.confidence || 0
    };
  }

  /**
   * 通知位置更新回调
   */
  private notifyPositionCallbacks(position: UnifiedGPSPosition) {
    this.positionCallbacks.forEach(callback => {
      try {
        callback(position);
      } catch (error) {
        logger.error('GPS位置回调执行失败:', error);
      }
    });
  }
}

// 导出适配器实例和便捷函数
export const gpsServiceAdapter = GPSServiceAdapter.getInstance();

// 便捷函数
export const startGPS = (options?: any) => gpsServiceAdapter.startGPS(options);
export const stopGPS = () => gpsServiceAdapter.stopGPS();
export const drawPixel = (options: any) => gpsServiceAdapter.drawPixel(options);
export const drawPixelGPS = (options: any) => gpsServiceAdapter.drawPixelGPS(options);
export const getCurrentPosition = () => gpsServiceAdapter.getCurrentPosition();
export const getTrackPoints = () => gpsServiceAdapter.getTrackPoints();
export const clearTrack = () => gpsServiceAdapter.clearTrack();
export const convertCoordinate = (lat: number, lng: number, toSystem: 'WGS84') =>
  gpsServiceAdapter.convertCoordinate(lat, lng, toSystem);
export const setGPSType = (type: GPSServiceType) => gpsServiceAdapter.setGPSType(type);
export const getGPSType = () => gpsServiceAdapter.getGPSType();
export const getGPSStatus = () => gpsServiceAdapter.getStatus();

export default gpsServiceAdapter;