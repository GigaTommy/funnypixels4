#!/usr/bin/env node

/**
 * 生成示例排行榜数据
 * 为测试地理排行榜API创建一些示例数据
 */

const { db } = require('../src/config/database');

async function generateSampleLeaderboardData() {
  try {
    console.log('🎲 开始生成示例排行榜数据...');
    
    // 检查表是否存在
    const tableExists = await db.schema.hasTable('leaderboard_stats');
    if (!tableExists) {
      console.log('❌ leaderboard_stats 表不存在，请先运行 create-leaderboard-tables.js');
      process.exit(1);
    }
    
    // 清空现有数据
    console.log('🧹 清空现有数据...');
    await db('leaderboard_stats').del();
    console.log('✅ 现有数据已清空');
    
    // 生成示例省份数据
    console.log('🏞️ 生成省份数据...');
    const provinces = [
      { code: '110000', name: '北京市', pixel_count: 1250, user_count: 89 },
      { code: '120000', name: '天津市', pixel_count: 980, user_count: 67 },
      { code: '130000', name: '河北省', pixel_count: 2100, user_count: 156 },
      { code: '140000', name: '山西省', pixel_count: 1800, user_count: 134 },
      { code: '150000', name: '内蒙古自治区', pixel_count: 1650, user_count: 98 },
      { code: '210000', name: '辽宁省', pixel_count: 1950, user_count: 145 },
      { code: '220000', name: '吉林省', pixel_count: 1200, user_count: 87 },
      { code: '230000', name: '黑龙江省', pixel_count: 1400, user_count: 102 },
      { code: '310000', name: '上海市', pixel_count: 1800, user_count: 128 },
      { code: '320000', name: '江苏省', pixel_count: 2500, user_count: 189 },
      { code: '330000', name: '浙江省', pixel_count: 2200, user_count: 167 },
      { code: '340000', name: '安徽省', pixel_count: 1900, user_count: 143 },
      { code: '350000', name: '福建省', pixel_count: 1600, user_count: 121 },
      { code: '360000', name: '江西省', pixel_count: 1700, user_count: 129 },
      { code: '370000', name: '山东省', pixel_count: 2300, user_count: 175 },
      { code: '410000', name: '河南省', pixel_count: 2000, user_count: 152 },
      { code: '420000', name: '湖北省', pixel_count: 1850, user_count: 138 },
      { code: '430000', name: '湖南省', pixel_count: 1750, user_count: 131 },
      { code: '440000', name: '广东省', pixel_count: 2800, user_count: 210 },
      { code: '450000', name: '广西壮族自治区', pixel_count: 1500, user_count: 112 },
      { code: '460000', name: '海南省', pixel_count: 800, user_count: 58 },
      { code: '500000', name: '重庆市', pixel_count: 1200, user_count: 89 },
      { code: '510000', name: '四川省', pixel_count: 2100, user_count: 158 },
      { code: '520000', name: '贵州省', pixel_count: 1300, user_count: 97 },
      { code: '530000', name: '云南省', pixel_count: 1600, user_count: 119 },
      { code: '540000', name: '西藏自治区', pixel_count: 600, user_count: 43 },
      { code: '610000', name: '陕西省', pixel_count: 1800, user_count: 134 },
      { code: '620000', name: '甘肃省', pixel_count: 1400, user_count: 104 },
      { code: '630000', name: '青海省', pixel_count: 500, user_count: 37 },
      { code: '640000', name: '宁夏回族自治区', pixel_count: 700, user_count: 52 },
      { code: '650000', name: '新疆维吾尔自治区', pixel_count: 1100, user_count: 82 }
    ];
    
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    for (let i = 0; i < provinces.length; i++) {
      const province = provinces[i];
      // 为每个省份使用不同的时间戳来避免唯一约束冲突
      const uniquePeriodStart = new Date(periodStart.getTime() + i * 1000);
      
      await db('leaderboard_stats').insert({
        leaderboard_type: 'geographic',
        region_level: 'province',
        region_code: province.code,
        region_name: province.name,
        pixel_count: province.pixel_count,
        user_count: province.user_count,
        period: 'daily',
        period_start: uniquePeriodStart,
        period_end: new Date(uniquePeriodStart.getTime() + 24 * 60 * 60 * 1000),
        total_entries: 1,
        total_pixels: province.pixel_count,
        last_calculated: now,
        created_at: now,
        updated_at: now
      });
    }
    console.log(`✅ 生成了 ${provinces.length} 个省份的数据`);
    
    // 生成示例城市数据
    console.log('🏙️ 生成城市数据...');
    const cities = [
      { code: '110100', name: '北京市', pixel_count: 1250, user_count: 89 },
      { code: '120100', name: '天津市', pixel_count: 980, user_count: 67 },
      { code: '130100', name: '石家庄市', pixel_count: 450, user_count: 34 },
      { code: '130200', name: '唐山市', pixel_count: 380, user_count: 28 },
      { code: '130300', name: '秦皇岛市', pixel_count: 320, user_count: 24 },
      { code: '140100', name: '太原市', pixel_count: 420, user_count: 31 },
      { code: '140200', name: '大同市', pixel_count: 350, user_count: 26 },
      { code: '150100', name: '呼和浩特市', pixel_count: 380, user_count: 28 },
      { code: '150200', name: '包头市', pixel_count: 320, user_count: 24 },
      { code: '210100', name: '沈阳市', pixel_count: 520, user_count: 39 },
      { code: '210200', name: '大连市', pixel_count: 480, user_count: 36 },
      { code: '220100', name: '长春市', pixel_count: 450, user_count: 34 },
      { code: '230100', name: '哈尔滨市', pixel_count: 480, user_count: 36 },
      { code: '310100', name: '上海市', pixel_count: 1800, user_count: 128 },
      { code: '320100', name: '南京市', pixel_count: 650, user_count: 49 },
      { code: '320200', name: '无锡市', pixel_count: 580, user_count: 43 },
      { code: '320300', name: '徐州市', pixel_count: 520, user_count: 39 },
      { code: '330100', name: '杭州市', pixel_count: 720, user_count: 54 },
      { code: '330200', name: '宁波市', pixel_count: 650, user_count: 49 },
      { code: '340100', name: '合肥市', pixel_count: 580, user_count: 43 },
      { code: '350100', name: '福州市', pixel_count: 520, user_count: 39 },
      { code: '360100', name: '南昌市', pixel_count: 480, user_count: 36 },
      { code: '370100', name: '济南市', pixel_count: 620, user_count: 47 },
      { code: '370200', name: '青岛市', pixel_count: 680, user_count: 51 },
      { code: '410100', name: '郑州市', pixel_count: 650, user_count: 49 },
      { code: '420100', name: '武汉市', pixel_count: 720, user_count: 54 },
      { code: '430100', name: '长沙市', pixel_count: 680, user_count: 51 },
      { code: '440100', name: '广州市', pixel_count: 950, user_count: 71 },
      { code: '440300', name: '深圳市', pixel_count: 1200, user_count: 89 },
      { code: '450100', name: '南宁市', pixel_count: 480, user_count: 36 },
      { code: '460100', name: '海口市', pixel_count: 320, user_count: 24 },
      { code: '500100', name: '重庆市', pixel_count: 1200, user_count: 89 },
      { code: '510100', name: '成都市', pixel_count: 850, user_count: 64 },
      { code: '520100', name: '贵阳市', pixel_count: 420, user_count: 31 },
      { code: '530100', name: '昆明市', pixel_count: 580, user_count: 43 },
      { code: '540100', name: '拉萨市', pixel_count: 200, user_count: 15 },
      { code: '610100', name: '西安市', pixel_count: 650, user_count: 49 },
      { code: '620100', name: '兰州市', pixel_count: 420, user_count: 31 },
      { code: '630100', name: '西宁市', pixel_count: 200, user_count: 15 },
      { code: '640100', name: '银川市', pixel_count: 280, user_count: 21 },
      { code: '650100', name: '乌鲁木齐市', pixel_count: 380, user_count: 28 }
    ];
    
    for (let i = 0; i < cities.length; i++) {
      const city = cities[i];
      // 为每个城市使用不同的时间戳来避免唯一约束冲突
      const uniquePeriodStart = new Date(periodStart.getTime() + (provinces.length + i) * 1000);
      
      await db('leaderboard_stats').insert({
        leaderboard_type: 'geographic',
        region_level: 'city',
        region_code: city.code,
        region_name: city.name,
        pixel_count: city.pixel_count,
        user_count: city.user_count,
        period: 'daily',
        period_start: uniquePeriodStart,
        period_end: new Date(uniquePeriodStart.getTime() + 24 * 60 * 60 * 1000),
        total_entries: 1,
        total_pixels: city.pixel_count,
        last_calculated: now,
        created_at: now,
        updated_at: now
      });
    }
    console.log(`✅ 生成了 ${cities.length} 个城市的数据`);
    
    // 生成国家数据
    console.log('🇨🇳 生成国家数据...');
    const totalPixels = provinces.reduce((sum, p) => sum + p.pixel_count, 0);
    const totalUsers = provinces.reduce((sum, p) => sum + p.user_count, 0);
    
    // 为国家数据使用不同的时间戳
    const countryPeriodStart = new Date(periodStart.getTime() + (provinces.length + cities.length) * 1000);
    
    await db('leaderboard_stats').insert({
      leaderboard_type: 'geographic',
      region_level: 'country',
      region_code: 'CN',
      region_name: '中国',
      pixel_count: totalPixels,
      user_count: totalUsers,
      period: 'daily',
      period_start: countryPeriodStart,
      period_end: new Date(countryPeriodStart.getTime() + 24 * 60 * 60 * 1000),
      total_entries: 1,
      total_pixels: totalPixels,
      last_calculated: now,
      created_at: now,
      updated_at: now
    });
    console.log('✅ 生成了国家数据');
    
    // 验证数据
    console.log('\n📊 数据验证:');
    const totalCount = await db('leaderboard_stats').count('* as count').first();
    console.log(`总记录数: ${totalCount.count}`);
    
    const provinceCount = await db('leaderboard_stats')
      .where('region_level', 'province')
      .count('* as count')
      .first();
    console.log(`省份记录数: ${provinceCount.count}`);
    
    const cityCount = await db('leaderboard_stats')
      .where('region_level', 'city')
      .count('* as count')
      .first();
    console.log(`城市记录数: ${cityCount.count}`);
    
    const countryCount = await db('leaderboard_stats')
      .where('region_level', 'country')
      .count('* as count')
      .first();
    console.log(`国家记录数: ${countryCount.count}`);
    
    console.log('\n✅ 示例排行榜数据生成完成！');
    console.log('🎉 现在可以测试排行榜API了');
    
  } catch (error) {
    console.error('❌ 生成失败:', error.message);
    console.error(error.stack);
  } finally {
    await db.destroy();
  }
}

// 运行生成
if (require.main === module) {
  generateSampleLeaderboardData();
}

module.exports = generateSampleLeaderboardData;
