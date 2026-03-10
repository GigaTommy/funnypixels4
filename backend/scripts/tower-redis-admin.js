/**
 * Tower Redis 管理工具
 *
 * 用途：
 * - 预热 Redis 缓存
 * - 健康检查
 * - 重建单个塔
 * - 清理孤立数据
 *
 * 使用方法：
 *   node scripts/tower-redis-admin.js [command] [options]
 *
 * 命令：
 *   warmup          - 预热 Redis 缓存
 *   health-check    - 健康检查
 *   rebuild <tileId> - 重建指定塔
 *   cleanup         - 清理孤立数据
 */

const { getRedis, initializeRedis } = require('../src/config/redis');
const TowerRedisPersistence = require('../src/services/towerRedisPersistence');
const logger = require('../src/utils/logger');

async function main() {
  const command = process.argv[2];
  const arg = process.argv[3];

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('      Tower Redis 管理工具');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 初始化 Redis
  console.log('🔌 初始化 Redis 连接...\n');
  await initializeRedis();

  const redis = getRedis();
  if (!redis || !redis.isOpen) {
    console.error('❌ Redis 未连接，无法执行操作');
    process.exit(1);
  }
  console.log('   ✅ Redis 连接成功\n');

  try {
    switch (command) {
      case 'warmup':
        await handleWarmup();
        break;

      case 'health-check':
        await handleHealthCheck();
        break;

      case 'rebuild':
        if (!arg) {
          console.error('❌ 缺少参数：tile_id');
          console.log('使用方法: node scripts/tower-redis-admin.js rebuild <tile_id>');
          process.exit(1);
        }
        await handleRebuild(arg);
        break;

      case 'cleanup':
        await handleCleanup();
        break;

      case 'stats':
        await handleStats();
        break;

      default:
        printUsage();
        process.exit(1);
    }

    console.log('\n✅ 操作完成\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ 操作失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

/**
 * 预热 Redis 缓存
 */
async function handleWarmup() {
  console.log('🔥 预热 Redis 缓存\n');

  const towerLimit = parseInt(process.argv[4] || '1000');
  console.log(`   参数: 加载最近 ${towerLimit} 个活跃塔\n`);

  const result = await TowerRedisPersistence.warmupRedisFromDB({
    towerLimit,
    skipIfExists: false  // 强制重新加载
  });

  if (result.success) {
    console.log('   预热结果:');
    console.log(`   - 加载塔数量: ${result.loaded}`);
    console.log(`   - 错误数量: ${result.errors || 0}`);
    console.log(`   - 总耗时: ${result.duration}ms`);
    if (result.loaded > 0) {
      console.log(`   - 平均耗时: ${(result.duration / result.loaded).toFixed(0)}ms/塔`);
    }
  } else {
    console.error(`   ❌ 预热失败: ${result.reason || result.error}`);
  }
}

/**
 * 健康检查
 */
async function handleHealthCheck() {
  console.log('🔍 健康检查\n');

  const sampleSize = parseInt(process.argv[4] || '10');
  console.log(`   参数: 抽样检查 ${sampleSize} 个塔\n`);

  const result = await TowerRedisPersistence.healthCheck(sampleSize);

  console.log('   检查结果:');
  console.log(`   - 状态: ${result.healthy ? '✅ 健康' : '❌ 异常'}`);
  console.log(`   - 检查塔数: ${result.total || 0}`);
  console.log(`   - 一致: ${result.consistent || 0}`);
  console.log(`   - 不一致: ${result.inconsistent || 0}`);

  if (result.inconsistencies && result.inconsistencies.length > 0) {
    console.log('\n   不一致详情:');
    result.inconsistencies.forEach((item, idx) => {
      console.log(`   ${idx + 1}. ${item.tile_id}: ${item.issue}`);
      if (item.redis !== undefined) {
        console.log(`      Redis: ${item.redis}, PostgreSQL: ${item.db}`);
      }
    });
  }
}

/**
 * 重建单个塔
 */
async function handleRebuild(tileId) {
  console.log(`🔧 重建塔: ${tileId}\n`);

  const result = await TowerRedisPersistence.rebuildTowerFromHistory(tileId);

  if (result.success) {
    console.log('   重建结果:');
    console.log(`   - 像素数: ${result.pixel_count}`);
    console.log(`   - 独立用户: ${result.unique_users}`);
    console.log(`   - 耗时: ${result.duration}ms`);
  } else {
    console.error(`   ❌ 重建失败: ${result.reason}`);
  }
}

/**
 * 清理孤立数据
 */
async function handleCleanup() {
  console.log('🧹 清理孤立数据\n');

  const result = await TowerRedisPersistence.cleanupOrphanedData();

  if (result.success) {
    console.log('   清理结果:');
    console.log(`   - 清理塔数量: ${result.cleaned}`);
  } else {
    console.error(`   ❌ 清理失败: ${result.error}`);
  }
}

/**
 * 统计信息
 */
async function handleStats() {
  console.log('📊 Redis 统计信息\n');

  const redis = getRedis();

  // 统计塔数量
  const towerKeys = await redis.keys('tower:*:*');
  const mainTowerKeys = await redis.keys('tower:*');

  // 过滤出主塔键（不包含子键）
  const towerCount = mainTowerKeys.filter(key => !key.includes(':user:') && !key.includes(':users')).length;

  console.log('   Redis 数据:');
  console.log(`   - 塔数量: ${towerCount}`);
  console.log(`   - 总键数: ${towerKeys.length + mainTowerKeys.length}`);

  // 脏数据标记
  const dirtyCount = await redis.sCard('tower:dirty');
  console.log(`   - 待同步塔数: ${dirtyCount}`);

  // 内存使用
  const info = await redis.info('memory');
  const usedMemoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
  if (usedMemoryMatch) {
    console.log(`   - Redis 内存使用: ${usedMemoryMatch[1]}`);
  }
}

/**
 * 打印使用说明
 */
function printUsage() {
  console.log('使用方法:');
  console.log('  node scripts/tower-redis-admin.js <command> [options]\n');
  console.log('命令:');
  console.log('  warmup [limit]           - 预热 Redis 缓存（默认加载 1000 个塔）');
  console.log('  health-check [sample]    - 健康检查（默认抽样 10 个塔）');
  console.log('  rebuild <tile_id>        - 重建指定塔');
  console.log('  cleanup                  - 清理孤立数据');
  console.log('  stats                    - 显示统计信息\n');
  console.log('示例:');
  console.log('  node scripts/tower-redis-admin.js warmup 500');
  console.log('  node scripts/tower-redis-admin.js health-check 20');
  console.log('  node scripts/tower-redis-admin.js rebuild 18/123456/789012');
  console.log('  node scripts/tower-redis-admin.js cleanup');
  console.log('  node scripts/tower-redis-admin.js stats');
}

// 运行主函数
main();
