// backend/src/database/seeds/001_initial_data.js
exports.seed = async function(knex) {
  // 清空现有数据
  await knex('pixels').del();
  await knex('user_pixel_states').del();
  await knex('users').del();
  
  // 创建测试用户
  const [testUser] = await knex('users').insert({
    username: 'testuser',
    email: 'test@example.com',
    password_hash: '$2a$10$test.hash.for.testing.purposes.only'
  }).returning('*');
  
  // 创建用户像素状态
  await knex('user_pixel_states').insert({
    user_id: testUser.id,
    pixel_points: 64,
    last_accum_time: Math.floor(Date.now() / 1000),
    freeze_until: 0
  });
  
  // 创建一些测试像素
  const testPixels = [
    {
      grid_id: 'grid_1800000_900000', // 北京附近
      latitude: 39.9042,
      longitude: 116.4074,
      color: '#ff0000',
      user_id: testUser.id
    },
    {
      grid_id: 'grid_1800001_900001', // 上海附近
      latitude: 31.2304,
      longitude: 121.4737,
      color: '#00ff00',
      user_id: testUser.id
    },
    {
      grid_id: 'grid_1800002_900002', // 广州附近
      latitude: 23.1291,
      longitude: 113.2644,
      color: '#0000ff',
      user_id: testUser.id
    }
  ];
  
  await knex('pixels').insert(testPixels);
  
  console.log('✅ 种子数据创建完成');
  console.log('📊 创建了 1 个测试用户');
  console.log('�� 创建了 3 个测试像素');
};