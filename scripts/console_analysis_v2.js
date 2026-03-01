const fs = require('fs');
const path = require('path');

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

function isExcluded(filePath) {
  const fileName = path.basename(filePath);
  return EXCLUDE_FILES.includes(fileName);
}

function findFiles(dir, extensions = ['.js', '.ts', '.jsx', '.tsx']) {
  const files = [];

  function traverse(currentDir) {
    try {
      const items = fs.readdirSync(currentDir);

      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          // 跳过 node_modules, dist, build 等目录
          if (!['node_modules', 'dist', 'build', '.git'].includes(item)) {
            traverse(fullPath);
          }
        } else if (stat.isFile()) {
          const ext = path.extname(item);
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      // 忽略权限错误等
    }
  }

  traverse(dir);
  return files;
}

function analyzeConsoleUsageInFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const usages = [];

    lines.forEach((line, index) => {
      const matches = line.match(/console\.(log|error|warn|info|debug)\(/g);
      if (matches) {
        usages.push({
          line: index + 1,
          content: line.trim(),
          types: matches.map(m => m.match(/console\.(log|error|warn|info|debug)/)[1])
        });
      }
    });

    return usages;
  } catch (error) {
    return [];
  }
}

function analyzeConsoleUsage(dir, label) {
  console.log(`\n=== ${label} Console 使用分析 ===`);

  const files = findFiles(dir);
  const fileStats = {};
  let totalUsage = 0;
  const typeStats = { log: 0, error: 0, warn: 0, info: 0, debug: 0 };

  for (const filePath of files) {
    if (isExcluded(filePath)) {
      continue;
    }

    const usages = analyzeConsoleUsageInFile(filePath);
    if (usages.length > 0) {
      fileStats[filePath] = {
        count: usages.length,
        usages: usages
      };
      totalUsage += usages.length;

      // 统计类型
      usages.forEach(usage => {
        usage.types.forEach(type => {
          typeStats[type]++;
        });
      });
    }
  }

  console.log(`总使用次数: ${totalUsage}`);
  console.log(`涉及文件数: ${Object.keys(fileStats).length}`);

  // 按使用次数排序
  const sortedFiles = Object.entries(fileStats)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 15); // 取前15个

  if (sortedFiles.length > 0) {
    console.log('\n使用最多的文件 (Top 15):');
    sortedFiles.forEach(([filePath, stats], index) => {
      const relativePath = path.relative(dir, filePath);
      console.log(`${index + 1}. ${relativePath} - ${stats.count} 次`);

      // 显示前3个使用示例
      stats.usages.slice(0, 3).forEach((usage, i) => {
        console.log(`   Line ${usage.line}: ${usage.content.substring(0, 80)}${usage.content.length > 80 ? '...' : ''}`);
      });

      if (stats.usages.length > 3) {
        console.log(`   ... 还有 ${stats.usages.length - 3} 处使用`);
      }
      console.log('');
    });
  }

  console.log('\n按类型分布:');
  Object.entries(typeStats).forEach(([type, count]) => {
    if (count > 0) {
      console.log(`  ${type}: ${count} 次`);
    }
  });

  return {
    totalUsage,
    fileCount: Object.keys(fileStats).length,
    files: fileStats,
    typeStats
  };
}

// 开始分析
console.log('🔍 开始分析前后端代码中的 console 使用情况...');
console.log('搜索模式: console.(log|error|warn|info|debug)(');

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

console.log(`  后端 Logger: ${backendLoggerExists ? '✅ 存在 (pino-based)' : '❌ 不存在'}`);
console.log(`  前端 Logger: ${frontendLoggerExists ? '✅ 存在 (custom)' : '❌ 不存在'}`);

// 检查logger使用情况
console.log(`\n📈 Logger 系统使用情况:`);
const backendLoggerUsage = Object.keys(backendResult.files).filter(file =>
  file.includes('logger') || file.includes('server.js')
).length;
const frontendLoggerUsage = Object.keys(frontendResult.files).filter(file =>
  file.includes('logger') || file.includes('main')
).length;

