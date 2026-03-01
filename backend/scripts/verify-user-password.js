#!/usr/bin/env node

const { db } = require('../src/config/database');
const bcrypt = require('bcryptjs');

async function verifyUserPassword() {
  try {
    console.log('🔐 验证用户密码...');
    
    const user = await db('users').where('email', 'test@example.com').first();
    
    if (!user) {
      console.log('❌ 用户不存在');
      return;
    }
    
    console.log('👤 用户信息:');
    console.log(`  ID: ${user.id}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Username: ${user.username}`);
    console.log(`  Password Hash: ${user.password.substring(0, 20)}...`);
    
    // 验证密码
    const isValid = await bcrypt.compare('password123', user.password);
    console.log(`🔑 密码验证结果: ${isValid ? '✅ 正确' : '❌ 错误'}`);
    
    if (!isValid) {
      console.log('🔧 重新设置密码...');
      const hashedPassword = await bcrypt.hash('password123', 10);
      await db('users')
        .where('id', user.id)
        .update({ password: hashedPassword });
      
      console.log('✅ 密码已重新设置');
      
      // 再次验证
      const newUser = await db('users').where('email', 'test@example.com').first();
      const newIsValid = await bcrypt.compare('password123', newUser.password);
      console.log(`🔑 新密码验证结果: ${newIsValid ? '✅ 正确' : '❌ 错误'}`);
    }
    
  } catch (error) {
    console.error('❌ 验证密码失败:', error);
  } finally {
    await db.destroy();
  }
}

verifyUserPassword();
