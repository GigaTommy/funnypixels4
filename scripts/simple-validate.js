#!/usr/bin/env node

const knex = require('knex');

console.log('🔍 简单数据库验证...\n');

// 设置环境变量
process.env.LOCAL_VALIDATION = 'true';
process.env.NODE_ENV = 'development';

// 直接配置数据库连接
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

async function simpleValidate() {
  try {
    // 1. 测试连接
    console.log('📋 步骤 1: 测试数据库连接...');
    const result = await db.raw('SELECT 1 as test');
    console.log('✅ 数据库连接成功:', result.rows[0]);
    
    // 2. 检查现有表
    console.log('\n📋 步骤 2: 检查现有表...');
    const tables = await db.raw(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('📋 当前表:', tables.rows.map(row => row.table_name));
    
    // 3. 运行迁移
    console.log('\n📋 步骤 3: 运行数据库迁移...');
    const { execSync } = require('child_process');
    
    // 切换到backend目录
    const path = require('path');
    const backendDir = path.join(__dirname, '../backend');
    process.chdir(backendDir);
    
    // 设置环境变量并运行迁移
    process.env.LOCAL_VALIDATION = 'true';
    process.env.NODE_ENV = 'development';
    
    try {
      execSync('npx knex migrate:latest', { 
        stdio: 'inherit',
        env: {
          ...process.env,
          LOCAL_VALIDATION: 'true',
          NODE_ENV: 'development'
        }
      });
      console.log('✅ 数据库迁移完成');
    } catch (error) {
      console.error('❌ 数据库迁移失败:', error.message);
      return;
    }
    
    // 4. 再次检查表
    console.log('\n📋 步骤 4: 检查迁移后的表...');
    const tablesAfter = await db.raw(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('📋 迁移后表:', tablesAfter.rows.map(row => row.table_name));
    
    // 5. 运行种子数据
    console.log('\n📋 步骤 5: 运行种子数据...');
    try {
      execSync('npx knex seed:run', { 
        stdio: 'inherit',
        env: {
          ...process.env,
          LOCAL_VALIDATION: 'true',
          NODE_ENV: 'development'
        }
      });
      console.log('✅ 种子数据完成');
    } catch (error) {
      console.error('❌ 种子数据失败:', error.message);
    }
    
    console.log('\n🎉 验证完成！');
    
  } catch (error) {
    console.error('❌ 验证失败:', error.message);
  } finally {
    await db.destroy();
    console.log('🔌 数据库连接已关闭');
  }
}

simpleValidate();
