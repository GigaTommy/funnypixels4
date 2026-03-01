#!/usr/bin/env node

/**
 * 运行生产环境数据库迁移的脚本
 * 用于修正表结构问题
 */

const knex = require('knex');
const knexfile = require('../knexfile');

async function runProductionMigration() {
  try {
    console.log('🔍 开始运行生产环境数据库迁移...');
    
    // 检查环境变量
    console.log('\n1️⃣ 检查环境变量...');
    if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_NAME || !process.env.DB_PASSWORD) {
      console.error('❌ 错误: 缺少必要的数据库环境变量');
      console.error('请设置以下环境变量:');
      console.error('- DB_HOST');
      console.error('- DB_USER');
      console.error('- DB_NAME');
      console.error('- DB_PASSWORD');
      return;
    }
    
    // 创建数据库连接
    console.log('\n2️⃣ 创建生产环境数据库连接...');
    const dbConfig = knexfile.production;
    const db = knex(dbConfig);
    
    // 测试连接
    console.log('\n3️⃣ 测试数据库连接...');
    await db.raw('SELECT 1 as test');
    console.log('✅ 数据库连接成功');
    
    // 检查当前迁移状态
    console.log('\n4️⃣ 检查当前迁移状态...');
    const migrations = await db.migrate.list();
    console.log('已完成的迁移:', migrations[0].length);
    console.log('待执行的迁移:', migrations[1].length);
    
    if (migrations[1].length > 0) {
      console.log('待执行的迁移列表:');
      migrations[1].forEach(migration => {
        console.log(`  - ${migration}`);
      });
    }
    
    // 运行迁移
    console.log('\n5️⃣ 运行数据库迁移...');
    const migrationResult = await db.migrate.latest();
    console.log('✅ 迁移完成:', migrationResult);
    
    // 验证迁移结果
    console.log('\n6️⃣ 验证迁移结果...');
    const newMigrations = await db.migrate.list();
    console.log('迁移后状态:');
    console.log('已完成的迁移:', newMigrations[0].length);
    console.log('待执行的迁移:', newMigrations[1].length);
    
    // 检查外键约束是否已修复
    console.log('\n7️⃣ 检查外键约束修复结果...');
    try {
      const foreignKeys = await db.raw(`
        SELECT 
          tc.table_name, 
          kcu.column_name, 
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name 
        FROM 
          information_schema.table_constraints AS tc 
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND tc.table_name = 'user_inventory'
      `);
      
      console.log('user_inventory表的外键约束:');
      foreignKeys.rows.forEach(fk => {
        console.log(`  ${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
      });
      
      // 检查是否已修复
      const isFixed = foreignKeys.rows.some(fk => fk.foreign_table_name === 'store_items');
      if (isFixed) {
        console.log('✅ 外键约束已修复，现在引用store_items表');
      } else {
        console.log('⚠️ 外键约束可能未完全修复');
      }
      
    } catch (error) {
      console.error('❌ 检查外键约束失败:', error.message);
    }
    
    // 关闭连接
    await db.destroy();
    console.log('\n✅ 生产环境数据库迁移完成');
    
  } catch (error) {
    console.error('\n❌ 运行生产环境数据库迁移失败:');
    console.error('错误类型:', error.constructor.name);
    console.error('错误消息:', error.message);
    console.error('错误代码:', error.code);
    console.error('错误详情:', error);
    
    if (error.message.includes('foreign key constraint')) {
      console.error('\n🔍 外键约束错误分析:');
      console.error('❌ 问题：外键约束冲突');
      console.error('💡 可能原因：');
      console.error('   1. 表中存在不符合外键约束的数据');
      console.error('   2. 引用的表不存在');
      console.error('   3. 外键约束配置错误');
      console.error('💡 解决方案：');
      console.error('   1. 清理不符合约束的数据');
      console.error('   2. 检查表结构是否正确');
      console.error('   3. 重新配置外键约束');
    }
  }
}

runProductionMigration();
