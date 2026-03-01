const { db } = require('../config/database');
const { redis } = require('../config/redis');
const logger = require('../utils/logger');
const Achievement = require('../models/Achievement');

class SessionHeartbeatService {
  constructor() {
    this.db = db;
    this.heartbeatInterval = 2 * 60 * 1000; // 2分钟心跳间隔
    this.sessionTimeout = 10 * 60 * 1000; // 10分钟无活动超时
    this.cleanupInterval = 5 * 60 * 1000; // 5分钟清理间隔

    this.startPeriodicCleanup();
    logger.info('🔐 SessionHeartbeatService 初始化完成');
  }

  /**
   * 更新会话心跳
   */
  async updateHeartbeat(sessionId, userId) {
    try {
      const now = new Date();
      const heartbeatData = {
        sessionId,
        userId,
        lastHeartbeat: now.toISOString(),
        isActive: true
      };

      // 更新Redis心跳
      if (redis) {
        const heartbeatKey = `session_heartbeat:${sessionId}`;
        await redis.setex(heartbeatKey, 3600, JSON.stringify(heartbeatData));

        // 更新用户活跃会话映射
        const userSessionKey = `user_active_session:${userId}`;
        await redis.setex(userSessionKey, 3600, JSON.stringify({
          sessionId,
          lastHeartbeat: now.toISOString()
        }));
      }

      // 更新数据库中的last_activity
      await this.db('drawing_sessions')
        .where({ id: sessionId, user_id: userId })
        .update({
          last_activity: now,
          updated_at: now
        });

      logger.debug(`会话心跳更新成功: ${sessionId.slice(0, 8)}...`);

      return { success: true };

    } catch (error) {
      logger.error('更新会话心跳失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 检查会话是否仍然活跃
   */
  async isSessionActive(sessionId) {
    try {
      // 先检查Redis中的心跳
      if (redis) {
        const heartbeatKey = `session_heartbeat:${sessionId}`;
        const heartbeatData = await redis.get(heartbeatKey);

        if (heartbeatData) {
          const heartbeat = JSON.parse(heartbeatData);
          const lastHeartbeat = new Date(heartbeat.lastHeartbeat);
          const timeSinceLastHeartbeat = Date.now() - lastHeartbeat.getTime();

          return timeSinceLastHeartbeat < this.sessionTimeout;
        }
      }

      // Redis中没有记录，检查数据库
      const session = await this.db('drawing_sessions')
        .where({ id: sessionId })
        .first();

      if (!session) {
        return false;
      }

      // 检查最后活动时间
      const lastActivity = session.last_activity || session.updated_at;
      const timeSinceLastActivity = Date.now() - new Date(lastActivity).getTime();

      return timeSinceLastActivity < this.sessionTimeout;

    } catch (error) {
      logger.error('检查会话活跃状态失败:', error);
      return false;
    }
  }

  /**
   * 检查用户的活跃会话
   */
  async getActiveSessionForUser(userId) {
    try {
      // 先检查Redis
      if (redis) {
        const userSessionKey = `user_active_session:${userId}`;
        const userSessionData = await redis.get(userSessionKey);

        if (userSessionData) {
          const userSession = JSON.parse(userSessionData);
          const sessionId = userSession.sessionId;

          // 验证会话是否仍然活跃
          if (await this.isSessionActive(sessionId)) {
            const session = await this.db('drawing_sessions')
              .where({ id: sessionId, user_id: userId, status: 'active' })
              .first();

            if (session) {
              return session;
            }
          }
        }
      }

      // Redis中没有或会话不活跃，检查数据库
      const session = await this.db('drawing_sessions')
        .where({ user_id: userId, status: 'active' })
        .orderBy('last_activity', 'desc')
        .first();

      if (session) {
        const lastActivity = session.last_activity || session.updated_at;
        const timeSinceLastActivity = Date.now() - new Date(lastActivity).getTime();

        if (timeSinceLastActivity < this.sessionTimeout) {
          return session;
        }
      }

      return null;

    } catch (error) {
      logger.error('获取用户活跃会话失败:', error);
      return null;
    }
  }

  /**
   * 清理不活跃的会话
   */
  async cleanupInactiveSessions() {
    try {
      const cutoffTime = new Date(Date.now() - this.sessionTimeout);

      // 1. 先找出所有超时的会话ID
      const timedOutSessions = await this.db('drawing_sessions')
        .where({ status: 'active' })
        .andWhere(function () {
          this.where('last_activity', '<', cutoffTime)
            .orWhere(function () {
              this.whereNull('last_activity').andWhere('updated_at', '<', cutoffTime);
            });
        })
        .select('id', 'user_id');

      if (timedOutSessions.length === 0) {
        return;
      }

      logger.info(`发现 ${timedOutSessions.length} 个可能的超时会话，准备清理并更新统计信息...`);

      const sessionIds = timedOutSessions.map(s => s.id);

      // 2. 批量更新状态为切换中，或者直接开始处理
      for (const session of timedOutSessions) {
        try {
          // 为每个超时会话计算统计信息和地理位置
          await this.calculateSessionStatistics(session.id);

          // 更新状态
          await this.db('drawing_sessions')
            .where({ id: session.id })
            .update({
              status: 'timeout',
              end_time: this.db.raw('COALESCE(last_activity, updated_at)'),
              updated_at: new Date()
            });

          // 清理Redis缓存
          if (redis) {
            await redis.del(`session_heartbeat:${session.id}`);
            await redis.del(`user_active_session:${session.userId}`);
          }
        } catch (singleError) {
          logger.error(`清理会话 ${session.id} 失败:`, singleError);
        }
      }

      logger.info(`成功清理了 ${timedOutSessions.length} 个超时会话并同步了统计信息`);

    } catch (error) {
      logger.error('清理不活跃会话失败:', error);
    }
  }

  /**
   * 优雅结束会话
   */
  async endSessionGracefully(sessionId, options = {}) {
    try {
      const session = await this.db('drawing_sessions')
        .where({ id: sessionId, status: 'active' })
        .first();

      if (!session) {
        logger.warn(`会话 ${sessionId.slice(0, 8)}... 不存在或已结束`);
        return { success: false, message: '会话不存在或已结束' };
      }

      // 计算会话统计信息
      await this.calculateSessionStatistics(sessionId);

      // 结束会话
      const endedSession = await this.db('drawing_sessions')
        .where({ id: sessionId })
        .update({
          status: 'completed',
          end_time: new Date(),
          updated_at: new Date(),
          ...options.endLocation && {
            end_location: this.db.raw(`ST_SetSRID(ST_MakePoint(?, ?), 4326)`, [
              options.endLocation.longitude,
              options.endLocation.latitude
            ])
          }
        });

      // 清理Redis缓存
      if (redis) {
        await redis.del(`session_heartbeat:${sessionId}`);
        await redis.del(`user_active_session:${session.user_id}`);
      }

      logger.info(`会话 ${sessionId.slice(0, 8)}... 已优雅结束`);

      // 更新GPS会话成就统计
      try {
        await Achievement.updateUserStats(session.user_id, { gps_sessions_count: 1 });
        logger.debug(`🏆 用户 ${session.user_id} GPS会话成就统计已更新`);
      } catch (achievementErr) {
        logger.warn('GPS session achievement update failed:', achievementErr.message);
      }

      return { success: true, session: endedSession };

    } catch (error) {
      logger.error('优雅结束会话失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 计算会话统计信息
   */
  async calculateSessionStatistics(sessionId) {
    try {
      const stats = await this.db('pixels_history')
        .where({ session_id: sessionId })
        .select(
          this.db.raw('COUNT(*) as pixel_count'),
          this.db.raw('COUNT(DISTINCT grid_id) as unique_grids'),
          this.db.raw('COUNT(DISTINCT pattern_id) as patterns_used'),
          this.db.raw('MIN(created_at) as first_pixel_time'),
          this.db.raw('MAX(created_at) as last_pixel_time')
        )
        .first();

      if (!stats || !stats.pixel_count || parseInt(stats.pixel_count) === 0) {
        return;
      }

      // 🆕 核心逻辑：从第一笔记录中获取地理位置，补充会话信息
      const firstPixel = await this.db('pixels_history')
        .where({ session_id: sessionId })
        .whereNotNull('city')
        .orderBy('created_at', 'asc')
        .select('city', 'country', 'province')
        .first();

      const sessionUpdate = {};
      if (firstPixel) {
        sessionUpdate.start_city = firstPixel.city;
        sessionUpdate.start_country = firstPixel.country;
        sessionUpdate.session_name = `${firstPixel.city || firstPixel.province || '未知地点'}绘制`;
      }

      let duration = 0;
      if (stats.first_pixel_time && stats.last_pixel_time) {
        duration = Math.floor((new Date(stats.last_pixel_time) - new Date(stats.first_pixel_time)) / 1000 / 60);
      }

      const statistics = {
        pixelCount: parseInt(stats.pixel_count) || 0,
        uniqueGrids: parseInt(stats.unique_grids) || 0,
        patternsUsed: parseInt(stats.patterns_used) || 0,
        firstPixelTime: stats.first_pixel_time,
        lastPixelTime: stats.last_pixel_time,
        duration
      };

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

    } catch (error) {
      logger.error('计算会话统计失败:', error);
    }
  }

  /**
   * 启动定期清理任务
   */
  startPeriodicCleanup() {
    setInterval(async () => {
      await this.cleanupInactiveSessions();
    }, this.cleanupInterval);

    logger.info('🕐 会话心跳清理任务已启动，间隔: ' + (this.cleanupInterval / 1000 / 60) + ' 分钟');
  }

  /**
   * 处理页面可见性变化
   */
  async handleVisibilityChange(sessionId, userId, isVisible) {
    if (isVisible) {
      // 页面可见时更新心跳
      await this.updateHeartbeat(sessionId, userId);
    } else {
      // 页面不可见时标记为暂停状态
      await this.db('drawing_sessions')
        .where({ id: sessionId, user_id: userId })
        .update({
          status: 'paused',
          updated_at: new Date()
        });
    }
  }
}

module.exports = new SessionHeartbeatService();