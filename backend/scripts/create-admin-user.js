#!/usr/bin/env node

/**
 * 在生产环境中创建 admin 用户
 * 用于解决 pattern_assets 外键约束问题
 */

const fs = require('fs');
const path = require('path');
const knex = require('knex');
const bcrypt = require('bcrypt');

const ADMIN_USER_ID = 'b16dceb6-5237-4134-a97b-d8893136db2d';

async function createAdminUser() {
  console.log('👤 创建 admin 用户...');

  // 读取生产环境配置
  let productionConfig = {
    client: 'postgresql',
    connection: {
      host: process.env.PROD_DB_HOST || 'localhost',
      port: process.env.PROD_DB_PORT || 5432,
      user: process.env.PROD_DB_USER || 'postgres',
      password: process.env.PROD_DB_PASSWORD || '',
      database: process.env.PROD_DB_NAME || 'funnypixels_prod',
      ssl: process.env.PROD_DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    }
  };

  const prodConfigPath = path.join(__dirname, '../config/production-database.json');
  if (fs.existsSync(prodConfigPath)) {
    const prodConfig = JSON.parse(fs.readFileSync(prodConfigPath, 'utf8'));
    productionConfig = {
      client: 'postgresql',
      connection: {
        host: prodConfig.database.host,
        port: prodConfig.database.port,
        user: prodConfig.database.user,
        password: prodConfig.database.password,
        database: prodConfig.database.database,
        ssl: prodConfig.database.ssl ? { rejectUnauthorized: false } : false
      }
    };
  }

  const db = knex(productionConfig);

  try {
    // 检查 admin 用户是否已存在
    const existingAdmin = await db('users').where('id', ADMIN_USER_ID).first();
    if (existingAdmin) {
      console.log('✅ Admin 用户已存在，无需创建');
      console.log(`  ID: ${existingAdmin.id}`);
      console.log(`  用户名: ${existingAdmin.username}`);
      return;
    }

    // 创建密码哈希
    const defaultPassword = 'admin123456';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    // 创建 admin 用户
    const adminUser = {
      id: ADMIN_USER_ID,
      username: 'admin',
      email: 'admin@funnypixels.com',
      password_hash: passwordHash,
      display_name: 'System Admin',
      bio: 'System administrator account',
      level: 100,
      experience: 999999,
      coins: 999999,
      gems: 999999,
      is_guest: false,
      role: 'admin',
      motto: 'System Administrator',
      privacy_mode: false,
      total_pixels: 0,
      current_pixels: 999999,
      created_at: new Date(),
      updated_at: new Date(),
      last_login: new Date(),
      is_online: false,
      is_banned: false
    };

    await db('users').insert(adminUser);

    console.log('✅ Admin 用户创建成功:');
    console.log(`  ID: ${adminUser.id}`);
    console.log(`  用户名: ${adminUser.username}`);
    console.log(`  邮箱: ${adminUser.email}`);
    console.log(`  默认密码: ${defaultPassword} (请及时修改)`);
    console.log(`  角色: ${adminUser.role}`);

    // 验证用户创建成功
    const createdUser = await db('users').where('id', ADMIN_USER_ID).first();
    if (createdUser) {
      console.log('🔍 验证: Admin 用户创建成功');
    } else {
      console.log('❌ 验证失败: Admin 用户未找到');
    }

  } catch (error) {
    console.error('❌ 创建 admin 用户失败:', error.message);

    // 如果是唯一约束错误，可能是用户名或邮箱重复
    if (error.message.includes('duplicate') || error.message.includes('unique')) {
      console.log('🔍 检查是否存在重复的用户名或邮箱...');

      try {
        const duplicateUsername = await db('users').where('username', 'admin').first();
        if (duplicateUsername) {
          console.log(`❌ 用户名 'admin' 已被使用，用户ID: ${duplicateUsername.id}`);
        }

        const duplicateEmail = await db('users').where('email', 'admin@funnypixels.com').first();
        if (duplicateEmail) {
          console.log(`❌ 邮箱 'admin@funnypixels.com' 已被使用，用户ID: ${duplicateEmail.id}`);
        }
      } catch (checkError) {
        console.error('检查重复用户时出错:', checkError.message);
      }
    }
  } finally {
    await db.destroy();
  }
}

// 执行创建
if (require.main === module) {
  createAdminUser();
}

module.exports = { createAdminUser };