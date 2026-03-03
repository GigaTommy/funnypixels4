#!/usr/bin/env node
/**
 * 修复bcd用户密码
 */

const { db } = require('../src/config/database');
const bcrypt = require('bcryptjs');

async function fixBcdPassword() {
  try {
    console.log('🔐 修复bcd用户密码...\n');

    const userId = 'a79a1fbe-0f97-4303-b922-52b35e6948d5';
    const newPassword = 'password123';

    // 生成密码哈希
    console.log('⚙️  生成密码哈希...');
    const hash = await bcrypt.hash(newPassword, 10);
    console.log(`✅ 密码哈希已生成: ${hash.substring(0, 30)}...`);

    // 更新数据库
    console.log('\n📝 更新数据库...');
    await db('users')
      .where('id', userId)
      .update({ password_hash: hash });

    console.log('✅ 密码已更新！');

    // 验证更新
    console.log('\n🔍 验证更新...');
    const user = await db('users')
      .where('id', userId)
      .first();

    if (user.password_hash) {
      const isValid = await bcrypt.compare(newPassword, user.password_hash);
      if (isValid) {
        console.log('✅ 验证成功！密码已正确设置');
        console.log('\n🎉 现在可以使用以下凭据登录：');
        console.log(`   邮箱: ${user.email}`);
        console.log(`   密码: ${newPassword}`);
      } else {
        console.error('❌ 验证失败！密码哈希不匹配');
        process.exit(1);
      }
    } else {
      console.error('❌ 密码哈希仍然为空！');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ 修复失败:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

fixBcdPassword();
