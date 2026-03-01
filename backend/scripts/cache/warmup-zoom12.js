/**
 * Zoom12缓存预热脚本
 *
 * 功能：
 * 1. 预热热点城市区域的Zoom12 tiles
 * 2. 提高缓存命中率，改善用户体验
 * 3. 减少冷缓存请求，降低数据库负载
 *
 * 使用场景：
 * - 服务启动后
 * - 定期维护 (cron job)
 * - 手动触发预热
 */

const productionMVTService = require('../../src/services/productionMVTService');
const logger = require('../../src/utils/logger');

// 热点区域配置
const HOTSPOT_AREAS = [
  { name: '广州', center: [113.264, 23.129], radius: 50, priority: 'high' },
  { name: '北京', center: [116.404, 39.915], radius: 50, priority: 'high' },
  { name: '上海', center: [121.473, 31.230], radius: 50, priority: 'high' },
  { name: '深圳', center: [114.057, 22.543], radius: 50, priority: 'high' },
  { name: '杭州', center: [120.210, 30.246], radius: 30, priority: 'medium' },
  { name: '成都', center: [104.066, 30.572], radius: 30, priority: 'medium' },
  { name: '重庆', center: [106.550, 29.563], radius: 30, priority: 'medium' },
  { name: '南京', center: [118.796, 32.060], radius: 25, priority: 'medium' },
  { name: '武汉', center: [114.305, 30.593], radius: 25, priority: 'medium' },
  { name: '西安', center: [108.940, 34.341], radius: 25, priority: 'low' },
];

/**
 * 将经纬度转换为tile坐标
 * @param {number} lat - 纬度
 * @param {number} lng - 经度
 * @param {number} zoom - 缩放级别
 */
