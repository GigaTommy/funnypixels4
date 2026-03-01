/**
 * 批量像素处理服务
 * 优化数据库写入性能，减少数据库连接开销
 * 支持批量插入、批量缓存更新、批量历史记录
 */

const { db } = require('../config/database');
const { getRedis } = require('../config/redis');
const CacheService = require('./cacheService');
const { calculateGridId } = require('../../shared/utils/gridUtils');
const logger = require('../utils/logger');
const tileChangeQueueService = require('./tileChangeQueueService');
const battleReportService = require('./battleReportService');
const pixelBatchEventBus = require('../events/PixelBatchEventBus');

/**
 * 批量像素处理服务
 * 核心功能：
 * 1. 批量处理像素创建和更新
 * 2. 批量写入历史记录
 * 3. 批量缓存更新
 * 4. 事务保证数据一致性
 * 5. 异步处理避免阻塞主流程
 */
class BatchPixelService {
  constructor() {
    this.pixelBatch = [];
    this.historyBatch = [];
    this.cacheUpdateBatch = [];

    // 配置参数
    this.batchSize = parseInt(process.env.BATCH_SIZE) || 100;
    this.flushInterval = parseInt(process.env.BATCH_FLUSH_INTERVAL) || 3000; // 3秒
    this.maxBatchSize = parseInt(process.env.MAX_BATCH_SIZE) || 500;

    // 状态控制
    this.isFlushing = false;
    this.flushTimer = null;

    // 性能统计
    this.stats = {
      totalBatches: 0,
      totalPixelsProcessed: 0,
      totalHistoryRecords: 0,
      totalCacheUpdates: 0,
      averageBatchSize: 0,
      averageFlushTime: 0,
      failedOperations: 0
    };

    // 启动定期刷新
    this.startPeriodicFlush();

    logger.info('📦 批量像素处理服务初始化完成', {
      batchSize: this.batchSize,
      flushInterval: this.flushInterval
    });
  }

  /**
   * 添加像素到批处理队列
   * @param {Object} pixelData - 像素数据
   * @param {Object} historyData - 历史数据
   * @param {Array} cacheUpdates - 缓存更新项
   */
  addToBatch(pixelData, historyData = null, cacheUpdates = []) {
    try {
      // 添加到批处理队列
      this.pixelBatch.push(pixelData);

      if (historyData) {
        this.historyBatch.push(historyData);
      }

      if (cacheUpdates.length > 0) {
        this.cacheUpdateBatch.push(...cacheUpdates);
      }

      // 检查是否需要立即刷新
      const currentBatchSize = this.pixelBatch.length;
      if (currentBatchSize >= this.maxBatchSize) {
        logger.warn('批量大小超过限制，立即刷新', {
          currentSize: currentBatchSize,
          maxSize: this.maxBatchSize
        });
        // 异步刷新，不阻塞主流程
        this.flushBatch().catch(error => {
          logger.error('立即刷新失败', { error: error.message });
        });
      }

      return {
        success: true,
        queueSize: currentBatchSize,
        batchSize: this.batchSize
      };

    } catch (error) {
      logger.error('添加像素到批处理队列失败', {
        error: error.message,
        pixelId: pixelData?.id
      });

      this.stats.failedOperations++;
      return { success: false, error: error.message };
    }
  }

