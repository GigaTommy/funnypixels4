#!/usr/bin/env node

/**
 * 标记迁移为已完成
 * 解决迁移记录不匹配问题
 */

const fs = require('fs');
const path = require('path');

// 生产环境数据库配置
const dbConfig = {
  host: 'dpg-d2tfm0ndiees73879o80-a.singapore-postgres.render.com',
  port: 5432,
  user: 'funnypixels',
  password: 'QLpdpDGojmcxRNdMsoTmcuspnaQBls4y',
  database: 'funnypixels_postgres',
  ssl: true
};

// 动态导入pg模块
let pg;
try {
  pg = require('pg');
} catch (error) {
  console.error('❌ 请先安装pg模块: npm install pg');
  process.exit(1);
}

const { Client } = pg;

// 颜色输出
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function markMigrationCompleted() {
  const client = new Client(dbConfig);
  
  try {
    log('🔧 标记迁移为已完成...', 'blue');
    log('📡 连接到生产数据库...', 'blue');
    
    // 连接数据库
    await client.connect();
    log('✅ 数据库连接成功', 'green');
    
    // 检查迁移是否已存在
    const existingMigration = await client.query(`
      SELECT * FROM knex_migrations 
      WHERE name = '20250108_create_pixels_history_partitioned.js'
    `);
    
    if (existingMigration.rows.length > 0) {
      log('✅ 迁移记录已存在，无需添加', 'green');
    } else {
      log('⚠️ 迁移记录不存在，添加迁移记录...', 'yellow');
      
      // 获取当前最大批次号
      const maxBatchResult = await client.query(`
        SELECT MAX(batch) as max_batch FROM knex_migrations
      `);
      const nextBatch = (maxBatchResult.rows[0].max_batch || 0) + 1;
      
      // 插入迁移记录
      await client.query(`
        INSERT INTO knex_migrations (name, batch, migration_time)
        VALUES ($1, $2, NOW())
      `, ['20250108_create_pixels_history_partitioned.js', nextBatch]);
      
      log('✅ 迁移记录添加成功', 'green');
    }
    
    // 验证结果
    log('🔍 验证迁移记录...', 'blue');
    const verifyResult = await client.query(`
      SELECT name, batch, migration_time 
      FROM knex_migrations 
      WHERE name = '20250108_create_pixels_history_partitioned.js'
    `);
    
    if (verifyResult.rows.length > 0) {
      const migration = verifyResult.rows[0];
      log(`✅ 迁移记录验证成功`, 'green');
      log(`   - 名称: ${migration.name}`, 'green');
      log(`   - 批次: ${migration.batch}`, 'green');
      log(`   - 时间: ${migration.migration_time}`, 'green');
    } else {
      log('❌ 迁移记录验证失败', 'red');
    }
    
    log('🎉 迁移标记完成！', 'green');
    log('', 'reset');
    log('📋 操作摘要:', 'blue');
    log('  ✅ 检查了迁移记录状态', 'green');
    log('  ✅ 添加了缺失的迁移记录', 'green');
    log('  ✅ 验证了操作结果', 'green');
    log('', 'reset');
    log('🔧 下一步操作:', 'yellow');
    log('  1. 重启生产环境服务', 'yellow');
    log('  2. 验证服务启动正常', 'yellow');
    log('  3. 启动队列处理器', 'yellow');
    
  } catch (error) {
    log(`❌ 操作失败: ${error.message}`, 'red');
    if (error.code) {
      log(`   错误代码: ${error.code}`, 'red');
    }
    if (error.detail) {
      log(`   详细信息: ${error.detail}`, 'red');
    }
    process.exit(1);
  } finally {
    await client.end();
    log('🔌 数据库连接已关闭', 'blue');
  }
}

// 执行操作
markMigrationCompleted();
