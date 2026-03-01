/**
 * 统一的网格计算工具
 * 确保前后端使用完全一致的网格计算逻辑
 */

// 网格配置常量
const GRID_CONFIG = {
  GRID_SIZE: 0.0001, // 网格大小（度）
  EARTH_RADIUS: 6371000, // 地球半径（米）
  TOTAL_PIXELS: 4000000000000 // 4万亿像素
};

/**
 * 计算网格ID - 统一的算法
 * 使用整数格坐标映射，确保每个格子唯一
 * 
 * @param {number} lat - 纬度
 * @param {number} lng - 经度
 * @returns {string} 网格ID
 */
function calculateGridId(lat, lng) {
  // 与前端完全一致的计算方式
  const gridX = Math.floor((lng + 180) / GRID_CONFIG.GRID_SIZE);
  const gridY = Math.floor((lat + 90) / GRID_CONFIG.GRID_SIZE);
  
  return `grid_${gridX}_${gridY}`;
}

/**
 * 网格对齐 - 将坐标对齐到网格中心
 * 
 * @param {number} lat - 纬度
 * @param {number} lng - 经度
 * @returns {Object} 包含对齐后坐标和网格ID的对象
 */
function snapToGrid(lat, lng) {
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
 * 
 * @param {string} gridId - 网格ID
 * @returns {Object} 网格中心坐标
 */
function calculateGridCenter(gridId) {
  const parts = gridId.split('_');
  const gridX = parseInt(parts[1]);
  const gridY = parseInt(parts[2]);
  
  // 计算网格中心坐标
  const lat = (gridY * GRID_CONFIG.GRID_SIZE) - 90 + (GRID_CONFIG.GRID_SIZE / 2);
  const lng = (gridX * GRID_CONFIG.GRID_SIZE) - 180 + (GRID_CONFIG.GRID_SIZE / 2);
  
  return { lat, lng };
}

/**
 * 获取网格边界
 * 
 * @param {string} gridId - 网格ID
 * @returns {Object} 网格边界
 */
function getGridBounds(gridId) {
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
 * 
 * @param {number} lat - 纬度
 * @param {number} lng - 经度
 * @returns {boolean} 坐标是否有效
 */
function isValidCoordinate(lat, lng) {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * 检查两个网格ID是否相同
 * 
 * @param {string} gridId1 - 第一个网格ID
 * @param {string} gridId2 - 第二个网格ID
 * @returns {boolean} 是否相同
 */
function isSameGrid(gridId1, gridId2) {
  return gridId1 === gridId2;
}

/**
 * 计算两点间距离（米）
 * 
 * @param {number} lat1 - 第一个点的纬度
 * @param {number} lng1 - 第一个点的经度
 * @param {number} lat2 - 第二个点的纬度
 * @param {number} lng2 - 第二个点的经度
 * @returns {number} 距离（米）
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = GRID_CONFIG.EARTH_RADIUS; // 地球半径（米）
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * 验证像素是否完全在网格内
 * 
 * @param {number} lat - 纬度
 * @param {number} lng - 经度
 * @param {string} gridId - 网格ID
 * @returns {boolean} 像素是否完全在网格内
 */
function validatePixelBounds(lat, lng, gridId) {
  const { lat: snappedLat, lng: snappedLng, gridId: calculatedGridId } = snapToGrid(lat, lng);
  
  // 检查网格ID是否匹配
  if (calculatedGridId !== gridId) {
    return false;
  }
  
  // 从网格ID反推网格中心坐标
  const parts = gridId.split('_');
  if (parts.length !== 3) {
    return false;
  }
  
  const gridX = parseInt(parts[1]);
  const gridY = parseInt(parts[2]);
  
  // 计算网格中心坐标
  const expectedLat = (gridY * GRID_CONFIG.GRID_SIZE) - 90 + (GRID_CONFIG.GRID_SIZE / 2);
  const expectedLng = (gridX * GRID_CONFIG.GRID_SIZE) - 180 + (GRID_CONFIG.GRID_SIZE / 2);
  
  // 检查坐标是否对齐到网格中心（允许一定的精度误差）
  const latDiff = Math.abs(snappedLat - expectedLat);
  const lngDiff = Math.abs(snappedLng - expectedLng);
  
  // 使用更宽松的精度要求：1e-8度（约1毫米精度）
  const tolerance = 1e-8;
  
  return latDiff < tolerance && lngDiff < tolerance;
}

module.exports = {
  GRID_CONFIG,
  calculateGridId,
  snapToGrid,
  calculateGridCenter,
  getGridBounds,
  isValidCoordinate,
  isSameGrid,
  calculateDistance,
  validatePixelBounds
};
