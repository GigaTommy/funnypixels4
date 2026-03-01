const logger = require('../utils/logger');
const { db } = require('../config/database');

/**
 * 历史记录控制器 - 统一管理用户的所有历史记录
 */
class HistoryController {
  /**
   * 获取用户完整历史记录
   * GET /api/history?type=bottles|treasures|all&period=day|week|month|all&limit=20&offset=0
   */
  static async getUserHistory(req, res) {
    try {
      const userId = req.user.id;
      const {
        type = 'all',        // bottles, treasures, all
        period = 'all',      // day, week, month, all
        action = 'all',      // picked, hidden, found, created, all
        limit = 20,
        offset = 0,
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = req.query;

      logger.info('获取用户历史记录', {
        userId,
        type,
        period,
        action,
        limit,
        offset,
        sortBy,
        sortOrder
      });

      let historyItems = [];
      let totalCount = 0;

      // 计算时间范围
      let timeFilter = '';
      const now = new Date();

      switch (period) {
        case 'day':
          timeFilter = `AND created_at >= NOW() - INTERVAL '24 hours'`;
          break;
        case 'week':
          timeFilter = `AND created_at >= NOW() - INTERVAL '7 days'`;
          break;
        case 'month':
          timeFilter = `AND created_at >= NOW() - INTERVAL '30 days'`;
          break;
        default:
          timeFilter = '';
      }

      // 获取漂流瓶历史记录
      if (type === 'all' || type === 'bottles') {
        const bottleQuery = `
          SELECT
            'bottle' as type,
            status as action,
            id as item_id,
            bottle_id as title,
            note as description,
            NULL as image_url,
            NULL as lat,
            NULL as lng,
            acquired_at as created_at,
            last_action_at as updated_at,
            NULL as reward_points,
            status
          FROM user_drift_bottles
          WHERE user_id = ? ${timeFilter}
        `;

        const bottleResults = await db.raw(bottleQuery, [userId]);
        historyItems = historyItems.concat(bottleResults.rows || bottleResults);
      }

      // 获取QR宝藏历史记录
      if (type === 'all' || type === 'treasures') {
        // 藏宝记录
        if (action === 'all' || action === 'hidden') {
          const hiddenQuery = `
            SELECT
              'treasure' as type,
              'hidden' as action,
              treasure_id as item_id,
              title,
              description,
              image_url,
              hide_lat as lat,
              hide_lng as lng,
              hidden_at as created_at,
              hidden_at as updated_at,
              CASE
                WHEN reward_type = 'points' THEN (reward_value->>'amount')::int
                ELSE 0
              END as reward_points,
              CASE
                WHEN finder_id IS NOT NULL THEN 'found'
                ELSE 'active'
              END as status
            FROM qr_treasures
            WHERE hider_id = ? ${timeFilter}
          `;

          const hiddenResults = await db.raw(hiddenQuery, [userId]);
          historyItems = historyItems.concat(hiddenResults.rows || hiddenResults);
        }

        // 寻宝记录
        if (action === 'all' || action === 'found') {
          const foundQuery = `
            SELECT
              'treasure' as type,
              'found' as action,
              treasure_id as item_id,
              title,
              description,
              image_url,
              hide_lat as lat,
              hide_lng as lng,
              found_at as created_at,
              found_at as updated_at,
              CASE
                WHEN reward_type = 'points' THEN (reward_value->>'amount')::int
                ELSE 0
              END as reward_points,
              'claimed' as status
            FROM qr_treasures
            WHERE finder_id = ? ${timeFilter}
          `;

          const foundResults = await db.raw(foundQuery, [userId]);
          historyItems = historyItems.concat(foundResults.rows || foundResults);
        }

        // 扫描历史记录
        const scanQuery = `
          SELECT
            'scan' as type,
            'scanned' as action,
            id as item_id,
            qr_code_hash as title,
            scan_result as description,
            NULL as image_url,
            scan_lat as lat,
            scan_lng as lng,
            scanned_at as created_at,
            scanned_at as updated_at,
            NULL as reward_points,
            CASE
              WHEN treasure_id IS NOT NULL THEN 'success'
              ELSE 'scanned'
            END as status
          FROM qr_scan_history
          WHERE user_id = ? ${timeFilter}
        `;

        const scanResults = await db.raw(scanQuery, [userId]);
        historyItems = historyItems.concat(scanResults.rows || scanResults);
      }

      // 应用行动筛选
      if (action !== 'all') {
        historyItems = historyItems.filter(item => item.action === action);
      }

      // 排序
      historyItems.sort((a, b) => {
        const aValue = a[sortBy] || a.created_at;
        const bValue = b[sortBy] || b.created_at;

        if (sortOrder === 'asc') {
          return new Date(aValue) - new Date(bValue);
        } else {
          return new Date(bValue) - new Date(aValue);
        }
      });

      totalCount = historyItems.length;

      // 分页
      const paginatedItems = historyItems.slice(
        parseInt(offset),
        parseInt(offset) + parseInt(limit)
      );

      // 格式化数据
      const formattedItems = paginatedItems.map(item => ({
        ...item,
        // 格式化时间
        created_at: item.created_at,
        // 添加相对时间
        relative_time: HistoryController.getRelativeTime(item.created_at),
        // 添加位置描述（如果有坐标）
        location: item.lat && item.lng ? {
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lng)
        } : null
      }));

      res.json({
        success: true,
        data: {
          items: formattedItems,
          pagination: {
            total: totalCount,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: parseInt(offset) + parseInt(limit) < totalCount
          },
          filters: {
            type,
            period,
            action,
            sortBy,
            sortOrder
          }
        }
      });

    } catch (error) {
      logger.error('获取历史记录失败:', error);
      res.status(500).json({
        success: false,
        message: '获取历史记录失败',
        error: error.message
      });
    }
  }

