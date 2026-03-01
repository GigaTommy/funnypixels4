/**
 * 代码依赖关系检查脚本
 * 直接检查App.tsx和PixelInfoCard.tsx中的具体代码依赖
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 开始代码依赖关系检查...\n');

// 1. 读取并分析App.tsx文件
function analyzeAppTsx() {
  console.log('📖 分析App.tsx文件...');

  const appPath = path.join(__dirname, 'src/app.tsx');
  const appContent = fs.readFileSync(appPath, 'utf8');

  // 检查关键的状态定义
  const statePatterns = {
    selectedPixel: /const\s+\[selectedPixel,\s*setSelectedPixel\]\s*=\s*useState<PixelInfo\s*\|\s*null>\(null\);?/,
    showPixelCard: /const\s+\[showPixelCard,\s*setShowPixelCard\]\s*=\s*useState\(false\);?/,
    currentUser: /const\s+\[currentUser,\s*setCurrentUser\]\s*=\s*useState<AuthUser\s*\|\s*null>\(null\);?/,
    isAuthenticated: /const\s+\[isAuthenticated,\s*setIsAuthenticated\]\s*=\s*useState\(false\);?/,
    isGuest: /const\s+isGuest\s*=\s*AuthService\.isGuest\(\);?/
  };

  console.log('📋 状态变量检查:');
  Object.entries(statePatterns).forEach(([key, pattern]) => {
    const found = pattern.test(appContent);
    console.log(`  ${key}: ${found ? '✅ 找到' : '❌ 未找到'}`);
  });

  // 检查像素点击处理函数
  const pixelClickHandlerPattern = /const\s+handlePixelClickInternal\s*=\s*async\s*\([^)]*\)\s*=>\s*{[\s\S]*?^};/gm;
  const pixelClickHandlerMatch = pixelClickHandlerPattern.exec(appContent);

  if (pixelClickHandlerMatch) {
    console.log('\n✅ 找到handlePixelClickInternal函数');
    const handlerContent = pixelClickHandlerMatch[0];

    // 检查函数中的关键逻辑
    const checks = {
      permissionCheck: /if\s*\(\s*!isAuthenticated\s*\|\|\s*isGuest\s*\)/.test(handlerContent),
      stateUpdate: /setSelectedPixel\s*\(\s*pixelInfo\s*\)/.test(handlerContent),
      showCardUpdate: /setShowPixelCard\s*\(\s*true\s*\)/.test(handlerContent),
      logStatements: /console\.log.*像素卡片.*状态/.test(handlerContent)
    };

    console.log('📋 像素点击处理函数检查:');
    Object.entries(checks).forEach(([key, found]) => {
      console.log(`  ${key}: ${found ? '✅ 找到' : '❌ 未找到'}`);
    });
  } else {
    console.log('❌ 未找到handlePixelClickInternal函数');
  }

  // 检查useEffect依赖
  const useEffectPattern = /useEffect\s*\(\s*\([^)]*\)\s*,\s*\[([^)]*)\]\s*\)/g;
  const useEffectMatches = [];
  let match;
  while ((match = useEffectPattern.exec(appContent)) !== null) {
    useEffectMatches.push({
      callback: match[1],
      dependencies: match[2]
    });
  }

  console.log('\n📋 useEffect依赖检查:');
  useEffectMatches.forEach((effect, index) => {
    console.log(`  useEffect ${index + 1}:`);
    console.log(`    依赖: [${effect.dependencies}]`);

    // 检查是否包含像素相关的依赖
    const hasPixelRelatedDeps = /selectedPixel|showPixelCard|pixelCardPosition/.test(effect.dependencies);
    console.log(`    包含像素相关依赖: ${hasPixelRelatedDeps ? '✅' : '❌'}`);
  });

  return { appContent, statePatterns, pixelClickHandlerMatch, useEffectMatches };
}

// 2. 读取并分析PixelInfoCard.tsx文件
function analyzePixelInfoCardTsx() {
  console.log('\n📖 分析PixelInfoCard.tsx文件...');

  const cardPath = path.join(__dirname, 'src/components/map/PixelInfoCard.tsx');
  const cardContent = fs.readFileSync(cardPath, 'utf8');

  // 检查currentUser的获取方式
  const currentUserPatterns = {
    useContext: /const\s+currentUser\s*=\s*useContext\s*\([^)]+\)/,
    authServiceDirect: /AuthService\./,
    propsCheck: /currentUser\s*\|\|\s*props\.currentUser/
  };

  console.log('📋 currentUser获取方式检查:');
  Object.entries(currentUserPatterns).forEach(([key, pattern]) => {
    const found = pattern.test(cardContent);
    console.log(`  ${key}: ${found ? '✅ 找到' : '❌ 未找到'}`);
  });

  // 检查渲染条件
  const renderConditions = {
    userCheck: /if\s*\(\s*!currentUser\s*\)/,
    drawingModeCheck: /if\s*\(\s*isDrawingMode\s*\)/,
    dataAndVisibleCheck: /if\s*\(\s*!pixel\s*\|\|\s*!isVisible\s*\)/,
    returnNull: /return\s+null;/
  };

  console.log('\n📋 渲染条件检查:');
  Object.entries(renderConditions).forEach(([key, pattern]) => {
    const found = pattern.test(cardContent);
    console.log(`  ${key}: ${found ? '✅ 找到' : '❌ 未找到'}`);
  });

  // 检查投诉按钮的条件
  const reportButtonPattern = /disabled\s*=\s*{\s*!currentUser\s*}/;
  const hasReportButtonCondition = reportButtonPattern.test(cardContent);
  console.log(`\n📋 投诉按钮条件检查: ${hasReportButtonCondition ? '✅ 找到' : '❌ 未找到'}`);

  // 检查组件的return语句结构
  const returnPattern = /return\s*\(/;
  const hasReturnStatement = returnPattern.test(cardContent);
  console.log(`📋 组件return语句: ${hasReturnStatement ? '✅ 找到' : '❌ 未找到'}`);

  return { cardContent, currentUserPatterns, renderConditions, hasReportButtonCondition };
}

// 3. 分析状态传递关系
function analyzeStatePassing(appAnalysis, cardAnalysis) {
  console.log('\n🔗 分析状态传递关系...');

  // 检查App.tsx中的PixelInfoCard渲染
  const pixelCardRenderPattern = /PixelInfoCard[\s\S]*?pixel\s*=\s*\{selectedPixel\}[\s\S]*?isVisible\s*=\s*\{showPixelCard\}/;
  const appContent = appAnalysis.appContent;
  const renderMatch = pixelCardRenderPattern.exec(appContent);

  console.log('📋 PixelInfoCard渲染检查:');
  if (renderMatch) {
    console.log('✅ 找到PixelInfoCard渲染代码');

    // 检查传递的props
    const propsCheck = {
      pixel: /pixel\s*=\s*\{selectedPixel\}/.test(renderMatch[0]),
      isVisible: /isVisible\s*=\s*\{showPixelCard\}/.test(renderMatch[0]),
      onClose: /onClose\s*=\s*\{handlePixelCardClose\}/.test(renderMatch[0]),
      position: /position\s*=\s*\{pixelCardPosition\}/.test(renderMatch[0])
    };

    console.log('  Props传递检查:');
    Object.entries(propsCheck).forEach(([key, found]) => {
      console.log(`    ${key}: ${found ? '✅ 找到' : '❌ 未找到'}`);
    });
  } else {
    console.log('❌ 未找到PixelInfoCard渲染代码');
  }

  // 检查渲染条件
  const renderConditionPattern = /selectedPixel\s*&&\s*isAuthenticated\s*&&\s*!isGuest/;
  const hasRenderCondition = renderConditionPattern.test(appContent);
  console.log(`📋 App.tsx渲染条件: ${hasRenderCondition ? '✅ 找到' : '❌ 未找到'}`);
}

// 4. 识别潜在的时序问题
function identifyTimingIssues(appAnalysis) {
  console.log('\n⏱️ 识别潜在的时序问题...');

  const appContent = appAnalysis.appContent;
  const timingIssues = [];

  // 检查异步API调用
  const apiCallPattern = /await\s+fetch\s*\([^)]*\/api\/pixels\/[^)]*\)/;
  const hasAPICall = apiCallPattern.test(appContent);
  if (hasAPICall) {
    timingIssues.push({
      type: 'API调用',
      location: '像素信息获取API',
      issue: '异步API调用可能在状态更新完成前失败',
      severity: 'medium'
    });
  }

  // 检查try-catch块中的状态处理
  const tryCatchPattern = /try\s*{[\s\S]*?}\s*catch\s*\([^)]*\)\s*{[\s\S]*?}/g;
  const tryCatchMatches = [];
  let match;
  while ((match = tryCatchPattern.exec(appContent)) !== null) {
    tryCatchMatches.push(match[0]);
  }

  console.log(`📋 找到 ${tryCatchMatches.length} 个try-catch块`);

  tryCatchMatches.forEach((block, index) => {
    const hasStateReset = /setShowPixelCard\s*\(\s*false\s*\)|setSelectedPixel\s*\(\s*null\s*\)/.test(block);
    if (hasStateReset) {
      timingIssues.push({
        type: '异常处理',
        location: `try-catch块 ${index + 1}`,
        issue: '异常处理中可能重置像素卡片状态',
        severity: 'high'
      });
    }
  });

  // 检查useEffect中的状态更新
  appAnalysis.useEffectMatches.forEach((effect, index) => {
    const hasPixelStateUpdate = /setSelectedPixel|setShowPixelCard/.test(effect.callback);
    if (hasPixelStateUpdate) {
      timingIssues.push({
        type: 'useEffect状态更新',
        location: `useEffect ${index + 1}`,
        issue: 'useEffect中的状态更新可能与用户交互冲突',
        severity: 'medium'
      });
    }
  });

  console.log('📋 识别的时序问题:');
  timingIssues.forEach((issue, index) => {
    console.log(`${index + 1}. [${issue.severity.toUpperCase()}] ${issue.type}`);
    console.log(`   位置: ${issue.location}`);
    console.log(`   问题: ${issue.issue}`);
    console.log('');
  });

  return timingIssues;
}

// 5. 生成具体的修复建议
function generateFixSuggestions(timingIssues, appAnalysis, cardAnalysis) {
  console.log('💡 生成具体的修复建议...\n');

  const suggestions = [];

  // 基于时序问题生成建议
  if (timingIssues.length > 0) {
    const highSeverityIssues = timingIssues.filter(issue => issue.severity === 'high');
    if (highSeverityIssues.length > 0) {
      suggestions.push({
        priority: 'critical',
        category: '时序问题修复',
        action: '检查并修复高严重性的时序问题',
        details: '重点检查异常处理中的状态重置逻辑，确保不会意外覆盖像素卡片状态',
        codeLocation: highSeverityIssues.map(issue => issue.location).join(', ')
      });
    }

    const mediumSeverityIssues = timingIssues.filter(issue => issue.severity === 'medium');
    if (mediumSeverityIssues.length > 0) {
      suggestions.push({
        priority: 'high',
        category: '异步操作优化',
        action: '优化异步API调用的错误处理',
        details: '确保API调用失败时不会影响像素卡片的显示状态，使用try-catch包裹但不重置状态',
        codeLocation: mediumSeverityIssues.map(issue => issue.location).join(', ')
      });
    }
  }

  // 基于代码分析生成建议
  if (appAnalysis.useEffectMatches.length > 3) {
    suggestions.push({
      priority: 'medium',
      category: 'useEffect优化',
      action: '检查useEffect依赖数组的必要性',
      details: '过多的useEffect可能导致不必要的重新渲染，影响状态管理的稳定性',
      codeLocation: 'App.tsx中的多个useEffect'
    });
  }

  if (!cardAnalysis.hasReportButtonCondition) {
    suggestions.push({
      priority: 'low',
      category: '条件检查',
      action: '验证投诉按钮的渲染条件',
      details: '投诉按钮和主面板应该使用相同的用户检查条件，确保渲染一致性',
      codeLocation: 'PixelInfoCard.tsx第895行附近'
    });
  }

  console.log('📋 修复建议:');
  suggestions.forEach((suggestion, index) => {
    console.log(`${index + 1}. [${suggestion.priority.toUpperCase()}] ${suggestion.category}`);
    console.log(`   行动: ${suggestion.action}`);
    console.log(`   详情: ${suggestion.details}`);
    console.log(`   位置: ${suggestion.codeLocation}`);
    console.log('');
  });

  return suggestions;
}

// 6. 主检查函数
function runCodeDependencyCheck() {
  console.log('🚀 开始代码依赖关系检查...\n');

  try {
    // 步骤1: 分析App.tsx
    const appAnalysis = analyzeAppTsx();

    // 步骤2: 分析PixelInfoCard.tsx
    const cardAnalysis = analyzePixelInfoCardTsx();

    // 步骤3: 分析状态传递关系
    analyzeStatePassing(appAnalysis, cardAnalysis);

    // 步骤4: 识别潜在的时序问题
    const timingIssues = identifyTimingIssues(appAnalysis);

    // 步骤5: 生成具体的修复建议
    const suggestions = generateFixSuggestions(timingIssues, appAnalysis, cardAnalysis);

    // 步骤6: 输出总结
    console.log('📋 代码依赖关系检查总结:');
    console.log('='.repeat(60));
    console.log(`✅ App.tsx分析: 完成`);
    console.log(`✅ PixelInfoCard.tsx分析: 完成`);
    console.log(`✅ 状态传递关系分析: 完成`);
    console.log(`⚠️ 识别的时序问题: ${timingIssues.length}个`);
    console.log(`💡 生成的修复建议: ${suggestions.length}个`);

    const criticalIssues = timingIssues.filter(issue => issue.severity === 'high');
    if (criticalIssues.length > 0) {
      console.log('\n🚨 关键发现:');
      console.log(`发现了 ${criticalIssues.length} 个高严重性问题，可能是导致像素信息卡片无法显示的根本原因`);
      console.log('建议优先处理这些问题');
    }

  } catch (error) {
    console.error('❌ 代码依赖关系检查过程中发生错误:', error);
  }
}

// 执行检查
runCodeDependencyCheck();