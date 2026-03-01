const { db } = require('../config/database');
const CacheService = require('./cacheService');
const TileCacheService = require('./tileCacheService');
// 注意：已移除tileRenderQueue - Canvas 2D瓦片渲染系统已被废弃
const pixelsHistoryService = require('./pixelsHistoryService');
const TileUtils = require('../utils/tileUtils');
const tileChangeQueueService = require('./tileChangeQueueService');
const productionMVTService = require('./productionMVTService');
const { normalizePixelWritePayload, DEFAULT_COLOR } = require('../utils/pixelPayload');

class PixelBatchService {
  constructor(socketManager = null) {
    this.batchQueue = [];
    this.batchSize = 500; // Increased batch size for high-concurrency (was 100)
    this.flushInterval = 100; // Reduced interval for faster processing (was 1000ms)
    this.isProcessing = false;
    this.socketManager = socketManager; // WebSocket管理器

    this.startBatchProcessor();

    // 记录最近创建的实例，供静态方法在需要时访问
    PixelBatchService.instance = this;
  }

  // 添加像素到批量队列（支持完整数据和历史记录）
  async addToBatch(pixelData, historyData = null, cacheUpdates = null) {
    const { latitude, longitude, color, userId } = pixelData;
    const gridId = pixelData.gridId ?? PixelBatchService.calculateGridId(latitude, longitude);

    if (!gridId || !Number.isFinite(latitude) || !Number.isFinite(longitude) || !color || !userId) {
      throw new Error('像素数据不完整');
    }

    // 构造完整的批量处理项
    const batchItem = {
      gridId,
      latitude,
      longitude,
      color,
      userId,
      drawType: pixelData.drawType || 'batch',
      timestamp: Date.now(),
      // 添加完整像素数据
      pixelData: {
        grid_id: gridId,
        latitude: latitude,
        longitude: longitude,
        color: pixelData.color || color,
        pattern_id: pixelData.patternId || null,
        pattern_anchor_x: pixelData.anchorX || 0,
        pattern_anchor_y: pixelData.anchorY || 0,
        pattern_rotation: pixelData.rotation || 0,
        pattern_mirror: pixelData.mirror || false,
        user_id: userId,
        pixel_type: pixelData.pixelType || 'basic',
        related_id: pixelData.relatedId || null,
        session_id: pixelData.sessionId || null,
        alliance_id: pixelData.allianceId || null,
        created_at: new Date(),
        updated_at: new Date()
      },
      // 添加历史数据
      historyData: historyData,
      // 添加缓存更新数据
      cacheUpdates: cacheUpdates
    };

    this.batchQueue.push(batchItem);

    // 如果队列达到批量大小，立即处理
    if (this.batchQueue.length >= this.batchSize) {
      await this.processBatch();
    }

    return { success: true, queued: true, queueSize: this.batchQueue.length };
  }

