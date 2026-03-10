/**
 * Tower Aggregation Service
 * Task: #34 - Week 1 Backend 服务
 *
 * 实时增量聚合服务
 * - 当用户绘制像素时触发更新
 * - 更新 pixel_towers 聚合表
 * - 更新 user_tower_floors 索引表
 * - 清除 Redis 缓存
 *
 * 集成点：pixelDrawService.drawPixel() 末尾调用
 */

const { db } = require('../config/database');
const logger = require('../utils/logger');
const { getRedis } = require('../config/redis');

class TowerAggregationService {
  /**
   * 当用户绘制像素时触发（在 pixelDrawService 中调用）
   *
   * @param {Object} pixelData - 像素数据
   * @param {number} pixelData.lat - 纬度
   * @param {number} pixelData.lng - 经度
   * @param {string} pixelData.user_id - 用户ID
   * @param {string} pixelData.pattern_id - Pattern ID（支持 color/emoji/complex）
   * @param {Date} pixelData.created_at - 创建时间
   * @param {string} pixelData.tile_id - 瓦片ID（自动生成）
   */
  static async onPixelDrawn(pixelData) {
    const { lat, lng, user_id, pattern_id, created_at, tile_id } = pixelData;

    // 如果没有 tile_id（老数据），自动计算
    const actualTileId = tile_id || await this.calculateTileId(lat, lng);

    const redis = getRedis();

    try {
      // ━━━━━ Redis 优先方案（实时增量更新）━━━━━
      if (redis && redis.isOpen) {
        await this.updateTowerStatsRedis(actualTileId, lat, lng, user_id, pattern_id, created_at);
        logger.info(`[TowerAggregation] Updated tower ${actualTileId} (Redis)`, {
          user_id,
          tile_id: actualTileId
        });
        return;
      }

      // ━━━━━ Fallback：原批量方案（Redis 不可用时）━━━━━
      logger.warn('[TowerAggregation] Redis unavailable, using fallback batch mode');

      // 1. 更新或创建 tower 记录（使用 UPSERT）
      await this.updateTowerStats(actualTileId, lat, lng, user_id, pattern_id, created_at);

      // 2. 更新用户楼层索引
      await this.updateUserFloorIndex(user_id, actualTileId);

      // 3. 清除 Redis 缓存
      await this.clearTowerCache(actualTileId);

      logger.info(`[TowerAggregation] Updated tower ${actualTileId} (DB fallback)`, {
        user_id,
        tile_id: actualTileId
      });

    } catch (error) {
      // 不阻塞主流程，记录错误即可
      logger.error('[TowerAggregation] Aggregation failed', {
        error: error.message,
        stack: error.stack,
        tile_id: actualTileId,
        user_id
      });
    }
  }

