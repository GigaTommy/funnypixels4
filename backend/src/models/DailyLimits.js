const { db } = require('../config/database');

class DailyLimits {
  constructor(data) {
    this.id = data.id;
    this.user_id = data.user_id;
    this.date = data.date;
    this.new_conversations_count = data.new_conversations_count || 0;
    this.message_count = data.message_count || 0;
    this.media_message_count = data.media_message_count || 0;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  // 获取今日限制记录
  static async getTodayLimits(userId) {
    const today = new Date().toISOString().split('T')[0];

    let record = await db('daily_limits')
      .where('user_id', userId)
      .where('date', today)
      .first();

    if (!record) {
      // 创建今日记录
      [record] = await db('daily_limits')
        .insert({
          user_id: userId,
          date: today,
          new_conversations_count: 0,
          message_count: 0,
          media_message_count: 0
        })
        .returning('*');
    }

    return new DailyLimits(record);
  }

  // 检查用户是否为陌生人（非互相关注）
  static async isStrangerUser(userId1, userId2) {
    // 检查是否互相关注
    const follow1 = await db('user_follows')
      .where('follower_id', userId1)
      .where('following_id', userId2)
      .where('is_active', true)
      .first();

    const follow2 = await db('user_follows')
      .where('follower_id', userId2)
      .where('following_id', userId1)
      .where('is_active', true)
      .first();

    return !(follow1 && follow2); // 如果不是互相关注，则为陌生人
  }

  // 检查是否可以开启新对话
  static async canStartNewConversation(senderId, receiverId) {
    const isStranger = await this.isStrangerUser(senderId, receiverId);

    if (!isStranger) {
      return { canStart: true, reason: null, isStranger: false };
    }

    const limits = await this.getTodayLimits(senderId);
    const MAX_NEW_CONVERSATIONS = 5; // 陌生用户每日最多5个新对话

    if (limits.new_conversations_count >= MAX_NEW_CONVERSATIONS) {
      return {
        canStart: false,
        reason: `今日新对话数量已达上限（${MAX_NEW_CONVERSATIONS}个）`,
        isStranger: true,
        currentCount: limits.new_conversations_count,
        maxCount: MAX_NEW_CONVERSATIONS
      };
    }

    return {
      canStart: true,
      reason: null,
      isStranger: true,
      currentCount: limits.new_conversations_count,
      maxCount: MAX_NEW_CONVERSATIONS
    };
  }

  // 检查是否可以发送消息
  static async canSendMessage(senderId, receiverId, messageType = 'text') {
    const isStranger = await this.isStrangerUser(senderId, receiverId);

    if (!isStranger) {
      return { canSend: true, reason: null, isStranger: false };
    }

    const limits = await this.getTodayLimits(senderId);

    // 陌生用户限制
    const MAX_MESSAGES = 20; // 每日最多20条消息给陌生用户
    const MAX_MEDIA_MESSAGES = 5; // 每日最多5条媒体消息

    // 检查总消息数限制
    if (limits.message_count >= MAX_MESSAGES) {
      return {
        canSend: false,
        reason: `今日发送消息数量已达上限（${MAX_MESSAGES}条）`,
        isStranger: true,
        limitType: 'message_count'
      };
    }

    // 检查媒体消息限制
    if (messageType !== 'text' && limits.media_message_count >= MAX_MEDIA_MESSAGES) {
      return {
        canSend: false,
        reason: `今日发送媒体消息数量已达上限（${MAX_MEDIA_MESSAGES}条）`,
        isStranger: true,
        limitType: 'media_count'
      };
    }

    return {
      canSend: true,
      reason: null,
      isStranger: true,
      currentMessageCount: limits.message_count,
      maxMessageCount: MAX_MESSAGES,
      currentMediaCount: limits.media_message_count,
      maxMediaCount: MAX_MEDIA_MESSAGES
    };
  }

  // 记录新对话
  static async recordNewConversation(userId) {
    const today = new Date().toISOString().split('T')[0];

    await db('daily_limits')
      .where('user_id', userId)
      .where('date', today)
      .increment('new_conversations_count', 1);

    return this.getTodayLimits(userId);
  }

  // 记录消息发送
  static async recordMessage(userId, messageType = 'text') {
    const today = new Date().toISOString().split('T')[0];

    const updateData = { message_count: db.raw('message_count + 1') };

    if (messageType !== 'text') {
      updateData.media_message_count = db.raw('media_message_count + 1');
    }

    await db('daily_limits')
      .where('user_id', userId)
      .where('date', today)
      .update(updateData);

    return this.getTodayLimits(userId);
  }

  // 获取用户的每日限制状态
  static async getUserLimitStatus(userId) {
    const limits = await this.getTodayLimits(userId);

    return {
      today: limits.date,
      new_conversations: {
        current: limits.new_conversations_count,
        max: 5,
        remaining: Math.max(0, 5 - limits.new_conversations_count)
      },
      messages: {
        current: limits.message_count,
        max: 20,
        remaining: Math.max(0, 20 - limits.message_count)
      },
      media_messages: {
        current: limits.media_message_count,
        max: 5,
        remaining: Math.max(0, 5 - limits.media_message_count)
      }
    };
  }

  // 清理旧记录（定时任务用）
  static async cleanupOldRecords(daysToKeep = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    const deleted = await db('daily_limits')
      .where('date', '<', cutoffDateStr)
      .del();

    return deleted;
  }
}

module.exports = DailyLimits;