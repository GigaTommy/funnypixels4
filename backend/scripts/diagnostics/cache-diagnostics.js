/**
 * MVT缓存性能诊断工具
 *
 * 功能：
 * 1. 检测Redis连接状态
 * 2. 分析缓存命中率
 * 3. 测试LRU缓存效率
 * 4. 评估缓存键分布
 * 5. 生成缓存优化建议
 */

const { initializeRedis, getRedis } = require('../../src/config/redis');
const productionMVTService = require('../../src/services/productionMVTService');
const logger = require('../../src/utils/logger');

let redis = null; // Will be initialized in main function

/**
 * 检查Redis连接状态
 */
async function checkRedisConnection() {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔌 Redis连接检查`);
  console.log(`${'='.repeat(80)}`);

  if (!redis) {
    console.log(`   ❌ Redis未配置或未连接`);
    console.log(`   建议: 配置Redis以启用分布式缓存`);
    return { connected: false };
  }

  try {
    const pong = await redis.ping();
    console.log(`   ✅ Redis连接正常 (${pong})`);

    // 获取Redis信息
    const info = await redis.info('stats');
    const lines = info.split('\n');
    const stats = {};
    lines.forEach(line => {
      const [key, value] = line.split(':');
      if (key && value) {
        stats[key.trim()] = value.trim();
      }
    });

    console.log(`\n📊 Redis统计:`);
    console.log(`   总连接数: ${stats.total_connections_received || 'N/A'}`);
    console.log(`   总命令数: ${stats.total_commands_processed || 'N/A'}`);
    console.log(`   命中次数: ${stats.keyspace_hits || 'N/A'}`);
    console.log(`   未命中次数: ${stats.keyspace_misses || 'N/A'}`);

    const hits = parseInt(stats.keyspace_hits || 0);
    const misses = parseInt(stats.keyspace_misses || 0);
    const hitRate = hits + misses > 0 ? (hits / (hits + misses) * 100) : 0;
    console.log(`   命中率: ${hitRate.toFixed(2)}%`);

    return {
      connected: true,
      stats,
      hitRate
    };

  } catch (error) {
    console.log(`   ❌ Redis连接失败: ${error.message}`);
    return { connected: false, error: error.message };
  }
}

/**
 * 检查MVT缓存键分布
 */
async function analyzeCacheKeys() {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔑 MVT缓存键分布分析`);
  console.log(`${'='.repeat(80)}`);

  if (!redis) {
    console.log(`   ⚠️  跳过（Redis未连接）`);
    return null;
  }

  try {
    // 扫描所有MVT缓存键
    const keys = [];
    let cursor = '0';

    do {
      const result = await redis.scan(cursor, 'MATCH', 'mvt:v2:*', 'COUNT', 1000);
      cursor = result[0];
      keys.push(...result[1]);
    } while (cursor !== '0' && keys.length < 10000); // 最多扫描1万个键

    console.log(`\n📊 缓存键统计:`);
    console.log(`   总键数: ${keys.length}`);

    // 按zoom级别分组
    const zoomDistribution = {};
    keys.forEach(key => {
      const match = key.match(/mvt:v2:(\d+)\//);
      if (match) {
        const zoom = match[1];
        zoomDistribution[zoom] = (zoomDistribution[zoom] || 0) + 1;
      }
    });

    console.log(`\n📈 按Zoom级别分布:`);
    Object.entries(zoomDistribution)
      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
      .forEach(([zoom, count]) => {
        const percentage = (count / keys.length * 100).toFixed(1);
        console.log(`   Zoom ${zoom}: ${count} tiles (${percentage}%)`);
      });

    // 检查tile大小分布
    console.log(`\n📦 采样检查tile大小 (前20个):`);
    for (let i = 0; i < Math.min(20, keys.length); i++) {
      const value = await redis.get(keys[i]);
      if (value) {
        const size = Buffer.from(value, 'base64').length;
        const sizeKB = (size / 1024).toFixed(2);
        console.log(`   ${keys[i]}: ${sizeKB} KB`);
      }
    }

    return {
      totalKeys: keys.length,
      zoomDistribution
    };

  } catch (error) {
    console.log(`   ❌ 分析失败: ${error.message}`);
    return null;
  }
}

/**
 * 测试缓存性能
 */
async function testCachePerformance() {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`⚡ 缓存性能测试`);
  console.log(`${'='.repeat(80)}`);

  const testTiles = [
    { z: 16, x: 53398, y: 28442, name: '广州塔' },
    { z: 16, x: 53957, y: 24832, name: '天安门' },
    { z: 12, x: 3337, y: 1777, name: '广州-Z12' }
  ];

  for (const tile of testTiles) {
    console.log(`\n📍 测试tile: ${tile.name} (${tile.z}/${tile.x}/${tile.y})`);

    // 清除该tile的缓存
    try {
      await productionMVTService.invalidateTile(tile.z, tile.x, tile.y);
      console.log(`   已清除缓存`);
    } catch (error) {
      console.log(`   ⚠️  无法清除缓存: ${error.message}`);
    }

    // 第一次请求（冷缓存）
    const cold1 = Date.now();
    try {
      await productionMVTService.getTile(tile.z, tile.x, tile.y, 'br');
      const coldTime = Date.now() - cold1;
      console.log(`   冷缓存: ${coldTime}ms`);

      // 第二次请求（热缓存）
      const hot1 = Date.now();
      await productionMVTService.getTile(tile.z, tile.x, tile.y, 'br');
      const hotTime = Date.now() - hot1;
      console.log(`   热缓存: ${hotTime}ms`);

      const speedup = (coldTime / hotTime).toFixed(1);
      console.log(`   加速比: ${speedup}x`);

      // 连续请求测试
      const iterations = 10;
      const times = [];
      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await productionMVTService.getTile(tile.z, tile.x, tile.y, 'br');
        times.push(Date.now() - start);
      }

      const avgTime = (times.reduce((a, b) => a + b, 0) / times.length).toFixed(2);
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);

      console.log(`   连续${iterations}次请求: min=${minTime}ms, avg=${avgTime}ms, max=${maxTime}ms`);

    } catch (error) {
      console.log(`   ❌ 测试失败: ${error.message}`);
    }
  }
}

