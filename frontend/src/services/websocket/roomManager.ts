import { chatWebSocket } from './chatWebSocket';
import { AuthService } from '../auth';
import { logger } from '../../utils/logger';

// 房间类型定义
export interface ChatRoom {
  id: string;
  type: 'global' | 'alliance' | 'private';
  channelId?: string;
  conversationId?: string;
  title: string;
  description?: string;
  userCount: number;
  isJoined: boolean;
  lastActivity?: string;
  metadata?: Record<string, any>;
}

// 房间管理器类
export class ChatRoomManager {
  private rooms: Map<string, ChatRoom> = new Map();
  private currentRoom: string | null = null;
  private eventListeners: Map<string, Set<Function>> = new Map();

  constructor() {
    this.setupWebSocketListeners();
    this.initializeDefaultRooms();
  }

  // 设置WebSocket事件监听
  private setupWebSocketListeners(): void {
    chatWebSocket.on('room_joined', (data: { roomId: string; userCount: number }) => {
      const room = this.rooms.get(data.roomId);
      if (room) {
        room.isJoined = true;
        room.userCount = data.userCount;
        room.lastActivity = new Date().toISOString();
        this.currentRoom = data.roomId;
        this.emit('room_updated', room);
        this.emit('room_joined', room);
      }
    });

    chatWebSocket.on('room_left', (data: { roomId: string }) => {
      const room = this.rooms.get(data.roomId);
      if (room) {
        room.isJoined = false;
        if (this.currentRoom === data.roomId) {
          this.currentRoom = null;
        }
        this.emit('room_updated', room);
        this.emit('room_left', room);
      }
    });

    chatWebSocket.on('new_message', (message: any) => {
      // 更新房间最后活动时间
      const roomId = this.getRoomIdFromMessage(message);
      const room = this.rooms.get(roomId);
      if (room) {
        room.lastActivity = message.created_at || new Date().toISOString();
        this.emit('room_updated', room);
      }
    });

    chatWebSocket.on('user_online', (data: { userId: string; conversationId?: string }) => {
      if (data.conversationId) {
        const room = this.rooms.get(`private:${data.conversationId}`);
        if (room) {
          this.emit('user_online', { room, userId: data.userId });
        }
      }
    });

    chatWebSocket.on('user_offline', (data: { userId: string; conversationId?: string }) => {
      if (data.conversationId) {
        const room = this.rooms.get(`private:${data.conversationId}`);
        if (room) {
          this.emit('user_offline', { room, userId: data.userId });
        }
      }
    });
  }

  // 初始化默认房间
  private initializeDefaultRooms(): void {
    // 全局聊天室
    this.addRoom({
      id: 'global',
      type: 'global',
      title: '🌍 全球聊天',
      description: '与全世界的像素艺术家交流',
      userCount: 0,
      isJoined: false,
    });
  }

  // 从消息中获取房间ID
  private getRoomIdFromMessage(message: any): string {
    if (message.channel_type === 'global') {
      return 'global';
    } else if (message.channel_type === 'alliance' && message.channel_id) {
      return `alliance:${message.channel_id}`;
    } else if (message.channel_type === 'private' && message.conversation_id) {
      return `private:${message.conversation_id}`;
    }
    return 'unknown';
  }

  // 添加房间
  public addRoom(room: ChatRoom): void {
    this.rooms.set(room.id, room);
    this.emit('room_added', room);
  }

