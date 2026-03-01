const DailyRewardService = require('../services/dailyRewardService');
const logger = require('../utils/logger');

const dailyRewardService = new DailyRewardService();

class DailyRewardController {
  static async getSummary(req, res) {
    try {
      const userId = req.user.id;
      const data = await dailyRewardService.getPendingSummary(userId);
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Failed to get daily reward summary:', error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async acknowledge(req, res) {
    try {
      const userId = req.user.id;
      const { date } = req.body;

      if (!date) {
        return res.status(400).json({ success: false, message: 'date is required' });
      }

      await dailyRewardService.acknowledgeSummary(userId, date);
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to acknowledge daily reward:', error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = DailyRewardController;