  /**
   * 立即刷新批处理队列
   */
  async flushBatch() {
    // If a flush is already in progress, return the existing promise.
    // This ensures that concurrent callers (like PixelDrawService) wait for the *actual* completion
    // of the flush operation, which includes their newly added items (due to the loop below).
    if (this.currentFlushPromise) {
      return this.currentFlushPromise;
    }

    // Initialize the shared promise
    this.currentFlushPromise = (async () => {
      this.isFlushing = true;

      try {
        // 🔒 安全：添加最大迭代次数限制，防止无限循环
        const MAX_FLUSH_ITERATIONS = 10;
        let iterations = 0;

        // Loop until queue is empty (Drain Strategy)
        while (this.pixelBatch.length > 0 || this.historyBatch.length > 0 || this.cacheUpdateBatch.length > 0) {
          iterations++;

          // 🔒 检查是否超过最大迭代次数
          if (iterations > MAX_FLUSH_ITERATIONS) {
            logger.warn('⚠️ 批量刷新达到最大迭代次数，停止处理', {
              iterations,
              remainingPixels: this.pixelBatch.length,
              remainingHistory: this.historyBatch.length,
              remainingCache: this.cacheUpdateBatch.length,
              totalRemaining: this.pixelBatch.length + this.historyBatch.length + this.cacheUpdateBatch.length
            });

            // 触发告警 - 这表明写入速度超过处理能力
            this.stats.failedOperations++;
            break;
          }

          // 1. Atomic Move: Capture current batch and clear global queues immediately
          const currentPixels = [...this.pixelBatch];
          const currentHistory = [...this.historyBatch];
          const currentCache = [...this.cacheUpdateBatch];

          this.pixelBatch = [];
          this.historyBatch = [];
          this.cacheUpdateBatch = [];

          const startTime = Date.now();
          const pixelCount = currentPixels.length;
          const historyCount = currentHistory.length;
          const cacheCount = currentCache.length;

          if (pixelCount === 0 && historyCount === 0 && cacheCount === 0) break;

          logger.debug('🚀 开始批量刷新 (Batch)', { pixelCount, historyCount });

          // 使用事务保证数据一致性
          let flushedPixels = [];
          await db.transaction(async (trx) => {
            // 1. 批量插入/更新像素
            if (pixelCount > 0) {
              flushedPixels = await this.batchUpdatePixels(trx, currentPixels);
            }

            // 2. 批量写入历史记录
            if (historyCount > 0) {
              await this.batchInsertHistory(trx, currentHistory);
              logger.debug('批量历史记录已写入', { count: historyCount });
            }
          });

          // 🚀 事件驱动：批处理完成，通知地理编码服务
          // ✅ 修复：合并完整像素数据和数据库返回的ID，确保地理编码服务能获取完整信息
          if (flushedPixels.length > 0) {
            const enrichedPixels = flushedPixels.map(flushed => {
              // 从原始数据中找到对应的完整像素数据
              const original = currentPixels.find(p => p.gridId === flushed.grid_id || p.grid_id === flushed.grid_id);
              if (original) {
                return {
                  ...flushed,
                  latitude: original.latitude,
                  longitude: original.longitude,
                  color: original.color,
                  pattern_id: original.patternId || original.pattern_id,
                  user_id: original.userId || original.user_id,
                  pixel_type: original.pixelType || original.pixel_type,
                  related_id: original.relatedId || original.related_id,
                  alliance_id: original.allianceId || original.alliance_id,
                  pattern_anchor_x: original.anchorX || original.pattern_anchor_x || 0,
                  pattern_anchor_y: original.anchorY || original.pattern_anchor_y || 0,
                  pattern_rotation: original.rotation || original.pattern_rotation || 0,
                  pattern_mirror: original.mirror !== undefined ? original.mirror : (original.pattern_mirror || false),
                  created_at: flushed.created_at || original.createdAt || original.created_at || new Date()
                };
              }
              return flushed;
            });
            pixelBatchEventBus.emitPixelsFlushed(enrichedPixels);

            // Sync to Redis GEO for GEOSEARCH-based BBOX queries (fire-and-forget)
            try {
              const redis = getRedis();
              if (redis && enrichedPixels.length > 0) {
                const multi = redis.multi();
                for (const px of enrichedPixels) {
                  if (px.longitude != null && px.latitude != null && px.grid_id) {
                    multi.geoAdd('pixels:geo', {
                      longitude: parseFloat(px.longitude),
                      latitude: parseFloat(px.latitude),
                      member: px.grid_id
                    });
                    multi.hSet('pixels:meta', px.grid_id, px.pattern_id || '');
                  }
                }
                multi.exec().catch(err => logger.warn('Redis GEO sync failed:', err.message));
              }
            } catch (e) {
              logger.warn('Redis pixel sync error:', e.message);
            }
          }

          // 3. 批量更新缓存（异步执行，不阻塞后续循环）
          if (cacheCount > 0) {
            this.batchUpdateCache(currentCache).catch(error => {
              logger.error('批量缓存更新失败', { error: error.message });
              this.stats.failedOperations++;
            });
          }

          // 更新统计
          this.updateFlushStats(startTime, pixelCount, historyCount, cacheCount);

          logger.info('✅ 批量刷新完成', {
            pixelCount,
            flushTime: `${Date.now() - startTime}ms`
          });
        }
      } catch (error) {
        logger.error('❌ 批量刷新失败', {
          error: error.message,
          stack: error.stack
        });
        this.stats.failedOperations++;
      } finally {
        this.isFlushing = false;
        this.currentFlushPromise = null; // Clear promise so next call starts new one
      }

      return { success: true };
    })();

    return this.currentFlushPromise;
  }

