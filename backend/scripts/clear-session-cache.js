#!/usr/bin/env node
/**
 * 清除会话列表Redis缓存
 */

const redisConfig = require('../src/config/redis');
const { db } = require('../src/config/database');

async function clearCache() {
  let redis = null;
  try {
    const userId = process.argv[2] || 'a79a1fbe-0f97-4303-b922-52b35e6948d5';

    console.log(`🗑️  清除用户 ${userId} 的会话缓存...\n`);

    // 初始化Redis
    await redisConfig.initRedis();
    redis = redisConfig.redis;

    if (!redis) {
      console.log('⚠️  Redis未连接，跳过缓存清除');
      console.log('直接测试API调用（会从数据库读取）...\n');
    } else {
      // 1. 清除所有会话列表缓存
      const pattern = `sessions:${userId}:*`;
      console.log('缓存模式:', pattern);

      const keys = await redis.keys(pattern);
      console.log('找到缓存键:', keys.length, '个\n');

      if (keys.length > 0) {
        for (const key of keys) {
          await redis.del(key);
          console.log('  ✅ 已删除:', key);
        }
      } else {
        console.log('  ℹ️  没有找到缓存');
      }

      console.log('\n✅ 缓存已清除！');
    }

    console.log('\n现在测试API调用...\n');

    // 2. 模拟API调用
    const drawingSessionService = require('../src/services/drawingSessionService');
    const result = await drawingSessionService.getUserSessions(userId, {
      page: 1,
      limit: 20,
      status: 'all'
    });

    console.log('📊 API返回结果:');
    console.log('  会话总数:', result.pagination.total);
    console.log('  当前页会话数:', result.sessions.length);
    console.log('');

    result.sessions.forEach((s, i) => {
      const pixelCount = s.metadata?.statistics?.pixelCount || 0;
      console.log(`  ${i+1}. ${s.id.substring(0, 8)}...`);
      console.log(`     - pixels: ${pixelCount}`);
      console.log(`     - status: ${s.status}`);
    });

    console.log('\n✅ 现在iOS app应该能看到会话了！');

  } catch (error) {
    console.error('❌ 失败:', error);
    console.error(error.stack);
  } finally {
    if (redis && redis.quit) await redis.quit();
    await db.destroy();
  }
}

clearCache();
