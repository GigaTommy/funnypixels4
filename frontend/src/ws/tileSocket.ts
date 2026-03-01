/**
 * 瓦片Socket管理器
 * 负责瓦片房间的订阅管理、像素更新处理、性能优化
 */

import socket from '../services/socket';
import { logger } from '../utils/logger';

export interface PixelDiffEvent {
  tileId: string;
  pixels: any[];
  timestamp: number;
}

export interface TileData {
  tileId: string;
  pixels: any[];
  timestamp: number;
}

export interface TileUpdateEvent {
  tileId: string;
  pixelCount: number;
  timestamp: number;
  userId?: string | null;
}

export interface TileRenderedEvent {
  tileId: string;
  version?: string | number;
  renderedAt: number;
}

export class TileSocketManager {
  private socket: any;
  private tileRooms: Set<string> = new Set();
  private pendingUpdates: Map<string, any[]> = new Map();
  private renderTimer: number | null = null;
  private isConnected = false;
  
  // 性能监控
  private performanceMetrics = {
    tilesSubscribed: 0,
    pixelsReceived: 0,
    updatesProcessed: 0,
    lastUpdateTime: 0
  };
  
  // 事件回调
  private onTileDataCallback?: (data: TileData) => void;
  private onPixelDiffCallback?: (data: PixelDiffEvent) => void;
  private onTileUpdateCallback?: (data: TileUpdateEvent) => void;
  private onTileRenderedCallback?: (data: TileRenderedEvent) => void;
  
  constructor() {
    this.socket = socket;
    this.setupEventHandlers();
  }
  
  /**
   * 设置事件处理器
   */
  private setupEventHandlers() {
    // 连接状态监听
    this.socket.on('connect', () => {
      this.isConnected = true;
      logger.debug('📡 瓦片Socket连接已建立');
    });
    
    this.socket.on('disconnect', () => {
      this.isConnected = false;
      logger.debug('📡 瓦片Socket连接已断开');
    });
    
    // 瓦片数据接收
    this.socket.on('tile_data', (data: TileData) => {
      this.handleTileData(data);
    });
    
    // 瓦片像素diff
    this.socket.on('pixel_diff', (data: PixelDiffEvent) => {
      this.handlePixelDiff(data);
    });

    // 瓦片级事件
    this.socket.on('tile_updated', (data: TileUpdateEvent) => {
      this.handleTileUpdated(data);
    });

    this.socket.on('tile_rendered', (data: TileRenderedEvent) => {
      this.handleTileRendered(data);
    });
    
    // 错误处理
    this.socket.on('error', (error: any) => {
      logger.error('❌ 瓦片Socket错误:', error);
    });
  }
  
  /**
   * 加入瓦片房间
   * @param tileId - 瓦片ID
   */
  joinTileRoom(tileId: string) {
    if (this.tileRooms.has(tileId)) {
      logger.debug(`📡 已在瓦片房间: ${tileId}`);
      return;
    }
    
    if (!this.isConnected) {
      logger.warn('⚠️ Socket未连接，无法加入瓦片房间');
      return;
    }
    
    this.socket.emit('join_tile_room', { tileId });
    this.tileRooms.add(tileId);
    this.performanceMetrics.tilesSubscribed++;
    
    logger.debug(`📡 加入瓦片房间: ${tileId}`);
  }
  
  /**
   * 离开瓦片房间
   * @param tileId - 瓦片ID
   */
  leaveTileRoom(tileId: string) {
    if (!this.tileRooms.has(tileId)) {
      logger.debug(`📡 不在瓦片房间: ${tileId}`);
      return;
    }
    
    if (!this.isConnected) {
      logger.warn('⚠️ Socket未连接，无法离开瓦片房间');
      return;
    }
    
    this.socket.emit('leave_tile_room', { tileId });
    this.tileRooms.delete(tileId);
    this.performanceMetrics.tilesSubscribed--;
    
    // 清除该瓦片的待处理更新
    this.pendingUpdates.delete(tileId);
    
    logger.debug(`📡 离开瓦片房间: ${tileId}`);
  }
  
