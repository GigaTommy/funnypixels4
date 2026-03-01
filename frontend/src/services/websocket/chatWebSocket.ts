import { io, Socket } from 'socket.io-client';
import { ChatMessage, SendMessageData } from '../chat';
import { logger } from '../../utils/logger';

// 聊天WebSocket事件类型定义
export interface ChatEvents {
  // 客户端发送的事件
  'join_chat_room': {
    conversationId?: string;
    channelType: 'global' | 'alliance' | 'private';
    channelId?: string;
  };
  'leave_chat_room': {
    conversationId?: string;
  };
  'send_message': SendMessageData;
  'typing_start': {
    conversationId: string;
    userId: string;
  };
  'typing_stop': {
    conversationId: string;
    userId: string;
  };
  'mark_as_read': {
    conversationId: string;
    messageId: string;
    userId: string;
  };

  // 服务器发送的事件
  'chat:room_joined': {
    roomId: string;
    userCount: number;
  };
  'chat:room_left': {
    roomId: string;
  };
  'chat:new_message': ChatMessage;
  'chat:message_delivered': {
    messageId: string;
    conversationId: string;
  };
  'chat:message_read': {
    messageId: string;
    conversationId: string;
    readBy: string;
    readAt: string;
  };
  'chat:typing': {
    conversationId: string;
    userId: string;
    username: string;
    isTyping: boolean;
  };
  'chat:user_online': {
    userId: string;
    username: string;
    conversationId?: string;
  };
  'chat:user_offline': {
    userId: string;
    username: string;
    conversationId?: string;
  };
  'chat:error': {
    error: string;
    code?: string;
    details?: any;
  };
}

// 聊天WebSocket管理类
export class ChatWebSocketManager {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;
  private eventListeners: Map<string, Set<Function>> = new Map();
  private currentRooms: Set<string> = new Set();
  private userId: string | null = null;

  constructor() {
    this.connect();
  }

  // 建立WebSocket连接
  private connect(): void {
    if (this.isConnecting || this.socket?.connected) {
      return;
    }

    this.isConnecting = true;
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

    this.socket = io(wsUrl, {
      transports: ['polling', 'websocket'], // Try polling first, then websocket
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      forceNew: false, // Don't force new connection to avoid conflicts
      timeout: 20000,
    });

    this.setupEventListeners();
  }

  // 设置基础事件监听
  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      logger.debug('💬 Chat WebSocket connected');
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.emit('connect');

