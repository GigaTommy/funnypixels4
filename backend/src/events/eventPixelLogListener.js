/**
 * Event Pixel Log Listener (PRODUCTION-READY)
 *
 * 监听像素批处理完成事件，自动记录到活动像素日志
 *
 * 🚀 性能优化 + 🔒 安全加固：
 * 1. 参数化查询 - 100%防SQL注入
 * 2. 分批处理 - 避免SQL长度限制
 * 3. VALUES子句 - 性能优于unnest
 * 4. 内存缓存 - 减少DB往返
 * 5. 异步非阻塞 - 不影响像素保存
 *
 * 集成点：pixels-flushed事件 → event_pixel_logs表
 */

const pixelBatchEventBus = require('./PixelBatchEventBus');
const { db } = require('../config/database');
const logger = require('../utils/logger');

class EventPixelLogListener {
  constructor() {
    this.isInitialized = false;
    this.stats = {
      pixelsProcessed: 0,
      logsCreated: 0,
      batchesProcessed: 0,
      errors: 0,
      avgProcessingTime: 0,
      maxBatchSize: 0
    };

    // 内存缓存：活跃事件列表
    this.activeEventsCache = {
      events: [],
      lastUpdated: null,
      ttl: 60000 // 1分钟缓存
    };

    // 性能配置
    this.BATCH_SIZE = 200;  // 每批处理200个pixel（平衡性能和SQL长度）
  }

  /**
   * 初始化监听器
   */
  initialize() {
    if (this.isInitialized) {
      logger.warn('EventPixelLogListener already initialized');
      return;
    }

    // 监听像素批处理完成事件
    pixelBatchEventBus.on('pixels-flushed', async (pixels) => {
      await this.handlePixelsFlushed(pixels);
    });

    this.isInitialized = true;
    logger.info('✅ EventPixelLogListener initialized - PRODUCTION MODE (SQL-injection safe, batch processing)');
  }

