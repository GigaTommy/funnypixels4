/**
 * 创建演示地区数据
 *
 * 功能：为测试环境创建带有地区信息的像素数据
 * 不依赖高德API，直接写入模拟数据
 */

const knex = require('knex');
const knexConfig = require('../knexfile');

const db = knex(knexConfig.development);

// 模拟地区数据
const demoLocations = [
  // 广东省
  { province: '广东省', city: '广州市', district: '天河区', count: 50 },
  { province: '广东省', city: '深圳市', district: '南山区', count: 45 },
  { province: '广东省', city: '珠海市', district: '香洲区', count: 20 },
  { province: '广东省', city: '东莞市', district: '南城区', count: 15 },

  // 北京市
  { province: '北京市', city: '北京市', district: '朝阳区', count: 40 },
  { province: '北京市', city: '北京市', district: '海淀区', count: 35 },

  // 上海市
  { province: '上海市', city: '上海市', district: '浦东新区', count: 38 },
  { province: '上海市', city: '上海市', district: '徐汇区', count: 25 },

  // 浙江省
  { province: '浙江省', city: '杭州市', district: '西湖区', count: 30 },
  { province: '浙江省', city: '宁波市', district: '鄞州区', count: 18 },

  // 江苏省
  { province: '江苏省', city: '南京市', district: '鼓楼区', count: 28 },
  { province: '江苏省', city: '苏州市', district: '姑苏区', count: 22 },

  // 四川省
  { province: '四川省', city: '成都市', district: '锦江区', count: 32 },
  { province: '四川省', city: '成都市', district: '武侯区', count: 20 },

  // 湖北省
  { province: '湖北省', city: '武汉市', district: '武昌区', count: 26 },

  // 陕西省
  { province: '陕西省', city: '西安市', district: '雁塔区', count: 24 },

  // 福建省
  { province: '福建省', city: '厦门市', district: '思明区', count: 16 },

  // 湖南省
  { province: '湖南省', city: '长沙市', district: '岳麓区', count: 19 },
];

async function createDemoData() {
  console.log('🚀 开始创建演示地区数据...\n');

  try {
    // 1. 获取未处理的像素
    const pixels = await db('pixels')
      .whereNull('geocoded')
      .orWhere('geocoded', false)
      .orderBy('id', 'asc')
      .limit(500);

    if (pixels.length === 0) {
      console.log('⚠️  没有未处理的像素，尝试使用已有像素...');

      const allPixels = await db('pixels')
        .orderBy('id', 'asc')
        .limit(500);

      if (allPixels.length === 0) {
        console.log('❌ 数据库中没有像素数据');
        process.exit(1);
      }

      pixels.push(...allPixels);
    }

    console.log(`📊 找到 ${pixels.length} 个像素待处理\n`);

    let pixelIndex = 0;
    let totalUpdated = 0;

    // 2. 按地区分配像素
    for (const location of demoLocations) {
      const count = Math.min(location.count, pixels.length - pixelIndex);

      if (count === 0) break;

      const pixelsToUpdate = pixels.slice(pixelIndex, pixelIndex + count);
      pixelIndex += count;

      // 批量更新
      await db('pixels')
        .whereIn('id', pixelsToUpdate.map(p => p.id))
        .update({
          country: '中国',
          province: location.province,
          city: location.city,
          district: location.district,
          adcode: '000000',
          formatted_address: `${location.province}${location.city}${location.district}`,
          geocoded: true,
          geocoded_at: new Date()
        });

      totalUpdated += count;
      console.log(`  ✅ ${location.province} ${location.city}: 已更新 ${count} 个像素`);
    }

    console.log(`\n✅ 演示数据创建完成！`);
    console.log(`  总计更新: ${totalUpdated} 个像素`);

    // 3. 验证结果
    const stats = await db('pixels')
      .select('province', 'city')
      .count('* as pixel_count')
      .where('geocoded', true)
      .groupBy('province', 'city')
      .orderBy('pixel_count', 'desc')
      .limit(10);

    console.log('\n📊 地区分布统计（Top 10）:');
    console.table(stats);

    // 4. 验证省份排行
    const provinceStats = await db('pixels')
      .select('province')
      .count('* as pixel_count')
      .where('geocoded', true)
      .groupBy('province')
      .orderBy('pixel_count', 'desc');

    console.log('\n🏆 省份排行榜:');
    provinceStats.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.province}: ${item.pixel_count} 像素`);
    });

    process.exit(0);
  } catch (error) {
    console.error('\n❌ 创建演示数据失败:', error);
    process.exit(1);
  }
}

// 优雅退出
process.on('SIGINT', async () => {
  console.log('\n\n⚠️  收到中断信号，正在安全退出...');
  await db.destroy();
  process.exit(0);
});

createDemoData();
