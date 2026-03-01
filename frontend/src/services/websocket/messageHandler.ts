import { ChatMessage, SendMessageData } from '../chat';
import { chatWebSocket } from './chatWebSocket';
import { logger } from '../../utils/logger';

// 消息处理器类型定义
export interface MessageProcessor {
  type: string;
  process: (message: ChatMessage) => ChatMessage;
}

// 位置消息数据
export interface LocationMessageData {
  lat: number;
  lng: number;
  gridId: string;
  address?: string;
  thumbnailUrl?: string;
  zoom?: number;
}

// 图片消息数据
export interface ImageMessageData {
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  size?: number;
  fileName?: string;
}

// 系统消息数据
export interface SystemMessageData {
  type: 'join' | 'leave' | 'announcement' | 'alliance_activity' | 'moderation';
  content: string;
  metadata?: Record<string, any>;
}

// 消息处理器管理类
export class MessageHandler {
  private processors: Map<string, MessageProcessor> = new Map();
  private messageQueue: ChatMessage[] = [];
  private isProcessing = false;
  private eventListeners: Map<string, Set<Function>> = new Map();

  constructor() {
    this.setupDefaultProcessors();
    this.setupWebSocketListeners();
  }

  // 设置默认消息处理器
  private setupDefaultProcessors(): void {
    // 文本消息处理器
    this.registerProcessor({
      type: 'text',
      process: (message: ChatMessage) => {
        // 处理@提及
        message.content = this.processMentions(message.content);
        // 处理链接
        message.content = this.processLinks(message.content);
        return message;
      },
    });

    // 表情消息处理器
    this.registerProcessor({
      type: 'emoji',
      process: (message: ChatMessage) => {
        // 确保表情格式正确
        message.content = this.validateEmoji(message.content);
        return message;
      },
    });

    // 位置消息处理器
    this.registerProcessor({
      type: 'location',
      process: (message: ChatMessage) => {
        const locationData = message.metadata as LocationMessageData;
        if (locationData) {
          // 生成缩略图URL
          if (!locationData.thumbnailUrl) {
            locationData.thumbnailUrl = this.generateMapThumbnail(
              locationData.lat,
              locationData.lng,
              locationData.zoom || 15
            );
          }

          // 格式化位置描述
          if (!message.content && locationData.address) {
            message.content = `📍 ${locationData.address}`;
          } else if (!message.content) {
            message.content = `📍 位置 (${locationData.lat.toFixed(6)}, ${locationData.lng.toFixed(6)})`;
          }
        }
        return message;
      },
    });

    // 图片消息处理器
    this.registerProcessor({
      type: 'image',
      process: (message: ChatMessage) => {
        const imageData = message.metadata as ImageMessageData;
        if (imageData) {
          // 生成缩略图
          if (!imageData.thumbnailUrl) {
            imageData.thumbnailUrl = this.generateImageThumbnail(imageData.url);
          }

          // 设置默认描述
          if (!message.content) {
            message.content = '📸 图片';
          }
        }
        return message;
      },
    });

    // 系统消息处理器
    this.registerProcessor({
      type: 'system',
      process: (message: ChatMessage) => {
        message.is_system_message = true;
        const systemData = message.metadata as SystemMessageData;

        if (systemData) {
          // 根据系统消息类型设置样式
          switch (systemData.type) {
            case 'join':
              message.content = `🟢 ${message.sender_name} 加入了聊天室`;
              break;
            case 'leave':
              message.content = `🔴 ${message.sender_name} 离开了聊天室`;
              break;
            case 'announcement':
              message.content = `📢 ${systemData.content}`;
              break;
            case 'alliance_activity':
              message.content = `🏰 ${systemData.content}`;
              break;
            case 'moderation':
              message.content = `⚠️ ${systemData.content}`;
              break;
          }
        }

        return message;
      },
    });
  }

  // 设置WebSocket事件监听
  private setupWebSocketListeners(): void {
    chatWebSocket.on('new_message', (message: ChatMessage) => {
      this.handleIncomingMessage(message);
    });
  }

  // 处理收到的消息
  private async handleIncomingMessage(message: ChatMessage): Promise<void> {
    try {
      // 处理消息
      const processedMessage = await this.processMessage(message);

      // 触发消息接收事件
      this.emit('message_received', processedMessage);

      // 检查是否需要特殊处理
      await this.handleSpecialMessage(processedMessage);

    } catch (error) {
      logger.error('Error handling incoming message:', error);
      this.emit('message_error', { message, error });
    }
  }

  // 处理消息
  public async processMessage(message: ChatMessage): Promise<ChatMessage> {
    const processor = this.processors.get(message.message_type);
    if (processor) {
      return processor.process(message);
    }
    return message;
  }

