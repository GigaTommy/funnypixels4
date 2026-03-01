const { db } = require('../config/database');
const { redis } = require('../config/redis');
const TileCacheService = require('../services/tileCacheService');
const tileRenderQueue = require('../services/tileRenderQueue');

/**
 * 瓦片批量写入Worker
 * 负责将像素变更批量写入数据库，并清除相关瓦片缓存
 */
class TileFlushWorker {
  constructor() {
    this.flushInterval = parseInt(process.env.TILE_BATCH_TIMEOUT) || 500; // 500ms批量刷新
    this.batchSize = parseInt(process.env.TILE_BATCH_SIZE) || 100; // 每批最多100个像素
    this.isRunning = false;
    this.socketManager = null;
    this.stats = {
      totalFlushes: 0,
      totalPixels: 0,
      totalErrors: 0,
      lastFlushTime: null
    };
    
    this.start();
  }
  
  /**
   * 启动Worker
   */
  start() {
    if (this.isRunning) {
      console.warn('⚠️ 瓦片刷新Worker已在运行');
      return;
    }
    
    this.isRunning = true;
    console.log(`🚀 启动瓦片刷新Worker: 间隔${this.flushInterval}ms, 批次大小${this.batchSize}`);
    
    // 立即执行一次刷新
    this.flushAllTiles();
    
    // 设置定时刷新
    this.flushTimer = setInterval(() => {
      this.flushAllTiles();
    }, this.flushInterval);
  }
  
  /**
   * 停止Worker
   */
  stop() {
    if (!this.isRunning) {
      return;
    }
    
    this.isRunning = false;
    
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    
    console.log('🛑 瓦片刷新Worker已停止');
  }
  
  /**
   * 刷新所有瓦片变更
   */
  async flushAllTiles() {
    try {
      // 检查 Redis 是否已初始化
      if (!redis) {
        return;
      }

      // 获取所有待处理的瓦片变更
      const tileKeys = await redis.keys('tile:changes:*');

      if (tileKeys.length === 0) {
        return;
      }
      
      console.log(`🔄 开始刷新瓦片变更: ${tileKeys.length}个瓦片`);
      
      // 并行处理所有瓦片
      const promises = tileKeys.map(tileKey => this.flushTileChanges(tileKey));
      const results = await Promise.allSettled(promises);
      
      // 统计结果
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      this.stats.totalFlushes++;
      this.stats.lastFlushTime = new Date();
      
      if (failed > 0) {
        console.warn(`⚠️ 瓦片刷新完成: 成功${successful}个, 失败${failed}个`);
      } else {
        console.log(`✅ 瓦片刷新完成: 成功${successful}个瓦片`);
      }
      
    } catch (error) {
      console.error('❌ 刷新瓦片变更失败:', error);
      this.stats.totalErrors++;
    }
  }
  
  /**
   * 刷新单个瓦片的变更
   * @param {string} tileKey - 瓦片变更键
   */
  async flushTileChanges(tileKey) {
    try {
      const tileId = tileKey.replace('tile:changes:', '');
      
      // 获取变更数据
      const changes = await redis.lrange(tileKey, 0, -1);
      
      if (changes.length === 0) {
        return;
      }
      
      // 解析变更数据
      const pixelUpdates = changes.map(change => {
        try {
          return JSON.parse(change);
        } catch (error) {
          console.warn('❌ 解析像素变更数据失败:', error, change);
          return null;
        }
      }).filter(Boolean);
      
      if (pixelUpdates.length === 0) {
        // 清除空的变更队列
        await redis.del(tileKey);
        return;
      }
      
      // 批量写入数据库
      await this.batchWritePixels(pixelUpdates);
      
      // 清除变更队列
      await redis.del(tileKey);
      
      // 清除瓦片缓存，强制重新生成
      await TileCacheService.invalidate(tileId);

      const [zoomStr, xStr, yStr] = tileId.split('/');
      const zoom = parseInt(zoomStr, 10);
      const tileX = parseInt(xStr, 10);
      const tileY = parseInt(yStr, 10);

      if (!Number.isNaN(zoom) && !Number.isNaN(tileX) && !Number.isNaN(tileY)) {
        await tileRenderQueue.enqueueTileRender({
          tileId,
          z: zoom,
          x: tileX,
          y: tileY,
          reason: 'pixel-change',
          priority: 2
        });
      }

      this.stats.totalPixels += pixelUpdates.length;

      console.log(`✅ 瓦片变更刷新完成: ${tileId}, ${pixelUpdates.length}个像素`);

      await this.notifyTileSubscribers(tileId, pixelUpdates);

    } catch (error) {
      console.error(`❌ 刷新瓦片变更失败 ${tileKey}:`, error);
      throw error;
    }
  }

  /**
   * 设置SocketManager用于广播瓦片事件
   * @param {Object} socketManager - Socket管理器实例
   */
  setSocketManager(socketManager) {
    this.socketManager = socketManager;
  }

