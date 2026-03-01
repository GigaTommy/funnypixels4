const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 分析目录
const BACKEND_DIR = 'C:/Users/GinoChow/web3/funnypixels/backend/src';
const FRONTEND_DIR = 'C:/Users/GinoChow/web3/funnypixels/frontend/src';

// 排除的文件（logger相关文件）
const EXCLUDE_FILES = [
  'logger.js',
  'logger-examples.js',
  'LOGGER_README.md',
  'main-douyin.tsx'
];

// 排除的目录
const EXCLUDE_DIRS = [
  'node_modules',
  'dist',
  'build'
];

function isExcluded(filePath) {
  const fileName = path.basename(filePath);
  return EXCLUDE_FILES.includes(fileName) ||
         EXCLUDE_DIRS.some(dir => filePath.includes(`/${dir}/`)) ||
         filePath.includes('\\node_modules\\') ||
         filePath.includes('\\dist\\') ||
         filePath.includes('\\build\\');
}

function analyzeConsoleUsage(dir, label) {
  console.log(`\n=== ${label} Console 使用分析 ===`);

  try {
    // 使用 ripgrep 搜索 console 使用
    const result = execSync(`rg "console\\.(log|error|warn|info|debug)\\(" "${dir}" --type js --type ts -n`,
      { encoding: 'utf8', cwd: 'C:/Users/GinoChow/web3/funnypixels' });

    const lines = result.split('\n').filter(line => line.trim());
    const fileStats = {};
    let totalUsage = 0;

    lines.forEach(line => {
      const [filePath, lineNumber, ...codeParts] = line.split(':');
      const code = codeParts.join(':');

      if (isExcluded(filePath)) {
        return;
      }

      totalUsage++;

      if (!fileStats[filePath]) {
        fileStats[filePath] = {
          count: 0,
          usages: []
        };
      }

      fileStats[filePath].count++;
      fileStats[filePath].usages.push({
        line: lineNumber,
        code: code.trim()
      });
    });

    console.log(`总使用次数: ${totalUsage}`);
    console.log(`涉及文件数: ${Object.keys(fileStats).length}`);

    // 按使用次数排序
    const sortedFiles = Object.entries(fileStats)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10); // 取前10个

    console.log('\n使用最多的文件 (Top 10):');
    sortedFiles.forEach(([filePath, stats], index) => {
      console.log(`${index + 1}. ${filePath} - ${stats.count} 次`);
    });

    // 分析类型分布
    const typeStats = { log: 0, error: 0, warn: 0, info: 0, debug: 0 };

    lines.forEach(line => {
      const match = line.match(/console\.(log|error|warn|info|debug)\(/);
      if (match) {
        typeStats[match[1]]++;
      }
    });

    console.log('\n按类型分布:');
    Object.entries(typeStats).forEach(([type, count]) => {
      console.log(`  ${type}: ${count} 次`);
    });

    return {
      totalUsage,
      fileCount: Object.keys(fileStats).length,
      files: fileStats,
      typeStats
    };

  } catch (error) {
    console.log(`${label} 中未发现 console 使用或搜索出错`);
    return {
      totalUsage: 0,
      fileCount: 0,
      files: {},
      typeStats: { log: 0, error: 0, warn: 0, info: 0, debug: 0 }
    };
  }
}

// 开始分析
console.log('🔍 开始分析前后端代码中的 console 使用情况...');

const backendResult = analyzeConsoleUsage(BACKEND_DIR, '后端');
const frontendResult = analyzeConsoleUsage(FRONTEND_DIR, '前端');

// 生成报告
console.log('\n' + '='.repeat(60));
console.log('📊 分析总结报告');
console.log('='.repeat(60));

console.log(`\n🎯 总体情况:`);
console.log(`  后端总使用: ${backendResult.totalUsage} 次`);
console.log(`  前端总使用: ${frontendResult.totalUsage} 次`);
console.log(`  总计: ${backendResult.totalUsage + frontendResult.totalUsage} 次`);

console.log(`\n📁 文件分布:`);
console.log(`  后端涉及文件: ${backendResult.fileCount} 个`);
console.log(`  前端涉及文件: ${frontendResult.fileCount} 个`);

// 检查是否有logger系统
console.log(`\n🔧 Logger 系统检查:`);
const backendLoggerExists = fs.existsSync(path.join(BACKEND_DIR, 'utils', 'logger.js'));
const frontendLoggerExists = fs.existsSync(path.join(FRONTEND_DIR, 'utils', 'logger.ts'));

console.log(`  后端 Logger: ${backendLoggerExists ? '✅ 存在' : '❌ 不存在'}`);
console.log(`  前端 Logger: ${frontendLoggerExists ? '✅ 存在' : '❌ 不存在'}`);

console.log(`\n⚠️  不规范使用情况:`);
if (backendResult.totalUsage > 0 || frontendResult.totalUsage > 0) {
  console.log(`  发现 ${backendResult.totalUsage + frontendResult.totalUsage} 处不规范使用原生 console 方法`);
  console.log(`  建议: 使用项目统一的 logger 系统替换这些调用`);
} else {
  console.log(`  ✅ 未发现明显的不规范使用`);
}

console.log('\n📋 建议修复方案:');
console.log('1. 后端: 使用 const logger = require("./utils/logger") 替换 console.*');
console.log('2. 前端: 使用 import { logger } from "./utils/logger" 替换 console.*');
console.log('3. 在生产环境中，logger 系统会自动处理日志级别和输出格式');
console.log('4. 对于特殊调试需求，可以考虑使用 logger.debug() 而不是 console.log()');