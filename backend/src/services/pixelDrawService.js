const { db } = require('../config/database');
const { redis, redisUtils } = require('../config/redis');
const User = require('../models/User');
const Pixel = require('../models/Pixel');
const UserPixelState = require('../models/UserPixelState');
const CacheService = require('./cacheService');
const pixelsHistoryService = require('./pixelsHistoryService');
const drawingSessionService = require('./drawingSessionService');
const { calculateGridId, snapToGrid } = require('../../shared/utils/gridUtils');
const { DEFAULT_COLOR } = require('../utils/pixelPayload');
const logger = require('../utils/logger');

// 🆕 导入性能优化服务
const asyncGeocodingService = require('./asyncGeocodingService');
const batchPixelService = require('./batchPixelService');
const incrementalLeaderboardService = require('./incrementalLeaderboardService');
const pixelBatchEventBus = require('../events/PixelBatchEventBus');
const DailyChallenge = require('../models/DailyChallenge');
const Region = require('../models/Region');
const Achievement = require('../models/Achievement');

// 🚀 导入 Tile-based Rooms WebSocket 处理器
const tileUpdateHandler = require('../websocket/tileUpdateHandler');

// 🔧 导入 MVT 服务用于清理瓦片缓存
const productionMVTService = require('./productionMVTService');

// 🔧 并发限制器：控制 fire-and-forget 异步操作的 DB 连接占用
const BG_CONCURRENCY_LIMIT = parseInt(process.env.BG_CONCURRENCY_LIMIT || '200');
const BG_QUEUE_MAX = parseInt(process.env.BG_QUEUE_MAX || '1000');
let bgRunning = 0;
let bgDropped = 0;
const bgQueue = [];

function bgRun(fn) {
  if (bgRunning < BG_CONCURRENCY_LIMIT) {
    bgRunning++;
    fn().catch(() => {}).finally(() => {
      bgRunning--;
      if (bgQueue.length > 0) {
        const next = bgQueue.shift();
        bgRun(next);
      }
    });
  } else if (bgQueue.length < BG_QUEUE_MAX) {
    bgQueue.push(fn);
  } else {
    bgDropped++;
    if (bgDropped % 1000 === 1) {
      logger.warn(`[bgRun] Queue full (${BG_QUEUE_MAX}), dropped ${bgDropped} tasks total. running=${bgRunning}`);
    }
  }
}

/**
 * 统一像素绘制服务
 * 整合GPS绘制和手动绘制逻辑，提供高效的绘制处理
 * 集成Redis Stream和瓦片订阅优化
 */
class PixelDrawService {
  constructor(socketManager) {
    this.socketManager = socketManager;
    this.streamKey = 'stream:pixels';
    this.batchSize = parseInt(process.env.REDIS_BATCH_SIZE) || 100;
    this.flushInterval = parseInt(process.env.REDIS_FLUSH_INTERVAL) || 5 * 60 * 1000; // 5分钟
    this.isFlushing = false;

    // 🚀 事件驱动：监听批处理完成事件，触发地理编码
    this.setupEventListeners();

    // 启动定期持久化任务
    this.startPeriodicFlush();
  }

  /**
   * 🚀 设置事件监听器
   * 事件驱动架构：批处理完成后自动触发地理编码
   */
  setupEventListeners() {
    // 监听批处理完成事件
    pixelBatchEventBus.on('pixels-flushed', async (pixels) => {
      try {
        logger.debug('📡 Received pixels-flushed event', { count: pixels.length });

        // 为每个像素触发异步地理编码
        for (const pixel of pixels) {
          // 只为有坐标的像素执行地理编码
          if (pixel.latitude && pixel.longitude) {
            // ✅ 修复：构建完整的历史记录元数据，避免地理编码写入竞态条件
            const historyMetadata = {
              grid_id: pixel.grid_id,
              latitude: pixel.latitude,
              longitude: pixel.longitude,
              color: pixel.color,
              pattern_id: pixel.pattern_id || null,
              user_id: pixel.user_id,
              pixel_type: pixel.pixel_type || 'basic',
              related_id: pixel.related_id || null,
              session_id: pixel.session_id || null,
              alliance_id: pixel.alliance_id || null,
              pattern_anchor_x: pixel.pattern_anchor_x || 0,
              pattern_anchor_y: pixel.pattern_anchor_y || 0,
              pattern_rotation: pixel.pattern_rotation || 0,
              pattern_mirror: pixel.pattern_mirror || false,
              action_type: 'draw',
              history_date: (pixel.created_at || new Date()).toISOString().split('T')[0],
              created_at: pixel.created_at || new Date(),
              updated_at: new Date()
            };

            // 🚀 异步执行，不阻塞事件处理
            asyncGeocodingService.processGeocoding(
              pixel.id,
              pixel.latitude,
              pixel.longitude,
              'normal',  // priority
              pixel.created_at || new Date(),
              pixel.user_id,
              pixel.grid_id,
              historyMetadata  // ✅ 传递完整元数据
            ).catch(error => {
              logger.warn('地理编码失败（不影响主流程）:', {
                pixelId: pixel.id,
                error: error.message
              });
            });
          }
        }

        logger.debug('✅ 地理编码任务已提交', { count: pixels.length });

      } catch (error) {
        logger.error('❌ pixels-flushed事件处理失败:', error);
      }
    });

    logger.info('✅ 事件监听器已设置');
  }

