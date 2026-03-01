const { db } = require('../config/database');

class Report {
  // 创建举报
  static async createReport(reportData) {
    try {
      const {
        reporterId,
        targetType,
        targetId,
        reason,
        description = null,
        metadata = {}
      } = reportData;

      // 检查是否已经举报过相同目标
      const targetKey = `${targetType}:${targetId}`;
      const existingLimit = await db('report_limits')
        .where({
          user_id: reporterId,
          target_key: targetKey
        })
        .first();

      if (existingLimit) {
        // 更新举报次数和时间
        await db('report_limits')
          .where('id', existingLimit.id)
          .update({
            report_count: db.raw('report_count + 1'),
            last_report_at: db.fn.now()
          });

        throw new Error('您已经举报过此内容');
      }

      // 创建举报记录
      const [report] = await db('reports')
        .insert({
          reporter_id: reporterId,
          target_type: targetType,
          target_id: targetId,
          reason,
          description,
          metadata: JSON.stringify(metadata),
          status: 'pending'
        })
        .returning('*');

      // 创建限制记录
      await db('report_limits')
        .insert({
          user_id: reporterId,
          target_key: targetKey,
          report_count: 1
        });

      // 更新统计数据
      await this.updateReportStatistics(targetType, reason, 'report');

      console.log(`用户 ${reporterId} 举报了 ${targetType}:${targetId}，原因：${reason}`);
      return report;
    } catch (error) {
      console.error('创建举报失败:', error);
      throw error;
    }
  }

  // 检查用户举报限额
  static async checkReportLimit(userId) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const startOfDay = new Date(today + 'T00:00:00Z');

      // 检查今日举报次数
      const todayReports = await db('reports')
        .where('reporter_id', userId)
        .where('created_at', '>=', startOfDay)
        .count('id as count')
        .first();

      const dailyLimit = parseInt(process.env.DAILY_REPORT_LIMIT) || 10;
      const todayCount = parseInt(todayReports.count) || 0;

