#!/usr/bin/env node
'use strict';

/**
 * 重置用户密码脚本
 */

const bcrypt = require('bcryptjs');
const { Client } = require('pg');

const CONFIG = {
  // 数据库连接配置 - 根据你的实际配置修改
  DB: {
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '', // 填入你的数据库密码
    database: 'funnypixels_postgres'
  }
};

async function resetPassword(username, newPassword) {
  const client = new Client(CONFIG.DB);
  
  try {
    await client.connect();
    console.log('�� 数据库连接成功');
    
    // 生成密码哈希
    const passwordHash = await bcrypt.hash(newPassword, 10);
    console.log('🔐 密码哈希生成完成');
    
    // 更新用户密码
    const result = await client.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE username = $2',
      [passwordHash, username]
    );
    
    if (result.rowCount > 0) {
      console.log(`✅ 用户 ${username} 密码重置成功`);
      console.log(`�� 影响行数: ${result.rowCount}`);
    } else {
      console.log(`❌ 用户 ${username} 不存在`);
    }
    
  } catch (error) {
    console.error('❌ 重置密码失败:', error.message);
  } finally {
    await client.end();
  }
}

async function main() {
  const username = process.argv[2] || 'abcabc';
  const newPassword = process.argv[3] || 'abcabc';
  
  console.log('🚀 重置用户密码');
  console.log('='.repeat(40));
  console.log(`👤 用户名: ${username}`);
  console.log(`🔑 新密码: ${newPassword}`);
  console.log('');
  
  await resetPassword(username, newPassword);
}

// 运行主函数
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { resetPassword, CONFIG };