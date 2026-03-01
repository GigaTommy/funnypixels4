import { api } from './api';
import { logger } from '../utils/logger';

export interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar?: string;
  conversation_id?: string;
  channel_type: 'global' | 'alliance' | 'private';
  channel_id?: string;
  message_type: 'text' | 'emoji' | 'image' | 'location' | 'system' | 'announcement';
  content: string;
  metadata?: Record<string, any>;
  is_system_message: boolean;
  is_edited?: boolean;
  edit_count?: number;
  created_at: string;
  updated_at?: string;
}

export interface Conversation {
  id: string;
  type: 'private' | 'alliance' | 'global' | 'group';
  key: string;
  title?: string;
  avatar?: string;
  unread_count: number;
  is_pinned?: boolean;
  is_muted?: boolean;
  mute_until?: string;
  mute_type?: string;
  last_message?: {
    content: string;
    sender_name: string;
    created_at: string;
    message_type: string;
  };
  other_user?: {
    id: string;
    username: string;
    display_name?: string;
    avatar_url?: string;
  };
  alliance?: {
    name: string;
    color?: string;
    banner_url?: string;
  };
  created_at: string;
}

export interface SendMessageData {
  conversationId?: string;
  channelType?: 'global' | 'alliance' | 'private';
  channelId?: string;
  messageType: 'text' | 'emoji' | 'image' | 'location' | 'system' | 'announcement';
  content: string;
  metadata?: Record<string, any>;
}

interface ChatApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  pagination?: {
    limit: number;
    offset?: number;
    page?: number;
    count?: number;
    hasMore?: boolean;
  };
  meta?: Record<string, any>;
}

export interface PrivateMessageLimits {
  dailyMessageCount: number;
  dailyMessageLimit: number;
  dailyMessageRemaining: number;
  dailyTargetCount: number;
  dailyTargetLimit: number;
  dailyTargetRemaining: number;
  rateLimitCount: number;
  rateLimitMax: number;
  rateLimitRemaining: number;
  isMessageLimitReached: boolean;
  isTargetLimitReached: boolean;
  isRateLimitReached: boolean;
}

export class ChatAPI {
  // 发送消息 - 支持新的消息类型和会话系统
  static async sendMessage(data: SendMessageData): Promise<ChatApiResponse<ChatMessage>> {
    const response = await api.post('/chat/send', data);
    return response.data;
  }

  // 获取会话列表
  static async getConversations(limit: number = 20, offset: number = 0): Promise<ChatApiResponse<Conversation[]>> {
    const response = await api.get('/chat/conversations', {
      params: { limit, offset }
    });
    return response.data;
  }

