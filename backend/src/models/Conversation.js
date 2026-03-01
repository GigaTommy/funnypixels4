const { db } = require('../config/database');
const crypto = require('crypto');

class Conversation {
  // 创建或获取私信会话
  static async createOrGetPrivateConversation(userId1, userId2) {
    try {
      // 确保用户ID顺序一致（小的在前）
      const minUserId = userId1 < userId2 ? userId1 : userId2;
      const maxUserId = userId1 < userId2 ? userId2 : userId1;

      // 生成私信会话的唯一键
      const key = crypto
        .createHash('md5')
        .update(`${minUserId}-${maxUserId}`)
        .digest('hex');

      // 尝试查找现有会话
      let conversation = await db('conversations')
        .where({ type: 'private', key })
        .first();

      // 如果不存在，创建新会话
      if (!conversation) {
        [conversation] = await db('conversations')
          .insert({
            type: 'private',
            key,
            alliance_id: null
          })
          .returning('*');

        // 添加会话成员
        await db('conversation_members')
          .insert([
            {
              conversation_id: conversation.id,
              user_id: userId1,
              last_read_message_id: null,
              muted: false
            },
            {
              conversation_id: conversation.id,
              user_id: userId2,
              last_read_message_id: null,
              muted: false
            }
          ]);
      }

      return conversation;
    } catch (error) {
      console.error('创建或获取私信会话失败:', error);
      throw error;
    }
  }

  // 创建或获取联盟会话
  static async createOrGetAllianceConversation(allianceId) {
    try {
      const key = `alliance:${allianceId}`;

      // 尝试查找现有会话
      let conversation = await db('conversations')
        .where({ type: 'alliance', key, alliance_id: allianceId })
        .first();

      // 如果不存在，创建新会话
      if (!conversation) {
        [conversation] = await db('conversations')
          .insert({
            type: 'alliance',
            key,
            alliance_id: allianceId
          })
          .returning('*');

        // 获取联盟所有成员并添加到会话中
        const allianceMembers = await db('alliance_members')
          .select('user_id')
          .where('alliance_id', allianceId);

        if (allianceMembers.length > 0) {
          const memberInserts = allianceMembers.map(member => ({
            conversation_id: conversation.id,
            user_id: member.user_id,
            last_read_message_id: null,
            muted: false
          }));

          await db('conversation_members').insert(memberInserts);
        }
      }

      return conversation;
    } catch (error) {
      console.error('创建或获取联盟会话失败:', error);
      throw error;
    }
  }

  // 获取全局会话
  static async getGlobalConversation() {
    try {
      let conversation = await db('conversations')
        .where({ type: 'global', key: 'global' })
        .first();

      // 如果不存在，创建全局会话
      if (!conversation) {
        [conversation] = await db('conversations')
          .insert({
            type: 'global',
            key: 'global',
            alliance_id: null
          })
          .returning('*');
      }

      return conversation;
    } catch (error) {
      console.error('获取全局会话失败:', error);
      throw error;
    }
  }

  // 获取用户的会话列表
  static async getUserConversations(userId, limit = 20, offset = 0) {
    try {
      console.log(`获取用户会话列表: userId=${userId}, limit=${limit}, offset=${offset}`);

      const conversations = await db('conversations')
        .select('conversations.*')
        .leftJoin('conversation_members', 'conversations.id', 'conversation_members.conversation_id')
        .where('conversation_members.user_id', userId)
        .orderBy('conversations.created_at', 'desc')
        .limit(limit)
        .offset(offset);

      console.log(`找到 ${conversations.length} 个会话`);

      // 为每个会话获取额外信息
      const conversationsWithInfo = [];
      for (const conv of conversations) {
        try {
          const info = await this.getConversationInfo(conv.id, userId);
          conversationsWithInfo.push({ ...conv, ...info });
        } catch (infoError) {
          console.error(`获取会话 ${conv.id} 信息失败:`, infoError);
          // 添加基本会话信息，不中断整个流程
          conversationsWithInfo.push({
            ...conv,
            title: `${conv.type}聊天室`,
            avatar: null,
            unread_count: 0,
            last_message: null
          });
        }
      }

      console.log(`返回 ${conversationsWithInfo.length} 个会话（含详细信息）`);
      return conversationsWithInfo;
    } catch (error) {
      console.error('获取用户会话列表失败:', error);
      // 返回空数组而不是抛出错误，防止前端崩溃
      return [];
    }
  }