  // 移除房间
  public removeRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      // 如果当前在这个房间，先离开
      if (room.isJoined) {
        this.leaveRoom(roomId);
      }
      this.rooms.delete(roomId);
      this.emit('room_removed', room);
    }
  }

  // 获取房间
  public getRoom(roomId: string): ChatRoom | undefined {
    return this.rooms.get(roomId);
  }

  // 获取所有房间
  public getAllRooms(): ChatRoom[] {
    return Array.from(this.rooms.values());
  }

  // 获取已加入的房间
  public getJoinedRooms(): ChatRoom[] {
    return this.getAllRooms().filter(room => room.isJoined);
  }

  // 获取当前房间
  public getCurrentRoom(): ChatRoom | null {
    return this.currentRoom ? this.rooms.get(this.currentRoom) || null : null;
  }

  // 加入房间
  public async joinRoom(roomId: string): Promise<boolean> {
    const room = this.rooms.get(roomId);
    if (!room) {
      logger.error('Room not found:', roomId);
      return false;
    }

    try {
      // 如果已经在另一个房间，先离开
      if (this.currentRoom && this.currentRoom !== roomId) {
        await this.leaveCurrentRoom();
      }

      // 准备加入房间的数据
      const joinData: any = {
        channelType: room.type,
      };

      if (room.type === 'alliance' && room.channelId) {
        joinData.channelId = room.channelId;
      } else if (room.type === 'private' && room.conversationId) {
        joinData.conversationId = room.conversationId;
      }

      // 发送加入房间请求
      chatWebSocket.joinChatRoom(joinData);

      return true;
    } catch (error) {
      logger.error('Failed to join room:', error);
      return false;
    }
  }

  // 离开房间
  public async leaveRoom(roomId: string): Promise<boolean> {
    const room = this.rooms.get(roomId);
    if (!room || !room.isJoined) {
      return false;
    }

    try {
      const leaveData: any = {};

      if (room.type === 'private' && room.conversationId) {
        leaveData.conversationId = room.conversationId;
      }

      chatWebSocket.leaveChatRoom(leaveData);
      return true;
    } catch (error) {
      logger.error('Failed to leave room:', error);
      return false;
    }
  }

  // 离开当前房间
  public async leaveCurrentRoom(): Promise<boolean> {
    if (this.currentRoom) {
      return await this.leaveRoom(this.currentRoom);
    }
    return true;
  }

  // 创建联盟房间
  public async createAllianceRoom(allianceId: string, allianceName: string): Promise<ChatRoom> {
    const roomId = `alliance:${allianceId}`;
    const room: ChatRoom = {
      id: roomId,
      type: 'alliance',
      channelId: allianceId,
      title: `🏰 ${allianceName}`,
      description: `${allianceName} 联盟内部聊天`,
      userCount: 0,
      isJoined: false,
    };

    this.addRoom(room);
    return room;
  }

  // 创建私信房间
  public async createPrivateRoom(
    conversationId: string,
    otherUserId: string,
    otherUsername: string,
    avatar?: string
  ): Promise<ChatRoom> {
    const roomId = `private:${conversationId}`;
    const room: ChatRoom = {
      id: roomId,
      type: 'private',
      conversationId,
      title: `💬 ${otherUsername}`,
      description: `与 ${otherUsername} 的私信`,
      userCount: 2, // 私信固定为2人
      isJoined: false,
      metadata: {
        otherUserId,
        otherUsername,
        avatar,
      },
    };

    this.addRoom(room);
    return room;
  }

  // 更新房间信息
  public updateRoom(roomId: string, updates: Partial<ChatRoom>): void {
    const room = this.rooms.get(roomId);
    if (room) {
      Object.assign(room, updates);
      this.emit('room_updated', room);
    }
  }

  // 设置用户ID
  public setUserId(userId: string): void {
    chatWebSocket.setUserId(userId);
  }

  // 加载用户的房间列表
  public async loadUserRooms(): Promise<void> {
    try {
      const user = await AuthService.getCurrentUser();
      if (!user) {
        return;
      }

      this.setUserId(user.id);

      // 加载联盟房间
      await this.loadAllianceRooms(user.id);

      // 加载私信房间
      await this.loadPrivateRooms();

    } catch (error) {
      logger.error('Failed to load user rooms:', error);
    }
  }

  // 加载联盟房间
  private async loadAllianceRooms(userId: string): Promise<void> {
    try {
      // 这里应该调用联盟API获取用户所在的联盟
      // 暂时使用示例数据
      const allianceResponse = await fetch('/api/user/alliance');
      if (allianceResponse.ok) {
        const alliance = await allianceResponse.json();
        if (alliance.data) {
          await this.createAllianceRoom(alliance.data.id, alliance.data.name);
        }
      }
    } catch (error) {
      logger.error('Failed to load alliance rooms:', error);
    }
  }

  // 加载私信房间
  private async loadPrivateRooms(): Promise<void> {
    try {
      // 调用聊天API获取会话列表
      const response = await fetch('/api/chat/conversations');
      if (response.ok) {
        const conversations = await response.json();
        if (conversations.data) {
          for (const conv of conversations.data) {
            if (conv.type === 'private' && conv.other_user) {
              await this.createPrivateRoom(
                conv.id,
                conv.other_user.id,
                conv.other_user.username || conv.other_user.display_name,
                conv.other_user.avatar_url
              );
            }
          }
        }
      }
    } catch (error) {
      logger.error('Failed to load private rooms:', error);
    }
  }

  // 添加事件监听器
  public on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  // 移除事件监听器
  public off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  // 触发事件
  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          logger.error('Error in room manager event listener:', error);
        }
      });
    }
  }

  // 清理资源
  public destroy(): void {
    this.rooms.clear();
    this.eventListeners.clear();
    this.currentRoom = null;
  }
}

// 创建全局实例
export const roomManager = new ChatRoomManager();

// 导出默认实例
export default roomManager;