  /**
   * 批量加入瓦片房间
   * @param tileIds - 瓦片ID数组
   */
  joinTileRooms(tileIds: string[]) {
    tileIds.forEach(tileId => {
      this.joinTileRoom(tileId);
    });
  }
  
  /**
   * 批量离开瓦片房间
   * @param tileIds - 瓦片ID数组
   */
  leaveTileRooms(tileIds: string[]) {
    tileIds.forEach(tileId => {
      this.leaveTileRoom(tileId);
    });
  }
  
  /**
   * 更新瓦片订阅（智能切换）
   * @param newTiles - 新的瓦片列表
   */
  updateTileSubscription(newTiles: string[]) {
    const newTileSet = new Set(newTiles);
    const currentTiles = Array.from(this.tileRooms);
    
    // 找出需要离开的房间
    const tilesToLeave = currentTiles.filter(tile => !newTileSet.has(tile));
    
    // 找出需要加入的房间
    const tilesToJoin = newTiles.filter(tile => !this.tileRooms.has(tile));
    
    // 批量操作
    if (tilesToLeave.length > 0) {
      this.leaveTileRooms(tilesToLeave);
    }
    
    if (tilesToJoin.length > 0) {
      this.joinTileRooms(tilesToJoin);
    }
    
    logger.debug(`📡 瓦片订阅更新: 离开${tilesToLeave.length}个, 加入${tilesToJoin.length}个`);
  }
  
  /**
   * 处理瓦片数据
   * @param data - 瓦片数据
   */
  private handleTileData(data: TileData) {
    try {
      const { tileId, pixels } = data;
      
      // 添加到待处理队列
      if (!this.pendingUpdates.has(tileId)) {
        this.pendingUpdates.set(tileId, []);
      }
      
      this.pendingUpdates.get(tileId)!.push(...pixels);
      this.performanceMetrics.pixelsReceived += pixels.length;
      
      // 触发渲染
      this.scheduleRender();
      
      // 触发回调
      if (this.onTileDataCallback) {
        this.onTileDataCallback(data);
      }
      
    } catch (error) {
      logger.error('❌ 处理瓦片数据失败:', error);
    }
  }
  
  /**
   * 处理瓦片像素更新
   * @param data - 像素更新数据
   */
  private handlePixelDiff(data: PixelDiffEvent) {
    try {
      const { tileId, pixels } = data;
      
      // 添加到待处理队列
      if (!this.pendingUpdates.has(tileId)) {
        this.pendingUpdates.set(tileId, []);
      }
      
      this.pendingUpdates.get(tileId)!.push(...pixels);
      this.performanceMetrics.pixelsReceived += pixels.length;
      
      // 触发渲染
      this.scheduleRender();
      
      // 触发回调
      if (this.onPixelDiffCallback) {
        this.onPixelDiffCallback(data);
      }
      
    } catch (error) {
      logger.error('❌ 处理瓦片像素diff失败:', error);
    }
  }

  /**
   * 处理瓦片级事件
   * @param data - 瓦片事件数据
   */
  private handleTileUpdated(data: TileUpdateEvent) {
    try {
      if (this.onTileUpdateCallback) {
        this.onTileUpdateCallback(data);
      }

      const event = new CustomEvent('tileUpdated', {
        detail: data
      });
      window.dispatchEvent(event);
    } catch (error) {
      logger.error('❌ 处理瓦片级事件失败:', error);
    }
  }

  private handleTileRendered(data: TileRenderedEvent) {
    try {
      if (this.onTileRenderedCallback) {
        this.onTileRenderedCallback(data);
      }

      const event = new CustomEvent('tileRendered', { detail: data });
      window.dispatchEvent(event);
    } catch (error) {
      logger.error('❌ 处理瓦片渲染事件失败:', error);
    }
  }
  
  /**
   * 安排渲染
   */
  private scheduleRender() {
    if (this.renderTimer) return;
    
    this.renderTimer = requestAnimationFrame(() => {
      this.flushPendingUpdates();
      this.renderTimer = null;
    });
  }
  
