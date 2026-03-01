/**
 * 测试修复后的查询逻辑
 */

// 设置环境变量
process.env.LOCAL_VALIDATION = 'true';

const { db } = require('../config/database');

async function testFixedQuery() {
  try {
    console.log('🔍 测试修复后的查询逻辑...\n');

    // 原始查询边界（从日志中获取）
    const bounds = {
      north: 23.119219,
      south: 23.118289,
      east: 113.333666,
      west: 113.317637
    };

    console.log('========== 测试1: 使用旧的查询方法（字符串比较）==========');
    const oldPixels = await db('pixels')
      .select('grid_id', 'latitude', 'longitude', 'color')
      .where('latitude', '>=', bounds.south)
      .where('latitude', '<=', bounds.north)
      .where('longitude', '>=', bounds.west)
      .where('longitude', '<=', bounds.east);

    console.log(`旧方法查询结果: ${oldPixels.length} 个像素\n`);

    console.log('========== 测试2: 使用新的查询方法（数字比较）==========');
    const newPixels = await db('pixels')
      .select('grid_id', 'latitude', 'longitude', 'color')
      .whereRaw('CAST(latitude AS DECIMAL) >= ?', [bounds.south])
      .whereRaw('CAST(latitude AS DECIMAL) <= ?', [bounds.north])
      .whereRaw('CAST(longitude AS DECIMAL) >= ?', [bounds.west])
      .whereRaw('CAST(longitude AS DECIMAL) <= ?', [bounds.east]);

    console.log(`新方法查询结果: ${newPixels.length} 个像素\n`);

    if (newPixels.length > 0) {
      console.log('✅ 修复成功！前10个像素:');
      newPixels.slice(0, 10).forEach((p, i) => {
        console.log(`${i + 1}. grid_id: ${p.grid_id}, lat: ${p.latitude}, lng: ${p.longitude}, color: ${p.color}`);
      });
    } else {
      console.log('❌ 仍然没有找到像素');
    }

    // 测试广州塔附近的实际像素范围
    console.log('\n========== 测试3: 广州塔附近实际像素范围 ==========');
    const guangzhouTowerArea = {
      north: 23.13,
      south: 23.10,
      east: 113.32,
      west: 113.30
    };

    const guangzhouPixels = await db('pixels')
      .select('grid_id', 'latitude', 'longitude', 'color')
      .whereRaw('CAST(latitude AS DECIMAL) >= ?', [guangzhouTowerArea.south])
      .whereRaw('CAST(latitude AS DECIMAL) <= ?', [guangzhouTowerArea.north])
      .whereRaw('CAST(longitude AS DECIMAL) >= ?', [guangzhouTowerArea.west])
      .whereRaw('CAST(longitude AS DECIMAL) <= ?', [guangzhouTowerArea.east]);

    console.log(`广州塔附近像素: ${guangzhouPixels.length} 个\n`);

    if (guangzhouPixels.length > 0) {
      console.log('前10个像素:');
      guangzhouPixels.slice(0, 10).forEach((p, i) => {
        console.log(`${i + 1}. grid_id: ${p.grid_id}, lat: ${p.latitude}, lng: ${p.longitude}, color: ${p.color}`);
      });
    }

    await db.destroy();
    console.log('\n✅ 测试完成!');

  } catch (error) {
    console.error('❌ 测试失败:', error);
    await db.destroy();
    process.exit(1);
  }
}

testFixedQuery();
