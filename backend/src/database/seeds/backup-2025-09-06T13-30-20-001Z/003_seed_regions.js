const { v4: uuidv4 } = require('uuid');

exports.seed = async function(knex) {
  // 清空地区表
  await knex('regions').del();

  // 插入地区数据
  return knex('regions').insert([
    {
      name: '北京',
      country: '中国',
      latitude: 39.9042,
      longitude: 116.4074,
      population: 21540000,
      timezone: 'Asia/Shanghai'
    },
    {
      name: '上海',
      country: '中国',
      latitude: 31.2304,
      longitude: 121.4737,
      population: 24280000,
      timezone: 'Asia/Shanghai'
    },
    {
      name: '广州',
      country: '中国',
      latitude: 23.1291,
      longitude: 113.2644,
      population: 15300000,
      timezone: 'Asia/Shanghai'
    },
    {
      name: '深圳',
      country: '中国',
      latitude: 22.3193,
      longitude: 114.1694,
      population: 13440000,
      timezone: 'Asia/Shanghai'
    },
    {
      name: '杭州',
      country: '中国',
      latitude: 30.2741,
      longitude: 120.1551,
      population: 11940000,
      timezone: 'Asia/Shanghai'
    },
    {
      name: '成都',
      country: '中国',
      latitude: 30.5728,
      longitude: 104.0668,
      population: 16330000,
      timezone: 'Asia/Shanghai'
    }
  ]);
};
