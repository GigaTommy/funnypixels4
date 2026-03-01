const { redis } = require('../config/redis');
const CacheService = require('./cacheService');

class SocketManager {
  constructor(io) {
    this.io = io;
    this.connectionStats = {
      totalConnections: 0,
      activeConnections: 0,
      peakConnections: 0
    };

    // 新增：消息队列和批量推送管理
    this.messageQueue = new Map(); // 频道消息队列
    this.batchTimers = new Map(); // 批量推送定时器
    this.BATCH_DELAY = 50; // 50ms批量推送延迟
    this.MAX_BATCH_SIZE = 10; // 最大批量消息数量

    // 新增：连接池管理
    this.connectionPools = new Map(); // 按频道分组的连接池
    this.roomConnections = new Map(); // 房间连接映射

    // 新增：瓦片房间管理
    this.tileRooms = new Map(); // 瓦片房间管理
    this.tileBatchTimers = new Map(); // 瓦片批量合并定时器
    this.TILE_BATCH_DELAY = 50; // 50ms瓦片批量合并延迟

    this.setupEventHandlers();
    this.startPeriodicCleanup();
  }

  setupEventHandlers() {
    this.io.on('connection', socket => {
      this.handleConnection(socket);
    });
  }

  // 处理新连接
  async handleConnection(socket) {
    try {
      this.connectionStats.totalConnections++;
      this.connectionStats.activeConnections++;
      this.connectionStats.peakConnections = Math.max(this.connectionStats.peakConnections, this.connectionStats.activeConnections);
      console.log(`🔌 WebSocket连接: ${socket.id} (活跃连接: ${this.connectionStats.activeConnections})`);

      // 设置连接超时
      socket.conn.on('packet', ({ type, data }) => {
        if (type === 'pong') {
          socket.lastPong = Date.now();
        }
      });

      // 用户认证
      socket.on('authenticate', async data => {
        await this.handleAuthentication(socket, data);
      });

      // 加入房间
      socket.on('joinRoom', roomId => {
        this.joinRoom(socket, roomId);
      });

      // 离开房间
      socket.on('leaveRoom', roomId => {
        this.leaveRoom(socket, roomId);
      });

      // 瓦片订阅事件
      socket.on('join_tile', async data => {
        await this.handleTileSubscription(socket, data);
      });

      socket.on('leave_tile', async data => {
        await this.handleTileUnsubscription(socket, data);
      });

      // 瓦片房间订阅事件
      socket.on('join_tile_room', async data => {
        await this.handleTileRoomSubscription(socket, data);
      });

      socket.on('leave_tile_room', async data => {
        await this.handleTileRoomUnsubscription(socket, data);
      });

      // 像素更新事件
      socket.on('pixel_update', async data => {
        await this.handlePixelUpdate(socket, data);
      });

      // 新增：聊天相关事件
      socket.on('join_chat_room', data => {
        this.joinChatRoom(socket, data);
      });

      socket.on('leave_chat_room', data => {
        this.leaveChatRoom(socket);
      });

      // ⚔️ 赛事活动相关
      socket.on('join_event_room', data => {
        this.joinEventRoom(socket, data);
      });

      socket.on('leave_event_room', data => {
        this.leaveEventRoom(socket, data);
      });

      // 断开连接
      socket.on('disconnect', () => {
        this.handleDisconnection(socket);
      });

    } catch (error) {
      console.error('❌ 处理WebSocket连接失败:', error);
    }
  }

  // 新增：加入聊天房间
  joinChatRoom(socket, data) {
    try {
      const { channelType, channelId } = data;
      const roomId = `chat:${channelType}:${channelId || 'global'}`;

      // 离开之前的聊天房间
      if (socket.currentChatRoom) {
        socket.leave(socket.currentChatRoom);
        this.removeFromConnectionPool(socket.currentChatRoom, socket.id);
      }

      // 加入新房间
      socket.join(roomId);
      socket.currentChatRoom = roomId;

      // 添加到连接池
      this.addToConnectionPool(roomId, socket);

      console.log(`📱 用户加入聊天房间: ${roomId}, Socket: ${socket.id}`);

      // 发送房间信息
      socket.emit('chat_room_joined', {
        roomId,
        channelType,
        channelId,
        userCount: this.getRoomUserCount(roomId)
      });

    } catch (error) {
      console.error('加入聊天房间失败:', error);
    }
  }

