const { db } = require('../config/database');

class ConversationPin {
  constructor(data) {
    this.id = data.id;
    this.user_id = data.user_id;
    this.conversation_type = data.conversation_type; // 'private' or 'group'
    this.conversation_target_id = data.conversation_target_id; // 对方用户ID或群组ID
    this.pinned_at = data.pinned_at;
    this.created_at = data.created_at;
  }

  // 置顶对话
  static async pinConversation(userId, conversationType, targetId) {
    // 检查当前置顶数量
    const currentPins = await db('conversation_pins')
      .where('user_id', userId)
      .count('* as count')
      .first();

    if (parseInt(currentPins.count) >= 6) {
      throw new Error('最多只能置顶6个对话');
    }

    // 检查是否已经置顶
    const existing = await db('conversation_pins')
      .where({
        user_id: userId,
        conversation_type: conversationType,
        conversation_target_id: targetId
      })
      .first();

    if (existing) {
      throw new Error('该对话已经置顶');
    }

    const [pin] = await db('conversation_pins')
      .insert({
        user_id: userId,
        conversation_type: conversationType,
        conversation_target_id: targetId,
        pinned_at: db.fn.now()
      })
      .returning('*');

    return new ConversationPin(pin);
  }

  // 取消置顶
  static async unpinConversation(userId, conversationType, targetId) {
    const deleted = await db('conversation_pins')
      .where({
        user_id: userId,
        conversation_type: conversationType,
        conversation_target_id: targetId
      })
      .del();

    return deleted > 0;
  }

  // 获取用户的置顶对话列表
  static async getUserPinnedConversations(userId) {
    const pins = await db('conversation_pins as cp')
      .leftJoin('users as u', function() {
        this.on('cp.conversation_target_id', '=', 'u.id')
          .andOn('cp.conversation_type', '=', db.raw('?', ['private']));
      })
      .where('cp.user_id', userId)
      .select(
        'cp.*',
        'u.username as target_username',
        'u.avatar_url as target_avatar'
      )
      .orderBy('cp.pinned_at', 'desc');

    return pins.map(pin => new ConversationPin(pin));
  }

  // 检查对话是否已置顶
  static async isConversationPinned(userId, conversationType, targetId) {
    const pin = await db('conversation_pins')
      .where({
        user_id: userId,
        conversation_type: conversationType,
        conversation_target_id: targetId
      })
      .first();

    return !!pin;
  }

  // 获取置顶数量
  static async getPinnedCount(userId) {
    const result = await db('conversation_pins')
      .where('user_id', userId)
      .count('* as count')
      .first();

    return parseInt(result.count);
  }
}

module.exports = ConversationPin;