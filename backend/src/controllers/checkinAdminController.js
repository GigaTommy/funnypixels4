const CheckinRewardConfig = require('../models/CheckinRewardConfig');
const { db } = require('../config/database');
const logger = require('../utils/logger');

class CheckinAdminController {
  static async listConfigs(req, res) {
    try {
      const result = await CheckinRewardConfig.findAll(req.query);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('List checkin configs error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async createConfig(req, res) {
    try {
      const config = await CheckinRewardConfig.create(req.body);
      res.json({ success: true, data: config, message: '签到配置创建成功' });
    } catch (error) {
      logger.error('Create checkin config error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async updateConfig(req, res) {
    try {
      const config = await CheckinRewardConfig.update(req.params.id, req.body);
      if (!config) {
        return res.status(404).json({ success: false, message: '配置不存在' });
      }
      res.json({ success: true, data: config, message: '签到配置更新成功' });
    } catch (error) {
      logger.error('Update checkin config error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async deleteConfig(req, res) {
    try {
      await CheckinRewardConfig.delete(req.params.id);
      res.json({ success: true, message: '签到配置已删除' });
    } catch (error) {
      logger.error('Delete checkin config error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getCheckinStats(req, res) {
    try {
      const today = new Date().toISOString().split('T')[0];

      const [todayCheckins] = await db('user_checkins')
        .where('checkin_date', today)
        .count('* as count');

      const [maxStreak] = await db('user_checkins')
        .max('consecutive_days as max_streak');

      const [avgStreak] = await db('user_checkins')
        .where('checkin_date', today)
        .avg('consecutive_days as avg_streak');

      const [totalConfigs] = await db('checkin_reward_config').count('* as count');
      const [activeConfigs] = await db('checkin_reward_config').where('is_active', true).count('* as count');

      res.json({
        success: true,
        data: {
          today_checkins: parseInt(todayCheckins.count),
          max_streak: parseInt(maxStreak.max_streak) || 0,
          avg_streak: parseFloat(avgStreak.avg_streak || 0).toFixed(1),
          total_configs: parseInt(totalConfigs.count),
          active_configs: parseInt(activeConfigs.count)
        }
      });
    } catch (error) {
      logger.error('Get checkin stats error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async previewReward(req, res) {
    try {
      const { days = 30 } = req.query;
      const maxDays = Math.min(parseInt(days), 90);
      const preview = [];

      for (let day = 1; day <= maxDays; day++) {
        const result = await CheckinRewardConfig.previewReward(day);
        preview.push(result);
      }

      res.json({ success: true, data: preview });
    } catch (error) {
      logger.error('Preview reward error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = CheckinAdminController;
