#!/usr/bin/env node

/**
 * 验证生产环境修复状态
 */

const fs = require('fs');
const path = require('path');

async function verifyProductionFix() {
  console.log('🔍 验证生产环境修复状态...');

  const results = {
    codeFixed: false,
    noOldReferences: false,
    filesUpdated: false,
    recommendations: []
  };

  try {
    console.log('\n📋 1. 检查Leaderboard模型文件...');

    const leaderboardPath = path.join(__dirname, '../src/models/Leaderboard.js');
    if (fs.existsSync(leaderboardPath)) {
      const content = fs.readFileSync(leaderboardPath, 'utf8');

      // 检查是否包含修复后的代码
      const hasNewCode = content.includes('leaderboard_personal') && content.includes('leaderboard_alliance');
      const hasOldTableRef = content.includes("db('leaderboards')");
      const hasErrorHandling = content.includes('try {') && content.includes('catch (error)');

      console.log(`✅ 文件存在: ${leaderboardPath}`);
      console.log(`${hasNewCode ? '✅' : '❌'} 包含新表引用 (leaderboard_personal, leaderboard_alliance)`);
      console.log(`${!hasOldTableRef ? '✅' : '❌'} 无旧表引用 (leaderboards)`);
      console.log(`${hasErrorHandling ? '✅' : '❌'} 包含错误处理`);

      results.codeFixed = hasNewCode;
      results.noOldReferences = !hasOldTableRef;

      if (!hasNewCode) {
        results.recommendations.push('需要更新Leaderboard模型使用新的排行榜表');
      }
      if (hasOldTableRef) {
        results.recommendations.push('需要移除对旧leaderboards表的引用');
      }
    } else {
      console.log('❌ Leaderboard模型文件不存在');
      results.recommendations.push('Leaderboard模型文件缺失，需要重新部署');
    }

    console.log('\n📋 2. 检查相关控制器文件...');

    const socialControllerPath = path.join(__dirname, '../src/controllers/socialController.js');
    if (fs.existsSync(socialControllerPath)) {
      const content = fs.readFileSync(socialControllerPath, 'utf8');
      const hasLeaderboardImport = content.includes("require('../models/Leaderboard')");
      const hasErrorHandling = content.includes('catch (error)');

      console.log(`✅ SocialController文件存在`);
      console.log(`${hasLeaderboardImport ? '✅' : '❌'} 正确引用Leaderboard模型`);
      console.log(`${hasErrorHandling ? '✅' : '❌'} 包含错误处理`);
    }

    console.log('\n📋 3. 检查修复脚本文件...');

    const fixScripts = [
      'fix-all-table-structures.js',
      'test-leaderboard-api-fixed.js',
      'diagnose-leaderboard-api.js'
    ];

    fixScripts.forEach(script => {
      const scriptPath = path.join(__dirname, script);
      const exists = fs.existsSync(scriptPath);
      console.log(`${exists ? '✅' : '❌'} ${script}`);
    });

    console.log('\n📋 4. 生成部署建议...');

    if (results.codeFixed && results.noOldReferences) {
      console.log('✅ 代码修复完成，准备部署到生产环境');

      console.log('\n🚀 部署步骤:');
      console.log('1. 确保代码已推送到仓库: git push origin main');
      console.log('2. 在生产服务器更新代码: git pull origin main');
      console.log('3. 重启应用服务器: pm2 restart all');
      console.log('4. 验证API正常: curl https://your-domain/api/social/leaderboard');

      results.recommendations.push('代码已准备好部署，请按照部署步骤执行');
    } else {
      console.log('❌ 代码修复未完成，不建议部署');

      if (!results.codeFixed) {
        results.recommendations.push('完成Leaderboard模型的修复');
      }
      if (!results.noOldReferences) {
        results.recommendations.push('移除所有对旧表的引用');
      }
    }

    console.log('\n📋 5. 测试命令...');
    console.log('本地测试: node scripts/test-leaderboard-api-fixed.js');
    console.log('生产诊断: node scripts/diagnose-leaderboard-api.js');
    console.log('API测试: curl -X GET "https://your-domain/api/social/leaderboard?type=user"');

    return results;

  } catch (error) {
    console.error('❌ 验证失败:', error.message);
    results.recommendations.push('验证过程出错，请检查文件权限和路径');
    return results;
  }
}

// 执行验证
if (require.main === module) {
  verifyProductionFix()
    .then(results => {
      console.log('\n📊 验证结果:');
      console.log(`代码已修复: ${results.codeFixed ? '✅' : '❌'}`);
      console.log(`无旧引用: ${results.noOldReferences ? '✅' : '❌'}`);

      if (results.recommendations.length > 0) {
        console.log('\n💡 建议:');
        results.recommendations.forEach((rec, index) => {
          console.log(`${index + 1}. ${rec}`);
        });
      }

      const success = results.codeFixed && results.noOldReferences;
      process.exit(success ? 0 : 1);
    });
}

module.exports = { verifyProductionFix };