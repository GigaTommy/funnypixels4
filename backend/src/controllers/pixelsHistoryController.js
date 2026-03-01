const pixelsHistoryService = require('../services/pixelsHistoryService');
const logger = require('../utils/logger');

/**
 * 像素历史控制器
 * 处理像素历史相关的API请求
 */
class PixelsHistoryController {
  /**
   * 获取用户像素操作历史
   * GET /api/pixels-history/user/:userId
   */
  async getUserPixelHistory(req, res) {
    try {
      const { userId } = req.params;
      const {
        startDate,
        endDate,
        actionType,
        limit = 100,
        offset = 0
      } = req.query;

      // 验证用户ID (UUID格式)
      if (!userId || !userId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        return res.status(400).json({
          success: false,
          error: '无效的用户ID格式'
        });
      }

      // 验证日期格式
      if (startDate && isNaN(Date.parse(startDate))) {
        return res.status(400).json({
          success: false,
          error: '无效的开始日期格式'
        });
      }

      if (endDate && isNaN(Date.parse(endDate))) {
        return res.status(400).json({
          success: false,
          error: '无效的结束日期格式'
        });
      }

      // 验证分页参数
      const limitNum = Math.min(parseInt(limit) || 100, 1000); // 最大1000条
      const offsetNum = Math.max(parseInt(offset) || 0, 0);

      const result = await pixelsHistoryService.getUserPixelHistory(userId, {
        startDate,
        endDate,
        actionType,
        limit: limitNum,
        offset: offsetNum
      });

      if (result.success) {
        res.json({
          success: true,
          data: result.data,
          pagination: {
            limit: limitNum,
            offset: offsetNum,
            count: result.data.length
          },
          message: result.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      logger.error('获取用户像素历史失败', { error: error.message, userId: req.params.userId });
      res.status(500).json({
        success: false,
        error: '服务器内部错误'
      });
    }
  }

  /**
   * 获取像素位置的历史变化
   * GET /api/pixels-history/location/:gridId
   */
  async getPixelLocationHistory(req, res) {
    try {
      const { gridId } = req.params;
      const {
        startDate,
        endDate,
        limit = 100,
        offset = 0
      } = req.query;

      // 验证网格ID
      if (!gridId) {
        return res.status(400).json({
          success: false,
          error: '无效的网格ID'
        });
      }

      // 验证日期格式
      if (startDate && isNaN(Date.parse(startDate))) {
        return res.status(400).json({
          success: false,
          error: '无效的开始日期格式'
        });
      }

      if (endDate && isNaN(Date.parse(endDate))) {
        return res.status(400).json({
          success: false,
          error: '无效的结束日期格式'
        });
      }

      // 验证分页参数
      const limitNum = Math.min(parseInt(limit) || 100, 1000);
      const offsetNum = Math.max(parseInt(offset) || 0, 0);

      const result = await pixelsHistoryService.getPixelLocationHistory(gridId, {
        startDate,
        endDate,
        limit: limitNum,
        offset: offsetNum
      });

      if (result.success) {
        res.json({
          success: true,
          data: result.data,
          pagination: {
            limit: limitNum,
            offset: offsetNum,
            count: result.data.length
          },
          message: result.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      logger.error('获取像素位置历史失败', { error: error.message, gridId: req.params.gridId });
      res.status(500).json({
        success: false,
        error: '服务器内部错误'
      });
    }
  }

  /**
   * 获取用户行为统计
   * GET /api/pixels-history/user/:userId/stats
   */
  async getUserBehaviorStats(req, res) {
    try {
      const { userId } = req.params;
      const {
        startDate,
        endDate
      } = req.query;

      // 验证用户ID (UUID格式)
      if (!userId || !userId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        return res.status(400).json({
          success: false,
          error: '无效的用户ID格式'
        });
      }

      // 验证日期格式
      if (startDate && isNaN(Date.parse(startDate))) {
        return res.status(400).json({
          success: false,
          error: '无效的开始日期格式'
        });
      }

      if (endDate && isNaN(Date.parse(endDate))) {
        return res.status(400).json({
          success: false,
          error: '无效的结束日期格式'
        });
      }

      const result = await pixelsHistoryService.getUserBehaviorStats(userId, {
        startDate,
        endDate
      });

      if (result.success) {
        res.json({
          success: true,
          data: result.data,
          message: result.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      logger.error('获取用户行为统计失败', { error: error.message, userId: req.params.userId });
      res.status(500).json({
        success: false,
        error: '服务器内部错误'
      });
    }
  }

  /**
   * 获取区域活跃度统计
   * GET /api/pixels-history/region/stats
   */
  async getRegionActivityStats(req, res) {
    try {
      const {
        startDate,
        endDate,
        regionId
      } = req.query;

      // 验证日期格式
      if (startDate && isNaN(Date.parse(startDate))) {
        return res.status(400).json({
          success: false,
          error: '无效的开始日期格式'
        });
      }

      if (endDate && isNaN(Date.parse(endDate))) {
        return res.status(400).json({
          success: false,
          error: '无效的结束日期格式'
        });
      }

      // 验证区域ID
      if (regionId && isNaN(parseInt(regionId))) {
        return res.status(400).json({
          success: false,
          error: '无效的区域ID'
        });
      }

      const result = await pixelsHistoryService.getRegionActivityStats({
        startDate,
        endDate,
        regionId: regionId ? parseInt(regionId) : undefined
      });

      if (result.success) {
        res.json({
          success: true,
          data: result.data,
          message: result.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      logger.error('获取区域活跃度统计失败', { error: error.message, regionId: req.params.regionId });
      res.status(500).json({
        success: false,
        error: '服务器内部错误'
      });
    }
  }

  /**
   * 获取像素历史统计概览
   * GET /api/pixels-history/stats/overview
   */
  async getHistoryOverview(req, res) {
    try {
      const {
        startDate,
        endDate
      } = req.query;

      // 验证日期格式
      if (startDate && isNaN(Date.parse(startDate))) {
        return res.status(400).json({
          success: false,
          error: '无效的开始日期格式'
        });
      }

      if (endDate && isNaN(Date.parse(endDate))) {
        return res.status(400).json({
          success: false,
          error: '无效的结束日期格式'
        });
      }

      // 获取总体统计
      const [totalStats, actionStats, regionStats] = await Promise.all([
        this.getTotalStats(startDate, endDate),
        this.getActionTypeStats(startDate, endDate),
        this.getTopRegionsStats(startDate, endDate)
      ]);

      res.json({
        success: true,
        data: {
          total: totalStats,
          actionTypes: actionStats,
          topRegions: regionStats
        },
        message: '统计概览获取成功'
      });
    } catch (error) {
      logger.error('获取历史统计概览失败', { error: error.message });
      res.status(500).json({
        success: false,
        error: '服务器内部错误'
      });
    }
  }

  /**
   * 获取总体统计
   * @private
   */
  async getTotalStats(startDate, endDate) {
    const { db } = require('../config/database');
    
    let query = db('pixels_history');
    
    if (startDate) {
      query = query.where('history_date', '>=', startDate);
    }
    
    if (endDate) {
      query = query.where('history_date', '<=', endDate);
    }

    const stats = await query
      .select(
        db.raw('COUNT(*) as total_records'),
        db.raw('COUNT(DISTINCT user_id) as unique_users'),
        db.raw('COUNT(DISTINCT grid_id) as unique_locations'),
        db.raw('COUNT(DISTINCT action_type) as action_types')
      )
      .first();

    return stats;
  }

  /**
   * 获取操作类型统计
   * @private
   */
  async getActionTypeStats(startDate, endDate) {
    const { db } = require('../config/database');
    
    let query = db('pixels_history');
    
    if (startDate) {
      query = query.where('history_date', '>=', startDate);
    }
    
    if (endDate) {
      query = query.where('history_date', '<=', endDate);
    }

    const stats = await query
      .groupBy('action_type')
      .select(
        'action_type',
        db.raw('COUNT(*) as count'),
        db.raw('COUNT(DISTINCT user_id) as unique_users')
      )
      .orderBy('count', 'desc');

    return stats;
  }

  /**
   * 获取热门区域统计
   * @private
   */
  async getTopRegionsStats(startDate, endDate) {
    const { db } = require('../config/database');
    
    let query = db('pixels_history')
      .whereNotNull('region_id');
    
    if (startDate) {
      query = query.where('history_date', '>=', startDate);
    }
    
    if (endDate) {
      query = query.where('history_date', '<=', endDate);
    }

    const stats = await query
      .groupBy('region_id')
      .select(
        'region_id',
        db.raw('COUNT(*) as pixel_count'),
        db.raw('COUNT(DISTINCT user_id) as unique_users')
      )
      .orderBy('pixel_count', 'desc')
      .limit(10);

    return stats;
  }
}

module.exports = new PixelsHistoryController();
