/**
 * 设备类型检测和屏幕适配工具
 * 提供设备类型检测、屏幕尺寸适配、响应式断点管理等功能
 */

import { logger } from './logger';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';
export type Orientation = 'portrait' | 'landscape';

export interface DeviceInfo {
  type: DeviceType;
  orientation: Orientation;
  screenWidth: number;
  screenHeight: number;
  windowWidth: number;
  windowHeight: number;
  pixelRatio: number;
  isTouchDevice: boolean;
  userAgent: string;
  platform: string;
}

export interface BreakpointConfig {
  mobile: number;
  tablet: number;
  desktop: number;
}

// 默认断点配置
const DEFAULT_BREAKPOINTS: BreakpointConfig = {
  mobile: 768,   // 小于768px为移动端
  tablet: 1024,  // 768px-1024px为平板
  desktop: 1025  // 大于1024px为桌面端
};

class DeviceDetection {
  private static instance: DeviceDetection;
  private deviceInfo: DeviceInfo | null = null;
  private breakpoints: BreakpointConfig = DEFAULT_BREAKPOINTS;
  private listeners: Array<(deviceInfo: DeviceInfo) => void> = [];

  private constructor() {
    this.initialize();
  }

  public static getInstance(): DeviceDetection {
    if (!DeviceDetection.instance) {
      DeviceDetection.instance = new DeviceDetection();
    }
    return DeviceDetection.instance;
  }

  /**
   * 初始化设备检测
   */
  private initialize(): void {
    this.detectDevice();
    this.setupResizeListener();
  }

  /**
   * 检测设备信息
   */
  private detectDevice(): void {
    const userAgent = navigator.userAgent;
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const pixelRatio = window.devicePixelRatio || 1;

    // 检测设备类型
    const type = this.detectDeviceType(windowWidth);
    
    // 检测屏幕方向
    const orientation = this.detectOrientation(windowWidth, windowHeight);
    
    // 检测是否为触摸设备
    const isTouchDevice = this.detectTouchDevice();
    
    // 检测平台
    const platform = this.detectPlatform(userAgent);

    this.deviceInfo = {
      type,
      orientation,
      screenWidth,
      screenHeight,
      windowWidth,
      windowHeight,
      pixelRatio,
      isTouchDevice,
      userAgent,
      platform
    };

    logger.info('📱 设备信息检测完成:', this.deviceInfo);
  }

  /**
   * 根据屏幕宽度检测设备类型
   */
  private detectDeviceType(width: number): DeviceType {
    if (width < this.breakpoints.mobile) {
      return 'mobile';
    } else if (width < this.breakpoints.tablet) {
      return 'tablet';
    } else {
      return 'desktop';
    }
  }

  /**
   * 检测屏幕方向
   */
  private detectOrientation(width: number, height: number): Orientation {
    return width > height ? 'landscape' : 'portrait';
  }

  /**
   * 检测是否为触摸设备
   */
  private detectTouchDevice(): boolean {
    return (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      (navigator as any).msMaxTouchPoints > 0
    );
  }

  /**
   * 检测平台类型
   */
  private detectPlatform(userAgent: string): string {
    const ua = userAgent.toLowerCase();
    
    if (ua.includes('android')) return 'android';
    if (ua.includes('iphone') || ua.includes('ipad')) return 'ios';
    if (ua.includes('windows')) return 'windows';
    if (ua.includes('mac')) return 'mac';
    if (ua.includes('linux')) return 'linux';
    
    return 'unknown';
  }

