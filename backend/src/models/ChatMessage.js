const { db } = require('../config/database');
const CacheService = require('../services/cacheService');

class ChatMessage {
  // 创建消息
  static async create(data) {
    const {
      senderId,
      conversationId = null,
      channelType,
      channelId,
      content,
      messageType = 'text',
      metadata = {},
      isSystemMessage = false
    } = data;

    const [message] = await db('chat_messages')
      .insert({
        sender_id: senderId,
        conversation_id: conversationId,
        channel_type: channelType,
        channel_id: channelId,
        message_type: messageType,
        content,
        metadata,
        is_system_message: isSystemMessage
      })
      .returning('*');

    const [hydrated] = await this.hydrateMessages([message]);
    return hydrated;
  }

  static parseMetadata(rawMetadata) {
    if (!rawMetadata) {
      return {};
    }

    if (typeof rawMetadata === 'object') {
      return rawMetadata;
    }

    if (typeof rawMetadata === 'string') {
      try {
        return JSON.parse(rawMetadata);
      } catch (error) {
        console.warn('Failed to parse chat message metadata:', error);
        return {};
      }
    }

    return {};
  }

  static async hydrateMessages(messages) {
    if (!messages || messages.length === 0) {
      return [];
    }

    const userIds = [...new Set(messages.map(message => message.sender_id).filter(Boolean))];
    const userInfos = await this.getUsersBatch(userIds);

    return messages.map(message => {
      const userInfo = userInfos[message.sender_id] || {};

      return {
        ...message,
        metadata: this.parseMetadata(message.metadata),
        sender_name: userInfo.display_name || userInfo.username || 'Unknown',
        sender_avatar: userInfo.avatar_url || null
      };
    });
  }

  static async findById(messageId) {
    const message = await db('chat_messages')
      .where('id', messageId)
      .first();

    if (!message) {
      return null;
    }

    const [hydrated] = await this.hydrateMessages([message]);
    return hydrated || null;
  }

  // 获取频道消息 - 优化版本
  static async getChannelMessages(channelType, channelId, limit = 50, offset = 0) {
    try {
      // 构建查询条件
      let whereCondition = {
        'chat_messages.channel_type': channelType
      };
      
      // 只有当channelId存在且不为null时才添加到查询条件
      if (channelId && channelId !== 'global') {
        whereCondition['chat_messages.channel_id'] = channelId;
      } else if (channelType === 'global') {
        // 全局频道的特殊处理
        whereCondition['chat_messages.channel_id'] = null;
      }

      // 先尝试从缓存获取用户信息
      const messages = await db('chat_messages')
        .select('chat_messages.*')
        .where(whereCondition)
        .andWhere(builder => {
          builder.whereNull('chat_messages.is_deleted').orWhere('chat_messages.is_deleted', false);
        })
        .orderBy('chat_messages.created_at', 'desc')
        .limit(limit)
        .offset(offset);

      const hydratedMessages = await this.hydrateMessages(messages);
      return hydratedMessages.reverse(); // 返回时间正序
    } catch (error) {
      console.error('获取频道消息失败:', error);
      throw error;
    }
  }

  // 获取私聊消息 - 优化版本
  static async getPrivateMessages(userId1, userId2, limit = 50, offset = 0) {
    try {
      const messages = await db('chat_messages')
        .select('chat_messages.*')
        .where(function() {
          this.where({
            'chat_messages.channel_type': 'private',
            'chat_messages.sender_id': userId1,
            'chat_messages.channel_id': userId2
          }).orWhere({
            'chat_messages.channel_type': 'private',
            'chat_messages.sender_id': userId2,
            'chat_messages.channel_id': userId1
          });
        })
        .andWhere(builder => {
          builder.whereNull('chat_messages.is_deleted').orWhere('chat_messages.is_deleted', false);
        })
        .orderBy('chat_messages.created_at', 'desc')
        .limit(limit)
        .offset(offset);

      const hydratedMessages = await this.hydrateMessages(messages);
      return hydratedMessages.reverse();
    } catch (error) {
      console.error('获取私聊消息失败:', error);
      throw error;
    }
  }

  static async getConversationMessages(conversationId, limit = 50, offset = 0) {
    try {
      const messages = await db('chat_messages')
        .select('chat_messages.*')
        .where('chat_messages.conversation_id', conversationId)
        .andWhere(builder => {
          builder.whereNull('chat_messages.is_deleted').orWhere('chat_messages.is_deleted', false);
        })
        .orderBy('chat_messages.created_at', 'desc')
        .limit(limit)
        .offset(offset);

      const hydratedMessages = await this.hydrateMessages(messages);
      return hydratedMessages.reverse();
    } catch (error) {
      console.error('获取会话消息失败:', error);
      throw error;
    }
  }

