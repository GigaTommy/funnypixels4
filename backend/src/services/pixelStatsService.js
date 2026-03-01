const { db } = require('../config/database');
const { PIXEL_TYPES } = require('../constants/pixelTypes');
const logger = require('../utils/logger');

/**
 * 像素统计服务
 * 专门用于计算用户和联盟的真实绘制像素统计
 * 剔除广告、图案炸弹等道具类像素
 */
class PixelStatsService {

  /**
   * 获取用户真实绘制的像素统计
   * 剔除广告、图案炸弹等道具类像素
   * @param {string} userId - 用户ID
   * @param {Object} options - 统计选项
   * @returns {Object} 统计结果
   */
  static async getUserRealPixelStats(userId, options = {}) {
    try {
      const {
        includeToday = true,
        includeWeek = true,
        includeAllTime = true
      } = options;

      // 基础查询条件：只统计真实绘制的像素
      const baseQuery = db('pixels')
        .where('user_id', userId)
        .where('pixel_type', 'basic'); // 只统计基础绘制类型

      let stats = {};

      // 今日统计
      if (includeToday) {
        const today = new Date().toISOString().split('T')[0];
        const todayStats = await baseQuery
          .clone()
          .whereRaw('DATE(created_at) = ?', [today])
          .select(
            db.raw('COUNT(*) as today_pixels'),
            db.raw('COUNT(DISTINCT grid_id) as today_unique_pixels')
          )
          .first();

        stats.todayPixels = parseInt(todayStats.today_pixels) || 0;
        stats.todayUniquePixels = parseInt(todayStats.today_unique_pixels) || 0;
      }

      // 本周统计
      if (includeWeek) {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        const weekStats = await baseQuery
          .clone()
          .where('created_at', '>=', weekAgo.toISOString())
          .select(
            db.raw('COUNT(*) as week_pixels'),
            db.raw('COUNT(DISTINCT grid_id) as week_unique_pixels')
          )
          .first();

        stats.weekPixels = parseInt(weekStats.week_pixels) || 0;
        stats.weekUniquePixels = parseInt(weekStats.week_unique_pixels) || 0;
      }

      // 总计统计
      if (includeAllTime) {
        const allTimeStats = await baseQuery
          .clone()
          .select(
            db.raw('COUNT(*) as total_pixels'),
            db.raw('COUNT(DISTINCT grid_id) as total_unique_pixels')
          )
          .first();

        stats.totalPixels = parseInt(allTimeStats.total_pixels) || 0;
        stats.totalUniquePixels = parseInt(allTimeStats.total_unique_pixels) || 0;

        // 当前占有像素数（当前实际占有的格子数）
        const currentOwnershipQuery = db('pixels')
          .where('user_id', userId)
          .where('pixel_type', 'basic')
          .select(db.raw('COUNT(DISTINCT grid_id) as current_ownership'));

        const currentOwnership = await currentOwnershipQuery.first();
        stats.currentOwnership = parseInt(currentOwnership.current_ownership) || 0;
      }

      // 获取用户原始统计用于对比
      const originalStats = await db('users')
        .where('id', userId)
        .select('total_pixels', 'current_pixels')
        .first();

      stats.originalTotalPixels = parseInt(originalStats?.total_pixels) || 0;
      stats.originalCurrentPixels = parseInt(originalStats?.current_pixels) || 0;

      // 计算差异（显示被道具类像素影响的数量）
      stats.proposedPixelsDelta = stats.originalTotalPixels - stats.totalPixels;
      stats.proposedOwnershipDelta = stats.originalCurrentPixels - stats.currentOwnership;

      logger.debug(`📊 用户 ${userId} 真实像素统计完成:`, stats);

      return stats;

    } catch (error) {
      logger.error(`❌ 获取用户真实像素统计失败: ${userId}`, error);
      throw error;
    }
  }

