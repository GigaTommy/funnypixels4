// 地图配置文件 - MapLibre GL专用
import { logger } from '../utils/logger';

export interface MapLibreConfig {
  style: string | {
    version: 8; // 必须是字面量8
    sources: {
      [key: string]: {
        type: string;
        tiles?: string[];
        tileSize?: number;
        attribution?: string;
      };
    };
    layers: Array<{
      id: string;
      type: string;
      source: string;
      minzoom?: number;
      maxzoom?: number;
      paint?: {
        [key: string]: any;
      };
    }>;
  };
  defaultCenter: [number, number]; // [lng, lat]
  defaultZoom: number;
  minZoom: number;
  maxZoom: number;
  tileSize: number;
}

// 🎨 街道风格样式配置 - 使用 OpenFreeMap (免费开源)
export const streetStyle = 'https://tiles.openfreemap.org/styles/liberty';




// 移除像素瓦片配置 - 使用单一WebGL Context的Custom Layer架构
// 像素格子将通过Custom Layer渲染，不再使用瓦片服务
// export const pixelTileConfig = {};

// 默认配置 - 使用街道样式
export const defaultMapLibreConfig: MapLibreConfig = {
  style: streetStyle, // 使用 CartoDB Positron 街道样式
  defaultCenter: [113.324520, 23.109722], // 广州塔
  defaultZoom: 12,
  minZoom: 1,
  maxZoom: 18.0, // 🔧 与 iOS 端保持一致，支持完整的像素显示
  tileSize: 512 // 矢量瓦片使用512
};

// 从环境变量获取基础配置
function getEnvConfig(): Partial<MapLibreConfig> {
  const envConfig: Partial<MapLibreConfig> = {};

  // 从环境变量获取地图中心点
  if (import.meta.env.VITE_MAP_CENTER_LNG && import.meta.env.VITE_MAP_CENTER_LAT) {
    envConfig.defaultCenter = [
      parseFloat(import.meta.env.VITE_MAP_CENTER_LNG),
      parseFloat(import.meta.env.VITE_MAP_CENTER_LAT)
    ];
  }

  // 从环境变量获取默认缩放级别
  if (import.meta.env.VITE_MAP_DEFAULT_ZOOM) {
    envConfig.defaultZoom = parseInt(import.meta.env.VITE_MAP_DEFAULT_ZOOM);
  }

  // 使用街道样式
  envConfig.style = streetStyle;

  // 移除瓦片服务配置 - 使用单一WebGL Context的Custom Layer架构
  // 像素格子将通过Custom Layer渲染，不再使用瓦片服务

  return envConfig;
}

// 缓存配置，避免重复调用
let cachedConfig: MapLibreConfig | null = null;

// 获取地图配置
export function getMapLibreConfig(): MapLibreConfig {
  // 如果已经有缓存，直接返回
  if (cachedConfig) {
    return cachedConfig;
  }

  // 获取环境变量配置
  const envConfig = getEnvConfig();

  // 合并配置：环境变量优先，然后是默认配置
  const finalConfig = { ...defaultMapLibreConfig, ...envConfig };
  cachedConfig = finalConfig;

  logger.info('🗺️ MapLibre GL配置加载完成 (CartoDB Positron 矢量样式):', {
    center: finalConfig.defaultCenter,
    zoom: finalConfig.defaultZoom,
    minZoom: finalConfig.minZoom,
    maxZoom: finalConfig.maxZoom,
    tileSize: finalConfig.tileSize,
    styleUrl: finalConfig.style
  });

  return finalConfig;
}

// 清除缓存，强制重新加载配置
export function clearMapLibreConfigCache(): void {
  cachedConfig = null;
}

// 获取包含像素图层的完整地图样式 (暂时禁用像素瓦片)
export function getMapStyleWithPixels(): MapLibreConfig['style'] {
  const config = getMapLibreConfig();
  return config.style;
}