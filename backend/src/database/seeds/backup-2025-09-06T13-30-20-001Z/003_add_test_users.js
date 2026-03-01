// backend/src/database/seeds/003_add_test_users.js
const bcrypt = require('bcrypt');

exports.seed = async function(knex) {
  console.log('🌱 开始创建测试用户...');
  
  // 检查是否已存在测试用户
  const existingUsers = await knex('users')
    .whereIn('username', ['testuser1', 'testuser2'])
    .select('username');
  
  const existingUsernames = existingUsers.map(user => user.username);
  
  // 测试用户数据
  const testUsers = [
    {
      username: 'testuser1',
      email: 'test1@example.com',
      password_hash: await bcrypt.hash('password123', 10),
      avatar_url: 'https://api.dicebear.com/7.x/avatars/svg?seed=testuser1',
      display_name: '测试用户1',
      bio: '这是测试用户1',
      level: 1,
      experience: 0,
      coins: 100,
      gems: 10
    },
    {
      username: 'testuser2',
      email: 'test2@example.com',
      password_hash: await bcrypt.hash('password123', 10),
      avatar_url: 'https://api.dicebear.com/7.x/avatars/svg?seed=testuser2',
      display_name: '测试用户2',
      bio: '这是测试用户2',
      level: 1,
      experience: 0,
      coins: 100,
      gems: 10
    }
  ];
  
  let createdCount = 0;
  
  for (const user of testUsers) {
    if (!existingUsernames.includes(user.username)) {
      try {
        // 创建用户
        const [createdUser] = await knex('users').insert(user).returning('*');
        
        // 创建用户像素状态
        await knex('user_pixel_states').insert({
          user_id: createdUser.id,
          pixel_points: 64,
          last_accum_time: Math.floor(Date.now() / 1000),
          freeze_until: 0
        });
        
        console.log(`✅ 创建测试用户: ${user.username} (ID: ${createdUser.id})`);
        createdCount++;
        
      } catch (error) {
        console.error(`❌ 创建测试用户 ${user.username} 失败:`, error.message);
      }
    } else {
      console.log(`⚠️ 测试用户 ${user.username} 已存在，跳过创建`);
    }
  }
  
  console.log(`📊 测试用户创建完成，新增 ${createdCount} 个用户`);
  
  // 显示测试用户信息
  const allTestUsers = await knex('users')
    .whereIn('username', ['testuser1', 'testuser2'])
    .select('id', 'username', 'email', 'display_name');
  
  console.log('\n📋 测试用户信息:');
  console.log('================');
  allTestUsers.forEach((user, index) => {
    console.log(`${index + 1}. 用户名: ${user.username}`);
    console.log(`   邮箱: ${user.email}`);
    console.log(`   显示名: ${user.display_name}`);
    console.log(`   用户ID: ${user.id}`);
    console.log('   密码: password123');
    console.log('');
  });
};
