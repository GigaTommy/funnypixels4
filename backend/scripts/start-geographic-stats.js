#!/usr/bin/env node

/**
 * 启动地理统计维护服务
 * 用于启动地理归属和排行榜数据的定时更新
 */

const GeographicStatsMaintenanceService = require('../src/services/geographicStatsMaintenanceService');
const logger = require('../src/utils/logger');

console.log('🚀 启动地理统计维护服务...');

// 创建维护服务实例
const maintenanceService = new GeographicStatsMaintenanceService();

// 启动服务
maintenanceService.start();

// 优雅关闭处理
process.on('SIGINT', () => {
  console.log('\n🛑 收到关闭信号，正在停止地理统计维护服务...');
  maintenanceService.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 收到终止信号，正在停止地理统计维护服务...');
  maintenanceService.stop();
  process.exit(0);
});

// 错误处理
process.on('uncaughtException', (error) => {
  console.error('❌ 未捕获的异常:', error);
  maintenanceService.stop();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未处理的Promise拒绝:', reason);
  maintenanceService.stop();
  process.exit(1);
});

console.log('✅ 地理统计维护服务已启动');
console.log('📊 服务将每5分钟更新地理排行榜数据');
console.log('🗺️ 服务将每小时处理未分类的像素');
console.log('🧹 服务将每天清理过期数据');
console.log('📥 服务将每周更新行政区划数据');
console.log('\n按 Ctrl+C 停止服务');
