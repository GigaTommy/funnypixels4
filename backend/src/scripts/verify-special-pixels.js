/**
 * 验证特殊道具像素创建
 */

const { db } = require('../config/database');

async function verifySpecialPixels() {
  try {
    console.log('\n========== 验证特殊道具像素 ==========\n');

    // 1. 查看所有bomb类型像素
    console.log('1️⃣ 查看所有bomb类型像素:\n');
    const bombPixels = await db('pixels')
      .where('pixel_type', 'bomb')
      .select('*');

    console.log(`   找到 ${bombPixels.length} 个bomb像素:`);
    bombPixels.slice(0, 5).forEach((pixel, i) => {
      console.log(`   ${i + 1}. grid_id: ${pixel.grid_id}`);
      console.log(`      位置: (${pixel.latitude}, ${pixel.longitude})`);
      console.log(`      pattern_id: ${pixel.pattern_id}`);
      console.log(`      颜色: ${pixel.color}`);
      console.log('');
    });

    // 2. 查看pattern_id包含特殊道具的像素
    console.log('2️⃣ 查看pattern_id包含特殊道具的像素:\n');
    const specialPixels = await db('pixels')
      .where('pattern_id', 'like', 'drift_bottle_%')
      .orWhere('pattern_id', 'like', 'qr_treasure_%')
      .select('*');

    console.log(`   找到 ${specialPixels.length} 个特殊道具像素:`);
    specialPixels.slice(0, 5).forEach((pixel, i) => {
      console.log(`   ${i + 1}. grid_id: ${pixel.grid_id}`);
      console.log(`      位置: (${pixel.latitude}, ${pixel.longitude})`);
      console.log(`      pattern_id: ${pixel.pattern_id}`);
      console.log(`      pixel_type: ${pixel.pixel_type}`);
      console.log(`      颜色: ${pixel.color}`);
      console.log('');
    });

    // 3. 统计所有pixel_type
    console.log('3️⃣ 统计所有pixel_type:\n');
    const typeStats = await db('pixels')
      .select('pixel_type')
      .count('* as count')
      .groupBy('pixel_type');

    console.log('   像素类型统计:');
    typeStats.forEach(stat => {
      console.log(`   - ${stat.pixel_type}: ${stat.count} 个`);
    });

    console.log('\n========== 验证完成 ==========\n');

  } catch (error) {
    console.error('❌ 验证失败:', error);
  } finally {
    process.exit(0);
  }
}

verifySpecialPixels();