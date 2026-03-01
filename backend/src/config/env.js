/**
 * 统一环境配置加载模块
 * 根据 NODE_ENV 自动选择配置文件
 */

const path = require('path');

function loadEnvConfig() {
  const env = process.env.NODE_ENV || 'development';

  console.log(`🔧 加载环境配置: ${env}`);

  if (env === 'production') {
    // 生产环境：优先使用系统环境变量
    console.log('📋 生产环境：使用系统环境变量');

    // 检查是否存在 .env.production 文件
    const fs = require('fs');
    const envProductionPath = path.join(process.cwd(), '.env.production');

    if (fs.existsSync(envProductionPath)) {
      console.log('📋 发现 .env.production 文件，作为 fallback 加载');
      require('dotenv').config({path: '.env.production'});
      console.log('✅ 已加载 .env.production 作为 fallback');
    } else {
      console.log('ℹ️ 未找到 .env.production 文件，仅使用系统环境变量');
      console.log('💡 提示：在生产环境中，建议通过平台设置环境变量');
    }
  } else {
    // 开发环境：尝试多个 .env 文件位置
    console.log('📋 开发环境：加载 .env 文件');

    const fs = require('fs');
    const currentDirEnv = path.join(process.cwd(), '.env');
    const parentDirEnv = path.join(process.cwd(), '../.env');

    // 先加载当前目录的 .env（如果存在）
    if (fs.existsSync(currentDirEnv)) {
      console.log('📋 发现当前目录的 .env 文件，加载它');
      require('dotenv').config({path: '.env'});
    }

    // 然后尝试父目录的 .env（会覆盖当前目录的值）
    if (fs.existsSync(parentDirEnv)) {
      console.log('📋 发现父目录的 .env 文件，加载它（会覆盖当前目录的配置）');
      require('dotenv').config({path: '../.env'});
    }

    // 检查关键变量是否已配置
    if (!process.env.AMAP_API_KEY) {
      console.log('⚠️ AMAP_API_KEY 未配置');
    } else {
      console.log('✅ AMAP_API_KEY 已配置');
    }
  }

  // 验证关键环境变量
  validateEnvVars();
}

function validateEnvVars() {
  const requiredVars = [
    'NODE_ENV',
    'DB_HOST',
    'DB_USER',
    'DB_PASSWORD',
    'DB_NAME',
    'JWT_SECRET'
  ];

  // 在生产环境中，验证 Redis 配置（本地 Redis 或 Upstash 二选一）
  if (process.env.NODE_ENV === 'production') {
    const hasLocalRedis = process.env.REDIS_HOST;
    const hasUpstash = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!hasLocalRedis && !hasUpstash) {
      console.warn('⚠️ 生产环境需要配置 REDIS_HOST 或 UPSTASH_REDIS_REST_URL+TOKEN');
    }
  }
  
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.warn(`⚠️ 缺少环境变量: ${missing.join(', ')}`);
  } else {
    console.log('✅ 所有必需的环境变量已配置');
  }
}

// 导出配置信息
function getEnvInfo() {
  return {
    NODE_ENV: process.env.NODE_ENV || 'development',
    DB_HOST: process.env.DB_HOST,
    DB_PORT: process.env.DB_PORT || 5432,
    REDIS_HOST: process.env.REDIS_HOST,
    REDIS_PORT: process.env.REDIS_PORT || 6379,
    PORT: process.env.PORT || 3001,
    LOCAL_VALIDATION: process.env.LOCAL_VALIDATION === 'true'
  };
}

module.exports = {
  loadEnvConfig,
  validateEnvVars,
  getEnvInfo
};
