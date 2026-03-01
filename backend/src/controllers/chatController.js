const ChatMessage = require('../models/ChatMessage');
const Achievement = require('../models/Achievement');
const CacheService = require('../services/cacheService');
const Conversation = require('../models/Conversation');
const privateMessageLimiter = require('../services/privateMessageLimiter');
const { db } = require('../config/database');
const { getSocketManager, hasSocketManager } = require('../services/socketManagerInstance');

const MESSAGE_TYPES = new Set(['text', 'emoji', 'image', 'location']);
const MAX_TEXT_LENGTH = 2000;
const MAX_EMOJI_LENGTH = 2048;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const cleanObject = obj => Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined && value !== null && !(typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0)));

const sanitizeMetadata = (messageType, metadata = {}) => {
  if (!metadata || typeof metadata !== 'object') {
    return {};
  }

  const base = {};
  if (metadata.replyToMessageId && (typeof metadata.replyToMessageId === 'string' || typeof metadata.replyToMessageId === 'number')) {
    base.replyToMessageId = metadata.replyToMessageId;
  }

  if (Array.isArray(metadata.mentions)) {
    base.mentions = metadata.mentions
      .filter(id => typeof id === 'string')
      .slice(0, 20);
  }

  switch (messageType) {
    case 'image': {
      const imageUrl = typeof metadata.image_url === 'string' ? metadata.image_url : undefined;
      if (!imageUrl) {
        throw new Error('图片消息需要提供image_url');
      }

      const imageMeta = {
        image_url: imageUrl,
        thumbnail_url: typeof metadata.thumbnail_url === 'string' ? metadata.thumbnail_url : undefined,
        width: Number.isFinite(Number(metadata.width)) ? Number(metadata.width) : undefined,
        height: Number.isFinite(Number(metadata.height)) ? Number(metadata.height) : undefined,
        size: Number.isFinite(Number(metadata.size)) ? Number(metadata.size) : undefined,
        alt: typeof metadata.alt === 'string' ? metadata.alt.slice(0, 180) : undefined
      };

      return cleanObject({ ...base, ...imageMeta });
    }

    case 'location': {
      const lat = Number(metadata.lat);
      const lng = Number(metadata.lng);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error('位置消息需要提供有效的经纬度');
      }

      const sanitizePixel = (pixel = {}) => {
        if (!pixel || typeof pixel !== 'object') {
          return undefined;
        }

        const pixelLat = Number(pixel.lat);
        const pixelLng = Number(pixel.lng);

        const pixelInfo = {
          id: typeof pixel.id === 'string' ? pixel.id : undefined,
          gridId: typeof pixel.gridId === 'string' ? pixel.gridId : undefined,
          color: typeof pixel.color === 'string' ? pixel.color : undefined,
          lat: Number.isFinite(pixelLat) ? pixelLat : undefined,
          lng: Number.isFinite(pixelLng) ? pixelLng : undefined
        };

        return cleanObject(pixelInfo);
      };

      const locationMeta = {
        lat,
        lng,
        zoom: Number.isFinite(Number(metadata.zoom)) ? Number(metadata.zoom) : undefined,
        addressSnippet: typeof metadata.addressSnippet === 'string' ? metadata.addressSnippet.slice(0, 120) : undefined,
        label: typeof metadata.label === 'string' ? metadata.label.slice(0, 120) : undefined,
        previewUrl: typeof metadata.previewUrl === 'string' ? metadata.previewUrl : undefined,
        linkUrl: typeof metadata.linkUrl === 'string' ? metadata.linkUrl : undefined,
        pixel: sanitizePixel(metadata.pixel)
      };

      return cleanObject({ ...base, ...locationMeta });
    }

    case 'text':
    case 'emoji':
    default:
      return cleanObject(base);
  }
};

const normalizeChannelId = (channelType, rawChannelId) => {
  if (channelType === 'global') {
    return null;
  }

  if (rawChannelId === undefined || rawChannelId === null) {
    return null;
  }

  const normalized = String(rawChannelId);
  if (normalized === 'null' || normalized === 'undefined' || normalized === 'global') {
    return channelType === 'global' ? null : null;
  }

  return normalized;
};

