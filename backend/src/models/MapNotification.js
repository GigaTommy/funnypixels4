const { db } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Map Notification Model
 *
 * Manages activity/event notifications shown in the map banner
 * Types: region_challenge, alliance_war, treasure_refresh, season_reminder, system_announcement
 */

const NOTIFICATION_TYPES = {
  REGION_CHALLENGE: 'region_challenge',
  ALLIANCE_WAR: 'alliance_war',
  TREASURE_REFRESH: 'treasure_refresh',
  SEASON_REMINDER: 'season_reminder',
  SYSTEM_ANNOUNCEMENT: 'system_announcement'
};

const PRIORITY_LEVELS = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  URGENT: 4
};

class MapNotification {
  /**
   * Create a new map notification
   */
  static async create({
    type,
    title,
    message,
    priority = PRIORITY_LEVELS.MEDIUM,
    duration_seconds = null,
    end_time = null,
    target_location = null, // { lat, lng }
    metadata = {}
  }) {
    try {
      const [notification] = await db('map_notifications')
        .insert({
          type,
          title,
          message,
          priority,
          duration_seconds,
          end_time,
          target_lat: target_location?.lat,
          target_lng: target_location?.lng,
          metadata: JSON.stringify(metadata),
          is_active: true,
          created_at: db.fn.now()
        })
        .returning('*');

      logger.info(`✅ Created map notification: type=${type}, priority=${priority}`);
      return notification;
    } catch (error) {
      logger.error('Failed to create map notification:', error);
      throw error;
    }
  }

  /**
   * Get active notifications for a user
   * Filters by priority and returns sorted by priority DESC
   */
  static async getActiveNotifications(userId = null, limit = 10) {
    try {
      let query = db('map_notifications')
        .where('is_active', true)
        .where(function() {
          this.whereNull('end_time')
            .orWhere('end_time', '>', db.fn.now());
        })
        .orderBy('priority', 'desc')
        .orderBy('created_at', 'desc')
        .limit(limit);

      // TODO: Add user-specific filtering (dismissed notifications, targeting rules)

      const notifications = await query;

      // Calculate remaining time for duration-based notifications
      return notifications.map(n => ({
        ...n,
        metadata: typeof n.metadata === 'string' ? JSON.parse(n.metadata) : n.metadata,
        remaining_seconds: n.end_time
          ? Math.max(0, Math.floor((new Date(n.end_time) - new Date()) / 1000))
          : null
      }));
    } catch (error) {
      logger.error('Failed to get active notifications:', error);
      throw error;
    }
  }

  /**
   * Dismiss a notification for a specific user
   */
  static async dismiss(notificationId, userId) {
    try {
      await db('map_notification_dismissals')
        .insert({
          notification_id: notificationId,
          user_id: userId,
          dismissed_at: db.fn.now()
        })
        .onConflict(['notification_id', 'user_id'])
        .ignore();

      logger.info(`✅ Dismissed notification: id=${notificationId}, userId=${userId}`);
    } catch (error) {
      logger.error('Failed to dismiss notification:', error);
      throw error;
    }
  }

  /**
   * Expire old notifications
   */
  static async expireOldNotifications() {
    try {
      const result = await db('map_notifications')
        .where('is_active', true)
        .where('end_time', '<', db.fn.now())
        .update({ is_active: false });

      if (result > 0) {
        logger.info(`✅ Expired ${result} old notifications`);
      }
      return result;
    } catch (error) {
      logger.error('Failed to expire notifications:', error);
      throw error;
    }
  }

  /**
   * Create territory alert notification
   */
  static async createTerritoryAlert(allianceId, regionName, attackerAllianceName) {
    return this.create({
      type: NOTIFICATION_TYPES.ALLIANCE_WAR,
      title: '领地警报',
      message: `${attackerAllianceName}正在入侵「${regionName}」`,
      priority: PRIORITY_LEVELS.URGENT,
      duration_seconds: 1800, // 30 minutes
      end_time: new Date(Date.now() + 30 * 60 * 1000),
      metadata: {
        alliance_id: allianceId,
        attacker_alliance: attackerAllianceName,
        region_name: regionName
      }
    });
  }

  /**
   * Create treasure refresh notification
   */
  static async createTreasureRefresh(regionName, treasureCount, location) {
    return this.create({
      type: NOTIFICATION_TYPES.TREASURE_REFRESH,
      title: '宝箱刷新',
      message: `${regionName}出现了${treasureCount}个宝箱`,
      priority: PRIORITY_LEVELS.MEDIUM,
      duration_seconds: 3600, // 1 hour
      end_time: new Date(Date.now() + 60 * 60 * 1000),
      target_location: location,
      metadata: {
        treasure_count: treasureCount,
        region_name: regionName
      }
    });
  }

  /**
   * Create region challenge notification
   */
  static async createRegionChallenge(challengeName, regionName, endTime, location) {
    return this.create({
      type: NOTIFICATION_TYPES.REGION_CHALLENGE,
      title: '限时活动',
      message: `「${challengeName}」进行中`,
      priority: PRIORITY_LEVELS.HIGH,
      end_time: endTime,
      target_location: location,
      metadata: {
        challenge_name: challengeName,
        region_name: regionName
      }
    });
  }
}

module.exports = MapNotification;
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
module.exports.PRIORITY_LEVELS = PRIORITY_LEVELS;