  /**
   * 设置窗口大小变化监听器
   */
  private setupResizeListener(): void {
    let resizeTimeout: NodeJS.Timeout;
    
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.detectDevice();
        this.notifyListeners();
      }, 100); // 防抖处理
    });

    // 监听屏幕方向变化
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        this.detectDevice();
        this.notifyListeners();
      }, 100);
    });
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(): void {
    if (this.deviceInfo) {
      this.listeners.forEach(listener => listener(this.deviceInfo!));
    }
  }

  /**
   * 获取当前设备信息
   */
  public getDeviceInfo(): DeviceInfo | null {
    return this.deviceInfo;
  }

  /**
   * 获取设备类型
   */
  public getDeviceType(): DeviceType | null {
    return this.deviceInfo?.type || null;
  }

  /**
   * 是否为移动设备
   */
  public isMobile(): boolean {
    return this.deviceInfo?.type === 'mobile';
  }

  /**
   * 是否为平板设备
   */
  public isTablet(): boolean {
    return this.deviceInfo?.type === 'tablet';
  }

  /**
   * 是否为桌面设备
   */
  public isDesktop(): boolean {
    return this.deviceInfo?.type === 'desktop';
  }

  /**
   * 是否为触摸设备
   */
  public isTouchDevice(): boolean {
    return this.deviceInfo?.isTouchDevice || false;
  }

  /**
   * 获取屏幕方向
   */
  public getOrientation(): Orientation | null {
    return this.deviceInfo?.orientation || null;
  }

  /**
   * 是否为横屏
   */
  public isLandscape(): boolean {
    return this.deviceInfo?.orientation === 'landscape';
  }

  /**
   * 是否为竖屏
   */
  public isPortrait(): boolean {
    return this.deviceInfo?.orientation === 'portrait';
  }

  /**
   * 获取屏幕尺寸
   */
  public getScreenSize(): { width: number; height: number } | null {
    if (!this.deviceInfo) return null;
    return {
      width: this.deviceInfo.windowWidth,
      height: this.deviceInfo.windowHeight
    };
  }

  /**
   * 设置自定义断点
   */
  public setBreakpoints(breakpoints: Partial<BreakpointConfig>): void {
    this.breakpoints = { ...this.breakpoints, ...breakpoints };
    this.detectDevice();
    this.notifyListeners();
  }

  /**
   * 添加设备变化监听器
   */
  public addListener(listener: (deviceInfo: DeviceInfo) => void): () => void {
    this.listeners.push(listener);
    
    // 返回取消监听的函数
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * 获取设备特定的配置
   */
  public getDeviceConfig(): {
    mapZoom: number;
    controlSize: number;
    fontSize: number;
    spacing: number;
    isCompactMode: boolean;
  } {
    if (!this.deviceInfo) {
      return this.getDefaultConfig();
    }

    switch (this.deviceInfo.type) {
      case 'mobile':
        return {
          mapZoom: 14,
          controlSize: 40,
          fontSize: 14,
          spacing: 12,
          isCompactMode: true
        };
      case 'tablet':
        return {
          mapZoom: 15,
          controlSize: 44,
          fontSize: 16,
          spacing: 16,
          isCompactMode: false
        };
      case 'desktop':
        return {
          mapZoom: 15,
          controlSize: 48,
          fontSize: 16,
          spacing: 20,
          isCompactMode: false
        };
      default:
        return this.getDefaultConfig();
    }
  }

  /**
   * 获取默认配置
   */
  private getDefaultConfig() {
    return {
      mapZoom: 15,
      controlSize: 44,
      fontSize: 16,
      spacing: 16,
      isCompactMode: false
    };
  }
}

// 导出单例实例
export const deviceDetection = DeviceDetection.getInstance();

// 便捷的全局方法
export const getDeviceInfo = () => deviceDetection.getDeviceInfo();
export const getDeviceType = () => deviceDetection.getDeviceType();
export const isMobile = () => deviceDetection.isMobile();
export const isTablet = () => deviceDetection.isTablet();
export const isDesktop = () => deviceDetection.isDesktop();
export const isTouchDevice = () => deviceDetection.isTouchDevice();
export const getOrientation = () => deviceDetection.getOrientation();
export const isLandscape = () => deviceDetection.isLandscape();
export const isPortrait = () => deviceDetection.isPortrait();
export const getScreenSize = () => deviceDetection.getScreenSize();
export const getDeviceConfig = () => deviceDetection.getDeviceConfig();

// React Hook (需要在使用时导入React)
export const useDeviceDetection = () => {
  // 这个Hook需要在React组件中使用，这里只提供类型定义
  // 实际实现请使用 useDeviceAdaptation Hook
  return {
    deviceInfo: deviceDetection.getDeviceInfo(),
    isMobile: deviceDetection.isMobile(),
    isTablet: deviceDetection.isTablet(),
    isDesktop: deviceDetection.isDesktop(),
    isTouchDevice: deviceDetection.isTouchDevice(),
    orientation: deviceDetection.getOrientation(),
    isLandscape: deviceDetection.isLandscape(),
    isPortrait: deviceDetection.isPortrait(),
    screenSize: deviceDetection.getScreenSize(),
    deviceConfig: deviceDetection.getDeviceConfig()
  };
};
