const PrivateMessage = require('../models/PrivateMessage');
const Achievement = require('../models/Achievement');
const User = require('../models/User');
const ConversationPin = require('../models/ConversationPin');
const NotificationSettings = require('../models/NotificationSettings');
const PrivacySettings = require('../models/PrivacySettings');
const MessageRequest = require('../models/MessageRequest');
const DailyLimits = require('../models/DailyLimits');
const { normalizeUserForDisplay, isUserDeleted } = require('../utils/userDisplayHelper');

class PrivateMessageController {
  // 发送私信
  static async sendMessage(req, res) {
    try {
      const { receiver_id, content, message_type, reply_to_message_id } = req.body;
      const sender_id = req.user.id;

      // 验证输入
      if (!receiver_id || !content) {
        return res.status(400).json({
          success: false,
          message: '接收者和消息内容不能为空'
        });
      }

      // 验证接收者存在且未被删除
      const receiver = await User.findById(receiver_id);
      if (!receiver || isUserDeleted(receiver)) {
        return res.status(404).json({
          success: false,
          message: '接收者不存在或已删除账户'
        });
      }

      // 不能给自己发消息
      if (sender_id === receiver_id) {
        return res.status(400).json({
          success: false,
          message: '不能给自己发送私信'
        });
      }

      // 检查隐私设置和发送权限
      const permission = await PrivacySettings.canSendMessage(sender_id, receiver_id);

      if (!permission.canSend) {
        if (permission.requiresRequest) {
          // 需要发送消息请求
          return res.status(403).json({
            success: false,
            message: permission.reason,
            requiresRequest: true,
            code: 'REQUIRES_MESSAGE_REQUEST'
          });
        } else {
          // 完全禁止发送
          return res.status(403).json({
            success: false,
            message: permission.reason,
            requiresRequest: false,
            code: 'MESSAGE_BLOCKED'
          });
        }
      }

      // 检查每日限制（对陌生用户）
      const dailyLimitCheck = await DailyLimits.canSendMessage(sender_id, receiver_id, message_type);

      if (!dailyLimitCheck.canSend && dailyLimitCheck.isStranger) {
        return res.status(429).json({
          success: false,
          message: dailyLimitCheck.reason,
          code: 'DAILY_LIMIT_EXCEEDED',
          limitType: dailyLimitCheck.limitType
        });
      }

      // 检查是否是新对话
      const existingConversation = await PrivateMessage.getConversation(sender_id, receiver_id, 1, 0);
      const isNewConversation = existingConversation.length === 0;

      if (isNewConversation && dailyLimitCheck.isStranger) {
        const newConversationCheck = await DailyLimits.canStartNewConversation(sender_id, receiver_id);
        if (!newConversationCheck.canStart) {
          return res.status(429).json({
            success: false,
            message: newConversationCheck.reason,
            code: 'NEW_CONVERSATION_LIMIT_EXCEEDED'
          });
        }
      }

      // 验证回复消息（如果有）
      if (reply_to_message_id) {
        const replyMessage = await PrivateMessage.findById(reply_to_message_id);
        if (!replyMessage ||
          (replyMessage.sender_id !== sender_id && replyMessage.receiver_id !== sender_id) ||
          (replyMessage.sender_id !== receiver_id && replyMessage.receiver_id !== receiver_id)) {
          return res.status(400).json({
            success: false,
            message: '无效的回复消息'
          });
        }
      }

      // 创建私信
      const message = await PrivateMessage.create({
        sender_id,
        receiver_id,
        content: content.trim(),
        message_type: message_type || 'text',
        reply_to_message_id: reply_to_message_id || null
      });

      // 获取完整的消息信息
      const fullMessage = await PrivateMessage.findById(message.id);

      // 记录每日限制（如果是陌生用户）
      if (dailyLimitCheck.isStranger) {
        await DailyLimits.recordMessage(sender_id, message_type);

        // 如果是新对话，记录新对话
        if (isNewConversation) {
          await DailyLimits.recordNewConversation(sender_id);
        }
      }

      // 触发成就：发送私信
      await Achievement.updateUserStats(sender_id, {
        pm_sent_count: 1,
        total_messages_count: 1
      });

      res.status(201).json({
        success: true,
        message: '私信发送成功',
        data: {
          id: fullMessage.id,
          sender_id: fullMessage.sender_id,
          receiver_id: fullMessage.receiver_id,
          content: fullMessage.content,
          message_type: fullMessage.message_type,
          is_read: fullMessage.is_read,
          reply_to_message_id: fullMessage.reply_to_message_id,
          reply_to_content: fullMessage.reply_to_content,
          created_at: fullMessage.created_at,
          sender: {
            username: fullMessage.sender_username,
            avatar_url: fullMessage.sender_avatar
          },
          receiver: {
            username: fullMessage.receiver_username,
            avatar_url: fullMessage.receiver_avatar
          }
        }
      });

    } catch (error) {
      console.error('发送私信失败:', error);
      res.status(500).json({
        success: false,
        message: '发送私信失败',
        error: error.message
      });
    }
  }

