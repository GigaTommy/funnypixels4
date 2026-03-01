const { db } = require('../config/database');
const { redis, redisUtils } = require('../config/redis');

/**
 * 像素历史记录服务
 * 负责管理 pixels_history 表的读写操作
 */
class PixelsHistoryService {
  constructor() {
    this.tableName = 'pixels_history';
    this.batchSize = 1000; // 批量插入大小
    this.queueName = 'pixel_history_queue'; // Redis 队列名称
    this.isProcessing = false;
    this.processInterval = null;
  }

  /**
   * 记录像素操作历史（同步版本，包含完整地理信息）
   * @param {Object} pixelData - 像素数据
   * @param {string} actionType - 操作类型 (draw, bomb, clear, etc.)
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 插入结果
   */
  async recordPixelHistory(pixelData, actionType = 'draw', options = {}) {
    try {
      const historyRecord = {
        // 基础字段
        latitude: pixelData.latitude,
        longitude: pixelData.longitude,
        color: pixelData.color,
        user_id: pixelData.user_id,
        grid_id: pixelData.grid_id,

        // 图案字段
        pattern_id: pixelData.pattern_id || null,
        pattern_anchor_x: pixelData.pattern_anchor_x || 0,
        pattern_anchor_y: pixelData.pattern_anchor_y || 0,
        pattern_rotation: pixelData.pattern_rotation || 0,
        pattern_mirror: pixelData.pattern_mirror || false,

        // 像素类型字段
        pixel_type: pixelData.pixel_type || 'basic',
        related_id: pixelData.related_id || null,
        alliance_id: pixelData.alliance_id || null,

        // 🆕 地理编码字段（确保与pixels表完全一致）
        country: pixelData.country || null,
        province: pixelData.province || null,
        city: pixelData.city || null,
        district: pixelData.district || null,
        adcode: pixelData.adcode || null,
        formatted_address: pixelData.formatted_address || null,
        geocoded: pixelData.geocoded || false,
        geocoded_at: pixelData.geocoded_at || null,

        // 历史记录特有字段
        history_date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
        region_id: options.regionId || null,
        action_type: actionType,
        original_pixel_id: options.originalPixelId || null,
        version: options.version || 1,

        created_at: new Date()
      };

      console.log(`📝 记录像素历史: ${pixelData.grid_id} -> ${pixelData.province} ${pixelData.city}`);

      // 直接插入到数据库（同步操作）
      const [insertedRecord] = await db(this.tableName)
        .insert(historyRecord)
        .returning('*');

      return {
        success: true,
        data: insertedRecord,
        message: '像素历史记录成功'
      };
    } catch (error) {
      console.error('记录像素历史失败:', error);
      return {
        success: false,
        error: error.message,
        message: '像素历史记录失败'
      };
    }
  }

  /**
   * 批量记录像素操作历史
   * @param {Array} pixelsData - 像素数据数组
   * @param {string} actionType - 操作类型
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 批量插入结果
   */
  async batchRecordPixelHistory(pixelsData, actionType = 'draw', options = {}) {
    try {
      if (!Array.isArray(pixelsData) || pixelsData.length === 0) {
        return {
          success: false,
          error: '无效的像素数据',
          message: '批量记录失败'
        };
      }

      const historyRecords = pixelsData.map(pixelData => ({
        // 基础字段
        latitude: pixelData.latitude,
        longitude: pixelData.longitude,
        color: pixelData.color,
        user_id: pixelData.user_id,
        grid_id: pixelData.grid_id,

        // 图案字段
        pattern_id: pixelData.pattern_id || null,
        pattern_anchor_x: pixelData.pattern_anchor_x || 0,
        pattern_anchor_y: pixelData.pattern_anchor_y || 0,
        pattern_rotation: pixelData.pattern_rotation || 0,
        pattern_mirror: pixelData.pattern_mirror || false,

        // 像素类型字段
        pixel_type: pixelData.pixel_type || 'basic',
        related_id: pixelData.related_id || null,
        alliance_id: pixelData.alliance_id || null,

        // 🚨 新增：地理编码字段（与pixels表保持一致）
        country: pixelData.country || null,
        province: pixelData.province || null,
        city: pixelData.city || null,
        district: pixelData.district || null,
        adcode: pixelData.adcode || null,
        formatted_address: pixelData.formatted_address || null,
        geocoded: pixelData.geocoded || false,
        geocoded_at: pixelData.geocoded_at || null,

        // 历史记录特有字段
        history_date: new Date().toISOString().split('T')[0],
        region_id: options.regionId || null,
        action_type: actionType,
        original_pixel_id: options.originalPixelId || null,
        version: options.version || 1,

        created_at: new Date()
      }));

      // 分批插入
      const batches = this.chunkArray(historyRecords, this.batchSize);
      let totalInserted = 0;

      for (const batch of batches) {
        await db(this.tableName).insert(batch);
        totalInserted += batch.length;
      }

      return {
        success: true,
        data: {
          totalInserted,
          batchCount: batches.length
        },
        message: `批量记录成功，共插入 ${totalInserted} 条记录`
      };
    } catch (error) {
      console.error('批量记录像素历史失败:', error);
      return {
        success: false,
        error: error.message,
        message: '批量记录失败'
      };
    }
  }

