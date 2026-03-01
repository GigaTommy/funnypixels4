const { db: knex } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const notificationService = require('../services/notificationService');

class NotificationController {
  // 获取用户通知列表
  static async getUserNotifications(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20, type, unread_only = false } = req.query;
      const offset = (page - 1) * limit;

      let query = knex('notifications')
        .where('user_id', userId)
        .orderBy('created_at', 'desc');

      // 过滤类型
      if (type) {
        query = query.where('type', type);
      }

      // 只获取未读通知
      if (unread_only === 'true') {
        query = query.where('is_read', false);
      }

      const notifications = await query
        .limit(limit)
        .offset(offset)
        .select('*');

      // 获取总数
      let countQuery = knex('notifications').where('user_id', userId);
      if (type) {
        countQuery = countQuery.where('type', type);
      }
      if (unread_only === 'true') {
        countQuery = countQuery.where('is_read', false);
      }
      const total = await countQuery.count('* as count').first();

      res.json({
        success: true,
        data: {
          notifications,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: total.count,
            total_pages: Math.ceil(total.count / limit)
          }
        }
      });

    } catch (error) {
      console.error('获取通知列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取通知列表失败'
      });
    }
  }

  // 标记通知为已读
  static async markAsRead(req, res) {
    try {
      const userId = req.user.id;
      const { notificationId } = req.params;

      // ✅ 修复：将 notificationId 转换为整数
      const id = parseInt(notificationId, 10);
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: '无效的通知 ID'
        });
      }

      const result = await knex('notifications')
        .where({
          id: id,  // 使用转换后的整数 ID
          user_id: userId
        })
        .update({
          is_read: true,
          read_at: new Date(),  // ✅ 记录已读时间
          updated_at: new Date()
        });

      if (result === 0) {
        return res.status(404).json({
          success: false,
          message: '通知不存在'
        });
      }

      res.json({
        success: true,
        message: '通知已标记为已读'
      });

    } catch (error) {
      console.error('标记通知已读失败:', error);
      res.status(500).json({
        success: false,
        message: '标记通知已读失败'
      });
    }
  }

  // 标记所有通知为已读
  static async markAllAsRead(req, res) {
    try {
      const userId = req.user.id;
      const { type } = req.query;

      let query = knex('notifications')
        .where({
          user_id: userId,
          is_read: false
        });

      if (type) {
        query = query.where('type', type);
      }

      await query.update({
        is_read: true,
        read_at: new Date(),  // ✅ 记录已读时间
        updated_at: new Date()
      });

      res.json({
        success: true,
        message: '所有通知已标记为已读'
      });

    } catch (error) {
      console.error('标记所有通知已读失败:', error);
      res.status(500).json({
        success: false,
        message: '标记所有通知已读失败'
      });
    }
  }

  // 删除通知
  static async deleteNotification(req, res) {
    try {
      const userId = req.user.id;
      const { notificationId } = req.params;

      const result = await knex('notifications')
        .where({
          id: notificationId,
          user_id: userId
        })
        .del();

      if (result === 0) {
        return res.status(404).json({
          success: false,
          message: '通知不存在'
        });
      }

      res.json({
        success: true,
        message: '通知删除成功'
      });

    } catch (error) {
      console.error('删除通知失败:', error);
      res.status(500).json({
        success: false,
        message: '删除通知失败'
      });
    }
  }

  // 获取未读通知数量
  static async getUnreadCount(req, res) {
    try {
      const userId = req.user.id;
      const { type } = req.query;

      let query = knex('notifications')
        .where({
          user_id: userId,
          is_read: false
        });

      if (type) {
        query = query.where('type', type);
      }

      const result = await query.count('* as count').first();

      res.json({
        success: true,
        data: {
          unread_count: parseInt(result.count)
        }
      });

    } catch (error) {
      console.error('获取未读通知数量失败:', error);
      res.status(500).json({
        success: false,
        message: '获取未读通知数量失败'
      });
    }
  }

  // 创建通知（内部方法）
  static async createNotification(userId, type, title, content, data = {}) {
    try {
      const notification = {
        // id 字段是自增的，不需要手动设置
        user_id: userId,
        type,
        title,
        message: content,  // ✅ 使用 message 字段（而非 content）
        data: data,  // ✅ 现在可以使用 data 字段（JSONB）
        is_read: false
        // created_at 和 updated_at 使用数据库默认值
      };

      const [inserted] = await knex('notifications').insert(notification).returning('*');

      // 异步发送推送通知
      this.triggerPushNotification(userId, title, content, data).catch(err => {
        console.error('❌ 发送推送通知失败:', err);
      });

      return inserted;

    } catch (error) {
      console.error('创建通知失败:', error);
      throw error;
    }
  }

  // 创建联盟申请通知
  static async createAllianceApplicationNotification(allianceId, applicantId, allianceName) {
    try {
      // 获取联盟管理员和盟主
      const admins = await knex('alliance_members')
        .where({
          alliance_id: allianceId,
          role: 'leader'
        })
        .orWhere({
          alliance_id: allianceId,
          role: 'admin'
        })
        .select('user_id');

      const adminIds = admins.map(admin => admin.user_id);

      // 为每个管理员创建通知
      for (const adminId of adminIds) {
        await this.createNotification(
          adminId,
          'alliance_application',
          '新的联盟申请',
          `用户申请加入联盟"${allianceName}"`,
          {
            alliance_id: allianceId,
            applicant_id: applicantId,
            alliance_name: allianceName
          }
        );
      }

    } catch (error) {
      console.error('创建联盟申请通知失败:', error);
      throw error;
    }
  }

  // 创建联盟申请结果通知
  static async createAllianceApplicationResultNotification(applicantId, allianceName, isApproved, message = '') {
    try {
      const title = isApproved ? '联盟申请已通过' : '联盟申请被拒绝';
      const content = isApproved
        ? `恭喜！您的联盟申请已通过，欢迎加入"${allianceName}"`
        : `很遗憾，您的联盟申请被拒绝。${message ? `原因：${message}` : ''}`;

      await this.createNotification(
        applicantId,
        'alliance_application_result',
        title,
        content,
        {
          alliance_name: allianceName,
          is_approved: isApproved,
          message
        }
      );

    } catch (error) {
      console.error('创建联盟申请结果通知失败:', error);
      throw error;
    }
  }

  // 创建系统通知
  static async createSystemNotification(userId, title, content, data = {}) {
    try {
      await this.createNotification(
        userId,
        'system',
        title,
        content,
        data
      );

    } catch (error) {
      console.error('创建系统通知失败:', error);
      throw error;
    }
  }

  /**
   * 触发推送通知
   * @param {string} userId 
   * @param {string} title 
   * @param {string} body 
   * @param {Object} data 
   */
  static async triggerPushNotification(userId, title, body, data = {}) {
    try {
      // 获取用户设备令牌
      const user = await knex('users')
        .where('id', userId)
        .select('device_token')
        .first();

      if (user && user.device_token) {
        await notificationService.sendPushNotification(
          user.device_token,
          title,
          body,
          data
        );
      }
    } catch (error) {
      console.error('❌ 获取设备令牌或发送推送失败:', error);
    }
  }
}

module.exports = NotificationController;
