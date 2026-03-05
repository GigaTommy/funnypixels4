const drawingSessionService = require('../services/drawingSessionService');
const logger = require('../utils/logger');

class DrawingSessionController {
  /**
   * 开始新的绘制会话
   */
  async startSession(req, res) {
    try {
      const userId = req.user.id;
      const {
        sessionName,
        drawingType = 'manual',
        startLocation,
        startCity,
        startCountry,
        allianceId,
        metadata = {}
      } = req.body;

      // 检查用户是否已有活跃会话
      const existingSession = await drawingSessionService.getActiveSession(userId);
      if (existingSession) {
        // 验证会话在数据库中是否真的还是活跃状态
        const dbSession = await drawingSessionService.getSessionDetails(existingSession.id, userId);
        if (dbSession && dbSession.session.status === 'active') {
          return res.status(400).json({
            success: false,
            message: '您已有活跃的绘制会话，请先结束当前会话',
            data: existingSession
          });
        } else {
          // 会话在数据库中已经不是active状态，清除缓存
          logger.info(`清除过期的会话缓存: ${existingSession.id}`);
          // 继续创建新会话
        }
      }

      const session = await drawingSessionService.startDrawingSession(userId, {
        sessionName,
        drawingType,
        startLocation,
        startCity,
        startCountry,
        allianceId,
        metadata
      });

      res.json({
        success: true,
        message: '绘制会话已开始',
        data: session
      });

    } catch (error) {
      logger.error('开始绘制会话失败:', error);
      res.status(500).json({
        success: false,
        message: '开始绘制会话失败',
        error: error.message
      });
    }
  }

  /**
   * 结束绘制会话
   */
  async endSession(req, res) {
    try {
      const userId = req.user.id;
      const { sessionId } = req.params;
      const { endLocation, endCity, endCountry } = req.body;

      // 先验证会话是否属于当前用户
      const session = await drawingSessionService.getSessionDetails(sessionId, userId);
      if (!session) {
        return res.status(404).json({
          success: false,
          message: '会话不存在'
        });
      }

      const updatedSession = await drawingSessionService.endDrawingSession(sessionId, {
        endLocation,
        endCity,
        endCountry
      });

      // 每日任务进度更新
      try {
        const DailyTaskController = require('./dailyTaskController');
        const mapTaskGenerationService = require('../services/mapTaskGenerationService');

        // 🔧 FIX: 从 metadata.statistics 获取准确的像素数
        const pixelCount = updatedSession.metadata?.statistics?.pixelCount || 0;

        logger.info(`📊 会话结束任务更新: sessionId=${sessionId}, pixelCount=${pixelCount}`);

        // 基础任务更新
        // 🔧 FIX: 无论像素数是否为0，都更新会话数任务
        await DailyTaskController.updateTaskProgress(userId, 'draw_sessions', 1);

        // 只有像素数 > 0 时才更新像素任务
        if (pixelCount > 0) {
          await DailyTaskController.updateTaskProgress(userId, 'draw_pixels', pixelCount);

          // 🆕 地图任务更新
          try {
            // Update draw_at_location tasks (location-based drawing)
            if (updatedSession.start_latitude && updatedSession.start_longitude) {
              await mapTaskGenerationService.updateMapTaskProgress(userId, 'draw_at_location', {
                lat: updatedSession.start_latitude,
                lng: updatedSession.start_longitude,
                count: pixelCount
              });
            }

            // Update draw_distance tasks (GPS drawing distance)
            const gpsDistance = updatedSession.metadata?.statistics?.totalDistance || 0;
            if (gpsDistance > 0) {
              await mapTaskGenerationService.updateMapTaskProgress(userId, 'draw_distance', {
                distance: gpsDistance
              });
            }

            // Update explore_regions tasks (unique region exploration)
            const h3Index = updatedSession.metadata?.h3Index || updatedSession.h3_index;
            if (h3Index) {
              await mapTaskGenerationService.updateMapTaskProgress(userId, 'explore_regions', {
                h3Index: h3Index
              });
            }

            logger.info(`✅ 地图任务更新成功: userId=${userId}, distance=${gpsDistance}m, h3=${h3Index}`);
          } catch (mapTaskErr) {
            logger.error('更新地图任务进度失败（不影响主流程）:', mapTaskErr.message);
          }
        } else {
          logger.warn(`⚠️ 会话 ${sessionId} 的 pixelCount 为 0，跳过像素任务更新`);
        }
      } catch (taskErr) {
        logger.error('更新每日任务进度失败（不影响主流程）:', taskErr.message, taskErr);
        // 不影响主流程，继续执行
      }

      // 联盟经验值累积：成员画像素为联盟贡献经验
      try {
        const pixelCount = updatedSession.pixel_count || updatedSession.pixelCount || 0;
        if (pixelCount > 0) {
          const { db } = require('../config/database');
          const membership = await db('alliance_members')
            .where({ user_id: userId })
            .first();
          if (membership) {
            const expGain = Math.floor(pixelCount * 0.5); // 每像素0.5经验
            if (expGain > 0) {
              await db('alliances')
                .where('id', membership.alliance_id)
                .increment('experience', expGain);
            }
          }
        }
      } catch (allianceExpErr) {
        logger.error('联盟经验累积失败（不影响主流程）:', allianceExpErr.message);
      }

      res.json({
        success: true,
        message: '绘制会话已结束',
        data: updatedSession
      });

    } catch (error) {
      logger.error('结束绘制会话失败:', error);
      res.status(500).json({
        success: false,
        message: '结束绘制会话失败',
        error: error.message
      });
    }
  }