  /**
   * 更新塔的统计数据（Redis 增量更新）
   * @private
   */
  static async updateTowerStatsRedis(tileId, lat, lng, userId, patternId, createdAt) {
    const redis = getRedis();
    const towerKey = `tower:${tileId}`;
    const userKey = `${towerKey}:user:${userId}`;
    const userFloorsKey = `${userKey}:floors`;
    const timestamp = createdAt.getTime();

    try {
      // ━━━━━ Step 1: 获取新像素的楼层号（增量分配）━━━━━
      const currentPixelCount = await redis.hGet(towerKey, 'pixel_count');
      const floorIndex = parseInt(currentPixelCount || '0');

      // ━━━━━ Step 2: 更新塔统计信息 ━━━━━
      const towerUpdates = {
        lat: lat.toString(),
        lng: lng.toString(),
        top_pattern_id: patternId || 'color_default',
        top_user_id: userId,
        last_pixel_time: timestamp.toString()
      };

      // 增量更新像素数
      await redis.hIncrBy(towerKey, 'pixel_count', 1);

      // 批量设置其他字段
      await redis.hSet(towerKey, towerUpdates);

      // 如果是第一个像素，记录 first_pixel_time
      const hasFirstPixel = await redis.hExists(towerKey, 'first_pixel_time');
      if (!hasFirstPixel) {
        await redis.hSet(towerKey, 'first_pixel_time', timestamp.toString());
      }

      // ━━━━━ Step 3: 更新独立用户集合 ━━━━━
      const userAdded = await redis.sAdd(`${towerKey}:users`, userId);

      // 如果是新用户，更新 unique_users 计数
      if (userAdded > 0) {
        const uniqueUsers = await redis.sCard(`${towerKey}:users`);
        await redis.hSet(towerKey, 'unique_users', uniqueUsers.toString());
      }

      // ━━━━━ Step 4: 计算塔高度（对数缩放）━━━━━
      const newPixelCount = floorIndex + 1;
      const height = Math.log(newPixelCount) * 8;
      await redis.hSet(towerKey, 'height', height.toFixed(2));

      // ━━━━━ Step 5: 更新用户楼层映射 ━━━━━
      // 增量更新用户楼层数
      await redis.hIncrBy(userKey, 'floor_count', 1);

      // 更新最后一层楼层号
      await redis.hSet(userKey, 'last_floor', floorIndex.toString());

      // 如果是用户第一次在这个塔绘制，记录 first_floor
      const hasFirstFloor = await redis.hExists(userKey, 'first_floor');
      if (!hasFirstFloor) {
        await redis.hSet(userKey, 'first_floor', floorIndex.toString());
      }

      // 添加楼层号到用户楼层列表（🎯 关键：存储具体楼层号）
      await redis.rPush(userFloorsKey, floorIndex.toString());

      // ━━━━━ Step 6: 计算用户贡献占比 ━━━━━
      const userFloorCount = await redis.hGet(userKey, 'floor_count');
      const contributionPct = (parseInt(userFloorCount) / newPixelCount) * 100;
      await redis.hSet(userKey, 'contribution_pct', contributionPct.toFixed(2));

      // ━━━━━ Step 7: 标记为脏数据（需要同步到 PostgreSQL）━━━━━
      await redis.sAdd('tower:dirty', tileId);

      logger.debug(`[TowerAggregation] Redis update success`, {
        tile_id: tileId,
        floor_index: floorIndex,
        user_id: userId,
        pixel_count: newPixelCount,
        height: height.toFixed(2)
      });

    } catch (error) {
      logger.error('[TowerAggregation] Redis update failed', {
        error: error.message,
        tile_id: tileId,
        user_id: userId
      });
      throw error;
    }
  }

  /**
   * 更新塔的统计数据（PostgreSQL 批量方案 - Fallback）
   * @private
   */
  static async updateTowerStats(tileId, lat, lng, userId, patternId, createdAt) {
    // 使用 pattern_id 代替 color（支持所有类型：color/emoji/complex）
    // pattern_id 示例: color_magenta, emoji_cn, user_avatar_xxx, complex_flag_xxx
    const topPatternId = patternId || 'color_default';

    // 使用 INSERT ... ON CONFLICT 实现 UPSERT
    await db.raw(`
      INSERT INTO pixel_towers (
        tile_id,
        lat,
        lng,
        pixel_count,
        height,
        unique_users,
        first_pixel_time,
        last_pixel_time,
        top_pattern_id,
        top_user_id,
        updated_at
      )
      VALUES (?, ?, ?, 1, 0.3, 1, ?, ?, ?, ?, NOW())
      ON CONFLICT (tile_id) DO UPDATE SET
        pixel_count = pixel_towers.pixel_count + 1,
        height = LOG(pixel_towers.pixel_count + 1) * 8,
        last_pixel_time = EXCLUDED.last_pixel_time,
        top_pattern_id = EXCLUDED.top_pattern_id,
        top_user_id = EXCLUDED.top_user_id,
        updated_at = NOW()
    `, [tileId, lat, lng, createdAt, createdAt, topPatternId, userId]);

    // 更新 unique_users 统计（使用子查询）
    await db.raw(`
      UPDATE pixel_towers
      SET unique_users = (
        SELECT COUNT(DISTINCT user_id)
        FROM pixels_history
        WHERE tile_id = ?
          AND action_type = 'draw'
      )
      WHERE tile_id = ?
    `, [tileId, tileId]);
  }

