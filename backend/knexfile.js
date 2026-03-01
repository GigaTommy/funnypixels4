// 统一环境配置加载
const { loadEnvConfig } = require('./src/config/env');
loadEnvConfig();
const path = require('path');

// 检查是否为本地验证模式
const isLocalValidation = process.env.LOCAL_VALIDATION === 'true';

// Cluster mode: divide pool across workers to keep total DB connections bounded
const clusterWorkers = parseInt(process.env.CLUSTER_WORKERS || '1');

module.exports = {
  development: {
    client: 'postgresql',
    connection: {
      // 开发环境始终使用本地Docker数据库
      host: 'localhost',
      port: 5432,
      user: 'postgres',
      password: 'password',
      database: 'funnypixels_postgres'
    },
    migrations: {
      directory: path.join(__dirname, 'src/database/migrations')
    },
    seeds: {
      directory: path.join(__dirname, 'src/database/seeds')
    },
    pool: {
      min: parseInt(process.env.DB_POOL_MIN || '5'),
      max: Math.floor(parseInt(process.env.DB_POOL_MAX || '50') / clusterWorkers),
      acquireTimeoutMillis: 5000,
      createTimeoutMillis: 5000,
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200
    }
  },

  production: {
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    },
    migrations: {
      directory: path.join(__dirname, 'src/database/migrations')
    },
    seeds: {
      directory: path.join(__dirname, 'src/database/seeds')
    },
    pool: {
      // 🚀 性能优化：提高连接池大小以支持高并发
      // 计算依据：2000 req/min ÷ 60 = 33.3 req/s
      // 假设平均查询时间500ms-1s，需要约33-66个连接
      // 建议配置：min=10, max=75-100
      min: parseInt(process.env.DB_POOL_MIN || 10),
      max: Math.floor(parseInt(process.env.DB_POOL_MAX || 75) / clusterWorkers),

      // 🔒 超时配置：防止连接池耗尽时无限等待
      acquireTimeoutMillis: parseInt(process.env.DB_ACQUIRE_TIMEOUT || 5000), // 5秒超时
      createTimeoutMillis: parseInt(process.env.DB_CREATE_TIMEOUT || 3000),   // 3秒创建超时
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || 30000),      // 30秒空闲回收
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200,
      propagateCreateError: false  // Don't fail on pool creation errors
    }
  }
};
