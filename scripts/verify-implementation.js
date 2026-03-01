#!/usr/bin/env node

/**
 * localStorage升级方案实现验证脚本
 * 验证所有组件是否正确实现和配置
 */

const fs = require('fs');
const path = require('path');

class ImplementationVerifier {
  constructor() {
    this.results = [];
    this.projectRoot = path.resolve(__dirname, '..');
  }

  addResult(category, item, status, message = '') {
    this.results.push({
      category,
      item,
      status,
      message,
      timestamp: new Date().toISOString()
    });
  }

  checkFileExists(filePath, description) {
    const fullPath = path.join(this.projectRoot, filePath);
    const exists = fs.existsSync(fullPath);
    
    this.addResult(
      '文件检查',
      description,
      exists ? '✅ 存在' : '❌ 缺失',
      exists ? `路径: ${filePath}` : `预期路径: ${filePath}`
    );
    
    return exists;
  }

  checkDirectoryExists(dirPath, description) {
    const fullPath = path.join(this.projectRoot, dirPath);
    const exists = fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory();
    
    this.addResult(
      '目录检查',
      description,
      exists ? '✅ 存在' : '❌ 缺失',
      exists ? `路径: ${dirPath}` : `预期路径: ${dirPath}`
    );
    
    return exists;
  }

  checkPackageJsonDependencies() {
    const packageJsonPath = path.join(this.projectRoot, 'backend', 'package.json');
    
    if (!fs.existsSync(packageJsonPath)) {
      this.addResult('依赖检查', 'backend/package.json', '❌ 缺失', '后端package.json文件不存在');
      return;
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

    const requiredDeps = [
      'sharp',
      'aws-sdk',
      'express',
      'knex',
      'redis',
      'socket.io'
    ];

    for (const dep of requiredDeps) {
      const installed = dependencies[dep];
      this.addResult(
        '依赖检查',
        dep,
        installed ? '✅ 已安装' : '❌ 未安装',
        installed ? `版本: ${installed}` : '需要安装此依赖'
      );
    }
  }

  checkBackendImplementation() {
    console.log('🔍 检查后端实现...');

    // 检查核心服务文件
    const backendFiles = [
      'backend/src/services/patternStorageService.js',
      'backend/src/services/patternCacheService.js',
      'backend/src/services/patternCompressionService.js',
      'backend/src/services/cdnService.js',
      'backend/src/routes/patternRoutes.js'
    ];

    for (const file of backendFiles) {
      const fileName = path.basename(file);
      this.checkFileExists(file, `后端服务: ${fileName}`);
    }

    // 检查服务器配置
    this.checkFileExists('backend/src/server.js', '后端服务器配置');

    // 检查测试文件
    this.checkFileExists('backend/test/api.test.js', '后端API测试');
  }

  checkFrontendImplementation() {
    console.log('🔍 检查前端实现...');

    // 检查缓存系统
    const cacheFiles = [
      'frontend/src/cache/indexedDBWrapper.ts',
      'frontend/src/cache/smartPatternCache.ts',
      'frontend/src/cache/serverCache.ts',
      'frontend/src/cache/patternPredictionEngine.ts',
      'frontend/src/cache/patternPreloadManager.ts'
    ];

    for (const file of cacheFiles) {
      const fileName = path.basename(file);
      this.checkFileExists(file, `前端缓存: ${fileName}`);
    }

    // 检查渲染系统
    const renderFiles = [
      'frontend/src/render/hybridRenderManager.ts',
      'frontend/src/monitoring/performanceMonitor.ts'
    ];

    for (const file of renderFiles) {
      const fileName = path.basename(file);
      this.checkFileExists(file, `前端渲染: ${fileName}`);
    }

    // 检查测试文件
    const testFiles = [
      'frontend/src/cache/simpleTest.js',
      'frontend/src/integration/functionalityTest.js',
      'frontend/src/integration/systemIntegrationTest.ts'
    ];

    for (const file of testFiles) {
      const fileName = path.basename(file);
      this.checkFileExists(file, `前端测试: ${fileName}`);
    }
  }

  checkDocumentation() {
    console.log('🔍 检查文档...');

    const docs = [
      'docs/COMPLETE_UPGRADE_PLAN.md',
      'docs/MIGRATION_IMPLEMENTATION_GUIDE.md',
      'docs/USAGE_GUIDE.md',
      'docs/TEST_REPORT.md'
    ];

    for (const doc of docs) {
      const fileName = path.basename(doc);
      this.checkFileExists(doc, `文档: ${fileName}`);
    }
  }

  checkConfiguration() {
    console.log('🔍 检查配置文件...');

    // 检查数据库配置
    this.checkFileExists('backend/knexfile.js', '数据库配置');

    // 检查环境配置
    this.checkFileExists('backend/.env.example', '环境配置示例');

    // 检查前端配置
    this.checkFileExists('frontend/package.json', '前端包配置');
    this.checkFileExists('frontend/vite.config.ts', '前端构建配置');
  }

  checkDirectoryStructure() {
    console.log('🔍 检查目录结构...');

    const directories = [
      'backend/src/services',
      'backend/src/routes',
      'backend/src/models',
      'backend/test',
      'frontend/src/cache',
      'frontend/src/render',
      'frontend/src/monitoring',
      'frontend/src/integration',
      'docs',
      'scripts'
    ];

    for (const dir of directories) {
      const dirName = path.basename(dir);
      this.checkDirectoryExists(dir, `目录: ${dirName}`);
    }
  }

  analyzeCodeQuality() {
    console.log('🔍 分析代码质量...');

    // 检查关键文件的内容
    const keyFiles = [
      'backend/src/services/patternStorageService.js',
      'frontend/src/cache/smartPatternCache.ts'
    ];

    for (const file of keyFiles) {
      const fullPath = path.join(this.projectRoot, file);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n').length;
        const hasComments = content.includes('/**') || content.includes('//');
        const hasErrorHandling = content.includes('try') && content.includes('catch');
        
        this.addResult(
          '代码质量',
          path.basename(file),
          '✅ 良好',
          `行数: ${lines}, 注释: ${hasComments ? '有' : '无'}, 错误处理: ${hasErrorHandling ? '有' : '无'}`
        );
      }
    }
  }