  // 发送消息
  public async sendMessage(data: SendMessageData): Promise<void> {
    try {
      // 预处理消息数据
      const processedData = await this.preprocessMessageData(data);

      // 发送到服务器
      chatWebSocket.sendMessage(processedData);

      // 触发消息发送事件
      this.emit('message_sent', processedData);

    } catch (error) {
      logger.error('Error sending message:', error);
      this.emit('send_error', { data, error });
    }
  }

  // 预处理消息数据
  private async preprocessMessageData(data: SendMessageData): Promise<SendMessageData> {
    const processedData = { ...data };

    // 根据消息类型进行预处理
    switch (data.messageType) {
      case 'text':
        // 文本消息过滤和验证
        processedData.content = this.sanitizeText(data.content);
        break;

      case 'location':
        // 位置消息验证
        if (!data.metadata || !this.validateLocationData(data.metadata)) {
          throw new Error('Invalid location data');
        }
        break;

      case 'image':
        // 图片消息验证
        if (!data.metadata || !this.validateImageData(data.metadata)) {
          throw new Error('Invalid image data');
        }
        break;
    }

    return processedData;
  }

  // 处理特殊消息
  private async handleSpecialMessage(message: ChatMessage): Promise<void> {
    // 位置消息特殊处理
    if (message.message_type === 'location') {
      this.emit('location_message', message);
    }

    // 系统消息特殊处理
    if (message.is_system_message) {
      this.emit('system_message', message);
    }

    // @提及处理
    if (this.containsMention(message.content)) {
      this.emit('mention_received', message);
    }
  }

  // 注册消息处理器
  public registerProcessor(processor: MessageProcessor): void {
    this.processors.set(processor.type, processor);
  }

  // 移除消息处理器
  public unregisterProcessor(type: string): void {
    this.processors.delete(type);
  }

  // 创建位置消息
  public createLocationMessage(
    lat: number,
    lng: number,
    gridId: string,
    address?: string
  ): Pick<SendMessageData, 'messageType' | 'content' | 'metadata'> {
    return {
      messageType: 'location',
      content: address ? `📍 ${address}` : '📍 位置分享',
      metadata: {
        lat,
        lng,
        gridId,
        address,
        zoom: 15,
      },
    };
  }

  // 创建图片消息
  public createImageMessage(
    imageUrl: string,
    fileName?: string
  ): Pick<SendMessageData, 'messageType' | 'content' | 'metadata'> {
    return {
      messageType: 'image',
      content: '📸 图片',
      metadata: {
        url: imageUrl,
        fileName,
      },
    };
  }

  // 工具方法：处理@提及
  private processMentions(content: string): string {
    return content.replace(/@(\w+)/g, '<span class="mention">@$1</span>');
  }

  // 工具方法：处理链接
  private processLinks(content: string): string {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return content.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  }

  // 工具方法：验证表情
  private validateEmoji(content: string): string {
    // 简单的表情验证，可以扩展
    return content.trim();
  }

  // 工具方法：生成地图缩略图
  private generateMapThumbnail(lat: number, lng: number, zoom: number): string {
    // 这里应该调用地图服务生成缩略图
    // 暂时返回静态地图API URL
    return `https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/${lng},${lat},${zoom}/300x200?access_token=your_token`;
  }

  // 工具方法：生成图片缩略图
  private generateImageThumbnail(imageUrl: string): string {
    // 这里应该调用图片处理服务生成缩略图
    // 暂时返回原图URL
    return imageUrl;
  }

  // 工具方法：清理文本
  private sanitizeText(text: string): string {
    return text.trim().substring(0, 1000); // 限制长度
  }

  // 工具方法：验证位置数据
  private validateLocationData(metadata: any): boolean {
    return (
      typeof metadata.lat === 'number' &&
      typeof metadata.lng === 'number' &&
      typeof metadata.gridId === 'string' &&
      metadata.lat >= -90 &&
      metadata.lat <= 90 &&
      metadata.lng >= -180 &&
      metadata.lng <= 180
    );
  }

  // 工具方法：验证图片数据
  private validateImageData(metadata: any): boolean {
    return typeof metadata.url === 'string' && metadata.url.length > 0;
  }

  // 工具方法：检查是否包含@提及
  private containsMention(content: string): boolean {
    return /@\w+/.test(content);
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
          logger.error('Error in message handler event listener:', error);
        }
      });
    }
  }

  // 清理资源
  public destroy(): void {
    this.processors.clear();
    this.messageQueue = [];
    this.eventListeners.clear();
    this.isProcessing = false;
  }
}

// 创建全局实例
export const messageHandler = new MessageHandler();

// 导出默认实例
export default messageHandler;