  /**
   * 更新用户楼层索引
   * @private
   */
  static async updateUserFloorIndex(userId, tileId) {
    // 1. 查询用户在该塔的楼层统计
    const result = await db.raw(`
      SELECT
        COUNT(*) as floor_count,
        MIN(floor_index) as first_floor,
        MAX(floor_index) as last_floor
      FROM (
        SELECT ROW_NUMBER() OVER (ORDER BY created_at) - 1 as floor_index
        FROM pixels_history
        WHERE tile_id = ?
          AND user_id = ?
          AND action_type = 'draw'
      ) floors
    `, [tileId, userId]);

    const { floor_count, first_floor, last_floor } = result.rows[0];

    if (parseInt(floor_count) === 0) {
      // 用户在该塔没有像素，跳过
      return;
    }

    // 2. 获取塔的总像素数（计算贡献占比）
    const towerData = await db('pixel_towers')
      .where({ tile_id: tileId })
      .first('pixel_count');

    if (!towerData) {
      logger.warn('[TowerAggregation] Tower not found', { tile_id: tileId });
      return;
    }

    const contributionPct = (parseInt(floor_count) / towerData.pixel_count) * 100;

    // 3. UPSERT 用户楼层索引
    await db.raw(`
      INSERT INTO user_tower_floors (
        user_id,
        tile_id,
        floor_count,
        contribution_pct,
        first_floor_index,
        last_floor_index,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, NOW())
      ON CONFLICT (user_id, tile_id) DO UPDATE SET
        floor_count = EXCLUDED.floor_count,
        contribution_pct = EXCLUDED.contribution_pct,
        first_floor_index = EXCLUDED.first_floor_index,
        last_floor_index = EXCLUDED.last_floor_index,
        updated_at = NOW()
    `, [userId, tileId, floor_count, contributionPct, first_floor, last_floor]);
  }

