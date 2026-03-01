#!/usr/bin/env node
/**
 * 为用户生成有效的访问token
 */

const { db } = require('../src/config/database');
const jwt = require('jsonwebtoken');

async function getUserToken(username) {
  try {
    // 1. 查询用户
    const user = await db('users').where({ username }).first();

    if (!user) {
      console.log(`❌ 用户 "${username}" 不存在`);
      process.exit(1);
    }

    console.log(`✅ 找到用户: ${user.username} (${user.id})\n`);

    // 2. 生成token（使用与后端相同的逻辑）
    const JWT_SECRET = process.env.JWT_SECRET;

    const accessToken = jwt.sign(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        is_admin: user.role === 'admin' || user.role === 'super_admin'
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    console.log('🔑 访问Token (1小时有效):');
    console.log(accessToken);
    console.log('');

    console.log('📋 Token payload:');
    const decoded = jwt.decode(accessToken);
    console.log(JSON.stringify(decoded, null, 2));
    console.log('');

    console.log('🧪 测试命令:');
    console.log(`curl -X GET http://192.168.0.3:3001/api/drift-bottles/quota \\`);
    console.log(`  -H "Authorization: Bearer ${accessToken}"`);
    console.log('');

    await db.destroy();
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}

const username = process.argv[2] || 'bcd';
getUserToken(username);
