const { db } = require('./src/config/database');

async function checkPixels() {
  try {
    console.log('🔍 检查广州塔附近像素数据...');
    
    // 查询广州塔附近的像素
    const pixels = await db('pixels')
      .whereBetween('latitude', [23.105, 23.113])
      .whereBetween('longitude', [113.315, 113.323])
      .select('grid_id', 'latitude', 'longitude', 'color', 'pattern_id', 'user_id')
      .limit(20);
    
    console.log(`✅ 找到 ${pixels.length} 个像素`);
    
    if (pixels.length > 0) {
      console.log('\n前20个像素:');
      pixels.forEach((p, i) => {
        console.log(`${i+1}. ${p.grid_id} - lat:${p.latitude} lng:${p.longitude} color:${p.color} pattern:${p.pattern_id}`);
      });
      
      // 统计pattern使用情况
      const patternStats = {};
      pixels.forEach(p => {
        patternStats[p.pattern_id] = (patternStats[p.pattern_id] || 0) + 1;
      });
      
      console.log('\nPattern使用统计:');
      Object.entries(patternStats).forEach(([pattern, count]) => {
        console.log(`  ${pattern}: ${count}个像素`);
      });
    } else {
      console.log('❌ 没有找到像素数据');
    }
    
    await db.destroy();
  } catch (error) {
    console.error('❌ 查询失败:', error);
  }
}

checkPixels();
