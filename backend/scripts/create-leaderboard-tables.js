#!/usr/bin/env node

/**
 * 在生产环境手动创建排行榜表
 * 解决排行榜API 500错误问题
 */

const knex = require('knex');

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

async function createLeaderboardTables() {
  let db;
  
  try {
    log('🚀 开始在生产环境创建排行榜表...', 'blue');
    
    // 创建数据库连接
    log('\n1️⃣ 创建生产环境数据库连接...', 'cyan');
    db = knex(dbConfig);
    
    // 测试连接
    log('\n2️⃣ 测试数据库连接...', 'cyan');
    await db.raw('SELECT 1 as test');
    log('✅ 数据库连接成功', 'green');
    
    // 检查表是否已存在
    log('\n3️⃣ 检查排行榜表是否已存在...', 'cyan');
    const existingTables = await db.raw(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('leaderboard_personal', 'leaderboard_alliance', 'leaderboard_region', 'leaderboard_likes', 'leaderboard_stats')
      ORDER BY table_name
    `);
    
    log(`📊 发现 ${existingTables.rows.length} 个已存在的排行榜表:`, 'blue');
    existingTables.rows.forEach(table => {
      log(`  ✅ ${table.table_name}`, 'green');
    });
    
    // 创建个人排行榜缓存表
    log('\n4️⃣ 创建个人排行榜缓存表...', 'cyan');
    if (!existingTables.rows.some(t => t.table_name === 'leaderboard_personal')) {
      await db.schema.createTable('leaderboard_personal', function(table) {
        table.bigIncrements('id').primary();
        table.uuid('user_id').notNullable();
        table.string('username', 50).notNullable();
        table.string('display_name', 100);
        table.string('avatar_url', 500);
        table.text('avatar'); // 用户头像数据（像素艺术颜色数据）
        table.bigInteger('pixel_count').notNullable().defaultTo(0);
        table.integer('rank').notNullable();
        table.string('period', 20).notNullable(); // daily, weekly, monthly, yearly
        table.timestamp('period_start').notNullable();
        table.timestamp('period_end').notNullable();
        table.timestamp('last_updated').notNullable().defaultTo(db.fn.now());
        table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
        
        // 索引
        table.index(['period', 'rank']);
        table.index(['user_id', 'period']);
        table.index(['period_start', 'period_end']);
        table.index('last_updated');
        
        // 唯一约束
        table.unique(['user_id', 'period', 'period_start']);
      });
      log('✅ leaderboard_personal 表创建成功', 'green');
    } else {
      log('✅ leaderboard_personal 表已存在', 'green');
    }
    
    // 创建联盟排行榜缓存表
    log('\n5️⃣ 创建联盟排行榜缓存表...', 'cyan');
    if (!existingTables.rows.some(t => t.table_name === 'leaderboard_alliance')) {
      await db.schema.createTable('leaderboard_alliance', function(table) {
        table.bigIncrements('id').primary();
        table.integer('alliance_id').notNullable();
        table.string('alliance_name', 100).notNullable();
        table.string('alliance_flag', 50);
        table.string('pattern_id', 100);
        table.string('color', 20);
        table.integer('member_count').notNullable().defaultTo(0);
        table.bigInteger('total_pixels').notNullable().defaultTo(0);
        table.integer('rank').notNullable();
        table.string('period', 20).notNullable(); // daily, weekly, monthly, yearly
        table.timestamp('period_start').notNullable();
        table.timestamp('period_end').notNullable();
        table.timestamp('last_updated').notNullable().defaultTo(db.fn.now());
        table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
        
        // 索引
        table.index(['period', 'rank']);
        table.index(['alliance_id', 'period']);
        table.index(['period_start', 'period_end']);
        table.index('last_updated');
        
        // 唯一约束
        table.unique(['alliance_id', 'period', 'period_start']);
      });
      log('✅ leaderboard_alliance 表创建成功', 'green');
    } else {
      log('✅ leaderboard_alliance 表已存在', 'green');
    }
    
    // 创建地区排行榜缓存表
    log('\n6️⃣ 创建地区排行榜缓存表...', 'cyan');
    if (!existingTables.rows.some(t => t.table_name === 'leaderboard_region')) {
      await db.schema.createTable('leaderboard_region', function(table) {
        table.bigIncrements('id').primary();
        table.integer('region_id').notNullable();
        table.string('region_name', 100).notNullable();
        table.string('region_flag', 50);
        table.string('color', 20);
        table.integer('user_count').notNullable().defaultTo(0);
        table.integer('alliance_count').notNullable().defaultTo(0);
        table.bigInteger('total_pixels').notNullable().defaultTo(0);
        table.integer('rank').notNullable();
        table.string('period', 20).notNullable(); // daily, weekly, monthly, yearly
        table.timestamp('period_start').notNullable();
        table.timestamp('period_end').notNullable();
        table.timestamp('last_updated').notNullable().defaultTo(db.fn.now());
        table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
        
        // 索引
        table.index(['period', 'rank']);
        table.index(['region_id', 'period']);
        table.index(['period_start', 'period_end']);
        table.index('last_updated');
        
        // 唯一约束
        table.unique(['region_id', 'period', 'period_start']);
      });
      log('✅ leaderboard_region 表创建成功', 'green');
    } else {
      log('✅ leaderboard_region 表已存在', 'green');
    }
    
    // 创建排行榜点赞表
    log('\n7️⃣ 创建排行榜点赞表...', 'cyan');
    if (!existingTables.rows.some(t => t.table_name === 'leaderboard_likes')) {
      await db.schema.createTable('leaderboard_likes', function(table) {
        table.bigIncrements('id').primary();
        table.uuid('user_id').notNullable();
        table.string('item_type', 20).notNullable(); // personal, alliance, region
        table.uuid('item_id').notNullable();
        table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
        
        // 索引
        table.index(['user_id', 'item_type', 'item_id']);
        table.index(['item_type', 'item_id']);
        table.index('created_at');
        
        // 唯一约束
        table.unique(['user_id', 'item_type', 'item_id']);
      });
      log('✅ leaderboard_likes 表创建成功', 'green');
    } else {
      log('✅ leaderboard_likes 表已存在', 'green');
    }
    
    // 创建排行榜统计表
    log('\n8️⃣ 创建排行榜统计表...', 'cyan');
    if (!existingTables.rows.some(t => t.table_name === 'leaderboard_stats')) {
      await db.schema.createTable('leaderboard_stats', function(table) {
        table.bigIncrements('id').primary();
        table.string('leaderboard_type', 20).notNullable(); // personal, alliance, region
        table.string('period', 20).notNullable(); // daily, weekly, monthly, yearly
        table.timestamp('period_start').notNullable();
        table.timestamp('period_end').notNullable();
        table.integer('total_entries').notNullable().defaultTo(0);
        table.bigInteger('total_pixels').notNullable().defaultTo(0);
        table.timestamp('last_calculated').notNullable().defaultTo(db.fn.now());
        table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
        
        // 索引
        table.index(['leaderboard_type', 'period']);
        table.index(['period_start', 'period_end']);
        table.index('last_calculated');
        
        // 唯一约束
        table.unique(['leaderboard_type', 'period', 'period_start']);
      });
      log('✅ leaderboard_stats 表创建成功', 'green');
    } else {
      log('✅ leaderboard_stats 表已存在', 'green');
    }
    
    // 验证表创建结果
    log('\n9️⃣ 验证表创建结果...', 'cyan');
    const finalTables = await db.raw(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('leaderboard_personal', 'leaderboard_alliance', 'leaderboard_region', 'leaderboard_likes', 'leaderboard_stats')
      ORDER BY table_name
    `);
    
    log(`📊 最终排行榜表数量: ${finalTables.rows.length}`, 'blue');
    finalTables.rows.forEach(table => {
      log(`  ✅ ${table.table_name}`, 'green');
    });
    
    // 总结
    log('\n📋 创建总结:', 'cyan');
    log(`✅ 排行榜表总数: ${finalTables.rows.length}`, 'green');
    
    if (finalTables.rows.length === 5) {
      log('\n🎉 所有排行榜表创建成功！', 'green');
      log('✅ 排行榜API应该能够正常工作了', 'green');
    } else {
      log('\n⚠️ 部分排行榜表创建失败', 'yellow');
    }
    
    log('\n🔧 下一步操作:', 'yellow');
    log('1. 重启生产环境应用', 'yellow');
    log('2. 测试排行榜API接口', 'yellow');
    log('3. 初始化排行榜数据', 'yellow');
    
  } catch (error) {
    log(`\n❌ 创建失败: ${error.message}`, 'red');
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

// 执行创建
createLeaderboardTables();