  // 新增：离开聊天房间
  leaveChatRoom(socket) {
    try {
      if (socket.currentChatRoom) {
        socket.leave(socket.currentChatRoom);
        this.removeFromConnectionPool(socket.currentChatRoom, socket.id);

        console.log(`📱 用户离开聊天房间: ${socket.currentChatRoom}, Socket: ${socket.id}`);

        socket.currentChatRoom = null;
      }
    } catch (error) {
      console.error('离开聊天房间失败:', error);
    }
  }

  // 新增：添加到连接池
  addToConnectionPool(roomId, socket) {
    if (!this.connectionPools.has(roomId)) {
      this.connectionPools.set(roomId, new Set());
    }

    this.connectionPools.get(roomId).add(socket.id);

    // 记录房间连接映射
    if (!this.roomConnections.has(socket.id)) {
      this.roomConnections.set(socket.id, new Set());
    }
    this.roomConnections.get(socket.id).add(roomId);
  }

  // 新增：从连接池移除
  removeFromConnectionPool(roomId, socketId) {
    if (this.connectionPools.has(roomId)) {
      this.connectionPools.get(roomId).delete(socketId);

      // 如果房间为空，清理房间
      if (this.connectionPools.get(roomId).size === 0) {
        this.connectionPools.delete(roomId);
      }
    }

    // 清理房间连接映射
    if (this.roomConnections.has(socketId)) {
      this.roomConnections.get(socketId).delete(roomId);

      if (this.roomConnections.get(socketId).size === 0) {
        this.roomConnections.delete(socketId);
      }
    }
  }

  // 新增：获取房间用户数量
  getRoomUserCount(roomId) {
    return this.connectionPools.has(roomId) ? this.connectionPools.get(roomId).size : 0;
  }

  // 新增：批量推送聊天消息
  async broadcastChatMessage(channelType, channelId, message, excludeSocketId = null) {
    try {
      const roomId = `chat:${channelType}:${channelId || 'global'}`;

      // 将消息添加到队列
      if (!this.messageQueue.has(roomId)) {
        this.messageQueue.set(roomId, []);
      }

      this.messageQueue.get(roomId).push({
        message,
        timestamp: Date.now(),
        excludeSocketId
      });

      // 启动批量推送定时器
      if (!this.batchTimers.has(roomId)) {
        this.batchTimers.set(roomId, setTimeout(() => {
          this.processMessageBatch(roomId);
        }, this.BATCH_DELAY));
      }

      // 如果队列达到最大批量大小，立即处理
      if (this.messageQueue.get(roomId).length >= this.MAX_BATCH_SIZE) {
        clearTimeout(this.batchTimers.get(roomId));
        this.batchTimers.delete(roomId);
        this.processMessageBatch(roomId);
      }

    } catch (error) {
      console.error('批量推送聊天消息失败:', error);
    }
  }

  // 新增：处理消息批次
  async processMessageBatch(roomId) {
    try {
      if (!this.messageQueue.has(roomId)) return;

      const messages = this.messageQueue.get(roomId);
      if (messages.length === 0) return;

      // 清空队列
      this.messageQueue.set(roomId, []);

      // 清理定时器
      if (this.batchTimers.has(roomId)) {
        clearTimeout(this.batchTimers.get(roomId));
        this.batchTimers.delete(roomId);
      }

      // 批量推送消息
      const batchData = {
        type: 'chat_message_batch',
        messages: messages.map(item => ({
          ...item.message,
          timestamp: item.timestamp
        })),
        batchSize: messages.length,
        roomId
      };

      // 推送到房间
      this.io.to(roomId).emit('chat_message_batch', batchData);

      console.log(`📤 批量推送聊天消息: 房间${roomId}, 消息数量${messages.length}`);

      // 缓存热门消息
      await this.cacheHotMessages(roomId, messages);

    } catch (error) {
      console.error('处理消息批次失败:', error);
    }
  }

  // 新增：缓存热门消息
  async cacheHotMessages(roomId, messages) {
    try {
      const [, channelType, channelId] = roomId.split(':');

      // 获取当前热门消息
      const hotCacheKey = `chat_hot:${channelType}:${channelId || 'global'}`;
      let hotMessages = await CacheService.get(hotCacheKey) || [];

      // 添加新消息到热门列表
      const newMessages = messages.map(item => ({
        ...item.message,
        timestamp: item.timestamp
      }));

      hotMessages = [...newMessages, ...hotMessages].slice(0, 20); // 保留最近20条

      // 更新缓存
      await CacheService.set(hotCacheKey, hotMessages, CacheService.TTL.CHAT_HOT_MESSAGE);

    } catch (error) {
      console.error('缓存热门消息失败:', error);
    }
  }