  /**
   * 去重像素数据，处理同一批次中的重复grid_id
   * 对于重复的grid_id，保留最新的记录（按updated_at排序）
   * @param {Array} pixels - 像素数据数组
   * @returns {Array} 去重后的像素数据数组
   */
  deduplicatePixels(pixels) {
    const pixelMap = new Map();

    for (const pixel of pixels) {
      const gridId = pixel.gridId || pixel.grid_id;

      if (!gridId) {
        // 没有grid_id的记录保留
        continue;
      }

      // 如果该grid_id已存在，比较updated_at，保留较新的
      if (pixelMap.has(gridId)) {
        const existing = pixelMap.get(gridId);
        const existingUpdatedAt = new Date(existing.updated_at || existing.createdAt || 0);
        const currentUpdatedAt = new Date(pixel.updated_at || pixel.createdAt || 0);

        if (currentUpdatedAt > existingUpdatedAt) {
          pixelMap.set(gridId, pixel);
        }
      } else {
        pixelMap.set(gridId, pixel);
      }
    }

    return Array.from(pixelMap.values());
  }

  /**
   * 字段名翻译：将camelCase转换为snake_case
   * @param {Object} camelCaseData - camelCase字段的数据
   * @returns {Object} snake_case字段的数据
   */
  translateFieldNames(camelCaseData) {
    const fieldMapping = {
      gridId: 'grid_id',
      userId: 'user_id',
      patternId: 'pattern_id',
      pattern_anchor_x: 'pattern_anchor_x',
      pattern_anchor_y: 'pattern_anchor_y',
      pattern_rotation: 'pattern_rotation',
      pattern_mirror: 'pattern_mirror',
      pixelType: 'pixel_type',
      relatedId: 'related_id',
      sessionId: 'session_id',  // 🆕 添加session_id字段映射
      allianceId: 'alliance_id',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      drawType: 'action_type'  // 🆕 修复历史表字段映射
    };

    const snakeCaseData = {};

    for (const [camelCaseKey, value] of Object.entries(camelCaseData)) {
      const snakeCaseKey = fieldMapping[camelCaseKey] || camelCaseKey;
      snakeCaseData[snakeCaseKey] = value;
    }

    return snakeCaseData;
  }

