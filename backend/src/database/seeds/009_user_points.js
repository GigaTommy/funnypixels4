// user_points 种子数据
exports.seed = async function(knex) {
  // 清空现有数据
  await knex('user_points').del();
  
  // 插入种子数据
  await knex('user_points').insert([
    {
      'id': 'a482769d-565b-4381-ad27-afedccead51b',
      'user_id': 'a79a1fbe-0f97-4303-b922-52b35e6948d5',
      'total_points': 4000,
      'created_at': '2025-09-02T16:48:52.589Z',
      'updated_at': '2025-09-05T00:35:12.183Z'
    },
    {
      'id': '19fc8066-18da-4271-a884-07cc040c7bdc',
      'user_id': 'd2a6c9c0-10d3-4e5f-a307-d8d05e9f4ba2',
      'total_points': 10000,
      'created_at': '2025-09-02T08:49:17.689Z',
      'updated_at': '2025-09-02T08:50:31.621Z'
    }
  ]);
  
  console.log('✅ user_points: 插入了 2 条记录');
};