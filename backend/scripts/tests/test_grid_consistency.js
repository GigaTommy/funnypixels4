/**
 * 测试网格系统一致性
 * 验证 AdPixelRenderer_Simple 和 pixelBatchService 使用相同的网格计算方法
 */

const AdPixelRendererSimple = require('../services/AdPixelRenderer_Simple');

console.log('🧪 测试网格系统一致性\n');

// 测试用例：中心点坐标
const testCases = [
  { lat: 39.9042, lng: 116.4074, name: '北京天安门' },
  { lat: 31.2304, lng: 121.4737, name: '上海' },
  { lat: 22.3193, lng: 114.1694, name: '香港' },
  { lat: 0, lng: 0, name: '赤道本初子午线' }
];

// 测试图片尺寸
const testSizes = [
  { width: 64, height: 64, name: '64x64' },
  { width: 96, height: 96, name: '96x96' }
];

console.log('📍 测试网格ID计算一致性\n');

for (const testCase of testCases) {
  console.log(`\n🔍 测试地点: ${testCase.name} (${testCase.lat}, ${testCase.lng})`);

  // 使用 AdPixelRenderer_Simple 的方法计算 gridId
  const gridId = AdPixelRendererSimple.latLngToGridId(testCase.lat, testCase.lng);

  // 使用相同的算法（模拟 pixelBatchService.calculateGridId）
  const GRID_SIZE = 0.0001;
  const gridX = Math.floor(testCase.lng / GRID_SIZE);
  const gridY = Math.floor(testCase.lat / GRID_SIZE);
  const expectedGridId = `grid_${gridX}_${gridY}`;

  console.log(`  AdPixelRenderer: ${gridId}`);
  console.log(`  Expected:        ${expectedGridId}`);
  console.log(`  ✅ 一致: ${gridId === expectedGridId}`);
}

console.log('\n\n📐 测试连续区域网格覆盖\n');

for (const size of testSizes) {
  console.log(`\n🖼️ 测试尺寸: ${size.name}`);

  // 模拟像素数据
  const pixelData = [];
  for (let y = 0; y < size.height; y++) {
    for (let x = 0; x < size.width; x++) {
      pixelData.push({
        x: x,
        y: y,
        color: '#FFFFFF'
      });
    }
  }

  console.log(`  生成像素: ${pixelData.length}个 (${size.width} × ${size.height})`);

  // 使用北京坐标测试
  const centerLat = 39.9042;
  const centerLng = 116.4074;

  const pixels = AdPixelRendererSimple.convertPixelsToGrids(
    centerLat,
    centerLng,
    pixelData,
    size.width,
    size.height,
    'test-user',
    'test-placement'
  );

  console.log(`  转换结果: ${pixels.length}个像素`);

  // 验证唯一性
  const gridIds = new Set(pixels.map(p => p.grid_id));
  console.log(`  唯一网格数: ${gridIds.size}`);
  console.log(`  ${gridIds.size === pixels.length ? '✅' : '❌'} 网格ID唯一性: ${gridIds.size === pixels.length}`);

  // 验证连续性：检查是否所有相邻格子都存在
  const gridMap = new Map();
  pixels.forEach(p => {
    const match = p.grid_id.match(/grid_(-?\d+)_(-?\d+)/);
    if (match) {
      const x = parseInt(match[1]);
      const y = parseInt(match[2]);
      gridMap.set(`${x},${y}`, true);
    }
  });

  // 获取网格范围
  const gridXs = Array.from(gridMap.keys()).map(k => parseInt(k.split(',')[0]));
  const gridYs = Array.from(gridMap.keys()).map(k => parseInt(k.split(',')[1]));
  const minX = Math.min(...gridXs);
  const maxX = Math.max(...gridXs);
  const minY = Math.min(...gridYs);
  const maxY = Math.max(...gridYs);

  const expectedWidth = maxX - minX + 1;
  const expectedHeight = maxY - minY + 1;
  const expectedCount = expectedWidth * expectedHeight;

  console.log(`  网格范围: X[${minX}, ${maxX}] (${expectedWidth}格), Y[${minY}, ${maxY}] (${expectedHeight}格)`);
  console.log(`  期望格子数: ${expectedCount}`);
  console.log(`  实际格子数: ${gridIds.size}`);

  // 检查是否有缺失的格子
  let missingCount = 0;
  const missing = [];
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      if (!gridMap.has(`${x},${y}`)) {
        missingCount++;
        if (missing.length < 5) {
          missing.push(`(${x},${y})`);
        }
      }
    }
  }

  if (missingCount === 0) {
    console.log(`  ✅ 连续性检查: 完美！所有格子连续，无缺失`);
  } else {
    console.log(`  ❌ 连续性检查: 发现${missingCount}个缺失格子`);
    console.log(`  缺失示例: ${missing.join(', ')}${missingCount > 5 ? '...' : ''}`);
  }
}

console.log('\n\n✅ 测试完成！');
