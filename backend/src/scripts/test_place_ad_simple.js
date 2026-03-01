/**
 * 简化版广告投放测试 - 不依赖Redis等外部服务
 */

// 必须在最开始设置
process.env.LOCAL_VALIDATION = 'true';
process.env.NODE_ENV = 'development';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const crypto = require('crypto');

// 生成UUID
function generateUUID() {
  return crypto.randomUUID();
}

// 延迟加载数据库
let db;
async function getDb() {
  if (!db) {
    db = require('./config/database').db;
  }
  return db;
}

// 广州塔坐标
const GUANGZHOU_TOWER = { lat: 23.109, lng: 113.319 };
const AD_SIZE = { width: 64, height: 64 };
const TEST_IMAGE_PATH = path.join(__dirname, '../test.jpeg');
const TEST_USER_ID = 'a79a1fbe-0f97-4303-b922-52b35e6948d5'; // 固定测试用户ID

/**
 * 步骤1: 图像处理 - 直接使用sharp和算法,不依赖ImageProcessor
 */
async function processImage() {
  console.log('\n========== 步骤1: 处理图片 ==========');

  const imageBuffer = fs.readFileSync(TEST_IMAGE_PATH);
  console.log(`📂 读取图片: ${TEST_IMAGE_PATH} (${(imageBuffer.length/1024).toFixed(2)}KB)`);

  // 使用sharp处理
  const { data: rawData, info } = await sharp(imageBuffer)
    .resize(AD_SIZE.width, AD_SIZE.height, {
      fit: 'fill',
      kernel: sharp.kernel.lanczos3
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  console.log(`🎨 调整尺寸: ${info.width}x${info.height}`);

  // 提取像素数据
  const pixels = [];
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const idx = (y * info.width + x) * info.channels;
      const r = rawData[idx];
      const g = rawData[idx + 1];
      const b = rawData[idx + 2];

      // 量化到256色
      const qr = Math.round(r / 51) * 51;
      const qg = Math.round(g / 51) * 51;
      const qb = Math.round(b / 51) * 51;
      const color = `#${qr.toString(16).padStart(2,'0')}${qg.toString(16).padStart(2,'0')}${qb.toString(16).padStart(2,'0')}`.toUpperCase();

      pixels.push({ x, y, color });
    }
  }

  console.log(`✅ 生成${pixels.length}个像素点`);

  // 统计颜色
  const colorCount = {};
  pixels.forEach(p => colorCount[p.color] = (colorCount[p.color] || 0) + 1);
  const topColors = Object.entries(colorCount).sort((a,b) => b[1]-a[1]).slice(0,5);
  console.log('Top 5颜色:');
  topColors.forEach(([c, n]) => console.log(`  ${c}: ${n}`));

  return pixels;
}

/**
 * 步骤2: 颜色映射 - 查找pattern_id
 */
async function mapColors(pixels) {
  console.log('\n========== 步骤2: 颜色映射 ==========');

  const database = await getDb();
  const colorCache = new Map();

  console.log('🔍 查找颜色对应的pattern_id...');

  for (const pixel of pixels) {
    if (colorCache.has(pixel.color)) {
      pixel.patternId = colorCache.get(pixel.color);
      continue;
    }

    // 查找256色调色板
    const pattern = await database('pattern_assets')
      .where('render_type', 'color')
      .where('payload', pixel.color)
      .where('category', 'base256color')
      .first();

    if (pattern) {
      pixel.patternId = pattern.key;
      colorCache.set(pixel.color, pattern.key);
    } else {
      // 回退到基础16色
      const base = await database('pattern_assets')
        .where('render_type', 'color')
        .whereNull('category')
        .first();

      if (base) {
        pixel.patternId = base.key;
        colorCache.set(pixel.color, base.key);
      } else {
        throw new Error(`找不到颜色${pixel.color}对应的图案`);
      }
    }
  }

  console.log(`✅ 映射完成: 使用${colorCache.size}种图案`);
  return pixels;
}

