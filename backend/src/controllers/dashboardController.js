const { db } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Dashboard控制器
 * 提供工作台的统计数据和最近活动
 */
class DashboardController {

  /**
   * 获取Dashboard统计数据
   */
  static async getStats(req, res) {
    try {
      // 并行查询各项统计数据
      const [
        totalUsersResult,
        totalPixelsResult,
        todayUsersResult,
        activeUsersResult
      ] = await Promise.all([
        // 总用户数
        db('users')
          .count('* as count')
          .first(),

        // 总像素数
        db('pixels')
          .count('* as count')
          .first(),

        // 今日注册用户数
        db('users')
          .where('created_at', '>=', db.raw("CURRENT_DATE"))
          .count('* as count')
          .first(),

        // 活跃用户数（最近7天有活动）
        db('users')
          .where('last_active_at', '>=', db.raw("NOW() - INTERVAL '7 days'"))
          .count('* as count')
          .first()
          .catch(() => ({ count: 0 })) // 如果字段不存在返回0
      ]);

      const stats = {
        totalUsers: parseInt(totalUsersResult?.count) || 0,
        totalPixels: parseInt(totalPixelsResult?.count) || 0,
        todayUsers: parseInt(todayUsersResult?.count) || 0,
        activeUsers: parseInt(activeUsersResult?.count) || 0
      };

      res.json({
        success: true,
        message: '获取统计数据成功',
        data: stats
      });

    } catch (error) {
      logger.error('获取Dashboard统计数据失败:', error);
      res.status(500).json({
        success: false,
        message: '获取统计数据失败',
        error: error.message
      });
    }
  }

  /**
   * 获取最近活动
   */
  static async getRecentActivities(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 10;

      // 查询最近的活动记录
      const activities = [];

      // 1. 最近注册的用户
      const recentUsers = await db('users')
        .select('id', 'username', 'display_name', 'created_at')
        .orderBy('created_at', 'desc')
        .limit(5);

      recentUsers.forEach(user => {
        activities.push({
          type: 'user_created',
          description: `新用户 ${user.display_name || user.username} 注册`,
          user: user.display_name || user.username,
          timestamp: user.created_at
        });
      });

      // 2. 最近审核的广告
      const recentAds = await db('ad_orders')
        .select('id', 'status', 'updated_at')
        .whereIn('status', ['approved', 'rejected'])
        .orderBy('updated_at', 'desc')
        .limit(5);

      recentAds.forEach(ad => {
        activities.push({
          type: ad.status === 'approved' ? 'ad_approved' : 'ad_rejected',
          description: `广告订单 #${ad.id} ${ad.status === 'approved' ? '已通过' : '已拒绝'}`,
          user: '管理员',
          timestamp: ad.updated_at
        });
      });

      // 3. 最近审核的自定义旗帜
      const recentFlags = await db('custom_flag_orders')
        .select('id', 'status', 'updated_at')
        .whereIn('status', ['approved', 'rejected'])
        .orderBy('updated_at', 'desc')
        .limit(5);

      recentFlags.forEach(flag => {
        activities.push({
          type: flag.status === 'approved' ? 'flag_approved' : 'flag_rejected',
          description: `自定义旗帜订单 #${flag.id} ${flag.status === 'approved' ? '已通过' : '已拒绝'}`,
          user: '管理员',
          timestamp: flag.updated_at
        });
      });

      // 按时间排序并限制数量
      activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      const limitedActivities = activities.slice(0, limit);

      res.json({
        success: true,
        message: '获取最近活动成功',
        data: {
          list: limitedActivities,
          total: limitedActivities.length
        }
      });

    } catch (error) {
      logger.error('获取最近活动失败:', error);
      res.status(500).json({
        success: false,
        message: '获取最近活动失败',
        error: error.message
      });
    }
  }
}

module.exports = DashboardController;
