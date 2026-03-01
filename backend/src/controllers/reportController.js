const Report = require('../models/Report');
const Conversation = require('../models/Conversation');
const { db } = require('../config/database');

class ReportController {
  // 创建举报
  static async createReport(req, res) {
    try {
      const {
        targetType,
        targetId,
        reason,
        description,
        metadata = {}
      } = req.body;
      const reporterId = req.user.id;

      // 验证输入
      const validTargetTypes = ['pixel', 'user', 'message'];
      const validReasons = ['porn', 'violence', 'political', 'spam', 'abuse', 'hate_speech', 'inappropriate', 'other'];

      if (!validTargetTypes.includes(targetType)) {
        return res.status(400).json({
          success: false,
          message: '无效的举报对象类型'
        });
      }

      if (!validReasons.includes(reason)) {
        return res.status(400).json({
          success: false,
          message: '无效的举报原因'
        });
      }

      if (!targetId) {
        return res.status(400).json({
          success: false,
          message: '举报对象ID不能为空'
        });
      }

      // 检查举报限额
      const limitCheck = await Report.checkReportLimit(reporterId);
      if (!limitCheck.canReport) {
        return res.status(429).json({
          success: false,
          message: '今日举报次数已达上限',
          data: {
            todayCount: limitCheck.todayCount,
            dailyLimit: limitCheck.dailyLimit,
            remaining: limitCheck.remaining
          }
        });
      }

      // 创建举报
      const report = await Report.createReport({
        reporterId,
        targetType,
        targetId,
        reason,
        description,
        metadata
      });

      // 发送通知到管理员聊天室
      try {
        await this.sendReportNotificationToModerators(report);
      } catch (notifyError) {
        console.error('发送举报通知失败:', notifyError);
        // 不影响举报创建的成功
      }

      res.status(201).json({
        success: true,
        message: '举报提交成功，我们将尽快处理',
        data: {
          reportId: report.id,
          remaining: limitCheck.remaining - 1
        }
      });
    } catch (error) {
      console.error('创建举报失败:', error);
      res.status(500).json({
        success: false,
        message: error.message || '举报提交失败',
        error: error.message
      });
    }
  }

  // 发送举报通知到管理员聊天室
  static async sendReportNotificationToModerators(report) {
    try {
      // 获取管理员审核聊天室
      const moderationConversation = await db('conversations')
        .where('key', 'moderation:reports')
        .first();

      if (!moderationConversation) {
        console.error('管理员审核聊天室不存在');
        return;
      }

      // 构建举报消息内容
      const reportMessage = this.buildReportMessage(report);

      // 发送消息到管理员聊天室
      await db('chat_messages')
        .insert({
          sender_id: 'system', // 系统消息
          conversation_id: moderationConversation.id,
          channel_type: 'global',
          channel_id: null,
          message_type: 'text',
          content: reportMessage.content,
          metadata: JSON.stringify(reportMessage.metadata),
          is_system_message: true
        });

      console.log(`举报通知已发送到管理员聊天室: ${report.id}`);
    } catch (error) {
      console.error('发送举报通知失败:', error);
      throw error;
    }
  }

  // 构建举报消息内容
  static buildReportMessage(report) {
    const reasonMap = {
      porn: '色情内容',
      violence: '暴力内容',
      political: '政治敏感',
      spam: '垃圾信息',
      abuse: '恶意行为',
      hate_speech: '仇恨言论',
      inappropriate: '不当内容',
      other: '其他'
    };

    const targetTypeMap = {
      pixel: '像素',
      user: '用户',
      message: '消息'
    };

    const content = `🚨 新举报提醒

📋 举报ID: ${report.id}
🎯 举报对象: ${targetTypeMap[report.target_type] || report.target_type} (${report.target_id})
⚠️ 举报原因: ${reasonMap[report.reason] || report.reason}
📝 详细描述: ${report.description || '无'}
🕐 举报时间: ${new Date(report.created_at).toLocaleString('zh-CN')}

点击查看详情和处理举报`;

    const metadata = {
      reportId: report.id,
      targetType: report.target_type,
      targetId: report.target_id,
      reason: report.reason,
      ...JSON.parse(report.metadata || '{}')
    };

    return { content, metadata };
  }

