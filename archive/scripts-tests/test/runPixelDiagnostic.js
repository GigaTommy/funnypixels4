#!/usr/bin/env node

/**
 * 像素绘制问题快速诊断脚本
 *
 * 这是一个统一的入口，可以快速运行所有诊断测试
 *
 * 使用方法：
 * node scripts/test/runPixelDiagnostic.js [选项]
 *
 * 选项：
 * --all              运行所有诊断测试（默认）
 * --api-only         仅运行API流程诊断
 * --batch-only       仅运行批处理服务诊断
 * --quick            快速诊断（跳过等待时间）
 * --report-file      指定报告文件路径
 */

const path = require('path');
const fs = require('fs');

// 导入诊断模块
const { runPixelDrawDiagnostic } = require('./pixelDrawDiagnostic');
const { runBatchServiceDiagnostic } = require('./batchServiceDiagnostic');

// 解析命令行参数
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    runAll: true,
    runApi: false,
    runBatch: false,
    quick: false,
    reportFile: null
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--all':
        options.runAll = true;
        options.runApi = false;
        options.runBatch = false;
        break;
      case '--api-only':
        options.runAll = false;
        options.runApi = true;
        options.runBatch = false;
        break;
      case '--batch-only':
        options.runAll = false;
        options.runApi = false;
        options.runBatch = true;
        break;
      case '--quick':
        options.quick = true;
        break;
      case '--report-file':
        options.reportFile = args[++i];
        break;
      case '--help':
      case '-h':
        showUsage();
        process.exit(0);
        break;
      default:
        console.error(`未知参数: ${arg}`);
        showUsage();
        process.exit(1);
    }
  }

  return options;
}

function showUsage() {
  console.log(`
像素绘制问题诊断工具

使用方法:
  node scripts/test/runPixelDiagnostic.js [选项]

选项:
  --all              运行所有诊断测试（默认）
  --api-only         仅运行API流程诊断
  --batch-only       仅运行批处理服务诊断
  --quick            快速诊断（跳过等待时间）
  --report-file      指定报告文件路径
  --help, -h         显示此帮助信息

示例:
  node scripts/test/runPixelDiagnostic.js                    # 运行所有测试
  node scripts/test/runPixelDiagnostic.js --api-only         # 仅测试API流程
  node scripts/test/runPixelDiagnostic.js --batch-only       # 仅测试批处理服务
  node scripts/test/runPixelDiagnostic.js --quick            # 快速诊断
  node scripts/test/runPixelDiagnostic.js --report-file custom-report.json

环境要求:
  - 后端服务运行在 http://localhost:3001
  - 数据库连接正常
  - Redis服务运行（如果使用批处理）

输出:
  - 控制台实时显示诊断进度
  - 生成详细的JSON报告文件
  - 提供问题定位和修复建议
`);
}

async function runQuickDiagnostic() {
  console.log('🚀 运行快速诊断...\n');

  const results = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0
    },
    tests: {}
  };

  // 基础连接测试
  console.log('=== 基础连接测试 ===');

  try {
    // 测试后端连接
    const axios = require('axios');
    const healthResponse = await axios.get('http://localhost:3001/api/health', { timeout: 3000 });
    results.tests.backend = { success: true, status: healthResponse.status };
    results.summary.passedTests++;
    console.log('✅ 后端服务连接正常');
  } catch (error) {
    results.tests.backend = { success: false, error: error.message };
    results.summary.failedTests++;
    console.log('❌ 后端服务连接失败:', error.message);
  }

  try {
    // 测试数据库连接 - 使用绝对路径
    const path = require('path');
    const projectRoot = path.resolve(__dirname, '../..');
    const { db } = require(path.join(projectRoot, 'backend/src/config/database'));
    await db.raw('SELECT 1');
    results.tests.database = { success: true };
    results.summary.passedTests++;
    console.log('✅ 数据库连接正常');
  } catch (error) {
    results.tests.database = { success: false, error: error.message };
    results.summary.failedTests++;
    console.log('❌ 数据库连接失败:', error.message);
  }

  try {
    // 测试Redis连接 - 使用绝对路径
    const path = require('path');
    const projectRoot = path.resolve(__dirname, '../..');
    const { redis } = require(path.join(projectRoot, 'backend/src/config/redis'));
    await redis.ping();
    results.tests.redis = { success: true };
    results.summary.passedTests++;
    console.log('✅ Redis连接正常');
  } catch (error) {
    results.tests.redis = { success: false, error: error.message };
    results.summary.failedTests++;
    console.log('❌ Redis连接失败:', error.message);
  }

  // 表结构检查
  console.log('\n=== 表结构检查 ===');
  const requiredTables = ['pixels', 'pixels_history', 'users', 'user_pixel_states'];

  // 获取数据库连接（复用）
  let db;
  try {
    const path = require('path');
    const projectRoot = path.resolve(__dirname, '../..');
    const dbModule = require(path.join(projectRoot, 'backend/src/config/database'));
    db = dbModule.db;
  } catch (error) {
    console.log('❌ 无法获取数据库连接，跳过表结构检查');
    return results;
  }

  for (const tableName of requiredTables) {
    try {
      const exists = await db.schema.hasTable(tableName);
      if (exists) {
        results.tests[`table_${tableName}`] = { success: true };
        results.summary.passedTests++;
        console.log(`✅ 表 ${tableName} 存在`);
      } else {
        results.tests[`table_${tableName}`] = { success: false, error: '表不存在' };
        results.summary.failedTests++;
        console.log(`❌ 表 ${tableName} 不存在`);
      }
    } catch (error) {
      results.tests[`table_${tableName}`] = { success: false, error: error.message };
      results.summary.failedTests++;
      console.log(`❌ 检查表 ${tableName} 失败:`, error.message);
    }
  }

  // 服务状态检查
  console.log('\n=== 服务状态检查 ===');

  try {
    const path = require('path');
    const projectRoot = path.resolve(__dirname, '../..');
    const batchPixelService = require(path.join(projectRoot, 'backend/src/services/batchPixelService'));
    const stats = batchPixelService.getStats();
    results.tests.batchService = { success: true, stats };
    results.summary.passedTests++;
    console.log('✅ 批处理服务状态正常');
  } catch (error) {
    results.tests.batchService = { success: false, error: error.message };
    results.summary.failedTests++;
    console.log('❌ 批处理服务状态异常:', error.message);
  }

  results.summary.totalTests = results.summary.passedTests + results.summary.failedTests;

  // 输出总结
  console.log('\n=== 快速诊断总结 ===');
  console.log(`总测试数: ${results.summary.totalTests}`);
  console.log(`通过测试: ${results.summary.passedTests}`);
  console.log(`失败测试: ${results.summary.failedTests}`);

  if (results.summary.failedTests === 0) {
    console.log('✅ 所有基础检查通过，系统运行正常！');
  } else {
    console.log('⚠️  发现问题，建议运行完整诊断进一步排查');
  }

  return results;
}

