// 设置环境变量
process.env.LOCAL_VALIDATION = 'true';
process.env.NODE_ENV = 'development';

const { db } = require('./config/database');

(async () => {
  try {
    const GUANGZHOU_TOWER = { lat: 23.109, lng: 113.319 };
    const LAT_RANGE = 0.001;
    const LNG_RANGE = 0.001;

    // 查询广州塔附近的像素
    const pixels = await db('pixels')
      .whereBetween('latitude', [GUANGZHOU_TOWER.lat - LAT_RANGE, GUANGZHOU_TOWER.lat + LAT_RANGE])
      .whereBetween('longitude', [GUANGZHOU_TOWER.lng - LNG_RANGE, GUANGZHOU_TOWER.lng + LNG_RANGE])
      .where('user_id', 'a79a1fbe-0f97-4303-b922-52b35e6948d5')
      .select('*');

    console.log(`找到 ${pixels.length} 个该用户的像素`);

    if (pixels.length > 0) {
      console.log('\n前10个像素:');
      pixels.slice(0, 10).forEach((p, i) => {
        console.log(`${i+1}. grid_id=${p.grid_id}, lat=${p.latitude}, lng=${p.longitude}, color=${p.color}`);
      });

      // 检查唯一的grid_id数量
      const uniqueGridIds = new Set(pixels.map(p => p.grid_id));
      console.log(`\n唯一grid_id数量: ${uniqueGridIds.size}`);

      // 检查颜色分布
      const colorCount = {};
      pixels.forEach(p => {
        colorCount[p.color] = (colorCount[p.color] || 0) + 1;
      });
      console.log(`\n颜色种类: ${Object.keys(colorCount).length}`);
      console.log('Top 5颜色:');
      Object.entries(colorCount).sort((a,b) => b[1]-a[1]).slice(0,5).forEach(([c, n]) => {
        console.log(`  ${c}: ${n}个`);
      });

      // 检查坐标范围
      const lats = pixels.map(p => p.latitude);
      const lngs = pixels.map(p => p.longitude);
      console.log('\n坐标范围:');
      console.log(`  纬度: ${Math.min(...lats).toFixed(6)} ~ ${Math.max(...lats).toFixed(6)}`);
      console.log(`  经度: ${Math.min(...lngs).toFixed(6)} ~ ${Math.max(...lngs).toFixed(6)}`);

      // 检查pattern_id
      const patterns = new Set(pixels.map(p => p.pattern_id));
      console.log(`\n使用的pattern数量: ${patterns.size}`);
    } else {
      console.log('\n未找到任何像素！');
    }

    await db.destroy();
    process.exit(0);
  } catch (err) {
    console.error('错误:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();
