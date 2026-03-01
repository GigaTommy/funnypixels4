/**
 * 测试简化版广告像素投影算法
 *
 * 对比两种方案：
 * 1. 原方案：使用 Math.round 对齐到 0.0001° 网格
 * 2. 简化方案：直接使用 pixelpic 的网格索引计算
 */

const AdPixelRendererSimple = require('../services/AdPixelRenderer_Simple');

/**
 * 生成测试像素数据
 */
function generateTestPixels(width, height) {
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
 * 测试简化版投影
 */
function testSimpleProjection(width, height, centerLat, centerLng, testName) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🧪 测试: ${testName}`);
  console.log(`${'='.repeat(70)}`);

  // 生成测试数据
  const pixelData = generateTestPixels(width, height);

  console.log(`\n📊 测试配置:`);
  console.log(`  广告尺寸: ${width}×${height} = ${pixelData.length}个像素`);
  console.log(`  中心坐标: (${centerLat}, ${centerLng})`);

  try {
    const startTime = Date.now();

    // 执行简化版投影
    const pixels = AdPixelRendererSimple.convertPixelsToGrids(
      centerLat,
      centerLng,
      pixelData,
      width,
      height,
      'test_user_id',
      'test_placement_id'
    );

    const duration = Date.now() - startTime;

    // 分析结果
    console.log(`\n📈 投影结果分析:`);
    console.log(`  耗时: ${duration}ms`);
    console.log(`  输入像素: ${pixelData.length}`);
    console.log(`  输出像素: ${pixels.length}`);

    // 检查网格ID唯一性
    const gridIds = new Set(pixels.map(p => p.grid_id));
    const duplicates = pixels.length - gridIds.size;

    console.log(`  唯一网格: ${gridIds.size}`);
    console.log(`  重复网格: ${duplicates}`);

    if (duplicates === 0) {
      console.log(`  ✅ 无冲突！所有像素都有唯一的网格ID`);
    } else {
      console.log(`  ❌ 发现 ${duplicates} 个重复网格ID`);
    }

    // 检查坐标范围
    const lats = pixels.map(p => p.latitude);
    const lngs = pixels.map(p => p.longitude);
    console.log(`\n📍 坐标范围:`);
    console.log(`  纬度: ${Math.min(...lats).toFixed(6)} ~ ${Math.max(...lats).toFixed(6)}`);
    console.log(`  经度: ${Math.min(...lngs).toFixed(6)} ~ ${Math.max(...lngs).toFixed(6)}`);

    // 验证中心点
    const centerPixel = pixels.find(p => p.grid_id.includes('center')) || pixels[Math.floor(pixels.length / 2)];
    console.log(`\n🎯 中心像素示例:`);
    console.log(`  网格ID: ${pixels[0].grid_id}`);
    console.log(`  坐标: (${pixels[0].latitude}, ${pixels[0].longitude})`);
    console.log(`  颜色: ${pixels[0].color}`);

    return {
      success: true,
      pixelCount: pixelData.length,
      outputCount: pixels.length,
      duplicates: duplicates,
      duration: duration
    };

  } catch (error) {
    console.error(`\n❌ 测试失败:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 对比测试：pixelpic 方法 vs Math.round 方法
 */
function compareProjectionMethods() {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🔬 对比分析：pixelpic方法 vs Math.round方法`);
  console.log(`${'='.repeat(70)}`);

  const testCoord = { lat: 39.9042, lng: 116.4074 };

  console.log(`\n测试坐标: (${testCoord.lat}, ${testCoord.lng})`);

  // pixelpic 方法
  console.log(`\n1️⃣ pixelpic 方法（网格索引计算）:`);
  const GRID_SIZE = Math.floor(40_075_000 / 11);
  const gridX = Math.floor(((testCoord.lng + 180) / 360) * GRID_SIZE);
  const gridY = Math.floor(((testCoord.lat + 90) / 180) * GRID_SIZE);
  console.log(`   网格索引: (${gridX}, ${gridY})`);
  console.log(`   网格ID: grid_${gridX}_${gridY}`);

  // 反向验证
  const lng = (gridX / GRID_SIZE) * 360 - 180;
  const lat = 90 - (gridY / GRID_SIZE) * 180;
  console.log(`   反向计算: (${lat.toFixed(6)}, ${lng.toFixed(6)})`);
  console.log(`   ✅ 特点: 简单直接，无需四舍五入`);

  // Math.round 方法
  console.log(`\n2️⃣ Math.round 方法（度数对齐）:`);
  const GRID_SIZE_DEGREES = 0.0001;
  const latIndex = Math.round((testCoord.lat + 90) / GRID_SIZE_DEGREES);
  const lngIndex = Math.round((testCoord.lng + 180) / GRID_SIZE_DEGREES);
  console.log(`   度数索引: (${lngIndex}, ${latIndex})`);
  console.log(`   网格ID: grid_${lngIndex}_${latIndex}`);

  const lat2 = latIndex * GRID_SIZE_DEGREES - 90;
  const lng2 = lngIndex * GRID_SIZE_DEGREES - 180;
  console.log(`   反向计算: (${lat2.toFixed(6)}, ${lng2.toFixed(6)})`);
  console.log(`   ⚠️ 特点: 涉及四舍五入，可能有浮点误差`);

  // 对比结果
  console.log(`\n📊 两种方法的网格ID ${gridX === lngIndex && gridY === latIndex ? '相同 ✅' : '不同 ⚠️'}`);
}

/**
 * 主测试流程
 */
function runTests() {
  console.log(`\n🚀 简化版广告像素投影测试`);
  console.log(`${'='.repeat(70)}\n`);

  // 对比两种方法
  compareProjectionMethods();

  // 测试不同尺寸
  const tests = [
    { width: 16, height: 16, name: '小广告 16×16' },
    { width: 32, height: 32, name: '中广告 32×32' },
    { width: 64, height: 64, name: '大广告 64×64' },
    { width: 96, height: 96, name: 'pixelpic标准 96×96' },
    { width: 128, height: 128, name: '超大广告 128×128' }
  ];

  const results = [];

  for (const test of tests) {
    const result = testSimpleProjection(
      test.width,
      test.height,
      39.9042,
      116.4074,
      test.name
    );
    results.push({ name: test.name, ...result });
  }

  // 输出汇总
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📊 测试汇总`);
  console.log(`${'='.repeat(70)}\n`);

  results.forEach(result => {
    if (result.success) {
      const status = result.duplicates === 0 ? '✅' : '❌';
      const lossRate = ((result.pixelCount - result.outputCount) / result.pixelCount * 100).toFixed(2);
      console.log(`${status} ${result.name}:`);
      console.log(`   像素数: ${result.pixelCount}`);
      console.log(`   输出数: ${result.outputCount}`);
      console.log(`   重复数: ${result.duplicates}`);
      console.log(`   丢失率: ${lossRate}%`);
      console.log(`   耗时: ${result.duration}ms\n`);
    } else {
      console.log(`❌ ${result.name}: ${result.error}\n`);
    }
  });

  // 最终结论
  const allPassed = results.every(r => r.success && r.duplicates === 0);
  if (allPassed) {
    console.log(`${'='.repeat(70)}`);
    console.log(`✅ 所有测试通过！简化版方案完美运行，0冲突。`);
    console.log(`${'='.repeat(70)}\n`);
  } else {
    console.log(`${'='.repeat(70)}`);
    console.log(`❌ 部分测试失败，请检查日志。`);
    console.log(`${'='.repeat(70)}\n`);
  }
}

// 执行测试
runTests();
