/**
 * 检查数据库中广告像素的完整性
 */

process.env.LOCAL_VALIDATION = 'true';

const { db } = require('./config/database');

async function checkDatabasePixels() {
  try {
    console.log('🔍 检查数据库中的像素数据...\n');

    // 1. 查询广州塔附近的像素
    const pixels = await db('pixels')
      .whereBetween('latitude', [23.108, 23.110])
      .whereBetween('longitude', [113.318, 113.320])
      .select('grid_id', 'latitude', 'longitude', 'color', 'pattern_id')
      .orderBy('latitude', 'desc')
      .orderBy('longitude', 'asc');

    console.log(`📊 查询到 ${pixels.length} 个像素`);

    // 2. 检查 grid_id 格式
    console.log('\n📋 Grid ID 格式分析:');
    const newFormatPixels = pixels.filter(p => p.grid_id.includes('test_placement'));
    const oldFormatPixels = pixels.filter(p => p.grid_id.startsWith('grid_'));

    console.log(`  新格式 (test_placement_*): ${newFormatPixels.length}个`);
    console.log(`  旧格式 (grid_*): ${oldFormatPixels.length}个`);

    // 3. 显示示例
    console.log('\n📦 新格式像素示例 (前5个):');
    newFormatPixels.slice(0, 5).forEach((p, i) => {
      const lat = parseFloat(p.latitude);
      const lng = parseFloat(p.longitude);
      console.log(`  ${i+1}. ${p.grid_id}`);
      console.log(`     lat=${lat.toFixed(6)}, lng=${lng.toFixed(6)}`);
      console.log(`     color=${p.color}, pattern=${p.pattern_id}`);
    });

    console.log('\n📦 旧格式像素示例 (前5个):');
    oldFormatPixels.slice(0, 5).forEach((p, i) => {
      const lat = parseFloat(p.latitude);
      const lng = parseFloat(p.longitude);
      console.log(`  ${i+1}. ${p.grid_id}`);
      console.log(`     lat=${lat.toFixed(6)}, lng=${lng.toFixed(6)}`);
      console.log(`     color=${p.color}, pattern=${p.pattern_id}`);
    });

    // 4. 分析颜色分布
    console.log('\n🎨 颜色分布分析:');
    const colorCount = {};
    newFormatPixels.forEach(p => {
      colorCount[p.color] = (colorCount[p.color] || 0) + 1;
    });

    const sortedColors = Object.entries(colorCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    console.log('  Top 10颜色 (新格式像素):');
    sortedColors.forEach(([color, count]) => {
      const percentage = (count / newFormatPixels.length * 100).toFixed(1);
      console.log(`    ${color}: ${count}个 (${percentage}%)`);
    });

    // 5. 检查坐标范围
    if (newFormatPixels.length > 0) {
      const lats = newFormatPixels.map(p => parseFloat(p.latitude));
      const lngs = newFormatPixels.map(p => parseFloat(p.longitude));

      console.log('\n📍 新格式像素坐标范围:');
      console.log(`  纬度: ${Math.min(...lats).toFixed(6)} ~ ${Math.max(...lats).toFixed(6)}`);
      console.log(`  经度: ${Math.min(...lngs).toFixed(6)} ~ ${Math.max(...lngs).toFixed(6)}`);
      console.log(`  跨度: lat ${(Math.max(...lats) - Math.min(...lats)).toFixed(6)}°, lng ${(Math.max(...lngs) - Math.min(...lngs)).toFixed(6)}°`);
    }

    // 6. 检查是否有重复的坐标
    console.log('\n🔎 重复坐标检查:');
    const coordMap = new Map();
    newFormatPixels.forEach(p => {
      const lat = parseFloat(p.latitude).toFixed(6);
      const lng = parseFloat(p.longitude).toFixed(6);
      const key = `${lat},${lng}`;
      coordMap.set(key, (coordMap.get(key) || 0) + 1);
    });

    const duplicates = Array.from(coordMap.entries()).filter(([, count]) => count > 1);
    if (duplicates.length > 0) {
      console.log(`  ⚠️ 发现 ${duplicates.length} 个重复坐标`);
      console.log('  前5个重复坐标:');
      duplicates.slice(0, 5).forEach(([coord, count]) => {
        console.log(`    ${coord}: ${count}次`);
      });
    } else {
      console.log('  ✅ 无重复坐标');
    }

    await db.destroy();

  } catch (error) {
    console.error('❌ 检查失败:', error);
    process.exit(1);
  }
}

checkDatabasePixels();
