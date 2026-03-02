const { db } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Quick Stats Controller
 *
 * Provides aggregated stats for map quick stats popover
 */

class QuickStatsController {
  /**
   * Get today's stats for current user
   * GET /api/stats/today
   */
  static async getTodayStats(req, res) {
    try {
      const userId = req.user.id;
      const today = new Date().toISOString().split('T')[0];

      // Get today's stats in parallel
      const [pixelStats, sessionStats, streakData] = await Promise.all([
        // Today's pixel count
        db('pixels')
          .where('user_id', userId)
          .where(db.raw('DATE(created_at) = ?', [today]))
          .count('* as count')
          .first(),

        // Today's session count and duration
        db('drawing_sessions')
          .where('user_id', userId)
          .where(db.raw('DATE(start_time) = ?', [today]))
          .select(
            db.raw('COUNT(*) as session_count'),
            db.raw('COALESCE(SUM(duration_seconds), 0) as total_duration')
          )
          .first(),

        // Login streak
        QuickStatsController.getLoginStreak(userId)
      ]);

      const stats = {
        today_pixels: parseInt(pixelStats?.count || 0),
        today_sessions: parseInt(sessionStats?.session_count || 0),
        today_duration: parseInt(sessionStats?.total_duration || 0),
        login_streak: streakData.streak,
        current_rank: null, // TODO: Calculate from leaderboard
        points_balance: null, // TODO: Get from users table
        resource_value: null, // TODO: Get resource system value
      };

      // Get additional user stats if needed
      const user = await db('users')
        .where('id', userId)
        .select('points')
        .first();

      if (user) {
        stats.points_balance = user.points || 0;
      }

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Failed to get today stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get stats'
      });
    }
  }

  /**
   * Get user's login streak
   */
  static async getLoginStreak(userId) {
    try {
      // Check checkin records for consecutive days
      const checkins = await db('user_check_ins')
        .where('user_id', userId)
        .where('check_in_date', '>=', db.raw('CURRENT_DATE - INTERVAL \'30 days\''))
        .orderBy('check_in_date', 'desc')
        .select('check_in_date');

      if (checkins.length === 0) {
        return { streak: 0, lastCheckin: null };
      }

      let streak = 0;
      let currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);

      for (const checkin of checkins) {
        const checkinDate = new Date(checkin.check_in_date);
        checkinDate.setHours(0, 0, 0, 0);

        const diffDays = Math.floor((currentDate - checkinDate) / (1000 * 60 * 60 * 24));

        if (diffDays === streak) {
          streak++;
          currentDate = checkinDate;
        } else {
          break;
        }
      }

      return {
        streak,
        lastCheckin: checkins[0]?.check_in_date
      };
    } catch (error) {
      logger.error('Failed to calculate login streak:', error);
      return { streak: 0, lastCheckin: null };
    }
  }

  /**
   * Get user's current leaderboard rank
   */
  static async getCurrentRank(userId) {
    try {
      // Get from personal leaderboard
      const entry = await db('leaderboard_personal')
        .where('user_id', userId)
        .first();

      return entry?.rank || null;
    } catch (error) {
      logger.error('Failed to get current rank:', error);
      return null;
    }
  }
}

module.exports = QuickStatsController;