  // 获取对话列表
  static async getConversationList(req, res) {
    try {
      const userId = req.user.id;
      const { limit = 20, offset = 0 } = req.query;

      const conversations = await PrivateMessage.getConversationList(
        userId,
        parseInt(limit),
        parseInt(offset)
      );

      // 获取每个对话的未读消息数量和置顶状态
      const conversationsWithUnread = await Promise.all(
        conversations.map(async (conv) => {
          const unreadCount = await PrivateMessage.getUnreadCountWithUser(
            userId,
            conv.other_user_id
          );

          const isPinned = await ConversationPin.isConversationPinned(
            userId,
            'private',
            conv.other_user_id
          );

          const muteStatus = await NotificationSettings.isConversationMuted(
            userId,
            'private',
            conv.other_user_id
          );

          // Normalize other user info for deleted accounts
          const otherUser = normalizeUserForDisplay({
            id: conv.other_user_id,
            username: conv.other_user_name,
            avatar_url: conv.other_user_avatar
          });

          return {
            other_user_id: otherUser.id,
            other_user_name: otherUser.display_name,
            other_user_avatar: otherUser.avatar_url,
            is_deleted: otherUser.is_deleted,
            last_message: {
              id: conv.id,
              content: conv.content,
              message_type: conv.message_type,
              created_at: conv.created_at,
              is_from_me: conv.sender_id === userId
            },
            unread_count: unreadCount,
            is_pinned: isPinned,
            is_muted: muteStatus.isMuted,
            mute_type: muteStatus.muteType,
            mute_until: muteStatus.muteUntil
          };
        })
      );

      // 按置顶状态和时间排序
      conversationsWithUnread.sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        return new Date(b.last_message.created_at).getTime() - new Date(a.last_message.created_at).getTime();
      });