/**
 * 步骤3: 坐标转换 - 简化版
 */
function convertCoordinates(pixels) {
  console.log('\n========== 步骤3: 坐标转换 ==========');

  const PIXEL_SIZE = 0.0001; // 约11米 (与正式服务AdPixelRenderer保持一致)
  const halfW = AD_SIZE.width / 2;
  const halfH = AD_SIZE.height / 2;

  const result = pixels.map(p => {
    const offsetX = (p.x - halfW) * PIXEL_SIZE;
    const offsetY = (halfH - p.y) * PIXEL_SIZE;

    const lat = GUANGZHOU_TOWER.lat + offsetY;
    const lng = GUANGZHOU_TOWER.lng + offsetX;
    const gridId = `${Math.round(lat * 100000)}_${Math.round(lng * 100000)}`;

    return {
      grid_id: gridId,
      latitude: lat,
      longitude: lng,
      color: p.color,
      pattern_id: p.patternId,
      user_id: TEST_USER_ID,
      created_at: new Date(),
      updated_at: new Date()
    };
  });

  console.log(`✅ 转换${result.length}个坐标`);
  console.log(`纬度范围: ${Math.min(...result.map(r=>r.latitude)).toFixed(6)} ~ ${Math.max(...result.map(r=>r.latitude)).toFixed(6)}`);
  console.log(`经度范围: ${Math.min(...result.map(r=>r.longitude)).toFixed(6)} ~ ${Math.max(...result.map(r=>r.longitude)).toFixed(6)}`);

  return result;
}

/**
 * 步骤4: 写入数据库
 */
async function writeToDb(coords) {
  console.log('\n========== 步骤4: 写入数据库 ==========');

  const database = await getDb();
  let inserted = 0, updated = 0;

  console.log(`💾 写入${coords.length}个像素...`);

  for (const coord of coords) {
    try {
      const existing = await database('pixels').where('grid_id', coord.grid_id).first();

      if (existing) {
        await database('pixels').where('grid_id', coord.grid_id).update({
          latitude: coord.latitude,
          longitude: coord.longitude,
          color: coord.color,
          pattern_id: coord.pattern_id,
          user_id: coord.user_id,
          updated_at: new Date()
        });
        updated++;
      } else {
        // 不指定id，让数据库自动生成
        await database('pixels').insert({
          grid_id: coord.grid_id,
          latitude: coord.latitude,
          longitude: coord.longitude,
          color: coord.color,
          pattern_id: coord.pattern_id,
          user_id: coord.user_id,
          created_at: new Date(),
          updated_at: new Date()
        });
        inserted++;
      }

      if ((inserted + updated) % 500 === 0) {
        console.log(`  进度: ${inserted + updated}/${coords.length}`);
      }
    } catch (err) {
      console.error(`  ❌ 写入像素失败 (grid_id=${coord.grid_id}):`, err.message);
    }
  }

  console.log(`✅ 写入完成: 新增${inserted}, 更新${updated}`);
  return { inserted, updated };
}

/**
 * 主流程
 */
async function main() {
  console.log('🚀 简化版广告投放测试');
  console.log('='.repeat(60));

  try {
    const pixels = await processImage();
    const mapped = await mapColors(pixels);
    const coords = convertCoordinates(mapped);
    const result = await writeToDb(coords);

    console.log('\n' + '='.repeat(60));
    console.log('🎉 投放成功!');
    console.log(`📍 位置: 广州塔 (${GUANGZHOU_TOWER.lat}, ${GUANGZHOU_TOWER.lng})`);
    console.log(`📐 尺寸: ${AD_SIZE.width}x${AD_SIZE.height}`);
    console.log(`📊 结果: 新增${result.inserted}, 更新${result.updated}`);
    console.log('\n💡 前端查看: 定位到广州塔坐标并缩放查看');

  } catch (err) {
    console.error('❌ 失败:', err.message);
    console.error(err.stack);
  } finally {
    if (db) await db.destroy();
    process.exit(0);
  }
}

main();
