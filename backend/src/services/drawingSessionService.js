const knex = require('knex');
const knexfile = require('../../knexfile');
const environment = process.env.LOCAL_VALIDATION === 'true' ? 'development' : (process.env.NODE_ENV || 'production');
const db = knex(knexfile[environment]);
const { redis } = require('../config/redis');
const logger = require('../utils/logger');
const Achievement = require('../models/Achievement');

class DrawingSessionService {
  constructor() {
    this.db = db;
  }

  /**
   * 开始新的绘制会话
   */
  async startDrawingSession(userId, options = {}) {
    const {
      sessionName = '绘制任务',
      drawingType = 'manual', // 'gps' | 'manual'
      startLocation = null,
      startCity = null,
      startCountry = null,
      allianceId = null,
      metadata = {}
    } = options;

    try {
      // 准备插入数据
      const now = new Date();
      const insertData = {
        user_id: userId,
        session_name: sessionName,
        drawing_type: drawingType,
        start_time: now, // 明确设置开始时间
        start_city: startCity,
        start_country: startCountry,
        alliance_id: allianceId,
        metadata: JSON.stringify(metadata),
        created_at: now,
        updated_at: now
      };

      // 如果有起始位置，使用PostGIS函数
      if (startLocation) {
        insertData.start_location = db.raw(`ST_SetSRID(ST_MakePoint(?, ?), 4326)`, [startLocation.longitude, startLocation.latitude]);
      }

      const [session] = await this.db('drawing_sessions')
        .insert(insertData)
        .returning('*');

      // 缓存当前活跃会话到Redis
      if (redis && typeof redis.set === 'function') {
        await redis.setex(
          `user_active_session:${userId}`,
          3600, // 1小时过期
          JSON.stringify(session)
        );
      }

      logger.info(`用户 ${userId} 开始绘制会话 ${session.id}`);
      return session;

    } catch (error) {
      logger.error('开始绘制会话失败:', error);
      throw error;
    }
  }