const parsePaginationParams = query => {
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offsetParam = parseInt(query.offset, 10);
  const pageParam = parseInt(query.page, 10);

  if (!Number.isNaN(offsetParam) && offsetParam >= 0) {
    return { limit, offset: offsetParam };
  }

  if (!Number.isNaN(pageParam) && pageParam > 0) {
    return { limit, offset: (pageParam - 1) * limit };
  }

  return { limit, offset: 0 };
};

const resolveConversationChannelInfo = async (conversation, currentUserId) => {
  if (!conversation) {
    return { channelId: null, targetUserId: null };
  }

  if (conversation.type === 'global') {
    return { channelId: null, targetUserId: null };
  }

  if (conversation.type === 'alliance') {
    return { channelId: conversation.alliance_id || null, targetUserId: null };
  }

  if (conversation.type === 'private') {
    const otherMember = await db('conversation_members')
      .select('user_id')
      .where('conversation_id', conversation.id)
      .where('user_id', '!=', currentUserId)
      .first();

    const otherUserId = otherMember?.user_id || null;
    return { channelId: otherUserId, targetUserId: otherUserId };
  }

  return { channelId: null, targetUserId: null };
};

const formatConversationResponse = conversation => {
  if (!conversation) {
    return null;
  }

  const sanitized = {
    id: conversation.id,
    type: conversation.type,
    key: conversation.key,
    title: conversation.title || null,
    avatar: conversation.avatar || null,
    alliance_id: conversation.alliance_id || null,
    unread_count: conversation.unread_count || 0,
    last_message: conversation.last_message || null,
    other_user: conversation.other_user || null,
    alliance: conversation.alliance || null,
    created_at: conversation.created_at,
    updated_at: conversation.updated_at || null
  };

  return sanitized;
};