  /**
   * 获取当前活跃会话
   */
  async getActiveSession(req, res) {
    try {
      const userId = req.user.id;

      const session = await drawingSessionService.getActiveSession(userId);

      res.json({
        success: true,
        data: session || null
      });

    } catch (error) {
      logger.error('获取活跃会话失败:', error);
      res.status(500).json({
        success: false,
        message: '获取活跃会话失败',
        error: error.message
      });
    }
  }

  /**
   * 获取用户会话列表
   */
  async getUserSessions(req, res) {
    try {
      const userId = req.user.id;
      const {
        page = 1,
        limit = 20,
        status = 'completed',
        startDate,
        endDate,
        city
      } = req.query;

      const result = await drawingSessionService.getUserSessions(userId, {
        page: parseInt(page),
        limit: parseInt(limit),
        status,
        startDate,
        endDate,
        city
      });

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('获取用户会话列表失败:', error);
      logger.error('Query parameters:', {
        userId: req.user?.id,
        page: req.query.page,
        limit: req.query.limit,
        status: req.query.status,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        city: req.query.city
      });
      logger.error('Error stack:', error.stack);
      res.status(500).json({
        success: false,
        message: '获取用户会话列表失败',
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  /**
   * 获取会话详情
   */
  async getSessionDetails(req, res) {
    try {
      const userId = req.user.id;
      const { sessionId } = req.params;

      const result = await drawingSessionService.getSessionDetails(sessionId, userId);

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('获取会话详情失败:', error);
      res.status(500).json({
        success: false,
        message: '获取会话详情失败',
        error: error.message
      });
    }
  }

  /**
   * 获取会话像素列表
   * ✨ 支持查看其他用户的已完成会话（用于动态流）
   */
  async getSessionPixels(req, res) {
    try {
      const userId = req.user.id;
      const { sessionId } = req.params;

      logger.info(`📸 [getSessionPixels] Request: userId=${userId}, sessionId=${sessionId}`);

      // 🔄 第一次尝试：查询当前用户的会话
      let result = await drawingSessionService.getSessionDetails(sessionId, userId);
      logger.info(`📸 [getSessionPixels] First attempt result: ${result ? 'found' : 'not found'}`);

      // 🔄 如果会话不属于当前用户，检查是否为已完成的公开会话
      if (!result) {
        logger.info(`📸 [getSessionPixels] Not user's session, trying public access...`);
        result = await drawingSessionService.getSessionDetails(sessionId, null);
        logger.info(`📸 [getSessionPixels] Second attempt result: ${result ? 'found' : 'not found'}`);

        // 验证：只允许访问已完成的会话（保护隐私）
        if (result && result.session.status !== 'completed') {
          logger.warn(`📸 [getSessionPixels] Access denied: session status=${result.session.status}`);
          return res.status(403).json({
            success: false,
            message: '只能查看已完成的会话'
          });
        }
      }

      if (!result) {
        logger.warn(`📸 [getSessionPixels] Session not found: ${sessionId}`);
        return res.status(404).json({
          success: false,
          message: '会话不存在'
        });
      }

      logger.info(`📸 [getSessionPixels] Success: returning ${result.pixels.length} pixels`);
      res.json({
        success: true,
        data: {
          pixels: result.pixels
        }
      });

    } catch (error) {
      logger.error(`❌ [getSessionPixels] Error for sessionId=${req.params.sessionId}:`, error.message);
      logger.error('Stack:', error.stack);
      res.status(500).json({
        success: false,
        message: '获取会话像素列表失败',
        error: error.message
      });
    }
  }

  /**
   * 批量获取多个会话的像素数据（用于历史画廊优化）
   * POST /drawing-sessions/batch-pixels
   * Body: { sessionIds: ['id1', 'id2', ...] }
   */
  async getBatchPixels(req, res) {
    try {
      const userId = req.user.id;
      const { sessionIds } = req.body;

      // 参数验证
      if (!sessionIds || !Array.isArray(sessionIds)) {
        return res.status(400).json({
          success: false,
          message: 'sessionIds 必须是数组'
        });
      }

      if (sessionIds.length === 0) {
        return res.json({
          success: true,
          data: {}
        });
      }

      if (sessionIds.length > 50) {
        return res.status(400).json({
          success: false,
          message: '最多批量查询50个会话'
        });
      }

      // 批量获取像素（每个会话只返回前10个用于预览）
      const pixels = await drawingSessionService.getBatchSessionPixels(
        sessionIds,
        userId,
        { limit: 10 }
      );

      res.json({
        success: true,
        data: pixels
      });

    } catch (error) {
      logger.error('批量获取像素失败:', error);
      res.status(500).json({
        success: false,
        message: '批量获取像素失败',
        error: error.message
      });
    }
  }

  /**
   * 暂停会话
   */
  async pauseSession(req, res) {
    try {
      const userId = req.user.id;
      const { sessionId } = req.params;

      // 验证会话权限
      const session = await drawingSessionService.getSessionDetails(sessionId, userId);
      if (!session) {
        return res.status(404).json({
          success: false,
          message: '会话不存在'
        });
      }

      const updatedSession = await drawingSessionService.pauseSession(sessionId);

      res.json({
        success: true,
        message: '会话已暂停',
        data: updatedSession
      });

    } catch (error) {
      logger.error('暂停会话失败:', error);
      res.status(500).json({
        success: false,
        message: '暂停会话失败',
        error: error.message
      });
    }
  }

  /**
   * 恢复会话
   */
  async resumeSession(req, res) {
    try {
      const userId = req.user.id;
      const { sessionId } = req.params;

      // 验证会话权限
      const session = await drawingSessionService.getSessionDetails(sessionId, userId);
      if (!session) {
        return res.status(404).json({
          success: false,
          message: '会话不存在'
        });
      }

      const updatedSession = await drawingSessionService.resumeSession(sessionId);

      res.json({
        success: true,
        message: '会话已恢复',
        data: updatedSession
      });

    } catch (error) {
      logger.error('恢复会话失败:', error);
      res.status(500).json({
        success: false,
        message: '恢复会话失败',
        error: error.message
      });
    }
  }

  /**
   * 记录像素到会话
   */
  async recordPixel(req, res) {
    try {
      const userId = req.user.id;
      const { sessionId } = req.params;
      const pixelData = {
        ...req.body,
        user_id: userId
      };

      // 验证会话权限和状态
      const session = await drawingSessionService.getSessionDetails(sessionId, userId);
      if (!session) {
        return res.status(404).json({
          success: false,
          message: '会话不存在'
        });
      }

      if (session.session.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: '会话未激活，无法记录像素'
        });
      }

      await drawingSessionService.recordPixelToSession(sessionId, pixelData);

      res.json({
        success: true,
        message: '像素已记录到会话'
      });

    } catch (error) {
      logger.error('记录像素到会话失败:', error);
      res.status(500).json({
        success: false,
        message: '记录像素到会话失败',
        error: error.message
      });
    }
  }

  /**
   * 获取会话统计信息
   */
  async getSessionStatistics(req, res) {
    try {
      const userId = req.user.id;
      const { sessionId } = req.params;

      const session = await drawingSessionService.getSessionDetails(sessionId, userId);
      if (!session) {
        return res.status(404).json({
          success: false,
          message: '会话不存在'
        });
      }

      // 实时计算统计信息
      await drawingSessionService.calculateSessionStatistics(sessionId);
      const updatedSession = await drawingSessionService.getSessionDetails(sessionId, userId);

      res.json({
        success: true,
        data: {
          sessionId,
          statistics: updatedSession.session.metadata.statistics || {},
          pixelCount: updatedSession.pixels.length,
          session: updatedSession.session
        }
      });

    } catch (error) {
      logger.error('获取会话统计失败:', error);
      res.status(500).json({
        success: false,
        message: '获取会话统计失败',
        error: error.message
      });
    }
  }
}

module.exports = new DrawingSessionController();