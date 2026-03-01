const { db } = require('../config/database');
const logger = require('../utils/logger');

class PersonalStatsController {
  /**
   * 获取个人仪表盘数据
   * GET /api/stats/dashboard
   */
  static async getDashboard(req, res) {
    try {
      const userId = req.user.id;

      const [heatmap, weeklyTrend, monthlyTrend, cityFootprint, overview] = await Promise.all([
        PersonalStatsController.getHeatmapData(userId),
        PersonalStatsController.getWeeklyTrend(userId),
        PersonalStatsController.getMonthlyTrend(userId),
        PersonalStatsController.getCityFootprint(userId),
        PersonalStatsController.getOverview(userId)
      ]);

      res.json({
        success: true,
        data: {
          overview,
          heatmap,
          weeklyTrend,
          monthlyTrend,
          cityFootprint
        }
      });
    } catch (error) {
      logger.error('获取个人仪表盘失败:', error);
      res.status(500).json({ success: false, message: '获取个人仪表盘失败', error: error.message });
    }
  }

  /**
   * 总览数据
   */
  static async getOverview(userId) {
    const [totalPixels, totalSessions, totalCities, streakData] = await Promise.all([
      db('pixels_history').where('user_id', userId).count('* as count').first(),
      db('drawing_sessions').where('user_id', userId).where('status', 'completed').count('* as count').first(),
      db('pixels_history')
        .where('user_id', userId)
        .whereNotNull('city')
        .countDistinct('city as count')
        .first(),
      PersonalStatsController.getCurrentStreak(userId)
    ]);

    return {
      total_pixels: parseInt(totalPixels?.count || 0),
      total_sessions: parseInt(totalSessions?.count || 0),
      total_cities: parseInt(totalCities?.count || 0),
      current_streak: streakData
    };
  }

  /**
   * 热力日历数据 (最近365天)
   */
  static async getHeatmapData(userId) {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const oneYearAgoDate = oneYearAgo.toISOString().split('T')[0];

    const rows = await db('pixels_history')
      .select(db.raw('history_date as date'))
      .count('* as count')
      .where('user_id', userId)
      .where('history_date', '>=', oneYearAgoDate)
      .groupBy('history_date')
      .orderBy('date', 'asc');

    return rows.map(r => ({
      date: r.date,
      count: parseInt(r.count)
    }));
  }

  /**
   * 周趋势 (最近12周)
   */
  static async getWeeklyTrend(userId) {
    const twelveWeeksAgo = new Date();
    twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);
    const twelveWeeksAgoDate = twelveWeeksAgo.toISOString().split('T')[0];

    const rows = await db('pixels_history')
      .select(db.raw("DATE_TRUNC('week', history_date)::date as week_start"))
      .count('* as count')
      .where('user_id', userId)
      .where('history_date', '>=', twelveWeeksAgoDate)
      .groupByRaw("DATE_TRUNC('week', history_date)")
      .orderBy('week_start', 'asc');

