/**
 * 图片处理管道诊断测试
 * 用于定位图片转像素算法问题 vs 数据库写入问题
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const ImageProcessor = require('./services/imageProcessor');

// 创建测试图片 - 简单的红蓝渐变图案
async function createTestImage() {
  const width = 64;
  const height = 64;
  const channels = 4;
  const buffer = Buffer.alloc(width * height * channels);

  console.log('📸 创建测试图片: 64x64 红蓝渐变图案');

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * channels;

      // 左边红色,右边蓝色
      const redRatio = 1 - (x / width);
      const blueRatio = x / width;

      buffer[index] = Math.floor(255 * redRatio);     // R
      buffer[index + 1] = 0;                           // G
      buffer[index + 2] = Math.floor(255 * blueRatio); // B
      buffer[index + 3] = 255;                         // A
    }
  }

  const pngBuffer = await sharp(buffer, {
    raw: { width, height, channels }
  }).png().toBuffer();

  return pngBuffer;
}

// 测试1: ImageProcessor.processUserImage (使用正确的算法)
async function testImageProcessorService(imageBuffer) {
  console.log('\n========== 测试1: ImageProcessor.processUserImage ==========');

  try {
    // 转换为base64
    const base64Data = `data:image/png;base64,${imageBuffer.toString('base64')}`;

    // 调用ImageProcessor处理
    const result = await ImageProcessor.processUserImage(base64Data, 16, 16);

    console.log('✅ ImageProcessor处理结果:');
    console.log(`  - 尺寸: ${result.width}x${result.height}`);
    console.log(`  - 编码: ${result.encoding}`);
    console.log(`  - 渲染类型: ${result.render_type}`);
    console.log(`  - 像素数量: ${result.pixelCount}`);
    console.log(`  - RLE段数: ${result.rleSegments}`);
    console.log(`  - 颜色统计:`, result.colorFeatures.dominantColors.slice(0, 3));

    // 解析RLE数据验证
    const rlePattern = JSON.parse(result.payload);
    console.log(`  - RLE数据: ${rlePattern.length}段`);

    // 显示前5个RLE段
    console.log('  - 前5个RLE段:');
    rlePattern.slice(0, 5).forEach((seg, i) => {
      console.log(`    ${i + 1}. 颜色=${seg.color}, 数量=${seg.count}`);
    });

    return result;

  } catch (error) {
    console.error('❌ ImageProcessor测试失败:', error.message);
    return null;
  }
}

// 测试2: PatternUploadController.convertToRLE (有BUG的版本)
async function testPatternUploadController(imageBuffer) {
  console.log('\n========== 测试2: PatternUploadController.convertToRLE (独立测试) ==========');

  try {
    // 调整尺寸
    const resized = await sharp(imageBuffer)
      .resize(16, 16)
      .png()
      .toBuffer();

    // 直接复制convertToRLE的逻辑,避免加载整个Controller
    const rleData = await convertToRLEBuggyVersion(resized, 16, 16);

    console.log('✅ PatternUploadController处理结果:');
    console.log(`  - RLE数据长度: ${rleData.length} 字符`);

    // 解析RLE数据
    const rleArray = rleData.split(';');
    console.log(`  - RLE段数: ${rleArray.length}`);

    // 显示前5个RLE段
    console.log('  - 前5个RLE段:');
    rleArray.slice(0, 5).forEach((seg, i) => {
      console.log(`    ${i + 1}. ${seg}`);
    });

    // ⚠️ 检查是否是随机生成的
    console.log('\n⚠️ 关键诊断:');
    const uniqueColors = new Set(rleArray);
    console.log(`  - 唯一颜色数: ${uniqueColors.size}/${rleArray.length}`);
    if (uniqueColors.size === rleArray.length) {
      console.log('  ❌ 检测到随机颜色生成! 每个像素颜色都不同 - 这是BUG!');
    } else {
      console.log('  ✅ 颜色有重复,可能是正常的像素数据');
    }

    return rleData;

  } catch (error) {
    console.error('❌ PatternUploadController测试失败:', error.message);
    return null;
  }
}

// 测试3: 直接提取像素数据验证
async function testDirectPixelExtraction(imageBuffer) {
  console.log('\n========== 测试3: 直接提取像素数据 ==========');

  try {
    const { data, info } = await sharp(imageBuffer)
      .resize(16, 16)
      .raw()
      .toBuffer({ resolveWithObject: true });

    console.log('✅ 原始像素数据:');
    console.log(`  - 尺寸: ${info.width}x${info.height}`);
    console.log(`  - 通道数: ${info.channels}`);
    console.log(`  - 数据长度: ${data.length} bytes`);

    // 统计颜色
    const colorCount = {};
    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const color = `${r},${g},${b}`;
      colorCount[color] = (colorCount[color] || 0) + 1;
    }

    const sortedColors = Object.entries(colorCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    console.log('  - Top 5颜色:');
    sortedColors.forEach(([color, count]) => {
      console.log(`    RGB(${color}): ${count}个像素`);
    });

    // 左上角像素应该是红色
    const topLeftR = data[0];
    const topLeftG = data[1];
    const topLeftB = data[2];
    console.log(`\n  - 左上角像素: RGB(${topLeftR}, ${topLeftG}, ${topLeftB})`);
    console.log(`    预期: 接近 RGB(255, 0, 0) 红色`);
    if (topLeftR > 200 && topLeftG < 50 && topLeftB < 50) {
      console.log('    ✅ 正确!');
    } else {
      console.log('    ❌ 异常!');
    }

    // 右上角像素应该是蓝色
    const topRightIndex = (info.width - 1) * info.channels;
    const topRightR = data[topRightIndex];
    const topRightG = data[topRightIndex + 1];
    const topRightB = data[topRightIndex + 2];
    console.log(`  - 右上角像素: RGB(${topRightR}, ${topRightG}, ${topRightB})`);
    console.log(`    预期: 接近 RGB(0, 0, 255) 蓝色`);
    if (topRightR < 50 && topRightG < 50 && topRightB > 200) {
      console.log('    ✅ 正确!');
    } else {
      console.log('    ❌ 异常!');
    }

    return data;

  } catch (error) {
    console.error('❌ 直接提取测试失败:', error.message);
    return null;
  }
}

// 测试4: 视觉对比 - 生成对比图
async function generateComparisonImages(imageBuffer, result1, result2) {
  console.log('\n========== 测试4: 生成视觉对比图 ==========');

  try {
    const outputDir = path.join(__dirname, '../../test_output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 保存原始测试图片
    const originalPath = path.join(outputDir, '1_original.png');
    fs.writeFileSync(originalPath, imageBuffer);
    console.log(`✅ 保存原始图片: ${originalPath}`);

    // 从ImageProcessor结果重建图片
    if (result1 && result1.payload) {
      const rlePattern = JSON.parse(result1.payload);
      const reconstructed1 = await reconstructImageFromRLE(rlePattern, 16, 16);
      const path1 = path.join(outputDir, '2_imageprocessor_result.png');
      fs.writeFileSync(path1, reconstructed1);
      console.log(`✅ 保存ImageProcessor结果: ${path1}`);
    }

    // 从PatternUploadController结果重建图片
    if (result2) {
      const rleArray = result2.split(';');
      const reconstructed2 = await reconstructImageFromSimpleRLE(rleArray, 16, 16);
      const path2 = path.join(outputDir, '3_patternupload_result.png');
      fs.writeFileSync(path2, reconstructed2);
      console.log(`✅ 保存PatternUploadController结果: ${path2}`);
    }

    console.log(`\n📂 所有测试图片已保存到: ${outputDir}`);
    console.log('   请在浏览器或图片查看器中对比这些图片!');

  } catch (error) {
    console.error('❌ 生成对比图失败:', error.message);
  }
}

// 从RLE重建图片
async function reconstructImageFromRLE(rlePattern, width, height) {
  const buffer = Buffer.alloc(width * height * 4);
  let pixelIndex = 0;

  for (const segment of rlePattern) {
    const rgb = hexToRgb(segment.color);
    for (let i = 0; i < segment.count; i++) {
      const bufferIndex = pixelIndex * 4;
      buffer[bufferIndex] = rgb.r;
      buffer[bufferIndex + 1] = rgb.g;
      buffer[bufferIndex + 2] = rgb.b;
      buffer[bufferIndex + 3] = segment.color === 'transparent' ? 0 : 255;
      pixelIndex++;
    }
  }

  return await sharp(buffer, {
    raw: { width, height, channels: 4 }
  }).png().toBuffer();
}

// 从简单RLE重建图片
async function reconstructImageFromSimpleRLE(rleArray, width, height) {
  const buffer = Buffer.alloc(width * height * 4);

  for (let i = 0; i < rleArray.length && i < width * height; i++) {
    const [r, g, b, a] = rleArray[i].split(',').map(Number);
    const bufferIndex = i * 4;
    buffer[bufferIndex] = r;
    buffer[bufferIndex + 1] = g;
    buffer[bufferIndex + 2] = b;
    buffer[bufferIndex + 3] = a || 255;
  }

  return await sharp(buffer, {
    raw: { width, height, channels: 4 }
  }).png().toBuffer();
}

function hexToRgb(hex) {
  if (hex === 'transparent') return { r: 0, g: 0, b: 0 };
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

// 复制有BUG的convertToRLE函数用于测试
async function convertToRLEBuggyVersion(imageBuffer, width, height) {
  // 这是patternUploadController.js中的原始版本(有BUG)
  const metadata = await sharp(imageBuffer).metadata();

  // ❌ 生成简化的RLE数据（实际项目中应该解析像素数据）
  const rle = [];
  for (let i = 0; i < width * height; i++) {
    // ❌ 使用简化的颜色值 - 这是随机的!
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);
    const a = 255;

    rle.push(`${r},${g},${b},${a}`);
  }

  return rle.join(';');
}

// 主测试流程
async function runDiagnostics() {
  console.log('🔬 开始图片处理管道诊断测试\n');
  console.log('目标: 定位是算法问题还是数据库写入问题\n');
  console.log('=' .repeat(60));

  try {
    // 创建测试图片
    const testImage = await createTestImage();

    // 运行所有测试
    const result1 = await testImageProcessorService(testImage);
    const result2 = await testPatternUploadController(testImage);
    await testDirectPixelExtraction(testImage);
    await generateComparisonImages(testImage, result1, result2);

    // 总结
    console.log('\n' + '='.repeat(60));
    console.log('📊 诊断总结\n');

    console.log('🔍 问题定位:');
    console.log('1. ImageProcessor.processUserImage - 使用正确的块平均+抖动算法');
    console.log('2. PatternUploadController.convertToRLE - ❌ 使用随机颜色生成 (BUG!)');
    console.log('');
    console.log('💡 结论:');
    console.log('  问题出在 PatternUploadController.convertToRLE() 函数');
    console.log('  该函数没有读取真实像素数据,而是生成随机颜色');
    console.log('  这解释了为什么最终渲染结果是散乱的色块');
    console.log('');
    console.log('✅ 修复方案:');
    console.log('  1. 删除 PatternUploadController.convertToRLE() 中的随机颜色生成');
    console.log('  2. 改为调用 ImageProcessor.processUserImage() 进行图片处理');
    console.log('  3. 或者重写 convertToRLE() 使用 sharp 正确提取像素数据');
    console.log('');
    console.log('📂 请查看 test_output 目录中的对比图片验证!');

  } catch (error) {
    console.error('❌ 诊断测试失败:', error);
    console.error(error.stack);
  }
}

// 运行测试
runDiagnostics().then(() => {
  console.log('\n✅ 诊断测试完成');
  process.exit(0);
}).catch(err => {
  console.error('❌ 测试异常:', err);
  process.exit(1);
});
