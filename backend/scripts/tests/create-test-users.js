/**
 * 创建测试用户脚本
 */

const { db } = require('./src/config/database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

async function createTestUsers() {
  try {
    console.log('🔧 开始创建测试用户...\n');

    // 测试用户数据
    const users = [
      {
        username: 'testusera',
        password: 'test123',
        email: 'testusera@example.com',
        display_name: 'Test User A'
      },
      {
        username: 'testuserb',
        password: 'test123',
        email: 'testuserb@example.com',
        display_name: 'Test User B'
      }
    ];

    for (const userData of users) {
      // 检查用户是否已存在
      const existing = await db('users')
        .where('username', userData.username)
        .first();

      if (existing) {
        console.log(`✅ 用户 ${userData.username} 已存在 (ID: ${existing.id})`);
        continue;
      }

      // 加密密码
      const password_hash = await bcrypt.hash(userData.password, 10);

      // 插入用户
      const [user] = await db('users')
        .insert({
          id: uuidv4(),
          username: userData.username,
          email: userData.email,
          password_hash: password_hash,
          display_name: userData.display_name,
          total_pixels: 0,
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning('*');

      console.log(`✅ 创建用户成功: ${user.username} (ID: ${user.id})`);
    }

    console.log('\n🎉 测试用户创建完成！');
    process.exit(0);

  } catch (error) {
    console.error('❌ 创建测试用户失败:', error);
    process.exit(1);
  }
}

createTestUsers();
