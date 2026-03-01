const knex = require('../config/database');
const logger = require('../utils/logger');

/**
 * Badge 聚合服务
 * 聚合各模块的未读/待处理计数，供 Tab Bar Badge 展示。
 */
class BadgeService {

  /**
   * 获取用户的所有 badge 计数
   * @param {string} userId
   * @returns {object} { map, feed, alliance, leaderboard, profile }
   */
  static async getBadgeCounts(userId) {
    try {
      // 并行查询所有数据源
      const [
        unreadNotifications,
        canCheckin,
        pendingApplications,
        activeEvents,
        unclaimedAchievements,
        unclaimedChallenges,
      ] = await Promise.all([
        this.getUnreadNotificationCount(userId),
        this.getCanCheckin(userId),
        this.getPendingAllianceApplications(userId),
        this.getActiveEventCount(),
        this.getUnclaimedAchievementCount(userId),
        this.getUnclaimedChallengeCount(userId),
      ]);

      // 聚合到各 Tab
      const profileCount = unreadNotifications + (canCheckin ? 1 : 0) + unclaimedAchievements + unclaimedChallenges;
      const allianceCount = pendingApplications;

      return {
        map: {
          hasActivity: activeEvents > 0,
        },
        feed: {
          count: 0, // Feed 功能尚未实现，占位
        },
        alliance: {
          count: allianceCount,
        },
        leaderboard: {
          rankChanged: false, // Sprint 1 排名变动由客户端本地判断
        },
        profile: {
          count: profileCount,
        },
      };
    } catch (error) {
      logger.error('获取 badge 计数失败:', error);
      // 返回空状态而非抛错，避免影响前端体验
      return {
        map: { hasActivity: false },
        feed: { count: 0 },
        alliance: { count: 0 },
        leaderboard: { rankChanged: false },
        profile: { count: 0 },
      };
    }
  }

  /**
   * 未读通知数
   */
  static async getUnreadNotificationCount(userId) {
    try {
      const result = await knex('notifications')
        .where({ user_id: userId, is_read: false })
        .count('* as count')
        .first();
      return parseInt(result.count) || 0;
    } catch {
      return 0;
    }
  }

  /**
   * 今天是否可以签到
   */
  static async getCanCheckin(userId) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const existing = await knex('user_checkins')
        .where({ user_id: userId, checkin_date: today })
        .first();
      return !existing;
    } catch {
      return false;
    }
  }

  /**
   * 用户管理的联盟中待审核申请数
   */
  static async getPendingAllianceApplications(userId) {
    try {
      // 找到用户是 leader 或 admin 的联盟
      const managedAlliances = await knex('alliance_members')
        .where({ user_id: userId })
        .whereIn('role', ['leader', 'admin'])
        .select('alliance_id');

      if (managedAlliances.length === 0) return 0;

      const allianceIds = managedAlliances.map(a => a.alliance_id);

      const result = await knex('alliance_applications')
        .whereIn('alliance_id', allianceIds)
        .where({ status: 'pending' })
        .count('* as count')
        .first();

      return parseInt(result.count) || 0;
    } catch {
      return 0;
    }
  }

  /**
   * 当前活跃事件数
   */
  static async getActiveEventCount() {
    try {
      const now = new Date();
      const result = await knex('events')
        .where('status', 'active')
        .where('start_time', '<=', now)
        .where('end_time', '>=', now)
        .count('* as count')
        .first();
      return parseInt(result.count) || 0;
    } catch {
      return 0;
    }
  }

  /**
   * 未领取的成就奖励数
   */
  static async getUnclaimedAchievementCount(userId) {
    try {
      const result = await knex('user_achievements')
        .where({
          user_id: userId,
          is_completed: true,
          is_claimed: false,
        })
        .whereNot('achievement_id', 0) // 排除 stats sentinel row
        .count('* as count')
        .first();
      return parseInt(result.count) || 0;
    } catch {
      return 0;
    }
  }

  /**
   * 未领取的每日挑战奖励数
   */
  static async getUnclaimedChallengeCount(userId) {
    try {
      const result = await knex('user_challenges')
        .where({
          user_id: userId,
          is_completed: true,
          is_claimed: false,
        })
        .count('* as count')
        .first();
      return parseInt(result.count) || 0;
    } catch {
      return 0;
    }
  }
}

module.exports = BadgeService;