  // 批量获取用户信息 - 新增功能
  static async getUsersBatch(userIds) {
    if (!userIds || userIds.length === 0) return {};
    
    try {
      // 先尝试从缓存获取
      const cachedUsers = {};
      const uncachedUserIds = [];
      
      for (const userId of userIds) {
        const cachedUser = await CacheService.getChatUserInfo(userId);
        if (cachedUser) {
          cachedUsers[userId] = cachedUser;
        } else {
          uncachedUserIds.push(userId);
        }
      }
      
      // 从数据库获取未缓存的用户信息
      if (uncachedUserIds.length > 0) {
        const dbUsers = await db('users')
          .select('id', 'username', 'avatar_url', 'display_name')
          .whereIn('id', uncachedUserIds);
        
        // 缓存新获取的用户信息
        const userInfosToCache = dbUsers.map(user => ({
          userId: user.id,
          userInfo: {
            username: user.username,
            avatar_url: user.avatar_url,
            display_name: user.display_name
          }
        }));
        
        if (userInfosToCache.length > 0) {
          await CacheService.setChatUserInfoBatch(userInfosToCache);
        }
        
        // 合并到结果中
        dbUsers.forEach(user => {
          cachedUsers[user.id] = {
            username: user.username,
            avatar_url: user.avatar_url,
            display_name: user.display_name
          };
        });
      }
      
      return cachedUsers;
    } catch (error) {
      console.error('批量获取用户信息失败:', error);
      return {};
    }
  }

  // 获取未读消息 - 优化版本
  static async getUnreadMessages(userId, channelType, channelId, limit = 50, offset = 0) {
    try {
      const messages = await db('chat_messages')
        .select('chat_messages.*')
        .leftJoin('chat_unread_messages', function() {
          this.on('chat_messages.id', '=', 'chat_unread_messages.message_id')
            .andOn('chat_unread_messages.user_id', '=', db.raw('?', [userId]));
        })
        .where(builder => {
          builder.where('chat_messages.channel_type', channelType);
          if (channelId) {
            builder.andWhere('chat_messages.channel_id', channelId);
          } else {
            builder.andWhere(function(innerBuilder) {
              innerBuilder.whereNull('chat_messages.channel_id');
            });
          }
        })
        .andWhere('chat_messages.sender_id', '!=', userId)
        .andWhere(builder => {
          builder.whereNull('chat_messages.is_deleted').orWhere('chat_messages.is_deleted', false);
        })
        .whereNull('chat_unread_messages.id')
        .orderBy('chat_messages.created_at', 'desc')
        .limit(limit)
        .offset(offset);

      const hydratedMessages = await this.hydrateMessages(messages);
      return hydratedMessages.reverse();
    } catch (error) {
      console.error('获取未读消息失败:', error);
      throw error;
    }
  }

  // 获取未读消息数量 - 优化版本
  static async getUnreadCount(userId, channelType, channelId) {
    try {
      const result = await db('chat_messages')
        .leftJoin('chat_unread_messages', function() {
          this.on('chat_messages.id', '=', 'chat_unread_messages.message_id')
            .andOn('chat_unread_messages.user_id', '=', db.raw('?', [userId]));
        })
        .where(builder => {
          builder.where('chat_messages.channel_type', channelType);
          if (channelId) {
            builder.andWhere('chat_messages.channel_id', channelId);
          } else {
            builder.andWhere(function(innerBuilder) {
              innerBuilder.whereNull('chat_messages.channel_id');
            });
          }
        })
        .andWhere('chat_messages.sender_id', '!=', userId)
        .andWhere(builder => {
          builder.whereNull('chat_messages.is_deleted').orWhere('chat_messages.is_deleted', false);
        })
        .whereNull('chat_unread_messages.id')
        .count('chat_messages.id as count')
        .first();

      return parseInt(result.count) || 0;
    } catch (error) {
      console.error('获取未读消息数量失败:', error);
      return 0;
    }
  }

  // 标记消息为已读 - 优化版本
  static async markMessagesAsRead(userId, messages) {
    try {
      if (!messages || messages.length === 0) return;

      // 批量插入已读记录
      const unreadRecords = messages.map(message => ({
        user_id: userId,
        message_id: message.message_id || message.id,
        channel_type: message.channel_type,
        channel_id: message.channel_id,
        read_at: new Date()
      }));

      await db('chat_unread_messages')
        .insert(unreadRecords)
        .onConflict(['user_id', 'message_id'])
        .ignore();

      console.log(`标记消息为已读成功: 用户${userId}, 消息数量${messages.length}`);
    } catch (error) {
      console.error('标记消息为已读失败:', error);
      throw error;
    }
  }

