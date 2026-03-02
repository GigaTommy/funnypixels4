const MapNotification = require('../models/MapNotification');
const logger = require('../utils/logger');

/**
 * Map Notification Controller
 *
 * Handles API endpoints for map activity/event notifications
 */

class MapNotificationController {
  /**
   * Get active notifications
   * GET /api/map-notifications
   */
  static async getNotifications(req, res) {
    try {
      const userId = req.user?.id;
      const limit = parseInt(req.query.limit) || 5;

      const notifications = await MapNotification.getActiveNotifications(userId, limit);

      // Filter out dismissed notifications for this user
      let filteredNotifications = notifications;
      if (userId) {
        const { db } = require('../config/database');
        const dismissed = await db('map_notification_dismissals')
          .where('user_id', userId)
          .pluck('notification_id');

        filteredNotifications = notifications.filter(n => !dismissed.includes(n.id));
      }

      res.json({
        success: true,
        data: {
          notifications: filteredNotifications.map(n => ({
            id: n.id,
            type: n.type,
            title: n.title,
            message: n.message,
            priority: n.priority,
            remaining_seconds: n.remaining_seconds,
            target_location: n.target_lat && n.target_lng ? {
              lat: parseFloat(n.target_lat),
              lng: parseFloat(n.target_lng)
            } : null,
            metadata: n.metadata
          }))
        }
      });
    } catch (error) {
      logger.error('Failed to get map notifications:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get notifications'
      });
    }
  }

  /**
   * Dismiss a notification
   * POST /api/map-notifications/:id/dismiss
   */
  static async dismissNotification(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      await MapNotification.dismiss(id, userId);

      res.json({
        success: true,
        message: 'Notification dismissed'
      });
    } catch (error) {
      logger.error('Failed to dismiss notification:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to dismiss notification'
      });
    }
  }

  /**
   * Create a notification (admin only)
   * POST /api/map-notifications
   */
  static async createNotification(req, res) {
    try {
      // TODO: Add admin authentication check
      const {
        type,
        title,
        message,
        priority,
        duration_seconds,
        end_time,
        target_location,
        metadata
      } = req.body;

      const notification = await MapNotification.create({
        type,
        title,
        message,
        priority,
        duration_seconds,
        end_time: end_time ? new Date(end_time) : null,
        target_location,
        metadata
      });

      res.json({
        success: true,
        data: { notification }
      });
    } catch (error) {
      logger.error('Failed to create notification:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create notification'
      });
    }
  }
}

module.exports = MapNotificationController;
