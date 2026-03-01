// frontend/src/services/chatWebSocket.ts
import { io, Socket } from 'socket.io-client';

class ChatWebSocketService {
  constructor() {
    this.socket = null;
    this.messageHandlers = new Map();
  }

  connect(token) {
    this.socket = io(import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001', {
      auth: {
        token
      }
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('WebSocket连接成功');
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket连接断开');
    });

    // 私信相关事件
    this.socket.on('new_private_message', (data) => {
      this.emit('private_message', data);
    });

    this.socket.on('private_message_notification', (data) => {
      this.emit('private_notification', data);
    });

    // 联盟聊天相关事件
    this.socket.on('new_alliance_message', (data) => {
      this.emit('alliance_message', data);
    });

    this.socket.on('alliance_message_notification', (data) => {
      this.emit('alliance_notification', data);
    });

    // 公告相关事件
    this.socket.on('new_announcement', (data) => {
      this.emit('announcement', data);
    });
  }

  // 加入私信房间
  joinPrivateChat(userId: string) {
    this.socket?.emit('join_private_chat', { userId });
  }

  // 加入联盟聊天房间
  joinAllianceChat(allianceId: string) {
    this.socket?.emit('join_alliance_chat', { allianceId });
  }

  // 发送私信
  sendPrivateMessage(receiverId: string, message: any) {
    this.socket?.emit('send_private_message', { receiverId, message });
  }

  // 发送联盟消息
  sendAllianceMessage(allianceId: string, message: any) {
    this.socket?.emit('send_alliance_message', { allianceId, message });
  }

  // 监听事件
  on(event: string, handler: Function) {
    if (!this.messageHandlers.has(event)) {
      this.messageHandlers.set(event, []);
    }
    this.messageHandlers.get(event)!.push(handler);
  }

  // 移除监听器
  off(event: string, handler: Function) {
    const handlers = this.messageHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  // 触发事件
  private emit(event: string, data: any) {
    const handlers = this.messageHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }
}

export const chatWebSocket = new ChatWebSocketService();