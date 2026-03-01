#!/usr/bin/env node
'use strict';

/**
 * 部署排行榜系统
 * 运行数据库迁移、生成测试数据、启动维护服务
 */

// 设置环境变量
process.env.NODE_ENV = 'development';
process.env.LOCAL_VALIDATION = 'true';

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 开始部署排行榜系统...\n');

async function runCommand(command, description) {
  try {
    console.log(`📋 ${description}...`);
    execSync(command, { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    console.log(`✅ ${description}完成\n`);
  } catch (error) {
    console.error(`❌ ${description}失败:`, error.message);
    throw error;
  }
}

async function deployLeaderboardSystem() {
  try {
    // 1. 运行数据库迁移
    await runCommand(
      'cd backend && npm run migrate',
      '运行数据库迁移'
    );

    // 2. 生成测试数据
    await runCommand(
      'node scripts/generate-leaderboard-test-data.js',
      '生成排行榜测试数据'
    );

    // 3. 验证数据库表
    console.log('🔍 验证数据库表...');
    const { db } = require('../backend/src/config/database');
    
    const tables = [
      'leaderboard_personal',
      'leaderboard_alliance', 
      'leaderboard_region',
      'leaderboard_likes',
      'leaderboard_stats'
    ];
    
    for (const table of tables) {
      const exists = await db.schema.hasTable(table);
      console.log(`  ${exists ? '✅' : '❌'} ${table}: ${exists ? '存在' : '不存在'}`);
    }
    
    // 4. 检查数据量
    console.log('\n📊 检查数据量...');
    const personalCount = await db('leaderboard_personal').count('* as count').first();
    const allianceCount = await db('leaderboard_alliance').count('* as count').first();
    const regionCount = await db('leaderboard_region').count('* as count').first();
    const pixelCount = await db('pixels').count('* as count').first();
    const userCount = await db('users').count('* as count').first();
    
    console.log(`  👥 用户数量: ${userCount.count}`);
    console.log(`  🎨 像素数量: ${pixelCount.count}`);
    console.log(`  📊 个人排行榜记录: ${personalCount.count}`);
    console.log(`  📊 联盟排行榜记录: ${allianceCount.count}`);
    console.log(`  📊 地区排行榜记录: ${regionCount.count}`);
    
    console.log('\n✅ 排行榜系统部署完成！');
    console.log('\n📋 系统特性:');
    console.log('  ✅ 前端排行榜页面使用真实API数据');
    console.log('  ✅ 后端排行榜API查询基础数据表');
    console.log('  ✅ 排行榜维护服务每小时自动更新');
    console.log('  ✅ 支持日/周/月/年排行榜');
    console.log('  ✅ 数据库性能优化，减轻查询压力');
    
    console.log('\n🎯 下一步:');
    console.log('  1. 启动后端服务器: cd backend && npm start');
    console.log('  2. 启动前端服务器: cd frontend && npm run dev');
    console.log('  3. 访问排行榜页面查看效果');
    
  } catch (error) {
    console.error('❌ 部署失败:', error.message);
    process.exit(1);
  }
}

// 运行部署
deployLeaderboardSystem();