      // 重新加入之前的房间
      this.rejoinRooms();
    });

    this.socket.on('disconnect', (reason) => {
      logger.debug('💬 Chat WebSocket disconnected:', reason);
      this.emit('disconnect', reason);
    });

    this.socket.on('connect_error', (error) => {
      logger.error('💬 Chat WebSocket connection error:', error);
      this.isConnecting = false;
      this.emit('connect_error', error);
    });

    this.socket.on('reconnect', (attemptNumber) => {
      logger.debug('💬 Chat WebSocket reconnected after', attemptNumber, 'attempts');
      this.emit('reconnect', attemptNumber);
    });

    this.socket.on('reconnect_error', (error) => {
      logger.error('💬 Chat WebSocket reconnection error:', error);
      this.reconnectAttempts++;
      this.emit('reconnect_error', error);
    });

    this.socket.on('reconnect_failed', () => {
      logger.error('💬 Chat WebSocket reconnection failed');
      this.emit('reconnect_failed');
    });

    // 设置聊天特定事件监听
    this.setupChatEventListeners();
  }

  // 设置聊天相关事件监听
  private setupChatEventListeners(): void {
    if (!this.socket) return;

    // 房间管理事件
    this.socket.on('chat:room_joined', (data: ChatEvents['chat:room_joined']) => {
      logger.debug('💬 Joined chat room:', data);
      this.emit('room_joined', data);
    });

    this.socket.on('chat:room_left', (data: ChatEvents['chat:room_left']) => {
      logger.debug('💬 Left chat room:', data);
      this.currentRooms.delete(data.roomId);
      this.emit('room_left', data);
    });

    // 消息事件
    this.socket.on('chat:new_message', (data: ChatEvents['chat:new_message']) => {
      logger.debug('💬 New message received:', data);
      this.emit('new_message', data);
    });

    this.socket.on('chat:message_delivered', (data: ChatEvents['chat:message_delivered']) => {
      this.emit('message_delivered', data);
    });

    this.socket.on('chat:message_read', (data: ChatEvents['chat:message_read']) => {
      this.emit('message_read', data);
    });

    // 输入状态事件
    this.socket.on('chat:typing', (data: ChatEvents['chat:typing']) => {
      this.emit('typing', data);
    });

    // 用户在线状态事件
    this.socket.on('chat:user_online', (data: ChatEvents['chat:user_online']) => {
      this.emit('user_online', data);
    });

    this.socket.on('chat:user_offline', (data: ChatEvents['chat:user_offline']) => {
      this.emit('user_offline', data);
    });

    // 错误事件
    this.socket.on('chat:error', (data: ChatEvents['chat:error']) => {
      logger.error('💬 Chat error:', data);
      this.emit('error', data);
    });
  }

  // 重新加入房间
  private rejoinRooms(): void {
    for (const roomId of this.currentRooms) {
      // 这里需要根据实际房间格式重新解析并加入
      logger.debug('💬 Rejoining room:', roomId);
      // TODO: 实现房间重新加入逻辑
    }
  }

  // 设置用户ID
  public setUserId(userId: string): void {
    this.userId = userId;
  }

  // 加入聊天室
  public joinChatRoom(data: ChatEvents['join_chat_room']): void {
    if (!this.socket?.connected) {
      logger.warn('💬 Socket not connected, cannot join room');
      return;
    }

    const roomId = this.generateRoomId(data);
    this.currentRooms.add(roomId);
    this.socket.emit('join_chat_room', data);
    logger.debug('💬 Joining chat room:', data);
  }

  // 离开聊天室
  public leaveChatRoom(data: ChatEvents['leave_chat_room']): void {
    if (!this.socket?.connected) {
      return;
    }

    this.socket.emit('leave_chat_room', data);

    if (data.conversationId) {
      this.currentRooms.delete(data.conversationId);
    }

    logger.debug('💬 Leaving chat room:', data);
  }

  // 发送消息
  public sendMessage(data: SendMessageData): void {
    if (!this.socket?.connected) {
      logger.warn('💬 Socket not connected, cannot send message');
      return;
    }

    this.socket.emit('send_message', data);
    logger.debug('💬 Sending message:', data);
  }

  // 开始输入
  public startTyping(conversationId: string): void {
    if (!this.socket?.connected || !this.userId) {
      return;
    }

    this.socket.emit('typing_start', {
      conversationId,
      userId: this.userId,
    });
  }

  // 停止输入
  public stopTyping(conversationId: string): void {
    if (!this.socket?.connected || !this.userId) {
      return;
    }

    this.socket.emit('typing_stop', {
      conversationId,
      userId: this.userId,
    });
  }

  // 标记消息为已读
  public markAsRead(conversationId: string, messageId: string): void {
    if (!this.socket?.connected || !this.userId) {
      return;
    }

    this.socket.emit('mark_as_read', {
      conversationId,
      messageId,
      userId: this.userId,
    });
  }

  // 生成房间ID
  private generateRoomId(data: ChatEvents['join_chat_room']): string {
    if (data.channelType === 'global') {
      return 'global';
    } else if (data.channelType === 'alliance' && data.channelId) {
      return `alliance:${data.channelId}`;
    } else if (data.channelType === 'private' && data.conversationId) {
      return `private:${data.conversationId}`;
    }
    return 'unknown';
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
          logger.error('💬 Error in event listener:', error);
        }
      });
    }
  }

  // 获取连接状态
  public isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  // 获取当前房间列表
  public getCurrentRooms(): string[] {
    return Array.from(this.currentRooms);
  }

  // 断开连接
  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.currentRooms.clear();
    this.eventListeners.clear();
    this.isConnecting = false;
  }

  // 强制重连
  public forceReconnect(): void {
    this.disconnect();
    setTimeout(() => {
      this.connect();
    }, 1000);
  }
}

// 创建全局实例
export const chatWebSocket = new ChatWebSocketManager();

// 导出默认实例
export default chatWebSocket;