import { io } from 'socket.io-client';
import { logger } from '../utils/logger';

// 图案相关类型
export interface PatternEvent {
  type: 'pt'; // pattern application
  gridId: string;
  patternId: string;
  anchorX: number;
  anchorY: number;
  rotation: number;
  mirror: boolean;
  userId: string;
  username: string;
  timestamp: number;
}

export interface PixelEvent {
  type: 'px'; // pixel update
  gridId: string;
  patternId: string;
  userId: string;
  username: string;
  timestamp: number;
}

export interface BombEvent {
  type: 'bomb';
  gridId: string;
  radius: number;
  userId: string;
  username: string;
  timestamp: number;
}

export interface AdEvent {
  type: 'ad_activate' | 'ad_deactivate';
  gridId: string;
  adId: string;
  userId: string;
  timestamp: number;
}

export type WebSocketEvent = PatternEvent | PixelEvent | BombEvent | AdEvent;

// 配置 Socket.IO 客户端连接
const socketUrl = import.meta.env.VITE_WS_URL;

const socket = io(socketUrl, {
  path: '/socket.io',
  transports: ['polling'], // 强制只使用 HTTP polling
  upgrade: false, // 禁用升级到 WebSocket
  rememberUpgrade: false, // 不记住升级
  forceNew: true, // 强制新连接，避免复用缓存的连接
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 20000
});

// 连接事件监听
socket.on('connect', () => {
  logger.info('WebSocket 连接成功');
});

socket.on('disconnect', () => {
  logger.info('WebSocket 连接断开');
});

socket.on('connect_error', (error) => {
  logger.error('WebSocket 连接错误:', error);
});

// 图案事件监听
socket.on('pt', (data: PatternEvent) => {
  logger.info('收到图案应用事件:', data);
  // 触发自定义事件，供其他组件监听
  window.dispatchEvent(new CustomEvent('pattern-applied', { detail: data }));
});

// 像素事件监听
socket.on('px', (data: PixelEvent) => {
  logger.info('收到像素更新事件:', data);
  window.dispatchEvent(new CustomEvent('pixel-updated', { detail: data }));
});

// 全局像素更新事件监听（后端广播）
socket.on('pixelUpdate', (data: any) => {
  logger.info('收到全局像素更新事件:', data);
  window.dispatchEvent(new CustomEvent('pixel-updated', { detail: data }));
});

// 瓦片失效事件监听
socket.on('tileInvalidate', (data: any) => {
  logger.info('收到瓦片失效事件:', data);
  window.dispatchEvent(new CustomEvent('tileInvalidate', { detail: data }));
});



// 炸弹事件监听
socket.on('bomb', (data: BombEvent) => {
  logger.info('收到炸弹事件:', data);
  window.dispatchEvent(new CustomEvent('bomb-exploded', { detail: data }));
});

// 广告事件监听
socket.on('ad_activate', (data: AdEvent) => {
  logger.info('收到广告激活事件:', data);
  window.dispatchEvent(new CustomEvent('ad-activated', { detail: data }));
});

socket.on('ad_deactivate', (data: AdEvent) => {
  logger.info('收到广告停用事件:', data);
  window.dispatchEvent(new CustomEvent('ad-deactivated', { detail: data }));
});

// WebSocket 工具函数
export const socketUtils = {
  // 加入房间
  joinRoom: (roomId: string) => {
    socket.emit('join', { room: roomId });
  },

  // 离开房间
  leaveRoom: (roomId: string) => {
    socket.emit('leave', { room: roomId });
  },

  // 发送图案应用事件
  sendPatternEvent: (data: Omit<PatternEvent, 'type' | 'timestamp'>) => {
    socket.emit('pt', {
      ...data,
      timestamp: Date.now()
    });
  },

  // 发送像素更新事件
  sendPixelEvent: (data: Omit<PixelEvent, 'type' | 'timestamp'>) => {
    socket.emit('px', {
      ...data,
      timestamp: Date.now()
    });
  },

  // 发送炸弹事件
  sendBombEvent: (data: Omit<BombEvent, 'type' | 'timestamp'>) => {
    socket.emit('bomb', {
      ...data,
      timestamp: Date.now()
    });
  },

  // 发送广告事件
  sendAdEvent: (eventType: string, data: Omit<AdEvent, 'type' | 'timestamp'>) => {
    socket.emit(eventType, {
      ...data,
      timestamp: Date.now()
    });
  }
};

export default socket;