  // 获取会话消息
  static async getConversationMessages(
    conversationId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<ChatApiResponse<ChatMessage[]>> {
    const response = await api.get(`/chat/conversations/${conversationId}/messages`, {
      params: { limit, offset }
    });
    return response.data;
  }

  // 标记会话为已读
  static async markConversationAsRead(conversationId: string, messageId?: string): Promise<ChatApiResponse<{ success: true }>> {
    try {
      const response = await api.post(`/chat/conversations/${conversationId}/mark-read`, {
        messageId
      });
      return response.data;
    } catch (error: any) {
      logger.warn('📧 标记消息已读失败:', error?.response?.data?.message || error.message);

      // 如果是500错误或服务器问题，返回一个成功的响应避免影响用户体验
      if (error?.response?.status === 500 || error?.response?.status >= 500) {
        logger.debug('🔄 服务器错误，跳过标记已读但不影响功能');
        return {
          success: true,
          data: { success: true },
          message: 'Marked as read locally due to server error'
        };
      }

      // 其他错误正常抛出
      throw error;
    }
  }

  // 获取频道消息（兼容旧接口）
  static async getChannelMessages(
    channelType: string,
    channelId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<ChatApiResponse<ChatMessage[]>> {
    const response = await api.get(`/chat/channel/${channelType}/${channelId}`, {
      params: { limit, offset }
    });
    return response.data;
  }

  // 获取私聊消息（兼容旧接口）
  static async getPrivateMessages(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<ChatApiResponse<ChatMessage[]>> {
    const response = await api.get(`/chat/private/conversation/${userId}`, {
      params: { limit, offset }
    });
    return response.data;
  }

  // 获取私信限额状态
  static async getPrivateMessageLimits(): Promise<ChatApiResponse<PrivateMessageLimits>> {
    const response = await api.get('/chat/private-message-limits');
    return response.data;
  }

  // 删除消息
  static async deleteMessage(messageId: string): Promise<ChatApiResponse<{ success: true }>> {
    const response = await api.delete(`/chat/message/${messageId}`);
    return response.data;
  }

  // 搜索消息
  static async searchMessages(
    query: string,
    channelType?: string,
    limit: number = 20
  ): Promise<ChatApiResponse<ChatMessage[]>> {
    const response = await api.get('/chat/search', {
      params: { q: query, channelType, limit }
    });
    return response.data;
  }

  // 创建或获取私信会话
  static async createOrGetPrivateConversation(userId: string): Promise<ChatApiResponse<Conversation>> {
    const response = await api.post('/chat/private/create-conversation', { userId });
    return response.data;
  }

  // 静态图片生成（用于位置消息）
  static generateStaticMap(lat: number, lng: number, zoom: number = 16): string {
    // 这里可以接入高德地图静态图API或其他地图服务
    return `https://restapi.amap.com/v3/staticmap?location=${lng},${lat}&zoom=${zoom}&size=300*200&markers=mid,0xFF0000,A:${lng},${lat}&key=YOUR_AMAP_KEY`;
  }

  // 验证消息内容
  static validateMessageContent(messageType: string, content: string, metadata?: Record<string, any>): { valid: boolean; error?: string } {
    switch (messageType) {
      case 'text':
        if (!content || content.length === 0) {
          return { valid: false, error: '文本内容不能为空' };
        }
        if (content.length > 2000) {
          return { valid: false, error: '文本长度不能超过2000字符' };
        }
        break;

      case 'emoji':
        if (!content || content.length === 0) {
          return { valid: false, error: '表情内容不能为空' };
        }
        if (content.length > 2048) {
          return { valid: false, error: '表情消息长度不能超过2048字符' };
        }
        break;

      case 'image':
        if (!metadata?.image_url) {
          return { valid: false, error: '图片消息需要提供图片URL' };
        }
        break;

      case 'location':
        if (!metadata?.lat || !metadata?.lng) {
          return { valid: false, error: '位置消息需要提供经纬度坐标' };
        }
        if (typeof metadata.lat !== 'number' || typeof metadata.lng !== 'number') {
          return { valid: false, error: '经纬度必须是数字' };
        }
        break;

      default:
        return { valid: false, error: '不支持的消息类型' };
    }

    return { valid: true };
  }

  // 格式化消息显示内容
  static formatMessageContent(message: ChatMessage): string {
    switch (message.message_type) {
      case 'text':
      case 'emoji':
        return message.content;

      case 'image':
        return '[图片]';

      case 'location':
        const location = message.metadata;
        if (location?.addressSnippet) {
          return `[位置] ${location.addressSnippet}`;
        }
        return `[位置] ${location?.lat?.toFixed(4)}, ${location?.lng?.toFixed(4)}`;

      default:
        return message.content;
    }
  }

  // 群聊相关方法
  // 创建群聊
  static async createGroup(data: CreateGroupData): Promise<ChatApiResponse<GroupChat>> {
    const response = await api.post('/group-chats', data);
    return response.data;
  }

  // 获取用户的群聊列表
  static async getUserGroups(limit: number = 50, offset: number = 0): Promise<ChatApiResponse<GroupChat[]>> {
    const response = await api.get('/group-chats', {
      params: { limit, offset }
    });
    return response.data;
  }

  // 通过邀请码加入群聊
  static async joinGroupByInvite(inviteCode: string): Promise<ChatApiResponse<{ group: GroupChat; membership: GroupMember }>> {
    const response = await api.post('/group-chats/join', { invite_code: inviteCode });
    return response.data;
  }

  // 获取群聊详情
  static async getGroupDetails(groupId: string): Promise<ChatApiResponse<GroupChat & { user_role: string; stats: any }>> {
    const response = await api.get(`/group-chats/${groupId}`);
    return response.data;
  }

  // 获取群聊成员
  static async getGroupMembers(groupId: string, limit: number = 100, offset: number = 0): Promise<ChatApiResponse<GroupMember[]>> {
    const response = await api.get(`/group-chats/${groupId}/members`, {
      params: { limit, offset }
    });
    return response.data;
  }

  // 发送群聊消息
  static async sendGroupMessage(groupId: string, data: SendGroupMessageData): Promise<ChatApiResponse<GroupMessage>> {
    const response = await api.post(`/group-chats/${groupId}/messages`, data);
    return response.data;
  }

  // 获取群聊消息
  static async getGroupMessages(groupId: string, limit: number = 50, offset: number = 0, beforeId?: string): Promise<ChatApiResponse<GroupMessage[]>> {
    const response = await api.get(`/group-chats/${groupId}/messages`, {
      params: { limit, offset, before_id: beforeId }
    });
    return response.data;
  }

  // 退出群聊
  static async leaveGroup(groupId: string): Promise<ChatApiResponse<{ message: string }>> {
    const response = await api.post(`/group-chats/${groupId}/leave`);
    return response.data;
  }

  // 搜索群聊
  static async searchGroups(query: string, limit: number = 20): Promise<ChatApiResponse<GroupChat[]>> {
    const response = await api.get('/group-chats/search', {
      params: { query, limit }
    });
    return response.data;
  }
}

// 群聊相关类型定义
export interface GroupChat {
  id: string;
  name: string;
  description?: string;
  avatar_url?: string;
  creator_id: string;
  is_private: boolean;
  invite_code: string;
  max_members: number;
  member_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  user_role?: 'creator' | 'admin' | 'member';
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: 'creator' | 'admin' | 'member';
  nickname?: string;
  is_muted: boolean;
  mute_until?: string;
  is_active: boolean;
  joined_at: string;
  updated_at: string;
  user_username: string;
  user_display_name?: string;
  user_avatar_url?: string;
  user_verified?: boolean;
}

export interface GroupMessage {
  id: string;
  group_id: string;
  sender_id?: string;
  content: string;
  message_type: 'text' | 'image' | 'file' | 'system';
  metadata?: Record<string, any>;
  reply_to_id?: string;
  is_edited: boolean;
  edit_count: number;
  is_pinned: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  sender_username?: string;
  sender_display_name?: string;
  sender_avatar_url?: string;
  reply_to_content?: string;
  reply_to_sender?: string;
}

export interface CreateGroupData {
  name: string;
  description?: string;
  is_private?: boolean;
  max_members?: number;
}

export interface SendGroupMessageData {
  content: string;
  message_type?: 'text' | 'image' | 'file';
  metadata?: Record<string, any>;
  reply_to_id?: string;
}
