const knex = require('knex');
const bcrypt = require('bcryptjs');

// 直接配置数据库连接，不依赖Redis
const db = knex({
  client: 'postgresql',
  connection: {
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'password',
    database: 'funnypixels_postgres'
  }
});

async function resetPassword() {
  try {
    console.log('🔐 重置用户密码...');
    
    // 查找用户
    const user = await db('users').where('username', 'buyer').first();
    
    if (!user) {
      console.log('❌ 用户 buyer 不存在');
      return;
    }
    
    console.log('✅ 找到用户:', user.username);
    
    // 生成新密码哈希
    const newPassword = 'password123';
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
    
    // 更新密码
    await db('users')
      .where('id', user.id)
      .update({ password_hash: newPasswordHash });
    
    console.log('✅ 密码重置成功');
    console.log('新密码:', newPassword);
    console.log('新密码哈希:', newPasswordHash);
    
  } catch (error) {
    console.error('❌ 重置失败:', error);
  } finally {
    await db.destroy();
    process.exit(0);
  }
}

resetPassword();
