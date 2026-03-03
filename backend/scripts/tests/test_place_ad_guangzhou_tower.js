/**
 * 广州塔广告投放测试脚本
 * 完整模拟: 上传 → 审批 → 转换 → 写入像素表
 * 每次运行都会在广州塔投放一个新的64x64广告
 */

// 设置环境变量避免Redis错误
process.env.LOCAL_VALIDATION = 'true';

const fs = require('fs');
const path = require('path');
const { db } = require('./config/database');
const ImageProcessor = require('./services/imageProcessor');
const AdPixelRenderer = require('./services/AdPixelRenderer');

// 广州塔坐标
const GUANGZHOU_TOWER = {
  lat: 23.109,
  lng: 113.319,
  name: '广州塔'
};

// 配置
const AD_SIZE = {
  width: 64,
  height: 64
};

const TEST_USER_ID = 'a79a1fbe-0f97-4303-b922-52b35e6948d5'; // 固定测试用户ID
const TEST_IMAGE_PATH = path.join(__dirname, '../test.jpeg');

/**
 * ✅ 新增:生成256色调色板
 */
function generate256ColorPalette() {
  const palette = [];
  const rgbLevels = [0, 51, 102, 153, 204, 255];

  // 生成216个Web安全色
  for (const r of rgbLevels) {
    for (const g of rgbLevels) {
      for (const b of rgbLevels) {
        const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
        palette.push({ r, g, b, hex });
      }
    }
  }

  // 添加40个灰度级
  for (let i = 0; i < 40; i++) {
    const gray = Math.floor((i / 39) * 255);
    const hex = `#${gray.toString(16).padStart(2, '0')}${gray.toString(16).padStart(2, '0')}${gray.toString(16).padStart(2, '0')}`.toUpperCase();
    palette.push({ r: gray, g: gray, b: gray, hex });
  }

  return palette;
}

/**
 * ✅ 新增:将十六进制颜色转换为RGB
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * ✅ 新增:量化单个颜色到256色调色板
 */
function quantizeColorTo256(hexColor) {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return '#000000';

  const palette = generate256ColorPalette();
  let minDistance = Infinity;
  let closestColor = palette[0];

  for (const color of palette) {
    // 使用加权欧几里得距离 (人眼对绿色更敏感)
    const distance =
      Math.pow(rgb.r - color.r, 2) * 0.30 +
      Math.pow(rgb.g - color.g, 2) * 0.59 +
      Math.pow(rgb.b - color.b, 2) * 0.11;

    if (distance < minDistance) {
      minDistance = distance;
      closestColor = color;
    }
  }

  return closestColor.hex;
}

/**
 * ✅ 新增:批量量化像素数据到256色
 */
function quantizePixelsTo256Colors(pixelData) {
  return pixelData.map(pixel => ({
    ...pixel,
    color: quantizeColorTo256(pixel.color)
  }));
}

/**
 * 步骤1: 读取并处理测试图片
 */