  /**
   * 获取联盟真实绘制的像素统计
   * 剔除广告、图案炸弹等道具类像素
   * @param {string} allianceId - 联盟ID
   * @param {Array} memberIds - 成员ID列表
   * @param {Object} options - 统计选项
   * @returns {Object} 统计结果
   */
  static async getAllianceRealPixelStats(allianceId, memberIds, options = {}) {
    try {
      const {
        includeToday = true,
        includeWeek = true,
        includeAllTime = true
      } = options;

      if (!memberIds || memberIds.length === 0) {
        return this.getEmptyAllianceStats();
      }

      // 基础查询条件：只统计真实绘制的像素
      const baseQuery = db('pixels')
        .whereIn('user_id', memberIds)
        .where('pixel_type', 'basic'); // 只统计基础绘制类型

      let stats = {};

      // 今日统计
      if (includeToday) {
        const today = new Date().toISOString().split('T')[0];
        const todayStats = await baseQuery
          .clone()
          .whereRaw('DATE(created_at) = ?', [today])
          .select(
            db.raw('COUNT(*) as today_pixels'),
            db.raw('COUNT(DISTINCT grid_id) as today_unique_pixels')
          )
          .first();

        stats.todayPixels = parseInt(todayStats.today_pixels) || 0;
        stats.todayUniquePixels = parseInt(todayStats.today_unique_pixels) || 0;
      }

      // 本周统计
      if (includeWeek) {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        const weekStats = await baseQuery
          .clone()
          .where('created_at', '>=', weekAgo.toISOString())
          .select(
            db.raw('COUNT(*) as week_pixels'),
            db.raw('COUNT(DISTINCT grid_id) as week_unique_pixels')
          )
          .first();

        stats.weekPixels = parseInt(weekStats.week_pixels) || 0;
        stats.weekUniquePixels = parseInt(weekStats.week_unique_pixels) || 0;
      }

      // 总计统计
      if (includeAllTime) {
        const allTimeStats = await baseQuery
          .clone()
          .select(
            db.raw('COUNT(*) as total_pixels'),
            db.raw('COUNT(DISTINCT grid_id) as total_unique_pixels')
          )
          .first();

        stats.totalPixels = parseInt(allTimeStats.total_pixels) || 0;
        stats.totalUniquePixels = parseInt(allTimeStats.total_unique_pixels) || 0;

        // 当前占有像素数（当前实际占有的格子数）
        const currentOwnershipQuery = db('pixels')
          .whereIn('user_id', memberIds)
          .where('pixel_type', 'basic')
          .select(db.raw('COUNT(DISTINCT grid_id) as current_ownership'));

        const currentOwnership = await currentOwnershipQuery.first();
        stats.currentOwnership = parseInt(currentOwnership.current_ownership) || 0;
      }

      // 获取联盟原始统计用于对比
      const originalStats = await this.getAllianceOriginalStats(memberIds);
      stats.originalTotalPixels = originalStats.totalPixels;
      stats.originalCurrentPixels = originalStats.currentPixels;

      // 计算差异
      stats.proposedPixelsDelta = stats.originalTotalPixels - stats.totalPixels;
      stats.proposedOwnershipDelta = stats.originalCurrentPixels - stats.currentOwnership;

      stats.memberCount = memberIds.length;

      logger.debug(`📊 联盟 ${allianceId} 真实像素统计完成:`, stats);

      return stats;

    } catch (error) {
      logger.error(`❌ 获取联盟真实像素统计失败: ${allianceId}`, error);
      throw error;
    }
  }

  /**
   * 获取联盟原始统计（用于对比）
   */
  static async getAllianceOriginalStats(memberIds) {
    try {
      // 直接查询pixels表获取原始统计
      const currentQuery = await db('pixels')
        .whereIn('user_id', memberIds)
        .count('* as count')
        .first();

      const totalQuery = await db('pixels')
        .whereIn('user_id', memberIds)
        .count('* as count')
        .first();

      return {
        currentPixels: parseInt(currentQuery.count) || 0,
        totalPixels: parseInt(totalQuery.count) || 0
      };

    } catch (error) {
      logger.warn('获取联盟原始统计失败，使用默认值:', error);
      return {
        currentPixels: 0,
        totalPixels: 0
      };
    }
  }

