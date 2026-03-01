/**
 * 为现有特殊道具创建像素
 * 为漂流瓶和QR宝藏补充像素记录
 */

const { db } = require('../config/database');
const SpecialItemPixelRenderer = require('../services/SpecialItemPixelRenderer');
const logger = require('../utils/logger');

async function createSpecialPixels() {
  try {
    console.log('\n========== 为特殊道具创建像素 ==========\n');

    // 1. 为活跃的漂流瓶创建像素
    console.log('1️⃣ 为活跃漂流瓶创建像素...\n');
    const activeBottles = await db('drift_bottles')
      .where('is_active', true)
      .whereNotNull('current_lat')
      .whereNotNull('current_lng')
      .limit(10); // 限制处理数量

    console.log(`   找到 ${activeBottles.length} 个活跃漂流瓶`);

    for (const bottle of activeBottles) {
      try {
        console.log(`   🍾 处理漂流瓶: ${bottle.bottle_id}`);
        const result = await SpecialItemPixelRenderer.renderDriftBottlePixel(bottle);
        console.log(`     ✅ 创建成功: ${result.pixelCount} 个像素`);
      } catch (error) {
        console.log(`     ❌ 创建失败: ${error.message}`);
      }
    }

    // 2. 为固定QR宝藏创建像素
    console.log('\n2️⃣ 为固定QR宝藏创建像素...\n');
    const activeTreasures = await db('qr_treasures')
      .where('status', 'active')
      .where('qr_code_type', 'fixed')
      .whereNotNull('hide_lat')
      .whereNotNull('hide_lng')
      .limit(10); // 限制处理数量

    console.log(`   找到 ${activeTreasures.length} 个固定QR宝藏`);

    for (const treasure of activeTreasures) {
      try {
        console.log(`   💎 处理QR宝藏: ${treasure.treasure_id}`);
        const result = await SpecialItemPixelRenderer.renderQRTreasurePixel(treasure);
        console.log(`     ✅ 创建成功: ${result.pixelCount} 个像素`);
      } catch (error) {
        console.log(`     ❌ 创建失败: ${error.message}`);
      }
    }

    // 3. 验证创建结果
    console.log('\n3️⃣ 验证创建结果...\n');
    const driftBottlePixels = await db('pixels')
      .where('pixel_type', 'drift_bottle')
      .count('* as count')
      .first();

    const qrTreasurePixels = await db('pixels')
      .where('pixel_type', 'qr_treasure')
      .count('* as count')
      .first();

    console.log(`   🍾 漂流瓶像素: ${driftBottlePixels.count} 个`);
    console.log(`   💎 QR宝藏像素: ${qrTreasurePixels.count} 个`);

    console.log('\n========== 创建完成 ==========\n');

  } catch (error) {
    console.error('❌ 创建失败:', error);
  } finally {
    process.exit(0);
  }
}

// 运行脚本
createSpecialPixels();