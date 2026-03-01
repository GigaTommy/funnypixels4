/**
 * Emoji缩放问题诊断脚本
 *
 * 目的:
 * 1. 验证calculateOptimalPixelSize()算法是否正确
 * 2. 验证drawEmojiFallback()是否使用正确的size参数
 * 3. 检查广州中山纪念堂的emoji像素数据
 * 4. 模拟不同zoom级别的渲染,查看实际size
 */

require('dotenv').config();
const { db } = require('../src/config/database');
const TileRenderer = require('../src/services/tileRenderer');

// 广州中山纪念堂坐标
const TEST_LAT = 23.1365;
const TEST_LNG = 113.2674;

/**
 * 测试calculateOptimalPixelSize算法
 */
function testCalculateOptimalPixelSize() {
  console.log('\n' + '='.repeat(60));
  console.log('📐 测试 calculateOptimalPixelSize() 算法');
  console.log('='.repeat(60));

  const zoomLevels = [12, 13, 14, 15, 16, 17, 18];

  console.log('\n| Zoom级别 | 返回Size | 预期行为 |');
  console.log('|---------|---------|---------|');

  for (const zoom of zoomLevels) {
    const size = TileRenderer.calculateOptimalPixelSize(zoom);
    const expected = zoom <= 12 ? '4px (最小)'
                   : zoom === 13 ? '8px'
                   : zoom === 14 ? '16px'
                   : zoom === 15 ? '24px'
                   : zoom === 16 ? '32px'
                   : zoom === 17 ? '48px'
                   : '64px (最大)';

    const status = size.toString() === expected.match(/\d+/)[0] ? '✅' : '❌';
    console.log(`| ${zoom} | ${size}px | ${expected} ${status} |`);
  }
}

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
 * 查找测试区域的emoji像素
 */
async function findEmojiPixelsInTestArea() {
  console.log('\n' + '='.repeat(60));
  console.log('🔍 查找广州中山纪念堂附近的emoji像素');
  console.log('='.repeat(60));
  console.log(`📍 测试坐标: ${TEST_LAT}° N, ${TEST_LNG}° E`);

  // 查询附近0.01度范围内的像素
  const pixels = await db('pixels')
    .select(
      'pixels.id',
      'pixels.grid_id',
      'pixels.latitude',
      'pixels.longitude',
      'pixels.color',
      'pixels.pattern_id',
      'pattern_assets.key as pattern_key',
      'pattern_assets.render_type',
      'pattern_assets.unicode_char'
    )
    .leftJoin('pattern_assets', function() {
      this.on(db.raw("CASE WHEN pixels.pattern_id ~ '^[0-9]+$' THEN CAST(pixels.pattern_id AS INTEGER) ELSE NULL END"), '=', 'pattern_assets.id')
        .orOn('pixels.pattern_id', '=', 'pattern_assets.key');
    })
    .where('pixels.latitude', '>=', TEST_LAT - 0.01)
    .where('pixels.latitude', '<=', TEST_LAT + 0.01)
    .where('pixels.longitude', '>=', TEST_LNG - 0.01)
    .where('pixels.longitude', '<=', TEST_LNG + 0.01)
    .whereNotNull('pixels.pattern_id')
    .where('pattern_assets.render_type', 'emoji')
    .limit(20);

  console.log(`\n✅ 找到 ${pixels.length} 个emoji像素`);

  if (pixels.length === 0) {
    console.log('\n⚠️ 警告: 测试区域没有emoji像素!');
    console.log('   请确认广州中山纪念堂 (23.1365° N, 113.2674° E) 附近是否有🌈emoji');
    return [];
  }

  console.log('\n| ID | 坐标 | Emoji | Pattern ID | Pattern Key |');
  console.log('|-----|------|-------|------------|-------------|');

  for (const pixel of pixels) {
    const lat = parseFloat(pixel.latitude);
    const lng = parseFloat(pixel.longitude);
    console.log(
      `| ${pixel.id} | ` +
      `(${lat.toFixed(6)}, ${lng.toFixed(6)}) | ` +
      `${pixel.unicode_char || '❓'} | ` +
      `${pixel.pattern_id} | ` +
      `${pixel.pattern_key || 'N/A'} |`
    );
  }

  return pixels;
}

/**
 * 模拟不同zoom级别的瓦片渲染
 */