console.log(`  后端 Logger 相关文件中的 console 使用: ${backendLoggerUsage} 个`);
console.log(`  前端 Logger 相关文件中的 console 使用: ${frontendLoggerUsage} 个`);

const nonLoggerBackendFiles = Object.keys(backendResult.files).filter(file =>
  !file.includes('logger') && !file.includes('main-douyin')
);
const nonLoggerFrontendFiles = Object.keys(frontendResult.files).filter(file =>
  !file.includes('logger') && !file.includes('main-douyin')
);

console.log(`\n⚠️  不规范使用情况:`);
console.log(`  后端非 Logger 文件中的 console 使用: ${nonLoggerBackendFiles.length} 个文件`);
console.log(`  前端非 Logger 文件中的 console 使用: ${nonLoggerFrontendFiles.length} 个文件`);

if (nonLoggerBackendFiles.length > 0 || nonLoggerFrontendFiles.length > 0) {
  console.log(`\n❌ 发现不规范使用原生 console 方法的文件:`);

  if (nonLoggerBackendFiles.length > 0) {
    console.log(`\n后端文件:`);
    nonLoggerBackendFiles.forEach(file => {
      const relativePath = path.relative(BACKEND_DIR, file);
      console.log(`  - ${relativePath} (${backendResult.files[file].count} 次)`);
    });
  }

  if (nonLoggerFrontendFiles.length > 0) {
    console.log(`\n前端文件:`);
    nonLoggerFrontendFiles.forEach(file => {
      const relativePath = path.relative(FRONTEND_DIR, file);
      console.log(`  - ${relativePath} (${frontendResult.files[file].count} 次)`);
    });
  }
} else {
  console.log(`  ✅ 大部分 console 使用都在 Logger 相关文件中，符合规范`);
}

console.log('\n📋 建议修复方案:');
console.log('1. 后端: 使用 const logger = require("./utils/logger") 替换 console.*');
console.log('   - logger.debug() 用于调试信息');
console.log('   - logger.info() 用于一般信息');
console.log('   - logger.warn() 用于警告');
console.log('   - logger.error() 用于错误');
console.log('');
console.log('2. 前端: 使用 import { logger } from "./utils/logger" 替换 console.*');
console.log('   - logger.debug() 用于调试信息 (开发环境)');
console.log('   - logger.info() 用于一般信息 (开发环境)');
console.log('   - logger.warn() 用于警告 (开发环境)');
console.log('   - logger.error() 用于错误 (所有环境)');
console.log('');
console.log('3. 特殊情况处理:');
console.log('   - Performance monitor 中的 console.group/table 可以保留 (用于性能分析)');
console.log('   - Scripts 目录中的脚本可以保留 console (用于独立脚本运行)');
console.log('   - Workers 中的 console 可以保留 (用于 worker 调试)');
console.log('');
console.log('4. 配置建议:');
console.log('   - 后端已在 logger.js 中配置了 console 转发，开发环境下 console.* 会自动转发到 logger');
console.log('   - 前端已在 logger.ts 中配置了生产环境 console 禁用');
console.log('   - 建议在所有入口文件中调用 applyConsoleLoggingPolicy()');

// 保存详细结果到文件
const reportData = {
  timestamp: new Date().toISOString(),
  backend: backendResult,
  frontend: frontendResult,
  summary: {
    totalConsoleUsage: backendResult.totalUsage + frontendResult.totalUsage,
    nonStandardFiles: [...nonLoggerBackendFiles, ...nonLoggerFrontendFiles].length,
    loggerSystemExists: {
      backend: backendLoggerExists,
      frontend: frontendLoggerExists
    }
  }
};

fs.writeFileSync('C:/Users/GinoChow/web3/funnypixels/console_analysis_report.json', JSON.stringify(reportData, null, 2));
console.log('\n📄 详细报告已保存到: console_analysis_report.json');