/**
 * 清除广州中山纪念堂附近的瓦片缓存
 * 用于测试emoji和复杂图案的缩放功能
 */

const { redis } = require('../src/config/redis');
const TileCacheService = require('../src/services/tileCacheService');
const TileSnapshotService = require('../src/services/tileSnapshotService');

// 广州中山纪念堂坐标: 23.1365° N, 113.2674° E
const CENTER_LAT = 23.1365;
const CENTER_LNG = 113.2674;

/**
 * 经纬度转瓦片坐标
 */
function latLngToTile(lat, lng, zoom) {
  const n = Math.pow(2, zoom);
  const x = Math.floor(n * ((lng + 180) / 360));
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(n * (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2);
  return { x, y, z: zoom };
}

/**
 * 获取区域周围的瓦片列表
 */
function getTilesInArea(centerLat, centerLng, zoomLevels, radiusTiles = 2) {
  const tiles = [];

  for (const zoom of zoomLevels) {
    const centerTile = latLngToTile(centerLat, centerLng, zoom);

    // 获取中心瓦片周围的所有瓦片
    for (let dx = -radiusTiles; dx <= radiusTiles; dx++) {
      for (let dy = -radiusTiles; dy <= radiusTiles; dy++) {
        tiles.push({
          z: zoom,
          x: centerTile.x + dx,
          y: centerTile.y + dy
        });
      }
    }
  }

  return tiles;
}

/**
 * 清除瓦片缓存
 */
async function clearTileCache(tile) {
  const tileId = `${tile.z}/${tile.x}/${tile.y}`;

  try {
    // 1. 清除Redis缓存
    await TileCacheService.invalidate(tileId);
    console.log(`✅ 已清除Redis缓存: ${tileId}`);

    // 2. 清除渲染锁（如果有）
    await TileCacheService.clearRendering(tileId);

    // 3. 清除快照缓存（如果需要）
    // 注意：这里可以选择保留快照，只清除Redis缓存即可触发重新渲染

    return true;
  } catch (error) {
    console.error(`❌ 清除缓存失败 ${tileId}:`, error.message);
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🗑️  开始清除广州中山纪念堂附近的瓦片缓存...');
  console.log(`📍 中心坐标: ${CENTER_LAT}° N, ${CENTER_LNG}° E`);
  console.log('');

  // 清除12-18级缩放的瓦片（支持像素渲染的级别）
  const zoomLevels = [12, 13, 14, 15, 16, 17, 18];

  // 获取需要清除的瓦片列表（中心瓦片周围2格）
  const tiles = getTilesInArea(CENTER_LAT, CENTER_LNG, zoomLevels, 2);

  console.log(`📊 需要清除 ${tiles.length} 个瓦片缓存`);
  console.log(`🔍 缩放级别: ${zoomLevels.join(', ')}`);
  console.log('');

  // 显示每个级别的中心瓦片坐标
  console.log('📌 各级别中心瓦片坐标:');
  for (const zoom of zoomLevels) {
    const centerTile = latLngToTile(CENTER_LAT, CENTER_LNG, zoom);
    console.log(`  - 级别 ${zoom}: ${zoom}/${centerTile.x}/${centerTile.y}`);
  }
  console.log('');

  // 清除缓存
  let successCount = 0;
  let failCount = 0;

  for (const tile of tiles) {
    const success = await clearTileCache(tile);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  console.log('');
  console.log('✅ 缓存清除完成！');
  console.log(`📊 统计: 成功 ${successCount} 个, 失败 ${failCount} 个`);
  console.log('');
  console.log('💡 提示:');
  console.log('  1. 刷新前端页面，查看广州中山纪念堂附近的emoji');
  console.log('  2. 缩放地图（12-18级），观察emoji是否随缩放变化');
  console.log('  3. 如果问题仍然存在，可能需要清除前端缓存或浏览器缓存');

  process.exit(0);
}

// 运行脚本
main().catch(error => {
  console.error('❌ 脚本执行失败:', error);
  process.exit(1);
});
