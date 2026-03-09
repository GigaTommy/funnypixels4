/**
 * Tower Controller
 * Task: #35 - Week 1 Backend API
 *
 * 3D 像素塔 API 端点
 * - 视口查询（轻量级）
 * - 单塔详情（楼层数据）
 * - 我的塔列表
 *
 * Performance:
 * - Redis caching (30s for viewport, 5min for tower details)
 * - Optimized queries on aggregation tables
 */

const { db } = require('../config/database');
const logger = require('../utils/logger');
const { getRedis } = require('../config/redis');

class TowerController {
  /**
   * GET /api/towers/viewport
   * 获取视口范围内的所有塔（轻量级摘要）
   *
   * Query params:
   * - minLat, maxLat, minLng, maxLng: Viewport bounds
   * - limit: Max results (default 2000)
   *
   * Response:
   * {
   *   success: true,
   *   data: {
   *     towers: [
   *       {
   *         tile_id: "18/123456/789012",
   *         lat: 39.904,
   *         lng: 116.407,
   *         pixel_count: 42,
   *         height: 16.8,
   *         top_color: "#FF0000",
   *         unique_users: 12
   *       }
   *     ]
   *   }
   * }
   */
  static async getViewportTowers(req, res) {
    const startTime = Date.now();
    try {
      const { minLat, maxLat, minLng, maxLng, limit = 2000 } = req.query;

      // 参数验证
      if (!minLat || !maxLat || !minLng || !maxLng) {
        return res.status(400).json({
          success: false,
          message: 'Missing required parameters: minLat, maxLat, minLng, maxLng'
        });
      }

      const bounds = {
        minLat: parseFloat(minLat),
        maxLat: parseFloat(maxLat),
        minLng: parseFloat(minLng),
        maxLng: parseFloat(maxLng)
      };

      // 验证边界合法性
      if (bounds.minLat >= bounds.maxLat || bounds.minLng >= bounds.maxLng) {
        return res.status(400).json({
          success: false,
          message: 'Invalid bounds: min values must be less than max values'
        });
      }

      // Redis 缓存
      const cacheKey = `tower:viewport:${minLat}:${maxLat}:${minLng}:${maxLng}:${limit}`;
      const redis = getRedis();

      if (redis && redis.isOpen) {
        try {
          const cached = await redis.get(cacheKey);
          if (cached) {
            const duration = Date.now() - startTime;
            logger.info(`[Tower] Viewport cache HIT in ${duration}ms`);
            return res.json(JSON.parse(cached));
          }
        } catch (redisError) {
          logger.warn('[Tower] Redis cache read error', { error: redisError.message });
        }
      }

      // 查询聚合表（超快）
      const rawTowers = await db('pixel_towers')
        .whereBetween('lat', [bounds.minLat, bounds.maxLat])
        .whereBetween('lng', [bounds.minLng, bounds.maxLng])
        .orderBy('height', 'desc')
        .limit(parseInt(limit))
        .select(
          'tile_id',
          'lat',
          'lng',
          'pixel_count',
          'height',
          'top_color',
          'unique_users'
        );

      // 转换数据类型（确保数字类型正确）
      const towers = rawTowers.map(tower => ({
        tile_id: tower.tile_id,
        lat: parseFloat(tower.lat),
        lng: parseFloat(tower.lng),
        pixel_count: parseInt(tower.pixel_count),
        height: parseFloat(tower.height),
        top_color: tower.top_color,
        unique_users: parseInt(tower.unique_users)
      }));

      const response = {
        success: true,
        data: {
          towers,
          count: towers.length,
          bounds
        }
      };

      // 缓存 30 秒
      if (redis && redis.isOpen) {
        try {
          await redis.setEx(cacheKey, 30, JSON.stringify(response));
        } catch (redisError) {
          logger.warn('[Tower] Redis cache write error', { error: redisError.message });
        }
      }

      const duration = Date.now() - startTime;
      logger.info(`[Tower] Viewport query completed in ${duration}ms`, {
        count: towers.length,
        cached: false
      });

      res.json(response);

    } catch (error) {
      logger.error('[Tower] Get viewport towers failed', {
        error: error.message,
        stack: error.stack
      });
      res.status(500).json({
        success: false,
        message: 'Failed to load towers',
        error: error.message
      });
    }
  }

