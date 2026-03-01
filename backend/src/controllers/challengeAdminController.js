const ChallengeTemplate = require('../models/ChallengeTemplate');
const { db } = require('../config/database');
const logger = require('../utils/logger');

class ChallengeAdminController {
  static async listTemplates(req, res) {
    try {
      const result = await ChallengeTemplate.findAll(req.query);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('List challenge templates error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getTemplateById(req, res) {
    try {
      const template = await ChallengeTemplate.findById(req.params.id);
      if (!template) {
        return res.status(404).json({ success: false, message: '挑战模板不存在' });
      }
      res.json({ success: true, data: template });
    } catch (error) {
      logger.error('Get challenge template error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async createTemplate(req, res) {
    try {
      const template = await ChallengeTemplate.create(req.body);
      res.json({ success: true, data: template, message: '挑战模板创建成功' });
    } catch (error) {
      logger.error('Create challenge template error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async updateTemplate(req, res) {
    try {
      const template = await ChallengeTemplate.update(req.params.id, req.body);
      if (!template) {
        return res.status(404).json({ success: false, message: '挑战模板不存在' });
      }
      res.json({ success: true, data: template, message: '挑战模板更新成功' });
    } catch (error) {
      logger.error('Update challenge template error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async deleteTemplate(req, res) {
    try {
      await ChallengeTemplate.delete(req.params.id);
      res.json({ success: true, message: '挑战模板已删除' });
    } catch (error) {
      logger.error('Delete challenge template error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async toggleActive(req, res) {
    try {
      const template = await ChallengeTemplate.toggleActive(req.params.id);
      res.json({ success: true, data: template, message: `模板已${template.is_active ? '启用' : '禁用'}` });
    } catch (error) {
      logger.error('Toggle challenge template error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getStats(req, res) {
    try {
      const [totalCount] = await db('challenge_templates').count('* as count');
      const [activeCount] = await db('challenge_templates').where('is_active', true).count('* as count');

      const today = new Date().toISOString().split('T')[0];
      const [todayCompleted] = await db('user_challenges')
        .where('date', today)
        .where('is_completed', true)
        .count('* as count');

      const typeStats = await db('challenge_templates')
        .select('type')
        .count('* as count')
        .groupBy('type');

      res.json({
        success: true,
        data: {
          total: parseInt(totalCount.count),
          active: parseInt(activeCount.count),
          today_completed: parseInt(todayCompleted.count),
          type_stats: typeStats
        }
      });
    } catch (error) {
      logger.error('Get challenge stats error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = ChallengeAdminController;
