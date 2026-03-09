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
   * @param {string} pixelData.color - 颜色
   * @param {Date} pixelData.created_at - 创建时间
   * @param {string} pixelData.tile_id - 瓦片ID（自动生成）
   */
  static async onPixelDrawn(pixelData) {
    const { lat, lng, user_id, color, created_at, tile_id } = pixelData;

    // 如果没有 tile_id（老数据），自动计算
    const actualTileId = tile_id || await this.calculateTileId(lat, lng);

    try {
      // 1. 更新或创建 tower 记录（使用 UPSERT）
      await this.updateTowerStats(actualTileId, lat, lng, user_id, color, created_at);

      // 2. 更新用户楼层索引
      await this.updateUserFloorIndex(user_id, actualTileId);

      // 3. 清除 Redis 缓存
      await this.clearTowerCache(actualTileId);

      logger.info(`[TowerAggregation] Updated tower ${actualTileId}`, {
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
   * 更新塔的统计数据
   * @private
   */
  static async updateTowerStats(tileId, lat, lng, userId, color, createdAt) {
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
        top_color,
        top_user_id,
        updated_at
      )
      VALUES (?, ?, ?, 1, 0.3, 1, ?, ?, ?, ?, NOW())
      ON CONFLICT (tile_id) DO UPDATE SET
        pixel_count = pixel_towers.pixel_count + 1,
        height = LOG(pixel_towers.pixel_count + 1) * 8,
        last_pixel_time = EXCLUDED.last_pixel_time,
        top_color = EXCLUDED.top_color,
        top_user_id = EXCLUDED.top_user_id,
        updated_at = NOW()
    `, [tileId, lat, lng, createdAt, createdAt, color, userId]);

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
      // 1. 清空现有聚合数据
      await db('user_tower_floors').truncate();
      await db('pixel_towers').truncate();

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
            SELECT color
            FROM pixels_history
            WHERE tile_id = ph.tile_id
            ORDER BY created_at DESC
            LIMIT 1
          ) as top_color`),
          db.raw(`(
            SELECT user_id
            FROM pixels_history
            WHERE tile_id = ph.tile_id
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
          user_id,
          tile_id,
          floor_count,
          ROUND((floor_count::DECIMAL / pt.pixel_count) * 100, 2) as contribution_pct,
          first_floor,
          last_floor
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
