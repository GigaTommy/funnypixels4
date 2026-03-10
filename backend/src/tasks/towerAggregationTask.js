/**
 * Tower Aggregation Task (Redis → PostgreSQL 同步)
 *
 * 定时任务：每5分钟将 Redis 中的塔数据同步到 PostgreSQL
 *
 * 设计思路：
 * - Redis 作为主数据源（实时增量更新）
 * - PostgreSQL 作为持久化备份（定期同步）
 * - 通过 tower:dirty 集合追踪需要同步的 tile_id
 * - 同步完成后清除脏数据标记
 *
 * 性能优势：
 * - 消除 GROUP BY 查询（Redis 增量更新）
 * - 降低 DB 写入频率（5分钟同步一次 vs 实时写入）
 * - 故障恢复：Redis 数据丢失时可从 PostgreSQL 重建
 */

const cron = require('node-cron');
const { db } = require('../config/database');
const { getRedis } = require('../config/redis');
const logger = require('../utils/logger');

// 任务配置
const TASK_INTERVAL = '*/5 * * * *'; // 每5分钟（降低频率，减少 DB 压力）

/**
 * 定时任务：将 Redis 数据同步到 PostgreSQL
 */
async function syncRedisToPostgres() {
  const taskStartTime = Date.now();
  const redis = getRedis();

  try {
    // 检查 Redis 连接
    if (!redis || !redis.isOpen) {
      logger.warn('[TowerSync] Redis 不可用，跳过同步任务');
      return { success: false, reason: 'Redis unavailable' };
    }

    logger.debug('[TowerSync] 开始同步 Redis 数据到 PostgreSQL...');

    // ━━━━━ Step 1: 获取需要同步的 tile_id 列表 ━━━━━
    const dirtyTileIds = await redis.sMembers('tower:dirty');

    if (dirtyTileIds.length === 0) {
      logger.debug('[TowerSync] 没有脏数据，跳过本次同步');
      return { success: true, synced: 0 };
    }

    logger.info(`[TowerSync] 发现 ${dirtyTileIds.length} 个塔需要同步到 PostgreSQL`);

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    // ━━━━━ Step 2: 遍历每个塔，同步数据 ━━━━━
    for (const tileId of dirtyTileIds) {
      try {
        const towerKey = `tower:${tileId}`;

        // 2.1 读取塔统计数据
        const towerData = await redis.hGetAll(towerKey);

        if (!towerData || !towerData.pixel_count) {
          logger.warn(`[TowerSync] 塔 ${tileId} 在 Redis 中无数据，跳过`);
          continue;
        }

        // 2.2 UPSERT 到 pixel_towers 表
        await db('pixel_towers')
          .insert({
            tile_id: tileId,
            lat: parseFloat(towerData.lat),
            lng: parseFloat(towerData.lng),
            pixel_count: parseInt(towerData.pixel_count),
            height: parseFloat(towerData.height),
            unique_users: parseInt(towerData.unique_users),
            first_pixel_time: new Date(parseInt(towerData.first_pixel_time)),
            last_pixel_time: new Date(parseInt(towerData.last_pixel_time)),
            top_pattern_id: towerData.top_pattern_id,
            top_user_id: towerData.top_user_id,
            updated_at: new Date()
          })
          .onConflict('tile_id')
          .merge();

        // ━━━━━ Step 3: 同步用户楼层数据 ━━━━━
        const userKeys = await redis.keys(`${towerKey}:user:*`);

        for (const userKey of userKeys) {
          // 跳过楼层列表键（仅处理用户统计键）
          if (userKey.endsWith(':floors')) continue;

          const userId = userKey.split(':user:')[1];
          if (!userId) continue;

          const userData = await redis.hGetAll(userKey);

          if (!userData || !userData.floor_count || parseInt(userData.floor_count) === 0) {
            continue;
          }

          // UPSERT 到 user_tower_floors 表
          await db('user_tower_floors')
            .insert({
              user_id: userId,
              tile_id: tileId,
              floor_count: parseInt(userData.floor_count),
              contribution_pct: parseFloat(userData.contribution_pct || 0),
              first_floor_index: parseInt(userData.first_floor),
              last_floor_index: parseInt(userData.last_floor),
              updated_at: new Date()
            })
            .onConflict(['user_id', 'tile_id'])
            .merge();
        }

        successCount++;

      } catch (error) {
        errorCount++;
        errors.push({ tile_id: tileId, error: error.message });
        logger.error(`[TowerSync] 同步塔 ${tileId} 失败`, {
          error: error.message
        });
        // 继续处理下一个塔
      }
    }

    // ━━━━━ Step 4: 清除脏数据标记 ━━━━━
    if (successCount > 0) {
      await redis.del('tower:dirty');
      logger.info('[TowerSync] 已清除脏数据标记');
    }

    const taskDuration = Date.now() - taskStartTime;

    // ━━━━━ Step 5: 记录同步结果 ━━━━━
    logger.info('[TowerSync] PostgreSQL 同步完成', {
      total: dirtyTileIds.length,
      success: successCount,
      errors: errorCount,
      duration: `${taskDuration}ms`,
      avgTimePerTower: dirtyTileIds.length > 0 ? `${(taskDuration / dirtyTileIds.length).toFixed(0)}ms` : 'N/A'
    });

    if (errorCount > 0) {
      logger.warn(`[TowerSync] 本次同步有 ${errorCount} 个塔失败`, {
        errorDetails: errors.slice(0, 5)  // 只记录前5个错误
      });
    }

    return {
      success: true,
      total: dirtyTileIds.length,
      synced: successCount,
      errors: errorCount,
      duration: taskDuration
    };

  } catch (error) {
    logger.error('[TowerSync] 同步任务执行失败', {
      error: error.message,
      stack: error.stack
    });
    return { success: false, error: error.message };
  }
}

/**
 * 启动定时任务
 */
function startTowerAggregationTask() {
  logger.info('[TowerSync] 初始化 Redis → PostgreSQL 同步任务...', {
    interval: TASK_INTERVAL,
    description: '每5分钟同步 Redis 数据到 PostgreSQL'
  });

  // 创建 cron 任务
  const task = cron.schedule(TASK_INTERVAL, syncRedisToPostgres, {
    scheduled: true,
    timezone: "Asia/Shanghai" // 使用服务器时区
  });

  logger.info('[TowerSync] ✅ 同步任务已启动');

  // 返回任务实例（用于测试或手动停止）
  return task;
}

/**
 * 手动触发一次同步（用于测试）
 */
async function triggerManualSync() {
  logger.info('[TowerSync] 手动触发 Redis → PostgreSQL 同步...');
  const result = await syncRedisToPostgres();
  return result;
}

// 如果直接运行此文件，执行一次手动同步（用于测试）
if (require.main === module) {
  logger.info('[TowerSync] 测试模式：执行一次手动同步');
  triggerManualSync()
    .then(result => {
      logger.info('[TowerSync] 测试完成', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      logger.error('[TowerSync] 测试失败', error);
      process.exit(1);
    });
}

module.exports = {
  startTowerAggregationTask,
  triggerManualSync,
  syncRedisToPostgres
};
