#!/usr/bin/env node

/**
 * 自定义联盟旗帜功能数据库迁移脚本
 * 运行此脚本以创建必要的数据库表
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 开始运行自定义联盟旗帜功能数据库迁移...');

try {
  // 运行数据库迁移
  console.log('📊 执行数据库迁移...');
  execSync('npx knex migrate:latest', {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit'
  });

  // 运行种子数据
  console.log('🌱 执行种子数据...');
  execSync('npx knex seed:run', {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit'
  });

  console.log('✅ 自定义联盟旗帜功能数据库迁移完成！');
  console.log('');
  console.log('📋 已创建的表:');
  console.log('  - custom_flag_orders (自定义旗帜订单表)');
  console.log('  - user_custom_patterns (用户自定义图案权限表)');
  console.log('');
  console.log('🛍️ 已添加的商店SKU:');
  console.log('  - 自定义联盟旗帜 (2000积分)');
  console.log('');
  console.log('🎯 下一步:');
  console.log('  1. 重启后端服务');
  console.log('  2. 测试自定义旗帜购买流程');
  console.log('  3. 测试管理员审核功能');

} catch (error) {
  console.error('❌ 迁移失败:', error.message);
  process.exit(1);
}
