#!/usr/bin/env node
/**
 * 检查bcd用户登录凭据
 */

const { db } = require('../src/config/database');
const bcrypt = require('bcryptjs');

async function checkBcdLogin() {
  try {
    console.log('🔍 检查bcd用户登录信息...\n');

    // 1. 查找bcd用户
    const user = await db('users')
      .where('username', 'bcd')
      .orWhere('email', 'bcd@example.com')
      .first();

    if (!user) {
      console.error('❌ 用户不存在！');
      console.log('尝试查找所有包含"bcd"的用户：');
      const similarUsers = await db('users')
        .where('username', 'like', '%bcd%')
        .orWhere('email', 'like', '%bcd%')
        .select('id', 'username', 'email', 'created_at');
      console.log(similarUsers);
      process.exit(1);
    }

    console.log('✅ 找到用户：');
    console.log({
      id: user.id,
      username: user.username,
      email: user.email,
      created_at: user.created_at,
      password_hash: user.password_hash ? `${user.password_hash.substring(0, 20)}...` : null
    });

    // 2. 验证密码
    console.log('\n🔐 验证密码...');
    const testPassword = 'password123';

    if (!user.password_hash) {
      console.error('❌ 用户没有密码哈希！');
      console.log('\n修复方法：');
      console.log(`const bcrypt = require('bcryptjs');`);
      console.log(`const hash = await bcrypt.hash('password123', 10);`);
      console.log(`await db('users').where('id', '${user.id}').update({ password_hash: hash });`);
      process.exit(1);
    }

    const isValid = await bcrypt.compare(testPassword, user.password_hash);

    if (isValid) {
      console.log(`✅ 密码正确！可以使用以下凭据登录：`);
      console.log(`   邮箱：${user.email}`);
      console.log(`   密码：${testPassword}`);
    } else {
      console.error('❌ 密码不匹配！');
      console.log('\n🔧 重置密码：');
      const newHash = await bcrypt.hash(testPassword, 10);
      await db('users')
        .where('id', user.id)
        .update({ password_hash: newHash });
      console.log(`✅ 密码已重置为：${testPassword}`);
      console.log(`   现在可以使用 ${user.email} / ${testPassword} 登录`);
    }

  } catch (error) {
    console.error('❌ 检查失败:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

checkBcdLogin();