  /**
   * 清除 Redis 缓存
   * @private
   */
  static async clearTowerCache(tileId) {
    const redis = getRedis();
    if (!redis || !redis.isOpen) return;

    try {
      // 清除单个塔的缓存
      await redis.del(`tower:${tileId}`);
      await redis.del(`tower:${tileId}:floors`);

      // 清除视口缓存（使用通配符删除）
      const keys = await redis.keys('tower:viewport:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }

      logger.debug('[TowerAggregation] Cache cleared', { tile_id: tileId });

    } catch (error) {
      logger.warn('[TowerAggregation] Cache clear failed', {
        error: error.message,
        tile_id: tileId
      });
    }
  }

  /**
   * 手动计算 tile_id（用于老数据）
   * @private
   */
  static async calculateTileId(lat, lng, zoom = 18) {
    const result = await db.raw(
      'SELECT calculate_tile_id(?, ?, ?) as tile_id',
      [lat, lng, zoom]
    );

    return result.rows[0].tile_id;
  }

  /**
   * 批量更新指定的塔（用于定时任务）
   *
   * @param {Array<string>} tileIds - 需要更新的 tile_id 列表
   * @returns {Promise<Object>} - 更新结果统计
   */
  static async batchUpdateTowers(tileIds) {
    if (!tileIds || tileIds.length === 0) {
      return { success: true, updated: 0 };
    }

    logger.info(`[TowerAggregation] 开始批量更新 ${tileIds.length} 个塔...`);
    const startTime = Date.now();
    let successCount = 0;
    let errorCount = 0;

    for (const tileId of tileIds) {
      try {
        // 查询该 tile_id 的最新像素（用于获取坐标等信息）
        const latestPixel = await db('pixels_history')
          .where('tile_id', tileId)
          .where('action_type', 'draw')
          .orderBy('created_at', 'desc')
          .first();

        if (!latestPixel) {
          logger.warn(`[TowerAggregation] Tile ${tileId} 没有像素数据，跳过`);
          continue;
        }

        // 调用现有的 onPixelDrawn 方法（会自动处理 UPSERT）
        await this.onPixelDrawn({
          lat: latestPixel.latitude,
          lng: latestPixel.longitude,
          user_id: latestPixel.user_id,
          pattern_id: latestPixel.pattern_id || 'color_default',
          created_at: latestPixel.created_at,
          tile_id: tileId
        });

        successCount++;

      } catch (error) {
        errorCount++;
        logger.error(`[TowerAggregation] 更新塔失败: ${tileId}`, {
          error: error.message
        });
        // 继续处理下一个塔，不中断批量更新
      }
    }

    const duration = Date.now() - startTime;
    logger.info(`[TowerAggregation] 批量更新完成`, {
      total: tileIds.length,
      success: successCount,
      errors: errorCount,
      duration: `${duration}ms`
    });

    return {
      success: true,
      total: tileIds.length,
      updated: successCount,
      errors: errorCount,
      duration
    };
  }

  /**
   * 批量重新聚合（用于数据修复或初始化）
   *
   * @param {Object} options - 选项
   * @param {number} options.batchSize - 每批处理数量
   * @param {Date} options.startDate - 开始日期
   * @param {Date} options.endDate - 结束日期
   */
  static async batchRebuildAggregates(options = {}) {
    const { batchSize = 10000, startDate, endDate } = options;

    logger.info('[TowerAggregation] Starting batch rebuild...', options);

    try {
      // 1. 清空现有聚合数据（注意顺序：先删除子表，再删除父表）
      logger.info('[TowerAggregation] 清空现有聚合数据...');
      await db('user_tower_floors').del(); // 使用 del() 代替 truncate() 避免外键问题
      await db('pixel_towers').del();

      // 2. 重建 pixel_towers（按 tile_id 聚合）
      let query = db('pixels_history as ph')
        .select(
          'ph.tile_id',
          db.raw('MAX(ph.latitude) as lat'),
          db.raw('MAX(ph.longitude) as lng'),
          db.raw('COUNT(*) as pixel_count'),
          db.raw('LOG(COUNT(*)) * 8 as height'),
          db.raw('COUNT(DISTINCT ph.user_id) as unique_users'),
          db.raw('MIN(ph.created_at) as first_pixel_time'),
          db.raw('MAX(ph.created_at) as last_pixel_time'),
          db.raw(`(
            SELECT COALESCE(pattern_id, 'color_default')
            FROM pixels_history
            WHERE tile_id = ph.tile_id
              AND action_type = 'draw'
            ORDER BY created_at DESC
            LIMIT 1
          ) as top_pattern_id`),
          db.raw(`(
            SELECT user_id
            FROM pixels_history
            WHERE tile_id = ph.tile_id
              AND action_type = 'draw'
            ORDER BY created_at DESC
            LIMIT 1
          ) as top_user_id`)
        )
        .where('action_type', 'draw');

      if (startDate) query = query.where('ph.created_at', '>=', startDate);
      if (endDate) query = query.where('ph.created_at', '<=', endDate);

      query = query.groupBy('ph.tile_id');

      const towers = await query;

      logger.info(`[TowerAggregation] Rebuilding ${towers.length} towers...`);

      // 批量插入
      for (let i = 0; i < towers.length; i += batchSize) {
        const batch = towers.slice(i, i + batchSize);
        await db('pixel_towers').insert(batch);
        logger.info(`[TowerAggregation] Inserted ${i + batch.length}/${towers.length} towers`);
      }

      // 3. 重建 user_tower_floors
      logger.info('[TowerAggregation] Rebuilding user_tower_floors...');

      await db.raw(`
        INSERT INTO user_tower_floors (user_id, tile_id, floor_count, contribution_pct, first_floor_index, last_floor_index)
        SELECT
          user_stats.user_id,
          user_stats.tile_id,
          user_stats.floor_count,
          ROUND((user_stats.floor_count::DECIMAL / pt.pixel_count) * 100, 2) as contribution_pct,
          user_stats.first_floor,
          user_stats.last_floor
        FROM (
          SELECT
            user_id,
            tile_id,
            COUNT(*) as floor_count,
            MIN(floor_index) as first_floor,
            MAX(floor_index) as last_floor
          FROM (
            SELECT
              user_id,
              tile_id,
              ROW_NUMBER() OVER (PARTITION BY tile_id ORDER BY created_at) - 1 as floor_index
            FROM pixels_history
            WHERE action_type = 'draw'
          ) floors
          GROUP BY user_id, tile_id
        ) user_stats
        JOIN pixel_towers pt ON user_stats.tile_id = pt.tile_id
      `);

      logger.info('[TowerAggregation] Batch rebuild completed successfully');

      return { success: true, towersCount: towers.length };

    } catch (error) {
      logger.error('[TowerAggregation] Batch rebuild failed', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
}

module.exports = TowerAggregationService;
