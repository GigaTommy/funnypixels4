/**
 * Redis Tower Aggregation 测试脚本
 *
 * 用途：
 * - 测试 Redis 增量更新功能
 * - 验证楼层号分配正确性
 * - 验证用户楼层列表存储
 * - 测试 Redis → PostgreSQL 同步
 * - 性能基准测试
 *
 * 使用方法：
 *   node scripts/test-redis-tower-aggregation.js
 */

const { db } = require('../src/config/database');
const { getRedis, initializeRedis } = require('../src/config/redis');
const TowerAggregationService = require('../src/services/towerAggregationService');
const { syncRedisToPostgres } = require('../src/tasks/towerAggregationTask');
const logger = require('../src/utils/logger');

// 测试数据
const TEST_TILE_ID = '18/999999/999999'; // 使用不冲突的 tile_id
let TEST_USER_IDS = [];  // 将从数据库查询真实用户

async function runTests() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('      Redis Tower Aggregation 测试');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 初始化 Redis 连接
  console.log('🔌 初始化 Redis 连接...\n');
  await initializeRedis();

  const redis = getRedis();

  if (!redis || !redis.isOpen) {
    console.error('❌ Redis 未连接，无法执行测试');
    process.exit(1);
  }

  console.log('   ✅ Redis 连接成功\n');

  try {
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 准备测试数据：获取3个真实用户
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('👥 准备测试数据：获取真实用户\n');

    const users = await db('users')
      .select('id')
      .limit(3);

    if (users.length < 3) {
      console.error('❌ 数据库中用户数量不足（至少需要3个用户）');
      process.exit(1);
    }

    TEST_USER_IDS = users.map(u => u.id);
    console.log(`   ✅ 找到 ${TEST_USER_IDS.length} 个测试用户`);
    TEST_USER_IDS.forEach((id, idx) => {
      console.log(`      用户${idx + 1}: ${id.slice(0, 8)}...`);
    });
    console.log('');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 测试 1: 清理测试数据
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('🧹 测试 1: 清理旧测试数据\n');

    const towerKey = `tower:${TEST_TILE_ID}`;

    // 清理 Redis
    const keys = await redis.keys(`${towerKey}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(`   清理了 ${keys.length} 个 Redis 键`);
    }
    await redis.sRem('tower:dirty', TEST_TILE_ID);

    // 清理 PostgreSQL
    await db('user_tower_floors').where('tile_id', TEST_TILE_ID).del();
    await db('pixel_towers').where('tile_id', TEST_TILE_ID).del();

    console.log('   ✅ 测试数据清理完成\n');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 测试 2: 模拟用户绘制像素（Redis 增量更新）
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('🎨 测试 2: 模拟用户绘制像素（Redis 增量更新）\n');

    const pixelDraws = [
      { user_id: TEST_USER_IDS[0], pattern_id: 'color_red' },      // 用户1 - 楼层0
      { user_id: TEST_USER_IDS[1], pattern_id: 'color_blue' },     // 用户2 - 楼层1
      { user_id: TEST_USER_IDS[0], pattern_id: 'color_green' },    // 用户1 - 楼层2
      { user_id: TEST_USER_IDS[2], pattern_id: 'emoji_cn' },       // 用户3 - 楼层3
      { user_id: TEST_USER_IDS[0], pattern_id: 'color_yellow' },   // 用户1 - 楼层4
      { user_id: TEST_USER_IDS[1], pattern_id: 'color_magenta' },  // 用户2 - 楼层5
    ];

    const startTime = Date.now();

    for (let i = 0; i < pixelDraws.length; i++) {
      const { user_id, pattern_id } = pixelDraws[i];

      await TowerAggregationService.onPixelDrawn({
        lat: 39.904,
        lng: 116.407,
        user_id,
        pattern_id,
        created_at: new Date(),
        tile_id: TEST_TILE_ID
      });

      console.log(`   ✅ 像素 ${i}: ${pattern_id} by ${user_id.slice(-4)}`);
    }

    const drawDuration = Date.now() - startTime;
    console.log(`\n   总耗时: ${drawDuration}ms (平均 ${(drawDuration / pixelDraws.length).toFixed(1)}ms/像素)\n`);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 测试 3: 验证 Redis 数据正确性
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('🔍 测试 3: 验证 Redis 数据正确性\n');

    // 3.1 验证塔统计数据
    const towerData = await redis.hGetAll(towerKey);
    console.log('   塔统计数据:');
    console.log(`   - pixel_count: ${towerData.pixel_count} (期望: 6)`);
    console.log(`   - height: ${towerData.height} (期望: ${(Math.log(6) * 8).toFixed(2)})`);
    console.log(`   - unique_users: ${towerData.unique_users} (期望: 3)`);
    console.log(`   - top_pattern_id: ${towerData.top_pattern_id} (期望: color_magenta)`);

    if (parseInt(towerData.pixel_count) !== 6) {
      console.error('   ❌ pixel_count 不正确！');
      process.exit(1);
    }

    // 3.2 验证独立用户集合
    const uniqueUsers = await redis.sMembers(`${towerKey}:users`);
    console.log(`\n   独立用户集合: ${uniqueUsers.length} 个用户`);
    if (uniqueUsers.length !== 3) {
      console.error('   ❌ unique_users 数量不正确！');
      process.exit(1);
    }

    // 3.3 验证用户楼层数据
    console.log('\n   用户楼层数据:');

    for (const userId of TEST_USER_IDS) {
      const userKey = `${towerKey}:user:${userId}`;
      const userFloorsKey = `${userKey}:floors`;

      const userData = await redis.hGetAll(userKey);
      const floorsList = await redis.lRange(userFloorsKey, 0, -1);

      if (!userData.floor_count) continue;

      console.log(`\n   用户 ${userId.slice(-4)}:`);
      console.log(`     - floor_count: ${userData.floor_count}`);
      console.log(`     - first_floor: ${userData.first_floor}`);
      console.log(`     - last_floor: ${userData.last_floor}`);
      console.log(`     - contribution_pct: ${userData.contribution_pct}%`);
      console.log(`     - floors: [${floorsList.join(', ')}]`);
    }

    // 期望结果：
    // 用户1: floors = [0, 2, 4]
    // 用户2: floors = [1, 5]
    // 用户3: floors = [3]
    const user1Floors = await redis.lRange(`${towerKey}:user:${TEST_USER_IDS[0]}:floors`, 0, -1);
    const expectedUser1Floors = ['0', '2', '4'];

    if (user1Floors.join(',') !== expectedUser1Floors.join(',')) {
      console.error(`\n   ❌ 用户1楼层列表不正确！`);
      console.error(`      期望: [${expectedUser1Floors.join(', ')}]`);
      console.error(`      实际: [${user1Floors.join(', ')}]`);
      process.exit(1);
    }

    console.log('\n   ✅ Redis 数据验证通过\n');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 测试 4: 验证脏数据标记
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('🏷️  测试 4: 验证脏数据标记\n');

    const isDirty = await redis.sIsMember('tower:dirty', TEST_TILE_ID);
    console.log(`   tower:dirty 包含 ${TEST_TILE_ID}: ${isDirty ? '✅' : '❌'}`);

    if (!isDirty) {
      console.error('   ❌ 脏数据标记丢失！');
      process.exit(1);
    }

    console.log('   ✅ 脏数据标记正确\n');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 测试 5: 同步到 PostgreSQL
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('💾 测试 5: Redis → PostgreSQL 同步\n');

    const syncResult = await syncRedisToPostgres();

    console.log('   同步结果:');
    console.log(`   - 总数: ${syncResult.total}`);
    console.log(`   - 成功: ${syncResult.synced}`);
    console.log(`   - 错误: ${syncResult.errors}`);
    console.log(`   - 耗时: ${syncResult.duration}ms`);

    if (!syncResult.success || syncResult.synced === 0) {
      console.error('   ❌ 同步失败！');
      process.exit(1);
    }

    console.log('   ✅ 同步成功\n');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 测试 6: 验证 PostgreSQL 数据
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('🗄️  测试 6: 验证 PostgreSQL 数据\n');

    // 6.1 验证 pixel_towers 表
    const towerInDB = await db('pixel_towers')
      .where('tile_id', TEST_TILE_ID)
      .first();

    console.log('   pixel_towers 表:');
    console.log(`   - pixel_count: ${towerInDB.pixel_count} (期望: 6)`);
    console.log(`   - unique_users: ${towerInDB.unique_users} (期望: 3)`);
    console.log(`   - top_pattern_id: ${towerInDB.top_pattern_id} (期望: color_magenta)`);

    if (towerInDB.pixel_count !== 6) {
      console.error('   ❌ PostgreSQL 数据不一致！');
      process.exit(1);
    }

    // 6.2 验证 user_tower_floors 表
    const userFloorsInDB = await db('user_tower_floors')
      .where('tile_id', TEST_TILE_ID)
      .orderBy('floor_count', 'desc');

    console.log(`\n   user_tower_floors 表: ${userFloorsInDB.length} 条记录`);

    for (const record of userFloorsInDB) {
      console.log(`   - 用户 ${record.user_id.slice(-4)}: ${record.floor_count} 层, ${record.contribution_pct}%`);
    }

    if (userFloorsInDB.length !== 3) {
      console.error('   ❌ user_tower_floors 记录数不正确！');
      process.exit(1);
    }

    console.log('\n   ✅ PostgreSQL 数据验证通过\n');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 测试 7: 性能基准测试
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('⚡ 测试 7: 性能基准测试（100 次写入）\n');

    const perfTileId = '18/888888/888888';
    const perfTowerKey = `tower:${perfTileId}`;

    // 清理测试数据
    const perfKeys = await redis.keys(`${perfTowerKey}*`);
    if (perfKeys.length > 0) {
      await redis.del(...perfKeys);
    }

    const perfStartTime = Date.now();

    for (let i = 0; i < 100; i++) {
      await TowerAggregationService.onPixelDrawn({
        lat: 39.904 + (i * 0.0001),
        lng: 116.407 + (i * 0.0001),
        user_id: TEST_USER_IDS[i % 3],
        pattern_id: 'color_red',
        created_at: new Date(),
        tile_id: perfTileId
      });
    }

    const perfDuration = Date.now() - perfStartTime;
    const avgLatency = perfDuration / 100;

    console.log(`   100 次写入总耗时: ${perfDuration}ms`);
    console.log(`   平均延迟: ${avgLatency.toFixed(2)}ms`);
    console.log(`   吞吐量: ${(1000 / avgLatency).toFixed(0)} ops/s`);

    if (avgLatency > 20) {
      console.warn(`   ⚠️  平均延迟超过 20ms，可能需要优化`);
    } else {
      console.log(`   ✅ 性能表现良好 (< 20ms)`);
    }

    // 清理性能测试数据
    const perfKeysToDelete = await redis.keys(`${perfTowerKey}*`);
    if (perfKeysToDelete.length > 0) {
      await redis.del(...perfKeysToDelete);
    }
    await redis.sRem('tower:dirty', perfTileId);

    console.log('\n');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 总结
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('═══════════════════════════════════════════════════════════');
    console.log('      测试完成');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('✅ 所有测试通过！\n');
    console.log('测试项目:');
    console.log('  ✅ Redis 增量更新');
    console.log('  ✅ 楼层号分配正确性');
    console.log('  ✅ 用户楼层列表存储');
    console.log('  ✅ 脏数据标记机制');
    console.log('  ✅ Redis → PostgreSQL 同步');
    console.log('  ✅ 数据一致性验证');
    console.log('  ✅ 性能基准测试');
    console.log('\n💡 下一步:');
    console.log('  • 集成到生产环境');
    console.log('  • 监控 Redis 内存使用');
    console.log('  • 配置 Redis 持久化（AOF）\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 运行测试
runTests();
