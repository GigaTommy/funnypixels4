/**
 * 完整广告流程端到端测试
 * 测试: 上传 → 审核 → 使用 → 渲染
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const ImageProcessor = require('./services/imageProcessor');
const AdPixelRenderer = require('./services/AdPixelRenderer');
const { db } = require('./config/database');

// 创建简单的测试图案 - 4x4红蓝格子
async function createTestPattern() {
  const width = 4;
  const height = 4;
  const channels = 4;
  const buffer = Buffer.alloc(width * height * channels);

  console.log('📸 创建测试图案: 4x4红蓝格子');

  // 创建红蓝交替的格子图案
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * channels;
      const isRed = (x + y) % 2 === 0;

      buffer[index] = isRed ? 255 : 0;     // R
      buffer[index + 1] = 0;                // G
      buffer[index + 2] = isRed ? 0 : 255;  // B
      buffer[index + 3] = 255;              // A
    }
  }

  const pngBuffer = await sharp(buffer, {
    raw: { width, height, channels }
  }).png().toBuffer();

  return pngBuffer;
}

// 测试1: 图像处理 (processAdImage)
async function testImageProcessing() {
  console.log('\n========== 测试1: 图像处理 ==========');

  try {
    const testImage = await createTestPattern();
    const base64Data = `data:image/png;base64,${testImage.toString('base64')}`;

    // 调用processAdImage (这是审核通过时调用的函数)
    const result = await ImageProcessor.processAdImage(base64Data, 16, 16);

    console.log('✅ 图像处理结果:');
    console.log(`  - 尺寸: ${result.width}x${result.height}`);
    console.log(`  - 像素数量: ${result.pixelCount}`);
    console.log(`  - 编码方式: ${result.encoding}`);
    console.log(`  - 渲染类型: ${result.render_type}`);

    // 检查像素点格式
    if (Array.isArray(result.pixelData) && result.pixelData.length > 0) {
      console.log(`  - 像素点数组: ${result.pixelData.length}个`);
      console.log('  - 前5个像素点:');
      result.pixelData.slice(0, 5).forEach((p, i) => {
        console.log(`    ${i + 1}. x=${p.x}, y=${p.y}, color=${p.color}`);
      });

      // 统计颜色
      const colorCount = {};
      result.pixelData.forEach(p => {
        colorCount[p.color] = (colorCount[p.color] || 0) + 1;
      });
      console.log('  - 颜色统计:');
      Object.entries(colorCount).forEach(([color, count]) => {
        console.log(`    ${color}: ${count}个像素`);
      });
    } else {
      console.error('❌ 像素点数据格式错误!');
      return null;
    }

    return result;

  } catch (error) {
    console.error('❌ 图像处理测试失败:', error.message);
    console.error(error.stack);
    return null;
  }
}

// 测试2: 颜色验证 (AdPixelRenderer.validateAndConvertColors)
async function testColorValidation(pixelData) {
  console.log('\n========== 测试2: 颜色验证 ==========');

  try {
    const validatedPixels = await AdPixelRenderer.validateAndConvertColors(pixelData);

    console.log('✅ 颜色验证结果:');
    console.log(`  - 验证通过: ${validatedPixels.length}/${pixelData.length}个像素`);

    // 检查pattern_id
    const patternsUsed = new Set();
    validatedPixels.forEach(p => {
      if (p.patternId) patternsUsed.add(p.patternId);
    });

    console.log(`  - 使用的图案: ${patternsUsed.size}种`);
    console.log(`  - 图案列表: ${Array.from(patternsUsed).join(', ')}`);

    // 显示前5个验证后的像素
    console.log('  - 前5个验证后的像素:');
    validatedPixels.slice(0, 5).forEach((p, i) => {
      console.log(`    ${i + 1}. x=${p.x}, y=${p.y}, color=${p.color}, patternId=${p.patternId}`);
    });

    return validatedPixels;

  } catch (error) {
    console.error('❌ 颜色验证失败:', error.message);
    console.error(error.stack);
    return null;
  }
}

// 测试3: 坐标转换 (convertAdCoordinatesToPixelsIntegerGrid)
async function testCoordinateConversion(validatedPixels) {
  console.log('\n========== 测试3: 坐标转换 ==========');

  try {
    // 使用测试坐标
    const centerLat = 39.9042;
    const centerLng = 116.4074;
    const width = 16;
    const height = 16;
    const userId = 'test_user';
    const placementId = 'test_placement';

    console.log(`  - 中心坐标: (${centerLat}, ${centerLng})`);
    console.log(`  - 广告尺寸: ${width}x${height}`);

    const pixelCoordinates = AdPixelRenderer.convertAdCoordinatesToPixelsIntegerGrid(
      centerLat,
      centerLng,
      validatedPixels,
      width,
      height,
      userId,
      placementId
    );

    console.log('✅ 坐标转换结果:');
    console.log(`  - 生成像素: ${pixelCoordinates.length}个`);

    // 显示前5个转换后的像素
    console.log('  - 前5个转换后的像素:');
    pixelCoordinates.slice(0, 5).forEach((p, i) => {
      console.log(`    ${i + 1}. grid_id=${p.grid_id}, lat=${p.latitude}, lng=${p.longitude}, pattern_id=${p.pattern_id}`);
    });

    // 检查坐标范围
    const lats = pixelCoordinates.map(p => p.latitude);
    const lngs = pixelCoordinates.map(p => p.longitude);
    console.log('  - 纬度范围:', Math.min(...lats).toFixed(6), '~', Math.max(...lats).toFixed(6));
    console.log('  - 经度范围:', Math.min(...lngs).toFixed(6), '~', Math.max(...lngs).toFixed(6));

    // 检查是否有重复的grid_id
    const gridIds = pixelCoordinates.map(p => p.grid_id);
    const uniqueGridIds = new Set(gridIds);
    if (gridIds.length !== uniqueGridIds.size) {
      console.warn(`  ⚠️ 检测到重复的grid_id: ${gridIds.length} vs ${uniqueGridIds.size}`);
    } else {
      console.log(`  ✅ 所有grid_id唯一`);
    }

    return pixelCoordinates;

  } catch (error) {
    console.error('❌ 坐标转换失败:', error.message);
    console.error(error.stack);
    return null;
  }
}

// 测试4: 检查数据库中的pattern_assets
async function testPatternAssets() {
  console.log('\n========== 测试4: 检查调色板 ==========');

  try {
    // 检查256色调色板
    const colorPatterns = await db('pattern_assets')
      .where('render_type', 'color')
      .where('category', 'base256color')
      .select('key', 'payload');

    console.log(`✅ 256色调色板: ${colorPatterns.length}种颜色`);

    // 检查是否包含常见颜色
    const testColors = ['#FF0000', '#0000FF', '#00FF00', '#FFFF00', '#FF00FF', '#00FFFF'];
    console.log('  - 检查常见颜色:');
    for (const color of testColors) {
      const found = colorPatterns.find(p => p.payload.toUpperCase() === color);
      console.log(`    ${color}: ${found ? '✅ 存在 (' + found.key + ')' : '❌ 不存在'}`);
    }

    // 检查16色基础调色板
    const basePatterns = await db('pattern_assets')
      .where('render_type', 'color')
      .whereNull('category')
      .orWhere('category', '!=', 'base256color')
      .select('key', 'payload')
      .limit(20);

    console.log(`✅ 基础调色板: ${basePatterns.length}种颜色`);

  } catch (error) {
    console.error('❌ 检查调色板失败:', error.message);
  }
}

// 主测试流程
async function runFullTest() {
  console.log('🔬 开始完整广告流程端到端测试\n');
  console.log('=' .repeat(60));

  try {
    // 测试0: 检查调色板
    await testPatternAssets();

    // 测试1: 图像处理
    const processedResult = await testImageProcessing();
    if (!processedResult || !processedResult.pixelData) {
      console.error('\n❌ 图像处理失败,终止测试');
      return;
    }

    // 测试2: 颜色验证
    const validatedPixels = await testColorValidation(processedResult.pixelData);
    if (!validatedPixels) {
      console.error('\n❌ 颜色验证失败,终止测试');
      return;
    }

    // 测试3: 坐标转换
    const pixelCoordinates = await testCoordinateConversion(validatedPixels);
    if (!pixelCoordinates) {
      console.error('\n❌ 坐标转换失败,终止测试');
      return;
    }

    // 总结
    console.log('\n' + '='.repeat(60));
    console.log('📊 测试总结\n');
    console.log('✅ 所有测试通过!');
    console.log('');
    console.log('流程验证:');
    console.log(`  1. 图像处理 → ${processedResult.pixelCount}个像素点`);
    console.log(`  2. 颜色验证 → ${validatedPixels.length}个有效像素`);
    console.log(`  3. 坐标转换 → ${pixelCoordinates.length}个数据库记录`);
    console.log('');
    console.log('💡 结论:');
    console.log('  如果实际渲染仍有问题,可能原因:');
    console.log('  1. 使用了修复前的旧数据');
    console.log('  2. 瓦片缓存未清理');
    console.log('  3. 前端地图坐标映射问题');

  } catch (error) {
    console.error('❌ 测试异常:', error);
    console.error(error.stack);
  } finally {
    await db.destroy();
  }
}

// 运行测试
runFullTest().then(() => {
  console.log('\n✅ 测试完成');
  process.exit(0);
}).catch(err => {
  console.error('❌ 测试异常:', err);
  process.exit(1);
});