async function main() {
  const options = parseArgs();
  const startTime = Date.now();

  console.log('🔍 像素绘制问题诊断工具');
  console.log('='.repeat(50));

  let allResults = {
    timestamp: new Date().toISOString(),
    options,
    totalTime: 0,
    results: {}
  };

  try {
    if (options.quick) {
      // 快速诊断模式
      allResults.results.quick = await runQuickDiagnostic();
    } else {
      // 完整诊断模式

      if (options.runAll || options.runApi) {
        console.log('\n🌐 运行API流程诊断...\n');
        allResults.results.api = await runPixelDrawDiagnostic();
      }

      if (options.runAll || options.runBatch) {
        console.log('\n⚙️  运行批处理服务诊断...\n');
        allResults.results.batch = await runBatchServiceDiagnostic();
      }
    }

    allResults.totalTime = Date.now() - startTime;

    // 保存综合报告
    const reportPath = options.reportFile || path.join(__dirname, 'comprehensive_diagnostic_report.json');

    try {
      fs.writeFileSync(reportPath, JSON.stringify(allResults, null, 2));
      console.log(`\n📄 综合报告已保存到: ${reportPath}`);
    } catch (error) {
      console.warn('\n⚠️  无法保存报告文件:', error.message);
    }

    // 输出最终总结
    console.log('\n' + '='.repeat(50));
    console.log('🎯 诊断完成！');
    console.log(`⏱️  总耗时: ${allResults.totalTime}ms`);

    // 根据结果提供建议
    const hasFailures = Object.values(allResults.results).some(result => {
      if (result.summary) {
        return result.summary.errorCount > 0;
      }
      if (result.errors) {
        return result.errors.length > 0;
      }
      return false;
    });

    if (hasFailures) {
      console.log('\n🔧 建议：');
      console.log('   1. 查看详细的诊断报告文件');
      console.log('   2. 根据错误信息检查相应的服务配置');
      console.log('   3. 如果是批处理问题，尝试重启批处理服务');
      console.log('   4. 检查日志文件获取更多错误详情');
      console.log('   5. 如果问题持续，联系开发团队');
    } else {
      console.log('\n✅ 所有诊断测试通过，系统运行正常！');
    }

  } catch (error) {
    console.error('\n❌ 诊断过程中发生错误:', error);

    allResults.error = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    };

    // 尝试保存错误报告
    try {
      const errorReportPath = path.join(__dirname, 'diagnostic_error_report.json');
      fs.writeFileSync(errorReportPath, JSON.stringify(allResults, null, 2));
      console.log(`📄 错误报告已保存到: ${errorReportPath}`);
    } catch (reportError) {
      console.warn('无法保存错误报告:', reportError.message);
    }

    process.exit(1);
  }
}

// 运行主程序
if (require.main === module) {
  main().catch(error => {
    console.error('脚本执行失败:', error);
    process.exit(1);
  });
}

module.exports = { main, runQuickDiagnostic };