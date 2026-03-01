#!/usr/bin/env node

/**
 * 数据库连接测试脚本
 *
 * 专门用于测试和诊断数据库连接问题
 */

const path = require('path');

console.log('🔍 数据库连接诊断测试');
console.log('='.repeat(50));

// 1. 测试本地Docker数据库连接
async function testLocalDockerDatabase() {
  console.log('\n1️⃣ 测试本地Docker数据库连接...');

  try {
    // 设置本地验证模式环境变量
    process.env.LOCAL_VALIDATION = 'true';
    process.env.NODE_ENV = 'development';

    // 加载数据库配置
    const { loadEnvConfig } = require(path.join(__dirname, '../../backend/src/config/env'));
    loadEnvConfig();

    const { db } = require(path.join(__dirname, '../../backend/src/config/database'));

    console.log('📡 尝试连接数据库...');
    const result = await db.raw('SELECT 1 as test, NOW() as current_time');

    console.log('✅ 数据库连接成功！');
    console.log('   测试结果:', result.rows[0]);

    // 检查表是否存在
    console.log('\n📋 检查数据库表结构...');
    const tables = await db.raw(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('   数据库表:', tables.rows.map(row => row.table_name));

    // 检查关键表
    const requiredTables = ['users', 'pixels', 'pixels_history', 'user_pixel_states'];
    const existingTables = tables.rows.map(row => row.table_name);
    const missingTables = requiredTables.filter(table => !existingTables.includes(table));

    if (missingTables.length > 0) {
      console.log('❌ 缺少关键表:', missingTables);
      console.log('💡 需要运行数据库迁移: npm run migrate');
      return false;
    } else {
      console.log('✅ 所有关键表都存在');
    }

    // 检查像素数据
    console.log('\n📊 检查像素数据...');
    const pixelCount = await db('pixels').count('* as count').first();
    console.log(`   pixels表记录数: ${pixelCount.count}`);

    const historyCount = await db('pixels_history').count('* as count').first();
    console.log(`   pixels_history表记录数: ${historyCount.count}`);

    // 检查最新的像素记录
    const latestPixel = await db('pixels')
      .orderBy('created_at', 'desc')
      .first();

    if (latestPixel) {
      console.log('   最新像素记录:', {
        id: latestPixel.id,
        grid_id: latestPixel.grid_id,
        user_id: latestPixel.user_id,
        color: latestPixel.color,
        created_at: latestPixel.created_at
      });
    } else {
      console.log('   暂无像素记录');
    }

    await db.destroy();
    return true;

  } catch (error) {
    console.log('❌ 数据库连接失败:', error.message);

    if (error.message.includes('ECONNREFUSED')) {
      console.log('💡 解决方案:');
      console.log('   1. 确保本地Docker数据库正在运行');
      console.log('   2. 运行: docker-compose up -d postgres');
      console.log('   3. 检查端口5432是否被占用');
    } else if (error.message.includes('password')) {
      console.log('💡 解决方案:');
      console.log('   1. 检查数据库密码配置');
      console.log('   2. 确保用户名和密码正确');
    } else if (error.message.includes('database')) {
      console.log('💡 解决方案:');
      console.log('   1. 确保数据库存在');
      console.log('   2. 运行: CREATE DATABASE funnypixels_postgres;');
    }

    return false;
  }
}

// 2. 测试远程数据库连接
async function testRemoteDatabase() {
  console.log('\n2️⃣ 测试远程数据库连接...');

  try {
    // 检查是否有远程数据库配置
    if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD) {
      console.log('❌ 缺少远程数据库配置');
      console.log('   需要设置环境变量:');
      console.log('   - DB_HOST');
      console.log('   - DB_USER');
      console.log('   - DB_PASSWORD');
      console.log('   - DB_NAME');
      return false;
    }

    console.log('📡 尝试连接远程数据库...');

    // 这里可以添加远程数据库连接测试
    console.log('ℹ️ 远程数据库连接需要配置环境变量');
    return false;

  } catch (error) {
    console.log('❌ 远程数据库连接失败:', error.message);
    return false;
  }
}

// 3. 提供解决方案
function provideSolution() {
  console.log('\n🔧 解决方案建议:');
  console.log('='.repeat(50));

  console.log('\n方案1: 使用本地Docker数据库（推荐用于开发）');
  console.log('1. 确保安装了Docker和Docker Compose');
  console.log('2. 运行: docker-compose up -d postgres');
  console.log('3. 设置环境变量: export LOCAL_VALIDATION=true');
  console.log('4. 重启后端服务');

  console.log('\n方案2: 配置远程数据库');
  console.log('1. 获取远程数据库连接信息');
  console.log('2. 创建.env文件并设置以下变量:');
  console.log('   DB_HOST=your_host');
  console.log('   DB_USER=your_username');
  console.log('   DB_PASSWORD=your_password');
  console.log('   DB_NAME=your_database');
  console.log('   JWT_SECRET=your_jwt_secret');
  console.log('3. 重启后端服务');

  console.log('\n方案3: 运行数据库迁移');
  console.log('如果表不存在，运行:');
  console.log('npm run migrate');
  console.log('或者:');
  console.log('cd backend && npx knex migrate:latest');
}

// 主测试函数
async function runDatabaseTest() {
  console.log('开始数据库连接诊断...\n');

  // 测试本地数据库
  const localSuccess = await testLocalDockerDatabase();

  // 测试远程数据库
  const remoteSuccess = await testRemoteDatabase();

  // 提供解决方案
  if (!localSuccess && !remoteSuccess) {
    provideSolution();
  } else {
    console.log('\n✅ 数据库连接正常！');
  }
}

// 执行测试
if (require.main === module) {
  runDatabaseTest()
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      console.error('数据库测试失败:', error);
      process.exit(1);
    });
}

module.exports = { runDatabaseTest };