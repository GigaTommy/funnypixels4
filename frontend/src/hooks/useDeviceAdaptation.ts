/**
 * 设备适配Hook
 * 提供设备类型检测和UI适配功能
 */

import React, { useState, useEffect, useMemo } from 'react';
import { deviceDetection, DeviceInfo, DeviceType } from '../utils/deviceDetection';

export interface DeviceAdaptationConfig {
  // 地图相关配置
  mapZoom: number;
  mapCenter: [number, number];
  
  // UI组件配置
  controlSize: number;
  fontSize: number;
  spacing: number;
  
  // 布局配置
  isCompactMode: boolean;
  showSidebar: boolean;
  bottomNavHeight: number;
  
  // 交互配置
  enableTouchGestures: boolean;
  enableKeyboardShortcuts: boolean;
  
  // 性能配置
  enableAnimations: boolean;
  enableParallax: boolean;
}

export interface DeviceAdaptationResult {
  deviceInfo: DeviceInfo | null;
  deviceType: DeviceType | null;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouchDevice: boolean;
  orientation: 'portrait' | 'landscape' | null;
  screenSize: { width: number; height: number } | null;
  config: DeviceAdaptationConfig;
  
  // 便捷方法
  getResponsiveValue: <T>(mobile: T, tablet: T, desktop: T) => T;
  getConditionalValue: <T>(condition: boolean, trueValue: T, falseValue: T) => T;
}

/**
 * 设备适配Hook
 */
export const useDeviceAdaptation = (): DeviceAdaptationResult => {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(
    deviceDetection.getDeviceInfo()
  );

  // 监听设备变化
  useEffect(() => {
    const unsubscribe = deviceDetection.addListener(setDeviceInfo);
    return unsubscribe;
  }, []);

  // 计算设备配置
  const config = useMemo((): DeviceAdaptationConfig => {
    const baseConfig = deviceDetection.getDeviceConfig();
    const isMobile = deviceInfo?.type === 'mobile';
    const isTablet = deviceInfo?.type === 'tablet';
    const isDesktop = deviceInfo?.type === 'desktop';
    const isTouch = deviceInfo?.isTouchDevice || false;

    return {
      // 地图配置
      mapZoom: isMobile ? 14 : isTablet ? 15 : 16,
      mapCenter: [120.1551, 30.2741], // 杭州西湖
      
      // UI配置
      controlSize: baseConfig.controlSize,
      fontSize: baseConfig.fontSize,
      spacing: baseConfig.spacing,
      
      // 布局配置
      isCompactMode: isMobile,
      showSidebar: isDesktop,
      bottomNavHeight: isMobile ? 60 : 80,
      
      // 交互配置
      enableTouchGestures: isTouch,
      enableKeyboardShortcuts: isDesktop,
      
      // 性能配置
      enableAnimations: !isMobile || (deviceInfo?.pixelRatio || 1) < 2,
      enableParallax: isDesktop
    };
  }, [deviceInfo]);

  // 便捷方法：根据设备类型获取响应式值
  const getResponsiveValue = useMemo(() => {
    return <T>(mobile: T, tablet: T, desktop: T): T => {
      switch (deviceInfo?.type) {
        case 'mobile':
          return mobile;
        case 'tablet':
          return tablet;
        case 'desktop':
          return desktop;
        default:
          return tablet; // 默认使用平板配置
      }
    };
  }, [deviceInfo?.type]);

  // 便捷方法：根据条件获取值
  const getConditionalValue = useMemo(() => {
    return <T>(condition: boolean, trueValue: T, falseValue: T): T => {
      return condition ? trueValue : falseValue;
    };
  }, []);

  return {
    deviceInfo,
    deviceType: deviceInfo?.type || null,
    isMobile: deviceInfo?.type === 'mobile',
    isTablet: deviceInfo?.type === 'tablet',
    isDesktop: deviceInfo?.type === 'desktop',
    isTouchDevice: deviceInfo?.isTouchDevice || false,
    orientation: deviceInfo?.orientation || null,
    screenSize: deviceInfo ? {
      width: deviceInfo.windowWidth,
      height: deviceInfo.windowHeight
    } : null,
    config,
    getResponsiveValue,
    getConditionalValue
  };
};

/**
 * 设备特定的样式Hook
 */
export const useDeviceStyles = () => {
  const { deviceInfo, config } = useDeviceAdaptation();

  const styles = useMemo(() => {
    const isMobile = deviceInfo?.type === 'mobile';
    const isTablet = deviceInfo?.type === 'tablet';
    const isDesktop = deviceInfo?.type === 'desktop';

    return {
      // 容器样式
      container: {
        padding: isMobile ? '8px' : isTablet ? '12px' : '16px',
        margin: isMobile ? '4px' : '8px',
        borderRadius: isMobile ? '8px' : '12px'
      },

      // 按钮样式
      button: {
        minHeight: config.controlSize,
        fontSize: config.fontSize,
        padding: `${config.spacing / 2}px ${config.spacing}px`,
        borderRadius: isMobile ? '6px' : '8px'
      },

      // 卡片样式
      card: {
        padding: config.spacing,
        margin: `${config.spacing / 2}px`,
        borderRadius: isMobile ? '8px' : '12px',
        boxShadow: isMobile 
          ? '0 2px 4px rgba(0,0,0,0.1)' 
          : '0 4px 8px rgba(0,0,0,0.15)'
      },

      // 文本样式
      text: {
        small: { fontSize: config.fontSize - 2 },
        normal: { fontSize: config.fontSize },
        large: { fontSize: config.fontSize + 2 },
        title: { fontSize: config.fontSize + 4 }
      },

      // 间距样式
      spacing: {
        xs: config.spacing / 4,
        sm: config.spacing / 2,
        md: config.spacing,
        lg: config.spacing * 1.5,
        xl: config.spacing * 2
      }
    };
  }, [deviceInfo, config]);

  return styles;
};

/**
 * 设备特定的布局Hook
 */
export const useDeviceLayout = () => {
  const { deviceInfo, config } = useDeviceAdaptation();

  const layout = useMemo(() => {
    const isMobile = deviceInfo?.type === 'mobile';
    const isTablet = deviceInfo?.type === 'tablet';
    const isDesktop = deviceInfo?.type === 'desktop';

    return {
      // 网格配置
      grid: {
        columns: isMobile ? 1 : isTablet ? 2 : 3,
        gap: config.spacing
      },

      // 导航配置
      navigation: {
        position: isMobile ? 'bottom' : 'side',
        height: config.bottomNavHeight,
        width: isMobile ? '100%' : '200px'
      },

      // 地图配置
      map: {
        height: isMobile ? 'calc(100vh - 120px)' : 'calc(100vh - 80px)',
        controls: {
          position: isMobile ? 'bottom-right' : 'right',
          size: config.controlSize
        }
      },

      // 模态框配置
      modal: {
        width: isMobile ? '95%' : isTablet ? '80%' : '60%',
        maxWidth: isMobile ? '400px' : '600px',
        padding: config.spacing
      }
    };
  }, [deviceInfo, config]);

  return layout;
};
