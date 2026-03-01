/**
 * 区域/城市种子数据
 *
 * 修复记录:
 * - 2026-02-17: 修复列名 center_lat/center_lng; 添加必填 code 字段
 */
exports.seed = async function (knex) {
  const regions = [
    { code: 'CN-BJ',  name: '北京', country: '中国', center_lat: 39.9042, center_lng: 116.4074, population: 21540000, timezone: 'Asia/Shanghai' },
    { code: 'CN-SH',  name: '上海', country: '中国', center_lat: 31.2304, center_lng: 121.4737, population: 24280000, timezone: 'Asia/Shanghai' },
    { code: 'CN-GZ',  name: '广州', country: '中国', center_lat: 23.1291, center_lng: 113.2644, population: 15300000, timezone: 'Asia/Shanghai' },
    { code: 'CN-SZ',  name: '深圳', country: '中国', center_lat: 22.3193, center_lng: 114.1694, population: 13440000, timezone: 'Asia/Shanghai' },
    { code: 'CN-HZ',  name: '杭州', country: '中国', center_lat: 30.2741, center_lng: 120.1551, population: 11940000, timezone: 'Asia/Shanghai' },
    { code: 'CN-CD',  name: '成都', country: '中国', center_lat: 30.5728, center_lng: 104.0668, population: 16330000, timezone: 'Asia/Shanghai' },
  ];

  for (const region of regions) {
    const existing = await knex('regions')
      .where('code', region.code)
      .first();

    if (!existing) {
      await knex('regions').insert({
        ...region,
        level: 'city',
        is_active: true,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      });
    }
  }

  console.log(`✅ regions: ${regions.length} 条区域数据已同步`);
};
