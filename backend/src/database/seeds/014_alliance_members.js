// alliance_members 种子数据
exports.seed = async function(knex) {
  // 清空现有数据
  await knex('alliance_members').del();
  
  // 插入种子数据
  await knex('alliance_members').insert([
    {
      'id': 6,
      'alliance_id': 8,
      'user_id': 'd2a6c9c0-10d3-4e5f-a307-d8d05e9f4ba2',
      'role': 'leader',
      'joined_at': '2025-09-02T09:08:08.264Z',
      'created_at': '2025-09-02T09:08:08.264Z',
      'updated_at': '2025-09-02T09:08:08.264Z'
    },
    {
      'id': 7,
      'alliance_id': 9,
      'user_id': 'a79a1fbe-0f97-4303-b922-52b35e6948d5',
      'role': 'leader',
      'joined_at': '2025-09-02T16:49:25.951Z',
      'created_at': '2025-09-02T16:49:25.951Z',
      'updated_at': '2025-09-02T16:49:25.951Z'
    }
  ]);
  
  console.log('✅ alliance_members: 插入了 2 条记录');
};