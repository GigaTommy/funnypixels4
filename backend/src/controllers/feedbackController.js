const Feedback = require('../models/Feedback');
const logger = require('../utils/logger');

class FeedbackController {
  // ===== User-facing endpoints =====

  static async submitFeedback(req, res) {
    try {
      const { type, title, content, screenshots, app_version, device_info, priority } = req.body;

      if (!type || !title || !content) {
        return res.status(400).json({ success: false, message: '类型、标题和内容为必填项' });
      }

      const feedback = await Feedback.create({
        user_id: req.user.id,
        type,
        title,
        content,
        screenshots,
        app_version,
        device_info,
        priority
      });

      res.json({ success: true, data: feedback, message: '反馈提交成功' });
    } catch (error) {
      logger.error('Submit feedback error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getUserFeedback(req, res) {
    try {
      const result = await Feedback.find({
        ...req.query,
        user_id: req.user.id
      });
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Get user feedback error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // ===== Admin endpoints =====

  static async listFeedback(req, res) {
    try {
      const result = await Feedback.find(req.query);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('List feedback error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getFeedbackById(req, res) {
    try {
      const feedback = await Feedback.findById(req.params.id);
      if (!feedback) {
        return res.status(404).json({ success: false, message: '反馈不存在' });
      }
      res.json({ success: true, data: feedback });
    } catch (error) {
      logger.error('Get feedback error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async replyToFeedback(req, res) {
    try {
      const { reply } = req.body;
      if (!reply) {
        return res.status(400).json({ success: false, message: '回复内容不能为空' });
      }

      const feedback = await Feedback.reply(req.params.id, req.user.id, reply);
      if (!feedback) {
        return res.status(404).json({ success: false, message: '反馈不存在' });
      }

      res.json({ success: true, data: feedback, message: '回复成功' });
    } catch (error) {
      logger.error('Reply feedback error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async updateFeedbackStatus(req, res) {
    try {
      const feedback = await Feedback.updateStatus(req.params.id, req.body);
      if (!feedback) {
        return res.status(404).json({ success: false, message: '反馈不存在' });
      }
      res.json({ success: true, data: feedback, message: '状态更新成功' });
    } catch (error) {
      logger.error('Update feedback status error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async deleteFeedback(req, res) {
    try {
      await Feedback.delete(req.params.id);
      res.json({ success: true, message: '反馈已删除' });
    } catch (error) {
      logger.error('Delete feedback error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getFeedbackStats(req, res) {
    try {
      const stats = await Feedback.getStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      logger.error('Get feedback stats error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = FeedbackController;