class ChatController {
  // 发送消息 - 支持会话系统和私信限额
  static async sendMessage(req, res) {
    try {
      const {
        conversationId,
        channelType,
        channelId,
        messageType = 'text',
        content,
        metadata = {}
      } = req.body;
      const senderId = req.user.id;

      if (!MESSAGE_TYPES.has(messageType)) {
        return res.status(400).json({
          success: false,
          message: '不支持的消息类型'
        });
      }

      const trimmedContent = typeof content === 'string' ? content.trim() : '';

      if (['text', 'emoji'].includes(messageType) && !trimmedContent) {
        return res.status(400).json({
          success: false,
          message: '消息内容不能为空'
        });
      }

      if (messageType === 'text' && trimmedContent.length > MAX_TEXT_LENGTH) {
        return res.status(400).json({
          success: false,
          message: `文本消息长度不能超过${MAX_TEXT_LENGTH}字符`
        });
      }

      if (messageType === 'emoji' && trimmedContent.length > MAX_EMOJI_LENGTH) {
        return res.status(400).json({
          success: false,
          message: `Emoji 消息长度不能超过${MAX_EMOJI_LENGTH}字符`
        });
      }

      let conversation;

      if (conversationId) {
        conversation = await db('conversations').where('id', conversationId).first();
        if (!conversation) {
          return res.status(404).json({
            success: false,
            message: '会话不存在'
          });
        }

        const isMember = await Conversation.isConversationMember(conversationId, senderId);
        if (!isMember) {
          return res.status(403).json({
            success: false,
            message: '您不是该会话的成员'
          });
        }
      } else if (channelType && (channelType !== 'private' || channelId)) {
        conversation = await Conversation.getConversationByLegacyChannel(
          channelType,
          normalizeChannelId(channelType, channelId),
          senderId
        );
      } else {
        return res.status(400).json({
          success: false,
          message: '必须提供会话ID或有效的频道信息'
        });
      }

      let resolvedChannelId = null;
      let targetUserId = null;

      if (conversation.type === 'alliance') {
        const isAllianceMember = await db('alliance_members')
          .where({ alliance_id: conversation.alliance_id, user_id: senderId })
          .first();

        if (!isAllianceMember) {
          return res.status(403).json({
            success: false,
            message: '您不是该联盟的成员'
          });
        }
      }

      const channelInfo = await resolveConversationChannelInfo(conversation, senderId);
      resolvedChannelId = channelInfo.channelId;
      targetUserId = channelInfo.targetUserId;

      if (conversation.type === 'private') {
        if (!targetUserId) {
          return res.status(400).json({
            success: false,
            message: '无法确定私信的接收者'
          });
        }

        const permissionCheck = await privateMessageLimiter.checkPrivateMessagePermission(
          senderId,
          targetUserId
        );

        if (!permissionCheck.allowed) {
          const errorMessages = {
            rate_limit_exceeded: '发送太频繁，请稍后再试',
            daily_message_limit_exceeded: '今日私信条数已达上限',
            daily_target_limit_exceeded: '今日私信对象数已达上限',
            system_error: '系统繁忙，请稍后再试'
          };

          return res.status(429).json({
            success: false,
            message: errorMessages[permissionCheck.reason] || '发送限制',
            code: permissionCheck.reason,
            limits: permissionCheck.limits
          });
        }
      }

      let sanitizedMetadata;
      try {
        sanitizedMetadata = sanitizeMetadata(messageType, metadata);
      } catch (metadataError) {
        return res.status(400).json({
          success: false,
          message: metadataError.message
        });
      }

      const createdMessage = await ChatMessage.create({
        senderId,
        conversationId: conversation.id,
        channelType: conversation.type,
        channelId: resolvedChannelId,
        content: ['text', 'emoji'].includes(messageType) ? trimmedContent : (trimmedContent || ''),
        messageType,
        metadata: sanitizedMetadata
      });

      if (conversation.type === 'private' && targetUserId) {
        await privateMessageLimiter.recordPrivateMessage(senderId, targetUserId);
      }

      // 触发成就：发送聊天消息
      const statsUpdate = { total_messages_count: 1 };
      if (conversation.type === 'private') {
        statsUpdate.pm_sent_count = 1;
      }
      await Achievement.updateUserStats(senderId, statsUpdate);

      await ChatMessage.createUnreadRecords(createdMessage.id, conversation.type, resolvedChannelId, senderId);

      if (hasSocketManager()) {
        try {
          const socketManager = getSocketManager();
          await socketManager.broadcastChatMessage(conversation.type, resolvedChannelId, createdMessage);
        } catch (socketError) {
          console.error('广播聊天消息失败:', socketError);
        }
      }

      await db('conversation_members')
        .where({ conversation_id: conversation.id, user_id: senderId })
        .update({
          last_read_message_id: createdMessage.id,
          last_activity: db.fn.now()
        });

      await CacheService.smartCleanupChatCache(conversation.type, resolvedChannelId);

      res.status(201).json({
        success: true,
        message: '消息发送成功',
        data: createdMessage,
        meta: {
          conversationId: conversation.id
        }
      });
    } catch (error) {
      console.error('发送消息失败:', error);
      res.status(500).json({
        success: false,
        message: '发送消息失败',
        error: error.message
      });
    }
  }