  // 新增：获取房间统计信息
  getRoomStats() {
    const stats = {};

    for (const [roomId, connections] of this.connectionPools) {
      stats[roomId] = {
        userCount: connections.size,
        connections: Array.from(connections)
      };
    }

    return stats;
  }

  // 新增：定期清理
  startPeriodicCleanup() {
    setInterval(() => {
      this.cleanupInactiveConnections();
    }, 30000); // 每30秒清理一次
  }

  // 新增：清理非活跃连接
  cleanupInactiveConnections() {
    try {
      const now = Date.now();
      let cleanedCount = 0;

      // 检查所有连接的活跃状态
      for (const [socketId, socket] of this.io.sockets.sockets) {
        if (socket.lastPong && (now - socket.lastPong) > 120000) { // 2分钟无响应
          socket.disconnect(true);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        console.log(`🧹 清理非活跃连接: ${cleanedCount}个`);
      }

    } catch (error) {
      console.error('清理非活跃连接失败:', error);
    }
  }

  // 处理瓦片订阅
  async handleTileSubscription(socket, data) {
    try {
      const { tileId, userId } = data;

      if (!tileId || !userId) {
        console.warn('❌ 瓦片订阅数据不完整:', data);
        return;
      }

      // 加入瓦片房间
      const roomId = `tile:${tileId}`;
      socket.join(roomId);

      // 记录用户订阅的瓦片
      if (!socket.subscribedTiles) {
        socket.subscribedTiles = new Set();
      }
      socket.subscribedTiles.add(tileId);

      console.log(`📍 用户订阅瓦片: ${userId} -> ${tileId}`);

      // 发送瓦片数据
      await this.sendTileData(socket, tileId);

    } catch (error) {
      console.error('❌ 处理瓦片订阅失败:', error);
    }
  }

  // 处理瓦片取消订阅
  async handleTileUnsubscription(socket, data) {
    try {
      const { tileId, userId } = data;

      if (!tileId || !userId) {
        console.warn('❌ 瓦片取消订阅数据不完整:', data);
        return;
      }

      // 离开瓦片房间
      const roomId = `tile:${tileId}`;
      socket.leave(roomId);

      // 移除订阅记录
      if (socket.subscribedTiles) {
        socket.subscribedTiles.delete(tileId);
      }

      console.log(`📍 用户取消订阅瓦片: ${userId} -> ${tileId}`);

    } catch (error) {
      console.error('❌ 处理瓦片取消订阅失败:', error);
    }
  }

  // 处理像素更新
  async handlePixelUpdate(socket, data) {
    try {
      const { tileId, pixelData, userId } = data;

      if (!tileId || !pixelData || !userId) {
        console.warn('❌ 像素更新数据不完整:', data);
        return;
      }

      const roomId = `tile:${tileId}`;
      const diffPayload = {
        tileId,
        pixels: Array.isArray(pixelData) ? pixelData : [pixelData],
        timestamp: Date.now()
      };

      this.io.to(roomId).emit('pixel_diff', diffPayload);
      this.emitTileUpdate(tileId, {
        pixelCount: diffPayload.pixels.length,
        userId,
        timestamp: diffPayload.timestamp
      });

      console.log(`🎨 像素更新广播: 瓦片${tileId}, 用户${userId}`);

    } catch (error) {
      console.error('❌ 处理像素更新失败:', error);
    }
  }

  // 发送瓦片数据
  async sendTileData(socket, tileId) {
    try {
      // 从缓存获取瓦片数据
      const tileData = await CacheService.get(`tile:${tileId}`);

      if (tileData) {
        socket.emit('tile_data', {
          tileId,
          data: tileData,
          timestamp: Date.now()
        });
        console.log(`📤 发送瓦片数据: ${tileId}`);
      } else {
        console.log(`⚠️ 瓦片数据未找到: ${tileId}`);
      }

    } catch (error) {
      console.error('❌ 发送瓦片数据失败:', error);
    }
  }

  // 处理瓦片房间订阅
  async handleTileRoomSubscription(socket, data) {
    try {
      const { tileId } = data;

      if (!tileId) {
        console.warn('❌ 瓦片房间订阅数据不完整:', data);
        return;
      }

      const roomId = `tile:${tileId}`;

      // 加入瓦片房间
      socket.join(roomId);

      // 记录房间信息
      if (!this.tileRooms.has(roomId)) {
        this.tileRooms.set(roomId, new Set());
      }
      this.tileRooms.get(roomId).add(socket.id);

      console.log(`📡 用户加入瓦片房间: ${roomId} (连接: ${socket.id})`);

      // 发送当前瓦片数据
      await this.sendTileData(socket, tileId);

    } catch (error) {
      console.error('❌ 处理瓦片房间订阅失败:', error);
    }
  }

  // 处理瓦片房间取消订阅
  async handleTileRoomUnsubscription(socket, data) {
    try {
      const { tileId } = data;

      if (!tileId) {
        console.warn('❌ 瓦片房间取消订阅数据不完整:', data);
        return;
      }

      const roomId = `tile:${tileId}`;

      // 离开瓦片房间
      socket.leave(roomId);

      // 更新房间信息
      if (this.tileRooms.has(roomId)) {
        this.tileRooms.get(roomId).delete(socket.id);
        if (this.tileRooms.get(roomId).size === 0) {
          this.tileRooms.delete(roomId);
        }
      }

      console.log(`📡 用户离开瓦片房间: ${roomId} (连接: ${socket.id})`);

    } catch (error) {
      console.error('❌ 处理瓦片房间取消订阅失败:', error);
    }
  }

  // 瓦片像素更新广播
  async broadcastTilePixelUpdate(tileId, pixelData) {
    try {
      const roomId = `tile:${tileId}`;

      // 检查房间是否存在
      if (!this.tileRooms.has(roomId)) {
        return;
      }

      // 批量合并逻辑
      await this.batchTileUpdate(roomId, pixelData);

    } catch (error) {
      console.error('❌ 瓦片像素更新广播失败:', error);
    }
  }

  // 广播瓦片级事件
  emitTileUpdate(tileId, metadata = {}) {
    const roomId = `tile:${tileId}`;

    if (!this.tileRooms.has(roomId)) {
      return;
    }

    const payload = {
      tileId,
      timestamp: metadata.timestamp || Date.now(),
      pixelCount: metadata.pixelCount ?? 0,
      userId: metadata.userId || null
    };

    this.io.to(roomId).emit('tile_updated', payload);
  }

  // 瓦片更新批量合并
  async batchTileUpdate(roomId, pixelData) {
    const batchKey = `${roomId}:batch`;

    // 添加到批量队列
    if (!this.tileBatchTimers.has(batchKey)) {
      this.tileBatchTimers.set(batchKey, []);
    }

    const queue = this.tileBatchTimers.get(batchKey);
    if (Array.isArray(pixelData)) {
      queue.push(...pixelData);
    } else {
      queue.push(pixelData);
    }

    // 设置批量发送定时器
    if (!this.tileBatchTimers.has(`${batchKey}:timer`)) {
      this.tileBatchTimers.set(`${batchKey}:timer`, setTimeout(() => {
        this.flushTileBatch(roomId);
      }, this.TILE_BATCH_DELAY));
    }
  }

  // 刷新瓦片批量更新
  async flushTileBatch(roomId) {
    const batchKey = `${roomId}:batch`;
    const timerKey = `${batchKey}:timer`;

    const batch = this.tileBatchTimers.get(batchKey) || [];
    if (batch.length === 0) return;

    // 发送批量更新
    const tileId = roomId.replace('tile:', '');
    const timestamp = Date.now();

    this.io.to(roomId).emit('pixel_diff', {
      tileId,
      pixels: batch,
      timestamp
    });

    this.emitTileUpdate(tileId, {
      pixelCount: batch.length,
      timestamp
    });

    // 清理批量数据
    this.tileBatchTimers.delete(batchKey);
    this.tileBatchTimers.delete(timerKey);

    console.log(`📡 瓦片批量更新发送: ${roomId}, ${batch.length}个像素`);
  }

  // 处理用户认证
  async handleAuthentication(socket, data) {
    try {
      const { userId, username } = data;

      if (!userId || !username) {
        console.warn('❌ 认证数据不完整:', data);
        return;
      }

      // 存储用户信息到socket
      socket.userId = userId;
      socket.username = username;
      socket.authenticated = true;

      // 加入用户专属房间（用于定向推送）
      socket.join(`user:${userId}`);

      console.log(`✅ 用户认证成功: ${username} (${userId})`);

      // 发送认证成功响应
      socket.emit('authenticated', {
        success: true,
        userId,
        username
      });

    } catch (error) {
      console.error('❌ 用户认证失败:', error);
      socket.emit('authenticated', {
        success: false,
        error: '认证失败'
      });
    }
  }

  // 加入房间
  joinRoom(socket, roomId) {
    try {
      socket.join(roomId);
      console.log(`🔗 Socket ${socket.id} 加入房间: ${roomId}`);

      // 发送房间信息
      socket.emit('room_joined', {
        roomId,
        userCount: this.io.sockets.adapter.rooms.get(roomId)?.size || 0
      });

    } catch (error) {
      console.error('❌ 加入房间失败:', error);
    }
  }

  // 离开房间
  leaveRoom(socket, roomId) {
    try {
      socket.leave(roomId);
      console.log(`🔗 Socket ${socket.id} 离开房间: ${roomId}`);

      // 发送房间信息
      socket.emit('room_left', {
        roomId,
        userCount: this.io.sockets.adapter.rooms.get(roomId)?.size || 0
      });

    } catch (error) {
      console.error('❌ 离开房间失败:', error);
    }
  }

  // 处理断开连接
  handleDisconnection(socket) {
    try {
      this.connectionStats.activeConnections--;

      // 清理聊天房间
      if (socket.currentChatRoom) {
        this.leaveChatRoom(socket);
      }

      // 清理瓦片订阅
      if (socket.subscribedTiles) {
        for (const tileId of socket.subscribedTiles) {
          const roomId = `tile:${tileId}`;
          socket.leave(roomId);
        }
        socket.subscribedTiles.clear();
      }

      console.log(`🔌 WebSocket断开连接: ${socket.id} (活跃连接: ${this.connectionStats.activeConnections})`);

    } catch (error) {
      console.error('❌ 处理断开连接失败:', error);
    }
  }

  // 获取连接统计
  getConnectionStats() {
    return {
      ...this.connectionStats,
      roomStats: this.getRoomStats(),
      messageQueueSize: Array.from(this.messageQueue.values()).reduce((sum, queue) => sum + queue.length, 0)
    };
  }

  // MARK: - 赛事活动 (Events)

  joinEventRoom(socket, data) {
    try {
      const { eventId } = data;
      if (!eventId) return;

      const roomId = `event:${eventId}`;
      socket.join(roomId);
      console.log(`⚔️ Socket ${socket.id} 加入赛事房间: ${roomId}`);

      socket.emit('event_room_joined', { eventId, roomId });
    } catch (error) {
      console.error('加入赛事房间失败:', error);
    }
  }

  leaveEventRoom(socket, data) {
    try {
      const { eventId } = data;
      if (!eventId) return;

      const roomId = `event:${eventId}`;
      socket.leave(roomId);
      console.log(`⚔️ Socket ${socket.id} 离开赛事房间: ${roomId}`);
    } catch (error) {
      console.error('离开赛事房间失败:', error);
    }
  }

  /**
   * 广播赛事数据更新
   * @param {string} eventId 
   */
  async broadcastEventUpdate(eventId) {
    try {
      const eventService = require('./eventService');
      const battleData = await eventService.processEventScores(eventId);

      if (battleData) {
        const roomId = `event:${eventId}`;
        this.io.to(roomId).emit('battle_update', battleData);
        console.log(`📤 广播赛事战况: 房间${roomId}, 联盟数量${battleData.alliances.length}`);
      }
    } catch (error) {
      console.error('广播赛事展示更新失败:', error);
    }
  }

  /**
   * 广播联盟信息更新
   * @param {string} allianceId 
   * @param {object} updateData - 更新的数据
   */
  async broadcastAllianceUpdate(allianceId, updateData) {
    try {
      // 广播给所有在线用户（他们会检查是否是自己的联盟）
      this.io.emit('alliance:updated', {
        allianceId,
        updateData,
        timestamp: Date.now()
      });

      console.log(`📤 广播联盟更新: ${allianceId}, 字段: ${Object.keys(updateData).join(', ')}`);
    } catch (error) {
      console.error('广播联盟更新失败:', error);
    }
  }

  /**
   * 向指定用户推送事件（基于 user:{userId} 房间）
   */
  sendToUser(userId, eventName, data) {
    try {
      this.io.to(`user:${userId}`).emit(eventName, data);
    } catch (error) {
      console.error(`❌ 推送给用户 ${userId} 失败:`, error);
    }
  }

  /**
   * 推送漂流瓶遭遇给特定用户
   */
  broadcastBottleNearby(userId, bottleData) {
    this.sendToUser(userId, 'bottle_nearby', bottleData);
  }

  /**
   * 推送漂流瓶沉没事件给所有参与者
   */
  broadcastBottleSunk(participantIds, journeyCardData) {
    for (const participantId of participantIds) {
      this.sendToUser(participantId, 'bottle_sunk', journeyCardData);
    }
  }
}

module.exports = SocketManager;