  /**
   * 结束绘制会话
   */
  async endDrawingSession(sessionId, options = {}) {
    const {
      endLocation = null,
      endCity = null,
      endCountry = null
    } = options;

    try {
      // 准备更新数据
      const updateData = {
        end_time: new Date(),
        status: 'completed',
        updated_at: new Date()
      };

      // 🔧 FIX: end_city 和 end_country 列不存在，已移除
      // if (endCity) updateData.end_city = endCity;
      // if (endCountry) updateData.end_country = endCountry;

      // 如果有结束位置，使用PostGIS函数
      if (endLocation) {
        updateData.end_location = db.raw(`ST_SetSRID(ST_MakePoint(?, ?), 4326)`, [endLocation.longitude, endLocation.latitude]);
      }

      const [session] = await this.db('drawing_sessions')
        .where({ id: sessionId, status: 'active' })
        .update(updateData)
        .returning('*');

      if (!session) {
        throw new Error('会话不存在或已结束');
      }

      // 清除Redis缓存
      if (redis && typeof redis.del === 'function') {
        await redis.del(`user_active_session:${session.user_id}`);
      }

      // 🔧 FIX: 先刷新批处理队列，确保所有像素都已写入数据库
      // 否则统计信息会不准确（会话结束时可能还有像素在批处理队列中）
      const batchPixelService = require('./batchPixelService');
      await batchPixelService.flushBatch();
      logger.info(`会话 ${sessionId} 批处理已刷新，准备计算统计信息`);

      // 计算会话统计信息
      await this.calculateSessionStatistics(sessionId);

      // 🚀 优化：清除用户的会话列表缓存（因为新增了完成的会话）
      await this.clearUserSessionsCache(session.user_id);

      // 更新GPS会话成就统计
      try {
        await Achievement.updateUserStats(session.user_id, { gps_sessions_count: 1 });
        logger.debug(`🏆 用户 ${session.user_id} GPS会话成就统计已更新`);
      } catch (achievementErr) {
        logger.warn('Drawing session achievement update failed:', achievementErr.message);
      }

      logger.info(`绘制会话 ${sessionId} 已结束`);
      return session;

    } catch (error) {
      logger.error('结束绘制会话失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户当前活跃会话
   */
  async getActiveSession(userId) {
    try {
      // 先从Redis获取
      if (redis && typeof redis.get === 'function') {
        const cachedSession = await redis.get(`user_active_session:${userId}`);
        if (cachedSession) {
          const session = JSON.parse(cachedSession);

          // 🆕 验证缓存中的会话在数据库中是否仍然是活跃状态
          const dbSession = await this.db('drawing_sessions')
            .where({
              id: session.id,
              user_id: userId,
              status: 'active'
            })
            .first();

          if (dbSession) {
            // 数据库验证通过，返回缓存的会话数据
            logger.debug(`缓存会话验证通过: ${session.id}`);
            return session;
          } else {
            // 数据库中不存在或不是活跃状态，清除过期缓存
            logger.info(`清除过期缓存会话: ${session.id}`);
            await redis.del(`user_active_session:${userId}`);
            // 继续从数据库查询最新状态
          }
        }
      }

      // Redis没有或缓存已过期，从数据库查询
      const session = await this.db('drawing_sessions')
        .where({ user_id: userId, status: 'active' })
        .orderBy('created_at', 'desc')
        .first();

      if (session && redis && typeof redis.setex === 'function') {
        // 更新Redis缓存
        await redis.setex(
          `user_active_session:${userId}`,
          3600,
          JSON.stringify(session)
        );
      }

      return session;

    } catch (error) {
      logger.error('获取活跃会话失败:', error);
      throw error;
    }
  }

  /**
   * 记录像素到会话
   */
  async recordPixelToSession(sessionId, pixelData) {
    try {
      // 准备插入数据
      const now = new Date();
      const insertData = {
        user_id: pixelData.user_id,
        session_id: sessionId,
        grid_id: pixelData.grid_id,
        pattern_id: pixelData.pattern_id,
        color: pixelData.color,
        history_date: now.toISOString().slice(0, 10), // YYYY-MM-DD format for partitioning
        created_at: now
      };

      // 直接设置经纬度字段
      if (pixelData.coordinates) {
        insertData.longitude = pixelData.coordinates.longitude || pixelData.lng;
        insertData.latitude = pixelData.coordinates.latitude || pixelData.lat;
      } else if (pixelData.longitude && pixelData.latitude) {
        insertData.longitude = pixelData.longitude;
        insertData.latitude = pixelData.latitude;
      }

      await this.db('pixels_history').insert(insertData);

    } catch (error) {
      logger.error('记录像素到会话失败:', error);
      throw error;
    }
  }

  /**
   * 计算会话统计信息
   */
  async calculateSessionStatistics(sessionId) {
    try {
      // 🔧 FIX: 从 pixels 表查询统计信息（立即可用，不依赖异步地理编码）
      // pixels_history 的写入是异步的，可能在会话结束时还未完成
      const stats = await this.db('pixels')
        .where({ session_id: sessionId })
        .select(
          this.db.raw('COUNT(*) as pixel_count'),
          this.db.raw('COUNT(DISTINCT grid_id) as unique_grids'),
          this.db.raw('COUNT(DISTINCT pattern_id) as patterns_used'),
          this.db.raw('MIN(created_at) as first_pixel_time'),
          this.db.raw('MAX(created_at) as last_pixel_time')
        )
        .first();

      if (!stats || parseInt(stats.pixel_count) === 0) {
        logger.warn(`会话 ${sessionId} 没有像素数据，跳过统计计算`);
        return;
      }

      // 🆕 核心逻辑：从第一笔记录中获取地理位置，补充会话信息
      // 优先从 pixels 表读取，如果没有地理信息则尝试 pixels_history
      let firstPixel = await this.db('pixels')
        .where({ session_id: sessionId })
        .whereNotNull('city')
        .orderBy('created_at', 'asc')
        .select('city', 'country', 'province', 'district')
        .first();

      // 如果 pixels 表还没有地理信息，尝试从 pixels_history 获取
      if (!firstPixel) {
        firstPixel = await this.db('pixels_history')
          .where({ session_id: sessionId })
          .whereNotNull('city')
          .orderBy('created_at', 'asc')
          .select('city', 'country', 'province', 'district')
          .first();
      }

      const sessionUpdate = {
        updated_at: new Date()
      };

      if (firstPixel) {
        sessionUpdate.start_city = firstPixel.city;
        sessionUpdate.start_country = firstPixel.country;
        // 如果 session_name 是默认值，则更新为城市名
        sessionUpdate.session_name = `${firstPixel.city || firstPixel.province || '未知地点'}绘制`;
      }

      // 计算持续时间（秒）
      let duration = 0;
      if (stats.first_pixel_time && stats.last_pixel_time) {
        duration = Math.floor((new Date(stats.last_pixel_time) - new Date(stats.first_pixel_time)) / 1000);
      }

      // 🔧 FIX: 从 pixels 表获取所有像素点的坐标用于计算距离
      const pixels = await this.db('pixels')
        .where({ session_id: sessionId })
        .whereNotNull('latitude')
        .whereNotNull('longitude')
        .select('latitude', 'longitude', 'created_at')
        .orderBy('created_at', 'asc');

      // 计算总移动距离（使用Haversine公式）
      let distance = 0;
      for (let i = 1; i < pixels.length; i++) {
        const prev = pixels[i - 1];
        const curr = pixels[i];
        distance += this.calculateDistance(
          prev.latitude, prev.longitude,
          curr.latitude, curr.longitude
        );
      }

      // 计算平均速度 (m/s)
      let avgSpeed = 0;
      if (duration > 0 && distance > 0) {
        avgSpeed = distance / duration;
      }

      // 计算效率（像素/分钟）
      let efficiency = 0;
      if (duration > 0) {
        efficiency = Math.round((parseInt(stats.pixel_count) / (duration / 60)) * 10) / 10;
      }

      // 构建统计数据（注意：使用 statistics 而不是 $statistics）
      const statistics = {
        pixelCount: parseInt(stats.pixel_count) || 0,
        uniqueGrids: parseInt(stats.unique_grids) || 0,
        patternsUsed: parseInt(stats.patterns_used) || 0,
        distance: Math.round(distance), // 米
        duration, // 秒
        avgSpeed: avgSpeed ? Math.round(avgSpeed * 10) / 10 : 0,
        efficiency,
        firstPixelTime: stats.first_pixel_time,
        lastPixelTime: stats.last_pixel_time
      };

      logger.info(`会话 ${sessionId} 统计信息:`, statistics);

      // 更新会话的统计信息（使用正确的键名 statistics）
      await this.db('drawing_sessions')
        .where({ id: sessionId })
        .update({
          ...sessionUpdate,
          metadata: this.db.raw(`
            COALESCE(metadata, '{}'::jsonb) ||
            jsonb_build_object('statistics', ?::jsonb, 'calculated_at', to_jsonb(NOW()))
          `, [JSON.stringify(statistics)]),
          updated_at: new Date()
        });

      logger.info(`会话 ${sessionId} 统计信息已更新`);

    } catch (error) {
      logger.error('计算会话统计失败:', error);
      throw error;
    }
  }

  /**
   * 清除用户的会话缓存（使用 SCAN 替代 KEYS）
   * @param {string} userId - 用户ID
   */
  async clearUserSessionsCache(userId) {
    if (!redis) {
      return;
    }

    try {
      // 🚀 优化：使用 SCAN 替代 KEYS（非阻塞）
      await this._scanAndDelete(`sessions:${userId}:*`);
      await this._scanAndDelete(`sessions:count:${userId}:*`);

      logger.debug(`🗑️ 清除用户缓存完成: ${userId}`);
    } catch (error) {
      logger.warn('清除缓存失败（非阻塞）:', error.message);
    }
  }

  /**
   * 使用 SCAN 命令批量删除匹配的键（非阻塞）
   * @private
   * @param {string} pattern - 匹配模式
   */
  async _scanAndDelete(pattern) {
    if (!redis || typeof redis.scan !== 'function') return;

    let cursor = '0';
    let totalDeleted = 0;

    do {
      // SCAN 是游标迭代，不阻塞 Redis
      const reply = await redis.scan(
        cursor,
        'MATCH', pattern,
        'COUNT', 100 // 每次扫描 100 个 key
      );

      cursor = reply[0];
      const keys = reply[1];

      if (keys && keys.length > 0) {
        await redis.del(...keys);
        totalDeleted += keys.length;
      }
    } while (cursor !== '0');

    if (totalDeleted > 0) {
      logger.debug(`删除了 ${totalDeleted} 个缓存键: ${pattern}`);
    }
  }

  /**
   * 使用Haversine公式计算两点之间的距离（米）
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // 地球半径，单位：米
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * 批量获取会话像素（优化版：只返回预览所需的前N个）
   * @param {Array<string>} sessionIds - 会话ID列表
   * @param {string} userId - 用户ID（用于权限验证）
   * @param {Object} options - 选项
   * @param {number} options.limit - 每个会话返回的最大像素数（默认10）
   * @returns {Object} 按会话ID分组的像素数据
   */
  async getBatchSessionPixels(sessionIds, userId, options = {}) {
    const { limit = 10 } = options;

    if (!sessionIds || sessionIds.length === 0) {
      return {};
    }

    // 限制：最多50个会话
    if (sessionIds.length > 50) {
      throw new Error('最多批量查询50个会话');
    }

    try {
      // 🎯 一次查询获取所有像素，使用窗口函数限制每个会话的数量
      const pixels = await this.db('pixels_history')
        .whereIn('session_id', sessionIds)
        .where('user_id', userId)
        .select(
          'grid_id',
          'session_id',
          'latitude',
          'longitude',
          'pattern_id',
          'color',
          'created_at',
          this.db.raw(`
            ROW_NUMBER() OVER (
              PARTITION BY session_id
              ORDER BY created_at ASC
            ) as pixel_index
          `)
        )
        .orderBy('session_id')
        .orderBy('created_at', 'asc');

      // 🎯 按会话分组，只保留前N个像素
      const grouped = {};
      for (const pixel of pixels) {
        // 跳过超出限制的像素
        if (parseInt(pixel.pixel_index) > limit) continue;

        if (!grouped[pixel.session_id]) {
          grouped[pixel.session_id] = [];
        }

        grouped[pixel.session_id].push({
          id: pixel.grid_id,
          grid_id: pixel.grid_id,
          latitude: parseFloat(pixel.latitude),
          longitude: parseFloat(pixel.longitude),
          pattern_id: pixel.pattern_id,
          color: pixel.color,
          created_at: pixel.created_at
        });
      }

      logger.debug(`批量获取像素: ${sessionIds.length}个会话, ${Object.keys(grouped).length}个有数据`);
      return grouped;

    } catch (error) {
      logger.error('批量获取会话像素失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户会话列表
   */
  async getUserSessions(userId, options = {}) {
    const {
      page = 1,
      limit = 20,
      status = 'completed',
      startDate,
      endDate,
      city
    } = options;

    // 🚀 优化：生成缓存键（包含所有查询参数）
    const cacheKey = `sessions:${userId}:${page}:${limit}:${status}:${startDate || ''}:${endDate || ''}:${city || ''}`;

    // 🚀 优化：尝试从Redis获取缓存
    if (redis && typeof redis.get === 'function') {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          logger.debug(`✅ 从缓存返回会话列表: ${cacheKey}`);
          return JSON.parse(cached);
        }
      } catch (cacheError) {
        logger.warn('Redis缓存读取失败（非阻塞）:', cacheError.message);
      }
    }

    const offset = (page - 1) * limit;
    let query = this.db('drawing_sessions').where({ user_id: userId });

    // 添加状态过滤
    if (status !== 'all') {
      if (status.includes(',')) {
        const statuses = status.split(',');
        query = query.whereIn('status', statuses);
      } else {
        query = query.where({ status });
      }
    }

    // 🆕 核心逻辑：过滤空会话（像素总数为0或不存在统计信息的会话）
    // 只显示有实际产出的记录
    // 🔧 FIX: 使用更安全的 JSON 访问方式，处理 NULL、缺失字段和类型转换错误
    query = query.whereRaw(`
      CASE
        WHEN metadata IS NULL THEN FALSE
        WHEN metadata->'statistics' IS NULL THEN FALSE
        WHEN metadata->'statistics'->>'pixelCount' IS NULL THEN FALSE
        WHEN metadata->'statistics'->>'pixelCount' = '' THEN FALSE
        ELSE (metadata->'statistics'->>'pixelCount')::int > 0
      END
    `);

    // 添加日期过滤 - 使用start_time,如果为NULL则使用created_at
    if (startDate) {
      query = query.where(function () {
        this.where('start_time', '>=', startDate)
          .orWhere(function () {
            this.whereNull('start_time').andWhere('created_at', '>=', startDate);
          });
      });
    }
    if (endDate) {
      query = query.where(function () {
        this.where('start_time', '<=', endDate)
          .orWhere(function () {
            this.whereNull('start_time').andWhere('created_at', '<=', endDate);
          });
      });
    }

    // 添加城市过滤
    if (city && city.trim()) {
      query = query.where('start_city', 'ilike', `%${city.trim()}%`);
    }

    try {
      // 🚀 优化：移除不必要的JOIN和CASE计算
      // - alliance信息：前端可以根据 alliance_id 单独查询（如果需要）
      // - duration：前端可以从 metadata.statistics.duration 获取
      // 这样可以大幅提升查询性能（特别是当表很大时）
      const sessions = await query
        .clone()
        .select(
          'drawing_sessions.id',
          'drawing_sessions.user_id',
          'drawing_sessions.session_name',
          'drawing_sessions.drawing_type',
          'drawing_sessions.start_time',
          'drawing_sessions.end_time',
          'drawing_sessions.status',
          'drawing_sessions.start_city',
          'drawing_sessions.start_country',
          // 🔧 FIX: 移除不存在的列 end_city 和 end_country
          // 'drawing_sessions.end_city',
          // 'drawing_sessions.end_country',
          'drawing_sessions.metadata',
          'drawing_sessions.alliance_id',
          'drawing_sessions.created_at',
          'drawing_sessions.updated_at'
        )
        .orderBy(this.db.raw('COALESCE(drawing_sessions.start_time, drawing_sessions.created_at)'), 'desc')
        .limit(limit)
        .offset(offset);

      // 🚀 优化：查询总数（使用缓存）
      const countCacheKey = `sessions:count:${userId}:${status}:${startDate || ''}:${endDate || ''}:${city || ''}`;
      let total = 0;

      // 尝试从缓存获取总数
      if (redis && typeof redis.get === 'function') {
        try {
          const cachedCount = await redis.get(countCacheKey);
          if (cachedCount) {
            total = parseInt(cachedCount);
            logger.debug(`✅ 从缓存返回总数: ${total}`);
          }
        } catch (cacheError) {
          logger.warn('Redis count缓存读取失败（非阻塞）:', cacheError.message);
        }
      }

      // 如果缓存未命中，查询数据库
      if (total === 0) {
        const totalResult = await query
          .clone()
          .clearSelect()
          .clearOrder()
          .count('* as total')
          .first();
        total = totalResult ? parseInt(totalResult.total) : 0;

        // 🚀 优化：缓存总数（30秒）
        if (redis && typeof redis.setex === 'function') {
          try {
            await redis.setex(countCacheKey, 30, total.toString());
          } catch (cacheError) {
            logger.warn('Redis count缓存写入失败（非阻塞）:', cacheError.message);
          }
        }
      }

      const result = {
        sessions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      };

      // 🚀 优化：缓存结果（60秒）
      if (redis && typeof redis.setex === 'function') {
        try {
          await redis.setex(cacheKey, 60, JSON.stringify(result));
          logger.debug(`✅ 缓存会话列表: ${cacheKey}`);
        } catch (cacheError) {
          logger.warn('Redis缓存写入失败（非阻塞）:', cacheError.message);
        }
      }

      return result;

    } catch (error) {
      logger.error('获取用户会话列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取会话详情
   */
  async getSessionDetails(sessionId, userId = null) {
    try {
      // 调试信息
      logger.debug('查询会话详情:', { sessionId, userId });

      // 🔧 FIX: Join alliances table to get flag_pattern_id for share view
      let sessionQuery = this.db('drawing_sessions')
        .leftJoin('alliances', 'drawing_sessions.alliance_id', 'alliances.id')
        .where({ 'drawing_sessions.id': sessionId })
        .select(
          'drawing_sessions.*',
          'alliances.flag_pattern_id as alliance_flag_pattern_id',
          'alliances.name as alliance_name'
        );

      if (userId) {
        sessionQuery = sessionQuery.andWhere({ 'drawing_sessions.user_id': userId });
      }

      // 调试查询
      logger.debug('会话查询SQL:', sessionQuery.toSQL());

      const session = await sessionQuery.first();
      if (!session) {
        throw new Error('会话不存在');
      }

      const pixels = await this.db('pixels_history')
        .leftJoin('pattern_assets', 'pixels_history.pattern_id', 'pattern_assets.key')
        .where({ session_id: sessionId })
        .select(
          'pixels_history.id',
          'pixels_history.grid_id',
          'pixels_history.longitude',
          'pixels_history.latitude',
          'pixels_history.pattern_id',
          'pixels_history.color',
          'pixels_history.city',
          'pixels_history.created_at',
          'pattern_assets.material_id',
          'pattern_assets.render_type'
        )
        .orderBy('pixels_history.created_at', 'asc');

      // 🔧 Fix: Ensure coordinates are numbers (Postgres numeric/decimal returns as string)
      const formattedPixels = pixels.map(p => ({
        ...p,
        latitude: parseFloat(p.latitude),
        longitude: parseFloat(p.longitude)
      }));

      // 🐛 Debug: Log pattern_id data
      logger.info(`📊 Session ${sessionId} details: ${pixels.length} pixels, sample pattern_ids: ${pixels.slice(0, 3).map(p => p.pattern_id || 'null').join(', ')}`);

      return {
        session,
        pixels: formattedPixels
      };

    } catch (error) {
      logger.error('获取会话详情失败:', error);
      throw error;
    }
  }

  /**
   * 暂停会话
   */
  async pauseSession(sessionId) {
    try {
      const [session] = await this.db('drawing_sessions')
        .where({ id: sessionId, status: 'active' })
        .update({
          status: 'paused',
          updated_at: new Date()
        })
        .returning('*');

      return session;

    } catch (error) {
      logger.error('暂停会话失败:', error);
      throw error;
    }
  }

  /**
   * 恢复会话
   */
  async resumeSession(sessionId) {
    try {
      const [session] = await this.db('drawing_sessions')
        .where({ id: sessionId, status: 'paused' })
        .update({
          status: 'active',
          updated_at: new Date()
        })
        .returning('*');

      return session;

    } catch (error) {
      logger.error('恢复会话失败:', error);
      throw error;
    }
  }

  /**
   * 清理过期会话
   */
  async cleanupExpiredSessions() {
    try {
      const result = await this.db('drawing_sessions')
        .where({ status: 'active' })
        .where('start_time', '<', this.db.raw("NOW() - INTERVAL '24 hours'"))
        .update({
          status: 'expired',
          updated_at: new Date()
        });

      logger.info(`清理了 ${result} 个过期会话`);

    } catch (error) {
      logger.error('清理过期会话失败:', error);
    }
  }
}

module.exports = new DrawingSessionService();