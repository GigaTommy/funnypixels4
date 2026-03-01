// 修复 ChatMessage.js 中的 markChannelAsRead 方法
// 问题：SQL查询中 channel_type 字段存在歧义

static async markChannelAsRead(userId, channelType, channelId) {
  try {
    // 获取该频道的所有未读消息ID - 修复字段歧义问题
    const unreadMessages = await db('chat_messages')
      .select('chat_messages.id', 'chat_messages.channel_type', 'chat_messages.channel_id')
      .leftJoin('chat_unread_messages', function() {
        this.on('chat_messages.id', '=', 'chat_unread_messages.message_id')
          .andOn('chat_unread_messages.user_id', '=', db.raw('?', [userId]));
      })
      // 🔧 修复：所有 WHERE 条件都使用表前缀
      .where('chat_messages.channel_type', channelType)  // ✅ 添加表前缀
      .andWhere(builder => {
        if (channelId) {
          builder.where('chat_messages.channel_id', channelId);  // ✅ 添加表前缀
        } else {
          builder.whereNull('chat_messages.channel_id');  // ✅ 添加表前缀
        }
      })
      .andWhere('chat_messages.sender_id', '!=', userId)  // ✅ 添加表前缀
      .andWhere(builder => {
        builder.whereNull('chat_messages.is_deleted')  // ✅ 添加表前缀
          .orWhere('chat_messages.is_deleted', false);  // ✅ 添加表前缀
      })
      .whereNull('chat_unread_messages.id');  // ✅ 添加表前缀

    if (unreadMessages.length > 0) {
      await this.markMessagesAsRead(userId, unreadMessages);
    }

    console.log(`标记频道为已读成功: 用户${userId}, 频道${channelType}:${channelId}`);
  } catch (error) {
    console.error('标记频道为已读失败:', error);
    throw error;
  }
}