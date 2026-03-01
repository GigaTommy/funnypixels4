const { db } = require('../config/database');

class AllianceActivityController {
  /**
   * Record an activity log entry
   */
  static async recordActivity(allianceId, userId, username, actionType, detail = null) {
    try {
      await db('alliance_activity_log').insert({
        alliance_id: allianceId,
        user_id: userId,
        username: username,
        action_type: actionType,
        detail: detail,
        created_at: new Date()
      });
    } catch (error) {
      // Log but don't throw - activity logging should not break main operations
      console.error('Failed to record alliance activity:', error.message);
    }
  }

  /**
   * GET /alliances/:id/activity-log
   * Returns recent activity for an alliance
   */
  static async getActivityLog(req, res) {
    try {
      const allianceId = parseInt(req.params.id);
      const limit = Math.min(parseInt(req.query.limit) || 20, 50);
      const offset = parseInt(req.query.offset) || 0;

      // Verify user is a member of this alliance
      const membership = await db('alliance_members')
        .where({ alliance_id: allianceId, user_id: req.user.id })
        .first();

      if (!membership) {
        return res.status(403).json({
          success: false,
          message: 'You are not a member of this alliance'
        });
      }

      const activities = await db('alliance_activity_log')
        .where('alliance_id', allianceId)
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset)
        .select('id', 'user_id', 'username', 'action_type', 'detail', 'created_at');

      return res.json({
        success: true,
        data: activities
      });
    } catch (error) {
      console.error('Failed to get activity log:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to load activity log'
      });
    }
  }
}

module.exports = AllianceActivityController;