  /**
   * 获取空的联盟统计结构
   */
  static getEmptyAllianceStats() {
    return {
      todayPixels: 0,
      todayUniquePixels: 0,
      weekPixels: 0,
      weekUniquePixels: 0,
      totalPixels: 0,
      totalUniquePixels: 0,
      currentOwnership: 0,
      originalTotalPixels: 0,
      originalCurrentPixels: 0,
      proposedPixelsDelta: 0,
      proposedOwnershipDelta: 0,
      memberCount: 0
    };
  }

  /**
   * 批量更新用户的真实像素统计
   * 用于定期同步用户表中的统计数据
   * @param {Array} userIds - 用户ID列表，如果为空则更新所有用户
   */
  static async batchUpdateUserRealStats(userIds = null) {
    try {
      logger.info(`🔄 开始批量更新用户真实像素统计${userIds ? `(${userIds.length}个用户)` : '(所有用户)'}`);

      let query = db('users as u')
        .select('u.id')
        .leftJoin('pixels as p', function() {
          this.on('u.id', '=', 'p.user_id')
            .andOn('p.pixel_type', '=', db.raw('?'), ['basic']);
        });

      if (userIds && userIds.length > 0) {
        query = query.whereIn('u.id', userIds);
      }

      const userStats = await query
        .select(
          'u.id',
          db.raw('COUNT(p.id) as real_total_pixels'),
          db.raw('COUNT(DISTINCT p.grid_id) as real_current_pixels')
        )
        .groupBy('u.id');

      let updatedCount = 0;

      for (const userStat of userStats) {
        try {
          await db('users')
            .where('id', userStat.id)
            .update({
              real_total_pixels: parseInt(userStat.real_total_pixels),
              real_current_pixels: parseInt(userStat.real_current_pixels),
              updated_at: new Date()
            });

          updatedCount++;
        } catch (error) {
          logger.error(`❌ 更新用户 ${userStat.id} 真实统计失败:`, error);
        }
      }

      logger.info(`✅ 批量更新用户真实像素统计完成: ${updatedCount}/${userStats.length}个用户`);

      return {
        totalUsers: userStats.length,
        updatedUsers: updatedCount
      };

    } catch (error) {
      logger.error('❌ 批量更新用户真实像素统计失败:', error);
      throw error;
    }
  }

  /**
   * 获取全局像素统计（剔除道具类像素）
   */
  /**
   * 🔧 性能优化：将 5 次独立查询合并为 2 次（1 次 CTE 聚合 + 1 次分组查询）
   */
  static async getGlobalRealPixelStats() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      // 🔧 合并 4 个基础统计查询为单次扫描（条件聚合）
      const [mainStats, propPixelsQuery] = await Promise.all([
        db('pixels')
          .where('pixel_type', 'basic')
          .select(
            db.raw('COUNT(*) as total_real_pixels'),
            db.raw('COUNT(*) FILTER (WHERE DATE(created_at) = ?) as today_real_pixels', [today]),
            db.raw('COUNT(*) FILTER (WHERE created_at >= ?) as week_real_pixels', [weekAgo.toISOString()]),
            db.raw('COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) as active_users')
          )
          .first(),
        db('pixels')
          .where('pixel_type', '!=', 'basic')
          .select('pixel_type', db.raw('COUNT(*) as count'))
          .groupBy('pixel_type')
      ]);

      const stats = {
        totalRealPixels: parseInt(mainStats.total_real_pixels) || 0,
        todayRealPixels: parseInt(mainStats.today_real_pixels) || 0,
        weekRealPixels: parseInt(mainStats.week_real_pixels) || 0,
        activeUsers: parseInt(mainStats.active_users) || 0,
        propPixelsByType: {}
      };

      for (const propPixel of propPixelsQuery) {
        stats.propPixelsByType[propPixel.pixel_type] = parseInt(propPixel.count);
      }

      stats.totalPropPixels = Object.values(stats.propPixelsByType)
        .reduce((sum, count) => sum + count, 0);

      logger.debug('📊 全局真实像素统计完成:', stats);

      return stats;

    } catch (error) {
      logger.error('❌ 获取全局真实像素统计失败:', error);
      throw error;
    }
  }
}

module.exports = PixelStatsService;