  /**
   * 异步记录像素历史（使用Redis队列）
   * @param {Object} pixelData - 像素数据
   * @param {string} actionType - 操作类型
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 队列结果
   */
  async asyncRecordPixelHistory(pixelData, actionType = 'draw', options = {}) {
    try {
      // 检查 Redis 是否已初始化
      if (!redis) {
        console.warn('Redis 未初始化，跳过异步记录像素历史');
        return {
          success: false,
          error: 'Redis 未初始化',
          message: 'Redis 不可用'
        };
      }

      // 验证输入数据
      if (!pixelData) {
        throw new Error('pixelData不能为空');
      }

      if (typeof pixelData !== 'object') {
        throw new Error('pixelData必须是对象');
      }

      const queueData = {
        pixelData: JSON.stringify(pixelData),
        actionType: actionType || 'draw',
        options: JSON.stringify(options || {}),
        timestamp: Date.now()
      };

      // 添加到Redis队列
      const isUpstash = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;
      let messageId;

      if (isUpstash) {
        // Upstash Redis使用列表操作
        await redis.rpush(this.queueName, JSON.stringify(queueData));
        messageId = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      } else {
        // 标准Redis - 使用列表操作作为简化方案
        await redis.rpush(this.queueName, JSON.stringify(queueData));
        messageId = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      }

      return {
        success: true,
        data: { messageId },
        message: '像素历史记录已加入队列'
      };
    } catch (error) {
      console.error('异步记录像素历史失败:', error);
      return {
        success: false,
        error: error.message,
        message: '异步记录失败'
      };
    }
  }

  /**
   * 清理队列中的无效消息
   * @returns {Promise<Object>} 清理结果
   */
  async cleanupInvalidMessages() {
    try {
      // 检查 Redis 是否已初始化
      if (!redis) {
        return {
          success: true,
          data: { cleaned: 0 },
          message: 'Redis 未初始化，跳过清理'
        };
      }

      const queueLength = await redis.llen(this.queueName);
      if (queueLength === 0) {
        return {
          success: true,
          data: { cleaned: 0 },
          message: '队列为空'
        };
      }

      // 获取所有消息
      const allMessages = await redis.lrange(this.queueName, 0, -1);
      const validMessages = [];
      let cleanedCount = 0;

      for (const message of allMessages) {
        // 安全检查消息有效性
        const isValidMessage = message &&
          message !== 'undefined' &&
          (typeof message !== 'string' || message.trim() !== '');

        if (isValidMessage) {
          try {
            // 安全解析JSON，处理已经是对象的情况
            if (typeof message === 'string') {
              JSON.parse(message);
            }
            validMessages.push(message);
          } catch (error) {
            console.warn('清理无效消息:', message);
            cleanedCount++;
          }
        } else {
          console.warn('清理空消息:', message);
          cleanedCount++;
        }
      }

      // 如果发现无效消息，重建队列
      if (cleanedCount > 0) {
        await redis.del(this.queueName);
        if (validMessages.length > 0) {
          await redis.rpush(this.queueName, ...validMessages);
        }
      }

      return {
        success: true,
        data: { cleaned: cleanedCount, remaining: validMessages.length },
        message: `清理完成，删除了${cleanedCount}个无效消息`
      };
    } catch (error) {
      console.error('清理无效消息失败:', error);
      return {
        success: false,
        error: error.message,
        message: '清理失败'
      };
    }
  }

  /**
   * 启动队列处理服务
   */
  startQueueProcessor() {
    if (this.processInterval) {
      console.log('⚠️ 像素历史队列处理器已在运行中');
      return;
    }

    console.log('🚀 启动像素历史队列处理器...');
    
    // 启动时先清理一次无效消息
    this.cleanupInvalidMessages().then(result => {
      if (result.success && result.data.cleaned > 0) {
        console.log(`🧹 启动时清理了${result.data.cleaned}个无效消息`);
      }
    }).catch(error => {
      console.warn('启动时清理无效消息失败:', error);
    });
    
    // 每5秒处理一次队列
    this.processInterval = setInterval(async () => {
      if (this.isProcessing) {
        return; // 避免重复处理
      }
      
      try {
        await this.processQueue();
      } catch (error) {
        console.error('❌ 队列处理失败:', error);
      }
    }, 5000);

    console.log('✅ 像素历史队列处理器已启动，处理间隔: 5秒');
  }

