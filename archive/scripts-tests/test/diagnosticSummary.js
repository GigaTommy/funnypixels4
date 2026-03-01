#!/usr/bin/env node

/**
 * 像素绘制问题诊断总结工具
 *
 * 基于前面的诊断结果，提供问题分析和解决方案
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  BACKEND_URL: 'http://localhost:3001'
};

async function runDiagnosticSummary() {
  console.log('🔍 像素绘制问题诊断总结');
  console.log('='.repeat(50));

  const issues = [];
  const solutions = [];

  console.log('\n📊 基于前面诊断结果的分析:');
  console.log('=====================================');

  // 1. 检查后端服务状态
  console.log('\n1️⃣ 后端服务状态检查...');
  try {
    const response = await axios.get(`${CONFIG.BACKEND_URL}/api/health`, { timeout: 5000 });
    console.log('✅ 后端服务运行正常');
    console.log(`   - 运行时间: ${Math.round(response.data.uptime)}秒`);
    console.log(`   - 内存使用: ${Math.round(response.data.memory.heapUsed / 1024 / 1024)}MB`);
  } catch (error) {
    console.log('❌ 后端服务不可用');
    issues.push('后端服务未运行');
    solutions.push('启动后端服务: npm start 或 node backend/src/server.js');
  }

  // 2. 检查数据库连接问题
  console.log('\n2️⃣ 数据库连接问题诊断...');
  try {
    const response = await axios.get(`${CONFIG.BACKEND_URL}/api/pixels/stats`, { timeout: 5000 });
    console.log('✅ 数据库连接正常');
  } catch (error) {
    if (error.response?.status === 500) {
      console.log('❌ 数据库连接或查询失败');
      issues.push('数据库连接问题');
      solutions.push('检查数据库配置和连接');
      solutions.push('确保数据库服务正在运行');
      solutions.push('检查环境变量配置');
    }
  }

  // 3. 检查像素绘制API
  console.log('\n3️⃣ 像素绘制API检查...');
  try {
    const response = await axios.post(`${CONFIG.BACKEND_URL}/api/pixel-draw/manual`,
      { lat: 39.9042, lng: 116.4074, color: '#FF0000' },
      { timeout: 5000 }
    );
    console.log('✅ 像素绘制API响应正常');
  } catch (error) {
    if (error.response?.status === 403) {
      console.log('⚠️  像素绘制API需要认证（这是正常的）');
    } else if (error.response?.status === 401) {
      console.log('⚠️  像素绘制API认证失败');
      issues.push('用户认证问题');
      solutions.push('检查JWT配置');
      solutions.push('确保用户已登录且有足够权限');
    } else {
      console.log('❌ 像素绘制API异常');
      issues.push('像素绘制API异常');
      solutions.push('检查后端日志');
      solutions.push('验证像素绘制服务配置');
    }
  }

  // 4. 综合问题分析
  console.log('\n🎯 问题定位分析:');
  console.log('==================');

  if (issues.length === 0) {
    console.log('✅ 未发现明显问题，可能是以下原因:');
    console.log('   1. 像素数据已成功写入，但前端显示有延迟');
    console.log('   2. 批处理机制导致数据延迟写入');
    console.log('   3. 前端缓存问题');
    console.log('   4. 实时更新机制故障');

    solutions.push('等待几秒钟后刷新页面');
    solutions.push('清除浏览器缓存');
    solutions.push('检查WebSocket连接');
    solutions.push('查看前端控制台错误');
  } else {
    console.log('❌ 发现以下问题:');
    issues.forEach((issue, index) => {
      console.log(`   ${index + 1}. ${issue}`);
    });
  }

  // 5. 解决方案建议
  console.log('\n🔧 解决方案建议:');
  console.log('=================');

  if (solutions.length > 0) {
    solutions.forEach((solution, index) => {
      console.log(`   ${index + 1}. ${solution}`);
    });
  }

  // 6. 具体排查步骤
  console.log('\n📋 具体排查步骤:');
  console.log('=================');

  console.log('步骤1: 检查基础服务');
  console.log('   - 后端服务: curl http://localhost:3001/api/health');
  console.log('   - 数据库: 连接数据库检查连接状态');
  console.log('   - Redis: 如果使用批处理，检查Redis状态');

  console.log('\n步骤2: 检查用户认证');
  console.log('   - 确保用户已登录');
  console.log('   - 检查用户像素点数');
  console.log('   - 验证用户权限');

  console.log('\n步骤3: 测试像素绘制');
  console.log('   - 在浏览器中手动绘制像素');
  console.log('   - 检查浏览器开发者工具的网络请求');
  console.log('   - 查看API响应状态');

  console.log('\n步骤4: 验证数据写入');
  console.log('   - 直接查询数据库pixels表');
  console.log('   - 检查pixels_history表');
  console.log('   - 查看最新的像素记录');

  console.log('\n步骤5: 检查实时更新');
  console.log('   - 验证WebSocket连接');
  console.log('   - 检查前端控制台错误');
  console.log('   - 查看网络面板的WebSocket消息');

  // 7. 紧急修复建议
  console.log('\n🚨 紧急修复建议:');
  console.log('=================');

  console.log('如果问题紧急，可以尝试以下快速修复:');
  console.log('1. 重启后端服务');
  console.log('2. 清空Redis缓存（如果使用）');
  console.log('3. 检查数据库表是否有锁定');
  console.log('4. 手动触发批处理刷新');

  // 8. 环境检查命令
  console.log('\n🔬 环境检查命令:');
  console.log('==================');

  console.log('# 检查端口占用');
  console.log('netstat -an | grep 3001');
  console.log('# Windows: netstat -an | findstr 3001');

  console.log('\n# 检查数据库连接');
  console.log('# PostgreSQL: psql -h localhost -U username -d database');
  console.log('# 然后执行: SELECT COUNT(*) FROM pixels;');

  console.log('\n# 检查Redis连接');
  console.log('redis-cli ping');

  console.log('\n# 查看后端日志');
  console.log('tail -f logs/app.log');
  console.log('# 或查看控制台输出');

  // 9. 生成报告
  const report = {
    timestamp: new Date().toISOString(),
    issues,
    solutions,
    summary: {
      problemCount: issues.length,
      hasCriticalIssues: issues.some(i => i.includes('数据库') || i.includes('后端服务')),
      recommendations: issues.length > 0 ? '需要立即处理' : '可能是延迟问题'
    }
  };

  try {
    const reportPath = path.join(__dirname, 'diagnostic_summary_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 诊断总结报告已保存到: ${reportPath}`);
  } catch (error) {
    console.warn('⚠️  无法保存报告文件:', error.message);
  }

  console.log('\n✨ 诊断总结完成！');
  console.log('请按照上述步骤逐一排查问题。');

  return report;
}

// 执行诊断总结
if (require.main === module) {
  runDiagnosticSummary()
    .catch(error => {
      console.error('诊断总结失败:', error);
      process.exit(1);
    });
}

module.exports = { runDiagnosticSummary };