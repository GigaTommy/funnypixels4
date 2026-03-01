#!/usr/bin/env node

/**
 * 后端环境变量修复脚本
 *
 * 解决后端服务无法正确加载.env文件的问题
 */

const path = require('path');
const fs = require('fs');

console.log('🔧 后端环境变量修复工具');
console.log('='.repeat(50));

function checkEnvFiles() {
  console.log('\n📁 检查环境变量文件位置:');

  const locations = [
    { path: '.env', description: '项目根目录' },
    { path: 'backend/.env', description: 'backend目录' },
    { path: './.env', description: '当前目录' },
    { path: './backend/.env', description: '相对路径backend目录' }
  ];

  const foundFiles = [];

  locations.forEach(location => {
    const fullPath = path.resolve(location.path);
    if (fs.existsSync(fullPath)) {
      foundFiles.push({ ...location, fullPath });
      console.log(`✅ 找到: ${location.description} -> ${fullPath}`);
    } else {
      console.log(`❌ 未找到: ${location.description} -> ${fullPath}`);
    }
  });

  return foundFiles;
}

function createRootEnvFile() {
  console.log('\n🔧 创建根目录.env文件...');

  const backendEnvPath = path.resolve('backend/.env');
  const rootEnvPath = path.resolve('.env');

  if (!fs.existsSync(backendEnvPath)) {
    console.log('❌ backend/.env文件不存在');
    return false;
  }

  try {
    // 读取backend/.env文件
    const backendEnvContent = fs.readFileSync(backendEnvPath, 'utf8');

    // 写入根目录.env文件
    fs.writeFileSync(rootEnvPath, backendEnvContent);

    console.log('✅ 已将backend/.env复制到根目录.env');
    console.log(`   源文件: ${backendEnvPath}`);
    console.log(`   目标文件: ${rootEnvPath}`);

    return true;
  } catch (error) {
    console.log('❌ 复制.env文件失败:', error.message);
    return false;
  }
}

function testBackendWithCorrectEnv() {
  console.log('\n🧪 测试后端环境变量加载...');

  try {
    // 切换到项目根目录
    const originalCwd = process.cwd();
    process.chdir(path.resolve(__dirname, '../..'));

    // 临时设置环境变量
    process.env.NODE_ENV = 'development';

    // 加载环境配置
    const { loadEnvConfig, getEnvInfo } = require('./backend/src/config/env');
    loadEnvConfig();

    const envInfo = getEnvInfo();

    console.log('✅ 环境变量加载成功:');
    console.log(`   NODE_ENV: ${envInfo.NODE_ENV}`);
    console.log(`   DB_HOST: ${envInfo.DB_HOST}`);
    console.log(`   DB_PORT: ${envInfo.DB_PORT}`);
    console.log(`   LOCAL_VALIDATION: ${envInfo.LOCAL_VALIDATION}`);

    // 测试数据库连接
    const { db } = require('./backend/src/config/database');

    console.log('📡 测试数据库连接...');
    return db.raw('SELECT 1 as test')
      .then(result => {
        console.log('✅ 数据库连接测试成功');
        console.log(`   测试结果: ${result.rows[0].test}`);
        return true;
      })
      .catch(error => {
        console.log('❌ 数据库连接测试失败:', error.message);
        return false;
      })
      .finally(() => {
        // 恢复原始工作目录
        process.chdir(originalCwd);
      });

  } catch (error) {
    console.log('❌ 环境变量测试失败:', error.message);
    return Promise.resolve(false);
  }
}

function provideRestartInstructions() {
  console.log('\n🔄 后端服务重启说明:');
  console.log('='.repeat(50));

  console.log('\n要使修复生效，需要重启后端服务:');
  console.log('\n方法1: 如果在开发模式下运行');
  console.log('   1. 找到后端服务进程 (PID: 2232)');
  console.log('   2. 停止服务: taskkill /PID 2232 /F');
  console.log('   3. 重新启动: cd backend && npm start');

  console.log('\n方法2: 如果使用PM2管理');
  console.log('   pm2 restart backend');

  console.log('\n方法3: 如果在IDE中运行');
  console.log('   1. 停止当前运行的服务');
  console.log('   2. 重新启动');

  console.log('\n验证修复:');
  console.log('   1. 等待服务启动完成');
  console.log('   2. 运行: node scripts/test/apiEndpointDiagnostic.js');
  console.log('   3. 检查API是否正常响应');
}

async function runFix() {
  console.log('开始修复后端环境变量问题...\n');

  // 1. 检查现有的.env文件
  const foundFiles = checkEnvFiles();

  if (foundFiles.length === 0) {
    console.log('❌ 未找到任何.env文件');
    console.log('请确保backend/.env文件存在');
    return;
  }

  // 2. 如果根目录没有.env文件，创建一个
  const rootEnvExists = foundFiles.some(f => f.path === '.env');
  if (!rootEnvExists) {
    console.log('\n⚠️  根目录缺少.env文件');
    const success = createRootEnvFile();
    if (!success) {
      console.log('❌ 无法创建根目录.env文件');
      return;
    }
  }

  // 3. 测试修复后的环境变量
  const testSuccess = await testBackendWithCorrectEnv();

  if (testSuccess) {
    console.log('\n✅ 环境变量修复成功！');
    provideRestartInstructions();
  } else {
    console.log('\n❌ 环境变量修复失败');
    console.log('请手动检查环境变量配置');
  }
}

// 执行修复
if (require.main === module) {
  runFix()
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      console.error('修复脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = { runFix };