#!/usr/bin/env node

/**
 * 检查数据库中的用户信息
 */

const { db } = require('../../backend/src/config/database');

async function checkUsers() {
  try {
    console.log('👥 检查数据库中的用户信息\n');

    // 获取所有用户
    const users = await db('users').select('*').limit(10);
    console.log(`📊 数据库中共有 ${await db('users').count('* as count').first().then(r => r.count)} 个用户`);
    console.log('前10个用户:');

    users.forEach((user, index) => {
      console.log(`${index + 1}. ID: ${user.id}`);
      console.log(`   用户名: ${user.username || 'N/A'}`);
      console.log(`   邮箱: ${user.email || 'N/A'}`);
      console.log(`   创建时间: ${user.created_at}`);
      console.log(`   总像素数: ${user.total_pixels || 0}`);
      console.log('');
    });

    // 特别检查有像素记录的用户
    console.log('🎨 有像素记录的用户:');
    const usersWithPixels = await db('pixels')
      .select('user_id')
      .whereNotNull('user_id')
      .distinct()
      .limit(5);

    for (const userPixel of usersWithPixels) {
      const user = await db('users').where('id', userPixel.user_id).first();
      if (user) {
        console.log(`- ${user.username || user.email || user.id} (${userPixel.user_id})`);
      }
    }

    await db.destroy();
  } catch (error) {
    console.error('❌ 查询失败:', error);
    process.exit(1);
  }
}

checkUsers();