  /**
   * 统一的像素绘制处理函数 (优化版)
   * 🆕 集成异步地理编码和批量处理，大幅提升性能
   *
   * 性能优化要点:
   * 1. 地理编码异步化，不阻塞主绘制流程 (消除100-200ms延迟)
   * 2. 批量数据库写入，减少连接开销
   * 3. 缓存更新异步化，提升响应速度
   * 4. 事务保证数据一致性
   *
   * @param {Object} params 绘制参数
   * @param {number} params.lat 纬度
   * @param {number} params.lng 经度
   * @param {string} params.userId 用户ID
   * @param {string} params.drawType 绘制类型 ('manual' | 'gps')
   * @param {string} params.patternId 图案ID (可选)
   * @param {number} params.anchorX 锚点X (可选)
   * @param {number} params.anchorY 锚点Y (可选)
   * @param {number} params.rotation 旋转角度 (可选)
   * @param {boolean} params.mirror 是否镜像 (可选)
   * @param {string} params.sessionId 绘制会话ID (可选)
   * @returns {Object} 绘制结果
   */
  async handlePixelDraw(params) {
    const {
      latitude,
      longitude,
      userId,
      drawType,
      color = null,
      patternId = null,
      anchorX = 0,
      anchorY = 0,
      rotation = 0,
      mirror = false,
      pixelType = 'basic',
      relatedId = null,
      sessionId = null,
      photoUrl = null,
      isPublic = false,
      allianceId = null // 🆕 获取allianceId参数
    } = params;

    const startTime = Date.now();

    try {
      logger.info(`🚀 开始高性能${drawType === 'gps' ? 'GPS' : '手动'}绘制像素`, {
        lat: latitude,
        lng: longitude,
        userId,
        patternId,
        drawType,
        optimization: 'async_geocoding+batch_processing'
      });

      // 1. 验证用户状态
      const validationResult = await this.validateUserState(userId);
      if (!validationResult.canDraw) {
        throw new Error(`用户无法绘制: ${validationResult.reason}`);
      }

      // 2. 🛡️ 安全检查：防御GPS模拟与速度异常
      // 🔧 性能优化：复用 validateUserState 已获取的 userState，消除冗余查询
      if (drawType === 'gps') {
        const securityMonitor = require('./securityMonitor');
        const lastActivity = validationResult.userState;

        if (lastActivity && lastActivity.last_latitude && lastActivity.last_longitude) {
          const isSuspicious = securityMonitor.isSpeedSuspicious(
            { lat: parseFloat(lastActivity.last_latitude), lng: parseFloat(lastActivity.last_longitude), timestamp: new Date(lastActivity.updated_at).getTime() },
            { lat: latitude, lng: longitude, timestamp: startTime }
          );

          // 🚨 Bypass for Development/Testing:
          // In development mode, we allow teleportation for testing purposes (e.g. moving to Tiananmen)
          const isDev = process.env.NODE_ENV !== 'production';

          if (isSuspicious && !isDev) {
            await securityMonitor.logGPSSpoofingAttempt(null, userId, {
              originalLat: lastActivity.last_latitude,
              originalLng: lastActivity.last_longitude,
              newLat: latitude,
              newLng: longitude,
              timeDiff: startTime - new Date(lastActivity.updated_at).getTime()
            });
            throw new Error('检测到异常地理位置跃迁，疑似使用虚拟定位');
          }
        }
      }

      // 2. 🔧 强制坐标网格对齐
      // 无论是GPS还是手动绘制，都将坐标对齐到网格中心，确保视觉效果完美
      const snapped = snapToGrid(latitude, longitude);

      // 使用对齐后的坐标进行后续处理
      const gridId = snapped.gridId;
      const snappedLat = snapped.lat;
      const snappedLng = snapped.lng;

      if (Math.abs(snappedLat - latitude) > 1e-9 || Math.abs(snappedLng - longitude) > 1e-9) {
        logger.debug('坐标已自动对齐', {
          original: { lat: latitude, lng: longitude },
          snapped: { lat: snappedLat, lng: snappedLng },
          gridId
        });
      }

      // 3. 🔧 修正：根据传入的allianceId（如果有）或默认用户联盟获取联盟旗帜
      const pixelInfo = await this.determinePixelFromAlliance(userId, color, patternId, allianceId);

      // 4. 消耗像素点数
      // 🔧 性能优化：传入已有 userState + 坐标，合并 last_latitude/last_longitude 更新
      const consumptionResult = await this.consumePixelPoint(validationResult.userState, drawType, { latitude: snappedLat, longitude: snappedLng });

      // 🔧 性能优化：session 管理异步化，不阻塞绘制关键路径
      // session DB 查询 (100-300ms) 移到 bgRun 中执行，消除写入长尾
      const activeSessionId = sessionId || null;

      const drawTime = new Date();

      // 异步处理 session 验证和创建（最终一致性）
      const capturedAllianceId = pixelInfo.allianceId || null;
      bgRun(async () => {
        try {
          let resolvedSessionId = sessionId;
          if (resolvedSessionId) {
            const existingSession = await db('drawing_sessions')
              .where('id', resolvedSessionId)
              .first();

            if (!existingSession) {
              await db('drawing_sessions').insert({
                id: resolvedSessionId,
                user_id: userId,
                session_name: `${drawType === 'gps' ? 'GPS' : '手动'}绘制`,
                drawing_type: drawType,
                status: 'active',
                alliance_id: capturedAllianceId,
                start_time: drawTime,
                created_at: drawTime,
                updated_at: drawTime
              });
              logger.debug(`✅ 异步创建session ${resolvedSessionId} 成功`);
            } else if (existingSession.user_id !== userId) {
              logger.warn(`Session ${resolvedSessionId} 属于其他用户，忽略`);
              resolvedSessionId = null;
            }
          }
          if (!resolvedSessionId) {
            const activeSession = await drawingSessionService.getActiveSession(userId);
            resolvedSessionId = (activeSession && activeSession.status === 'active') ? activeSession.id : null;
          }
          // If resolved session differs from what we used in pixelData, update asynchronously
          // (batch service will have already queued the pixel with the original sessionId)
        } catch (error) {
          logger.warn('异步session处理失败（不影响绘制）:', error.message);
        }
      });

      // 🆕 5. 创建像素数据（使用snake_case字段名）
      const pixelData = {
        gridId: gridId,
        latitude: snappedLat,
        longitude: snappedLng,
        userId: userId,
        color: pixelInfo.color,
        patternId: pixelInfo.patternId,
        pattern_anchor_x: pixelInfo.anchorX || anchorX,
        pattern_anchor_y: pixelInfo.anchorY || anchorY,
        pattern_rotation: pixelInfo.rotation || rotation,
        pattern_mirror: pixelInfo.mirror || mirror,
        pixelType: pixelType,
        relatedId: relatedId,
        sessionId: activeSessionId, // 🆕 添加session_id字段
        photo_url: photoUrl,
        is_public: isPublic,
        allianceId: pixelInfo.allianceId || null,
        created_at: drawTime,
        updated_at: drawTime
      };

      // 🆕 7. 创建历史记录数据（包含会话ID）
      const historyData = {
        latitude: snappedLat,
        longitude: snappedLng,
        color: pixelInfo.color,
        user_id: userId,
        grid_id: gridId,
        session_id: activeSessionId, // 添加会话ID
        pattern_id: pixelInfo.patternId,
        pattern_anchor_x: pixelInfo.anchorX || anchorX,
        pattern_anchor_y: pixelInfo.anchorY || anchorY,
        pattern_rotation: pixelInfo.rotation || rotation,
        pattern_mirror: pixelInfo.mirror || mirror,
        pixel_type: pixelType || 'basic',
        related_id: relatedId || null,
        alliance_id: pixelInfo.allianceId || null,
        action_type: drawType,
        history_date: drawTime.toISOString().slice(0, 10), // YYYY-MM-DD format for partitioning
        created_at: drawTime
      };

      // 🆕 8. 准备缓存更新项
      const cacheUpdates = [
        {
          type: 'pixel',
          key: `pixel:${gridId}`,
          value: {
            color: pixelInfo.color,
            patternId: pixelInfo.patternId,
            userId: userId,
            timestamp: new Date()
          }
        },
        {
          type: 'stats',
          key: 'stats:total_pixels',
          operation: 'increment'
        }
      ];

      // 🆕 9. 添加到批处理队列（高性能批量写入）
      // ✅ FIX 2026-02-22: 恢复历史记录写入，修复会话详情和分享页面数据缺失问题
      // 历史记录包含pattern_id，用于在分享页面显示联盟旗帜/用户头像
      const batchResult = await batchPixelService.addToBatch(pixelData, historyData, cacheUpdates);
      if (!batchResult.success) {
        logger.warn('批处理添加失败，降级到同步处理:', batchResult.error);
        // 降级到同步处理
        await this.fallbackSyncProcessing(pixelData, historyData, cacheUpdates);
      }

      // 🆕 10. 异步地理编码任务（高优先级，不阻塞主流程）
      // GPS绘制使用高优先级，手动绘制使用普通优先级
      const priority = drawType === 'gps' ? 'high' : 'normal';

      // 🔧 以下所有 fire-and-forget 操作通过 bgRun 并发限制器调度，防止 DB 连接池涌入

      // 启动地理编码任务
      bgRun(() => this.startGeocodingForPixel(gridId, snappedLat, snappedLng, drawType === 'gps' ? 'high' : 'normal', drawTime, historyData));

      // 🆕 11. 立即广播像素更新（实时反馈，无 DB 操作）
      this.broadcastPixelUpdateOptimized({
        id: gridId,
        grid_id: gridId,
        latitude: snappedLat,
        longitude: snappedLng,
        color: pixelInfo.color,
        pattern_id: pixelInfo.patternId,
        user_id: userId,
        material_id: pixelInfo.materialId
      }, drawType);

      // 🆕 12. 清理相关瓦片缓存（Redis 操作，无 DB）
      this.invalidateRelatedTileCacheOptimized(snappedLat, snappedLng, gridId);

      // 🆕 12.5. 检查带图打卡成就
      if (photoUrl && drawType === 'gps') {
        bgRun(() => this.checkPhotoAchievements(userId));
      }

      // 🔧 12.5. 清理 MVT 瓦片缓存（Redis 操作为主）
      bgRun(() => productionMVTService.invalidatePixelTiles(snappedLat, snappedLng));

      // 🆕 13. 更新用户总像素数
      bgRun(() => this.updateUserTotalPixels(userId, pixelInfo.allianceId));

      // 🆕 14. 记录绘制统计信息
      bgRun(() => this.recordDrawStatisticsOptimized(userId, drawType, gridId));

      // 🆕 14.5. 更新每日挑战进度
      bgRun(async () => {
        const challengeUpdates = [{ type: 'draw_count', increment: 1 }];
        if (patternId) {
          challengeUpdates.push({ type: 'pattern_draw', increment: 1 });
        }
        const region = await Region.findByCoordinates(snappedLat, snappedLng);
        if (region) {
          challengeUpdates.push({ type: 'region_draw', increment: 1 });
        }
        await DailyChallenge.batchUpdateProgress(userId, challengeUpdates);
      });

      // 🆕 15. 增量更新排行榜
      bgRun(() => incrementalLeaderboardService.handlePixelDraw({
        userId,
        gridId,
        allianceId: pixelInfo.allianceId || null,
        pixelType,
        timestamp: new Date()
      }));

      // ⚔️ 15.5. 检查赛事活动
      const eventService = require('./eventService');
      bgRun(async () => {
        const matchingEvents = await eventService.checkEventParticipation(snappedLat, snappedLng);
        if (matchingEvents && matchingEvents.length > 0) {
          for (const event of matchingEvents) {
            bgRun(() => eventService.recordPixelLog(event.id, {
              pixelId: gridId, userId, allianceId: pixelInfo.allianceId, x: 0, y: 0
            }));
            bgRun(() => eventService.processEventScores(event.id));
            this.socketManager.broadcastEventUpdate(event.id);
          }
        }
      });

      const processingTime = Date.now() - startTime;

      logger.info(`✅ 高性能${drawType === 'gps' ? 'GPS' : '手动'}绘制完成`, {
        gridId: gridId,
        processingTime: `${processingTime}ms`,
        remainingPoints: consumptionResult.remainingPoints,
        batchQueueSize: batchResult.queueSize,
        asyncGeocoding: 'queued',
        incrementalLeaderboard: 'queued',
        optimizations: ['async_geocoding', 'batch_writes', 'async_cache', 'incremental_leaderboard']
      });

      // 🔧 对于用户头像类型，需要返回 image_url 以便前端动态加载 sprite
      // 🔧 性能优化：从 validateUserState 已获取的 user 对象中读取 avatar_url，避免额外查询
      let imageUrl = null;
      if (pixelInfo.patternId && pixelInfo.patternId.startsWith('user_avatar_')) {
        let rawUrl = validationResult.user?.avatar_url || null;
        if (rawUrl) {
          try {
            const parsedUrl = new URL(rawUrl);
            imageUrl = parsedUrl.pathname;
          } catch {
            imageUrl = rawUrl;
          }
          logger.info(`✅ 返回用户头像相对路径: ${imageUrl}`);
        }
      }

      // 🆕 返回优化的结果（不包含完整像素对象，因为地理信息异步处理）
      return {
        success: true,
        pixel: {
          id: gridId, // 临时ID
          grid_id: gridId,
          latitude: snappedLat,
          longitude: snappedLng,
          color: pixelInfo.color,
          pattern_id: pixelInfo.patternId,
          user_id: userId,
          material_id: pixelInfo.materialId, // 🆕 Include materialId in response
          image_url: imageUrl, // 🆕 用户头像 URL（用于前端动态加载 sprite）
          // payload removed: iOS uses local currentPattern.payload, no need to send base64 over the wire
          // 地理信息将在异步处理完成后添加
          geocoding_status: 'pending'
        },
        consumptionResult,
        processingTime,
        drawType,
        optimizations: {
          asyncGeocoding: true,
          batchProcessing: true,
          incrementalLeaderboard: true,
          estimatedTimeSaved: '100-200ms'
        }
      };

    } catch (error) {
      logger.error(`❌ 高性能${drawType === 'gps' ? 'GPS' : '手动'}绘制失败`, {
        error: error.message,
        userId,
        latitude,
        longitude,
        stack: error.stack
      });
      return {
        success: false,
        error: error.message,
        drawType
      };
    }
  }

