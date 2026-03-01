// 设置环境变量
process.env.LOCAL_VALIDATION = 'true';
process.env.NODE_ENV = 'development';

const { db } = require('./config/database');

/**
 * 生成一个SQL查询脚本，帮助前端团队调试
 */
(async () => {
  try {
    const GUANGZHOU_TOWER = { lat: 23.109, lng: 113.319 };
    const TEST_USER_ID = 'a79a1fbe-0f97-4303-b922-52b35e6948d5';

    console.log('📍 广州塔像素查询测试\n');
    console.log('='.repeat(60));
    console.log(`中心坐标: (${GUANGZHOU_TOWER.lat}, ${GUANGZHOU_TOWER.lng})`);
    console.log(`测试用户: ${TEST_USER_ID}\n`);

    // 查询广州塔附近的像素
    const pixels = await db('pixels')
      .whereBetween('latitude', [23.108, 23.110])
      .whereBetween('longitude', [113.318, 113.320])
      .where('user_id', TEST_USER_ID)
      .select('*')
      .orderBy('latitude')
      .orderBy('longitude');

    console.log(`✅ 查询到 ${pixels.length} 个像素\n`);

    if (pixels.length > 0) {
      // 分析grid_id格式
      const formats = {
        'grid_prefix': pixels.filter(p => p.grid_id.startsWith('grid_')),
        'numeric': pixels.filter(p => /^\d+_\d+$/.test(p.grid_id))
      };

      console.log('Grid ID 格式统计:');
      console.log(`  - grid_xxx_xxx格式: ${formats.grid_prefix.length}个`);
      console.log(`  - 纯数字格式: ${formats.numeric.length}个\n`);

      // 显示每种格式的前10个
      console.log('纯数字格式的前10个像素 (test_place_ad_simple.js生成):');
      formats.numeric.slice(0, 10).forEach((p, i) => {
        console.log(`  ${i+1}. grid_id=${p.grid_id}, lat=${p.latitude}, lng=${p.longitude}, color=${p.color}, pattern=${p.pattern_id}`);
      });

      console.log('\ngrid_格式的前10个像素:');
      formats.grid_prefix.slice(0, 10).forEach((p, i) => {
        console.log(`  ${i+1}. grid_id=${p.grid_id}, lat=${p.latitude}, lng=${p.longitude}, color=${p.color}, pattern=${p.pattern_id}`);
      });

      // 生成前端可用的SQL查询
      console.log('\n' + '='.repeat(60));
      console.log('📋 前端调试用SQL查询:\n');

      console.log('-- 查询广州塔附近的所有像素');
      console.log(`SELECT * FROM pixels`);
      console.log(`WHERE latitude BETWEEN 23.108 AND 23.110`);
      console.log(`  AND longitude BETWEEN 113.318 AND 113.320`);
      console.log(`  AND user_id = '${TEST_USER_ID}'`);
      console.log(`ORDER BY latitude, longitude;`);

      console.log('\n-- 统计每种grid_id格式的数量');
      console.log(`SELECT`);
      console.log(`  CASE`);
      console.log(`    WHEN grid_id LIKE 'grid_%' THEN 'grid_prefix'`);
      console.log(`    WHEN grid_id ~ '^[0-9]+_[0-9]+$' THEN 'numeric'`);
      console.log(`    ELSE 'other'`);
      console.log(`  END as grid_format,`);
      console.log(`  COUNT(*) as count`);
      console.log(`FROM pixels`);
      console.log(`WHERE latitude BETWEEN 23.108 AND 23.110`);
      console.log(`  AND longitude BETWEEN 113.318 AND 113.320`);
      console.log(`  AND user_id = '${TEST_USER_ID}'`);
      console.log(`GROUP BY grid_format;`);

      // 生成前端瓦片查询提示
      console.log('\n' + '='.repeat(60));
      console.log('💡 前端调试建议:\n');
      console.log('1. 清理瓦片缓存（如果有缓存机制）');
      console.log('2. 确保前端查询的经纬度范围至少包含:');
      console.log(`   纬度: 23.108 ~ 23.110`);
      console.log(`   经度: 113.318 ~ 113.320`);
      console.log('3. 检查前端是否能正确处理两种grid_id格式');
      console.log('4. 确认地图缩放级别是否合适（建议zoom >= 15）');
      console.log('5. 打开浏览器开发者工具，查看网络请求的瓦片范围');
    }

    await db.destroy();
    process.exit(0);
  } catch (err) {
    console.error('❌ 错误:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();