    return rows.map(r => ({
      week_start: r.week_start,
      count: parseInt(r.count)
    }));
  }

  /**
   * 月趋势 (最近12个月)
   */
  static async getMonthlyTrend(userId) {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const twelveMonthsAgoDate = twelveMonthsAgo.toISOString().split('T')[0];

    const rows = await db('pixels_history')
      .select(db.raw("DATE_TRUNC('month', history_date)::date as month_start"))
      .count('* as count')
      .where('user_id', userId)
      .where('history_date', '>=', twelveMonthsAgoDate)
      .groupByRaw("DATE_TRUNC('month', history_date)")
      .orderBy('month_start', 'asc');

    return rows.map(r => ({
      month_start: r.month_start,
      count: parseInt(r.count)
    }));
  }

  /**
   * 城市足迹（基于 pixels_history 分区表）
   */
  static async getCityFootprint(userId) {
    const rows = await db('pixels_history')
      .select('city', 'country')
      .countDistinct('session_id as session_count')
      .count('* as total_pixels')
      .where('user_id', userId)
      .whereNotNull('city')
      .groupBy('city', 'country')
      .orderBy('total_pixels', 'desc')
      .limit(20);

    return rows.map(r => ({
      city: r.city,
      country: r.country,
      session_count: parseInt(r.session_count),
      total_pixels: parseInt(r.total_pixels || 0)
    }));
  }

  /**
   * 连续打卡天数
   */
  static async getCurrentStreak(userId) {
    // 获取最近60天有绘画的日期
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const sixtyDaysAgoDate = sixtyDaysAgo.toISOString().split('T')[0];

    const rows = await db('pixels_history')
      .distinct('history_date as date')
      .where('user_id', userId)
      .where('history_date', '>=', sixtyDaysAgoDate)
      .orderBy('date', 'desc');

    if (rows.length === 0) return 0;

    const dates = rows.map(r => new Date(r.date).toISOString().split('T')[0]);
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // 如果今天和昨天都没有记录，连续天数为0
    if (dates[0] !== today && dates[0] !== yesterday) return 0;

    let streak = 1;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]);
      const curr = new Date(dates[i]);
      const diffDays = (prev - curr) / 86400000;
      if (diffDays === 1) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  /**
   * 获取今日统计
   * GET /api/stats/today
   */
  static async getTodayStats(req, res) {
    try {
      const userId = req.user.id;
      const today = new Date().toISOString().split('T')[0];
      const CacheService = require('../services/cacheService');

      // 🔧 优化：尝试从缓存读取
      const cacheKey = `${CacheService.PREFIXES.TODAY_STATS}${userId}:${today}`;
      const cached = await CacheService.get(cacheKey);

      if (cached) {
        logger.debug(`✅ 今日统计缓存命中: userId=${userId}`);
        return res.json({
          success: true,
          data: cached,
          cached: true
        });
      }

      // 缓存未命中，查询数据库
      logger.debug(`📊 今日统计缓存未命中，查询数据库: userId=${userId}`);
      const startTime = Date.now();

      // 🔧 优化：使用 BETWEEN 避免 DATE() 函数，启用索引
      const todayStart = new Date(today + 'T00:00:00Z');
      const todayEnd = new Date(today + 'T23:59:59.999Z');

      // 今日会话数和时长
      const todaySessions = await db('drawing_sessions')
        .where('user_id', userId)
        .whereBetween('created_at', [todayStart, todayEnd])
        .select(
          db.raw('COUNT(*) as today_sessions'),
          db.raw("COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(end_time, NOW()) - start_time))), 0)::int as today_duration")
        )
        .first();

      // 今日像素数（从 pixels_history 分区表统计）
      const todayPixels = await db('pixels_history')
        .where('user_id', userId)
        .where('history_date', today)
        .count('* as count')
        .first();

      // 连续登录天数
      const streak = await PersonalStatsController.getCurrentStreak(userId);

      const queryTime = Date.now() - startTime;
      logger.info(`📊 数据库查询完成: userId=${userId}, 耗时=${queryTime}ms`);

      const stats = {
        today_pixels: parseInt(todayPixels?.count) || 0,
        today_sessions: parseInt(todaySessions.today_sessions) || 0,
        today_duration: parseInt(todaySessions.today_duration) || 0,
        login_streak: streak
      };

      // 🔧 优化：写入缓存
      await CacheService.set(cacheKey, stats, CacheService.TTL.TODAY_STATS);
      logger.debug(`✅ 今日统计已缓存: userId=${userId}, TTL=${CacheService.TTL.TODAY_STATS}s`);

      res.json({
        success: true,
        data: stats,
        cached: false,
        queryTime
      });
    } catch (error) {
      logger.error('获取今日统计失败:', error);
      res.status(500).json({ success: false, message: '获取今日统计失败' });
    }
  }

  /**
   * 🔧 新增：使缓存失效
   * 在像素绘制时调用，确保数据一致性
   */
  static async invalidateTodayStatsCache(userId) {
    try {
      const CacheService = require('../services/cacheService');
      const today = new Date().toISOString().split('T')[0];
      const cacheKey = `${CacheService.PREFIXES.TODAY_STATS}${userId}:${today}`;

      await CacheService.del(cacheKey);
      logger.debug(`🔄 今日统计缓存已失效: userId=${userId}`);
    } catch (error) {
      logger.error('使缓存失效失败:', error);
      // 不影响主流程
    }
  }
}

module.exports = PersonalStatsController;
