// 移动端优化工具函数

export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  userAgent: string;
  screenWidth: number;
  screenHeight: number;
  connectionType?: string;
  memoryInfo?: any;
}

/**
 * 检测设备类型和性能信息
 */
export const getDeviceInfo = (): DeviceInfo => {
  const userAgent = navigator.userAgent.toLowerCase();
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  
  // 检测设备类型
  const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
  const isSmallScreen = screenWidth <= 768;
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isTablet = /ipad|android(?!.*mobile)/i.test(userAgent) || (screenWidth >= 768 && screenWidth <= 1024 && isTouchDevice);
  
  const isMobile = isMobileDevice || (isSmallScreen && isTouchDevice);
  const isDesktop = !isMobile && !isTablet;
  
  // 获取网络连接信息
  let connectionType: string | undefined;
  if ('connection' in navigator) {
    const connection = (navigator as any).connection;
    connectionType = connection?.effectiveType || connection?.type;
  }
  
  // 获取内存信息（如果支持）
  let memoryInfo: any;
  if ('memory' in performance) {
    memoryInfo = (performance as any).memory;
  }
  
  return {
    isMobile,
    isTablet,
    isDesktop,
    userAgent,
    screenWidth,
    screenHeight,
    connectionType,
    memoryInfo
  };
};

/**
 * 根据设备类型获取合适的超时时间
 */
export const getTimeoutDuration = (deviceInfo: DeviceInfo): number => {
  if (deviceInfo.isMobile) {
    // 移动端根据网络类型调整超时时间
    switch (deviceInfo.connectionType) {
      case 'slow-2g':
      case '2g':
        return 20000; // 20秒
      case '3g':
        return 15000; // 15秒
      case '4g':
      default:
        return 12000; // 12秒
    }
  } else if (deviceInfo.isTablet) {
    return 10000; // 10秒
  } else {
    return 8000; // 8秒
  }
};

/**
 * 检测是否为低性能设备
 */
export const isLowPerformanceDevice = (deviceInfo: DeviceInfo): boolean => {
  if (deviceInfo.isMobile) {
    // 移动端内存小于2GB认为是低性能设备
    if (deviceInfo.memoryInfo && deviceInfo.memoryInfo.jsHeapSizeLimit < 2 * 1024 * 1024 * 1024) {
      return true;
    }
    
    // 慢网络认为是低性能环境
    if (deviceInfo.connectionType === 'slow-2g' || deviceInfo.connectionType === '2g') {
      return true;
    }
  }
  
  return false;
};

/**
 * 获取移动端优化的配置
 */
export const getMobileOptimizedConfig = (deviceInfo: DeviceInfo) => {
  const isLowPerf = isLowPerformanceDevice(deviceInfo);
  
  return {
    // 网络请求配置
    requestTimeout: getTimeoutDuration(deviceInfo),
    retryAttempts: isLowPerf ? 2 : 3,
    retryDelay: isLowPerf ? 2000 : 1000,
    
    // 渲染配置
    enableAnimations: !isLowPerf,
    enableTransitions: !isLowPerf,
    reduceMotion: isLowPerf,
    
    // 缓存配置
    cacheSize: isLowPerf ? 10 : 50,
    enablePreloading: !isLowPerf,
    
    // 错误处理配置
    showDetailedErrors: !deviceInfo.isMobile,
    enableErrorReporting: true,
    
    // 性能监控
    enablePerformanceMonitoring: true,
    logLevel: deviceInfo.isMobile ? 'warn' : 'info'
  };
};

/**
 * 移动端网络状态检测
 */
export const getNetworkStatus = () => {
  if ('connection' in navigator) {
    const connection = (navigator as any).connection;
    return {
      effectiveType: connection?.effectiveType,
      downlink: connection?.downlink,
      rtt: connection?.rtt,
      saveData: connection?.saveData
    };
  }
  return null;
};

/**
 * 检测是否应该启用离线模式
 */
export const shouldEnableOfflineMode = (deviceInfo: DeviceInfo): boolean => {
  const networkStatus = getNetworkStatus();
  
  // 慢网络或数据节省模式启用离线功能
  if (networkStatus?.saveData || networkStatus?.effectiveType === 'slow-2g') {
    return true;
  }
  
  // 低性能设备启用离线功能
  if (isLowPerformanceDevice(deviceInfo)) {
    return true;
  }
  
  return false;
};
