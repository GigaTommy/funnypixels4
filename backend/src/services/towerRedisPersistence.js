/**
 * Tower Redis Persistence Service
 *
 * 负责 Redis 与 PostgreSQL 之间的数据持久化和恢复
 *
 * 功能：
 * - 启动时从 PostgreSQL 预热 Redis 缓存
 * - Redis 数据丢失时自动重建
 * - 定期健康检查
 */

const { db } = require('../config/database');
const { getRedis } = require('../config/redis');
const logger = require('../utils/logger');

class TowerRedisPersistence {
  /**
   * 服务启动时：从 PostgreSQL 预热 Redis 缓存
   *
   * @param {Object} options - 预热选项
   * @param {number} options.towerLimit - 最多预热多少个塔（默认 1000）
   * @param {boolean} options.skipIfExists - 如果 Redis 已有数据则跳过（默认 true）
   */
  static async warmupRedisFromDB(options = {}) {
    const { towerLimit = 1000, skipIfExists = true } = options;
    const redis = getRedis();

    if (!redis || !redis.isOpen) {
      logger.warn('[TowerPersistence] Redis 不可用，跳过预热');
      return { success: false, reason: 'Redis unavailable' };
    }

    const startTime = Date.now();

    try {
      // ━━━━━ Step 1: 检查 Redis 是否已有数据 ━━━━━
      if (skipIfExists) {
        const existingKeys = await redis.keys('tower:*');
        if (existingKeys.length > 0) {
          logger.info('[TowerPersistence] Redis 已有塔数据，跳过预热', {
            existingKeys: existingKeys.length
          });
          return { success: true, skipped: true, existingKeys: existingKeys.length };
        }
      }

      logger.info('[TowerPersistence] 开始从 PostgreSQL 预热 Redis 缓存...', {
        towerLimit
      });

      // ━━━━━ Step 2: 查询最近活跃的塔（按 last_pixel_time 排序）━━━━━
      const towers = await db('pixel_towers')
        .orderBy('last_pixel_time', 'desc')
        .limit(towerLimit)
        .select('*');

      if (towers.length === 0) {
        logger.info('[TowerPersistence] PostgreSQL 中没有塔数据，跳过预热');
        return { success: true, loaded: 0 };
      }

      logger.info(`[TowerPersistence] 找到 ${towers.length} 个塔，开始加载到 Redis...`);

      let successCount = 0;
      let errorCount = 0;

      // ━━━━━ Step 3: 遍历每个塔，加载到 Redis ━━━━━
      for (const tower of towers) {
        try {
          await this.loadSingleTowerToRedis(tower.tile_id);
          successCount++;

          if (successCount % 100 === 0) {
            logger.info(`[TowerPersistence] 已加载 ${successCount}/${towers.length} 个塔`);
          }

        } catch (error) {
          errorCount++;
          logger.error(`[TowerPersistence] 加载塔 ${tower.tile_id} 失败`, {
            error: error.message
          });
        }
      }

      const duration = Date.now() - startTime;

      logger.info('[TowerPersistence] Redis 预热完成', {
        total: towers.length,
        success: successCount,
        errors: errorCount,
        duration: `${duration}ms`,
        avgTimePerTower: `${(duration / towers.length).toFixed(0)}ms`
      });

      return {
        success: true,
        loaded: successCount,
        errors: errorCount,
        duration
      };

    } catch (error) {
      logger.error('[TowerPersistence] Redis 预热失败', {
        error: error.message,
        stack: error.stack
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * 将单个塔从 PostgreSQL 加载到 Redis
   * @private
   */
  static async loadSingleTowerToRedis(tileId) {
    const redis = getRedis();

    // ━━━━━ Step 1: 从 PostgreSQL 读取塔统计数据 ━━━━━
    const tower = await db('pixel_towers')
      .where('tile_id', tileId)
      .first();

    if (!tower) {
      throw new Error(`Tower ${tileId} not found in PostgreSQL`);
    }

    const towerKey = `tower:${tileId}`;

    // ━━━━━ Step 2: 写入塔统计到 Redis HASH ━━━━━
    await redis.hSet(towerKey, {
      lat: tower.lat.toString(),
      lng: tower.lng.toString(),
      pixel_count: tower.pixel_count.toString(),
      height: tower.height.toString(),
      unique_users: tower.unique_users.toString(),
      first_pixel_time: new Date(tower.first_pixel_time).getTime().toString(),
      last_pixel_time: new Date(tower.last_pixel_time).getTime().toString(),
      top_pattern_id: tower.top_pattern_id || 'color_default',
      top_user_id: tower.top_user_id || ''
    });

    // ━━━━━ Step 3: 读取并加载用户楼层数据 ━━━━━
    const userFloors = await db('user_tower_floors')
      .where('tile_id', tileId)
      .select('*');

    for (const userFloor of userFloors) {
      const userKey = `${towerKey}:user:${userFloor.user_id}`;

      // 写入用户楼层摘要
      await redis.hSet(userKey, {
        floor_count: userFloor.floor_count.toString(),
        first_floor: userFloor.first_floor_index.toString(),
        last_floor: userFloor.last_floor_index.toString(),
        contribution_pct: userFloor.contribution_pct.toString()
      });

      // ⚠️ 注意：用户具体楼层列表（floors）无法从 PostgreSQL 恢复
      // 因为 user_tower_floors 表只存储了摘要信息（first/last），没有存储完整列表
      // 只有通过 pixels_history 重新计算才能得到完整楼层列表
    }

    // ━━━━━ Step 4: 重建独立用户集合 ━━━━━
    if (userFloors.length > 0) {
      const userIds = userFloors.map(uf => uf.user_id);
      await redis.sAdd(`${towerKey}:users`, ...userIds);
    }

    logger.debug(`[TowerPersistence] Loaded tower ${tileId} to Redis`, {
      pixel_count: tower.pixel_count,
      unique_users: tower.unique_users
    });
  }

  /**
   * 从 pixels_history 完整重建单个塔的 Redis 数据
   * （包括具体楼层列表）
   *
   * @param {string} tileId - 塔ID
   */
  static async rebuildTowerFromHistory(tileId) {
    const redis = getRedis();

    if (!redis || !redis.isOpen) {
      throw new Error('Redis unavailable');
    }

    logger.info(`[TowerPersistence] 开始从 pixels_history 重建塔 ${tileId}...`);

    const startTime = Date.now();

    try {
      // ━━━━━ Step 1: 清空 Redis 中的旧数据 ━━━━━
      const towerKey = `tower:${tileId}`;
      const keysToDelete = await redis.keys(`${towerKey}*`);
      if (keysToDelete.length > 0) {
        await redis.del(...keysToDelete);
      }

      // ━━━━━ Step 2: 查询 pixels_history（按时间顺序）━━━━━
      const pixels = await db('pixels_history')
        .where('tile_id', tileId)
        .where('action_type', 'draw')
        .orderBy('created_at', 'asc')
        .select('user_id', 'pattern_id', 'latitude', 'longitude', 'created_at');

      if (pixels.length === 0) {
        logger.warn(`[TowerPersistence] 塔 ${tileId} 没有历史像素数据`);
        return { success: false, reason: 'No pixels found' };
      }

      logger.info(`[TowerPersistence] 找到 ${pixels.length} 个像素，开始重建...`);

      // ━━━━━ Step 3: 初始化塔数据 ━━━━━
      const firstPixel = pixels[0];
      const lastPixel = pixels[pixels.length - 1];

      await redis.hSet(towerKey, {
        lat: firstPixel.latitude.toString(),
        lng: firstPixel.longitude.toString(),
        pixel_count: pixels.length.toString(),
        height: (Math.log(pixels.length) * 8).toFixed(2),
        first_pixel_time: new Date(firstPixel.created_at).getTime().toString(),
        last_pixel_time: new Date(lastPixel.created_at).getTime().toString(),
        top_pattern_id: lastPixel.pattern_id || 'color_default',
        top_user_id: lastPixel.user_id
      });

      // ━━━━━ Step 4: 重建用户楼层数据 ━━━━━
      const userFloorsMap = new Map();

      pixels.forEach((pixel, index) => {
        const floorIndex = index;
        const userId = pixel.user_id;

        if (!userFloorsMap.has(userId)) {
          userFloorsMap.set(userId, {
            floors: [],
            first_floor: floorIndex,
            last_floor: floorIndex
          });
        }

        const userFloorData = userFloorsMap.get(userId);
        userFloorData.floors.push(floorIndex);
        userFloorData.last_floor = floorIndex;
      });

      // 写入用户数据到 Redis
      for (const [userId, floorData] of userFloorsMap.entries()) {
        const userKey = `${towerKey}:user:${userId}`;
        const userFloorsKey = `${userKey}:floors`;

        const contributionPct = (floorData.floors.length / pixels.length) * 100;

        // 写入用户摘要
        await redis.hSet(userKey, {
          floor_count: floorData.floors.length.toString(),
          first_floor: floorData.first_floor.toString(),
          last_floor: floorData.last_floor.toString(),
          contribution_pct: contributionPct.toFixed(2)
        });

        // 写入具体楼层列表（🎯 关键）
        if (floorData.floors.length > 0) {
          await redis.rPush(userFloorsKey, ...floorData.floors.map(f => f.toString()));
        }
      }

      // ━━━━━ Step 5: 更新独立用户集合 ━━━━━
      const uniqueUsers = Array.from(userFloorsMap.keys());
      if (uniqueUsers.length > 0) {
        await redis.sAdd(`${towerKey}:users`, ...uniqueUsers);
      }

      await redis.hSet(towerKey, 'unique_users', uniqueUsers.length.toString());

      const duration = Date.now() - startTime;

      logger.info(`[TowerPersistence] 塔 ${tileId} 重建完成`, {
        pixel_count: pixels.length,
        unique_users: uniqueUsers.length,
        duration: `${duration}ms`
      });

      return {
        success: true,
        pixel_count: pixels.length,
        unique_users: uniqueUsers.length,
        duration
      };

    } catch (error) {
      logger.error(`[TowerPersistence] 塔 ${tileId} 重建失败`, {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 健康检查：验证 Redis 与 PostgreSQL 数据一致性
   *
   * @param {number} sampleSize - 抽样检查的塔数量（默认 10）
   */
  static async healthCheck(sampleSize = 10) {
    const redis = getRedis();

    if (!redis || !redis.isOpen) {
      return { healthy: false, reason: 'Redis unavailable' };
    }

    try {
      // 从 PostgreSQL 随机抽取塔
      const towers = await db('pixel_towers')
        .orderByRaw('RANDOM()')
        .limit(sampleSize)
        .select('tile_id', 'pixel_count', 'unique_users');

      if (towers.length === 0) {
        return { healthy: true, message: 'No towers to check' };
      }

      let consistentCount = 0;
      let inconsistentCount = 0;
      const inconsistencies = [];

      for (const tower of towers) {
        const towerKey = `tower:${tower.tile_id}`;
        const redisData = await redis.hGetAll(towerKey);

        if (!redisData || !redisData.pixel_count) {
          inconsistentCount++;
          inconsistencies.push({
            tile_id: tower.tile_id,
            issue: 'Missing in Redis'
          });
          continue;
        }

        const redisPixelCount = parseInt(redisData.pixel_count);
        const dbPixelCount = tower.pixel_count;

        if (redisPixelCount !== dbPixelCount) {
          inconsistentCount++;
          inconsistencies.push({
            tile_id: tower.tile_id,
            issue: 'Pixel count mismatch',
            redis: redisPixelCount,
            db: dbPixelCount
          });
        } else {
          consistentCount++;
        }
      }

      const healthy = inconsistentCount === 0;

      logger.info('[TowerPersistence] 健康检查完成', {
        healthy,
        total: towers.length,
        consistent: consistentCount,
        inconsistent: inconsistentCount
      });

      return {
        healthy,
        total: towers.length,
        consistent: consistentCount,
        inconsistent: inconsistentCount,
        inconsistencies
      };

    } catch (error) {
      logger.error('[TowerPersistence] 健康检查失败', {
        error: error.message
      });
      return { healthy: false, error: error.message };
    }
  }

  /**
   * 清理 Redis 中的孤立数据（在 PostgreSQL 中已删除的塔）
   */
  static async cleanupOrphanedData() {
    const redis = getRedis();

    if (!redis || !redis.isOpen) {
      return { success: false, reason: 'Redis unavailable' };
    }

    logger.info('[TowerPersistence] 开始清理 Redis 孤立数据...');

    try {
      // 获取所有 tower:* 键
      const towerKeys = await redis.keys('tower:*');

      // 提取 tile_id（过滤掉子键）
      const tileIds = new Set();
      for (const key of towerKeys) {
        const match = key.match(/^tower:([^:]+)$/);
        if (match) {
          tileIds.add(match[1]);
        }
      }

      if (tileIds.size === 0) {
        logger.info('[TowerPersistence] Redis 中没有塔数据');
        return { success: true, cleaned: 0 };
      }

      logger.info(`[TowerPersistence] 检查 ${tileIds.size} 个塔...`);

      // 查询 PostgreSQL 中存在的塔
      const existingTowers = await db('pixel_towers')
        .whereIn('tile_id', Array.from(tileIds))
        .select('tile_id');

      const existingTileIds = new Set(existingTowers.map(t => t.tile_id));

      // 找出孤立的塔（在 Redis 中但不在 PostgreSQL 中）
      const orphanedTileIds = Array.from(tileIds).filter(id => !existingTileIds.has(id));

      if (orphanedTileIds.length === 0) {
        logger.info('[TowerPersistence] 没有发现孤立数据');
        return { success: true, cleaned: 0 };
      }

      logger.info(`[TowerPersistence] 发现 ${orphanedTileIds.length} 个孤立塔，开始清理...`);

      let cleanedCount = 0;

      for (const tileId of orphanedTileIds) {
        const keysToDelete = await redis.keys(`tower:${tileId}*`);
        if (keysToDelete.length > 0) {
          await redis.del(...keysToDelete);
          cleanedCount++;
        }
      }

      logger.info('[TowerPersistence] 清理完成', {
        cleaned: cleanedCount
      });

      return { success: true, cleaned: cleanedCount };

    } catch (error) {
      logger.error('[TowerPersistence] 清理失败', {
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }
}

module.exports = TowerRedisPersistence;
