// 地球网格系统 - 4万亿像素网格
export interface GridPixel {
  gridId: string;
  lat: number;
  lng: number;
  color: string;
  owner?: string;
  timestamp?: number;
  version?: number;
}

export const GRID_CONFIG = {
  EARTH_RADIUS: 6371000,
  TOTAL_PIXELS: 4000000000000,
  // 网格大小（度）- 与后端完全一致
  GRID_SIZE: 0.0001,
  // 像素大小（度）- 与网格大小完全一致，避免重叠
  PIXEL_SIZE_DEGREES: 0.0001,
  // 像素大小（米）- 基于网格大小计算，确保精确匹配
  PIXEL_SIZE_METERS: 0.0001 * 111000, // 约11.1米
  PIXEL_AREA_METERS: 11.1 * 11.1, // 约123.21平方米
  // 计算每度的像素数量：111000米/度 ÷ 11.1米/像素 ≈ 10000像素/度
  PIXELS_PER_DEGREE_LAT: 111000 / 11.1,
  // 经度需要考虑纬度的影响，在赤道处约为111000米/度
  PIXELS_PER_DEGREE_LNG: 111000 / 11.1,
  GRID_PRECISION: 6,
};

/**
 * 计算网格ID - 与后端完全一致的算法
 * 使用整数格坐标映射，确保每个格子唯一
 */
export function calculateGridId(lat: number, lng: number): string {
  // 计算网格索引，确保像素对齐到网格
  const gridX = Math.floor((lng + 180) / GRID_CONFIG.GRID_SIZE);
  const gridY = Math.floor((lat + 90) / GRID_CONFIG.GRID_SIZE);
  
  return `grid_${gridX}_${gridY}`;
}

/**
 * 网格对齐 - 将坐标对齐到网格中心
 * 使用与后端一致的网格划分逻辑
 */
export function snapToGrid(lat: number, lng: number): { lat: number; lng: number; gridId: string } {
  // 计算网格索引
  const gridX = Math.floor((lng + 180) / GRID_CONFIG.GRID_SIZE);
  const gridY = Math.floor((lat + 90) / GRID_CONFIG.GRID_SIZE);
  
  // 计算网格中心坐标
  const snappedLat = (gridY * GRID_CONFIG.GRID_SIZE) - 90 + (GRID_CONFIG.GRID_SIZE / 2);
  const snappedLng = (gridX * GRID_CONFIG.GRID_SIZE) - 180 + (GRID_CONFIG.GRID_SIZE / 2);
  
  // 生成网格ID
  const gridId = `grid_${gridX}_${gridY}`;
  
  return { 
    lat: snappedLat, 
    lng: snappedLng,
    gridId 
  };
}

/**
 * 计算网格中心坐标
 */
export function calculateGridCenter(gridId: string): { lat: number; lng: number } {
  const parts = gridId.split('_');
  if (parts.length !== 3) {
    throw new Error('无效的网格ID格式');
  }
  
  const gridX = parseInt(parts[1]);
  const gridY = parseInt(parts[2]);
  
  // 计算网格中心坐标
  const lat = (gridY * GRID_CONFIG.GRID_SIZE) - 90 + (GRID_CONFIG.GRID_SIZE / 2);
  const lng = (gridX * GRID_CONFIG.GRID_SIZE) - 180 + (GRID_CONFIG.GRID_SIZE / 2);
  
  return { lat, lng };
}

/**
 * 获取像素在经纬度上的大小
 */
export function getPixelSizeInDegrees(): { lat: number; lng: number } {
  // 返回像素在经纬度上的大小，与网格大小完全一致
  return {
    lat: GRID_CONFIG.PIXEL_SIZE_DEGREES, // 0.0001度
    lng: GRID_CONFIG.PIXEL_SIZE_DEGREES  // 0.0001度
  };
}

/**
 * 验证像素是否完全在网格内
 */
export function validatePixelBounds(lat: number, lng: number, gridId: string): boolean {
  const { lat: snappedLat, lng: snappedLng, gridId: calculatedGridId } = snapToGrid(lat, lng);
  
  // 检查网格ID是否匹配
  if (calculatedGridId !== gridId) {
    return false;
  }
  
  // 检查坐标是否对齐到网格中心
  const expectedLat = Math.round(snappedLat / GRID_CONFIG.GRID_SIZE) * GRID_CONFIG.GRID_SIZE;
  const expectedLng = Math.round(snappedLng / GRID_CONFIG.GRID_SIZE) * GRID_CONFIG.GRID_SIZE;
  
  const latDiff = Math.abs(snappedLat - expectedLat);
  const lngDiff = Math.abs(snappedLng - expectedLng);
  
  return latDiff < 1e-10 && lngDiff < 1e-10;
}

/**
 * 生成像素版本ID
 */
export function generatePixelVersion(gridId: string, timestamp: number): string {
  return `${gridId}_v${timestamp}`;
}

/**
 * 检查两个网格ID是否相同
 */
export function isSameGrid(gridId1: string, gridId2: string): boolean {
  return gridId1 === gridId2;
}

/**
 * 获取网格边界
 */
export function getGridBounds(gridId: string): { 
  minLat: number; 
  maxLat: number; 
  minLng: number; 
  maxLng: number; 
} {
  const parts = gridId.split('_');
  const gridX = parseInt(parts[1]);
  const gridY = parseInt(parts[2]);
  
  const minLat = (gridY * GRID_CONFIG.GRID_SIZE) - 90;
  const maxLat = minLat + GRID_CONFIG.GRID_SIZE;
  const minLng = (gridX * GRID_CONFIG.GRID_SIZE) - 180;
  const maxLng = minLng + GRID_CONFIG.GRID_SIZE;
  
  return { minLat, maxLat, minLng, maxLng };
}

/**
 * 验证坐标是否有效
 */
export function isValidCoordinate(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * 计算两点间距离（米）
 */
export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = GRID_CONFIG.EARTH_RADIUS; // 地球半径（米）
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}