  static async getConversations(req, res) {
    try {
      const userId = req.user.id;
      const { limit, offset } = parsePaginationParams(req.query);

      const conversations = await Conversation.getUserConversations(userId, limit, offset);
      const formatted = conversations
        .map(formatConversationResponse)
        .filter(Boolean);

      res.json({
        success: true,
        data: formatted,
        pagination: {
          limit,
          offset,
          count: formatted.length,
          hasMore: formatted.length === limit
        }
      });
    } catch (error) {
      console.error('获取会话列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取会话列表失败',
        error: error.message
      });
    }
  }

  static async getConversationMessages(req, res) {
    try {
      const { conversationId } = req.params;
      const userId = req.user.id;
      const { limit, offset } = parsePaginationParams(req.query);

      const conversation = await db('conversations').where('id', conversationId).first();
      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: '会话不存在'
        });
      }

      const isMember = await Conversation.isConversationMember(conversationId, userId);
      if (!isMember) {
        return res.status(403).json({
          success: false,
          message: '您不是该会话的成员'
        });
      }

      const messages = await ChatMessage.getConversationMessages(conversationId, limit, offset);
      const channelInfo = await resolveConversationChannelInfo(conversation, userId);

      res.json({
        success: true,
        data: messages,
        pagination: {
          limit,
          offset,
          hasMore: messages.length === limit
        },
        meta: {
          conversationId,
          channelType: conversation.type,
          channelId: channelInfo.channelId
        }
      });
    } catch (error) {
      console.error('获取会话消息失败:', error);
      res.status(500).json({
        success: false,
        message: '获取会话消息失败',
        error: error.message
      });
    }
  }

  static async markConversationAsRead(req, res) {
    try {
      const { conversationId } = req.params;
      const { messageId } = req.body;
      const userId = req.user.id;

      const conversation = await db('conversations').where('id', conversationId).first();
      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: '会话不存在'
        });
      }

      const isMember = await Conversation.isConversationMember(conversationId, userId);
      if (!isMember) {
        return res.status(403).json({
          success: false,
          message: '您不是该会话的成员'
        });
      }

      let resolvedMessageId = messageId;
      if (!resolvedMessageId) {
        const latestMessage = await db('chat_messages')
          .where('conversation_id', conversationId)
          .orderBy('created_at', 'desc')
          .first();
        resolvedMessageId = latestMessage?.id || null;
      }

      if (resolvedMessageId) {
        await Conversation.markAsRead(conversationId, userId, resolvedMessageId);
      }

      const channelInfo = await resolveConversationChannelInfo(conversation, userId);
      await ChatMessage.markChannelAsRead(userId, conversation.type, channelInfo.channelId);
      await CacheService.smartCleanupChatCache(conversation.type, channelInfo.channelId);

      res.json({
        success: true,
        message: '会话已标记为已读'
      });
    } catch (error) {
      console.error('标记会话为已读失败:', error);
      res.status(500).json({
        success: false,
        message: '标记会话为已读失败',
        error: error.message
      });
    }
  }

  static async createPrivateConversation(req, res) {
    try {
      const userId = req.user.id;
      const { userId: targetUserId } = req.body;

      if (!targetUserId) {
        return res.status(400).json({
          success: false,
          message: '需要提供目标用户ID'
        });
      }

      if (String(targetUserId) === String(userId)) {
        return res.status(400).json({
          success: false,
          message: '不能和自己创建会话'
        });
      }

      const targetUser = await db('users').where('id', targetUserId).first();
      if (!targetUser) {
        return res.status(404).json({
          success: false,
          message: '目标用户不存在'
        });
      }

      const conversation = await Conversation.createOrGetPrivateConversation(userId, targetUserId);
      const info = await Conversation.getConversationInfo(conversation.id, userId);
      const formatted = formatConversationResponse({ ...conversation, ...info });

      res.status(201).json({
        success: true,
        data: formatted
      });
    } catch (error) {
      console.error('创建私信会话失败:', error);
      res.status(500).json({
        success: false,
        message: '创建私信会话失败',
        error: error.message
      });
    }
  }

  static async getChannelMessages(req, res) {
    try {
      const { channelType, channelId } = req.params;
      const userId = req.user.id;
      const { limit, offset } = parsePaginationParams(req.query);

      if (!['global', 'alliance', 'private'].includes(channelType)) {
        return res.status(400).json({
          success: false,
          message: '不支持的频道类型'
        });
      }

      const normalizedChannelId = normalizeChannelId(channelType, channelId);
      const conversation = await Conversation.getConversationByLegacyChannel(
        channelType,
        normalizedChannelId,
        userId
      );

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: '会话不存在'
        });
      }

      if (conversation.type !== 'global') {
        let hasPermission = false;

        if (conversation.type === 'alliance') {
          // For alliance conversations, check actual alliance membership
          const isAllianceMember = await db('alliance_members')
            .where({ alliance_id: conversation.alliance_id, user_id: userId })
            .first();
          hasPermission = !!isAllianceMember;
        } else {
          // For other conversation types, check conversation membership
          hasPermission = await Conversation.isConversationMember(conversation.id, userId);
        }

        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            message: '您没有查看该频道的权限'
          });
        }
      }

      let messages = [];

      if (conversation.id) {
        messages = await ChatMessage.getConversationMessages(conversation.id, limit, offset);
      }

      if (messages.length === 0) {
        if (conversation.type === 'private') {
          const otherMember = await db('conversation_members')
            .select('user_id')
            .where('conversation_id', conversation.id)
            .where('user_id', '!=', userId)
            .first();

          const otherUserId = otherMember?.user_id || normalizedChannelId;
          if (!otherUserId) {
            return res.status(400).json({
              success: false,
              message: '缺少私信目标用户'
            });
          }

          messages = await ChatMessage.getPrivateMessages(userId, otherUserId, limit, offset);
        } else {
          const fallbackChannelId = conversation.type === 'alliance' ? conversation.alliance_id : null;
          messages = await ChatMessage.getChannelMessages(conversation.type, fallbackChannelId, limit, offset);
        }
      }

      res.json({
        success: true,
        data: messages,
        pagination: {
          limit,
          offset,
          hasMore: messages.length === limit
        },
        meta: {
          conversationId: conversation.id
        }
      });
    } catch (error) {
      console.error('获取频道消息失败:', error);
      res.status(500).json({
        success: false,
        message: '获取频道消息失败',
        error: error.message
      });
    }
  }

  static async getPrivateMessages(req, res) {
    try {
      const { userId } = req.params;
      const currentUserId = req.user.id;
      const { limit, offset } = parsePaginationParams(req.query);

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: '缺少私信目标用户'
        });
      }

      const conversation = await Conversation.createOrGetPrivateConversation(currentUserId, userId);
      const isMember = await Conversation.isConversationMember(conversation.id, currentUserId);

      if (!isMember) {
        return res.status(403).json({
          success: false,
          message: '您没有访问该私信的权限'
        });
      }

      let messages = await ChatMessage.getConversationMessages(conversation.id, limit, offset);

      if (messages.length === 0) {
        messages = await ChatMessage.getPrivateMessages(currentUserId, userId, limit, offset);
      }

      res.json({
        success: true,
        data: messages,
        pagination: {
          limit,
          offset,
          hasMore: messages.length === limit
        },
        meta: {
          conversationId: conversation.id
        }
      });
    } catch (error) {
      console.error('获取私聊消息失败:', error);
      res.status(500).json({
        success: false,
        message: '获取私聊消息失败',
        error: error.message
      });
    }
  }

  static async getUnreadMessages(req, res) {
    try {
      const { channelType, channelId } = req.params;
      const userId = req.user.id;
      const { limit, offset } = parsePaginationParams(req.query);

      if (!['global', 'alliance', 'private'].includes(channelType)) {
        return res.status(400).json({
          success: false,
          message: '不支持的频道类型'
        });
      }

      const normalizedChannelId = normalizeChannelId(channelType, channelId);
      const messages = await ChatMessage.getUnreadMessages(userId, channelType, normalizedChannelId, limit, offset);

      res.json({
        success: true,
        data: messages,
        pagination: {
          limit,
          offset,
          hasMore: messages.length === limit
        }
      });
    } catch (error) {
      console.error('获取未读消息失败:', error);
      res.status(500).json({
        success: false,
        message: '获取未读消息失败',
        error: error.message
      });
    }
  }

  static async getUnreadCount(req, res) {
    try {
      const { channelType, channelId } = req.query;
      const userId = req.user.id;

      if (!['global', 'alliance', 'private'].includes(channelType)) {
        return res.status(400).json({
          success: false,
          message: '不支持的频道类型'
        });
      }

      const normalizedChannelId = normalizeChannelId(channelType, channelId);
      const count = await ChatMessage.getUnreadCount(userId, channelType, normalizedChannelId);

      res.json({
        success: true,
        data: { count }
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

  // 标记消息为已读 - 集成缓存优化
  static async markAsRead(req, res) {
    try {
      const userId = req.user.id;
      const { messageIds, channelType, channelId } = req.body;

      if (messageIds && messageIds.length > 0) {
        const records = await db('chat_messages')
          .select('id', 'channel_type', 'channel_id')
          .whereIn('id', messageIds);

        await ChatMessage.markMessagesAsRead(userId, records);
      } else if (channelType) {
        await ChatMessage.markChannelAsRead(userId, channelType, normalizeChannelId(channelType, channelId));
      }

      // 清理相关缓存
      await CacheService.smartCleanupChatCache(channelType, normalizeChannelId(channelType, channelId));

      res.json({
        success: true,
        message: '标记为已读成功'
      });
    } catch (error) {
      console.error('标记为已读失败:', error);
      res.status(500).json({
        success: false,
        message: '标记为已读失败',
        error: error.message
      });
    }
  }

  // 删除消息 - 集成缓存优化
  static async deleteMessage(req, res) {
    try {
      const { messageId } = req.params;
      const userId = req.user.id;

      const message = await ChatMessage.findById(messageId);
      if (!message) {
        return res.status(404).json({
          success: false,
          message: '消息不存在'
        });
      }

      // 检查权限（只能删除自己的消息）
      if (message.sender_id !== userId) {
        return res.status(403).json({
          success: false,
          message: '只能删除自己的消息'
        });
      }

      await ChatMessage.delete(messageId);

      // 清理相关缓存
      await CacheService.smartCleanupChatCache(message.channel_type, message.channel_id);

      res.json({
        success: true,
        message: '消息删除成功'
      });
    } catch (error) {
      console.error('删除消息失败:', error);
      res.status(500).json({
        success: false,
        message: '删除消息失败',
        error: error.message
      });
    }
  }

  // 搜索消息 - 集成缓存优化
  static async searchMessages(req, res) {
    try {
      const { channelType, channelId, query } = req.query;
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      // 构建缓存键
      const channelKey = `${channelType}:${channelId || 'global'}`;
      const cacheKey = `chat_search:${channelKey}:${query}:${page}:${limit}`;

      // 先从缓存获取
      let results = await CacheService.get(cacheKey);

      if (!results) {
        // 从数据库搜索消息
        results = await ChatMessage.searchMessages(channelType, channelId, query, limit, offset);

        // 缓存结果（较长时间缓存）
        await CacheService.setWithDefaultTTL(cacheKey, results, 'CHAT_MESSAGE');
      }

      res.json({
        success: true,
        data: results,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          offset
        }
      });
    } catch (error) {
      console.error('搜索消息失败:', error);
      res.status(500).json({
        success: false,
        message: '搜索消息失败',
        error: error.message
      });
    }
  }

  // 获取频道统计信息 - 集成缓存优化
  static async getChannelStats(req, res) {
    try {
      const { channelType, channelId } = req.params;

      // 构建缓存键
      const cacheKey = `channel_stats:${channelType}:${channelId || 'global'}`;

      // 先从缓存获取
      let stats = await CacheService.get(cacheKey);

      if (!stats) {
        // 从数据库获取
        stats = await ChatMessage.getChannelStats(channelType, channelId);

        // 缓存结果（较长时间缓存）
        await CacheService.setWithDefaultTTL(cacheKey, stats, 'CHAT_MESSAGE');
      }

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('获取频道统计失败:', error);
      res.status(500).json({
        success: false,
        message: '获取频道统计失败',
        error: error.message
      });
    }
  }

  // 缓存预热接口 - 新增功能
  static async warmupCache(req, res) {
    try {
      const { channelType, channelId, limit = 50 } = req.body;

      // 预热聊天缓存
      await CacheService.warmupChatCache(channelType, normalizeChannelId(channelType, channelId), limit);

      res.json({
        success: true,
        message: '缓存预热完成'
      });
    } catch (error) {
      console.error('缓存预热失败:', error);
      res.status(500).json({
        success: false,
        message: '缓存预热失败',
        error: error.message
      });
    }
  }

  // 清理缓存接口 - 新增功能
  static async cleanupCache(req, res) {
    try {
      const { channelType, channelId } = req.body;

      // 智能清理聊天缓存
      await CacheService.smartCleanupChatCache(channelType, normalizeChannelId(channelType, channelId));

      res.json({
        success: true,
        message: '缓存清理完成'
      });
    } catch (error) {
      console.error('缓存清理失败:', error);
      res.status(500).json({
        success: false,
        message: '缓存清理失败',
        error: error.message
      });
    }
  }

  // 获取私信限额状态
  static async getPrivateMessageLimits(req, res) {
    try {
      const userId = req.user.id;

      const limits = await privateMessageLimiter.getUserLimitStatus(userId);

      if (!limits) {
        return res.status(500).json({
          success: false,
          message: '获取限额状态失败'
        });
      }

      res.json({
        success: true,
        data: limits
      });
    } catch (error) {
      console.error('获取私信限额失败:', error);
      res.status(500).json({
        success: false,
        message: '获取私信限额失败',
        error: error.message
      });
    }
  }
}

module.exports = ChatController;