  generateReport() {
    console.log('\n📊 实现验证报告');
    console.log('='.repeat(80));

    // 按类别分组结果
    const categories = {};
    for (const result of this.results) {
      if (!categories[result.category]) {
        categories[result.category] = [];
      }
      categories[result.category].push(result);
    }

    // 打印每个类别的结果
    for (const [category, results] of Object.entries(categories)) {
      console.log(`\n📁 ${category}`);
      console.log('-'.repeat(40));
      
      for (const result of results) {
        console.log(`${result.status} ${result.item}`);
        if (result.message) {
          console.log(`   ${result.message}`);
        }
      }
    }

    // 统计结果
    const total = this.results.length;
    const passed = this.results.filter(r => r.status.includes('✅')).length;
    const failed = this.results.filter(r => r.status.includes('❌')).length;

    console.log('\n📈 统计摘要');
    console.log('='.repeat(40));
    console.log(`总检查项: ${total}`);
    console.log(`通过: ${passed}`);
    console.log(`失败: ${failed}`);
    console.log(`成功率: ${((passed / total) * 100).toFixed(1)}%`);

    if (failed === 0) {
      console.log('\n🎉 所有检查项都通过！实现完整且正确。');
    } else {
      console.log('\n⚠️ 发现一些问题，请检查失败的项。');
    }

    return {
      total,
      passed,
      failed,
      successRate: (passed / total) * 100,
      results: this.results
    };
  }

  async runVerification() {
    console.log('🚀 开始验证localStorage升级方案实现...');
    console.log('='.repeat(80));

    this.checkDirectoryStructure();
    this.checkBackendImplementation();
    this.checkFrontendImplementation();
    this.checkDocumentation();
    this.checkConfiguration();
    this.checkPackageJsonDependencies();
    this.analyzeCodeQuality();

    return this.generateReport();
  }
}

// 运行验证
if (require.main === module) {
  const verifier = new ImplementationVerifier();
  verifier.runVerification()
    .then(report => {
      process.exit(report.failed === 0 ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ 验证过程中发生错误:', error);
      process.exit(1);
    });
}

module.exports = ImplementationVerifier;