  /**
   * 处理像素批处理完成事件
   */
  async handlePixelsFlushed(pixels) {
    const startTime = Date.now();

    try {
      // 过滤出有坐标的像素
      const validPixels = pixels.filter(p => p.latitude && p.longitude);

      if (validPixels.length === 0) {
        return;
      }

      logger.debug(`🎮 Event: Processing ${validPixels.length} pixels for event participation`);

      // 获取活跃事件（带缓存）
      const activeEvents = await this.getActiveEvents();

      if (activeEvents.length === 0) {
        logger.debug('No active events, skipping event pixel log');
        return;
      }

      // 🚀 分批处理（避免SQL长度限制）
      const allLogs = [];
      for (let i = 0; i < validPixels.length; i += this.BATCH_SIZE) {
        const batch = validPixels.slice(i, i + this.BATCH_SIZE);
        const batchLogs = await this.processBatch(batch, activeEvents);
        allLogs.push(...batchLogs);
        this.stats.batchesProcessed++;
        this.stats.maxBatchSize = Math.max(this.stats.maxBatchSize, batch.length);
      }

      // 批量插入日志
      if (allLogs.length > 0) {
        await db('event_pixel_logs')
          .insert(allLogs)
          .onConflict(['event_id', 'pixel_id'])
          .ignore();

        this.stats.logsCreated += allLogs.length;
        this.stats.pixelsProcessed += validPixels.length;

        const processingTime = Date.now() - startTime;
        this.stats.avgProcessingTime = Math.round(
          (this.stats.avgProcessingTime + processingTime) / 2
        );

        logger.info(`✅ Event: Created ${allLogs.length} event pixel logs in ${processingTime}ms (${Math.ceil(validPixels.length / this.BATCH_SIZE)} batches)`);
      }

    } catch (error) {
      this.stats.errors++;
      logger.error('❌ Event: Failed to process pixels-flushed for events', {
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * 🔒 安全处理单个批次（参数化查询，防SQL注入）
   *
   * 使用VALUES子句 + 完全参数化，避免：
   * 1. SQL注入风险
   * 2. SQL长度限制
   * 3. NULL值处理错误
   * 4. 数组长度不匹配
   */
  async processBatch(pixels, activeEvents) {
    try {
      // 构建参数化VALUES子句
      const values = [];
      const params = [];

      pixels.forEach((pixel, idx) => {
        const offset = idx * 6;
        // 每个pixel占6个参数
        values.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}::float, $${offset + 4}::float, $${offset + 5}, $${offset + 6})`);
        params.push(
          pixel.grid_id,           // $1, $7, $13, ...
          pixel.user_id,           // $2, $8, $14, ...
          pixel.longitude,         // $3, $9, $15, ...
          pixel.latitude,          // $4, $10, $16, ...
          pixel.x ?? null,         // $5, $11, $17, ... (正确处理undefined)
          pixel.y ?? null          // $6, $12, $18, ...
        );
      });

      // 添加eventIds到参数列表
      const eventIdsOffset = params.length;
      params.push(activeEvents.map(e => e.id));

      // 🚀 安全的参数化SQL
      const sql = `
        WITH pixel_points(grid_id, user_id, lng, lat, x, y) AS (
          VALUES ${values.join(',\n          ')}
        ),
        pixel_geoms AS (
          SELECT
            grid_id,
            user_id,
            x,
            y,
            ST_SetSRID(ST_MakePoint(lng, lat), 4326) as geom
          FROM pixel_points
        )
        SELECT DISTINCT
          e.id as event_id,
          pg.grid_id as pixel_id,
          pg.user_id,
          am.alliance_id,
          pg.x,
          pg.y
        FROM pixel_geoms pg
        -- 空间JOIN：检查像素是否在活动区域内（利用GIST索引）
        INNER JOIN events e
          ON e.id = ANY($${eventIdsOffset + 1}::uuid[])
          AND e.status = 'active'
          AND ST_Contains(e.boundary_geom, pg.geom)
        -- 获取用户联盟信息
        LEFT JOIN alliance_members am
          ON am.user_id = pg.user_id
          AND am.status = 'active'
        -- 参与验证：用户个人报名 OR 用户的联盟报名
        WHERE EXISTS (
          SELECT 1 FROM event_participants ep
          WHERE ep.event_id = e.id
            AND (
              -- 个人报名
              (ep.participant_type = 'user' AND ep.participant_id = pg.user_id)
              OR
              -- 联盟报名（仅当用户有联盟时）
              (ep.participant_type = 'alliance' AND ep.participant_id = am.alliance_id AND am.alliance_id IS NOT NULL)
            )
        )
      `;

      const result = await db.raw(sql, params);

      // 转换结果为插入格式
      const logsToInsert = result.rows.map(row => ({
        event_id: row.event_id,
        pixel_id: row.pixel_id,
        user_id: row.user_id,
        alliance_id: row.alliance_id,
        x: row.x,
        y: row.y,
        created_at: new Date()
      }));

      return logsToInsert;

    } catch (error) {
      logger.error('❌ Batch event participation check failed', {
        error: error.message,
        batchSize: pixels.length
      });
      // 返回空数组而不是抛出异常，避免影响后续批次
      return [];
    }
  }

  /**
   * 获取活跃事件（带缓存）
   * 缓存TTL: 1分钟（活动状态变化不频繁）
   */
  async getActiveEvents() {
    const now = Date.now();

    // 检查缓存是否有效
    if (
      this.activeEventsCache.lastUpdated &&
      now - this.activeEventsCache.lastUpdated < this.activeEventsCache.ttl
    ) {
      return this.activeEventsCache.events;
    }

    // 刷新缓存
    const events = await db('events')
      .where('status', 'active')
      .select('id', 'name');

    this.activeEventsCache.events = events;
    this.activeEventsCache.lastUpdated = now;

    logger.debug(`🔄 Active events cache refreshed: ${events.length} events`);

    return events;
  }

  /**
   * 手动刷新活跃事件缓存
   */
  async refreshActiveEventsCache() {
    this.activeEventsCache.lastUpdated = null;
    return this.getActiveEvents();
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.activeEventsCache.events.length,
      cacheAge: this.activeEventsCache.lastUpdated
        ? Math.round((Date.now() - this.activeEventsCache.lastUpdated) / 1000) + 's'
        : 'never',
      config: {
        batchSize: this.BATCH_SIZE,
        cacheTTL: this.activeEventsCache.ttl
      }
    };
  }

  /**
   * 重置统计信息
   */
  resetStats() {
    this.stats = {
      pixelsProcessed: 0,
      logsCreated: 0,
      batchesProcessed: 0,
      errors: 0,
      avgProcessingTime: 0,
      maxBatchSize: 0
    };
  }

  /**
   * 调整批处理大小（用于性能调优）
   */
  setBatchSize(size) {
    if (size < 1 || size > 1000) {
      throw new Error('Batch size must be between 1 and 1000');
    }
    this.BATCH_SIZE = size;
    logger.info(`Batch size updated to ${size}`);
  }
}

// 导出单例
const eventPixelLogListener = new EventPixelLogListener();
module.exports = eventPixelLogListener;