  // 标记频道为已读 - 优化版本
  static async markChannelAsRead(userId, channelType, channelId) {
    try {
      // 获取该频道的所有未读消息ID
      const unreadMessages = await db('chat_messages')
        .select('chat_messages.id', 'chat_messages.channel_type', 'chat_messages.channel_id')
        .where('channel_type', channelType)
        .andWhere(builder => {
          if (channelId) {
            builder.where('channel_id', channelId);
          } else {
            builder.whereNull('channel_id');
          }
        })
        .andWhere('sender_id', '!=', userId)
        .andWhere(builder => {
          builder.whereNull('is_deleted').orWhere('is_deleted', false);
        })
        .leftJoin('chat_unread_messages', function() {
          this.on('chat_messages.id', '=', 'chat_unread_messages.message_id')
            .andOn('chat_unread_messages.user_id', '=', db.raw('?', [userId]));
        })
        .whereNull('chat_unread_messages.id');

      if (unreadMessages.length > 0) {
        await this.markMessagesAsRead(userId, unreadMessages);
      }

      console.log(`标记频道为已读成功: 用户${userId}, 频道${channelType}:${channelId}`);
    } catch (error) {
      console.error('标记频道为已读失败:', error);
      throw error;
    }
  }

  // 删除消息 - 优化版本
  static async delete(messageId) {
    try {
      // 软删除：标记为已删除
      await db('chat_messages')
        .where('id', messageId)
        .update({
          is_deleted: true,
          deleted_at: new Date()
        });

      console.log(`消息删除成功: ${messageId}`);
      return true;
    } catch (error) {
      console.error('消息删除失败:', error);
      throw error;
    }
  }

  // 获取频道统计信息 - 优化版本
  static async getChannelStats(channelType, channelId) {
    try {
      const stats = await db('chat_messages')
        .select(
          db.raw('COUNT(*) as total_messages'),
          db.raw('COUNT(DISTINCT sender_id) as unique_senders'),
          db.raw('MAX(created_at) as last_message_time')
        )
        .where({
          'channel_type': channelType,
          'channel_id': channelId
        })
        .first();

      return {
        total_messages: parseInt(stats.total_messages) || 0,
        unique_senders: parseInt(stats.unique_senders) || 0,
        last_message_time: stats.last_message_time
      };
    } catch (error) {
      console.error('获取频道统计失败:', error);
      return {
        total_messages: 0,
        unique_senders: 0,
        last_message_time: null
      };
    }
  }

  // 搜索消息 - 优化版本
  static async searchMessages(channelType, channelId, query, limit = 20, offset = 0) {
    try {
      let dbQuery = db('chat_messages')
        .select('chat_messages.*')
        .where(function() {
          this.where('chat_messages.content', 'ilike', `%${query}%`);
        });
      
      // 根据频道类型过滤
      if (channelType === 'global') {
        dbQuery = dbQuery.where('chat_messages.channel_type', 'global');
      } else if (channelType === 'alliance') {
        dbQuery = dbQuery.where('chat_messages.channel_type', 'alliance')
          .where('chat_messages.channel_id', channelId);
      } else if (channelType === 'private') {
        dbQuery = dbQuery.where('chat_messages.channel_type', 'private')
          .where('chat_messages.channel_id', channelId);
      }
      
      const messages = await dbQuery
        .orderBy('chat_messages.created_at', 'desc')
        .limit(limit)
        .offset(offset);

      // 批量获取用户信息
      const userIds = [...new Set(messages.map(m => m.sender_id))];
      const userInfos = await this.getUsersBatch(userIds);
      
      // 合并消息和用户信息
      const messagesWithUserInfo = messages.map(message => ({
        ...message,
        sender_name: userInfos[message.sender_id]?.username || 'Unknown',
        sender_avatar: userInfos[message.sender_id]?.avatar_url || null
      }));
      
      return messagesWithUserInfo;
    } catch (error) {
      console.error('搜索消息失败:', error);
      throw error;
    }
  }

  // 创建未读消息记录 - 优化版本
  static async createUnreadRecords(messageId, channelType, channelId, senderId) {
    try {
      // 获取需要创建未读记录的用户列表
      let userIds = [];
      
      if (channelType === 'global') {
        // 全局消息：所有用户（除了发送者）
        const users = await db('users').select('id').where('id', '!=', senderId);
        userIds = users.map(u => u.id);
      } else if (channelType === 'alliance') {
        // 联盟消息：联盟成员（除了发送者）
        const members = await db('alliance_members')
          .select('user_id')
          .where('alliance_id', channelId)
          .where('user_id', '!=', senderId);
        userIds = members.map(m => m.user_id);
      } else if (channelType === 'private') {
        // 私聊消息：接收者
        userIds = [channelId];
      }

      if (userIds.length === 0) return;

      // 批量插入未读记录
      const unreadRecords = userIds.map(userId => ({
        message_id: messageId,
        user_id: userId,
        channel_type: channelType,
        channel_id: channelId
      }));

      await db('chat_unread_messages')
        .insert(unreadRecords)
        .onConflict(['message_id', 'user_id'])
        .ignore();

      console.log(`创建未读消息记录成功: 消息${messageId}, 用户数量${userIds.length}`);
    } catch (error) {
      console.error('创建未读消息记录失败:', error);
      throw error;
    }
  }
}

module.exports = ChatMessage;