  /**
   * 批量更新像素数据
   * @param {Object} trx - 数据库事务
   * @param {Array} pixels - 像素数据数组
   */
  async batchUpdatePixels(trx, pixels) {
    const chunkSize = parseInt(process.env.BATCH_CHUNK_SIZE) || 500;
    const results = [];

    // 🔧 去重：同一批次中如果有重复的grid_id，保留最新的记录（按updated_at排序）
    const deduplicatedPixels = this.deduplicatePixels(pixels);

    if (deduplicatedPixels.length < pixels.length) {
      logger.warn('检测到重复grid_id，已去重', {
        originalCount: pixels.length,
        deduplicatedCount: deduplicatedPixels.length,
        duplicatesRemoved: pixels.length - deduplicatedPixels.length
      });
    }

    // 🛡️ 领土动态：检测像素覆盖事件（fire-and-forget，不阻塞主写入路径）
    // 🚀 优化：提前检查并跳过不必要的数据库查询
    try {
      // 提取所有有效的 gridId 和 userId（单次遍历）
      const pixelData = deduplicatedPixels.map(p => ({
        gridId: p.gridId || p.grid_id,
        userId: p.userId || p.user_id,
        latitude: p.latitude,
        longitude: p.longitude,
        color: p.color,
        patternId: p.patternId || p.pattern_id
      })).filter(p => p.gridId && p.userId);

      // 🚀 优化1：如果没有有效像素，直接跳过
      if (pixelData.length === 0) {
        // No valid pixels to check
      } else {
        // 🚀 优化2：提取唯一用户ID集合
        const uniqueUserIds = new Set(pixelData.map(p => p.userId));

        // 🚀 优化3：单用户批次跳过领土检测（同一用户覆盖自己的像素无需记录）
        if (uniqueUserIds.size === 1) {
          // Skip territory detection for single-user batches (no battles possible)
        } else {
          // 🚀 优化4：多用户批次才查询现有像素（只查询必要字段）
          const gridIds = pixelData.map(p => p.gridId);
          const existingPixels = await trx('pixels')
            .whereIn('grid_id', gridIds)
            .select('grid_id', 'user_id', 'color', 'pattern_id');

          // 🚀 优化5：构建索引 Map 加速查找
          const ownerMap = new Map(existingPixels.map(p => [p.grid_id, p]));

          // 🚀 优化6：检测领土覆盖事件（仅限不同用户）
          const battleEvents = [];
          for (const pixel of pixelData) {
            const existing = ownerMap.get(pixel.gridId);
            if (existing && existing.user_id && existing.user_id !== pixel.userId) {
              battleEvents.push({
                attacker_id: pixel.userId,
                victim_id: existing.user_id,
                grid_id: pixel.gridId,
                latitude: pixel.latitude,
                longitude: pixel.longitude,
                old_color: existing.color,
                new_color: pixel.color,
                old_pattern_id: existing.pattern_id,
                new_pattern_id: pixel.patternId
              });
            }
          }

          // 🚀 优化7：批量入队（fire-and-forget，不阻塞主流程）
          if (battleEvents.length > 0) {
            battleReportService.queueBattleEvents(battleEvents).catch(err => {
              logger.error('领土动态事件入队失败:', err);
            });
          }
        }
      }
    } catch (battleError) {
      logger.error('⚠️ 领土动态检测失败（不影响主流程）:', battleError);
    }

    for (let i = 0; i < deduplicatedPixels.length; i += chunkSize) {
      const chunk = deduplicatedPixels.slice(i, i + chunkSize);

      // 🆕 字段名翻译：将camelCase转换为snake_case
      const translatedChunk = chunk.map(pixel => this.translateFieldNames(pixel));

      // 确保所有必需的字段都存在
      const processedChunk = translatedChunk.map(pixel => ({
        ...pixel,
        updated_at: pixel.updated_at || new Date(),
        created_at: pixel.created_at || new Date(),
        version: pixel.version || 1  // 🔒 初始化version
      }));

      // 🔒 使用ON CONFLICT进行UPSERT操作，包含乐观锁version字段
      const result = await trx('pixels')
        .insert(processedChunk)
        .onConflict('grid_id')
        .merge({
          user_id: trx.raw('EXCLUDED.user_id'),
          color: trx.raw('EXCLUDED.color'),
          pattern_id: trx.raw('EXCLUDED.pattern_id'),
          pattern_anchor_x: trx.raw('EXCLUDED.pattern_anchor_x'),
          pattern_anchor_y: trx.raw('EXCLUDED.pattern_anchor_y'),
          pattern_rotation: trx.raw('EXCLUDED.pattern_rotation'),
          pattern_mirror: trx.raw('EXCLUDED.pattern_mirror'),
          pixel_type: trx.raw('EXCLUDED.pixel_type'),
          related_id: trx.raw('EXCLUDED.related_id'),
          session_id: trx.raw('EXCLUDED.session_id'),
          alliance_id: trx.raw('EXCLUDED.alliance_id'),
          version: trx.raw('pixels.version + 1'),  // 🔒 版本号递增
          updated_at: trx.raw('EXCLUDED.updated_at')
        })
        .whereRaw(`
          (pixels.color IS DISTINCT FROM EXCLUDED.color OR
           pixels.pattern_id IS DISTINCT FROM EXCLUDED.pattern_id OR
           pixels.user_id IS DISTINCT FROM EXCLUDED.user_id OR
           pixels.pixel_type IS DISTINCT FROM EXCLUDED.pixel_type OR
           pixels.related_id IS DISTINCT FROM EXCLUDED.related_id)
        `)
        .returning(['id', 'grid_id', 'updated_at', 'version', 'session_id']);

      results.push(...result);
    }

    // 队列化瓦片变更通知，用于实时WebSocket更新
    if (results.length > 0) {
      console.log(`🔄 准备队列化瓦片变更: ${results.length}个像素`);
      const pixelsForTileQueue = results.map(p => ({
        id: p.grid_id,
        grid_id: p.grid_id,
        latitude: null,
        longitude: null,
        color: null,
        pattern_id: null,
        user_id: null,
        pixel_type: 'basic'
      }));

      // 从原始像素数据中填充缺失字段
      for (let i = 0; i < pixelsForTileQueue.length; i++) {
        const pixelData = pixels.find(p => p.gridId === pixelsForTileQueue[i].grid_id);
        if (pixelData) {
          pixelsForTileQueue[i].latitude = pixelData.latitude;
          pixelsForTileQueue[i].longitude = pixelData.longitude;
          pixelsForTileQueue[i].color = pixelData.color;
          pixelsForTileQueue[i].pattern_id = pixelData.patternId;
          pixelsForTileQueue[i].user_id = pixelData.userId;
          pixelsForTileQueue[i].pattern_anchor_x = pixelData.anchorX || 0;
          pixelsForTileQueue[i].pattern_anchor_y = pixelData.anchorY || 0;
          pixelsForTileQueue[i].pattern_rotation = pixelData.rotation || 0;
          pixelsForTileQueue[i].pattern_mirror = pixelData.mirror || false;
        } else {
          console.warn(`⚠️ 无法找到grid_id=${pixelsForTileQueue[i].grid_id}的像素数据`);
        }
      }

      console.log(`✅ 调用enqueuePixelChanges: ${pixelsForTileQueue.length}个像素`);
      await tileChangeQueueService.enqueuePixelChanges(pixelsForTileQueue);
      console.log('✅ 瓦片变更队列化完成');
    }

    return results;
  }

