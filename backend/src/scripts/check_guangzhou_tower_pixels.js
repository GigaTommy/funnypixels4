/**
 * 检查广州塔附近的像素数据
 */

// 设置环境变量
process.env.LOCAL_VALIDATION = 'true';

const { db } = require('../config/database');

async function checkGuangzhouTowerPixels() {
  try {
    console.log('🔍 开始检查广州塔附近像素...\n');

    // 日志中显示的查询边界
    const bounds = {
      north: 23.119219,
      south: 23.118289,
      east: 113.333666,
      west: 113.317637
    };

    console.log('========== 查询边界 ==========');
    console.log(`北: ${bounds.north}`);
    console.log(`南: ${bounds.south}`);
    console.log(`东: ${bounds.east}`);
    console.log(`西: ${bounds.west}\n`);

    // 1. 按照后端API相同的逻辑查询
    console.log('========== 步骤1: 按后端API逻辑查询 ==========');
    const pixels1 = await db('pixels')
      .select('grid_id', 'latitude', 'longitude', 'color', 'pattern_id')
      .where('latitude', '>=', bounds.south)
      .where('latitude', '<=', bounds.north)
      .where('longitude', '>=', bounds.west)
      .where('longitude', '<=', bounds.east)
      .orderBy('latitude', 'asc')
      .orderBy('longitude', 'asc');

    console.log(`✅ 查询结果: ${pixels1.length} 个像素\n`);

    if (pixels1.length > 0) {
      console.log('前10个像素:');
      pixels1.slice(0, 10).forEach((p, i) => {
        console.log(`${i + 1}. grid_id: ${p.grid_id}, lat: ${p.latitude}, lng: ${p.longitude}, color: ${p.color}`);
      });
    } else {
      console.log('❌ 没有找到像素！\n');
    }

    // 2. 检查这个范围周围是否有像素
    console.log('\n========== 步骤2: 扩大范围查询 ==========');
    const expandedBounds = {
      north: bounds.north + 0.01,
      south: bounds.south - 0.01,
      east: bounds.east + 0.01,
      west: bounds.west - 0.01
    };

    const pixels2 = await db('pixels')
      .select('grid_id', 'latitude', 'longitude', 'color', 'pattern_id')
      .where('latitude', '>=', expandedBounds.south)
      .where('latitude', '<=', expandedBounds.north)
      .where('longitude', '>=', expandedBounds.west)
      .where('longitude', '<=', expandedBounds.east)
      .limit(20);

    console.log(`扩大范围后查询结果: ${pixels2.length} 个像素\n`);

    if (pixels2.length > 0) {
      console.log('前10个像素:');
      pixels2.slice(0, 10).forEach((p, i) => {
        console.log(`${i + 1}. grid_id: ${p.grid_id}, lat: ${p.latitude}, lng: ${p.longitude}, color: ${p.color}`);
      });
    }

    // 3. 查询广州市所有像素的经纬度范围
    console.log('\n========== 步骤3: 查询广州市像素分布 ==========');
    const guangzhouStats = await db('pixels')
      .where('latitude', '>=', 23.0)
      .where('latitude', '<=', 23.3)
      .where('longitude', '>=', 113.1)
      .where('longitude', '<=', 113.5)
      .select(
        db.raw('MIN(latitude) as min_lat'),
        db.raw('MAX(latitude) as max_lat'),
        db.raw('MIN(longitude) as min_lng'),
        db.raw('MAX(longitude) as max_lng'),
        db.raw('COUNT(*) as count')
      )
      .first();

    console.log('广州市像素统计:');
    console.log(`  纬度范围: ${guangzhouStats.min_lat} ~ ${guangzhouStats.max_lat}`);
    console.log(`  经度范围: ${guangzhouStats.min_lng} ~ ${guangzhouStats.max_lng}`);
    console.log(`  像素总数: ${guangzhouStats.count}\n`);

    // 4. 检查数据类型
    console.log('========== 步骤4: 检查数据类型 ==========');
    const samplePixels = await db('pixels')
      .where('latitude', '>=', 23.0)
      .where('latitude', '<=', 23.3)
      .where('longitude', '>=', 113.1)
      .where('longitude', '<=', 113.5)
      .limit(5);

    if (samplePixels.length > 0) {
      const sample = samplePixels[0];
      console.log('样本像素数据类型:');
      console.log(`  latitude: ${sample.latitude} (${typeof sample.latitude})`);
      console.log(`  longitude: ${sample.longitude} (${typeof sample.longitude})`);
      console.log(`  原始数据:`, sample);
    }

    await db.destroy();
    console.log('\n✅ 检查完成!');

  } catch (error) {
    console.error('❌ 检查失败:', error);
    await db.destroy();
    process.exit(1);
  }
}

checkGuangzhouTowerPixels();
