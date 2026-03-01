// 设置环境变量
process.env.LOCAL_VALIDATION = 'true';
process.env.NODE_ENV = 'development';

const { db } = require('./config/database');

/**
 * 模拟前端查询逻辑
 * 前端通常按照地图瓦片的方式查询某个区域内的像素
 */
(async () => {
  try {
    const GUANGZHOU_TOWER = { lat: 23.109, lng: 113.319 };

    console.log('🔍 模拟前端查询广州塔区域的像素\n');
    console.log('=' .repeat(60));

    // 测试不同的查询范围
    const testRanges = [
      { name: '极小范围 (0.0001度 ≈ 10米)', range: 0.0001 },
      { name: '小范围 (0.0005度 ≈ 50米)', range: 0.0005 },
      { name: '中等范围 (0.001度 ≈ 100米)', range: 0.001 },
      { name: '大范围 (0.01度 ≈ 1公里)', range: 0.01 }
    ];

    for (const test of testRanges) {
      console.log(`\n📍 ${test.name}`);
      console.log(`   查询范围: lat [${(GUANGZHOU_TOWER.lat - test.range).toFixed(6)}, ${(GUANGZHOU_TOWER.lat + test.range).toFixed(6)}]`);
      console.log(`              lng [${(GUANGZHOU_TOWER.lng - test.range).toFixed(6)}, ${(GUANGZHOU_TOWER.lng + test.range).toFixed(6)}]`);

      const pixels = await db('pixels')
        .whereBetween('latitude', [
          GUANGZHOU_TOWER.lat - test.range,
          GUANGZHOU_TOWER.lat + test.range
        ])
        .whereBetween('longitude', [
          GUANGZHOU_TOWER.lng - test.range,
          GUANGZHOU_TOWER.lng + test.range
        ])
        .select('*');

      console.log(`   ✅ 找到 ${pixels.length} 个像素`);

      if (pixels.length > 0) {
        // 统计user_id
        const userCount = {};
        pixels.forEach(p => {
          userCount[p.user_id] = (userCount[p.user_id] || 0) + 1;
        });

        console.log(`   👥 用户分布:`);
        Object.entries(userCount).forEach(([userId, count]) => {
          const displayId = userId.substring(0, 8) + '...';
          console.log(`      ${displayId}: ${count}个像素`);
        });

        // 显示前5个像素
        console.log(`   📋 前5个像素:`);
        pixels.slice(0, 5).forEach((p, i) => {
          console.log(`      ${i+1}. grid_id=${p.grid_id}, lat=${p.latitude}, lng=${p.longitude}`);
        });
      }
    }

    // 专门查询测试用户的像素
    console.log('\n' + '='.repeat(60));
    console.log('🔍 查询测试用户的所有像素\n');

    const TEST_USER_ID = 'a79a1fbe-0f97-4303-b922-52b35e6948d5';

    const userPixels = await db('pixels')
      .where('user_id', TEST_USER_ID)
      .select('*');

    console.log(`✅ 测试用户 (${TEST_USER_ID.substring(0, 8)}...) 共有 ${userPixels.length} 个像素`);

    if (userPixels.length > 0) {
      // 计算坐标范围
      const lats = userPixels.map(p => parseFloat(p.latitude));
      const lngs = userPixels.map(p => parseFloat(p.longitude));

      const latMin = Math.min(...lats);
      const latMax = Math.max(...lats);
      const lngMin = Math.min(...lngs);
      const lngMax = Math.max(...lngs);

      console.log('\n📍 像素分布范围:');
      console.log(`   纬度: ${latMin.toFixed(6)} ~ ${latMax.toFixed(6)} (跨度: ${(latMax - latMin).toFixed(6)}度)`);
      console.log(`   经度: ${lngMin.toFixed(6)} ~ ${lngMax.toFixed(6)} (跨度: ${(lngMax - lngMin).toFixed(6)}度)`);
      console.log(`   中心点: (${((latMin + latMax) / 2).toFixed(6)}, ${((lngMin + lngMax) / 2).toFixed(6)})`);

      // 统计grid_id格式
      const gridIdFormats = {
        'grid_xxx_xxx': 0,
        'xxxxxxx_xxxxxxx': 0,
        'other': 0
      };

      userPixels.forEach(p => {
        if (p.grid_id.startsWith('grid_')) {
          gridIdFormats['grid_xxx_xxx']++;
        } else if (/^\d+_\d+$/.test(p.grid_id)) {
          gridIdFormats['xxxxxxx_xxxxxxx']++;
        } else {
          gridIdFormats['other']++;
        }
      });

      console.log('\n🔧 Grid ID 格式分布:');
      Object.entries(gridIdFormats).forEach(([format, count]) => {
        if (count > 0) {
          console.log(`   ${format}: ${count}个 (${(count/userPixels.length*100).toFixed(1)}%)`);
        }
      });

      // 显示每种格式的示例
      console.log('\n📋 Grid ID 示例:');
      const gridExample = userPixels.find(p => p.grid_id.startsWith('grid_'));
      const numericExample = userPixels.find(p => /^\d+_\d+$/.test(p.grid_id));

      if (gridExample) {
        console.log(`   grid_格式: ${gridExample.grid_id}`);
      }
      if (numericExample) {
        console.log(`   数字格式: ${numericExample.grid_id}`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('💡 结论:');
    console.log('   如果前端只能看到十几个像素，可能原因:');
    console.log('   1. 前端查询范围太小，没有覆盖所有像素');
    console.log('   2. 前端瓦片渲染逻辑有问题');
    console.log('   3. Grid ID 格式不一致导致部分像素无法正确定位');
    console.log('   4. 前端缓存问题，需要清理瓦片缓存');

    await db.destroy();
    process.exit(0);
  } catch (err) {
    console.error('❌ 错误:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();
