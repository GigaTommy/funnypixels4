/**
 * 像素瓦片查询辅助函数
 * 支持瓦片合成服务查询瓦片内的所有像素
 */

const { db } = require('../config/database');
const { logger } = require('../utils/logger');

/**
 * 计算瓦片的边界坐标
 * @param {number} z - 缩放级别
 * @param {number} x - 瓦片X坐标
 * @param {number} y - 瓦片Y坐标
 * @returns {Object} {minLng, minLat, maxLng, maxLat}
 */
function tileToBounds(z, x, y) {
  const n = Math.pow(2, z);

  // 经度范围
  const minLng = (x / n) * 360 - 180;
  const maxLng = ((x + 1) / n) * 360 - 180;

  // 纬度范围（Web Mercator投影）
  const minLat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n))) * 180 / Math.PI;
  const maxLat = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI;

  return { minLng, minLat, maxLng, maxLat };
}

/**
 * 获取瓦片内的所有complex类型像素
 * @param {number} z - 缩放级别
 * @param {number} x - 瓦片X坐标
 * @param {number} y - 瓦片Y坐标
 * @returns {Promise<Array>} 像素数组
 */
async function getPixelsInTile(z, x, y) {
  try {
    const { minLng, minLat, maxLng, maxLat } = tileToBounds(z, x, y);

    logger.debug(`🔍 查询瓦片 ${z}/${x}/${y} 内的像素，边界:`, {
      minLng, minLat, maxLng, maxLat
    });

    // SQL查询（假设使用PostgreSQL + PostGIS或MySQL）
    const query = `
      SELECT
        p.id,
        p.grid_id,
        p.lat,
        p.lng,
        p.latitude,
        p.longitude,
        pa.file_url,
        pa.file_path,
        pa.render_type,
        pa.pattern_id,
        pa.material_id
      FROM pixels p
      LEFT JOIN pattern_assets pa ON p.pattern_id = pa.key
      WHERE
        p.lat >= ? AND p.lat <= ?
        AND p.lng >= ? AND p.lng <= ?
        AND pa.render_type = 'complex'
      ORDER BY p.created_at ASC
    `;

    const pixels = await db.query(query, [minLat, maxLat, minLng, maxLng]);

    logger.info(`✅ 瓦片 ${z}/${x}/${y} 找到 ${pixels.length} 个complex像素`);

    return pixels;

  } catch (error) {
    logger.error(`❌ 查询瓦片像素失败: ${z}/${x}/${y}`, error);
    throw error;
  }
}

/**
 * 获取像素影响的所有瓦片坐标
 * @param {number} lat - 纬度
 * @param {number} lng - 经度
 * @param {Array<number>} zoomLevels - 缩放级别数组，默认[12-18]
 * @returns {Array<Object>} 瓦片坐标数组 [{z, x, y}, ...]
 */
function getAffectedTiles(lat, lng, zoomLevels = [12, 13, 14, 15, 16, 17, 18]) {
  const tiles = [];

  for (const z of zoomLevels) {
    const n = Math.pow(2, z);
    const x = Math.floor((lng + 180) / 360 * n);
    const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n);

    tiles.push({ z, x, y });
  }

  return tiles;
}

/**
 * 批量获取多个瓦片的像素数据
 * @param {Array<Object>} tiles - 瓦片数组 [{z, x, y}, ...]
 * @returns {Promise<Map>} 瓦片像素映射
 */
async function batchGetPixelsInTiles(tiles) {
  const results = new Map();

  for (const tile of tiles) {
    const pixels = await getPixelsInTile(tile.z, tile.x, tile.y);
    const key = `${tile.z}/${tile.x}/${tile.y}`;
    results.set(key, pixels);
  }

  return results;
}

module.exports = {
  tileToBounds,
  getPixelsInTile,
  getAffectedTiles,
  batchGetPixelsInTiles
};