  // 获取会话详细信息
  static async getConversationInfo(conversationId, userId) {
    try {
      const conversation = await db('conversations')
        .where('id', conversationId)
        .first();

      if (!conversation) {
        throw new Error('会话不存在');
      }

      let info = {
        id: conversation.id,
        type: conversation.type,
        key: conversation.key,
        created_at: conversation.created_at
      };

      // 根据会话类型获取不同信息
      try {
        if (conversation.type === 'private') {
          // 获取对方用户信息
          const otherMember = await db('conversation_members')
            .select('users.id', 'users.username', 'users.avatar_url', 'users.display_name')
            .leftJoin('users', 'conversation_members.user_id', 'users.id')
            .where('conversation_members.conversation_id', conversationId)
            .where('conversation_members.user_id', '!=', userId)
            .first();

          info.title = otherMember ? (otherMember.display_name || otherMember.username) : '未知用户';
          info.avatar = otherMember ? otherMember.avatar_url : null;
          info.other_user = otherMember;
        } else if (conversation.type === 'alliance') {
          // 获取联盟信息
          const alliance = await db('alliances')
            .select('name', 'color', 'flag_unicode_char')
            .where('id', conversation.alliance_id)
            .first();

          info.title = alliance ? alliance.name : '联盟聊天室';
          info.avatar = null; // 联盟目前没有banner_url字段
          info.alliance = alliance;
        } else if (conversation.type === 'global') {
          info.title = '全局聊天室';
          info.avatar = null;
        }
      } catch (typeError) {
        console.error('获取会话类型信息失败:', typeError);
        // 设置默认值以防止整个请求失败
        info.title = `${conversation.type}聊天室`;
        info.avatar = null;
      }

      // 获取未读消息数量
      try {
        info.unread_count = await this.getUnreadCount(conversationId, userId);
      } catch (unreadError) {
        console.error('获取未读消息数量失败:', unreadError);
        info.unread_count = 0;
      }

      // 获取最后一条消息
      try {
        const lastMessage = await db('chat_messages')
          .where('conversation_id', conversationId)
          .orderBy('created_at', 'desc')
          .first();

        if (lastMessage) {
          const sender = await db('users')
            .select('username', 'display_name')
            .where('id', lastMessage.sender_id)
            .first();

          info.last_message = {
            content: lastMessage.content,
            sender_name: sender ? (sender.display_name || sender.username) : '未知用户',
            created_at: lastMessage.created_at,
            message_type: lastMessage.message_type
          };
        } else {
          info.last_message = null;
        }
      } catch (messageError) {
        console.error('获取最后一条消息失败:', messageError);
        info.last_message = null;
      }

      return info;
    } catch (error) {
      console.error('获取会话信息失败:', error);
      // 返回基本信息而不是抛出错误，防止整个API调用失败
      return {
        id: conversationId,
        type: 'unknown',
        key: '',
        title: '会话信息加载失败',
        avatar: null,
        unread_count: 0,
        last_message: null,
        created_at: new Date().toISOString()
      };
    }
  }

  // 获取会话未读消息数量
  static async getUnreadCount(conversationId, userId) {
    try {
      // 获取用户在该会话中的最后已读消息ID
      const member = await db('conversation_members')
        .select('last_read_message_id')
        .where({
          conversation_id: conversationId,
          user_id: userId
        })
        .first();

      if (!member) {
        return 0;
      }

      // 统计未读消息数量
      let query = db('chat_messages')
        .where('conversation_id', conversationId)
        .where('sender_id', '!=', userId); // 不统计自己发送的消息

      if (member.last_read_message_id) {
        query = query.where('id', '>', member.last_read_message_id);
      }

      const result = await query.count('id as count').first();
      return parseInt(result.count) || 0;
    } catch (error) {
      console.error('获取未读消息数量失败:', error);
      return 0;
    }
  }

  // 标记会话为已读
  static async markAsRead(conversationId, userId, messageId) {
    try {
      await db('conversation_members')
        .where({
          conversation_id: conversationId,
          user_id: userId
        })
        .update({
          last_read_message_id: messageId,
          last_activity: db.fn.now()
        });

      return true;
    } catch (error) {
      console.error('标记会话为已读失败:', error);
      throw error;
    }
  }

  // 添加用户到会话（用于联盟新成员）
  static async addUserToConversation(conversationId, userId) {
    try {
      await db('conversation_members')
        .insert({
          conversation_id: conversationId,
          user_id: userId,
          last_read_message_id: null,
          muted: false
        })
        .onConflict(['conversation_id', 'user_id'])
        .ignore();

      return true;
    } catch (error) {
      console.error('添加用户到会话失败:', error);
      throw error;
    }
  }

  // 从会话中移除用户
  static async removeUserFromConversation(conversationId, userId) {
    try {
      await db('conversation_members')
        .where({
          conversation_id: conversationId,
          user_id: userId
        })
        .del();

      return true;
    } catch (error) {
      console.error('从会话中移除用户失败:', error);
      throw error;
    }
  }

  // 设置会话静音状态
  static async setMuteStatus(conversationId, userId, muted) {
    try {
      await db('conversation_members')
        .where({
          conversation_id: conversationId,
          user_id: userId
        })
        .update({ muted });

      return true;
    } catch (error) {
      console.error('设置会话静音状态失败:', error);
      throw error;
    }
  }

  // 检查用户是否为会话成员
  static async isConversationMember(conversationId, userId) {
    try {
      const member = await db('conversation_members')
        .where({
          conversation_id: conversationId,
          user_id: userId
        })
        .first();

      return !!member;
    } catch (error) {
      console.error('检查会话成员失败:', error);
      return false;
    }
  }

  // 根据旧的channelType和channelId获取或创建会话
  static async getConversationByLegacyChannel(channelType, channelId, currentUserId = null) {
    try {
      let conversation;

      switch (channelType) {
        case 'global':
          conversation = await this.getGlobalConversation();
          break;

        case 'alliance':
          if (!channelId) {
            throw new Error('联盟聊天需要指定联盟ID');
          }
          conversation = await this.createOrGetAllianceConversation(channelId);
          break;

        case 'private':
          if (!channelId || !currentUserId) {
            throw new Error('私信聊天需要指定对方用户ID和当前用户ID');
          }
          conversation = await this.createOrGetPrivateConversation(currentUserId, channelId);
          break;

        default:
          throw new Error(`不支持的频道类型: ${channelType}`);
      }

      return conversation;
    } catch (error) {
      console.error('根据旧频道信息获取会话失败:', error);
      throw error;
    }
  }
}

module.exports = Conversation;