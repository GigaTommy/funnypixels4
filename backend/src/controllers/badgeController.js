const BadgeService = require('../services/badgeService');
const logger = require('../utils/logger');

/**
 * Badge 聚合控制器
 * GET /api/badges — 返回各 Tab 的 badge 计数
 */
class BadgeController {

  static async getBadgeCounts(req, res) {
    try {
      const userId = req.user.id;
      const badges = await BadgeService.getBadgeCounts(userId);

      res.json({
        success: true,
        data: badges,
      });
    } catch (error) {
      logger.error('Badge API error:', error);
      res.status(500).json({
        success: false,
        message: '获取 badge 数据失败',
      });
    }
  }
}

module.exports = BadgeController;