function latLngToTile(lat, lng, zoom) {
  const n = Math.pow(2, zoom);
  const x = Math.floor((lng + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return { x, y };
}

/**
 * 计算两点之间的距离 (Haversine公式)
 * @param {number} lat1 - 点1纬度
 * @param {number} lng1 - 点1经度
 * @param {number} lat2 - 点2纬度
 * @param {number} lng2 - 点2经度
 * @returns {number} 距离 (公里)
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // 地球半径 (公里)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * 获取区域内的所有tiles
 * @param {number} zoom - 缩放级别
 * @param {Array} center - 中心点 [lng, lat]
 * @param {number} radius - 半径 (公里)
 */
function getTilesInRadius(zoom, center, radius) {
  const [centerLng, centerLat] = center;
  const tiles = [];

  // 计算tile大小 (近似)
  const tileSize = 40075 / Math.pow(2, zoom); // km per tile at equator

  // 计算需要覆盖的tile范围
  const tileRange = Math.ceil(radius / tileSize) + 1;

  const centerTile = latLngToTile(centerLat, centerLng, zoom);

  // 遍历附近的tiles
  for (let dx = -tileRange; dx <= tileRange; dx++) {
    for (let dy = -tileRange; dy <= tileRange; dy++) {
      const x = centerTile.x + dx;
      const y = centerTile.y + dy;

      // 检查tile是否在有效范围内
      const n = Math.pow(2, zoom);
      if (x >= 0 && x < n && y >= 0 && y < n) {
        // 计算tile中心点
        const tileLng = (x / n) * 360 - 180;
        const tileLat = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI;

        // 检查是否在半径内
        const distance = calculateDistance(centerLat, centerLng, tileLat, tileLng);
        if (distance <= radius) {
          tiles.push({ z: zoom, x, y });
        }
      }
    }
  }

  return tiles;
}

/**
 * 预热单个区域
 */
async function warmupArea(area) {
  console.log(`\n📍 预热区域: ${area.name}`);
  console.log(`   中心: [${area.center[0]}, ${area.center[1]}]`);
  console.log(`   半径: ${area.radius}km`);
  console.log(`   优先级: ${area.priority}`);

  const tiles = getTilesInRadius(12, area.center, area.radius);
  console.log(`   Tiles数量: ${tiles.length}`);

  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;
  const startTime = Date.now();

  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i];
    const progress = ((i + 1) / tiles.length * 100).toFixed(1);

    try {
      const tileStartTime = Date.now();
      await productionMVTService.getTile(tile.z, tile.x, tile.y, 'br');
      const elapsed = Date.now() - tileStartTime;

      if (elapsed < 10) {
        // 已在缓存中
        skipCount++;
      } else {
        successCount++;
      }

      // 每10个tile输出一次进度
      if ((i + 1) % 10 === 0) {
        process.stdout.write(`\r   进度: ${progress}% (${i + 1}/${tiles.length}) - 成功:${successCount} 跳过:${skipCount} 失败:${failCount}`);
      }

      // 控制请求速率，避免过载 (每个tile间隔50ms)
      await new Promise(resolve => setTimeout(resolve, 50));

    } catch (error) {
      failCount++;
      logger.error('Warmup tile failed', {
        tile: `${tile.z}/${tile.x}/${tile.y}`,
        error: error.message
      });
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n   ✅ 完成: ${successCount}个 | ⏭️ 跳过: ${skipCount}个 | ❌ 失败: ${failCount}个`);
  console.log(`   耗时: ${elapsed}秒`);

  return { successCount, skipCount, failCount, elapsed };
}

/**
 * 主预热流程
 */
async function runWarmup(options = {}) {
  const {
    priority = 'all', // 'all', 'high', 'medium', 'low'
    areas = null // 指定区域名称数组
  } = options;

  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║           Zoom12缓存预热工具                                       ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

  // 过滤区域
  let targetAreas = HOTSPOT_AREAS;
  if (areas) {
    targetAreas = HOTSPOT_AREAS.filter(a => areas.includes(a.name));
  } else if (priority !== 'all') {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    const minPriority = priorityOrder[priority];
    targetAreas = HOTSPOT_AREAS.filter(a => priorityOrder[a.priority] >= minPriority);
  }

  console.log(`📋 预热配置:`);
  console.log(`   优先级: ${priority}`);
  console.log(`   区域数量: ${targetAreas.length}`);
  console.log(`   区域列表: ${targetAreas.map(a => a.name).join(', ')}`);

  const results = [];
  const globalStartTime = Date.now();

  for (const area of targetAreas) {
    const result = await warmupArea(area);
    results.push({ area: area.name, ...result });
  }

  // 总结
  const globalElapsed = ((Date.now() - globalStartTime) / 1000 / 60).toFixed(2);
  const totalSuccess = results.reduce((sum, r) => sum + r.successCount, 0);
  const totalSkip = results.reduce((sum, r) => sum + r.skipCount, 0);
  const totalFail = results.reduce((sum, r) => sum + r.failCount, 0);

  console.log(`\n${'═'.repeat(70)}`);
  console.log('📊 预热总结');
  console.log(`${'═'.repeat(70)}\n`);

  console.log('区域明细:');
  results.forEach(r => {
    console.log(`  ${r.area}: 成功${r.successCount} | 跳过${r.skipCount} | 失败${r.failCount} (${r.elapsed}秒)`);
  });

  console.log(`\n总计:`);
  console.log(`  ✅ 成功: ${totalSuccess}`);
  console.log(`  ⏭️ 跳过: ${totalSkip}`);
  console.log(`  ❌ 失败: ${totalFail}`);
  console.log(`  ⏱️ 总耗时: ${globalElapsed}分钟`);

  // 缓存统计
  try {
    const cacheStats = productionMVTService.getCacheStats();
    console.log(`\n💾 缓存状态:`);
    console.log(`  Raw Cache: ${cacheStats.raw.size} tiles (${(cacheStats.raw.calculatedSize / 1024 / 1024).toFixed(2)}MB)`);
    console.log(`  Compressed Cache: ${cacheStats.compressed.size} tiles (${(cacheStats.compressed.calculatedSize / 1024 / 1024).toFixed(2)}MB)`);
  } catch (error) {
    console.log(`\n⚠️  无法获取缓存统计: ${error.message}`);
  }

  console.log(`\n${'═'.repeat(70)}`);
  console.log('✅ 预热完成');
  console.log(`${'═'.repeat(70)}`);

  process.exit(0);
}

// 命令行参数解析
const args = process.argv.slice(2);
const options = {};

if (args.includes('--high')) {
  options.priority = 'high';
} else if (args.includes('--medium')) {
  options.priority = 'medium';
} else if (args.includes('--low')) {
  options.priority = 'low';
}

const areasIndex = args.indexOf('--areas');
if (areasIndex !== -1 && args[areasIndex + 1]) {
  options.areas = args[areasIndex + 1].split(',');
}

// 运行预热
runWarmup(options).catch(error => {
  console.error('❌ 预热失败:', error);
  process.exit(1);
});