  /**
   * 将瓦片更新通知订阅者
   * @param {string} tileId - 瓦片ID
   * @param {Array} pixelUpdates - 像素变更列表
   */
  async notifyTileSubscribers(tileId, pixelUpdates) {
    if (!this.socketManager || !Array.isArray(pixelUpdates) || pixelUpdates.length === 0) {
      return;
    }

    try {
        const normalizedDiffs = pixelUpdates.map(update => ({
          gridId: update.gridId || update.grid_id,
          latitude: update.latitude,
          longitude: update.longitude,
          color: update.color,
          patternId: update.pattern_id ?? update.patternId ?? null,
          patternAnchorX: update.pattern_anchor_x ?? update.patternAnchorX ?? 0,
          patternAnchorY: update.pattern_anchor_y ?? update.patternAnchorY ?? 0,
          patternRotation: update.pattern_rotation ?? update.patternRotation ?? 0,
          patternMirror: update.pattern_mirror ?? update.patternMirror ?? false,
          userId: update.user_id ?? update.userId ?? null,
          pixelType: update.pixel_type ?? update.pixelType ?? 'basic',
          relatedId: update.related_id ?? update.relatedId ?? null,
          renderType: update.render_type ?? update.renderType ?? null,
          timestamp: update.timestamp || Date.now()
        }));

      await this.socketManager.broadcastTilePixelUpdate(tileId, normalizedDiffs);
    } catch (error) {
      console.error('❌ 通知瓦片订阅者失败:', error);
    }
  }
  
  /**
   * 批量写入像素到数据库
   * @param {Array} pixels - 像素数组
   */
  async batchWritePixels(pixels) {
    if (pixels.length === 0) {
      return;
    }
    
    const trx = await db.transaction();
    
    try {
      // 分批处理，避免单次事务过大
      const batches = this.chunkArray(pixels, this.batchSize);
      
      for (const batch of batches) {
        await this.writePixelBatch(trx, batch);
      }
      
      await trx.commit();
      
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }
  
  /**
   * 写入像素批次
   * @param {Transaction} trx - 数据库事务
   * @param {Array} batch - 像素批次
   */
  async writePixelBatch(trx, batch) {
    for (const pixel of batch) {
      try {
        await trx('pixels')
          .insert({
            grid_id: pixel.grid_id,
            latitude: pixel.latitude,
            longitude: pixel.longitude,
            color: pixel.color,
            pattern_id: pixel.pattern_id,
            pattern_anchor_x: pixel.pattern_anchor_x,
            pattern_anchor_y: pixel.pattern_anchor_y,
            pattern_rotation: pixel.pattern_rotation,
            pattern_mirror: pixel.pattern_mirror,
            user_id: pixel.user_id,
            pixel_type: pixel.pixel_type || 'basic',
            created_at: new Date(),
            updated_at: new Date()
          })
          .onConflict('grid_id')
          .merge({
            color: pixel.color,
            pattern_id: pixel.pattern_id,
            pattern_anchor_x: pixel.pattern_anchor_x,
            pattern_anchor_y: pixel.pattern_anchor_y,
            pattern_rotation: pixel.pattern_rotation,
            pattern_mirror: pixel.pattern_mirror,
            user_id: pixel.user_id,
            pixel_type: pixel.pixel_type || 'basic',
            updated_at: new Date()
          });
          
      } catch (error) {
        console.warn('❌ 写入像素失败:', error, pixel);
        // 继续处理其他像素，不中断整个批次
      }
    }
  }
  
  /**
   * 将数组分块
   * @param {Array} array - 原数组
   * @param {number} chunkSize - 块大小
   * @returns {Array} 分块后的数组
   */
  chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
  
  /**
   * 添加像素变更到队列
   * @param {string} tileId - 瓦片ID
   * @param {Object} pixelData - 像素数据
   */
  async addPixelChange(tileId, pixelData) {
    try {
      // 检查 Redis 是否已初始化
      if (!redis) {
        console.warn('⚠️ Redis 未初始化，跳过像素变更队列');
        return;
      }

      const changeKey = `tile:changes:${tileId}`;
      const changeData = JSON.stringify({
        ...pixelData,
        timestamp: Date.now()
      });

      await redis.lpush(changeKey, changeData);

      // 设置过期时间，防止队列无限增长
      await redis.expire(changeKey, 300); // 5分钟过期

    } catch (error) {
      console.error(`❌ 添加像素变更失败 ${tileId}:`, error);
    }
  }
  
  /**
   * 获取Worker统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      flushInterval: this.flushInterval,
      batchSize: this.batchSize
    };
  }
  
  /**
   * 重置统计信息
   */
  resetStats() {
    this.stats = {
      totalFlushes: 0,
      totalPixels: 0,
      totalErrors: 0,
      lastFlushTime: null
    };
  }
}

// 创建全局Worker实例
const tileFlushWorker = new TileFlushWorker();

// 优雅关闭处理
process.on('SIGINT', () => {
  console.log('🛑 收到SIGINT信号，正在关闭瓦片刷新Worker...');
  tileFlushWorker.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 收到SIGTERM信号，正在关闭瓦片刷新Worker...');
  tileFlushWorker.stop();
  process.exit(0);
});

module.exports = tileFlushWorker;
