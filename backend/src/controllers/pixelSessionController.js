const PixelSessionService = require('../services/pixelSessionService');
const logger = require('../utils/logger');

class PixelSessionController {
  /**
   * 获取用户绘制会话历史
   */
  static async getUserDrawingSessions(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20, threshold = 30 } = req.query;

      const result = await PixelSessionService.getUserDrawingSessions(userId, {
        page: parseInt(page),
        limit: parseInt(limit),
        sessionThreshold: parseInt(threshold)
      });

      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }

    } catch (error) {
      logger.error('获取绘制会话历史失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器错误',
        error: error.message
      });
    }
  }

  /**
   * 获取会话详情
   */
  static async getSessionDetails(req, res) {
    try {
      const userId = req.user.id;
      const { sessionId } = req.params;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: '缺少会话ID'
        });
      }

      const result = await PixelSessionService.getSessionDetails(userId, sessionId);

      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }

    } catch (error) {
      logger.error('获取会话详情失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器错误',
        error: error.message
      });
    }
  }

  /**
   * 获取用户绘制统计数据
   */
  static async getUserDrawingStats(req, res) {
    try {
      const userId = req.user.id;

      const result = await PixelSessionService.getUserDrawingStats(userId);

      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }

    } catch (error) {
      logger.error('获取用户绘制统计失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器错误',
        error: error.message
      });
    }
  }

  /**
   * 获取绘制历史概览（用于仪表板）
   */
  static async getDrawingHistoryOverview(req, res) {
    try {
      const userId = req.user.id;

      // 获取最近的会话和统计数据
      const [sessionsResult, statsResult] = await Promise.all([
        PixelSessionService.getUserDrawingSessions(userId, { limit: 5 }),
        PixelSessionService.getUserDrawingStats(userId)
      ]);

      if (sessionsResult.success && statsResult.success) {
        res.json({
          success: true,
          data: {
            recentSessions: sessionsResult.data.sessions,
            statistics: statsResult.data,
            summary: sessionsResult.data.summary
          }
        });
      } else {
        res.status(500).json({
          success: false,
          message: '获取数据失败'
        });
      }

    } catch (error) {
      logger.error('获取绘制历史概览失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器错误',
        error: error.message
      });
    }
  }

  /**
   * 导出绘制历史数据
   */
  static async exportDrawingHistory(req, res) {
    try {
      const userId = req.user.id;
      const { format = 'json', startDate, endDate } = req.query;

      // 构建查询条件
      const whereConditions = ['user_id = :userId'];
      const queryParams = { userId };

      if (startDate) {
        whereConditions.push('created_at >= :startDate');
        queryParams.startDate = startDate;
      }

      if (endDate) {
        whereConditions.push('created_at <= :endDate');
        queryParams.endDate = endDate;
      }

      const historyQuery = `
        SELECT
          id,
          created_at,
          latitude,
          longitude,
          city,
          country,
          grid_id,
          pattern_id,
          action_type,
          color,
          history_date
        FROM pixels_history
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY created_at DESC
      `;

      const { db } = require('../config/database');
      const history = await db.raw(historyQuery, queryParams);

      const exportData = {
        exportInfo: {
          userId,
          exportTime: new Date().toISOString(),
          recordCount: history.rows.length,
          dateRange: {
            start: startDate || null,
            end: endDate || null
          }
        },
        records: history.rows
      };

      if (format === 'csv') {
        // CSV格式导出
        const csvHeader = 'ID,时间,纬度,经度,城市,国家,网格ID,图案ID,操作类型,颜色\n';
        const csvData = history.rows.map(row =>
          `${row.id},${row.created_at},${row.latitude},${row.longitude},${row.city},${row.country},${row.grid_id},${row.pattern_id},${row.action_type},${row.color}`
        ).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="drawing_history_${userId}_${Date.now()}.csv"`);
        res.send(csvHeader + csvData);
      } else {
        // JSON格式导出
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="drawing_history_${userId}_${Date.now()}.json"`);
        res.json(exportData);
      }

    } catch (error) {
      logger.error('导出绘制历史失败:', error);
      res.status(500).json({
        success: false,
        message: '导出失败',
        error: error.message
      });
    }
  }
}

module.exports = PixelSessionController;