  /**
   * 停止队列处理服务
   */
  stopQueueProcessor() {
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
      console.log('🛑 像素历史队列处理器已停止');
    }
  }

  /**
   * 处理队列中的像素历史记录
   * @returns {Promise<Object>} 处理结果
   */
  async processQueue() {
    if (this.isProcessing) {
      return {
        success: true,
        data: { processed: 0 },
        message: '正在处理中，跳过本次'
      };
    }

    this.isProcessing = true;

    try {
      // 检查 Redis 是否已初始化
      if (!redis) {
        return {
          success: true,
          data: { processed: 0 },
          message: 'Redis 未初始化，跳过处理'
        };
      }

      // 使用列表操作作为统一的队列实现
      const queueLength = await redis.llen(this.queueName);
      if (queueLength === 0) {
        return {
          success: true,
          data: { processed: 0 },
          message: '队列为空'
        };
      }

      // 批量获取队列中的消息
      const batchSize = Math.min(100, queueLength);
      const rawMessages = await redis.lrange(this.queueName, 0, batchSize - 1);

      // 转换为统一格式，过滤无效消息
      const messages = rawMessages
        .filter(message => {
          if (!message || message === 'undefined') return false;
          if (typeof message === 'string') {
            return message.trim() !== '';
          }
          return true;
        })
        .map((message, index) => {
          try {
            const parsedMessage = typeof message === 'string' ? JSON.parse(message) : message;
            return {
              id: `${Date.now()}-${index}`,
              message: parsedMessage
            };
          } catch (parseError) {
            console.warn(`跳过无效的队列消息 (索引 ${index}):`, message, parseError.message);
            return null;
          }
        })
        .filter(msg => msg !== null);

      if (!messages || messages.length === 0) {
        return {
          success: true,
          data: { processed: 0 },
          message: '队列为空或无有效消息'
        };
      }

      let processedCount = 0;
      const messageIds = [];

      for (const message of messages) {
        try {
          const { pixelData, actionType, options } = message.message;

          // 验证必要字段
          if (!pixelData || pixelData === 'undefined') {
            console.warn('跳过无效的pixelData:', pixelData);
            continue;
          }

          // 安全解析JSON，处理已经是对象的情况
          const pixelDataObj = typeof pixelData === 'string' ? JSON.parse(pixelData) : pixelData;
          const optionsObj = typeof options === 'string' ? JSON.parse(options || '{}') : (options || {});

          await this.recordPixelHistory(pixelDataObj, actionType, optionsObj);
          messageIds.push(message.id);
          processedCount++;
        } catch (error) {
          console.error('处理队列消息失败:', error);
          console.error('消息内容:', message.message);
          // 即使处理失败，也记录消息ID以便清理
          messageIds.push(message.id);
        }
      }

      // 删除已处理的消息（使用列表操作）
      if (processedCount > 0) {
        for (let i = 0; i < processedCount; i++) {
          await redis.lpop(this.queueName);
        }
        console.log(`📝 处理了 ${processedCount} 条像素历史记录`);
      }

      return {
        success: true,
        data: { processed: processedCount },
        message: `处理了 ${processedCount} 条队列消息`
      };
    } catch (error) {
      console.error('处理队列失败:', error);
      return {
        success: false,
        error: error.message,
        message: '队列处理失败'
      };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 获取用户像素操作历史
   * @param {number} userId - 用户ID
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>} 查询结果
   */
  async getUserPixelHistory(userId, options = {}) {
    try {
      const {
        startDate,
        endDate,
        actionType,
        limit = 100,
        offset = 0
      } = options;

      let query = db(this.tableName)
        .where('user_id', userId)
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset);

      if (startDate) {
        query = query.where('history_date', '>=', startDate);
      }

      if (endDate) {
        query = query.where('history_date', '<=', endDate);
      }

      if (actionType) {
        query = query.where('action_type', actionType);
      }

      const records = await query.select('*');

      return {
        success: true,
        data: records,
        message: `获取到 ${records.length} 条用户历史记录`
      };
    } catch (error) {
      console.error('获取用户像素历史失败:', error);
      return {
        success: false,
        error: error.message,
        message: '获取用户历史失败'
      };
    }
  }

  /**
   * 获取像素位置的历史变化
   * @param {string} gridId - 网格ID
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>} 查询结果
   */
  async getPixelLocationHistory(gridId, options = {}) {
    try {
      const {
        startDate,
        endDate,
        limit = 100,
        offset = 0
      } = options;

      let query = db(this.tableName)
        .where('grid_id', gridId)
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset);

      if (startDate) {
        query = query.where('history_date', '>=', startDate);
      }

      if (endDate) {
        query = query.where('history_date', '<=', endDate);
      }

      const records = await query.select('*');

      return {
        success: true,
        data: records,
        message: `获取到 ${records.length} 条位置历史记录`
      };
    } catch (error) {
      console.error('获取像素位置历史失败:', error);
      return {
        success: false,
        error: error.message,
        message: '获取位置历史失败'
      };
    }
  }

  /**
   * 获取用户行为统计
   * @param {number} userId - 用户ID
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>} 统计结果
   */
  async getUserBehaviorStats(userId, options = {}) {
    try {
      const {
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate = new Date().toISOString().split('T')[0]
      } = options;

      const stats = await db(this.tableName)
        .where('user_id', userId)
        .whereBetween('history_date', [startDate, endDate])
        .select(
          db.raw('COUNT(*) as total_pixels'),
          db.raw('COUNT(DISTINCT DATE(created_at)) as active_days'),
          db.raw('MIN(created_at) as first_draw'),
          db.raw('MAX(created_at) as last_draw'),
          db.raw('COUNT(DISTINCT grid_id) as unique_locations'),
          db.raw('COUNT(DISTINCT action_type) as action_types')
        )
        .first();

      // 按操作类型统计
      const actionStats = await db(this.tableName)
        .where('user_id', userId)
        .whereBetween('history_date', [startDate, endDate])
        .groupBy('action_type')
        .select('action_type', db.raw('COUNT(*) as count'));

      return {
        success: true,
        data: {
          ...stats,
          actionBreakdown: actionStats
        },
        message: '用户行为统计获取成功'
      };
    } catch (error) {
      console.error('获取用户行为统计失败:', error);
      return {
        success: false,
        error: error.message,
        message: '获取用户统计失败'
      };
    }
  }

  /**
   * 获取区域活跃度统计
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>} 统计结果
   */
  async getRegionActivityStats(options = {}) {
    try {
      const {
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate = new Date().toISOString().split('T')[0],
        regionId
      } = options;

      let query = db(this.tableName)
        .whereBetween('history_date', [startDate, endDate]);

      if (regionId) {
        query = query.where('region_id', regionId);
      }

      const stats = await query
        .select(
          'region_id',
          db.raw('DATE(created_at) as date'),
          db.raw('COUNT(*) as pixel_count'),
          db.raw('COUNT(DISTINCT user_id) as unique_users')
        )
        .groupBy('region_id', db.raw('DATE(created_at)'))
        .orderBy('date', 'desc')
        .orderBy('pixel_count', 'desc');

      return {
        success: true,
        data: stats,
        message: '区域活跃度统计获取成功'
      };
    } catch (error) {
      console.error('获取区域活跃度统计失败:', error);
      return {
        success: false,
        error: error.message,
        message: '获取区域统计失败'
      };
    }
  }

  /**
   * 创建新的月度分区
   * @param {Date} startDate - 开始日期
   * @returns {Promise<Object>} 创建结果
   */
  async createMonthlyPartition(startDate) {
    try {
      const result = await db.raw(
        'SELECT create_monthly_partition(?, ?)',
        [this.tableName, startDate]
      );

      return {
        success: true,
        data: result,
        message: `成功创建 ${startDate.toISOString().split('T')[0]} 的分区`
      };
    } catch (error) {
      console.error('创建月度分区失败:', error);
      return {
        success: false,
        error: error.message,
        message: '创建分区失败'
      };
    }
  }

  /**
   * 清理旧分区
   * @param {number} keepMonths - 保留月数
   * @returns {Promise<Object>} 清理结果
   */
  async cleanupOldPartitions(keepMonths = 12) {
    try {
      const result = await db.raw(
        'SELECT cleanup_old_partitions(?, ?)',
        [this.tableName, keepMonths]
      );

      return {
        success: true,
        data: result,
        message: `成功清理 ${keepMonths} 个月前的旧分区`
      };
    } catch (error) {
      console.error('清理旧分区失败:', error);
      return {
        success: false,
        error: error.message,
        message: '清理分区失败'
      };
    }
  }

  /**
   * 归档旧数据
   * @param {Date} archiveDate - 归档日期
   * @returns {Promise<Object>} 归档结果
   */
  async archiveOldData(archiveDate) {
    try {
      const result = await db.raw(
        'SELECT archive_old_pixels_history(?)',
        [archiveDate]
      );

      return {
        success: true,
        data: result,
        message: `成功归档 ${archiveDate.toISOString().split('T')[0]} 之前的数据`
      };
    } catch (error) {
      console.error('归档旧数据失败:', error);
      return {
        success: false,
        error: error.message,
        message: '归档数据失败'
      };
    }
  }

  /**
   * 工具方法：将数组分块
   * @param {Array} array - 要分块的数组
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
}

module.exports = new PixelsHistoryService();
