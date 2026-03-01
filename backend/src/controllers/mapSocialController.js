const ActivePlayerService = require('../services/activePlayerService');
const { db } = require('../config/database');
const logger = require('../utils/logger');

class MapSocialController {
  /**
   * GET /api/map-social/nearby-players?lat=&lng=&radius=500
   */
  static async getNearbyPlayers(req, res) {
    try {
      const userId = req.user.id;
      const { lat, lng, radius = 500 } = req.query;

      if (!lat || !lng) {
        return res.status(400).json({
          success: false,
          message: 'lat and lng are required'
        });
      }

      const players = await ActivePlayerService.getNearbyPlayers(
        parseFloat(lat),
        parseFloat(lng),
        Math.min(parseInt(radius), 5000), // Cap at 5km
        userId
      );

      res.json({
        success: true,
        data: {
          players,
          count: players.length
        }
      });
    } catch (error) {
      logger.error('获取附近玩家失败:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get nearby players'
      });
    }
  }

  /**
   * POST /api/map-social/update-location
   * Body: { lat, lng, isDrawing }
   */
  static async updateLocation(req, res) {
    try {
      const userId = req.user.id;
      const { lat, lng, isDrawing = false } = req.body;

      if (!lat || !lng) {
        return res.status(400).json({
          success: false,
          message: 'lat and lng are required'
        });
      }

      // Get user data for the player card
      const user = await db('users')
        .where('id', userId)
        .select('id', 'username', 'display_name', 'avatar_url', 'avatar', 'total_pixels')
        .first();

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Get alliance info if any
      const membership = await db('alliance_members')
        .where('user_id', userId)
        .join('alliances', 'alliances.id', 'alliance_members.alliance_id')
        .select('alliances.name as alliance_name')
        .first();

      // Get rank tier
      const rankInfo = await db('user_checkin_stats')
        .where('user_id', userId)
        .select('total_checkins')
        .first();

      await ActivePlayerService.updatePlayerLocation(userId, parseFloat(lat), parseFloat(lng), {
        username: user.username,
        displayName: user.display_name || user.username,
        avatarUrl: user.avatar_url,
        avatar: user.avatar,
        totalPixels: user.total_pixels || 0,
        allianceName: membership?.alliance_name || '',
        isDrawing
      });

      // 每日任务进度：地图探索
      try {
        const DailyTaskController = require('./dailyTaskController');
        await DailyTaskController.updateTaskProgress(userId, 'explore_map', 1);
      } catch (taskErr) {
        // Silent fail
      }

      res.json({ success: true });
    } catch (error) {
      logger.error('更新位置失败:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update location'
      });
    }
  }

  /**
   * POST /api/map-social/leave
   */
  static async leaveMap(req, res) {
    try {
      const userId = req.user.id;
      await ActivePlayerService.removePlayer(userId);
      res.json({ success: true });
    } catch (error) {
      logger.error('离开地图失败:', error);
      res.status(500).json({ success: false, message: 'Failed to leave map' });
    }
  }
}

module.exports = MapSocialController;