  /**
   * 批量插入历史记录
   * @param {Object} trx - 数据库事务
   * @param {Array} historyRecords - 历史记录数组
   */
  async batchInsertHistory(trx, historyRecords) {
    const chunkSize = parseInt(process.env.BATCH_CHUNK_SIZE) || 500;
    const results = [];

    for (let i = 0; i < historyRecords.length; i += chunkSize) {
      const chunk = historyRecords.slice(i, i + chunkSize);

      // 🆕 字段名翻译：将camelCase转换为snake_case
      const translatedChunk = chunk.map(record => this.translateFieldNames(record));

      // 确保所有必需的字段都存在
      const processedChunk = translatedChunk.map(record => ({
        ...record,
        created_at: record.created_at || new Date()
      }));

      const result = await trx('pixels_history')
        .insert(processedChunk)
        .returning(['id', 'grid_id', 'created_at']);

      results.push(...result);
    }

    return results;
  }

  /**
   * 批量更新缓存
   * @param {Array} cacheUpdates - 缓存更新项
   */
  async batchUpdateCache(cacheUpdates) {
    if (!cacheUpdates || cacheUpdates.length === 0) return;

    const results = await Promise.allSettled(
      cacheUpdates.map(update => {
        if (update.gridId && update.data) {
          return CacheService.setPixel(update.gridId, update.data);
        }
        return Promise.resolve();
      })
    );

    const failed = results.filter(r => r.status === 'rejected').length;
    if (failed > 0) {
      logger.error('批量缓存更新部分失败', { total: cacheUpdates.length, failed });
    } else {
      logger.debug('批量缓存更新完成', { updateCount: cacheUpdates.length });
    }
  }

