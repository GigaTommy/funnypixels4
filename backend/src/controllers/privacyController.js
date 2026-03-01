const PrivacySettings = require('../models/PrivacySettings');
const MessageRequest = require('../models/MessageRequest');

class PrivacyController {
  // 获取用户隐私设置
  static async getPrivacySettings(req, res) {
    try {
      const userId = req.user.id;
      const settings = await PrivacySettings.getUserSettings(userId);
      const options = PrivacySettings.getPrivacyOptions();

      res.json({
        success: true,
        data: {
          settings,
          options
        }
      });

    } catch (error) {
      console.error('获取隐私设置失败:', error);
      res.status(500).json({
        success: false,
        message: '获取隐私设置失败',
        error: error.message
      });
    }
  }

  // 更新隐私设置
  static async updatePrivacySettings(req, res) {
    try {
      console.log("🔄 updatePrivacySettings called:", {
        userId: req.user?.id,
        body: req.body,
        headers: req.headers
      });

      const userId = req.user.id;
      const updateData = req.body;

      // 验证更新数据
      const allowedFields = [
        'dm_receive_from',
        'allow_message_requests',
        'filter_low_quality',
        'read_receipts_enabled',
        'hide_nickname',
        'hide_alliance',
        'hide_alliance_flag'
      ];

      const filteredData = {};
      for (const field of allowedFields) {
        if (updateData.hasOwnProperty(field)) {
          filteredData[field] = updateData[field];
        }
      }

      if (Object.keys(filteredData).length === 0) {
        return res.status(400).json({
          success: false,
          message: '没有有效的更新字段'
        });
      }

      const settings = await PrivacySettings.updateSettings(userId, filteredData);

      res.json({
        success: true,
        message: '隐私设置更新成功',
        data: settings
      });

    } catch (error) {
      console.error('更新隐私设置失败:', error);
      res.status(500).json({
        success: false,
        message: error.message || '更新隐私设置失败',
        error: error.message
      });
    }
  }

  // 获取消息请求列表
  static async getMessageRequests(req, res) {
    try {
      const userId = req.user.id;
      const { limit = 20, offset = 0 } = req.query;

      const requests = await MessageRequest.getRequestsForUser(
        userId,
        parseInt(limit),
        parseInt(offset)
      );

      const unreadCount = await MessageRequest.getUnreadRequestCount(userId);

      res.json({
        success: true,
        data: {
          requests,
          unread_count: unreadCount,
          pagination: {
            limit: parseInt(limit),
            offset: parseInt(offset),
            total: requests.length
          }
        }
      });

    } catch (error) {
      console.error('获取消息请求失败:', error);
      res.status(500).json({
        success: false,
        message: '获取消息请求失败',
        error: error.message
      });
    }
  }

  // 处理消息请求
  static async handleMessageRequest(req, res) {
    try {
      const userId = req.user.id;
      const { request_id } = req.params;
      const { action } = req.body;

      if (!['accept', 'decline'].includes(action)) {
        return res.status(400).json({
          success: false,
          message: '无效的操作类型'
        });
      }

      const request = await MessageRequest.handleRequest(request_id, userId, action);

      res.json({
        success: true,
        message: action === 'accept' ? '请求已接受' : '请求已拒绝',
        data: request
      });

    } catch (error) {
      console.error('处理消息请求失败:', error);
      res.status(500).json({
        success: false,
        message: error.message || '处理消息请求失败',
        error: error.message
      });
    }
  }

  // 检查是否可以发送消息
  static async checkMessagePermission(req, res) {
    try {
      const senderId = req.user.id;
      const { receiver_id } = req.params;

      const permission = await PrivacySettings.canSendMessage(senderId, receiver_id);

      res.json({
        success: true,
        data: permission
      });

    } catch (error) {
      console.error('检查消息权限失败:', error);
      res.status(500).json({
        success: false,
        message: '检查消息权限失败',
        error: error.message
      });
    }
  }

  // 发送消息请求
  static async sendMessageRequest(req, res) {
    try {
      const senderId = req.user.id;
      const { receiver_id } = req.params;
      const { content } = req.body;

      if (!content || !content.trim()) {
        return res.status(400).json({
          success: false,
          message: '消息内容不能为空'
        });
      }

      // 检查是否可以发送消息请求
      const permission = await PrivacySettings.canSendMessage(senderId, receiver_id);

      if (permission.canSend) {
        return res.status(400).json({
          success: false,
          message: '无需发送请求，可直接发送消息'
        });
      }

      if (!permission.requiresRequest) {
        return res.status(403).json({
          success: false,
          message: permission.reason || '无法发送消息'
        });
      }

      const request = await MessageRequest.create(senderId, receiver_id, content.trim());

      res.status(201).json({
        success: true,
        message: '消息请求已发送',
        data: request
      });

    } catch (error) {
      console.error('发送消息请求失败:', error);
      res.status(500).json({
        success: false,
        message: error.message || '发送消息请求失败',
        error: error.message
      });
    }
  }

  // 获取指定用户的隐私设置（用于像素卡片显示）
  static async getUserPrivacySettings(req, res) {
    try {
      const { user_id } = req.params;

      if (!user_id) {
        return res.status(400).json({
          success: false,
          message: '用户ID不能为空'
        });
      }

      // 直接查询数据库，不创建默认设置（公开端点只读，不应写入）
      const { db } = require('../config/database');
      const settings = await db('privacy_settings')
        .where('user_id', user_id)
        .first();

      // 如果没有设置，返回默认值
      const pixelPrivacySettings = {
        hide_nickname: settings?.hide_nickname || false,
        hide_alliance: settings?.hide_alliance || false,
        hide_alliance_flag: settings?.hide_alliance_flag || false
      };

      res.json({
        success: true,
        data: {
          settings: pixelPrivacySettings
        }
      });

    } catch (error) {
      console.error('获取用户隐私设置失败:', error);
      res.status(500).json({
        success: false,
        message: '获取用户隐私设置失败',
        error: error.message
      });
    }
  }
}

module.exports = PrivacyController;