  // 处理批量队列（支持完整数据和历史记录）
  async processBatch() {
    if (this.isProcessing || this.batchQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const startTime = Date.now();

    try {
      // 取出当前批次
      const batch = this.batchQueue.splice(0, this.batchSize);

      if (batch.length === 0) {
        return;
      }

      console.log(`🔄 开始处理批量像素: ${batch.length} 个`);

      // 提取完整像素数据
      const pixelDataList = batch.map(item => item.pixelData);
      const historyDataList = batch.map(item => item.historyData).filter(Boolean);
      const cacheUpdateList = batch.flatMap(item => item.cacheUpdates || []);

      // 执行批量数据库操作
      await this.executeBatchPixelOperations(pixelDataList);

      // 批量记录历史
      if (historyDataList.length > 0) {
        await this.recordBatchHistory(historyDataList);
      }

      // 批量更新缓存
      if (cacheUpdateList.length > 0) {
        await this.processBatchCacheUpdates(cacheUpdateList);
      }

      // 漂流瓶配额钩子: 按userId聚合像素数, 通知driftBottleService
      try {
        const userPixelCounts = {};
        for (const item of batch) {
          const uid = item.pixelData?.user_id || item.userId;
          if (uid) {
            userPixelCounts[uid] = (userPixelCounts[uid] || 0) + 1;
          }
        }
        const driftBottleService = require('./driftBottleService');
        for (const [uid, count] of Object.entries(userPixelCounts)) {
          driftBottleService.onPixelsDrawn(uid, count).catch(() => {});
        }
      } catch (quotaError) {
        // 配额钩子失败不影响主流程
        console.warn('漂流瓶配额钩子失败:', quotaError.message);
      }

      const processingTime = Date.now() - startTime;
      console.log(`✅ 批量处理完成: ${batch.length} 个像素, 历史记录: ${historyDataList.length} 个, 缓存更新: ${cacheUpdateList.length} 个, 耗时: ${processingTime}ms`);

      return {
        processed: batch.length,
        historyRecords: historyDataList.length,
        cacheUpdates: cacheUpdateList.length,
        processingTime
      };

    } catch (error) {
      console.error('批量处理失败:', error);

      // 将失败的批次重新放回队列
      this.batchQueue.unshift(...this.batchQueue.splice(0, this.batchSize));

      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  // 分组批量操作
  groupBatchOperations(batch) {
    const inserts = [];
    const updates = [];

    for (const pixel of batch) {
      // 检查是否已存在（这里简化处理，实际应该查询数据库）
      const existingPixel = this.checkExistingPixel(pixel.gridId);
      
      if (existingPixel) {
        updates.push(pixel);
      } else {
        inserts.push(pixel);
      }
    }

    return { inserts, updates };
  }

  // 检查像素是否存在（简化版本）
  checkExistingPixel(gridId) {
    // 实际实现中应该查询数据库或缓存
    return false;
  }

  // 执行批量像素操作（使用 UPSERT）
  // OPTIMIZED: Uses batch insert instead of individual inserts for 10x performance
  async executeBatchPixelOperations(pixelDataList) {
    try {
      console.log(`🔄 开始执行批量像素操作: ${pixelDataList.length} 个像素`);

      // 领土动态：检测像素覆盖事件（fire-and-forget，不阻塞主写入路径）
      if (pixelDataList.length > 0) {
        try {
          const gridIds = pixelDataList.map(p => p.grid_id);

          // 优化：单用户批次用 whereNot 过滤掉自己的像素，减少返回行数
          const uniqueUserIds = new Set(pixelDataList.map(p => p.user_id));
          let query = db('pixels')
            .whereIn('grid_id', gridIds)
            .select('grid_id', 'user_id', 'color', 'pattern_id');
          if (uniqueUserIds.size === 1) {
            query = query.whereNot('user_id', pixelDataList[0].user_id);
          }
          const existingPixels = await query;

          const ownerMap = new Map(existingPixels.map(p => [p.grid_id, p]));

          const battleEvents = [];
          for (const newPixel of pixelDataList) {
            const existing = ownerMap.get(newPixel.grid_id);
            if (existing && existing.user_id && existing.user_id !== newPixel.user_id) {
              battleEvents.push({
                attacker_id: newPixel.user_id,
                victim_id: existing.user_id,
                grid_id: newPixel.grid_id,
                latitude: newPixel.latitude,
                longitude: newPixel.longitude,
                old_color: existing.color,
                new_color: newPixel.color,
                old_pattern_id: existing.pattern_id,
                new_pattern_id: newPixel.pattern_id
              });
            }
          }

          if (battleEvents.length > 0) {
            const battleReportService = require('./battleReportService');
            battleReportService.queueBattleEvents(battleEvents).catch(console.error);
          }
        } catch (battleError) {
          console.error('⚠️ 领土动态检测失败（不影响主流程）:', battleError);
        }
      }

      // OPTIMIZATION: Single multi-value INSERT with ON CONFLICT
      // This is ~10x faster than individual inserts in a transaction
      if (pixelDataList.length > 0) {
        await db('pixels')
          .insert(pixelDataList)
          .onConflict('grid_id')
          .merge([
            'color',
            'pattern_id',
            'pattern_anchor_x',
            'pattern_anchor_y',
            'pattern_rotation',
            'pattern_mirror',
            'user_id',
            'pixel_type',
            'related_id',
            'session_id',
            'alliance_id',
            'updated_at'
          ]);
      }

      console.log(`✅ 批量像素操作完成: ${pixelDataList.length} 个像素`);

      // 队列化瓦片变更通知，用于实时更新
      const persistedPixels = pixelDataList.map(p => ({
        id: p.gridId,
        grid_id: p.gridId,
        latitude: p.latitude,
        longitude: p.longitude,
        color: p.color,
        pattern_id: p.patternId,
        pattern_anchor_x: p.pattern_anchor_x || 0,
        pattern_anchor_y: p.pattern_anchor_y || 0,
        pattern_rotation: p.pattern_rotation || 0,
        pattern_mirror: p.pattern_mirror || false,
        user_id: p.userId,
        pixel_type: p.pixelType || 'basic',
        related_id: p.relatedId || null
      }));
      await tileChangeQueueService.enqueuePixelChanges(persistedPixels);

    } catch (error) {
      console.error('❌ 批量像素操作失败:', error);
      throw error;
    }
  }

  // 批量记录历史
  async recordBatchHistory(historyDataList) {
    try {
      console.log(`📝 开始批量记录历史: ${historyDataList.length} 条记录`);

      // 批量插入历史记录
      await db('pixels_history').insert(historyDataList);

      console.log(`✅ 批量历史记录完成: ${historyDataList.length} 条记录`);

    } catch (error) {
      console.error('❌ 批量历史记录失败:', error);
      // 历史记录失败不影响主流程
    }
  }

  // 批量处理缓存更新
  async processBatchCacheUpdates(cacheUpdateList) {
    try {
      console.log(`🗄️ 开始批量缓存更新: ${cacheUpdateList.length} 个更新`);

      for (const update of cacheUpdateList) {
        if (update.type === 'pixel') {
          await CacheService.setPixel(update.key.replace('pixel:', ''), update.value);
        } else if (update.type === 'stats' && update.operation === 'increment') {
          await CacheService.incrementPixelCount();
        }
      }

      console.log(`✅ 批量缓存更新完成: ${cacheUpdateList.length} 个更新`);

    } catch (error) {
      console.error('❌ 批量缓存更新失败:', error);
      // 缓存更新失败不影响主流程
    }
  }

  // 执行批量操作
  async executeBatchOperations(inserts, updates) {
    const results = {
      inserted: 0,
      updated: 0,
      errors: []
    };

    try {
      // 开始事务
      await db.transaction(async (trx) => {
        // 批量插入
        if (inserts.length > 0) {
          const insertData = inserts.map(pixel => ({
            grid_id: pixel.gridId,
            latitude: pixel.latitude,
            longitude: pixel.longitude,
            color: pixel.color,
            user_id: pixel.userId,
            pixel_type: pixel.pixelType || 'basic', // 默认为basic类型
            related_id: pixel.relatedId || null,
            created_at: new Date(pixel.timestamp),
            updated_at: new Date(pixel.timestamp)
          }));

          await trx('pixels').insert(insertData);
          results.inserted = inserts.length;
        }

        // 批量更新
        if (updates.length > 0) {
          for (const pixel of updates) {
            await trx('pixels')
              .where({ grid_id: pixel.gridId })
              .update({
                color: pixel.color,
                user_id: pixel.userId,
                pixel_type: pixel.pixelType || 'basic', // 默认为basic类型
                related_id: pixel.relatedId || null,
                updated_at: new Date(pixel.timestamp)
              });
          }
          results.updated = updates.length;
        }
      });

    } catch (error) {
      console.error('批量操作执行失败:', error);
      results.errors.push(error.message);
      throw error;
    }

    // 异步记录像素历史，不阻塞主流程
    try {
      console.log(`📝 开始记录批量像素历史: 插入${results.inserted}个，更新${results.updated}个`);

      // 准备历史记录数据（包括插入和更新的像素）
      const allPixels = [...inserts, ...updates];
      const historyData = allPixels.map(pixel => ({
        latitude: pixel.latitude,
        longitude: pixel.longitude,
        color: pixel.color,
        user_id: pixel.userId,
        grid_id: pixel.gridId,
        pattern_id: null,
        pattern_anchor_x: 0,
        pattern_anchor_y: 0,
        pattern_rotation: 0,
        pattern_mirror: false,
        pixel_type: pixel.pixelType || 'basic',
        related_id: pixel.relatedId || null
      }));

      if (historyData.length > 0) {
        // 批量记录历史
        const historyResult = await pixelsHistoryService.batchRecordPixelHistory(
          historyData,
          'batch_operation',
          {
            batchSize: allPixels.length,
            inserted: results.inserted,
            updated: results.updated,
            version: 1
          }
        );
        
        if (historyResult.success) {
          console.log(`✅ 批量像素历史记录成功: ${historyData.length}个像素`);
        } else {
          console.warn(`⚠️ 批量像素历史记录失败: ${historyResult.error}`);
        }
      }
    } catch (error) {
      console.error('❌ 记录批量像素历史时发生错误:', error);
      // 不抛出错误，避免影响主流程
    }

    return results;
  }

  // 更新缓存
  async updateCache(batch) {
    try {
      const cachePromises = batch.map(async (pixel) => {
        const cacheKey = `pixel:${pixel.gridId}`;
        const cacheData = {
          grid_id: pixel.gridId,
          latitude: pixel.latitude,
          longitude: pixel.longitude,
          color: pixel.color,
          user_id: pixel.userId,
          updated_at: new Date(pixel.timestamp)
        };

        await CacheService.set(cacheKey, cacheData, 3600); // 1小时过期
      });

      await Promise.all(cachePromises);
      console.log(`💾 缓存更新完成: ${batch.length} 个像素`);

    } catch (error) {
      console.error('缓存更新失败:', error);
      // 缓存更新失败不影响主流程
    }
  }

  // 启动批量处理器
  startBatchProcessor() {
    setInterval(async () => {
      if (this.batchQueue.length > 0) {
        await this.processBatch();
      }
    }, this.flushInterval);
  }

  // 强制处理所有队列
  async flushAll() {
    console.log(`🔄 强制刷新所有队列: ${this.batchQueue.length} 个像素`);
    
    while (this.batchQueue.length > 0) {
      await this.processBatch();
    }
  }

  // 获取队列状态
  getQueueStatus() {
    return {
      queueLength: this.batchQueue.length,
      isProcessing: this.isProcessing,
      batchSize: this.batchSize,
      flushInterval: this.flushInterval
    };
  }

  // 批量查询像素
  static async batchGetPixels(gridIds) {
    // 增强输入验证
    if (!gridIds) {
      console.log('⚠️ 批量查询: gridIds为null或undefined，返回空结果');
      return {};
    }
    
    if (!Array.isArray(gridIds)) {
      console.log('⚠️ 批量查询: gridIds不是数组，返回空结果');
      return {};
    }
    
    if (gridIds.length === 0) {
      console.log('📊 批量查询: gridIds为空数组，返回空结果');
      return {};
    }

    // 验证gridIds的有效性
    const validGridIds = gridIds.filter(id => {
      if (typeof id !== 'string' || !id.trim()) {
        console.log(`⚠️ 批量查询: 跳过无效的gridId: ${id}`);
        return false;
      }
      return true;
    });

    if (validGridIds.length === 0) {
      console.log('⚠️ 批量查询: 没有有效的gridId，返回空结果');
      return {};
    }

    const startTime = Date.now();
    const result = {};
    const uncachedGridIds = [];

    try {
      // 先从缓存获取
      for (const gridId of validGridIds) {
        try {
          const cachedPixel = await CacheService.get(`pixel:${gridId}`);
          if (cachedPixel && typeof cachedPixel === 'object') {
            // 修复：将单个像素包装成pixels数组格式
            result[gridId] = { pixels: [cachedPixel] };
          } else {
            uncachedGridIds.push(gridId);
          }
        } catch (cacheError) {
          console.error(`缓存获取失败 (${gridId}):`, cacheError);
          uncachedGridIds.push(gridId);
        }
      }

      // 从数据库批量获取未缓存的像素
      if (uncachedGridIds.length > 0) {
        try {
          const pixels = await db('pixels')
            .whereIn('grid_id', uncachedGridIds)
            .select('*');

          // 按网格ID分组像素
          const pixelsByGrid = {};
          for (const pixel of pixels) {
            if (!pixelsByGrid[pixel.grid_id]) {
              pixelsByGrid[pixel.grid_id] = [];
            }
            pixelsByGrid[pixel.grid_id].push(pixel);
            
            // 缓存单个像素
            try {
              await CacheService.set(`pixel:${pixel.grid_id}`, pixel, 3600);
            } catch (cacheError) {
              console.error(`缓存设置失败 (${pixel.grid_id}):`, cacheError);
              // 缓存失败不影响主流程
            }
          }

          // 添加到结果中，使用正确的格式
          for (const gridId of uncachedGridIds) {
            if (pixelsByGrid[gridId]) {
              result[gridId] = { pixels: pixelsByGrid[gridId] };
            } else {
              // 即使没有像素，也要返回空数组格式
              result[gridId] = { pixels: [] };
            }
          }
        } catch (dbError) {
          console.error('数据库查询失败:', dbError);
          // 数据库查询失败时，为所有未缓存的gridId返回空结果
          for (const gridId of uncachedGridIds) {
            result[gridId] = { pixels: [] };
          }
        }
      } else {
        // 所有网格都从缓存获取，确保格式一致
        for (const gridId of validGridIds) {
          if (!result[gridId]) {
            result[gridId] = { pixels: [] };
          }
        }
      }

      const queryTime = Date.now() - startTime;
      console.log(`📊 批量查询完成: ${validGridIds.length} 个网格, 缓存命中: ${validGridIds.length - uncachedGridIds.length}, 耗时: ${queryTime}ms`);

      return result;

    } catch (error) {
      console.error('批量查询失败:', error);
      // 返回空结果而不是抛出错误，避免500错误
      const fallbackResult = {};
      for (const gridId of validGridIds) {
        fallbackResult[gridId] = { pixels: [] };
      }
      return fallbackResult;
    }
  }

  // 批量删除像素
  static async batchDeletePixels(gridIds, userId) {
    if (!Array.isArray(gridIds) || gridIds.length === 0) {
      return { deleted: 0 };
    }

    try {
      const result = await db.transaction(async (trx) => {
        // 批量删除
        const deletedCount = await trx('pixels')
          .whereIn('grid_id', gridIds)
          .where({ user_id: userId })
          .del();

        // 清除缓存
        const cachePromises = gridIds.map(gridId => 
          CacheService.del(`pixel:${gridId}`)
        );
        await Promise.all(cachePromises);

        return { deleted: deletedCount };
      });

      console.log(`🗑️ 批量删除完成: ${result.deleted} 个像素`);
      return result;

    } catch (error) {
      console.error('批量删除失败:', error);
      throw error;
    }
  }

  /**
   * 批量绘制像素（用于炸弹、广告等批量操作）
   * @param {Array} pixelDataArray - 像素数据数组
   * @param {Object} options - 选项
   * @param {string} options.drawType - 绘制类型 ('bomb', 'ad', 'alliance', etc.)
   * @param {boolean} options.skipUserValidation - 是否跳过用户验证
   * @param {boolean} options.skipPointConsumption - 是否跳过点数消耗
   * @returns {Object} 批量绘制结果
   */
  static async batchDrawPixels(pixelDataArray, options = {}) {
    const {
      drawType = 'batch',
      skipUserValidation = false,
      skipPointConsumption = false
    } = options;

    const startTime = Date.now();
    const results = {
      success: true,
      totalPixels: pixelDataArray.length,
      successCount: 0,
      failureCount: 0,
      processingTime: 0,
      results: []
    };

    try {
      console.log(`🎨 开始批量绘制像素: ${pixelDataArray.length}个, 类型: ${drawType}`);

      // 验证输入数据
      const validatedPixels = pixelDataArray.map((pixel, index) => {
        try {
          const normalized = normalizePixelWritePayload(pixel, {
            userId: pixel.userId,
            drawType
          });

          return {
            ...normalized,
            color: normalized.color || DEFAULT_COLOR
          };
        } catch (error) {
          results.failureCount++;
          results.results.push({
            success: false,
            error: error.message,
            index,
            drawType: pixel.drawType || drawType
          });
          return null;
        }
      }).filter(pixel => pixel !== null);

      if (validatedPixels.length === 0) {
        throw new Error('没有有效的像素数据');
      }

      // 批量处理像素
      const batchResults = await this.processBatchPixels(validatedPixels, {
        skipUserValidation,
        skipPointConsumption,
        drawType
      });

      results.successCount = batchResults.successCount;
      results.failureCount += batchResults.failureCount;
      results.results.push(...batchResults.results);

      results.processingTime = Date.now() - startTime;
      
      console.log(`✅ 批量绘制完成: 成功${results.successCount}个, 失败${results.failureCount}个, 耗时${results.processingTime}ms`);

      return results;

    } catch (error) {
      console.error('❌ 批量绘制失败:', error);
      results.success = false;
      results.error = error.message;
      results.processingTime = Date.now() - startTime;
      return results;
    }
  }

  /**
   * 处理批量像素数据
   * @param {Array} pixels - 验证后的像素数据
   * @param {Object} options - 处理选项
   * @returns {Object} 处理结果
   */
  static async processBatchPixels(pixels, options = {}) {
    const {
      skipUserValidation = false,
      skipPointConsumption = false,
      drawType = 'batch'
    } = options;

    const results = {
      successCount: 0,
      failureCount: 0,
      results: []
    };
    const persistedPixels = [];

    try {
      // 使用事务确保数据一致性
      await db.transaction(async (trx) => {
        for (let i = 0; i < pixels.length; i++) {
          const pixel = pixels[i];
          
          try {
            // 计算网格ID
            const gridId = this.calculateGridId(pixel.latitude, pixel.longitude);

            const timestamp = new Date();
            const pixelData = {
              grid_id: gridId,
              latitude: pixel.latitude,
              longitude: pixel.longitude,
              color: pixel.color,
              user_id: pixel.userId,
              pattern_id: pixel.patternId,
              pattern_anchor_x: pixel.anchorX,
              pattern_anchor_y: pixel.anchorY,
              pattern_rotation: pixel.rotation,
              pattern_mirror: pixel.mirror,
              pixel_type: pixel.pixelType,
              related_id: pixel.relatedId,
              alliance_id: pixel.allianceId || null,
              created_at: timestamp,
              updated_at: timestamp
            };

            const [persistedPixel] = await trx('pixels')
              .insert(pixelData)
              .onConflict('grid_id')
              .merge({
                latitude: pixel.latitude,
                longitude: pixel.longitude,
                color: pixel.color,
                user_id: pixel.userId,
                pattern_id: pixel.patternId,
                pattern_anchor_x: pixel.anchorX,
                pattern_anchor_y: pixel.anchorY,
                pattern_rotation: pixel.rotation,
                pattern_mirror: pixel.mirror,
                pixel_type: pixel.pixelType,
                related_id: pixel.relatedId,
                alliance_id: pixel.allianceId || null,
                updated_at: timestamp
              })
              .returning('*');

            if (persistedPixel) {
              persistedPixels.push({
                ...persistedPixel,
                drawType: pixel.drawType || drawType,
                pixelType: pixel.pixelType,
                relatedId: pixel.relatedId
              });
            }

            results.successCount++;
            results.results.push({
              success: true,
              gridId,
              latitude: persistedPixel?.latitude ?? pixel.latitude,
              longitude: persistedPixel?.longitude ?? pixel.longitude,
              drawType: pixel.drawType
            });

          } catch (error) {
            results.failureCount++;
            results.results.push({
              success: false,
              error: error.message,
              index: i,
              drawType: pixel.drawType
            });
            console.error(`❌ 处理像素${i}失败:`, error);
          }
        }
      });

      // 异步记录像素历史
      try {
        const historyData = persistedPixels.map(pixel => ({
          latitude: pixel.latitude,
          longitude: pixel.longitude,
          color: pixel.color,
          user_id: pixel.user_id,
          grid_id: pixel.grid_id,
          pattern_id: pixel.pattern_id,
          pattern_anchor_x: pixel.pattern_anchor_x,
          pattern_anchor_y: pixel.pattern_anchor_y,
          pattern_rotation: pixel.pattern_rotation,
          pattern_mirror: pixel.pattern_mirror,
          pixel_type: pixel.pixel_type,
          related_id: pixel.related_id
        }));

        await pixelsHistoryService.batchRecordPixelHistory(historyData, drawType);
        console.log(`📝 批量像素历史记录完成: ${historyData.length}个像素`);
      } catch (error) {
        console.error('❌ 记录批量像素历史失败:', error);
        // 不抛出错误，避免影响主流程
      }

      await tileChangeQueueService.enqueuePixelChanges(persistedPixels);

      // 清理 MVT 瓦片缓存（确保炸弹/广告等批量像素立即可见）
      const invalidatedCoords = new Set();
      for (const pixel of persistedPixels) {
        const coordKey = `${pixel.latitude},${pixel.longitude}`;
        if (!invalidatedCoords.has(coordKey)) {
          invalidatedCoords.add(coordKey);
        }
      }
      // 对批量像素只取第一个坐标做瓦片失效（同一区域的像素属于相同瓦片）
      if (persistedPixels.length > 0) {
        const firstPixel = persistedPixels[0];
        productionMVTService.invalidatePixelTiles(firstPixel.latitude, firstPixel.longitude).catch(error => {
          console.error('❌ 清理MVT瓦片缓存失败（非阻塞）:', error);
        });
      }

      // 瓦片服务和WebSocket广播集成
      const instance = this.instance;
      if (instance && typeof instance.handleTileAndBroadcastIntegration === 'function') {
        await instance.handleTileAndBroadcastIntegration(persistedPixels, results, drawType);
      }

    } catch (error) {
      console.error('❌ 批量处理像素失败:', error);
      throw error;
    }

    return results;
  }

  /**
   * 处理瓦片服务和WebSocket广播集成
   * @param {Array} pixels - 像素数据
   * @param {Object} results - 处理结果
   * @param {string} drawType - 绘制类型
   */
  async handleTileAndBroadcastIntegration(pixels, results, drawType) {
    try {
      // 1. 瓦片缓存刷新
      await this.refreshTileCache(pixels);
      
      // 2. WebSocket广播
      await this.broadcastPixelUpdates(pixels, results, drawType);
      
      console.log(`🎯 瓦片和广播集成完成: ${pixels.length}个像素`);
    } catch (error) {
      console.error('❌ 瓦片和广播集成失败:', error);
      // 不抛出错误，避免影响主流程
    }
  }

  /**
   * 刷新瓦片缓存
   * @param {Array} pixels - 像素数据
   */
  async refreshTileCache(pixels) {
    try {
      const tileIds = new Set();
      
      // 计算受影响的瓦片ID（支持多个缩放级别）
      for (const pixel of pixels) {
        // 计算多个缩放级别的瓦片ID
        for (let zoom = 10; zoom <= 18; zoom++) {
          const tileId = this.calculateTileId(pixel.latitude, pixel.longitude, zoom);
          tileIds.add(tileId);
        }
      }
      
      // 清除受影响的瓦片缓存
      await Promise.all(Array.from(tileIds).map(tileId => TileCacheService.invalidate(tileId)));

      await Promise.all(Array.from(tileIds).map(tileId => {
        const [zoomStr, xStr, yStr] = tileId.split('/');
        const zoom = parseInt(zoomStr, 10);
        const tileX = parseInt(xStr, 10);
        const tileY = parseInt(yStr, 10);

        if (Number.isNaN(zoom) || Number.isNaN(tileX) || Number.isNaN(tileY)) {
          return Promise.resolve();
        }

        // 注意：Canvas 2D瓦片渲染系统已被废弃
        // 像素现在由客户端MapLibre GL直接渲染，无需触发瓦片重渲
        return Promise.resolve();
      }));

      console.log(`🗑️ 清除瓦片缓存: ${tileIds.size}个瓦片 (Canvas 2D渲染已废弃)`);
      
    } catch (error) {
      console.error('❌ 刷新瓦片缓存失败:', error);
    }
  }

  /**
   * 广播像素更新
   * @param {Array} pixels - 像素数据
   * @param {Object} results - 处理结果
   * @param {string} drawType - 绘制类型
   */
  async broadcastPixelUpdates(pixels, results, drawType) {
    if (!this.socketManager) {
      console.log('⚠️ SocketManager未初始化，跳过WebSocket广播');
      return;
    }

    try {
      // 预先加载 pattern_assets.render_type（pattern_id 对应 key）
      const patternKeys = Array.from(new Set(
        pixels
          .map(pixel => pixel.pattern_id || pixel.patternId)
          .filter(key => typeof key === 'string' && key.length > 0)
      ));

      let renderTypeByKey = {};
      if (patternKeys.length > 0) {
        const rows = await db('pattern_assets')
          .whereIn('key', patternKeys)
          .select('key', 'render_type');
        renderTypeByKey = rows.reduce((acc, row) => {
          acc[row.key] = row.render_type;
          return acc;
        }, {});
      }

      // 按瓦片分组像素更新
      const tileUpdates = new Map();
      
      for (const pixel of pixels) {
        // 计算瓦片ID（使用默认缩放级别15）
        const tileId = this.calculateTileId(pixel.latitude, pixel.longitude, 15);

        if (!tileUpdates.has(tileId)) {
          tileUpdates.set(tileId, []);
        }

        const gridId = pixel.grid_id
          || PixelBatchService.calculateGridId(pixel.latitude, pixel.longitude);

        tileUpdates.get(tileId).push({
          gridId,
          latitude: pixel.latitude,
          longitude: pixel.longitude,
          color: pixel.color,
          patternId: pixel.pattern_id || pixel.patternId || null,
          userId: pixel.user_id || pixel.userId,
          pixelType: pixel.pixel_type || pixel.pixelType || 'basic',
          relatedId: pixel.related_id || pixel.relatedId || null,
          renderType: pixel.render_type || pixel.renderType || renderTypeByKey[pixel.pattern_id || pixel.patternId] || null,
          drawType: pixel.drawType || drawType,
          timestamp: Date.now()
        });
      }
      
      // 批量广播到各个瓦片房间
      const broadcastPromises = Array.from(tileUpdates.entries()).map(([tileId, pixelUpdates]) =>
        this.socketManager.broadcastTilePixelUpdate(tileId, pixelUpdates)
      );
      
      await Promise.all(broadcastPromises);
      console.log(`📡 WebSocket广播完成: ${tileUpdates.size}个瓦片房间`);
      
    } catch (error) {
      console.error('❌ WebSocket广播失败:', error);
    }
  }

  /**
   * 计算瓦片ID（高德地图规范）
   * @param {number} lat - 纬度
   * @param {number} lng - 经度
   * @param {number} zoom - 缩放级别
   * @returns {string} 瓦片ID (z:x:y)
   */
  calculateTileId(latitude, longitude, zoom = 15) {
    return TileUtils.latLngToTileId(latitude, longitude, zoom);
  }

  /**
   * 计算网格ID
   * @param {number} lat - 纬度
   * @param {number} lng - 经度
   * @returns {string} 网格ID
   */
  static calculateGridId(lat, lng) {
    const GRID_SIZE = 0.0001;
    const gridX = Math.floor((lng + 180) / GRID_SIZE);
    const gridY = Math.floor((lat + 90) / GRID_SIZE);
    return `grid_${gridX}_${gridY}`;
  }
}

module.exports = PixelBatchService;