      return {
        canReport: todayCount < dailyLimit,
        todayCount,
        dailyLimit,
        remaining: Math.max(0, dailyLimit - todayCount)
      };
    } catch (error) {
      console.error('检查举报限额失败:', error);
      return {
        canReport: false,
        todayCount: 0,
        dailyLimit: 10,
        remaining: 0
      };
    }
  }

  // 获取举报列表（管理员用）
  static async getReports(options = {}) {
    try {
      const {
        status = null,
        targetType = null,
        reason = null,
        assignedAdminId = null,
        limit = 50,
        offset = 0,
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = options;

      let query = db('reports')
        .select(
          'reports.*',
          'reporter.username as reporter_username',
          'reporter.display_name as reporter_display_name',
          'admin.username as admin_username'
        )
        .leftJoin('users as reporter', 'reports.reporter_id', 'reporter.id')
        .leftJoin('users as admin', 'reports.assigned_admin_id', 'admin.id');

      // 应用过滤条件
      if (status) {
        query = query.where('reports.status', status);
      }

      if (targetType) {
        query = query.where('reports.target_type', targetType);
      }

      if (reason) {
        query = query.where('reports.reason', reason);
      }

      if (assignedAdminId) {
        query = query.where('reports.assigned_admin_id', assignedAdminId);
      }

      // 应用排序和分页
      query = query
        .orderBy(`reports.${sortBy}`, sortOrder)
        .limit(limit)
        .offset(offset);

      const reports = await query;

      // 解析 metadata
      return reports.map(report => ({
        ...report,
        metadata: JSON.parse(report.metadata || '{}')
      }));
    } catch (error) {
      console.error('获取举报列表失败:', error);
      return [];
    }
  }

  // 分配举报给管理员
  static async assignReport(reportId, adminId) {
    try {
      const [updatedReport] = await db('reports')
        .where('id', reportId)
        .update({
          assigned_admin_id: adminId,
          status: 'reviewing',
          updated_at: db.fn.now()
        })
        .returning('*');

      if (!updatedReport) {
        throw new Error('举报记录不存在');
      }

      console.log(`举报 ${reportId} 已分配给管理员 ${adminId}`);
      return updatedReport;
    } catch (error) {
      console.error('分配举报失败:', error);
      throw error;
    }
  }

  // 处理举报（解决或拒绝）
  static async resolveReport(reportId, adminId, resolution, adminNote = null) {
    try {
      const validResolutions = ['resolved', 'rejected'];
      if (!validResolutions.includes(resolution)) {
        throw new Error('无效的处理结果');
      }

      const [updatedReport] = await db('reports')
        .where('id', reportId)
        .update({
          status: resolution,
          assigned_admin_id: adminId,
          admin_note: adminNote,
          resolved_at: db.fn.now(),
          updated_at: db.fn.now()
        })
        .returning('*');

      if (!updatedReport) {
        throw new Error('举报记录不存在');
      }

      // 更新统计数据
      const statsType = resolution === 'resolved' ? 'resolved' : 'rejected';
      await this.updateReportStatistics(
        updatedReport.target_type,
        updatedReport.reason,
        statsType
      );

      console.log(`管理员 ${adminId} ${resolution === 'resolved' ? '解决' : '拒绝'}了举报 ${reportId}`);
      return updatedReport;
    } catch (error) {
      console.error('处理举报失败:', error);
      throw error;
    }
  }

  // 获取举报详情
  static async getReportById(reportId) {
    try {
      const report = await db('reports')
        .select(
          'reports.*',
          'reporter.username as reporter_username',
          'reporter.display_name as reporter_display_name',
          'reporter.avatar_url as reporter_avatar',
          'admin.username as admin_username',
          'admin.display_name as admin_display_name'
        )
        .leftJoin('users as reporter', 'reports.reporter_id', 'reporter.id')
        .leftJoin('users as admin', 'reports.assigned_admin_id', 'admin.id')
        .where('reports.id', reportId)
        .first();

      if (!report) {
        return null;
      }

      return {
        ...report,
        metadata: JSON.parse(report.metadata || '{}')
      };
    } catch (error) {
      console.error('获取举报详情失败:', error);
      return null;
    }
  }

  // 获取举报统计信息
  static async getReportStatistics(startDate = null, endDate = null) {
    try {
      let query = db('report_statistics')
        .select('*');

      if (startDate) {
        query = query.where('report_date', '>=', startDate);
      }

      if (endDate) {
        query = query.where('report_date', '<=', endDate);
      }

      const stats = await query.orderBy('report_date', 'desc');

      // 聚合统计
      const summary = {
        totalReports: 0,
        totalResolved: 0,
        totalRejected: 0,
        byReason: {},
        byTargetType: {}
      };

      stats.forEach(stat => {
        summary.totalReports += stat.report_count;
        summary.totalResolved += stat.resolved_count;
        summary.totalRejected += stat.rejected_count;

        // 按原因分类
        if (!summary.byReason[stat.reason]) {
          summary.byReason[stat.reason] = {
            reports: 0,
            resolved: 0,
            rejected: 0
          };
        }
        summary.byReason[stat.reason].reports += stat.report_count;
        summary.byReason[stat.reason].resolved += stat.resolved_count;
        summary.byReason[stat.reason].rejected += stat.rejected_count;

        // 按目标类型分类
        if (!summary.byTargetType[stat.target_type]) {
          summary.byTargetType[stat.target_type] = {
            reports: 0,
            resolved: 0,
            rejected: 0
          };
        }
        summary.byTargetType[stat.target_type].reports += stat.report_count;
        summary.byTargetType[stat.target_type].resolved += stat.resolved_count;
        summary.byTargetType[stat.target_type].rejected += stat.rejected_count;
      });

      return {
        details: stats,
        summary
      };
    } catch (error) {
      console.error('获取举报统计失败:', error);
      return { details: [], summary: {} };
    }
  }

  // 更新举报统计数据
  static async updateReportStatistics(targetType, reason, action) {
    try {
      const today = new Date().toISOString().split('T')[0];

      // 查找或创建今日统计记录
      let stats = await db('report_statistics')
        .where({
          report_date: today,
          target_type: targetType,
          reason: reason
        })
        .first();

      if (!stats) {
        // 创建新的统计记录
        await db('report_statistics')
          .insert({
            report_date: today,
            target_type: targetType,
            reason: reason,
            report_count: action === 'report' ? 1 : 0,
            resolved_count: action === 'resolved' ? 1 : 0,
            rejected_count: action === 'rejected' ? 1 : 0
          });
      } else {
        // 更新现有统计记录
        const updateData = { updated_at: db.fn.now() };

        switch (action) {
          case 'report':
            updateData.report_count = db.raw('report_count + 1');
            break;
          case 'resolved':
            updateData.resolved_count = db.raw('resolved_count + 1');
            break;
          case 'rejected':
            updateData.rejected_count = db.raw('rejected_count + 1');
            break;
        }

        await db('report_statistics')
          .where('id', stats.id)
          .update(updateData);
      }
    } catch (error) {
      console.error('更新举报统计失败:', error);
    }
  }

  // 获取用户举报历史
  static async getUserReports(userId, limit = 20, offset = 0) {
    try {
      const reports = await db('reports')
        .select('*')
        .where('reporter_id', userId)
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset);

      return reports.map(report => ({
        ...report,
        metadata: JSON.parse(report.metadata || '{}')
      }));
    } catch (error) {
      console.error('获取用户举报历史失败:', error);
      return [];
    }
  }

  // 获取管理员工作台数据
  static async getAdminDashboard(adminId = null) {
    try {
      // 基础统计
      const [pendingCount, reviewingCount, totalCount] = await Promise.all([
        db('reports').where('status', 'pending').count('id as count').first(),
        db('reports').where('status', 'reviewing').count('id as count').first(),
        db('reports').count('id as count').first()
      ]);

      // 如果指定管理员，获取该管理员的分配情况
      let assignedToMe = null;
      if (adminId) {
        assignedToMe = await db('reports')
          .where('assigned_admin_id', adminId)
          .where('status', 'reviewing')
          .count('id as count')
          .first();
      }

      // 最近的举报
      const recentReports = await this.getReports({
        limit: 10,
        sortBy: 'created_at',
        sortOrder: 'desc'
      });

      return {
        pending: parseInt(pendingCount.count),
        reviewing: parseInt(reviewingCount.count),
        total: parseInt(totalCount.count),
        assignedToMe: assignedToMe ? parseInt(assignedToMe.count) : null,
        recentReports
      };
    } catch (error) {
      console.error('获取管理员工作台数据失败:', error);
      return {
        pending: 0,
        reviewing: 0,
        total: 0,
        assignedToMe: null,
        recentReports: []
      };
    }
  }
}

module.exports = Report;