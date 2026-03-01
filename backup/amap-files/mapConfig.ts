// 地图配置文件 - 高德地图专用
import { logger } from '../utils/logger';
export interface MapConfig {
  amap: {
    apiKey: string;
    version: string;
    plugins: string[];
  };
}

// 默认配置
export const defaultMapConfig: MapConfig = {
  amap: {
    apiKey: '', // 从环境变量获取
    version: '2.0', // 更新到v2.0版本
    plugins: ['AMap.Scale', 'AMap.ToolBar', 'AMap.Geolocation', 'AMap.Geocoder'], // 常用插件
  },
};

// 从环境变量获取配置
function getEnvConfig(): Partial<MapConfig> {
  const envConfig: Partial<MapConfig> = {};
  
  if (import.meta.env.VITE_AMAP_API_KEY) {
    envConfig.amap = {
      ...defaultMapConfig.amap,
      apiKey: import.meta.env.VITE_AMAP_API_KEY,
    };
  }
  
  if (import.meta.env.VITE_AMAP_API_VERSION) {
    if (!envConfig.amap) envConfig.amap = { ...defaultMapConfig.amap };
    envConfig.amap.version = import.meta.env.VITE_AMAP_API_VERSION;
  }
  
  return envConfig;
}

// 缓存配置，避免重复调用
let cachedConfig: MapConfig | null = null;

// 从环境变量获取配置
export function getMapConfig(): MapConfig {
  // 如果已经有缓存，直接返回
  if (cachedConfig) {
    return cachedConfig;
  }
  
  // 获取环境变量配置
  const envConfig = getEnvConfig();
  
  // 合并配置：环境变量优先，然后是默认配置
  const finalConfig = { ...defaultMapConfig, ...envConfig };
  cachedConfig = finalConfig;
  
  logger.info('🗺️ 高德地图配置加载完成:', {
    apiKey: finalConfig.amap.apiKey ? '已设置' : '未设置',
    version: finalConfig.amap.version
  });
  
  return finalConfig;
}

// 清除缓存，强制重新加载配置
export function clearMapConfigCache(): void {
  cachedConfig = null;
}