/**
 * 分析LRU缓存状态
 */
function analyzeLRUCache() {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`💾 LRU缓存状态分析`);
  console.log(`${'='.repeat(80)}`);

  try {
    const stats = productionMVTService.getCacheStats();

    console.log(`\n📊 Raw Cache (内存):`);
    console.log(`   当前大小: ${stats.raw.size} tiles`);
    console.log(`   占用空间: ${(stats.raw.calculatedSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   最大空间: ${(stats.raw.maxSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   使用率: ${((stats.raw.calculatedSize / stats.raw.maxSize) * 100).toFixed(1)}%`);

    console.log(`\n📊 Compressed Cache (压缩):`);
    console.log(`   当前大小: ${stats.compressed.size} tiles`);
    console.log(`   占用空间: ${(stats.compressed.calculatedSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   最大空间: ${(stats.compressed.maxSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   使用率: ${((stats.compressed.calculatedSize / stats.compressed.maxSize) * 100).toFixed(1)}%`);

    // 评估缓存配置
    console.log(`\n💡 缓存配置建议:`);

    if (stats.raw.calculatedSize / stats.raw.maxSize > 0.8) {
      console.log(`   ⚠️  Raw cache使用率超过80%，建议增加maxSize`);
    } else {
      console.log(`   ✅ Raw cache大小合理`);
    }

    if (stats.compressed.calculatedSize / stats.compressed.maxSize > 0.8) {
      console.log(`   ⚠️  Compressed cache使用率超过80%，建议增加maxSize`);
    } else {
      console.log(`   ✅ Compressed cache大小合理`);
    }

    return stats;

  } catch (error) {
    console.log(`   ❌ 分析失败: ${error.message}`);
    return null;
  }
}

/**
 * 生成缓存优化建议
 */
function generateCacheRecommendations(redisInfo, lruStats) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`💡 缓存优化建议`);
  console.log(`${'='.repeat(80)}`);

  const recommendations = [];

  // Redis相关建议
  if (!redisInfo.connected) {
    recommendations.push({
      priority: 'HIGH',
      title: '启用Redis缓存',
      description: 'Redis未连接，建议配置Redis以启用分布式缓存',
      impact: '缓存命中率提升50-80%'
    });
  } else if (redisInfo.hitRate < 80) {
    recommendations.push({
      priority: 'MEDIUM',
      title: '提升Redis命中率',
      description: `当前命中率${redisInfo.hitRate.toFixed(1)}%，建议增加缓存TTL或预热热门tile`,
      impact: '用户体验提升20-40%'
    });
  }

  // LRU缓存相关建议
  if (lruStats) {
    if (lruStats.raw.calculatedSize / lruStats.raw.maxSize > 0.9) {
      recommendations.push({
        priority: 'MEDIUM',
        title: '增加Raw Cache大小',
        description: '当前使用率>90%，建议从50MB增加到100MB',
        impact: '内存缓存命中率提升10-20%'
      });
    }

    if (lruStats.compressed.calculatedSize / lruStats.compressed.maxSize > 0.9) {
      recommendations.push({
        priority: 'LOW',
        title: '增加Compressed Cache大小',
        description: '当前使用率>90%，建议从100MB增加到200MB',
        impact: '二级缓存命中率提升5-10%'
      });
    }
  }

  // 打印建议
  if (recommendations.length === 0) {
    console.log(`\n   ✅ 缓存配置优秀，无需优化`);
  } else {
    recommendations.forEach((rec, i) => {
      console.log(`\n   ${i + 1}. [${rec.priority}] ${rec.title}`);
      console.log(`      ${rec.description}`);
      console.log(`      预期效果: ${rec.impact}`);
    });
  }

  return recommendations;
}

/**
 * 主诊断流程
 */
async function runCacheDiagnostics() {
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║           MVT缓存性能诊断工具                                      ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');

  try {
    // Initialize Redis connection
    console.log('\n🔧 正在初始化Redis连接...\n');
    try {
      const clients = await initializeRedis();
      redis = clients.redis;
      console.log('✅ Redis初始化成功\n');
    } catch (error) {
      console.log(`⚠️  Redis初始化失败: ${error.message}`);
      console.log('   继续使用LRU缓存模式...\n');
    }

    // 1. 检查Redis连接
    const redisInfo = await checkRedisConnection();

    // 2. 分析缓存键分布
    await analyzeCacheKeys();

    // 3. 测试缓存性能
    await testCachePerformance();

    // 4. 分析LRU缓存
    const lruStats = analyzeLRUCache();

    // 5. 生成优化建议
    generateCacheRecommendations(redisInfo, lruStats);

    console.log(`\n${'='.repeat(80)}`);
    console.log(`✅ 缓存诊断完成`);
    console.log(`${'='.repeat(80)}`);

  } catch (error) {
    console.error('❌ 诊断失败:', error);
  } finally {
    if (redis) {
      try {
        await redis.quit();
      } catch (err) {
        // Ignore quit errors
      }
    }
    process.exit(0);
  }
}

// 运行诊断
runCacheDiagnostics().catch(console.error);