  /**
   * 获取历史记录统计信息
   * GET /api/history/stats
   */
  static async getHistoryStats(req, res) {
    try {
      const userId = req.user.id;

      logger.info('获取历史记录统计', { userId });

      // 并行查询各类统计数据
      const [
        bottleStats,
        treasureStats,
        scanStats,
        recentActivity
      ] = await Promise.all([
        // 漂流瓶统计
        db('user_drift_bottles')
          .where('user_id', userId)
          .select(
            db.raw('COUNT(*) as total'),
            db.raw('SUM(CASE WHEN status = \'created\' THEN 1 ELSE 0 END) as created'),
            db.raw('SUM(CASE WHEN status = \'picked\' THEN 1 ELSE 0 END) as picked')
          )
          .first(),

        // QR宝藏统计
        Promise.all([
          // 藏宝统计
          db('qr_treasures')
            .where('hider_id', userId)
            .select(
              db.raw('COUNT(*) as hidden'),
              db.raw('SUM(CASE WHEN finder_id IS NOT NULL THEN 1 ELSE 0 END) as found'),
              db.raw('SUM(CASE WHEN reward_type = \'points\' THEN (reward_value->>\'amount\')::int ELSE 0 END) as total_rewards')
            )
            .first(),

          // 寻宝统计
          db('qr_treasures')
            .where('finder_id', userId)
            .select(
              db.raw('COUNT(*) as found'),
              db.raw('SUM(CASE WHEN reward_type = \'points\' THEN (reward_value->>\'amount\')::int ELSE 0 END) as total_earned')
            )
            .first()
        ]),

        // 扫描统计
        db('qr_scan_history')
          .where('user_id', userId)
          .select(
            db.raw('COUNT(*) as total_scans'),
            db.raw('SUM(CASE WHEN treasure_id IS NOT NULL THEN 1 ELSE 0 END) as successful_scans')
          )
          .first(),

        // 最近活动
        db('qr_scan_history')
          .where('user_id', userId)
          .orderBy('scanned_at', 'desc')
          .limit(5)
          .select('scanned_at', 'qr_code_hash', 'treasure_id', 'scan_result')
      ]);

      const [hiddenStats, foundStats] = treasureStats;

      const stats = {
        bottles: {
          total: bottleStats.total || 0,
          created: bottleStats.created || 0,
          picked: bottleStats.picked || 0
        },
        treasures: {
          hidden: hiddenStats.hidden || 0,
          found_treasures: hiddenStats.found || 0,
          claimed: foundStats.found || 0,
          total_rewards_given: hiddenStats.total_rewards || 0,
          total_rewards_earned: foundStats.total_earned || 0
        },
        scans: {
          total: scanStats.total_scans || 0,
          successful: scanStats.successful_scans || 0,
          success_rate: scanStats.total_scans > 0
            ? Math.round((scanStats.successful_scans / scanStats.total_scans) * 100)
            : 0
        },
        recent_activity: recentActivity.map(activity => ({
          ...activity,
          relative_time: HistoryController.getRelativeTime(activity.scanned_at)
        }))
      };

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('获取历史记录统计失败:', error);
      res.status(500).json({
        success: false,
        message: '获取统计数据失败',
        error: error.message
      });
    }
  }