  /**
   * 添加像素更新到Redis Stream
   * 适配Upstash Redis（不支持Stream操作）
   */
  async addPixelUpdateToStream(pixel, drawType) {
    try {
      // 检查是否为Upstash Redis（不支持Stream操作）
      if (process.env.UPSTASH_REDIS_REST_URL) {
        logger.debug('Upstash Redis环境，跳过Stream操作（直接数据库操作）');
        return null;
      }

      // 检查Redis是否支持xAdd方法
      if (typeof redisUtils.xAdd !== 'function') {
        logger.debug('Redis不支持xAdd方法，跳过Stream操作');
        return null;
      }

      const entry = {
        tileId: this.calculateTileId(pixel.latitude, pixel.longitude),
        cellId: pixel.grid_id,
        latitude: pixel.latitude.toString(),
        longitude: pixel.longitude.toString(),
        lat: pixel.latitude.toString(),
        lng: pixel.longitude.toString(),
        color: pixel.color,
        pattern: pixel.pattern_id,
        userId: pixel.user_id,
        drawType: drawType,
        timestamp: Date.now().toString()
      };

      // 🔧 修复：将对象转换为键值对数组
      const fields = [];
      for (const [key, value] of Object.entries(entry)) {
        fields.push(key, value);
      }

      const result = await redisUtils.xAdd(this.streamKey, '*', ...fields);
      logger.debug('像素更新已添加到Stream', { result });
      return result;
    } catch (error) {
      logger.error('添加像素更新到Stream失败', { error: error.message });
      // 不抛出错误，避免影响主流程
      return null;
    }
  }

  /**
   * 计算瓦片ID
   */
  calculateTileId(latitude, longitude, zoom = 14) {
    const tileSize = 1 / Math.pow(2, zoom);
    const x = Math.floor((longitude + 180) / tileSize);
    const y = Math.floor((90 - latitude) / tileSize);
    return `z${zoom}/${x}/${y}`;
  }