  /**
   * 刷新待处理更新
   */
  private flushPendingUpdates() {
    const updatesToProcess = new Map(this.pendingUpdates);
    
    for (const [tileId, updates] of updatesToProcess) {
      if (updates.length > 0) {
        // 触发Canvas渲染
        this.triggerCanvasRender(tileId, updates);
        
        // 清空已处理的更新
        this.pendingUpdates.set(tileId, []);
        this.performanceMetrics.updatesProcessed++;
      }
    }
    
    this.performanceMetrics.lastUpdateTime = Date.now();
  }
  
  /**
   * 触发Canvas渲染
   * @param tileId - 瓦片ID
   * @param pixels - 像素数组
   */
  private triggerCanvasRender(tileId: string, pixels: any[]) {
    // 这里应该触发Canvas图层的增量渲染
    // 具体实现将在CanvasLayer增量绘制部分完成
    logger.debug(`🎨 渲染瓦片 ${tileId}: ${pixels.length}个像素`);
    
    // 触发自定义事件，供其他组件监听
    const event = new CustomEvent('tilePixelUpdate', {
      detail: { tileId, pixels }
    });
    window.dispatchEvent(event);
  }
  
  /**
   * 设置瓦片数据回调
   * @param callback - 回调函数
   */
  setTileDataCallback(callback?: (data: TileData) => void) {
    this.onTileDataCallback = callback;
  }
  
  /**
   * 设置像素更新回调
   * @param callback - 回调函数
   */
  setPixelDiffCallback(callback?: (data: PixelDiffEvent) => void) {
    this.onPixelDiffCallback = callback;
  }

  /**
   * 设置瓦片级事件回调
   * @param callback - 回调函数
   */
  setTileUpdateCallback(callback?: (data: TileUpdateEvent) => void) {
    this.onTileUpdateCallback = callback;
  }

  /**
   * 设置瓦片渲染完成回调
   */
  setTileRenderedCallback(callback?: (data: TileRenderedEvent) => void) {
    this.onTileRenderedCallback = callback;
  }
  
  /**
   * 获取当前订阅的瓦片房间
   * @returns 瓦片房间数组
   */
  getSubscribedTiles(): string[] {
    return Array.from(this.tileRooms);
  }
  
  /**
   * 获取性能指标
   * @returns 性能指标
   */
  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      subscribedTiles: this.tileRooms.size,
      pendingUpdates: Array.from(this.pendingUpdates.entries()).reduce(
        (total, [_, updates]) => total + updates.length, 0
      )
    };
  }
  
  /**
   * 重置性能指标
   */
  resetPerformanceMetrics() {
    this.performanceMetrics = {
      tilesSubscribed: 0,
      pixelsReceived: 0,
      updatesProcessed: 0,
      lastUpdateTime: 0
    };
  }
  
  /**
   * 检查是否已连接
   * @returns 是否已连接
   */
  isSocketConnected(): boolean {
    return this.isConnected;
  }
  
  /**
   * 强制重连
   */
  reconnect() {
    if (this.socket && typeof this.socket.connect === 'function') {
      this.socket.connect();
    }
  }
  
  /**
   * 断开连接
   */
  disconnect() {
    if (this.socket && typeof this.socket.disconnect === 'function') {
      this.socket.disconnect();
    }
  }
  
  /**
   * 清理资源
   */
  destroy() {
    // 离开所有瓦片房间
    const tilesToLeave = Array.from(this.tileRooms);
    this.leaveTileRooms(tilesToLeave);
    
    // 清除待处理更新
    this.pendingUpdates.clear();
    
    // 清除回调
    this.onTileDataCallback = undefined;
    this.onPixelDiffCallback = undefined;
    
    // 清除渲染定时器
    if (this.renderTimer) {
      cancelAnimationFrame(this.renderTimer);
      this.renderTimer = null;
    }
    
    logger.debug('🧹 瓦片Socket管理器已清理');
  }
}

// 创建全局实例
const tileSocketManager = new TileSocketManager();

export default tileSocketManager;