async function simulateTileRendering(pixels) {
  if (pixels.length === 0) {
    console.log('\n⚠️ 没有emoji像素,跳过渲染模拟');
    return;
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎨 模拟不同Zoom级别的瓦片渲染');
  console.log('='.repeat(60));

  const testPixel = pixels[0];
  const testLat = parseFloat(testPixel.latitude);
  const testLng = parseFloat(testPixel.longitude);
  console.log(`\n📌 测试像素: ${testPixel.unicode_char || '❓'} at (${testLat}, ${testLng})`);
  console.log(`   Pattern ID: ${testPixel.pattern_id}, Pattern Key: ${testPixel.pattern_key}`);

  const zoomLevels = [12, 14, 16, 18];

  console.log('\n| Zoom | 瓦片坐标 | basePixelSize | 像素在瓦片中的位置 |');
  console.log('|------|---------|--------------|------------------|');

  for (const zoom of zoomLevels) {
    const tile = latLngToTile(testLat, testLng, zoom);
    const bounds = TileRenderer.tileToBounds(zoom, tile.x, tile.y);

    // 计算像素在瓦片中的位置
    const lngRange = bounds.east - bounds.west;
    const latRange = bounds.north - bounds.south;
    const x = ((testLng - bounds.west) / lngRange) * 256;
    const y = ((bounds.north - testLat) / latRange) * 256;

    const basePixelSize = TileRenderer.calculateOptimalPixelSize(zoom);

    console.log(
      `| ${zoom} | ` +
      `${zoom}/${tile.x}/${tile.y} | ` +
      `${basePixelSize}px | ` +
      `(${x.toFixed(1)}, ${y.toFixed(1)}) |`
    );
  }

  console.log('\n💡 解读:');
  console.log('   - basePixelSize应该随zoom增加而增加');
  console.log('   - Zoom 12: 4px → Zoom 18: 64px');
  console.log('   - 同一个emoji在不同zoom级别的瓦片中占据不同的像素空间');
}

/**
 * 检查最近渲染的瓦片日志
 */
async function checkRecentTileRendering() {
  console.log('\n' + '='.repeat(60));
  console.log('📋 检查瓦片渲染逻辑');
  console.log('='.repeat(60));

  console.log('\n🔍 当前TileRenderer.calculateOptimalPixelSize源代码:');
  console.log('---');
  console.log(TileRenderer.calculateOptimalPixelSize.toString());
  console.log('---');

  console.log('\n✅ 算法检查:');

  // 检查算法是否按预期工作
  const checks = [
    { zoom: 12, expected: 4 },
    { zoom: 13, expected: 8 },
    { zoom: 14, expected: 16 },
    { zoom: 15, expected: 24 },
    { zoom: 16, expected: 32 },
    { zoom: 17, expected: 48 },
    { zoom: 18, expected: 64 }
  ];

  let allPassed = true;
  for (const { zoom, expected } of checks) {
    const actual = TileRenderer.calculateOptimalPixelSize(zoom);
    const passed = actual === expected;
    if (!passed) allPassed = false;
    console.log(`   Zoom ${zoom}: 期望=${expected}px, 实际=${actual}px ${passed ? '✅' : '❌'}`);
  }

  if (allPassed) {
    console.log('\n✅ 所有zoom级别的size计算正确!');
  } else {
    console.log('\n❌ 算法有问题,请检查tileRenderer.js的calculateOptimalPixelSize方法');
  }
}

/**
 * 提供修复建议
 */
function provideFixes() {
  console.log('\n' + '='.repeat(60));
  console.log('🛠️  修复建议');
  console.log('='.repeat(60));

  console.log('\n如果问题仍然存在,请依次检查:');
  console.log('\n1️⃣  **后端服务是否重启**');
  console.log('   cd backend');
  console.log('   npm run dev');
  console.log('   或');
  console.log('   pm2 restart all');

  console.log('\n2️⃣  **清除Redis瓦片缓存**');
  console.log('   node backend/scripts/clear-all-tiles-cache-simple.js');

  console.log('\n3️⃣  **清除前端IndexedDB缓存**');
  console.log('   在浏览器控制台运行:');
  console.log('   indexedDB.deleteDatabase("funnypixels-tile-cache");');
  console.log('   localStorage.clear();');
  console.log('   location.reload();');

  console.log('\n4️⃣  **检查浏览器Network面板**');
  console.log('   - 打开开发者工具 → Network标签');
  console.log('   - 筛选 "tiles" 或 "png"');
  console.log('   - 查看瓦片请求的URL,确认zoom参数');
  console.log('   - 确认返回状态是200(重新渲染)而不是304(缓存)');

  console.log('\n5️⃣  **添加调试日志**');
  console.log('   在 tileRenderer.js 的 renderPixelsToCanvas 方法中');
  console.log('   console.log 已经添加,查看后端控制台输出:');
  console.log('   "🎯 渲染瓦片 zoom=14, basePixelSize=16px"');

  console.log('\n6️⃣  **如果仍然不工作**');
  console.log('   问题可能不在后端渲染,而在:');
  console.log('   - 前端地图库覆盖了瓦片缩放');
  console.log('   - CSS样式影响了瓦片显示');
  console.log('   - 瓦片层级配置问题');
  console.log('   需要检查前端 tileLayerManager.ts 和 AmapCanvas.tsx');
}

/**
 * 主函数
 */
async function main() {
  console.log('\n');
  console.log('╔' + '═'.repeat(58) + '╗');
  console.log('║' + ' '.repeat(15) + 'Emoji缩放问题诊断工具' + ' '.repeat(17) + '║');
  console.log('╚' + '═'.repeat(58) + '╝');

  try {
    // 1. 测试算法
    testCalculateOptimalPixelSize();

    // 2. 查找emoji像素
    const pixels = await findEmojiPixelsInTestArea();

    // 3. 模拟渲染
    await simulateTileRendering(pixels);

    // 4. 检查渲染逻辑
    await checkRecentTileRendering();

    // 5. 提供修复建议
    provideFixes();

    console.log('\n' + '='.repeat(60));
    console.log('✅ 诊断完成!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ 诊断过程中出错:', error);
    console.error(error.stack);
  }

  process.exit(0);
}

main().catch(error => {
  console.error('❌ 脚本执行失败:', error);
  process.exit(1);
});