  /**
   * 批量持久化Redis Stream到数据库
   * 适配Upstash Redis（不支持xRead）
   */
  async flushStreamToDatabase() {
    if (this.isFlushing) {
      console.log('⏳ 正在执行持久化，跳过本次任务');
      return;
    }

    this.isFlushing = true;

    try {
      console.log('🔄 开始批量持久化Stream到数据库...');

      // 检查是否为Upstash Redis（不支持Stream操作）
      if (process.env.UPSTASH_REDIS_REST_URL) {
        console.log('📝 Upstash Redis环境，跳过Stream持久化（使用直接数据库操作）');
        return;
      }

      // 检查Redis是否支持xRead方法
      if (typeof redisUtils.xRead !== 'function') {
        console.log('📝 Redis不支持xRead方法，跳过Stream持久化');
        return;
      }

      // 读取Stream中的条目
      const entries = await redisUtils.xRead(
        [{ key: this.streamKey, id: '0' }],
        { COUNT: this.batchSize }
      );

      if (!entries || !entries[0]?.messages || entries[0].messages.length === 0) {
        console.log('📭 Stream中没有新数据需要持久化');
        return;
      }

      const messages = entries[0].messages;
      console.log(`📊 准备持久化 ${messages.length} 条记录`);

      // 批量插入到数据库
      await this.batchInsertToDatabase(messages);

      // 删除已处理的条目
      const messageIds = messages.map(m => m.id);
      if (typeof redisUtils.xDel === 'function') {
        await redisUtils.xDel(this.streamKey, ...messageIds);
      }

      console.log(`✅ 成功持久化 ${messages.length} 条记录`);

    } catch (error) {
      console.error('❌ 批量持久化失败:', error);
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * 批量插入到数据库
   */
  async batchInsertToDatabase(messages) {
    const pixels = messages.map(msg => {
      const data = msg.message;

      // 🔧 修复：安全地处理时间戳
      let timestamp;
      if (data.timestamp) {
        const parsedTimestamp = parseInt(data.timestamp);
        if (!isNaN(parsedTimestamp) && parsedTimestamp > 0) {
          timestamp = new Date(parsedTimestamp);
        } else {
          console.warn('⚠️ 无效的时间戳，使用当前时间:', data.timestamp);
          timestamp = new Date();
        }
      } else {
        console.warn('⚠️ 缺少时间戳字段，使用当前时间');
        timestamp = new Date();
      }

      return {
        grid_id: data.cellId,
        latitude: parseFloat(data.lat),
        longitude: parseFloat(data.lng),
        color: data.color,
        pattern_id: data.pattern,
        user_id: data.userId,
        pixel_type: 'basic', // 手动绘制默认为basic类型
        related_id: null,
        created_at: timestamp,
        updated_at: timestamp
      };
    });

    // 使用Knex批量插入
    await db('pixels')
      .insert(pixels)
      .onConflict('grid_id')
      .merge(['color', 'pattern_id', 'user_id', 'pixel_type', 'related_id', 'updated_at']);
  }

  /**
   * 启动定期持久化任务
   */
  startPeriodicFlush() {
    setInterval(async () => {
      try {
        await this.flushStreamToDatabase();
      } catch (error) {
        console.error('❌ 定期持久化任务失败:', error);
      }
    }, this.flushInterval);

    console.log(`🔄 启动定期持久化任务，间隔: ${this.flushInterval}ms`);
  }

  /**
   * 获取Stream统计信息
   */
  async getStreamStats() {
    try {
      const info = await redis.xInfo('STREAM', this.streamKey);
      return {
        length: info.length,
        lastGeneratedId: info.lastGeneratedId,
        firstEntry: info.firstEntry,
        lastEntry: info.lastEntry
      };
    } catch (error) {
      console.error('❌ 获取Stream统计信息失败:', error);
      return null;
    }
  }

  /**
   * 手动触发持久化
   */
  async manualFlush() {
    console.log('🔄 手动触发持久化...');
    await this.flushStreamToDatabase();
  }

  /**
   * 验证用户状态（使用分离的点数系统）
   */
  /**
   * 检查照片打卡成就
   * @param {string} userId 
   */
  async checkPhotoAchievements(userId) {
    try {
      // Dynamic require to avoid circular dependency
      const Achievement = require('../models/Achievement');
      // 查找 "Social Butterfly" 成就 (ID或名称匹配)
      // 这里简化处理，直接增加计数
      // 在实际系统中，会有专门的 UserAchievementService
      // 这里我们简单日志一下，因为我们刚刚并未实现完整的 UserAchievementService 逻辑
      logger.info('Checking photo achievements', { userId });

      // 示例：查询成就定义
      const achievement = await Achievement.query().findOne({ name: 'Social Butterfly' });
      if (achievement) {
        // 简单的插入或更新逻辑可以放在这里，或者是调用专门的 Service
        logger.info('Should update progress for Social Butterfly', { userId, achievementId: achievement.id });
      }
    } catch (error) {
      logger.error('Photo achievement check error', error);
    }
  }

  async validateUserState(userId, retryCount = 0) {
    const maxRetries = 2;
    try {
      // 检查是否为游客用户
      if (userId.startsWith('guest_')) {
        console.log('🔍 检测到游客用户，跳过数据库验证:', userId);
        // 游客用户默认可以绘制，但需要检查游客状态
        return { canDraw: true, reason: '游客用户' };
      }

      // 检查用户是否存在
      const user = await User.findById(userId);
      if (!user) {
        console.log('❌ 用户不存在:', userId);
        return { canDraw: false, reason: '用户不存在' };
      }

      console.log('✅ 用户验证通过:', { userId, userRole: user.role, isBanned: user.is_banned });

      // 检查用户状态（使用role字段，排除banned用户）
      if (user.is_banned) {
        return { canDraw: false, reason: '用户已被封禁' };
      }

      // 检查用户像素状态
      const userState = await UserPixelState.findByUserId(userId);
      if (!userState) {
        console.log('❌ 用户状态未初始化:', userId);
        return { canDraw: false, reason: '用户状态未初始化' };
      }

      console.log('✅ 用户状态获取成功:', {
        userId,
        pixelPoints: userState.pixel_points,
        itemPoints: userState.item_pixel_points,
        naturalPoints: userState.natural_pixel_points,
        freezeUntil: userState.freeze_until,
        isInNaturalAccumulation: userState.is_in_natural_accumulation
      });

      // ==========================================
      // 统一响应构建器
      // ==========================================
      const buildResponse = (canDraw, reason = null) => {
        const nowSec = Math.floor(Date.now() / 1000);
        return {
          canDraw,
          reason,
          itemPoints: userState?.item_pixel_points || 0,
          naturalPoints: userState?.natural_pixel_points || 0,
          totalPoints: userState ? ((userState.item_pixel_points || 0) + (userState.natural_pixel_points || 0)) : 0,
          freezeTimeLeft: userState ? Math.max(0, Number(userState.freeze_until || 0) - nowSec) : 0,
          maxNaturalPoints: userState?.max_natural_pixel_points || 64,
          isInNaturalAccumulation: userState?.is_in_natural_accumulation || false,
          lastActivityTime: String(userState?.last_activity_time || nowSec),
          lastAccumTime: String(userState?.last_accum_time || 0),
          userState, // 保留原始对象以备不时之需
          user // 🔧 性能优化：传递用户信息（含avatar_url），避免后续额外查询
        };
      };

      // 🔧 性能优化：传入已有的 userState，避免 refreshState 内部重复查询
      const refreshedState = await UserPixelState.refreshState(userId, userState);
      if (refreshedState) {
        Object.assign(userState, refreshedState);
      }

      // 检查冻结状态
      const now = Math.floor(Date.now() / 1000);
      if ((userState.freeze_until || 0) > now) {
        return buildResponse(false, '用户处于冷冻期');
      }

      // 检查是否有足够的像素点数（道具点数 + 自然点数）
      const totalPoints = (userState.item_pixel_points || 0) + (userState.natural_pixel_points || 0);
      if (totalPoints <= 0) {
        return buildResponse(false, '像素点数不足');
      }

      // 检查冷却时间（使用updated_at字段）
      const lastDrawTime = userState.updated_at ? new Date(userState.updated_at).getTime() : 0;
      const cooldownTime = 100; // 100ms

      if (Date.now() - lastDrawTime < cooldownTime) {
        return buildResponse(false, '绘制冷却中');
      }

      // 返回完整的用户状态信息
      return buildResponse(true);
    } catch (error) {
      console.error('❌ 验证用户状态失败:', error);
      console.error('❌ 错误详情:', {
        userId,
        errorMessage: error.message,
        errorStack: error.stack,
        retryCount,
        timestamp: new Date().toISOString()
      });

      // 如果是数据库连接错误且还有重试次数，则重试
      if (retryCount < maxRetries && (
        error.message.includes('connection') ||
        error.message.includes('timeout') ||
        error.message.includes('ECONNRESET')
      )) {
        console.log(`🔄 数据库连接错误，进行第${retryCount + 1}次重试...`);
        await new Promise(resolve => setTimeout(resolve, 100 * (retryCount + 1))); // 递增延迟
        return this.validateUserState(userId, retryCount + 1);
      }

      return { canDraw: false, reason: `验证失败: ${error.message}` };
    }
  }

  /**
   * 创建像素记录
   */
  async createPixelRecord(pixelData) {
    try {
      const {
        latitude,
        longitude,
        userId,
        patternId,
        anchorX,
        anchorY,
        rotation,
        mirror,
        color,
        pixelType = 'basic',
        relatedId = null
      } = pixelData;

      console.log('🔍 createPixelRecord 接收到的数据:', {
        latitude,
        longitude,
        userId,
        patternId,
        anchorX,
        anchorY,
        rotation,
        mirror,
        color,
        pixelType,
        relatedId
      });

      // 计算网格ID
      const gridId = calculateGridId(latitude, longitude);

      // 🔧 修复：确保patternId不为null或undefined
      let finalPatternId = patternId;
      if (!finalPatternId) {
        console.log('⚠️ patternId为空，将不设置图案，使用纯色渲染');
        finalPatternId = null; // 保持为null，让瓦片渲染器使用颜色渲染
      } else {
        console.log(`✅ 使用图案ID: ${finalPatternId}`);
      }

      // 🔧 修复：自定义图案颜色设置逻辑
      let pixelColor = color;

      // 🔧 修复：处理前端传递的custom_pattern标识符
      if (pixelColor === 'custom_pattern' && finalPatternId) {
        console.log(`✅ 检测到自定义图案标识符，pattern_id: ${finalPatternId}`);
        // 保持custom_pattern标识符，让瓦片渲染器处理图案渲染
        pixelColor = 'custom_pattern';
      } else if (!pixelColor) {
        // 如果有pattern_id，使用'custom_pattern'作为颜色标识
        if (finalPatternId) {
          pixelColor = 'custom_pattern';
          console.log(`✅ 自定义图案像素，使用颜色标识: custom_pattern`);
        } else {
          // 检查是否为游客用户
          if (userId.startsWith('guest_')) {
            // 游客用户使用默认颜色
            pixelColor = DEFAULT_COLOR;
          } else {
            // 通过Alliance模型获取用户联盟颜色
            const Alliance = require('../models/Alliance');
            try {
              const alliance = await Alliance.getUserAlliance(userId);
              if (alliance && alliance.color) {
                // 用户有联盟且联盟有颜色，使用联盟颜色
                pixelColor = alliance.color;
              } else {
                // 用户未加入联盟，使用默认颜色
                pixelColor = DEFAULT_COLOR;
              }
            } catch (error) {
              console.error('❌ 获取用户联盟信息失败:', error);
              // 如果获取联盟信息失败，使用默认颜色
              pixelColor = DEFAULT_COLOR;
            }
          }
        }
      } else {
        // 前端传递了具体的颜色值，直接使用
        console.log(`✅ 使用前端传递的颜色: ${pixelColor}`);
      }

      // 创建像素记录
      const pixel = await Pixel.createOrUpdate({
        gridId: gridId,
        latitude,
        longitude,
        userId: userId,
        patternId: finalPatternId, // 使用验证后的patternId
        anchorX: anchorX,
        anchorY: anchorY,
        rotation: rotation,
        mirror: mirror,
        color: pixelColor, // 传递颜色参数
        pixelType: pixelType,
        relatedId: relatedId
      });

      return pixel;
    } catch (error) {
      console.error('❌ 创建像素记录失败:', error);
      throw error;
    }
  }

  /**
   * 消耗像素点数（使用分离的点数系统）
   * 🔧 性能优化：接收已有的 userState，合并所有 UPDATE 为单次操作
   * @param {Object} existingUserState - 已从 validateUserState 获取的用户状态
   * @param {string} drawType - 绘制类型
   * @param {Object|null} coordinates - 可选，{latitude, longitude} 合并写入避免额外 UPDATE
   */
  async consumePixelPoint(existingUserState, drawType, coordinates = null) {
    try {
      const userId = existingUserState.user_id;
      const pointsToConsume = 1;
      const now = Math.floor(Date.now() / 1000);
      const freezeUntil = Number(existingUserState.freeze_until);

      // 检查是否处于冻结状态
      if (freezeUntil > 0) {
        if (now >= freezeUntil) {
          // 冻结期已过，进入自然累计阶段
          const newNaturalPoints = Math.min(1, existingUserState.max_natural_pixel_points || 64);
          const totalPoints = (existingUserState.item_pixel_points || 0) + newNaturalPoints;

          const updateFields = {
            natural_pixel_points: newNaturalPoints,
            pixel_points: totalPoints,
            last_activity_time: now,
            is_in_natural_accumulation: true,
            freeze_until: 0
          };
          if (coordinates) {
            updateFields.last_latitude = coordinates.latitude;
            updateFields.last_longitude = coordinates.longitude;
          }

          await UserPixelState.update(userId, updateFields);
          console.log('✅ 冻结期已过，进入自然累计阶段');

          return {
            consumed: 0,
            remainingPoints: totalPoints,
            itemPoints: existingUserState.item_pixel_points || 0,
            naturalPoints: newNaturalPoints,
            freezeUntil: 0,
            recovered: true
          };
        } else {
          throw new Error('用户处于冻结状态，无法绘制');
        }
      }

      // 检查总点数是否足够
      const totalPoints = (existingUserState.item_pixel_points || 0) + (existingUserState.natural_pixel_points || 0);
      if (totalPoints < pointsToConsume) {
        throw new Error('像素点数不足');
      }

      // 优先消耗道具像素点数，然后消耗自然累计像素点数
      let newItemPoints = existingUserState.item_pixel_points || 0;
      let newNaturalPoints = existingUserState.natural_pixel_points || 0;

      if (newItemPoints > 0) {
        newItemPoints -= pointsToConsume;
      } else {
        newNaturalPoints -= pointsToConsume;
      }

      const newTotalPoints = newItemPoints + newNaturalPoints;
      const newFreezeUntil = newTotalPoints === 0 ? now + 10 : 0;

      // 🔧 合并所有更新为单次 UPDATE：扣点 + 停止自然累计 + 冻结设置 + 位置更新
      const updateFields = {
        item_pixel_points: newItemPoints,
        natural_pixel_points: newNaturalPoints,
        pixel_points: newTotalPoints,
        freeze_until: newFreezeUntil,
        is_in_natural_accumulation: false,
        last_activity_time: now
      };
      if (coordinates) {
        updateFields.last_latitude = coordinates.latitude;
        updateFields.last_longitude = coordinates.longitude;
      }

      await UserPixelState.update(userId, updateFields);

      console.log(`✅ 消耗${pointsToConsume}点，剩余道具点数: ${newItemPoints}, 剩余自然点数: ${newNaturalPoints}, 冻结时间: ${newFreezeUntil}`);

      return {
        consumed: pointsToConsume,
        remainingPoints: newTotalPoints,
        itemPoints: newItemPoints,
        naturalPoints: newNaturalPoints,
        freezeUntil: newFreezeUntil
      };
    } catch (error) {
      console.error('❌ 消耗像素点数失败:', error);
      throw error;
    }
  }

  /**
   * 广播像素更新
   */
  async broadcastPixelUpdate(pixel, drawType) {
    try {
      // 计算瓦片ID
      const tileId = this.calculateTileId(pixel.latitude, pixel.longitude);

      // 附加 render_type（pattern_id 对应 pattern_assets.key）
      let renderType = null;
      const patternKey = pixel.pattern_id;
      if (patternKey) {
        const pattern = await db('pattern_assets')
          .where('key', patternKey)
          .select('render_type')
          .first();
        renderType = pattern?.render_type || null;
      }

      // 通过SocketManager广播到瓦片房间
      if (this.socketManager) {
        await this.socketManager.broadcastTilePixelUpdate(tileId, {
          gridId: pixel.grid_id,
          latitude: pixel.latitude,
          longitude: pixel.longitude,
          color: pixel.color,
          patternId: pixel.pattern_id,
          userId: pixel.user_id,
          renderType,
          drawType: drawType,
          timestamp: Date.now()
        });
      }

      // 全局广播（已废弃，改用瓦片房间广播以提高性能）
      // 注：broadcastTilePixelUpdate 已经更高效地完成了此功能
    } catch (error) {
      console.error('❌ 广播像素更新失败:', error);
    }
  }

  /**
   * 清理相关瓦片缓存
   * 确保新像素能正确显示，特别是emoji和图案
   */
  async invalidateRelatedTileCache(pixel) {
    try {
      // 计算包含该像素的瓦片ID（多个缩放级别）
      const zoomLevels = [10, 11, 12, 13, 14, 15, 16];
      const tilesToInvalidate = [];

      for (const zoom of zoomLevels) {
        const tileId = this.calculateTileId(pixel.latitude, pixel.longitude, zoom);
        tilesToInvalidate.push(tileId);
      }

      // 发送瓦片失效事件到前端（通过瓦片房间广播）
      if (this.socketManager && this.socketManager.io) {
        tilesToInvalidate.forEach(tileId => {
          this.socketManager.io.emit('tileInvalidate', {
            tileId: tileId,
            pixelGridId: pixel.grid_id,
            reason: 'pixelUpdate',
            timestamp: Date.now()
          });
        });
      }

      // 清理Redis中的瓦片缓存
      try {
        const cacheKeys = tilesToInvalidate.map(tileId => `tile:hot:${tileId}`);
        if (redis && typeof redis.del === 'function') {
          await redis.del(...cacheKeys);
          console.log(`🧹 清理瓦片缓存: ${cacheKeys.length}个瓦片`);
        }
      } catch (redisError) {
        console.warn('⚠️ 清理Redis瓦片缓存失败（非关键错误）:', redisError.message);
      }

      console.log(`✅ 瓦片缓存失效通知已发送: ${tilesToInvalidate.length}个瓦片`);
    } catch (error) {
      console.error('❌ 清理瓦片缓存失败:', error);
      // 不抛出错误，避免影响主流程
    }
  }

  /**
   * 更新缓存
   */
  async updateCache(pixel) {
    try {
      // 更新像素缓存
      await CacheService.setPixel(pixel.grid_id, {
        color: pixel.color,
        patternId: pixel.pattern_id,
        userId: pixel.user_id,
        timestamp: pixel.updated_at
      });

      // 更新统计缓存
      await CacheService.incrementPixelCount();
    } catch (error) {
      console.error('❌ 更新缓存失败:', error);
    }
  }

  /**
   * 记录绘制统计信息
   */
  async recordDrawStatistics(pixel, drawType) {
    try {
      // 这里可以添加统计记录逻辑
      console.log(`📊 记录绘制统计: ${drawType}绘制, 用户${pixel.user_id}`);
    } catch (error) {
      console.error('❌ 记录绘制统计失败:', error);
    }
  }

  /**
   * 记录像素历史
   * 🆕 改为同步记录，包含完整地理信息（现在在Pixel.createOrUpdate中处理）
   * @param {Object} pixel - 像素对象
   * @param {string} drawType - 绘制类型
   */
  async recordPixelHistory(pixel, drawType) {
    try {
      // 🆕 现在在Pixel.createOrUpdate中同步处理历史记录
      // 这里保留方法以确保兼容性，但实际操作已移动到Pixel模型中
      console.log(`📝 像素历史记录已移动到Pixel.createOrUpdate中处理: ${pixel.id}`);
      return { success: true, message: '历史记录已同步处理' };
    } catch (error) {
      console.error('❌ 记录像素历史时发生错误:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 批量记录像素历史（用于炸弹等批量操作）
   * @param {Array} pixels - 像素数组
   * @param {string} actionType - 操作类型
   */
  async batchRecordPixelHistory(pixels, actionType) {
    try {
      const pixelsData = pixels.map(pixel => ({
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
        pixel_type: pixel.pixel_type || 'basic',
        related_id: pixel.related_id || null
      }));

      const historyResult = await pixelsHistoryService.batchRecordPixelHistory(
        pixelsData,
        actionType,
        {
          version: 1
        }
      );

      if (historyResult.success) {
        console.log(`📝 批量像素历史记录成功: ${pixels.length} 条记录`);
      } else {
        console.warn(`⚠️ 批量像素历史记录失败: ${historyResult.error}`);
      }
    } catch (error) {
      console.error('❌ 批量记录像素历史时发生错误:', error);
    }
  }

  /**
   * 批量绘制像素
   * @param {Array} pixelDataArray - 像素数据数组
   * @returns {Object} 批量绘制结果
   */
  async handleBatchPixelDraw(pixelDataArray) {
    const startTime = Date.now();
    const results = [];
    let successCount = 0;
    let failureCount = 0;

    try {
      logger.info(`开始批量绘制像素: ${pixelDataArray.length}个`);

      // 并行处理所有像素
      const promises = pixelDataArray.map(async (pixelData) => {
        try {
          const result = await this.handlePixelDraw(pixelData);
          if (result.success) {
            successCount++;
          } else {
            failureCount++;
          }
          return result;
        } catch (error) {
          failureCount++;
          return {
            success: false,
            error: error.message,
            drawType: pixelData.drawType
          };
        }
      });

      const batchResults = await Promise.allSettled(promises);

      // 处理结果
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            success: false,
            error: result.reason.message,
            drawType: pixelDataArray[index].drawType
          });
          failureCount++;
        }
      });

      const processingTime = Date.now() - startTime;

      logger.info(`批量绘制完成: 成功${successCount}个, 失败${failureCount}个, 耗时${processingTime}ms`);

      return {
        success: true,
        totalPixels: pixelDataArray.length,
        successCount,
        failureCount,
        processingTime,
        results
      };

    } catch (error) {
      logger.error('批量绘制失败:', error);
      return {
        success: false,
        error: error.message,
        totalPixels: pixelDataArray.length,
        successCount,
        failureCount,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * 更新用户总像素数（只统计真实绘制像素）
   * 使用 increment 原子操作避免并发问题
   */
  async updateUserTotalPixels(userId, allianceId = null) {
    try {
      logger.debug(`🔄 开始更新用户 ${userId} 真实总像素数...`);

      // 🔧 使用单次 UPDATE 原子操作同时递增 total_pixels 和 real_total_pixels
      const result = await db('users')
        .where('id', userId)
        .update({
          total_pixels: db.raw('total_pixels + 1'),
          real_total_pixels: db.raw('real_total_pixels + 1')
        })
        .returning('total_pixels');

      const updatedTotalPixels = result && result[0] ? result[0].total_pixels : null;

      // 🏆 同步更新成就统计
      try {
        const statsUpdate = { pixels_drawn_count: 1 };
        if (allianceId) {
          statsUpdate.alliance_contributions = 1;
        }
        await Achievement.updateUserStats(userId, statsUpdate);
        logger.debug(`🏆 用户 ${userId} 成就统计已更新: pixels_drawn_count+1${allianceId ? ', alliance_contributions+1' : ''}`);
      } catch (achievementError) {
        logger.error(`❌ 更新用户 ${userId} 成就统计失败:`, achievementError);
      }

      logger.debug(`✅ 用户 ${userId} 真实像素统计更新成功: total_pixels=${updatedTotalPixels}, real_total_pixels+1`);

      // 🔧 清除用户缓存，确保前端能获取到最新数据
      const AuthController = require('../controllers/authController');
      if (AuthController.clearUserCache) {
        AuthController.clearUserCache(userId);
      }
      User.clearCache(userId);

      logger.info(`✅ 用户 ${userId} 总像素数已更新: ${updatedTotalPixels}`);

      return {
        success: true,
        totalPixels: updatedTotalPixels
      };
    } catch (error) {
      logger.error(`❌ 更新用户 ${userId} 总像素数失败:`, error);

      // 如果 increment 失败，尝试从 pixels 表统计并更新
      try {
        logger.warn(`⚠️ increment失败，尝试从pixels表统计...`);

        const pixelCount = await db('pixels')
          .where('user_id', userId)
          .count('* as count')
          .first();

        const totalPixels = parseInt(pixelCount.count) || 0;

        await db('users')
          .where('id', userId)
          .update({
            total_pixels: totalPixels,
            updated_at: new Date()
          });

        // 🔧 清除用户缓存，确保前端能获取到最新数据
        const AuthController = require('./authController');
        if (AuthController.clearUserCache) {
          AuthController.clearUserCache(userId);
        }

        logger.info(`✅ 用户 ${userId} 总像素数已通过统计更新: ${totalPixels}`);

        return {
          success: true,
          totalPixels,
          method: 'fallback'
        };
      } catch (fallbackError) {
        logger.error(`❌ 降级统计也失败:`, fallbackError);
        return {
          success: false,
          error: fallbackError.message
        };
      }
    }
  }

  /**
   * 异步添加地区信息到像素（逆地理编码）
   * @param {number} pixelId - 像素ID
   * @param {number} latitude - 纬度
   * @param {number} longitude - 经度
   */
  async addLocationInfoToPixel(pixelId, latitude, longitude) {
    try {
      const geocodingService = require('./geocodingService');

      // 调用逆地理编码服务
      const locationInfo = await geocodingService.reverseGeocode(latitude, longitude);

      // 更新像素的地区信息
      await db('pixels')
        .where('id', pixelId)
        .update(locationInfo);

      logger.info(`✅ 像素 ${pixelId} 地区信息已更新: ${locationInfo.province} ${locationInfo.city}`);
    } catch (error) {
      logger.error(`❌ 更新像素 ${pixelId} 地区信息失败:`, error);
      // 不抛出错误，避免影响主流程
    }
  }

  /**
   * 获取服务统计信息
   */
  async getServiceStats() {
    try {
      const streamStats = await this.getStreamStats();
      const batchStats = batchPixelService.getStats();
      const geocodingStats = await asyncGeocodingService.getQueueStats();
      const leaderboardStats = incrementalLeaderboardService.getStats();

      return {
        streamStats,
        batchStats,
        geocodingStats,
        leaderboardStats,
        flushInterval: this.flushInterval,
        batchSize: this.batchSize,
        isFlushing: this.isFlushing,
        optimization: {
          enabled: true,
          services: ['async_geocoding', 'batch_processing', 'intelligent_cache', 'incremental_leaderboard']
        }
      };
    } catch (error) {
      console.error('❌ 获取服务统计失败:', error);
      return null;
    }
  }

  // 🆕 优化的辅助方法

  /**
   * 🔧 新增：直接通过用户所属联盟获取联盟旗帜信息
   * @param {string} userId 用户ID
   * @param {string} color 前端传递的颜色（一般不使用）
   * @param {string} patternId 前端传递的图案ID（一般不使用）
   * @param {string} allianceId 明确指定的联盟ID（可选）
   * @returns {Object} 像素信息 {color, patternId, anchorX, anchorY, rotation, mirror}
   */
  async determinePixelFromAlliance(userId, color, patternId, allianceId) {
    try {
      const Alliance = require('../models/Alliance');
      let alliance;

      // 🔧 核心修正：如果客户端没有传 allianceId，处理个人头像/个人色模式
      if (!allianceId) {
        // 1️⃣ 检查是否为个人头像模式（patternId 以 user_avatar_ 开头）
        if (patternId && patternId.startsWith('user_avatar_')) {
          logger.info(`✅ 个人头像模式绘制（complex）: patternId=${patternId}`);
          return {
            color: 'custom_pattern', // 使用 custom_pattern 标识符让渲染器识别为复杂图案
            patternId: patternId,
            anchorX: 0,
            anchorY: 0,
            rotation: 0,
            mirror: false,
            allianceId: null,
            materialId: userId
          };
        }

        // 2️⃣ 检查是否为个人颜色模式（patternId 以 personal_color_ 开头）
        if (patternId && patternId.startsWith('personal_color_')) {
          // 直接使用客户端传递的 patternId，对应 pattern_assets 中的记录
          const pattern = await db('pattern_assets')
            .where('key', patternId)
            .select('color', 'render_type')
            .first();

          const finalColor = pattern?.color || color || '#4ECDC4';
          logger.info(`✅ 个人颜色模式绘制: patternId=${patternId}, color=${finalColor}`);
          return {
            color: finalColor,
            patternId: patternId,
            anchorX: 0,
            anchorY: 0,
            rotation: 0,
            mirror: false,
            allianceId: null,
            materialId: null
          };
        }

        // 3️⃣ 兜底：如果只传了颜色，生成对应的 personal_color pattern
        if (color && color !== 'custom_pattern') {
          const personalPatternId = `personal_color_${color.replace('#', '').toLowerCase()}`;
          logger.info(`✅ 个人模式绘制（无联盟ID）: color=${color}, patternId=${personalPatternId}`);
          return {
            color: color,
            patternId: personalPatternId,
            anchorX: 0,
            anchorY: 0,
            rotation: 0,
            mirror: false,
            allianceId: null,
            materialId: null
          };
        }
      }

      // 🚀 性能优化：尝试从 Redis 缓存获取联盟旗帜信息（TTL=5min）
      // 缓存整个联盟旗帜结果，消除 2-3 次 DB 查询
      const ALLIANCE_CACHE_TTL = 300; // 5 分钟
      const cacheKey = allianceId ? `user_alliance:${userId}:${allianceId}` : `user_alliance:${userId}`;
      try {
        const cached = await redisUtils.get(cacheKey);
        if (cached) {
          const info = JSON.parse(cached);
          logger.debug(`✅ Alliance cache HIT: userId=${userId}`);
          return info;
        }
      } catch (_) {
        // Redis unavailable, fall through to DB
      }

      // 1. 如果指定了allianceId，优先使用
      if (allianceId) {
        // 验证用户是否为该联盟成员
        const membership = await Alliance.findById(allianceId);
        if (membership) {
          // 还需要确认用户是否真的是成员
          const isMember = await membership.isMember(userId);
          if (isMember) {
            alliance = membership;
            logger.debug(`✅ 使用指定联盟: ID=${allianceId}, Name=${alliance.name}`);
          } else {
            logger.warn(`⚠️ 用户 ${userId} 尝试使用非所属联盟 ${allianceId} 绘图，回退到默认联盟`);
          }
        }
      }

      // 2. 如果没有指定或指定无效，回退到默认（第一个活跃）联盟
      if (!alliance) {
        alliance = await Alliance.getUserAlliance(userId);
        if (alliance) {
          logger.debug(`✅ 使用默认联盟: ID=${alliance.id}, Name=${alliance.name}`);
        }
      }

      if (!alliance || !alliance.flag_pattern_id) {
        // 没有联盟或联盟没有旗帜，使用默认绿色
        const result = {
          color: alliance?.color || '#4ECDC4', // 使用联盟颜色或默认绿色
          patternId: 'personal_color_4ecdc4',
          anchorX: 0,
          anchorY: 0,
          rotation: 0,
          mirror: false,
          allianceId: alliance?.id || null, // 🆕 返回联盟ID
          materialId: null
        };
        // 缓存结果（即使是无联盟的结果也缓存，避免重复查询）
        try { redisUtils.setex(cacheKey, ALLIANCE_CACHE_TTL, JSON.stringify(result)).catch(() => {}); } catch (_) {}
        return result;
      }

      // 查询 pattern_assets 表获取旗帜详细信息（不查询 payload 列以节省内存）
      const dbConfig = require('../config/database');
      const pattern = await dbConfig.db('pattern_assets')
        .where('key', alliance.flag_pattern_id)
        .select('key', 'render_type', 'color', 'unicode_char', 'material_id')
        .first();

      if (!pattern) {
        logger.warn(`联盟旗帜未找到: flag_pattern_id=${alliance.flag_pattern_id}`);
        const result = {
          color: alliance.color || '#4ECDC4', // 使用联盟颜色或默认绿色
          patternId: alliance.flag_pattern_id || 'personal_color_4ecdc4',
          anchorX: 0,
          anchorY: 0,
          rotation: 0,
          mirror: false,
          allianceId: alliance.id, // 🆕 返回联盟ID
          materialId: null
        };
        try { redisUtils.setex(cacheKey, ALLIANCE_CACHE_TTL, JSON.stringify(result)).catch(() => {}); } catch (_) {}
        return result;
      }

      // 🔧 修正：根据 render_type 返回正确的像素信息
      let finalColor;
      switch (pattern.render_type) {
        case 'color':
          finalColor = pattern.color || alliance.color || '#4ECDC4'; // 直接使用颜色值或默认绿色
          break;
        case 'emoji':
          finalColor = pattern.unicode_char || alliance.color || '#4ECDC4'; // emoji字符或颜色值或默认绿色
          break;
        case 'complex':
          // 🔧 修正：complex 类型使用 'custom_pattern' 标识符，让渲染器根据 pattern_id 处理
          finalColor = 'custom_pattern';
          break;
        default:
          finalColor = alliance.color || '#4ECDC4'; // 联盟颜色或默认绿色
      }

      logger.info(`联盟旗帜获取成功: userId=${userId}, pattern_key=${pattern.key}, render_type=${pattern.render_type}`);

      const result = {
        color: finalColor,
        patternId: alliance.flag_pattern_id, // 使用 alliances.flag_pattern_id
        anchorX: alliance.flag_pattern_anchor_x || 0,
        anchorY: alliance.flag_pattern_anchor_y || 0,
        rotation: alliance.flag_pattern_rotation || 0,
        mirror: alliance.flag_pattern_mirror || false,
        allianceId: alliance.id, // 🆕 返回联盟ID
        materialId: pattern.material_id // 🆕 返回素材ID
      };

      // 🚀 写入缓存 (fire-and-forget)
      try { redisUtils.setex(cacheKey, ALLIANCE_CACHE_TTL, JSON.stringify(result)).catch(() => {}); } catch (_) {}

      return result;

    } catch (error) {
      logger.error('获取用户联盟旗帜失败:', error);
      return {
        color: '#4ECDC4', // 错误时使用默认绿色
        patternId: 'personal_color_4ecdc4',
        anchorX: 0,
        anchorY: 0,
        rotation: 0,
        mirror: false,
        allianceId: null,
        materialId: null
      };
    }
  }

  /**
   * 确定像素颜色 (优化版)
   * @param {string} userId 用户ID
   * @param {string} color 前端传递的颜色
   * @param {string} patternId 图案ID
   * @returns {string} 最终颜色
   */
  async determinePixelColor(userId, color, patternId) {
    try {
      // 如果前端传递了具体颜色，直接使用
      if (color && color !== 'custom_pattern') {
        return color;
      }

      // 处理自定义图案标识符
      if (color === 'custom_pattern' && patternId) {
        return 'custom_pattern';
      }

      // 如果有图案ID，使用custom_pattern标识符
      if (patternId) {
        return 'custom_pattern';
      }

      // 检查是否为游客用户
      if (userId.startsWith('guest_')) {
        return DEFAULT_COLOR;
      }

      // 获取用户联盟颜色
      const Alliance = require('../models/Alliance');
      try {
        const alliance = await Alliance.getUserAlliance(userId);
        if (alliance && alliance.color) {
          return alliance.color;
        }
      } catch (error) {
        logger.warn('获取用户联盟信息失败:', error.message);
      }

      // 使用默认颜色
      return DEFAULT_COLOR;
    } catch (error) {
      logger.error('确定像素颜色失败:', error);
      return DEFAULT_COLOR;
    }
  }

  /**
   * 降级同步处理 (批处理失败时的备选方案)
   * @param {Object} pixelData 像素数据
   * @param {Object} historyData 历史数据
   * @param {Array} cacheUpdates 缓存更新项
   */
  async fallbackSyncProcessing(pixelData, historyData, cacheUpdates) {
    try {
      logger.warn('使用降级同步处理模式');

      // 🆕 同步写入像素表
      const pixel = await Pixel.createOrUpdate(pixelData);

      // 🚨 关键重构：由异步地理编码服务统一写入历史记录，基础绘制不再直接入库历史记录
      // 这里的 recordPixelHistory 调用已被移除，交由下面的 processGeocoding 触发 Worker 写入

      // 同步更新缓存
      for (const update of cacheUpdates) {
        if (update.type === 'pixel') {
          await CacheService.setPixel(update.key.replace('pixel:', ''), update.value);
        } else if (update.type === 'stats' && update.operation === 'increment') {
          await CacheService.incrementPixelCount();
        }
      }

      // 🆕 同步处理完成后立即触发地理编码
      if (pixel && pixel.id) {
        logger.debug(`降级处理完成，立即触发地理编码: pixelId=${pixel.id}, lat=${pixelData.latitude}, lng=${pixelData.longitude}`);

        // 对于降级处理，使用高优先级，因为用户可能正在等待
        // 🚨 传递 historyData 作为 Metadata，让 Worker 负责唯一一次性历史写入
        await asyncGeocodingService.processGeocoding(
          pixel.id,
          pixelData.latitude,
          pixelData.longitude,
          'high',
          pixelData.created_at,
          pixelData.userId,
          pixelData.gridId,
          historyData
        );
      }
    } catch (error) {
      logger.error('降级处理失败:', error);
      throw error;
    }

    logger.info('降级同步处理完成');
  }

  /**
   * 优化的像素广播 (实时反馈，不等待数据库)
   * @param {Object} pixel 像素对象
   * @param {string} drawType 绘制类型
   */
  broadcastPixelUpdateOptimized(pixel, drawType) {
    try {
      // 计算瓦片ID
      const tileId = this.calculateTileId(pixel.latitude, pixel.longitude);

      // 🚀 通过 Tile-based Rooms WebSocket 广播（高性能）
      // 🔧 修复：广播到所有相关的zoom级别（12-18），确保高zoom级别的用户也能收到更新
      try {
        // 准备像素更新数据
        const pixelUpdate = {
          id: pixel.grid_id || pixel.id,
          lat: pixel.latitude,
          lng: pixel.longitude,
          color: pixel.color,
          emoji: pixel.pattern_id ? '🎨' : null,
          type: pixel.pattern_id ? 'complex' : 'color',
          pattern_id: pixel.pattern_id,
          user_id: pixel.user_id,
          timestamp: Date.now()
        };

        // 广播到所有有效的像素显示zoom级别（12-18）
        // 这样无论用户在哪个zoom级别，都能收到实时更新
        //
        // 🔧 重要说明：前端使用 Math.floor(map.getZoom()) 订阅瓦片
        //   - zoom 12.00-12.99 → 订阅 zoom 12 瓦片
        //   - zoom 16.00-16.99 → 订阅 zoom 16 瓦片
        //   - zoom 17.00-17.99 → 订阅 zoom 17 瓦片
        //   - zoom 18.00-18.99 → 订阅 zoom 18 瓦片
        //
        // 因此广播到整数级别 [12,13,14,15,16,17,18] 可以覆盖所有小数缩放级别
        const zoomLevels = [12, 13, 14, 15, 16, 17, 18];
        for (const zoom of zoomLevels) {
          tileUpdateHandler.broadcastPixelUpdate(pixelUpdate, zoom);
        }

        logger.debug('✅ Tile-based Rooms 广播完成', {
          gridId: pixel.grid_id,
          tileId,
          zoomLevels: zoomLevels.length,
          coverage: '覆盖 12.00-18.99 的所有小数缩放级别',
          mode: 'multi_zoom'
        });
      } catch (wsError) {
        logger.error('❌ Tile-based Rooms 广播失败（非阻塞）:', wsError);
      }

      // 通过SocketManager广播到瓦片房间（兼容旧系统）
      if (this.socketManager) {
        this.socketManager.broadcastTilePixelUpdate(tileId, {
          gridId: pixel.grid_id,
          latitude: pixel.latitude,
          longitude: pixel.longitude,
          color: pixel.color,
          patternId: pixel.pattern_id,
          userId: pixel.user_id,
          drawType: drawType,
          timestamp: Date.now(),
          optimization: 'real_time'
        });
      }

      // 全局广播（已废弃，改用瓦片房间广播以提高性能）
      // 注：broadcastTilePixelUpdate 已经更高效地完成了此功能

      logger.debug('实时像素广播完成', { gridId: pixel.grid_id, tileId });
    } catch (error) {
      logger.error('实时像素广播失败:', error);
      // 不抛出错误，避免影响主流程
    }
  }

  /**
   * 优化的瓦片缓存失效
   * @param {number} latitude 纬度
   * @param {number} longitude 经度
   * @param {string} gridId 网格ID
   */
  invalidateRelatedTileCacheOptimized(latitude, longitude, gridId) {
    try {
      // 计算包含该像素的瓦片ID（多个缩放级别）
      const zoomLevels = [10, 11, 12, 13, 14, 15, 16];
      const tilesToInvalidate = zoomLevels.map(zoom =>
        this.calculateTileId(latitude, longitude, zoom)
      );

      // 发送瓦片失效事件到前端（通过全局IO）
      if (this.socketManager && this.socketManager.io) {
        this.socketManager.io.emit('tileInvalidate', {
          tileIds: tilesToInvalidate,
          pixelGridId: gridId,
          reason: 'pixelUpdate',
          timestamp: Date.now(),
          optimization: 'async'
        });
      }

      // 异步清理Redis缓存
      if (redis && typeof redis.del === 'function') {
        const cacheKeys = tilesToInvalidate.map(tileId => `tile:hot:${tileId}`);
        redis.del(...cacheKeys).catch(error => {
          logger.warn('清理Redis瓦片缓存失败（非关键）:', error.message);
        });
      }

      logger.debug('瓦片缓存失效通知已发送', {
        tilesCount: tilesToInvalidate.length,
        gridId
      });
    } catch (error) {
      logger.error('瓦片缓存失效失败:', error);
      // 不抛出错误，避免影响主流程
    }
  }

  /**
   * 优化的绘制统计记录
   * @param {string} userId 用户ID
   * @param {string} drawType 绘制类型
   * @param {string} gridId 网格ID
   */
  async recordDrawStatisticsOptimized(userId, drawType, gridId) {
    try {
      // 检查 Redis 是否可用
      if (!redis || typeof redis.multi !== 'function') {
        logger.debug('Redis 不可用，跳过绘制统计记录');
        return;
      }

      // 使用Redis计数器进行实时统计
      const statsKey = `stats:daily:${new Date().toISOString().slice(0, 10)}`;
      const userStatsKey = `stats:user:${userId}:daily`;

      // 原子递增操作（使用 Node Redis v4 camelCase 方法名）
      const multi = redis.multi();
      multi.hIncrBy(statsKey, 'total_draws', 1);
      multi.hIncrBy(statsKey, `${drawType}_draws`, 1);
      multi.hIncrBy(userStatsKey, 'draws', 1);
      multi.expire(statsKey, 24 * 60 * 60); // 24小时过期
      multi.expire(userStatsKey, 24 * 60 * 60);

      await multi.exec();

      logger.debug('绘制统计已记录', { userId, drawType, gridId });
    } catch (error) {
      logger.error('记录绘制统计失败:', error);
      // 不抛出错误，避免影响主流程
    }
  }

  /**
   * 强制刷新所有批处理数据 (管理接口)
   * @returns {Object} 刷新结果
   */
  async forceFlushAllBatches() {
    try {
      logger.info('🔄 强制刷新所有批处理数据...');

      // 刷新批处理服务
      const batchResult = await batchPixelService.forceFlush();

      // 获取服务状态
      const stats = await this.getServiceStats();

      logger.info('✅ 所有批处理数据刷新完成', {
        batchResult,
        serviceStats: stats
      });

      return {
        success: true,
        batchResult,
        serviceStats: stats,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('强制刷新批处理失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取性能监控指标
   * @returns {Object} 性能指标
   */
  async getPerformanceMetrics() {
    try {
      const batchStats = batchPixelService.getStats();
      const geocodingStats = await asyncGeocodingService.getQueueStats();
      const leaderboardStats = incrementalLeaderboardService.getStats();
      const healthStatus = {
        batchService: batchPixelService.getHealthStatus(),
        geocodingService: {
          queueSize: geocodingStats.queueSizes?.total || 0,
          processedRate: geocodingStats.totalProcessed > 0 ?
            ((geocodingStats.totalProcessed / (geocodingStats.totalQueued || 1)) * 100).toFixed(2) + '%' : '0%'
        },
        leaderboardService: {
          queueSize: leaderboardStats.queueSize || 0,
          isProcessing: leaderboardStats.isProcessing,
          cacheHitRate: leaderboardStats.cacheHitRate || '0%'
        }
      };

      return {
        timestamp: new Date(),
        performance: {
          batchStats,
          geocodingStats,
          leaderboardStats,
          healthStatus
        },
        optimization: {
          asyncGeocoding: 'enabled',
          batchProcessing: 'enabled',
          intelligentCache: 'enabled',
          incrementalLeaderboard: 'enabled'
        }
      };
    } catch (error) {
      logger.error('获取性能指标失败:', error);
      return {
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  /**
   * 🚀 启动像素地理编码任务（事件驱动版本）
   *
   * ⚠️ DEPRECATED: 此方法已被事件驱动架构替代
   * 批处理完成后会自动触发pixels-flushed事件，无需手动调用
   *
   * 此方法保留作为fallback机制，在极少数情况下使用
   *
   * @param {string} gridId - 网格ID
   * @param {number} latitude - 纬度
   * @param {number} longitude - 经度
   * @param {string} priority - 优先级
   */
  async startGeocodingForPixel(gridId, latitude, longitude, priority = 'normal', drawTime = null, historyMetadata = null) {
    try {
      // 🚀 优化：移除sleep和轮询，改为事件驱动
      // 事件监听器会在批处理完成时自动触发地理编码
      // 这里只记录调用，实际处理由pixels-flushed事件完成

      logger.debug('⚠️ startGeocodingForPixel called (deprecated, now handled by event bus)', {
        gridId,
        latitude,
        longitude,
        priority
      });

      // 注意：地理编码会由pixels-flushed事件自动触发
      // 无需在此处执行任何操作，避免重复处理

    } catch (error) {
      logger.error('startGeocodingForPixel fallback失败:', {
        gridId,
        lat: latitude,
        lng: longitude,
        priority,
        error: error.message
      });
    }
  }

  /**
   * 休眠函数
   * @deprecated 不再需要用于地理编码轮询
   * @param {number} ms - 毫秒数
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = PixelDrawService;
