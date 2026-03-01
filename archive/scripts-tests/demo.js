#!/usr/bin/env node
'use strict';

/**
 * GPS绘制模拟演示脚本
 * 展示如何使用模拟脚本进行测试
 */

const { runSimulation, CONFIG, TEST_PATHS } = require('../scripts/simulate-gps-draw');
const { quickTest } = require('./quick-gps-test');

async function runDemo() {
  console.log('🎬 GPS绘制模拟演示');
  console.log('='.repeat(50));
  
  console.log('\n📋 演示内容:');
  console.log('1. 快速单点测试');
  console.log('2. 完整轨迹模拟');
  console.log('3. 配置说明');
  console.log('4. 结果分析');
  
  console.log('\n🔧 当前配置:');
  console.log(`   API地址: ${CONFIG.BACKEND_API}`);
  console.log(`   WebSocket: ${CONFIG.SOCKET_URL}`);
  console.log(`   网格大小: ${CONFIG.GRID_SIZE}°`);
  console.log(`   发送间隔: ${CONFIG.INTERVAL_MS}ms`);
  console.log(`   移动速度: ${CONFIG.SPEED_MPS}m/s`);
  
  console.log('\n🗺️ 可用测试路径:');
  Object.keys(TEST_PATHS).forEach((name, index) => {
    const path = TEST_PATHS[name];
    console.log(`   ${index + 1}. ${name}: ${path.length}个点`);
  });
  
  console.log('\n💡 使用提示:');
  console.log('   - 请先设置有效的JWT token');
  console.log('   - 确保后端服务正在运行');
  console.log('   - 可以修改配置参数进行不同场景测试');
  
  console.log('\n🚀 开始演示...');
  
  try {
    // 演示快速测试
    console.log('\n1️⃣ 快速测试演示:');
    console.log('-'.repeat(30));
    await quickTest();
    
    // 等待一下
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 演示完整模拟
    console.log('\n2️⃣ 完整模拟演示:');
    console.log('-'.repeat(30));
    const result = await runSimulation();
    
    // 分析结果
    console.log('\n3️⃣ 结果分析:');
    console.log('-'.repeat(30));
    if (result.success) {
      console.log('✅ 测试成功！GPS绘制功能正常');
      console.log(`📊 成功率: ${((result.metrics.success / result.metrics.sent) * 100).toFixed(1)}%`);
      console.log(`⏱️ 平均延迟: ${result.metrics.success ? (result.metrics.totalLatency / result.metrics.success).toFixed(1) : '-'}ms`);
    } else {
      console.log('❌ 测试失败！请检查配置和网络连接');
      if (result.hasErrors) {
        console.log('🔍 错误详情请查看上方日志');
      }
    }
    
  } catch (error) {
    console.error('\n❌ 演示过程中出现错误:', error.message);
    console.log('\n🔧 排查建议:');
    console.log('1. 检查JWT token是否有效');
    console.log('2. 确认后端服务是否运行');
    console.log('3. 验证网络连接是否正常');
    console.log('4. 查看详细错误日志');
  }
  
  console.log('\n🎉 演示完成！');
  console.log('\n📚 更多信息请查看:');
  console.log('   - README.md: 完整使用说明');
  console.log('   - GPS_SIMULATION_GUIDE.md: 详细指南');
  console.log('   - 运行 run-gps-test.bat (Windows) 或 run-gps-test.sh (Linux/Mac)');
}

// 运行演示
if (require.main === module) {
  runDemo().catch(console.error);
}

module.exports = { runDemo };
