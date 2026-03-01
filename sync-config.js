#!/usr/bin/env node

/**
 * 配置同步脚本
 * 从根目录 .env 读取配置，自动同步到所有客户端配置文件
 *
 * 使用方法:
 *   node sync-config.js
 *   npm run sync-config
 */

const fs = require('fs');
const path = require('path');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 读取 .env 文件
function loadEnv(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};

  content.split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;

    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      env[key.trim()] = valueParts.join('=').trim();
    }
  });

  return env;
}

// 更新 iOS Info.plist
function updateiOSConfig(env) {
  const plistPath = path.join(__dirname, 'FunnyPixelsApp/FunnyPixelsApp/Info.plist');

  if (!fs.existsSync(plistPath)) {
    log(`⚠️  Info.plist 不存在: ${plistPath}`, 'yellow');
    return false;
  }

  // 备份
  const backupPath = `${plistPath}.backup.${Date.now()}`;
  fs.copyFileSync(plistPath, backupPath);

  let content = fs.readFileSync(plistPath, 'utf8');

  // 替换配置值
  content = content.replace(
    /(<key>DevelopmentServerIP<\/key>\s*<string>)[^<]*(<\/string>)/,
    `$1${env.DEV_SERVER_IP}$2`
  );

  content = content.replace(
    /(<key>DevelopmentServerPort<\/key>\s*<string>)[^<]*(<\/string>)/,
    `$1${env.DEV_SERVER_PORT}$2`
  );

  content = content.replace(
    /(<key>DevelopmentFrontendPort<\/key>\s*<string>)[^<]*(<\/string>)/,
    `$1${env.DEV_FRONTEND_PORT}$2`
  );

  content = content.replace(
    /(<key>ProductionAPIURL<\/key>\s*<string>)[^<]*(<\/string>)/,
    `$1${env.PROD_API_BASE_URL}$2`
  );

  content = content.replace(
    /(<key>ProductionWebURL<\/key>\s*<string>)[^<]*(<\/string>)/,
    `$1${env.PROD_WEB_BASE_URL}$2`
  );

  fs.writeFileSync(plistPath, content, 'utf8');

  log('✅ iOS Info.plist 已更新', 'green');
  log(`   备份: ${backupPath}`, 'cyan');
  return true;
}

// 更新 Backend .env
function updateBackendConfig(env) {
  const envPath = path.join(__dirname, 'backend/.env');

  if (!fs.existsSync(envPath)) {
    log(`⚠️  Backend .env 不存在: ${envPath}`, 'yellow');
    return false;
  }

  // 备份
  const backupPath = `${envPath}.backup.${Date.now()}`;
  fs.copyFileSync(envPath, backupPath);

  let content = fs.readFileSync(envPath, 'utf8');

  // 更新 LOCAL_IP
  if (content.includes('LOCAL_IP=')) {
    content = content.replace(/LOCAL_IP=.*/g, `LOCAL_IP=${env.DEV_SERVER_IP}`);
  } else {
    content += `\n# 开发环境局域网IP（自动同步）\nLOCAL_IP=${env.DEV_SERVER_IP}\n`;
  }

  // 更新 CDN_BASE_URL
  if (content.includes('CDN_BASE_URL=')) {
    content = content.replace(
      /CDN_BASE_URL=.*/g,
      `CDN_BASE_URL=http://${env.DEV_SERVER_IP}:${env.DEV_SERVER_PORT}/uploads`
    );
  }

  fs.writeFileSync(envPath, content, 'utf8');

  log('✅ Backend .env 已更新', 'green');
  log(`   备份: ${backupPath}`, 'cyan');
  return true;
}

// 更新 Frontend .env
function updateFrontendConfig(env) {
  const envPath = path.join(__dirname, 'frontend/.env');

  if (!fs.existsSync(envPath)) {
    log(`⚠️  Frontend .env 不存在: ${envPath}`, 'yellow');
    return false;
  }

  // 备份
  const backupPath = `${envPath}.backup.${Date.now()}`;
  fs.copyFileSync(envPath, backupPath);

  let content = fs.readFileSync(envPath, 'utf8');

  // 更新配置
  const updates = {
    'VITE_API_BASE_URL': env.DEV_API_BASE_URL,
    'VITE_DOUYIN_API_BASE_URL': env.DEV_API_BASE_URL,
    'VITE_WS_URL': env.DEV_WS_URL,
    'VITE_WS_HOST': `${env.DEV_SERVER_IP}:${env.DEV_SERVER_PORT}`,
  };

  for (const [key, value] of Object.entries(updates)) {
    if (content.includes(`${key}=`)) {
      content = content.replace(new RegExp(`${key}=.*`, 'g'), `${key}=${value}`);
    } else {
      content += `\n${key}=${value}\n`;
    }
  }

  fs.writeFileSync(envPath, content, 'utf8');

  log('✅ Frontend .env 已更新', 'green');
  log(`   备份: ${backupPath}`, 'cyan');
  return true;
}

// 主函数
function main() {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  log('🔄 开始同步配置...', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'cyan');

  // 读取根目录 .env
  const rootEnvPath = path.join(__dirname, '.env');
  if (!fs.existsSync(rootEnvPath)) {
    log('❌ 错误: 根目录 .env 文件不存在', 'red');
    process.exit(1);
  }

  log('📖 读取根目录配置: .env', 'blue');
  const env = loadEnv(rootEnvPath);

  // 验证必需的配置
  const required = [
    'DEV_SERVER_IP',
    'DEV_SERVER_PORT',
    'DEV_FRONTEND_PORT',
    'PROD_API_BASE_URL',
    'PROD_WEB_BASE_URL',
  ];

  const missing = required.filter(key => !env[key]);
  if (missing.length > 0) {
    log(`❌ 错误: 缺少必需配置: ${missing.join(', ')}`, 'red');
    process.exit(1);
  }

  log('\n📋 当前配置:', 'blue');
  log(`   开发环境 IP: ${env.DEV_SERVER_IP}:${env.DEV_SERVER_PORT}`, 'cyan');
  log(`   前端端口: ${env.DEV_FRONTEND_PORT}`, 'cyan');
  log(`   生产 API: ${env.PROD_API_BASE_URL}`, 'cyan');
  log(`   生产 Web: ${env.PROD_WEB_BASE_URL}`, 'cyan');

  log('\n🔧 同步配置到各个客户端...\n', 'blue');

  // 同步到各个客户端
  const results = {
    ios: updateiOSConfig(env),
    backend: updateBackendConfig(env),
    frontend: updateFrontendConfig(env),
  };

  // 总结
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  const successCount = Object.values(results).filter(Boolean).length;
  const totalCount = Object.keys(results).length;

  if (successCount === totalCount) {
    log('✅ 配置同步完成！', 'green');
  } else {
    log(`⚠️  配置同步部分完成 (${successCount}/${totalCount})`, 'yellow');
  }
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'cyan');

  log('📋 后续操作:', 'yellow');
  log('   1. iOS App: 在 Xcode 中 Clean Build (⇧⌘K) 然后重新编译', 'yellow');
  log('   2. Backend: 重启服务 (npm run dev)', 'yellow');
  log('   3. Frontend: 重启服务 (npm run dev)', 'yellow');
  log('\n💾 所有配置文件已自动备份（后缀 .backup.时间戳）\n', 'cyan');
}

// 运行
try {
  main();
} catch (error) {
  log(`\n❌ 错误: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
}