  /**
   * GET /api/towers/:tileId/floors
   * 获取单个塔的完整楼层数据
   *
   * Query params:
   * - userId: Optional, 高亮用户楼层
   * - page: Page number (default 1)
   * - limit: Results per page (default 100)
   *
   * Response:
   * {
   *   success: true,
   *   data: {
   *     tileId: "18/123456/789012",
   *     floors: [
   *       {
   *         floor_index: 0,
   *         color: "#FF0000",
   *         user_id: "...",
   *         timestamp: "2026-03-01T10:00:00Z",
   *         username: "Alice",
   *         avatar_url: "/uploads/avatars/..."
   *       }
   *     ],
   *     totalFloors: 42,
   *     userFloors: {  // Only if userId provided
   *       floor_count: 5,
   *       contribution_pct: 11.9,
   *       first_floor_index: 3,
   *       last_floor_index: 38
   *     }
   *   }
   * }
   */
  static async getTowerFloors(req, res) {
    const startTime = Date.now();
    try {
      const { tileId } = req.params;
      const { userId, page = 1, limit = 100 } = req.query;

      if (!tileId) {
        return res.status(400).json({
          success: false,
          message: 'Missing required parameter: tileId'
        });
      }

      const pageNum = parseInt(page);
      const pageSize = parseInt(limit);
      const offset = (pageNum - 1) * pageSize;

      // Redis 缓存（不包含 userId 的基础数据）
      const cacheKey = `tower:${tileId}:floors:${pageNum}:${pageSize}`;
      const redis = getRedis();

      let cachedData = null;
      if (redis && redis.isOpen && !userId) {
        try {
          const cached = await redis.get(cacheKey);
          if (cached) {
            cachedData = JSON.parse(cached);
            const duration = Date.now() - startTime;
            logger.info(`[Tower] Floors cache HIT in ${duration}ms`, { tile_id: tileId });
          }
        } catch (redisError) {
          logger.warn('[Tower] Redis cache read error', { error: redisError.message });
        }
      }

      // 如果没有缓存，查询数据库
      if (!cachedData) {
        // 查询完整楼层历史
        const floorsResult = await db.raw(`
          SELECT
            ROW_NUMBER() OVER (ORDER BY ph.created_at) - 1 as floor_index,
            ph.color,
            ph.user_id,
            ph.created_at as timestamp,
            u.username,
            u.avatar_url
          FROM pixels_history ph
          LEFT JOIN users u ON ph.user_id = u.id
          WHERE ph.tile_id = ?
            AND ph.action_type = 'draw'
          ORDER BY ph.created_at ASC
          LIMIT ? OFFSET ?
        `, [tileId, pageSize, offset]);

        // 查询总数
        const countResult = await db.raw(`
          SELECT COUNT(*) as total
          FROM pixels_history
          WHERE tile_id = ?
            AND action_type = 'draw'
        `, [tileId]);

        const totalFloors = parseInt(countResult.rows[0]?.total || 0);

        cachedData = {
          tileId,
          floors: floorsResult.rows,
          totalFloors,
          pagination: {
            page: pageNum,
            limit: pageSize,
            totalPages: Math.ceil(totalFloors / pageSize)
          }
        };

        // 缓存 5 分钟
        if (redis && redis.isOpen) {
          try {
            await redis.setEx(cacheKey, 300, JSON.stringify(cachedData));
          } catch (redisError) {
            logger.warn('[Tower] Redis cache write error', { error: redisError.message });
          }
        }
      }

      // 如果提供了 userId，添加用户楼层信息
      let userFloors = null;
      if (userId) {
        userFloors = await TowerController.getUserFloorsInTower(userId, tileId);
      }

      const response = {
        success: true,
        data: {
          ...cachedData,
          userFloors
        }
      };

      const duration = Date.now() - startTime;
      logger.info(`[Tower] Floors query completed in ${duration}ms`, {
        tile_id: tileId,
        total: cachedData.totalFloors
      });

      res.json(response);

    } catch (error) {
      logger.error('[Tower] Get tower floors failed', {
        error: error.message,
        tileId: req.params.tileId
      });
      res.status(500).json({
        success: false,
        message: 'Failed to load tower floors',
        error: error.message
      });
    }
  }

  /**
   * GET /api/towers/my-towers
   * 获取当前用户参与建造的所有塔
   *
   * Response:
   * {
   *   success: true,
   *   data: {
   *     towers: [
   *       {
   *         tile_id: "18/123456/789012",
   *         lat: 39.904,
   *         lng: 116.407,
   *         height: 16.8,
   *         pixel_count: 42,
   *         floor_count: 5,
   *         contribution_pct: 11.9,
   *         first_floor_index: 3,
   *         last_floor_index: 38
   *       }
   *     ]
   *   }
   * }
   */
  static async getMyTowers(req, res) {
    try {
      const userId = req.user.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const myTowers = await db('user_tower_floors as utf')
        .join('pixel_towers as pt', 'utf.tile_id', 'pt.tile_id')
        .where('utf.user_id', userId)
        .orderBy('utf.floor_count', 'desc')
        .select(
          'pt.tile_id',
          'pt.lat',
          'pt.lng',
          'pt.height',
          'pt.pixel_count',
          'utf.floor_count',
          'utf.contribution_pct',
          'utf.first_floor_index',
          'utf.last_floor_index'
        );

      res.json({
        success: true,
        data: {
          towers: myTowers,
          count: myTowers.length
        }
      });

    } catch (error) {
      logger.error('[Tower] Get my towers failed', {
        error: error.message,
        userId: req.user?.id
      });
      res.status(500).json({
        success: false,
        message: 'Failed to load your towers',
        error: error.message
      });
    }
  }

  /**
   * 辅助方法：获取用户在某个塔的楼层信息
   * @private
   */
  static async getUserFloorsInTower(userId, tileId) {
    try {
      const result = await db('user_tower_floors')
        .where({ user_id: userId, tile_id: tileId })
        .first();

      return result || null;
    } catch (error) {
      logger.warn('[Tower] Get user floors failed', {
        error: error.message,
        user_id: userId,
        tile_id: tileId
      });
      return null;
    }
  }
}

module.exports = TowerController;
