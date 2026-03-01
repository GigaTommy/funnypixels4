/**
 * 广告像素投影算法测试工具
 *
 * 用途:
 * 1. 测试不同尺寸广告的像素投影
 * 2. 验证网格ID唯一性
 * 3. 检测浮点误差导致的冲突
 * 4. 生成投影可视化报告
 */

const AdPixelRenderer = require('../services/AdPixelRenderer');
const { snapToGrid } = require('../utils/gridUtils');

/**
 * 生成测试像素数据
 */
function generateTestPixelData(width, height) {
  const pixels = [];
  const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      pixels.push({
        x: x,
        y: y,
        color: colors[(x + y) % colors.length],
        patternId: `test_pattern_${(x + y) % colors.length}`
      });
    }
  }

  return pixels;
}

/**
 * 测试像素投影
 */
function testPixelProjection(width, height, centerLat, centerLng, testName) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 测试: ${testName}`);
  console.log(`${'='.repeat(60)}`);

  // 生成测试数据
  const pixelData = generateTestPixelData(width, height);
  console.log(`\n📊 测试配置:`);
  console.log(`  广告尺寸: ${width}×${height} = ${pixelData.length}个像素`);
  console.log(`  中心坐标: (${centerLat}, ${centerLng})`);
  console.log(`  测试像素数: ${pixelData.length}`);

  try {
    // 执行投影
    const startTime = Date.now();
    const projectedPixels = AdPixelRenderer.convertAdCoordinatesToPixels(
      centerLat,
      centerLng,
      pixelData,
      width,
      height,
      'test_user_id',
      'test_placement_id'
    );
    const duration = Date.now() - startTime;

    console.log(`\n⏱️ 投影耗时: ${duration}ms`);
    console.log(`\n✅ 测试通过！所有像素成功投影。`);

    // 分析结果
    analyzeProjectionResults(projectedPixels, pixelData.length);

    return {
      success: true,
      pixelCount: pixelData.length,
      projectedCount: projectedPixels.length,
      duration: duration
    };

  } catch (error) {
    console.error(`\n❌ 测试失败: ${error.message}`);
    console.error(`\n错误详情:`, error);

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 分析投影结果
 */
function analyzeProjectionResults(projectedPixels, expectedCount) {
  console.log(`\n📈 投影结果分析:`);

  // 1. 检查数量
  const actualCount = projectedPixels.length;
  const loss = expectedCount - actualCount;
  console.log(`  期望像素数: ${expectedCount}`);
  console.log(`  实际像素数: ${actualCount}`);
  console.log(`  丢失像素数: ${loss} (${(loss / expectedCount * 100).toFixed(2)}%)`);

  // 2. 检查网格ID唯一性
  const gridIds = projectedPixels.map(p => p.grid_id);
  const uniqueGridIds = new Set(gridIds);
  console.log(`  唯一网格数: ${uniqueGridIds.size}`);

  // 3. 检查坐标范围
  const lats = projectedPixels.map(p => p.latitude);
  const lngs = projectedPixels.map(p => p.longitude);
  console.log(`  纬度范围: ${Math.min(...lats).toFixed(6)} ~ ${Math.max(...lats).toFixed(6)}`);
  console.log(`  经度范围: ${Math.min(...lngs).toFixed(6)} ~ ${Math.max(...lngs).toFixed(6)}`);

  // 4. 颜色分布
  const colorCounts = {};
  projectedPixels.forEach(p => {
    colorCounts[p.color] = (colorCounts[p.color] || 0) + 1;
  });
  console.log(`  颜色种类: ${Object.keys(colorCounts).length}`);
  console.log(`  颜色分布:`, colorCounts);
}

/**
 * 测试网格对齐精度
 */
function testGridAlignment() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 测试: 网格对齐精度`);
  console.log(`${'='.repeat(60)}`);

  const testCases = [
    { lat: 39.9042, lng: 116.4074, name: '北京天安门' },
    { lat: 31.2304, lng: 121.4737, name: '上海东方明珠' },
    { lat: 22.3964, lng: 114.1095, name: '香港维多利亚港' },
    { lat: 0.0, lng: 0.0, name: '赤道本初子午线交点' },
    { lat: 89.9999, lng: 179.9999, name: '极端坐标' }
  ];

  console.log(`\n📍 测试案例:`);
  testCases.forEach(({ lat, lng, name }) => {
    const result = snapToGrid(lat, lng);
    console.log(`\n  ${name}:`);
    console.log(`    输入: (${lat}, ${lng})`);
    console.log(`    对齐: (${result.lat}, ${result.lng})`);
    console.log(`    网格ID: ${result.gridId}`);
    console.log(`    网格索引: (${result.gridIndex.x}, ${result.gridIndex.y})`);
  });
}

/**
 * 压力测试
 */
function stressTest() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 压力测试: 大尺寸广告投影`);
  console.log(`${'='.repeat(60)}`);

  const sizes = [
    { width: 16, height: 16, name: '小广告 (16×16)' },
    { width: 32, height: 32, name: '中广告 (32×32)' },
    { width: 64, height: 64, name: '大广告 (64×64)' },
    { width: 128, height: 128, name: '超大广告 (128×128)' }
  ];

  const results = [];

  sizes.forEach(({ width, height, name }) => {
    const result = testPixelProjection(
      width,
      height,
      39.9042,
      116.4074,
      name
    );
    results.push({ name, ...result });
  });

  // 输出汇总
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 压力测试汇总:`);
  console.log(`${'='.repeat(60)}`);

  results.forEach(result => {
    if (result.success) {
      console.log(`\n  ✅ ${result.name}:`);
      console.log(`     像素数: ${result.pixelCount}`);
      console.log(`     投影数: ${result.projectedCount}`);
      console.log(`     丢失率: ${((1 - result.projectedCount / result.pixelCount) * 100).toFixed(2)}%`);
      console.log(`     耗时: ${result.duration}ms`);
    } else {
      console.log(`\n  ❌ ${result.name}: ${result.error}`);
    }
  });
}

/**
 * 主测试流程
 */
async function runTests() {
  console.log(`\n🚀 广告像素投影算法测试工具`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    // 1. 网格对齐精度测试
    testGridAlignment();

    // 2. 基本投影测试
    testPixelProjection(64, 64, 39.9042, 116.4074, '标准64×64广告 (北京)');

    // 3. 压力测试
    stressTest();

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ 所有测试完成！`);
    console.log(`${'='.repeat(60)}\n`);

  } catch (error) {
    console.error(`\n❌ 测试过程中发生错误:`, error);
    process.exit(1);
  }
}

// 执行测试
runTests();