  /**
   * 获取用户成就进度
   * GET /api/history/achievements
   */
  static async getUserAchievements(req, res) {
    try {
      const userId = req.user.id;

      logger.info('获取用户成就进度', { userId });

      // 查询用户成就相关数据
      const [
        treasureStats,
        bottleStats,
        scanStats
      ] = await Promise.all([
        db('qr_treasures')
          .where('finder_id', userId)
          .count('* as found')
          .first(),

        db('user_drift_bottles')
          .where('user_id', userId)
          .count('* as collected')
          .first(),

        db('qr_scan_history')
          .where('user_id', userId)
          .where('treasure_id', 'IS NOT', null)
          .count('* as scans')
          .first()
      ]);

      const achievements = [
        {
          id: 'first_treasure',
          name: '初次寻宝',
          description: '找到第一个QR宝藏',
          icon: '🎯',
          completed: (treasureStats.found || 0) >= 1,
          progress: Math.min(100, (treasureStats.found || 0) * 100),
          target: 1,
          current: treasureStats.found || 0
        },
        {
          id: 'treasure_hunter',
          name: '寻宝达人',
          description: '找到10个QR宝藏',
          icon: '💎',
          completed: (treasureStats.found || 0) >= 10,
          progress: Math.min(100, ((treasureStats.found || 0) / 10) * 100),
          target: 10,
          current: treasureStats.found || 0
        },
        {
          id: 'bottle_collector',
          name: '漂流瓶收藏家',
          description: '收集20个漂流瓶',
          icon: '🍾',
          completed: (bottleStats.collected || 0) >= 20,
          progress: Math.min(100, ((bottleStats.collected || 0) / 20) * 100),
          target: 20,
          current: bottleStats.collected || 0
        },
        {
          id: 'scan_master',
          name: '扫码大师',
          description: '成功扫描50次',
          icon: '📱',
          completed: (scanStats.scans || 0) >= 50,
          progress: Math.min(100, ((scanStats.scans || 0) / 50) * 100),
          target: 50,
          current: scanStats.scans || 0
        }
      ];

      const completedCount = achievements.filter(a => a.completed).length;
      const totalCount = achievements.length;

      res.json({
        success: true,
        data: {
          achievements,
          summary: {
            completed: completedCount,
            total: totalCount,
            completion_rate: Math.round((completedCount / totalCount) * 100)
          }
        }
      });

    } catch (error) {
      logger.error('获取用户成就失败:', error);
      res.status(500).json({
        success: false,
        message: '获取成就数据失败',
        error: error.message
      });
    }
  }

  /**
   * 获取相对时间描述
   */
  static getRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}个月前`;
    return `${Math.floor(diffDays / 365)}年前`;
  }
}

module.exports = HistoryController;