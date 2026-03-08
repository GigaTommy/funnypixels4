const { db: knex } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Push Notification Service
 *
 * Manages device token registration, push notification sending, and
 * scheduled reminder delivery. Currently uses console.log for the
 * actual push transport — replace the _sendPush method with APNs /
 * FCM calls when credentials are configured.
 */
class PushNotificationService {
  // ---------------------------------------------------------------------------
  // Device token management
  // ---------------------------------------------------------------------------

  /**
   * Register (upsert) a device token for a user.
   * If the token already exists it will be re-activated and reassigned
   * to the given user (handles device-transfer scenarios).
   */
  async registerDeviceToken(userId, deviceToken, platform = 'ios') {
    try {
      const existing = await knex('device_tokens')
        .where('device_token', deviceToken)
        .first();

      if (existing) {
        await knex('device_tokens')
          .where('device_token', deviceToken)
          .update({
            user_id: userId,
            platform,
            is_active: true,
            updated_at: knex.fn.now()
          });
        logger.info('Device token updated', { userId, platform });
      } else {
        await knex('device_tokens').insert({
          user_id: userId,
          device_token: deviceToken,
          platform,
          is_active: true,
          created_at: knex.fn.now(),
          updated_at: knex.fn.now()
        });
        logger.info('Device token registered', { userId, platform });
      }

      return { success: true };
    } catch (error) {
      logger.error('Failed to register device token', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Deactivate a device token (e.g. on logout).
   */
  async removeDeviceToken(deviceToken) {
    try {
      const updated = await knex('device_tokens')
        .where('device_token', deviceToken)
        .update({
          is_active: false,
          updated_at: knex.fn.now()
        });

      logger.info('Device token deactivated', { deviceToken: deviceToken.substring(0, 12) + '...', updated });
      return { success: true };
    } catch (error) {
      logger.error('Failed to remove device token', { error: error.message });
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Notification sending
  // ---------------------------------------------------------------------------

  /**
   * Send a push notification to a specific user (all their active devices).
   * The notification is also logged into the push_notifications table.
   */
  async sendToUser(userId, title, body, type, data = null) {
    try {
      // 1. Log the notification
      await knex('push_notifications').insert({
        user_id: userId,
        title,
        body,
        type,
        data: data ? JSON.stringify(data) : null,
        sent_at: knex.fn.now()
      });

      // 2. Fetch all active device tokens for this user
      const tokens = await knex('device_tokens')
        .where({ user_id: userId, is_active: true })
        .select('device_token', 'platform');

      if (tokens.length === 0) {
        logger.debug('No active device tokens for user', { userId, type });
        return { success: true, delivered: 0 };
      }

      // 3. Send to each device
      let delivered = 0;
      for (const token of tokens) {
        const result = await this._sendPush(token.device_token, token.platform, title, body, data);
        if (result.success) {
          delivered++;
        }
      }

      logger.info('Push notification sent', { userId, type, delivered, total: tokens.length });
      return { success: true, delivered, total: tokens.length };
    } catch (error) {
      logger.error('Failed to send push notification', { error: error.message, userId, type });
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Pre-built reminder helpers
  // ---------------------------------------------------------------------------

  /**
   * Send a streak reminder to a user.
   */
  async sendStreakReminder(userId) {
    try {
      // Look up current streak from the checkin stats table
      const stats = await knex('user_checkin_stats')
        .where('user_id', userId)
        .select('current_streak')
        .first();

      const streak = stats ? stats.current_streak : 0;
      const title = "Don't lose your streak!";
      const body = streak > 0
        ? `You're on a ${streak} day streak! Check in today to keep it going.`
        : 'Start a new streak by checking in today!';

      return await this.sendToUser(userId, title, body, 'streak_reminder', { streak });
    } catch (error) {
      logger.error('Failed to send streak reminder', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Send a daily challenge reminder to a user.
   */
  async sendChallengeReminder(userId) {
    const title = 'Daily challenge is waiting!';
    const body = 'Your daily challenge is waiting! Complete it to earn rewards.';

    return await this.sendToUser(userId, title, body, 'challenge_reminder');
  }

  /**
   * Send an event reminder to a user.
   */
  async sendEventReminder(userId, eventTitle) {
    const title = 'Event starting soon!';
    const body = `Event starting soon: ${eventTitle}`;

    return await this.sendToUser(userId, title, body, 'event_reminder', { eventTitle });
  }

  // ---------------------------------------------------------------------------
  // Scheduled / cron helpers
  // ---------------------------------------------------------------------------

  /**
   * Query users who have not checked in today and send streak reminders.
   * Intended to be called by an external cron job (e.g. node-cron).
   */
  async scheduleDailyReminders() {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      // Find users who:
      //  1. Have at least one active device token
      //  2. Have a streak > 0 (they would lose something)
      //  3. Have NOT checked in today
      const usersToRemind = await knex('user_checkin_stats as ucs')
        .join('device_tokens as dt', 'dt.user_id', 'ucs.user_id')
        .where('dt.is_active', true)
        .where('ucs.current_streak', '>', 0)
        .where(function () {
          this.where('ucs.last_checkin_date', '<', today)
            .orWhereNull('ucs.last_checkin_date');
        })
        .groupBy('ucs.user_id', 'ucs.current_streak')
        .select('ucs.user_id');

      logger.info('Scheduling daily streak reminders', { usersCount: usersToRemind.length });

      let sent = 0;
      for (const row of usersToRemind) {
        try {
          await this.sendStreakReminder(row.user_id);
          sent++;
        } catch (err) {
          logger.error('Failed to send daily reminder to user', {
            userId: row.user_id,
            error: err.message
          });
        }
      }

      logger.info('Daily reminders completed', { sent, total: usersToRemind.length });
      return { sent, total: usersToRemind.length };
    } catch (error) {
      logger.error('Failed to schedule daily reminders', { error: error.message });
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Internal transport — swap this out for APNs / FCM
  // ---------------------------------------------------------------------------

  /**
   * Actually deliver a push notification to a single device.
   * Delegates to notificationService (APNs via node-apn) for iOS.
   * Falls back to console.log when APNs credentials are not configured.
   *
   * @param {string} deviceToken
   * @param {string} platform - 'ios' | 'android'
   * @param {string} title
   * @param {string} body
   * @param {Object|null} data
   * @returns {Promise<{success: boolean}>}
   */
  async _sendPush(deviceToken, platform, title, body, data) {
    if (platform === 'ios') {
      const notificationService = require('./notificationService');
      if (notificationService.isConnected) {
        return await notificationService.sendPushNotification(deviceToken, title, body, data);
      }
    }

    // Fallback: mock mode when APNs not configured or non-iOS platform
    logger.debug('[PushNotification] Mock send', {
      platform,
      token: deviceToken.substring(0, 12) + '...',
      title
    });
    return { success: true, mock: true };
  }
}

// Export singleton
module.exports = new PushNotificationService();