      res.json({
        success: true,
        conversations: conversationsWithUnread,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: conversationsWithUnread.length
        }
      });

    } catch (error) {
      console.error('获取对话列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取对话列表失败',
        error: error.message
      });
    }
  }

  // 获取与特定用户的对话
  static async getConversation(req, res) {
    try {
      const userId = req.user.id;
      const { other_user_id } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      // 验证对方用户存在
      const otherUser = await User.findById(other_user_id);
      if (!otherUser) {
        return res.status(404).json({
          success: false,
          message: '用户不存在'
        });
      }

      // Normalize other user for display (handle deleted accounts)
      const normalizedOtherUser = normalizeUserForDisplay(otherUser);

      // 获取对话消息
      const messages = await PrivateMessage.getConversation(
        userId,
        other_user_id,
        parseInt(limit),
        parseInt(offset)
      );

      // 格式化消息 - normalize sender/receiver info
      const formattedMessages = messages.map(msg => {
        const sender = normalizeUserForDisplay({
          id: msg.sender_id,
          username: msg.sender_username,
          avatar_url: msg.sender_avatar
        });
        const receiver = normalizeUserForDisplay({
          id: msg.receiver_id,
          username: msg.receiver_username,
          avatar_url: msg.receiver_avatar
        });

        return {
          id: msg.id,
          sender_id: msg.sender_id,
          receiver_id: msg.receiver_id,
          content: msg.content,
          message_type: msg.message_type,
          is_read: msg.is_read,
          read_at: msg.read_at,
          reply_to_message_id: msg.reply_to_message_id,
          reply_to_content: msg.reply_to_content,
          created_at: msg.created_at,
          is_from_me: msg.sender_id === userId,
          sender: {
            username: sender.display_name,
            avatar_url: sender.avatar_url,
            is_deleted: sender.is_deleted
          },
          receiver: {
            username: receiver.display_name,
            avatar_url: receiver.avatar_url,
            is_deleted: receiver.is_deleted
          }
        };
      });

      res.json({
        success: true,
        messages: formattedMessages,
        other_user: {
          id: normalizedOtherUser.id,
          username: normalizedOtherUser.display_name,
          avatar_url: normalizedOtherUser.avatar_url,
          is_deleted: normalizedOtherUser.is_deleted,
          clickable: normalizedOtherUser.clickable
        },
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: messages.length
        }
      });

    } catch (error) {
      console.error('获取对话失败:', error);
      res.status(500).json({
        success: false,
        message: '获取对话失败',
        error: error.message
      });
    }
  }

  // 标记消息为已读
  static async markAsRead(req, res) {
    try {
      const userId = req.user.id;
      const { message_id } = req.params;

      const success = await PrivateMessage.markAsRead(message_id, userId);

      if (success) {
        res.json({
          success: true,
          message: '消息已标记为已读'
        });
      } else {
        res.status(404).json({
          success: false,
          message: '消息不存在或已读'
        });
      }

    } catch (error) {
      console.error('标记消息已读失败:', error);
      res.status(500).json({
        success: false,
        message: '标记消息已读失败',
        error: error.message
      });
    }
  }

  // 标记对话为已读
  static async markConversationAsRead(req, res) {
    try {
      const userId = req.user.id;
      const { other_user_id } = req.params;

      const updatedCount = await PrivateMessage.markConversationAsRead(userId, other_user_id);

      res.json({
        success: true,
        message: `已标记${updatedCount}条消息为已读`
      });

    } catch (error) {
      console.error('标记对话已读失败:', error);
      res.status(500).json({
        success: false,
        message: '标记对话已读失败',
        error: error.message
      });
    }
  }

  // 删除消息
  static async deleteMessage(req, res) {
    try {
      const userId = req.user.id;
      const { message_id } = req.params;

      const message = await PrivateMessage.findById(message_id);
      if (!message) {
        return res.status(404).json({
          success: false,
          message: '消息不存在'
        });
      }

      // 验证用户权限
      if (message.sender_id !== userId && message.receiver_id !== userId) {
        return res.status(403).json({
          success: false,
          message: '无权删除此消息'
        });
      }

      const success = await message.delete(userId);

      if (success) {
        res.json({
          success: true,
          message: '消息删除成功'
        });
      } else {
        res.status(400).json({
          success: false,
          message: '删除消息失败'
        });
      }

    } catch (error) {
      console.error('删除消息失败:', error);
      res.status(500).json({
        success: false,
        message: '删除消息失败',
        error: error.message
      });
    }
  }

  // 编辑消息
  static async editMessage(req, res) {
    try {
      const userId = req.user.id;
      const { message_id } = req.params;
      const { content } = req.body;

      // 验证输入
      if (!content || !content.trim()) {
        return res.status(400).json({
          success: false,
          message: '消息内容不能为空'
        });
      }

      // 获取原消息
      const message = await PrivateMessage.findById(message_id);
      if (!message) {
        return res.status(404).json({
          success: false,
          message: '消息不存在'
        });
      }

      // 编辑消息
      const editedMessage = await message.editContent(content.trim(), userId);

      if (editedMessage) {
        // 重新获取完整消息信息
        const fullMessage = await PrivateMessage.findById(message_id);

        res.json({
          success: true,
          message: '消息编辑成功',
          data: {
            id: fullMessage.id,
            content: fullMessage.content,
            is_edited: fullMessage.is_edited,
            edit_count: fullMessage.edit_count,
            updated_at: fullMessage.updated_at,
            sender: {
              username: fullMessage.sender_username,
              avatar_url: fullMessage.sender_avatar
            }
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: '编辑消息失败'
        });
      }

    } catch (error) {
      console.error('编辑消息失败:', error);
      res.status(500).json({
        success: false,
        message: error.message || '编辑消息失败',
        error: error.message
      });
    }
  }

  // 获取消息编辑历史
  static async getMessageEditHistory(req, res) {
    try {
      const userId = req.user.id;
      const { message_id } = req.params;

      const message = await PrivateMessage.findById(message_id);
      if (!message) {
        return res.status(404).json({
          success: false,
          message: '消息不存在'
        });
      }

      // 验证用户权限（发送者和接收者都可以查看编辑历史）
      if (message.sender_id !== userId && message.receiver_id !== userId) {
        return res.status(403).json({
          success: false,
          message: '无权查看此消息的编辑历史'
        });
      }

      res.json({
        success: true,
        data: {
          current_content: message.content,
          edit_count: message.edit_count,
          is_edited: message.is_edited,
          edit_history: message.edit_history || []
        }
      });

    } catch (error) {
      console.error('获取编辑历史失败:', error);
      res.status(500).json({
        success: false,
        message: '获取编辑历史失败',
        error: error.message
      });
    }
  }

  // 置顶对话
  static async pinConversation(req, res) {
    try {
      const userId = req.user.id;
      const { other_user_id } = req.params;

      // 验证对方用户存在
      const otherUser = await User.findById(other_user_id);
      if (!otherUser) {
        return res.status(404).json({
          success: false,
          message: '用户不存在'
        });
      }

      await ConversationPin.pinConversation(userId, 'private', other_user_id);

      res.json({
        success: true,
        message: '对话置顶成功'
      });

    } catch (error) {
      console.error('置顶对话失败:', error);
      res.status(500).json({
        success: false,
        message: error.message || '置顶对话失败',
        error: error.message
      });
    }
  }

  // 取消置顶对话
  static async unpinConversation(req, res) {
    try {
      const userId = req.user.id;
      const { other_user_id } = req.params;

      const success = await ConversationPin.unpinConversation(userId, 'private', other_user_id);

      if (success) {
        res.json({
          success: true,
          message: '取消置顶成功'
        });
      } else {
        res.status(404).json({
          success: false,
          message: '对话未置顶或不存在'
        });
      }

    } catch (error) {
      console.error('取消置顶失败:', error);
      res.status(500).json({
        success: false,
        message: '取消置顶失败',
        error: error.message
      });
    }
  }

  // 获取置顶对话列表
  static async getPinnedConversations(req, res) {
    try {
      const userId = req.user.id;

      const pinnedConversations = await ConversationPin.getUserPinnedConversations(userId);
      const pinnedCount = await ConversationPin.getPinnedCount(userId);

      res.json({
        success: true,
        data: {
          pinned_conversations: pinnedConversations,
          pinned_count: pinnedCount,
          max_pins: 6
        }
      });

    } catch (error) {
      console.error('获取置顶对话失败:', error);
      res.status(500).json({
        success: false,
        message: '获取置顶对话失败',
        error: error.message
      });
    }
  }

  // 静音对话
  static async muteConversation(req, res) {
    try {
      const userId = req.user.id;
      const { other_user_id } = req.params;
      const { mute_type } = req.body;

      // 验证静音类型
      const validMuteTypes = ['1h', '8h', '1w', 'forever'];
      if (!validMuteTypes.includes(mute_type)) {
        return res.status(400).json({
          success: false,
          message: '无效的静音类型'
        });
      }

      // 验证对方用户存在
      const otherUser = await User.findById(other_user_id);
      if (!otherUser) {
        return res.status(404).json({
          success: false,
          message: '用户不存在'
        });
      }

      const setting = await NotificationSettings.muteConversation(
        userId,
        'private',
        other_user_id,
        mute_type
      );

      res.json({
        success: true,
        message: '对话静音成功',
        data: {
          mute_type: setting.mute_type,
          mute_until: setting.mute_until
        }
      });

    } catch (error) {
      console.error('静音对话失败:', error);
      res.status(500).json({
        success: false,
        message: error.message || '静音对话失败',
        error: error.message
      });
    }
  }

  // 取消静音对话
  static async unmuteConversation(req, res) {
    try {
      const userId = req.user.id;
      const { other_user_id } = req.params;

      const success = await NotificationSettings.unmuteConversation(
        userId,
        'private',
        other_user_id
      );

      if (success) {
        res.json({
          success: true,
          message: '取消静音成功'
        });
      } else {
        res.status(404).json({
          success: false,
          message: '对话未静音或不存在'
        });
      }

    } catch (error) {
      console.error('取消静音失败:', error);
      res.status(500).json({
        success: false,
        message: '取消静音失败',
        error: error.message
      });
    }
  }

  // 获取静音对话列表
  static async getMutedConversations(req, res) {
    try {
      const userId = req.user.id;

      const mutedConversations = await NotificationSettings.getUserMutedConversations(userId);

      res.json({
        success: true,
        data: {
          muted_conversations: mutedConversations,
          mute_options: [
            { value: '1h', label: '1小时' },
            { value: '8h', label: '8小时' },
            { value: '1w', label: '1周' },
            { value: 'forever', label: '永久' }
          ]
        }
      });

    } catch (error) {
      console.error('获取静音对话失败:', error);
      res.status(500).json({
        success: false,
        message: '获取静音对话失败',
        error: error.message
      });
    }
  }

  // 获取用户的每日限制状态
  static async getDailyLimitStatus(req, res) {
    try {
      const userId = req.user.id;

      const limitStatus = await DailyLimits.getUserLimitStatus(userId);

      res.json({
        success: true,
        data: limitStatus
      });

    } catch (error) {
      console.error('获取每日限制状态失败:', error);
      res.status(500).json({
        success: false,
        message: '获取每日限制状态失败',
        error: error.message
      });
    }
  }

  // 获取未读消息数量
  static async getUnreadCount(req, res) {
    try {
      const userId = req.user.id;

      const unreadCount = await PrivateMessage.getUnreadCount(userId);

      res.json({
        success: true,
        unread_count: unreadCount
      });

    } catch (error) {
      console.error('获取未读消息数量失败:', error);
      res.status(500).json({
        success: false,
        message: '获取未读消息数量失败',
        error: error.message
      });
    }
  }
}

module.exports = PrivateMessageController;
