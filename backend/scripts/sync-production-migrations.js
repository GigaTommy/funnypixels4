#!/usr/bin/env node

/**
 * 同步生产环境迁移记录
 * 将开发环境的迁移文件部署到生产环境
 */

const knex = require('knex');
const fs = require('fs');
const path = require('path');

// 生产环境数据库配置
const dbConfig = {
  client: 'postgresql',
  connection: {
    host: 'dpg-d2tfm0ndiees73879o80-a.singapore-postgres.render.com',
    port: 5432,
    user: 'funnypixels',
    password: 'QLpdpDGojmcxRNdMsoTmcuspnaQBls4y',
    database: 'funnypixels_postgres',
    ssl: {
      rejectUnauthorized: false
    }
  },
  pool: {
    min: 2,
    max: 10
  }
};

// 颜色输出
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function syncProductionMigrations() {
  let db;
  
  try {
    log('🚀 开始同步生产环境迁移记录...', 'blue');
    
    // 创建数据库连接
    log('\n1️⃣ 创建生产环境数据库连接...', 'cyan');
    db = knex(dbConfig);
    
    // 测试连接
    log('\n2️⃣ 测试数据库连接...', 'cyan');
    await db.raw('SELECT 1 as test');
    log('✅ 数据库连接成功', 'green');
    
    // 获取当前生产环境的迁移记录
    log('\n3️⃣ 获取当前生产环境迁移记录...', 'cyan');
    const currentMigrations = await db.raw(`
      SELECT name, batch, migration_time 
      FROM knex_migrations 
      ORDER BY migration_time ASC
    `);
    
    const currentMigrationNames = currentMigrations.rows.map(row => row.name);
    log(`📊 当前生产环境迁移数量: ${currentMigrationNames.length}`, 'blue');
    
    // 获取开发环境的迁移文件
    log('\n4️⃣ 获取开发环境迁移文件...', 'cyan');
    const migrationsDir = path.join(__dirname, '../src/database/migrations');
    const devMigrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.js'))
      .sort();
    
    log(`📊 开发环境迁移文件数量: ${devMigrationFiles.length}`, 'blue');
    
    // 找出需要同步的迁移文件
    const missingInProd = devMigrationFiles.filter(dev => !currentMigrationNames.includes(dev));
    
    if (missingInProd.length === 0) {
      log('\n✅ 生产环境迁移记录已是最新，无需同步', 'green');
      return;
    }
    
    log(`\n5️⃣ 发现 ${missingInProd.length} 个需要同步的迁移文件:`, 'cyan');
    missingInProd.forEach(migration => {
      log(`  📄 ${migration}`, 'yellow');
    });
    
    // 获取当前最大批次号
    const maxBatchResult = await db.raw(`
      SELECT MAX(batch) as max_batch FROM knex_migrations
    `);
    const nextBatch = (maxBatchResult.rows[0].max_batch || 0) + 1;
    
    log(`\n6️⃣ 开始同步迁移记录 (批次号: ${nextBatch})...`, 'cyan');
    
    // 批量插入迁移记录
    const migrationRecords = missingInProd.map((migration, index) => ({
      name: migration,
      batch: nextBatch + Math.floor(index / 10), // 每10个迁移一个批次
      migration_time: new Date()
    }));
    
    await db('knex_migrations').insert(migrationRecords);
    
    log(`✅ 成功同步 ${migrationRecords.length} 个迁移记录`, 'green');
    
    // 验证同步结果
    log('\n7️⃣ 验证同步结果...', 'cyan');
    const updatedMigrations = await db.raw(`
      SELECT name, batch, migration_time 
      FROM knex_migrations 
      ORDER BY migration_time ASC
    `);
    
    log(`📊 同步后生产环境迁移数量: ${updatedMigrations.rows.length}`, 'blue');
    
    // 显示新添加的迁移记录
    const newMigrations = updatedMigrations.rows.filter(row => 
      missingInProd.includes(row.name)
    );
    
    log('\n📋 新添加的迁移记录:', 'cyan');
    log('┌─────────────────────────────────────────────────────────────────┐', 'blue');
    log('│ 迁移文件名                                    │ 批次 │ 执行时间        │', 'blue');
    log('├─────────────────────────────────────────────────────────────────┤', 'blue');
    
    newMigrations.forEach(row => {
      const name = row.name.padEnd(50);
      const batch = row.batch.toString().padStart(4);
      const time = new Date(row.migration_time).toLocaleString('zh-CN');
      log(`│ ${name} │ ${batch} │ ${time} │`, 'blue');
    });
    
    log('└─────────────────────────────────────────────────────────────────┘', 'blue');
    
    // 总结
    log('\n📋 同步总结:', 'cyan');
    log(`✅ 同步前迁移数量: ${currentMigrationNames.length}`, 'green');
    log(`✅ 同步后迁移数量: ${updatedMigrations.rows.length}`, 'green');
    log(`✅ 新增迁移数量: ${newMigrations.length}`, 'green');
    
    log('\n🎉 生产环境迁移记录同步完成！', 'green');
    log('\n🔧 下一步操作:', 'yellow');
    log('1. 重新部署生产环境应用', 'yellow');
    log('2. 验证应用启动正常', 'yellow');
    log('3. 检查数据库表结构是否正确', 'yellow');
    
  } catch (error) {
    log(`\n❌ 同步失败: ${error.message}`, 'red');
    if (error.code) {
      log(`错误代码: ${error.code}`, 'red');
    }
    if (error.detail) {
      log(`详细信息: ${error.detail}`, 'red');
    }
  } finally {
    if (db) {
      await db.destroy();
      log('\n🔌 数据库连接已关闭', 'blue');
    }
  }
}

// 执行同步
syncProductionMigrations();
