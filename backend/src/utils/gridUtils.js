/**
 * 网格工具函数
 * 与前端保持一致的网格对齐算法
 */

/**
 * 网格对齐函数 - 高精度版本
 * @param {number} lat - 纬度
 * @param {number} lng - 经度
 * @returns {Object} 对齐后的坐标和网格ID
 */
function snapToGrid(lat, lng) {
  const GRID_SIZE = 0.0001; // 网格大小（度）≈ 11米

  // 🔧 修复：处理浮点精度问题，与数据库保持一致
  // 使用一个小epsilon来避免浮点误差导致的边界问题
  const EPSILON = 1e-10;

  // 1. 转换为整数网格坐标，使用修复的计算方法
  const latRaw = (lat + 90) / GRID_SIZE;
  const lngRaw = (lng + 180) / GRID_SIZE;

  // 添加epsilon避免浮点精度问题，然后使用floor确保与数据库一致
  const latGridIndex = Math.floor(latRaw + EPSILON);
  const lngGridIndex = Math.floor(lngRaw + EPSILON);

  // 2. 转换回地理坐标（保证精度）
  const snappedLat = parseFloat((latGridIndex * GRID_SIZE - 90).toFixed(6));
  const snappedLng = parseFloat((lngGridIndex * GRID_SIZE - 180).toFixed(6));

  // 3. 生成网格ID（使用整数索引，避免浮点计算）
  const gridId = `grid_${lngGridIndex}_${latGridIndex}`;

  return {
    lat: snappedLat,
    lng: snappedLng,
    gridId: gridId,
    // 返回网格索引用于调试
    gridIndex: {
      x: lngGridIndex,
      y: latGridIndex
    }
  };
}

/**
 * 计算网格ID - 高精度版本
 * @param {number} lat - 纬度
 * @param {number} lng - 经度
 * @returns {string} 网格ID
 */
function calculateGridId(lat, lng) {
  const GRID_SIZE = 0.0001;
  const EPSILON = 1e-10;

  // 使用与 snapToGrid 相同的修复方法
  const latRaw = (lat + 90) / GRID_SIZE;
  const lngRaw = (lng + 180) / GRID_SIZE;
  const latGridIndex = Math.floor(latRaw + EPSILON);
  const lngGridIndex = Math.floor(lngRaw + EPSILON);

  return `grid_${lngGridIndex}_${latGridIndex}`;
}

/**
 * 验证坐标是否有效
 * @param {number} lat - 纬度
 * @param {number} lng - 经度
 * @returns {boolean} 是否有效
 */
function isValidCoordinate(lat, lng) {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * 从网格索引转换为地理坐标
 * @param {number} gridX - 经度网格索引
 * @param {number} gridY - 纬度网格索引
 * @returns {Object} 地理坐标
 */
function gridIndexToLatLng(gridX, gridY) {
  const GRID_SIZE = 0.0001;
  return {
    lat: parseFloat((gridY * GRID_SIZE - 90).toFixed(6)),
    lng: parseFloat((gridX * GRID_SIZE - 180).toFixed(6))
  };
}

/**
 * 验证网格ID是否有效
 * @param {string} gridId - 网格ID
 * @returns {boolean} 是否有效
 */
function isValidGridId(gridId) {
  if (typeof gridId !== 'string') return false;
  const match = gridId.match(/^grid_(-?\d+)_(-?\d+)$/);
  return match !== null;
}

/**
 * 从网格ID解析网格索引
 * @param {string} gridId - 网格ID
 * @returns {Object|null} 网格索引或null
 */
function parseGridId(gridId) {
  if (typeof gridId !== 'string') return null;
  const match = gridId.match(/^grid_(-?\d+)_(-?\d+)$/);
  if (!match) return null;
  return {
    x: parseInt(match[1], 10),
    y: parseInt(match[2], 10)
  };
}

module.exports = {
  snapToGrid,
  calculateGridId,
  isValidCoordinate,
  gridIndexToLatLng,
  isValidGridId,
  parseGridId
};