  // 获取举报列表（管理员）
  static async getReports(req, res) {
    try {
      // 检查管理员权限
      if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: '无权限访问'
        });
      }

      const {
        status,
        targetType,
        reason,
        assignedAdminId,
        limit = 50,
        offset = 0,
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = req.query;

      const reports = await Report.getReports({
        status,
        targetType,
        reason,
        assignedAdminId,
        limit: parseInt(limit),
        offset: parseInt(offset),
        sortBy,
        sortOrder
      });

      res.json({
        success: true,
        data: reports,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      });
    } catch (error) {
      console.error('获取举报列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取举报列表失败',
        error: error.message
      });
    }
  }

  // 获取举报详情
  static async getReportById(req, res) {
    try {
      // 检查管理员权限
      if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: '无权限访问'
        });
      }

      const { reportId } = req.params;
      const report = await Report.getReportById(reportId);

      if (!report) {
        return res.status(404).json({
          success: false,
          message: '举报记录不存在'
        });
      }

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      console.error('获取举报详情失败:', error);
      res.status(500).json({
        success: false,
        message: '获取举报详情失败',
        error: error.message
      });
    }
  }

  // 分配举报给管理员
  static async assignReport(req, res) {
    try {
      // 检查管理员权限
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: '无权限操作'
        });
      }

      const { reportId } = req.params;
      const { adminId = req.user.id } = req.body;

      const updatedReport = await Report.assignReport(reportId, adminId);

      res.json({
        success: true,
        message: '举报分配成功',
        data: updatedReport
      });
    } catch (error) {
      console.error('分配举报失败:', error);
      res.status(500).json({
        success: false,
        message: error.message || '分配举报失败',
        error: error.message
      });
    }
  }

  // 处理举报（解决或拒绝）
  static async resolveReport(req, res) {
    try {
      // 检查管理员权限
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: '无权限操作'
        });
      }

      const { reportId } = req.params;
      const { resolution, adminNote } = req.body;
      const adminId = req.user.id;

      if (!['resolved', 'rejected'].includes(resolution)) {
        return res.status(400).json({
          success: false,
          message: '无效的处理结果'
        });
      }

      const updatedReport = await Report.resolveReport(reportId, adminId, resolution, adminNote);

      res.json({
        success: true,
        message: resolution === 'resolved' ? '举报已解决' : '举报已拒绝',
        data: updatedReport
      });
    } catch (error) {
      console.error('处理举报失败:', error);
      res.status(500).json({
        success: false,
        message: error.message || '处理举报失败',
        error: error.message
      });
    }
  }

  // 获取举报统计信息
  static async getReportStatistics(req, res) {
    try {
      // 检查管理员权限
      if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: '无权限访问'
        });
      }

      const { startDate, endDate } = req.query;
      const statistics = await Report.getReportStatistics(startDate, endDate);

      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      console.error('获取举报统计失败:', error);
      res.status(500).json({
        success: false,
        message: '获取举报统计失败',
        error: error.message
      });
    }
  }

  // 获取用户举报历史
  static async getUserReports(req, res) {
    try {
      const userId = req.user.id;
      const { limit = 20, offset = 0 } = req.query;

      const reports = await Report.getUserReports(
        userId,
        parseInt(limit),
        parseInt(offset)
      );

      res.json({
        success: true,
        data: reports,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      });
    } catch (error) {
      console.error('获取用户举报历史失败:', error);
      res.status(500).json({
        success: false,
        message: '获取用户举报历史失败',
        error: error.message
      });
    }
  }

  // 获取举报限额状态
  static async getReportLimitStatus(req, res) {
    try {
      const userId = req.user.id;
      const limitStatus = await Report.checkReportLimit(userId);

      res.json({
        success: true,
        data: limitStatus
      });
    } catch (error) {
      console.error('获取举报限额状态失败:', error);
      res.status(500).json({
        success: false,
        message: '获取举报限额状态失败',
        error: error.message
      });
    }
  }

  // 获取管理员工作台
  static async getAdminDashboard(req, res) {
    try {
      // 检查管理员权限
      if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: '无权限访问'
        });
      }

      const adminId = req.user.id;
      const dashboard = await Report.getAdminDashboard(adminId);

      res.json({
        success: true,
        data: dashboard
      });
    } catch (error) {
      console.error('获取管理员工作台失败:', error);
      res.status(500).json({
        success: false,
        message: '获取管理员工作台失败',
        error: error.message
      });
    }
  }
}

module.exports = ReportController;