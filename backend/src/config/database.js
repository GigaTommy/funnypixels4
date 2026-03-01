const knex = require('knex');
const knexfile = require('../../knexfile');

// 检查环境变量
const isLocalValidation = process.env.LOCAL_VALIDATION === 'true';
const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const redisHost = process.env.REDIS_HOST;

console.log('🔧 运行模式:', isLocalValidation ? '本地验证模式' : '远程服务模式');

if (isLocalValidation) {
  console.log('🔧 本地验证模式 - 使用本地Docker数据库进行迁移验证');
  console.log('🔧 请确保已运行: docker-compose up -d postgres redis');
} else {
  // 远程模式检查Redis配置
  // 优先检查是否有本地 Redis 配置
  const hasLocalRedis = redisHost && redisHost !== 'your_redis_host';
  const hasUpstashRedis = upstashUrl && upstashToken && upstashUrl !== 'your_upstash_redis_url';

  if (!hasLocalRedis && !hasUpstashRedis) {
    console.error('❌ 错误: 未找到有效的 Redis 配置');
    console.error('请设置以下环境变量之一:');
    console.error('1. 本地 Redis: REDIS_HOST (可选 REDIS_PORT)');
    console.error('2. Upstash Redis: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN');
    console.error('或者设置 LOCAL_VALIDATION=true 使用本地验证模式');
    process.exit(1);
  }

  if (hasLocalRedis) {
    console.log('🔧 使用本地 Redis:', redisHost);
  } else if (hasUpstashRedis) {
    console.log('🔧 使用 Upstash Redis');
  }
}

// 使用 knexfile.js 的配置
const environment = isLocalValidation ? 'development' : (process.env.NODE_ENV || 'production');
const dbConfig = knexfile[environment];

console.log('🔧 数据库配置:', {
  environment,
  client: dbConfig.client,
  host: dbConfig.connection.host,
  database: dbConfig.connection.database,
  user: dbConfig.connection.user,
  ssl: dbConfig.connection.ssl ? '已配置' : '未配置'
});

// 创建 Knex 实例
const db = knex(dbConfig);

// 使用统一的Redis配置（使用getter函数避免解构缓存null值）
const redisConfig = require('./redis');

// 🔧 连接池监控（每10秒输出一次状态）
// 设置 DB_POOL_MONITOR=verbose 可强制输出所有日志（用于压测）
const poolMonitorVerbose = process.env.DB_POOL_MONITOR === 'verbose';
const poolMonitorInterval = setInterval(() => {
  try {
    const pool = db.client.pool;
    if (pool) {
      const used = pool.numUsed();
      const free = pool.numFree();
      const pending = pool.numPendingAcquires();
      const total = used + free;
      if (poolMonitorVerbose || pending > 0 || used > total * 0.5) {
        console.log(`[DB Pool] size=${total} used=${used} free=${free} pending=${pending}`);
      }
    }
  } catch (e) {
    // Silently ignore if pool is not yet initialized
  }
}, 10000);
// Don't prevent process exit
if (poolMonitorInterval.unref) poolMonitorInterval.unref();

// 测试数据库连接
async function testDatabaseConnection() {
  try {
    console.log('🔌 测试数据库连接...');
    const result = await db.raw('SELECT 1 as test');
    console.log('✅ 数据库连接成功:', result.rows[0]);
    return true;
  } catch (error) {
    console.error('❌ 数据库连接失败:', error.message);
    if (isLocalValidation) {
      console.error('💡 请确保本地Docker数据库已启动: docker-compose up -d postgres');
    }
    return false;
  }
}

// 测试 Redis 连接
async function testRedisConnection() {
  try {
    if (isLocalValidation) {
      console.log('✅ 本地验证模式 - Redis模拟成功');
      return true;
    }

    // 使用getter函数动态获取Redis客户端
    const redis = redisConfig.getRedis();

    // 检查 Redis 是否已初始化
    if (!redis) {
      console.warn('⚠️ Redis 未初始化，跳过连接测试');
      console.warn('💡 提示：Redis会在server.js启动时初始化');
      return true; // 改为true，不阻塞启动
    }

    console.log('🔌 测试 Redis 连接...');
    await redis.set('test_connection', 'success');
    const result = await redis.get('test_connection');
    console.log('✅ Redis 连接成功:', result);
    await redis.del('test_connection');
    return true;
  } catch (error) {
    console.error('❌ Redis 连接失败:', error.message);
    return true; // 不阻塞启动
  }
}

// 验证数据库表结构
async function validateDatabaseSchema() {
  try {
    console.log('🔍 验证数据库表结构...');
    
    // 检查是否存在关键表
    const tables = await db.raw(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('📋 当前数据库表:', tables.rows.map(row => row.table_name));
    
    // 检查关键表是否存在
    const requiredTables = ['users', 'patterns', 'pixels', 'sessions'];
    const existingTables = tables.rows.map(row => row.table_name);
    
    const missingTables = requiredTables.filter(table => !existingTables.includes(table));
    
    if (missingTables.length > 0) {
      console.log('⚠️  缺少关键表:', missingTables);
      console.log('💡 建议运行数据库迁移: npm run migrate');
    } else {
      console.log('✅ 所有关键表都存在');
    }
    
    return true;
  } catch (error) {
    console.error('❌ 表结构验证失败:', error.message);
    return false;
  }
}

// 初始化连接测试
async function initializeConnections() {
  const dbConnected = await testDatabaseConnection();
  const redisConnected = await testRedisConnection();
  
  if (dbConnected && redisConnected) {
    console.log('✅ 所有服务连接成功');
    
    if (isLocalValidation) {
      await validateDatabaseSchema();
    }
  } else {
    console.error('❌ 服务连接失败');
    if (isLocalValidation) {
      process.exit(1);
    }
  }
}

// 立即执行连接测试
initializeConnections();

module.exports = {
  db,
  // 使用getter动态返回Redis客户端
  get redis() {
    return redisConfig.getRedis();
  },
  get redisUtils() {
    return redisConfig.redisUtils;
  }
};

console.log('Database config loaded successfully');

