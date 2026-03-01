const { db } = require('../config/database');

class NotificationSettings {
  constructor(data) {
    this.id = data.id;
    this.user_id = data.user_id;
    this.conversation_type = data.conversation_type; // 'private' or 'group'
    this.conversation_target_id = data.conversation_target_id;
    this.mute_until = data.mute_until; // null表示不静音，时间戳表示静音到什么时候
    this.mute_type = data.mute_type; // '1h', '8h', '1w', 'forever'
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  // 静音对话
  static async muteConversation(userId, conversationType, targetId, muteType) {
    let muteUntil = null;

    if (muteType !== 'forever') {
      const now = new Date();
      switch (muteType) {
        case '1h':
          muteUntil = new Date(now.getTime() + 60 * 60 * 1000);
          break;
        case '8h':
          muteUntil = new Date(now.getTime() + 8 * 60 * 60 * 1000);
          break;
        case '1w':
          muteUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
        default:
          throw new Error('无效的静音类型');
      }
    }

    // 检查是否已存在设置
    const existing = await db('notification_settings')
      .where({
        user_id: userId,
        conversation_type: conversationType,
        conversation_target_id: targetId
      })
      .first();

    if (existing) {
      // 更新现有设置
      const [updated] = await db('notification_settings')
        .where('id', existing.id)
        .update({
          mute_until: muteUntil,
          mute_type: muteType,
          updated_at: db.fn.now()
        })
        .returning('*');

      return new NotificationSettings(updated);
    } else {
      // 创建新设置
      const [setting] = await db('notification_settings')
        .insert({
          user_id: userId,
          conversation_type: conversationType,
          conversation_target_id: targetId,
          mute_until: muteUntil,
          mute_type: muteType
        })
        .returning('*');

      return new NotificationSettings(setting);
    }
  }

  // 取消静音
  static async unmuteConversation(userId, conversationType, targetId) {
    const deleted = await db('notification_settings')
      .where({
        user_id: userId,
        conversation_type: conversationType,
        conversation_target_id: targetId
      })
      .del();

    return deleted > 0;
  }

  // 检查对话是否被静音
  static async isConversationMuted(userId, conversationType, targetId) {
    const setting = await db('notification_settings')
      .where({
        user_id: userId,
        conversation_type: conversationType,
        conversation_target_id: targetId
      })
      .first();

    if (!setting) {
      return { isMuted: false, muteType: null, muteUntil: null };
    }

    // 检查是否过期
    if (setting.mute_until && new Date() > new Date(setting.mute_until)) {
      // 静音已过期，删除设置
      await db('notification_settings')
        .where('id', setting.id)
        .del();

      return { isMuted: false, muteType: null, muteUntil: null };
    }

    return {
      isMuted: true,
      muteType: setting.mute_type,
      muteUntil: setting.mute_until
    };
  }

  // 获取用户的所有静音设置
  static async getUserMutedConversations(userId) {
    const settings = await db('notification_settings as ns')
      .leftJoin('users as u', function() {
        this.on('ns.conversation_target_id', '=', 'u.id')
          .andOn('ns.conversation_type', '=', db.raw('?', ['private']));
      })
      .where('ns.user_id', userId)
      .select(
        'ns.*',
        'u.username as target_username',
        'u.avatar_url as target_avatar'
      );

    // 过滤掉已过期的静音设置
    const now = new Date();
    const validSettings = [];
    const expiredIds = [];

    for (const setting of settings) {
      if (setting.mute_until && now > new Date(setting.mute_until)) {
        expiredIds.push(setting.id);
      } else {
        validSettings.push(new NotificationSettings(setting));
      }
    }

    // 删除过期的设置
    if (expiredIds.length > 0) {
      await db('notification_settings')
        .whereIn('id', expiredIds)
        .del();
    }

    return validSettings;
  }

  // 清理过期的静音设置（定时任务用）
  static async cleanupExpiredMutes() {
    const deleted = await db('notification_settings')
      .where('mute_until', '<', db.fn.now())
      .whereNotNull('mute_until')
      .del();

    return deleted;
  }
}

module.exports = NotificationSettings;