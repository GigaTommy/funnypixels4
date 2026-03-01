/**
 * 清空排行榜缓存
 *
 * 用途：当排行榜 API 数据结构变更后，需要清空缓存以返回新格式数据
 */

const redis = require('redis');
const logger = require('./src/utils/logger');

async function clearLeaderboardCache() {
  let client = null;
  try {
    console.log('🧹 开始清空排行榜缓存...');

    // 创建 Redis 客户端
    const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = process.env.REDIS_PORT || 6379;
    const redisPassword = process.env.REDIS_PASSWORD || process.env.UPSTASH_REDIS_REST_TOKEN;

    if (redisUrl) {
      client = redis.createClient({ url: redisUrl, password: redisPassword });
    } else {
      client = redis.createClient({
        socket: { host: redisHost, port: parseInt(redisPort) },
        password: redisPassword
      });
    }

    await client.connect();
    console.log('✅ Redis 连接成功');

    // 获取所有排行榜相关的键
    const keys = await client.keys('leaderboard:*');
    const cityKeys = await client.keys('region:leaderboard:*');
    const allKeys = [...keys, ...cityKeys];

    if (allKeys.length === 0) {
      console.log('✅ 没有找到排行榜缓存');
      await client.quit();
      process.exit(0);
    }

    console.log(`📋 找到 ${allKeys.length} 个缓存键:`);
    allKeys.forEach(key => console.log(`  - ${key}`));

    // 删除所有键
    const results = await Promise.all(allKeys.map(key => client.del(key)));
    const deletedCount = results.reduce((sum, count) => sum + count, 0);

    console.log(`✅ 已删除 ${deletedCount} 个缓存键`);

    await client.quit();
    process.exit(0);
  } catch (error) {
    console.error('❌ 清空缓存失败:', error);
    if (client) {
      await client.quit();
    }
    process.exit(1);
  }
}

clearLeaderboardCache();