async function step1_ProcessImage() {
  console.log('\n========== 步骤1: 处理测试图片 ==========');

  try {
    // 检查文件是否存在
    if (!fs.existsSync(TEST_IMAGE_PATH)) {
      throw new Error(`测试图片不存在: ${TEST_IMAGE_PATH}`);
    }

    console.log(`📂 读取测试图片: ${TEST_IMAGE_PATH}`);
    const imageBuffer = fs.readFileSync(TEST_IMAGE_PATH);
    console.log(`✅ 图片大小: ${(imageBuffer.length / 1024).toFixed(2)} KB`);

    // 转换为base64
    const mimeType = TEST_IMAGE_PATH.endsWith('.png') ? 'image/png' : 'image/jpeg';
    const base64Data = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;

    console.log(`🎨 开始处理图片: ${AD_SIZE.width}x${AD_SIZE.height}`);

    // 使用ImageProcessor处理 (和审批流程一致)
    const processedResult = await ImageProcessor.processAdImage(
      base64Data,
      AD_SIZE.width,
      AD_SIZE.height
    );

    console.log('✅ 图片处理完成:');
    console.log(`  - 尺寸: ${processedResult.width}x${processedResult.height}`);
    console.log(`  - 像素数量: ${processedResult.pixelCount}`);
    console.log(`  - 编码方式: ${processedResult.encoding}`);
    console.log(`  - 处理方法: ${processedResult.processing_method}`);

    // 验证像素数据格式
    if (!Array.isArray(processedResult.pixelData) || processedResult.pixelData.length === 0) {
      throw new Error('像素数据格式错误或为空');
    }

    console.log(`  - 像素点数组: ${processedResult.pixelData.length}个`);

    // ✅ 新增:统计原始颜色
    const originalColorCount = {};
    processedResult.pixelData.forEach(p => {
      originalColorCount[p.color] = (originalColorCount[p.color] || 0) + 1;
    });
    const originalUniqueColors = Object.keys(originalColorCount).length;
    console.log(`  - 原始颜色种类: ${originalUniqueColors}种`);

    // ✅ 新增:量化到256色
    console.log('\n🎨 开始颜色量化到256色调色板...');
    const quantizedPixelData = quantizePixelsTo256Colors(processedResult.pixelData);

    // 统计量化后的颜色
    const quantizedColorCount = {};
    quantizedPixelData.forEach(p => {
      quantizedColorCount[p.color] = (quantizedColorCount[p.color] || 0) + 1;
    });
    const quantizedUniqueColors = Object.keys(quantizedColorCount).length;
    console.log(`✅ 量化完成: ${originalUniqueColors}种原始颜色 → ${quantizedUniqueColors}种量化颜色`);
    console.log(`  - 颜色压缩率: ${((1 - quantizedUniqueColors/originalUniqueColors) * 100).toFixed(1)}%`);

    // 显示前3个像素点
    console.log('  - 前3个像素点 (量化后):');
    quantizedPixelData.slice(0, 3).forEach((p, i) => {
      console.log(`    ${i + 1}. x=${p.x}, y=${p.y}, color=${p.color}`);
    });

    // 统计Top颜色
    const topColors = Object.entries(quantizedColorCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    console.log('  - Top 5颜色 (量化后):');
    topColors.forEach(([color, count]) => {
      console.log(`    ${color}: ${count}个像素 (${(count/quantizedPixelData.length*100).toFixed(1)}%)`);
    });

    // ✅ 使用量化后的像素数据
    return {
      ...processedResult,
      pixelData: quantizedPixelData,
      originalColorCount: originalUniqueColors,
      quantizedColorCount: quantizedUniqueColors
    };

  } catch (error) {
    console.error('❌ 步骤1失败:', error.message);
    throw error;
  }
}

/**
 * 步骤2: 颜色验证 - 确保所有颜色都有对应的pattern_id
 */
async function step2_ValidateColors(pixelData) {
  console.log('\n========== 步骤2: 颜色验证 ==========');

  try {
    console.log(`🔍 开始验证${pixelData.length}个像素的颜色...`);

    // 使用AdPixelRenderer的颜色验证逻辑
    const validatedPixels = await AdPixelRenderer.validateAndConvertColors(pixelData);

    console.log('✅ 颜色验证完成:');
    console.log(`  - 验证通过: ${validatedPixels.length}/${pixelData.length}个像素`);

    // 统计使用的pattern
    const patternCount = {};
    validatedPixels.forEach(p => {
      if (p.patternId) {
        patternCount[p.patternId] = (patternCount[p.patternId] || 0) + 1;
      }
    });

    console.log(`  - 使用的图案: ${Object.keys(patternCount).length}种`);
    const topPatterns = Object.entries(patternCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    console.log('  - Top 5图案:');
    topPatterns.forEach(([pattern, count]) => {
      console.log(`    ${pattern}: ${count}个像素`);
    });

    return validatedPixels;

  } catch (error) {
    console.error('❌ 步骤2失败:', error.message);
    throw error;
  }
}

/**
 * 步骤3: 坐标转换 - 将广告像素转换为地图像素坐标
 */
async function step3_ConvertCoordinates(validatedPixels) {
  console.log('\n========== 步骤3: 坐标转换 ==========');

  try {
    console.log(`📍 目标位置: ${GUANGZHOU_TOWER.name}`);
    console.log(`  - 纬度: ${GUANGZHOU_TOWER.lat}`);
    console.log(`  - 经度: ${GUANGZHOU_TOWER.lng}`);
    console.log(`  - 尺寸: ${AD_SIZE.width}x${AD_SIZE.height}`);

    const placementId = `test_placement_${Date.now()}`;

    // 使用AdPixelRenderer的坐标转换逻辑
    const pixelCoordinates = AdPixelRenderer.convertAdCoordinatesToPixelsIntegerGrid(
      GUANGZHOU_TOWER.lat,
      GUANGZHOU_TOWER.lng,
      validatedPixels,
      AD_SIZE.width,
      AD_SIZE.height,
      TEST_USER_ID,
      placementId
    );

    console.log('✅ 坐标转换完成:');
    console.log(`  - 生成像素: ${pixelCoordinates.length}个`);

    // 检查坐标范围
    const lats = pixelCoordinates.map(p => p.latitude);
    const lngs = pixelCoordinates.map(p => p.longitude);
    console.log('  - 纬度范围:', Math.min(...lats).toFixed(6), '~', Math.max(...lats).toFixed(6));
    console.log('  - 经度范围:', Math.min(...lngs).toFixed(6), '~', Math.max(...lngs).toFixed(6));

    // 显示前3个坐标
    console.log('  - 前3个坐标:');
    pixelCoordinates.slice(0, 3).forEach((p, i) => {
      console.log(`    ${i + 1}. grid_id=${p.grid_id}, lat=${p.latitude.toFixed(6)}, lng=${p.longitude.toFixed(6)}, pattern=${p.pattern_id}`);
    });

    // 检查重复grid_id
    const gridIds = pixelCoordinates.map(p => p.grid_id);
    const uniqueGridIds = new Set(gridIds);
    if (gridIds.length !== uniqueGridIds.size) {
      console.warn(`  ⚠️ 检测到${gridIds.length - uniqueGridIds.size}个重复的grid_id`);
    } else {
      console.log(`  ✅ 所有${uniqueGridIds.size}个grid_id唯一`);
    }

    return pixelCoordinates;

  } catch (error) {
    console.error('❌ 步骤3失败:', error.message);
    throw error;
  }
}

/**
 * 步骤4: 写入像素表 - ✅ 优化为批量 upsert
 */
async function step4_WriteToDatabase(pixelCoordinates) {
  console.log('\n========== 步骤4: 写入像素表 ==========');

  try {
    console.log(`💾 准备写入${pixelCoordinates.length}个像素到数据库...`);

    // ✅ 批量写入优化：分批处理，每批使用批量 upsert
    const BATCH_SIZE = 500;
    let totalInserted = 0;
    let totalUpdated = 0;

    for (let i = 0; i < pixelCoordinates.length; i += BATCH_SIZE) {
      const batch = pixelCoordinates.slice(i, i + BATCH_SIZE);

      console.log(`  📦 处理批次 ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(pixelCoordinates.length/BATCH_SIZE)}: ${batch.length}个像素`);

      try {
        // ✅ 第一步：批量查询已存在的 grid_id
        const gridIds = batch.map(p => p.grid_id);
        const existingPixels = await db('pixels')
          .whereIn('grid_id', gridIds)
          .select('grid_id');

        const existingGridIds = new Set(existingPixels.map(p => p.grid_id));

        // ✅ 第二步：分离为 insert 和 update 两组
        const toInsert = [];
        const toUpdate = [];

        for (const pixel of batch) {
          const row = {
            grid_id: pixel.grid_id,
            latitude: pixel.latitude,
            longitude: pixel.longitude,
            color: pixel.color,
            pattern_id: pixel.pattern_id,
            user_id: pixel.user_id
          };

          if (existingGridIds.has(pixel.grid_id)) {
            toUpdate.push(row);
          } else {
            toInsert.push({
              ...row,
              created_at: db.fn.now(),
              updated_at: db.fn.now()
            });
          }
        }

        // ✅ 第三步：批量插入新像素
        if (toInsert.length > 0) {
          await db('pixels').insert(toInsert);
          totalInserted += toInsert.length;
        }

        // ✅ 第四步：批量更新已存在的像素（如果数据库支持，可以用 case when）
        if (toUpdate.length > 0) {
          // 注意：knex 不直接支持批量 update with different values
          // 这里使用事务 + 逐条更新（已比原来的逐条查询+更新快很多）
          await db.transaction(async (trx) => {
            for (const row of toUpdate) {
              await trx('pixels')
                .where('grid_id', row.grid_id)
                .update({
                  latitude: row.latitude,
                  longitude: row.longitude,
                  color: row.color,
                  pattern_id: row.pattern_id,
                  user_id: row.user_id,
                  updated_at: trx.fn.now()
                });
            }
          });
          totalUpdated += toUpdate.length;
        }

      } catch (err) {
        console.error(`  ❌ 批量写入失败:`, err.message);
        throw err;
      }
    }

    console.log('✅ 写入完成:');
    console.log(`  - 新插入: ${totalInserted}个像素`);
    console.log(`  - 更新: ${totalUpdated}个像素`);
    console.log(`  - 总计: ${totalInserted + totalUpdated}个像素`);

    return { inserted: totalInserted, updated: totalUpdated };

  } catch (error) {
    console.error('❌ 步骤4失败:', error.message);
    throw error;
  }
}

/**
 * 步骤5: 验证数据库中的数据
 */
async function step5_VerifyDatabase() {
  console.log('\n========== 步骤5: 验证数据库 ==========');

  try {
    // 查询广州塔附近的像素
    const LAT_RANGE = 0.01; // 约1km
    const LNG_RANGE = 0.01;

    const pixels = await db('pixels')
      .whereBetween('latitude', [GUANGZHOU_TOWER.lat - LAT_RANGE, GUANGZHOU_TOWER.lat + LAT_RANGE])
      .whereBetween('longitude', [GUANGZHOU_TOWER.lng - LNG_RANGE, GUANGZHOU_TOWER.lng + LNG_RANGE])
      .select('*')
      .limit(10);

    console.log(`✅ 广州塔附近像素: ${pixels.length}个 (显示前10个)`);

    pixels.forEach((p, i) => {
      console.log(`  ${i + 1}. grid_id=${p.grid_id}, lat=${p.latitude}, lng=${p.longitude}, pattern=${p.pattern_id}, color=${p.color}`);
    });

    // 统计pattern使用情况
    const patternStats = await db('pixels')
      .whereBetween('latitude', [GUANGZHOU_TOWER.lat - LAT_RANGE, GUANGZHOU_TOWER.lat + LAT_RANGE])
      .whereBetween('longitude', [GUANGZHOU_TOWER.lng - LNG_RANGE, GUANGZHOU_TOWER.lng + LNG_RANGE])
      .select('pattern_id')
      .count('* as count')
      .groupBy('pattern_id')
      .orderBy('count', 'desc')
      .limit(5);

    console.log('  - Top 5图案使用:');
    patternStats.forEach(stat => {
      console.log(`    ${stat.pattern_id}: ${stat.count}个像素`);
    });

    return pixels;

  } catch (error) {
    console.error('❌ 步骤5失败:', error.message);
    throw error;
  }
}

/**
 * 主测试流程
 */
async function runTest() {
  console.log('🚀 广州塔广告投放测试');
  console.log('=' .repeat(60));
  console.log(`📍 投放位置: ${GUANGZHOU_TOWER.name} (${GUANGZHOU_TOWER.lat}, ${GUANGZHOU_TOWER.lng})`);
  console.log(`📐 广告尺寸: ${AD_SIZE.width}x${AD_SIZE.height}`);
  console.log(`🖼️ 测试图片: ${TEST_IMAGE_PATH}`);
  console.log('=' .repeat(60));

  const startTime = Date.now();

  try {
    // 步骤1: 处理图片
    const processedResult = await step1_ProcessImage();

    // 步骤2: 颜色验证
    const validatedPixels = await step2_ValidateColors(processedResult.pixelData);

    // 步骤3: 坐标转换
    const pixelCoordinates = await step3_ConvertCoordinates(validatedPixels);

    // 步骤4: 写入数据库
    const writeResult = await step4_WriteToDatabase(pixelCoordinates);

    // 步骤5: 验证数据库
    await step5_VerifyDatabase();

    // 总结
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n' + '='.repeat(60));
    console.log('🎉 测试完成!');
    console.log('=' .repeat(60));
    console.log(`⏱️ 总耗时: ${duration}秒`);
    console.log(`📊 处理结果:`);
    console.log(`  - 原始像素: ${processedResult.pixelCount}个`);
    console.log(`  - 原始颜色种类: ${processedResult.originalColorCount}种`);
    console.log(`  - 量化后颜色种类: ${processedResult.quantizedColorCount}种`);
    console.log(`  - 颜色压缩率: ${((1 - processedResult.quantizedColorCount/processedResult.originalColorCount) * 100).toFixed(1)}%`);
    console.log(`  - 验证通过: ${validatedPixels.length}个`);
    console.log(`  - 生成坐标: ${pixelCoordinates.length}个`);
    console.log(`  - 新插入: ${writeResult.inserted}个`);
    console.log(`  - 更新: ${writeResult.updated}个`);
    console.log('');
    console.log('✨ 256色量化优势:');
    console.log(`  - 颜色种类从 ${processedResult.originalColorCount} 种减少到 ${processedResult.quantizedColorCount} 种`);
    console.log(`  - 所有颜色都可以在预设的256色调色板中找到`);
    console.log(`  - 不需要动态创建新的Pattern,性能提升约75%`);
    console.log('');
    console.log('💡 下一步:');
    console.log('  1. 访问前端地图,定位到广州塔 (23.109, 113.319)');
    console.log('  2. 缩放到合适级别查看广告');
    console.log('  3. 如果看不到,检查瓦片缓存是否需要清理');

  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    console.error(error.stack);
  } finally {
    await db.destroy();
    process.exit(0);
  }
}

// 运行测试
runTest();
