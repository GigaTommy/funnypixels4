#!/usr/bin/env node

/**
 * 连接生产环境数据库并运行迁移的脚本
 * 用于修正表结构问题
 */

const knex = require('knex');
const knexfile = require('../knexfile');

async function connectProductionDB() {
  try {
    console.log('🔍 开始连接生产环境数据库...');
    
    // 检查环境变量
    console.log('\n1️⃣ 检查环境变量...');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('DB_HOST:', process.env.DB_HOST ? '已设置' : '未设置');
    console.log('DB_USER:', process.env.DB_USER ? '已设置' : '未设置');
    console.log('DB_NAME:', process.env.DB_NAME ? '已设置' : '未设置');
    console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '已设置' : '未设置');
    
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
    console.log('数据库配置:', {
      client: dbConfig.client,
      host: dbConfig.connection.host,
      database: dbConfig.connection.database,
      user: dbConfig.connection.user,
      ssl: dbConfig.connection.ssl ? '已配置' : '未配置'
    });
    
    const db = knex(dbConfig);
    
    // 测试连接
    console.log('\n3️⃣ 测试数据库连接...');
    const result = await db.raw('SELECT 1 as test');
    console.log('✅ 数据库连接成功:', result.rows[0]);
    
    // 检查当前迁移状态
    console.log('\n4️⃣ 检查当前迁移状态...');
    const migrations = await db.migrate.list();
    console.log('已完成的迁移:', migrations[0]);
    console.log('待执行的迁移:', migrations[1]);
    
    // 检查外键约束问题
    console.log('\n5️⃣ 检查外键约束问题...');
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
      
    } catch (error) {
      console.error('❌ 检查外键约束失败:', error.message);
    }
    
    // 检查表结构
    console.log('\n6️⃣ 检查表结构...');
    try {
      const tables = await db.raw(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name IN ('store_items', 'shop_skus', 'user_inventory')
        ORDER BY table_name
      `);
      
      console.log('相关表存在情况:');
      tables.rows.forEach(table => {
        console.log(`  ✅ ${table.table_name}`);
      });
      
    } catch (error) {
      console.error('❌ 检查表结构失败:', error.message);
    }
    
    // 检查商品数据
    console.log('\n7️⃣ 检查商品数据...');
    try {
      const storeItems = await db('store_items').count('* as count');
      const shopSkus = await db('shop_skus').count('* as count');
      console.log(`store_items表商品数量: ${storeItems[0].count}`);
      console.log(`shop_skus表商品数量: ${shopSkus[0].count}`);
      
    } catch (error) {
      console.error('❌ 检查商品数据失败:', error.message);
    }
    
    // 关闭连接
    await db.destroy();
    console.log('\n✅ 数据库连接测试完成');
    
  } catch (error) {
    console.error('\n❌ 连接生产环境数据库失败:');
    console.error('错误类型:', error.constructor.name);
    console.error('错误消息:', error.message);
    console.error('错误代码:', error.code);
    console.error('错误详情:', error);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n🔍 连接被拒绝分析:');
      console.error('❌ 问题：数据库服务器拒绝连接');
      console.error('💡 可能原因：');
      console.error('   1. 数据库服务器未启动');
      console.error('   2. 网络连接问题');
      console.error('   3. 防火墙阻止连接');
      console.error('   4. 数据库配置错误');
    } else if (error.code === 'ENOTFOUND') {
      console.error('\n🔍 主机名解析失败分析:');
      console.error('❌ 问题：无法解析数据库主机名');
      console.error('💡 可能原因：');
      console.error('   1. 数据库主机名配置错误');
      console.error('   2. DNS解析问题');
      console.error('   3. 网络连接问题');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n🔍 访问被拒绝分析:');
      console.error('❌ 问题：数据库访问被拒绝');
      console.error('💡 可能原因：');
      console.error('   1. 用户名或密码错误');
      console.error('   2. 用户权限不足');
      console.error('   3. 数据库不存在');
    }
  }
}

connectProductionDB();
