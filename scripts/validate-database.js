#!/usr/bin/env node

/**
 * 数据库验证脚本
 * 用于在本地验证数据库迁移和表结构
 * 
 * 使用方法:
 * 1. 启动本地数据库: docker-compose up -d postgres redis
 * 2. 运行验证: node scripts/validate-database.js
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🔍 开始数据库验证流程...\n');

// 设置环境变量
process.env.LOCAL_VALIDATION = 'true';
process.env.NODE_ENV = 'development';

// 切换到backend目录
const backendDir = path.join(__dirname, '../backend');
process.chdir(backendDir);

console.log('📁 工作目录:', process.cwd());

async function validateDatabase() {
  try {
    // 1. 测试数据库连接
    console.log('📋 步骤 1: 测试数据库连接...');
    require('./src/config/database.js');
    
    // 等待连接测试完成
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 2. 运行数据库迁移
    console.log('\n📋 步骤 2: 运行数据库迁移...');
    try {
      execSync('npx knex migrate:latest', { stdio: 'inherit' });
      console.log('✅ 数据库迁移完成');
    } catch (error) {
      console.error('❌ 数据库迁移失败:', error.message);
      process.exit(1);
    }
    
    // 3. 运行数据库种子数据
    console.log('\n📋 步骤 3: 运行数据库种子数据...');
    try {
      execSync('npx knex seed:run', { stdio: 'inherit' });
      console.log('✅ 数据库种子数据完成');
    } catch (error) {
      console.error('❌ 数据库种子数据失败:', error.message);
      process.exit(1);
    }
    
    // 4. 验证表结构
    console.log('\n📋 步骤 4: 验证表结构...');
    const { db } = require('./src/config/database.js');
    
    const tables = await db.raw(`
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `);
    
    console.log('📊 数据库表结构:');
    const tableStructure = {};
    tables.rows.forEach(row => {
      if (!tableStructure[row.table_name]) {
        tableStructure[row.table_name] = [];
      }
      tableStructure[row.table_name].push({
        column: row.column_name,
        type: row.data_type,
        nullable: row.is_nullable
      });
    });
    
    Object.keys(tableStructure).forEach(tableName => {
      console.log(`\n📋 表: ${tableName}`);
      tableStructure[tableName].forEach(col => {
        console.log(`  - ${col.column}: ${col.type} ${col.nullable === 'YES' ? '(nullable)' : '(not null)'}`);
      });
    });
    
    // 5. 验证关键表
    console.log('\n📋 步骤 5: 验证关键表...');
    const requiredTables = ['users', 'patterns', 'pixels', 'sessions'];
    const existingTables = Object.keys(tableStructure);
    
    const missingTables = requiredTables.filter(table => !existingTables.includes(table));
    const extraTables = existingTables.filter(table => !requiredTables.includes(table));
    
    if (missingTables.length > 0) {
      console.log('⚠️  缺少关键表:', missingTables);
    } else {
      console.log('✅ 所有关键表都存在');
    }
    
    if (extraTables.length > 0) {
      console.log('📝 额外表:', extraTables);
    }
    
    // 6. 测试基本查询
    console.log('\n📋 步骤 6: 测试基本查询...');
    try {
      const userCount = await db('users').count('* as count');
      console.log(`✅ 用户表查询成功，记录数: ${userCount[0].count}`);
      
      const patternCount = await db('patterns').count('* as count');
      console.log(`✅ 模式表查询成功，记录数: ${patternCount[0].count}`);
      
      const pixelCount = await db('pixels').count('* as count');
      console.log(`✅ 像素表查询成功，记录数: ${pixelCount[0].count}`);
      
    } catch (error) {
      console.error('❌ 基本查询失败:', error.message);
    }
    
    console.log('\n🎉 数据库验证完成！');
    console.log('💡 如果所有步骤都成功，说明数据库迁移和表结构是正确的');
    console.log('💡 现在可以安全地部署到远程服务');
    
  } catch (error) {
    console.error('❌ 验证过程中发生错误:', error.message);
    process.exit(1);
  } finally {
    // 关闭数据库连接
    try {
      const { db } = require('./src/config/database.js');
      await db.destroy();
      console.log('\n🔌 数据库连接已关闭');
    } catch (error) {
      // 忽略关闭错误
    }
  }
}

// 运行验证
validateDatabase();