  /**
   * 启动定期刷新任务
   */
  startPeriodicFlush() {
    this.flushTimer = setInterval(async () => {
      if (this.pixelBatch.length > 0 || this.historyBatch.length > 0) {
        await this.flushBatch();
      }
    }, this.flushInterval);

    logger.debug('批量刷新定时器已启动', {
      interval: `${this.flushInterval}ms`
    });
  }

  /**
   * 停止定期刷新任务
   */
  stopPeriodicFlush() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
      logger.info('批量刷新定时器已停止');
    }
  }

  /**
   * 强制刷新所有待处理数据
   */
  async forceFlush() {
    logger.info('强制刷新所有批处理数据');

    // 停止定期刷新
    this.stopPeriodicFlush();

    // 立即刷新
    const result = await this.flushBatch();

    // 重启定期刷新
    this.startPeriodicFlush();

    return result;
  }

  /**
   * 更新刷新统计信息
   * @param {number} startTime - 开始时间
   * @param {number} pixelCount - 像素数量
   * @param {number} historyCount - 历史记录数量
   * @param {number} cacheCount - 缓存更新数量
   */
  updateFlushStats(startTime, pixelCount, historyCount, cacheCount) {
    const flushTime = Date.now() - startTime;

    this.stats.totalBatches++;
    this.stats.totalPixelsProcessed += pixelCount;
    this.stats.totalHistoryRecords += historyCount;
    this.stats.totalCacheUpdates += cacheCount;

    // 更新平均批量大小
    if (this.stats.averageBatchSize === 0) {
      this.stats.averageBatchSize = pixelCount;
    } else {
      const alpha = 0.1;
      this.stats.averageBatchSize =
        alpha * pixelCount + (1 - alpha) * this.stats.averageBatchSize;
    }

    // 更新平均刷新时间
    if (this.stats.averageFlushTime === 0) {
      this.stats.averageFlushTime = flushTime;
    } else {
      const alpha = 0.1;
      this.stats.averageFlushTime =
        alpha * flushTime + (1 - alpha) * this.stats.averageFlushTime;
    }
  }

  /**
   * 获取批处理统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      ...this.stats,
      currentQueueSize: {
        pixels: this.pixelBatch.length,
        history: this.historyBatch.length,
        cache: this.cacheUpdateBatch.length
      },
      isFlushing: this.isFlushing,
      config: {
        batchSize: this.batchSize,
        flushInterval: this.flushInterval,
        maxBatchSize: this.maxBatchSize
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 重置统计信息
   */
  resetStats() {
    this.stats = {
      totalBatches: 0,
      totalPixelsProcessed: 0,
      totalHistoryRecords: 0,
      totalCacheUpdates: 0,
      averageBatchSize: 0,
      averageFlushTime: 0,
      failedOperations: 0
    };

    logger.info('批处理统计信息已重置');
  }

  /**
   * 清空所有批处理队列
   */
  clearQueues() {
    this.pixelBatch = [];
    this.historyBatch = [];
    this.cacheUpdateBatch = [];

    logger.info('批处理队列已清空');
  }

  /**
   * 获取队列健康状态
   * @returns {Object} 健康状态
   */
  getHealthStatus() {
    const queueSize = this.pixelBatch.length + this.historyBatch.length;
    const maxSize = this.maxBatchSize;
    const utilization = (queueSize / maxSize) * 100;

    let status = 'healthy';
    let message = '批处理服务运行正常';

    if (utilization > 80) {
      status = 'warning';
      message = '批处理队列负载过高';
    } else if (utilization > 95) {
      status = 'critical';
      message = '批处理队列即将饱和';
    }

    if (this.stats.failedOperations > this.stats.totalBatches * 0.1) {
      status = 'warning';
      message = '存在较多失败操作';
    }

    return {
      status,
      message,
      metrics: {
        queueSize,
        maxSize,
        utilization: `${utilization.toFixed(1)}%`,
        failedOperations: this.stats.failedOperations,
        totalOperations: this.stats.totalBatches,
        averageFlushTime: `${this.stats.averageFlushTime.toFixed(0)}ms`
      },
      timestamp: new Date().toISOString()
    };
  }
}

// 创建单例实例
const batchPixelService = new BatchPixelService();

module.exports = batchPixelService;