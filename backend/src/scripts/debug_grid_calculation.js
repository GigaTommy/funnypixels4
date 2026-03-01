/**
 * 调试网格计算精度问题
 */

const GRID_SIZE_DEGREES = 0.0001;

// 测试参数
const centerLat = 39.9042;
const centerLng = 116.4074;
const width = 10;
const height = 10;

console.log('🧪 调试网格计算精度\n');
console.log(`中心坐标: (${centerLat}, ${centerLng})`);
console.log(`尺寸: ${width}×${height}\n`);

// 计算起始坐标
const startLng = centerLng - (Math.floor(width / 2) * GRID_SIZE_DEGREES);
const startLat = centerLat + (Math.floor(height / 2) * GRID_SIZE_DEGREES);

console.log(`起始坐标: (${startLat}, ${startLng})`);
console.log(`Math.floor(${width}/2) = ${Math.floor(width / 2)}`);
console.log(`Math.floor(${height}/2) = ${Math.floor(height / 2)}\n`);

console.log('前10个像素的坐标和gridId:\n');

const gridMap = new Map();

for (let y = 0; y < 10; y++) {
  for (let x = 0; x < 10; x++) {
    // 当前计算方法
    const lng = startLng + (x * GRID_SIZE_DEGREES);
    const lat = startLat - (y * GRID_SIZE_DEGREES);

    const gridX = Math.floor(lng / GRID_SIZE_DEGREES);
    const gridY = Math.floor(lat / GRID_SIZE_DEGREES);
    const gridId = `grid_${gridX}_${gridY}`;

    if (x < 3 && y < 3) {
      console.log(`像素(${x},${y}):`);
      console.log(`  经度: ${startLng} + ${x} * ${GRID_SIZE_DEGREES} = ${lng}`);
      console.log(`  纬度: ${startLat} - ${y} * ${GRID_SIZE_DEGREES} = ${lat}`);
      console.log(`  gridX: Math.floor(${lng} / ${GRID_SIZE_DEGREES}) = ${gridX}`);
      console.log(`  gridY: Math.floor(${lat} / ${GRID_SIZE_DEGREES}) = ${gridY}`);
      console.log(`  gridId: ${gridId}\n`);
    }

    // 记录gridId
    const key = `${gridX},${gridY}`;
    if (!gridMap.has(key)) {
      gridMap.set(key, []);
    }
    gridMap.get(key).push(`(${x},${y})`);
  }
}

console.log('\n📊 网格分布统计:\n');
console.log(`总像素数: 100`);
console.log(`唯一格子数: ${gridMap.size}`);

if (gridMap.size !== 100) {
  console.log('\n❌ 发现重复！以下格子包含多个像素:\n');
  for (const [gridKey, pixels] of gridMap.entries()) {
    if (pixels.length > 1) {
      console.log(`  格子 ${gridKey}: ${pixels.join(', ')}`);
    }
  }
}

console.log('\n\n🔍 问题分析:\n');
console.log('可能的原因:');
console.log('1. 浮点数精度问题: 连续加法可能累积误差');
console.log('2. 起始坐标没有对齐到网格边界\n');

console.log('💡 建议的解决方案:\n');
console.log('方案1: 先对齐起始坐标到网格边界');
console.log('方案2: 使用整数网格索引计算，避免浮点运算');

console.log('\n\n🧪 测试方案2: 使用整数网格索引\n');

// 计算中心点的网格索引
const centerGridX = Math.floor(centerLng / GRID_SIZE_DEGREES);
const centerGridY = Math.floor(centerLat / GRID_SIZE_DEGREES);

console.log(`中心网格索引: (${centerGridX}, ${centerGridY})`);

// 计算起始网格索引
const startGridX = centerGridX - Math.floor(width / 2);
const startGridY = centerGridY + Math.floor(height / 2);

console.log(`起始网格索引: (${startGridX}, ${startGridY})\n`);

const gridMap2 = new Map();

for (let y = 0; y < 10; y++) {
  for (let x = 0; x < 10; x++) {
    // 直接使用整数网格索引
    const gridX = startGridX + x;
    const gridY = startGridY - y;
    const gridId = `grid_${gridX}_${gridY}`;

    // 从网格索引反推经纬度
    const lng = gridX * GRID_SIZE_DEGREES;
    const lat = gridY * GRID_SIZE_DEGREES;

    if (x < 3 && y < 3) {
      console.log(`像素(${x},${y}):`);
      console.log(`  gridX: ${startGridX} + ${x} = ${gridX}`);
      console.log(`  gridY: ${startGridY} - ${y} = ${gridY}`);
      console.log(`  经度: ${gridX} * ${GRID_SIZE_DEGREES} = ${lng}`);
      console.log(`  纬度: ${gridY} * ${GRID_SIZE_DEGREES} = ${lat}`);
      console.log(`  gridId: ${gridId}\n`);
    }

    const key = `${gridX},${gridY}`;
    if (!gridMap2.has(key)) {
      gridMap2.set(key, []);
    }
    gridMap2.get(key).push(`(${x},${y})`);
  }
}

console.log('\n📊 方案2结果:\n');
console.log(`总像素数: 100`);
console.log(`唯一格子数: ${gridMap2.size}`);
console.log(`✅ ${gridMap2.size === 100 ? '完美！每个像素都有唯一的格子' : '仍有问题'}`);
