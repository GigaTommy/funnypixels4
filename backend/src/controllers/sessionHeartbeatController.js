const sessionHeartbeatService = require('../services/sessionHeartbeatService');
const logger = require('../utils/logger');

class SessionHeartbeatController {
  /**
   * 更新会话心跳
   */
  async updateHeartbeat(req, res) {
    try {
      const userId = req.user.id;
      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: '缺少sessionId参数'
        });
      }

      const result = await sessionHeartbeatService.updateHeartbeat(sessionId, userId);

      if (result.success) {
        res.json({
          success: true,
          message: '心跳更新成功'
        });
      } else {
        res.status(500).json({
          success: false,
          message: '心跳更新失败',
          error: result.error
        });
      }

    } catch (error) {
      logger.error('更新心跳失败:', error);
      res.status(500).json({
        success: false,
        message: '更新心跳失败',
        error: error.message
      });
    }
  }

  /**
   * 检查会话活跃状态
   */
  async checkSessionActive(req, res) {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: '缺少sessionId参数'
        });
      }

      const isActive = await sessionHeartbeatService.isSessionActive(sessionId);

      res.json({
        success: true,
        data: {
          sessionId,
          isActive
        }
      });

    } catch (error) {
      logger.error('检查会话活跃状态失败:', error);
      res.status(500).json({
        success: false,
        message: '检查会话活跃状态失败',
        error: error.message
      });
    }
  }

  /**
   * 处理页面可见性变化
   */
  async handleVisibilityChange(req, res) {
    try {
      const userId = req.user.id;
      const { sessionId, isVisible } = req.body;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: '缺少sessionId参数'
        });
      }

      await sessionHeartbeatService.handleVisibilityChange(sessionId, userId, isVisible);

      res.json({
        success: true,
        message: isVisible ? '页面可见，心跳已更新' : '页面不可见，会话已暂停'
      });

    } catch (error) {
      logger.error('处理页面可见性变化失败:', error);
      res.status(500).json({
        success: false,
        message: '处理页面可见性变化失败',
        error: error.message
      });
    }
  }

  /**
   * 优雅结束会话
   */
  async endSessionGracefully(req, res) {
    try {
      const userId = req.user.id;
      const { sessionId } = req.params;
      const { endLocation } = req.body;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: '缺少sessionId参数'
        });
      }

      const result = await sessionHeartbeatService.endSessionGracefully(sessionId, {
        endLocation
      });

      if (result.success) {
        res.json({
          success: true,
          message: '会话已优雅结束'
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message || '结束会话失败',
          error: result.error
        });
      }

    } catch (error) {
      logger.error('优雅结束会话失败:', error);
      res.status(500).json({
        success: false,
        message: '优雅结束会话失败',
        error: error.message
      });
    }
  }

  /**
   * 获取用户的活跃会话（带心跳检查）
   */
  async getActiveSessionWithHeartbeat(req, res) {
    try {
      const userId = req.user.id;

      const session = await sessionHeartbeatService.getActiveSessionForUser(userId);

      res.json({
        success: true,
        data: session
      });

    } catch (error) {
      logger.error('获取用户活跃会话失败:', error);
      res.status(500).json({
        success: false,
        message: '获取用户活跃会话失败',
        error: error.message
      });
    }
  }
}

module.exports = new SessionHeartbeatController();