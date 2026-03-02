/**
 * 异步地理编码服务
 * 解决像素绘制时的地理编码性能瓶颈
 * 通过队列和批量处理实现非阻塞的地理信息获取
 */

const { db } = require('../config/database');
const { getRedis } = require('../config/redis');
const amapWebService = require('./amapWebService');
const googleGeocodingService = require('./googleGeocodingService');
const logger = require('../utils/logger');
// 注意：已移除PostGIS服务，数据质量不佳

/**
 * 获取当前Redis客户端（运行时获取，避免模块加载时的null值）
 */
function getRedisClient() {
  return getRedis();
}

/**
 * 异步地理编码服务
 * 核心功能：
 * 1. 将地理编码任务异步化，不阻塞像素绘制主流程
 * 2. 使用Redis队列管理地理编码任务
 * 3. 批量处理地理编码任务，提升效率
 * 4. 失败重试和降级机制确保可靠性
 */
class AsyncGeocodingService {
  constructor() {
    this.queueKey = 'geocoding:queue';
    this.processingKey = 'geocoding:processing';
    this.retryKey = 'geocoding:retry';
    this.batchSize = parseInt(process.env.GEOCODING_BATCH_SIZE) || 50;
    this.maxRetries = 3;
    this.retryDelay = 5000; // 5秒

    // 性能监控
    this.stats = {
      totalQueued: 0,
      totalProcessed: 0,
      totalFailed: 0,
      batchProcessed: 0,
      averageLatency: 0
    };

    // 启动队列处理器
    this.startQueueProcessor();

    logger.info('🌍 异步地理编码服务初始化完成');
  }

  /**
   * 将地理编码任务添加到队列
   * @param {Object} task - 地理编码任务
   * @param {string} task.pixelId - 像素ID
   * @param {number} task.latitude - 纬度
   * @param {number} task.longitude - 经度
   * @param {string} task.priority - 优先级 ('high'|'normal'|'low')
   * @param {Date} task.timestamp - 时间戳
   */
  async queueGeocodingTask(task) {
    try {
      // 获取Redis客户端（运行时获取）
      const redis = getRedisClient();

      // 检查 Redis 是否已初始化
      if (!redis) {
        logger.warn('Redis 未初始化，跳过地理编码任务入队');
        return false;
      }

      const taskData = {
        ...task,
        timestamp: task.timestamp || new Date().toISOString(),
        retries: 0,
        priority: task.priority || 'normal'
      };

      // 根据优先级选择不同的队列
      const queueKey = this.getQueueKey(taskData.priority);

      // 添加到队列
      await redis.lPush(queueKey, JSON.stringify(taskData));

      this.stats.totalQueued++;

      logger.debug('地理编码任务已入队', {
        pixelId: task.pixelId,
        lat: task.latitude,
        lng: task.longitude,
        priority: taskData.priority,
        queueSize: await redis.lLen(queueKey)
      });

      return true;
    } catch (error) {
      logger.error('添加地理编码任务到队列失败', {
        error: error.message,
        pixelId: task.pixelId
      });
      return false;
    }
  }

  /**
   * 处理地理编码任务（主要入口点）
   * @param {string} pixelId - 像素ID
   * @param {number} latitude - 纬度
   * @param {number} longitude - 经度
   * @param {string} priority - 优先级
   */
  async processGeocoding(pixelId, latitude, longitude, priority = 'normal', drawTimestamp = null, userId = null, gridId = null, historyMetadata = null) {
    const task = {
      pixelId,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      priority,
      drawTimestamp: drawTimestamp || new Date().toISOString(),
      userId,
      gridId,
      historyMetadata
    };

    return await this.queueGeocodingTask(task);
  }

  /**
   * 批量处理地理编码任务
   * @param {Array} tasks - 任务数组
   */
  async batchProcessGeocoding(tasks) {
    const promises = tasks.map(task =>
      this.processGeocoding(
        task.pixelId,
        task.latitude,
        task.longitude,
        task.priority,
        task.drawTimestamp,
        task.userId,
        task.gridId,
        task.historyMetadata
      )
    );

    return await Promise.all(promises);
  }

  /**
   * 启动队列处理器
   */
  startQueueProcessor() {
    // 处理高优先级队列
    this.processQueue('high');

    // 处理普通优先级队列
    this.processQueue('normal');

    // 处理低优先级队列
    this.processQueue('low');

    // 处理重试队列
    this.processRetryQueue();

    logger.info('🔄 地理编码队列处理器已启动');
  }

  /**
   * 处理指定优先级的队列
   * @param {string} priority - 优先级
   */
  async processQueue(priority) {
    const queueKey = this.getQueueKey(priority);

    while (true) {
      try {
        // 从队列获取任务
        const tasks = await this.getBatchFromQueue(queueKey);

        if (tasks.length === 0) {
          // 队列为空，等待一段时间
          await this.sleep(1000);
          continue;
        }

        // 批量处理任务
        await this.processBatchTasks(tasks);

        this.stats.batchProcessed++;

      } catch (error) {
        logger.error(`处理${priority}优先级地理编码队列失败`, {
          error: error.message
        });

        // 等待后继续处理
        await this.sleep(5000);
      }
    }
  }

  /**
   * 处理重试队列
   */
  async processRetryQueue() {
    while (true) {
      try {
        // 获取重试任务
        const tasks = await this.getBatchFromQueue(this.retryKey);

        if (tasks.length === 0) {
          await this.sleep(5000);
          continue;
        }

        // 延迟处理重试任务
        await this.sleep(this.retryDelay);

        // 批量处理重试任务
        await this.processBatchTasks(tasks);

      } catch (error) {
        logger.error('处理重试队列失败', {
          error: error.message
        });

        await this.sleep(10000);
      }
    }
  }

  /**
   * 从队列获取批量任务
   * @param {string} queueKey - 队列键
   * @returns {Array} 任务数组
   */
  async getBatchFromQueue(queueKey) {
    // 获取Redis客户端（运行时获取）
    const redis = getRedisClient();

    // 检查 Redis 是否已初始化
    if (!redis) {
      return [];
    }

    const tasks = [];

    // 批量获取任务
    for (let i = 0; i < this.batchSize; i++) {
      const taskData = await redis.rPop(queueKey);
      if (!taskData) break;

      try {
        const task = JSON.parse(taskData);
        tasks.push(task);
      } catch (error) {
        logger.error('解析地理编码任务失败', { error: error.message });
      }
    }

    return tasks;
  }

  /**
   * 批量处理地理编码任务
   * @param {Array} tasks - 任务数组
   */
  async processBatchTasks(tasks) {
    const startTime = Date.now();
    const results = [];

    logger.debug(`开始批量处理地理编码任务`, {
      taskCount: tasks.length,
      tasks: tasks.map(t => ({
        pixelId: t.pixelId,
        lat: t.latitude,
        lng: t.longitude,
        priority: t.priority
      }))
    });

    // 并发处理任务
    const promises = tasks.map(task => this.processSingleTask(task));
    const taskResults = await Promise.allSettled(promises);

    // 分析结果
    for (let i = 0; i < taskResults.length; i++) {
      const result = taskResults[i];
      const task = tasks[i];

      if (result.status === 'fulfilled') {
        results.push(result.value);
        this.stats.totalProcessed++;
      } else {
        // 处理失败的任务
        await this.handleTaskFailure(task, result.reason);
        this.stats.totalFailed++;
      }
    }

    const processingTime = Date.now() - startTime;
    this.updateAverageLatency(processingTime, tasks.length);

    logger.debug(`批量地理编码处理完成`, {
      taskCount: tasks.length,
      processingTime: `${processingTime}ms`,
      successCount: results.filter(r => r.success).length,
      failureCount: results.filter(r => !r.success).length
    });

    return results;
  }

  /**
   * 处理单个地理编码任务
   * @param {Object} task - 任务对象
   * @returns {Promise<Object>} 处理结果
   */
  async processSingleTask(task) {
    try {
      // 参数验证
      if (!task.pixelId || !task.latitude || !task.longitude) {
        throw new Error('任务参数不完整');
      }

      let geoResult = null;

      // 1. 尝试从数据库复用同坐标的地理信息
      try {
        const existingGeo = await this.findExistingGeoInfo(task.latitude, task.longitude);
        if (existingGeo) {
          geoResult = {
            ...existingGeo,
            geocoded: true,
            geocoded_at: new Date()
          };
          logger.info('♻️ 从数据库复用了同坐标的地理信息', {
            pixelId: task.pixelId,
            lat: task.latitude,
            lng: task.longitude,
            city: geoResult.city
          });
        }
      } catch (dbError) {
        logger.warn('查询数据库现有地理信息失败（跳过复用）', { error: dbError.message });
      }

      // 2. 如果数据库未命中，则按坐标区域路由到对应的地理编码API
      if (!geoResult) {
        const inChina = amapWebService.isInChina(task.latitude, task.longitude);

        if (inChina) {
          // 中国境内：使用高德地图Web服务API
          try {
            geoResult = await amapWebService.reverseGeocode(task.latitude, task.longitude);
            if (geoResult && geoResult.geocoded) {
              logger.debug('高德地图Web服务API地理编码任务处理成功', {
                pixelId: task.pixelId,
                city: geoResult.city,
                province: geoResult.province,
                district: geoResult.district
              });
            }
          } catch (amapError) {
            logger.warn('高德地图Web服务API失败', {
              pixelId: task.pixelId,
              error: amapError.message
            });
          }
        } else {
          // 中国境外：优先使用 Google Geocoding API
          if (googleGeocodingService.isAvailable()) {
            try {
              geoResult = await googleGeocodingService.reverseGeocode(task.latitude, task.longitude);
              if (geoResult && geoResult.geocoded) {
                logger.debug('Google Geocoding API地理编码任务处理成功', {
                  pixelId: task.pixelId,
                  country: geoResult.country,
                  city: geoResult.city,
                  province: geoResult.province
                });
              }
            } catch (googleError) {
              logger.warn('Google Geocoding API失败，尝试高德降级', {
                pixelId: task.pixelId,
                error: googleError.message
              });
            }
          }

          // Google 不可用或失败时，降级到高德
          if (!geoResult || !geoResult.geocoded) {
            try {
              geoResult = await amapWebService.reverseGeocode(task.latitude, task.longitude);
              if (geoResult && geoResult.geocoded) {
                logger.debug('高德地图Web服务API地理编码任务处理成功（海外降级）', {
                  pixelId: task.pixelId,
                  city: geoResult.city,
                  province: geoResult.province
                });
              }
            } catch (amapError) {
              logger.warn('高德地图Web服务API（海外降级）也失败', {
                pixelId: task.pixelId,
                error: amapError.message
              });
            }
          }
        }
      }

      // 注意：已移除PostGIS OSM备用服务（数据质量不佳）

      // 如果所有服务都失败，使用默认地理信息
      if (!geoResult || !geoResult.geocoded) {
        geoResult = this.getDefaultGeoInfo();
        logger.warn('所有地理编码服务都失败，使用默认信息', {
          pixelId: task.pixelId,
          lat: task.latitude,
          lng: task.longitude
        });
      }

      // 更新像素地理信息
      await this.updatePixelGeoInfo(task.pixelId, geoResult, task.drawTimestamp, task.userId, task.gridId, task.historyMetadata);

      return {
        success: true,
        pixelId: task.pixelId,
        geoResult,
        processingTime: Date.now() - new Date(task.timestamp).getTime()
      };

    } catch (error) {
      logger.error('地理编码任务处理失败', {
        pixelId: task.pixelId,
        error: error.message,
        retries: task.retries
      });

      throw error;
    }
  }

  /**
   * 根据坐标查找数据库中已有的地理信息
   * @param {number} latitude - 纬度
   * @param {number} longitude - 经度
   * @returns {Promise<Object|null>} 地理信息
   */
  async findExistingGeoInfo(latitude, longitude) {
    try {
      // 精确匹配坐标，并确保已有地理编码信息
      const result = await db('pixels')
        .where({
          latitude: latitude,
          longitude: longitude,
          geocoded: true
        })
        .whereNotNull('city') // 确保数据是有效的
        .select([
          'country', 'province', 'city', 'district',
          'adcode', 'formatted_address'
        ])
        .first();

      return result || null;
    } catch (error) {
      logger.error('查找数据库现有地理信息失败', { error: error.message });
      return null;
    }
  }

  /**
   * 处理任务失败
   * @param {Object} task - 任务对象
   * @param {Error} error - 错误对象
   */
  async handleTaskFailure(task, error) {
    task.retries = (task.retries || 0) + 1;

    if (task.retries < this.maxRetries) {
      // 添加到重试队列
      await this.queueGeocodingTask({
        ...task,
        priority: 'low', // 重试任务降低优先级
        timestamp: new Date().toISOString()
      });

      logger.debug('任务已添加到重试队列', {
        pixelId: task.pixelId,
        retries: task.retries,
        error: error.message
      });
    } else {
      // 超过最大重试次数，记录失败
      logger.error('地理编码任务最终失败', {
        pixelId: task.pixelId,
        lat: task.latitude,
        lng: task.longitude,
        retries: task.retries,
        finalError: error.message
      });

      // 使用默认地理信息
      await this.updatePixelGeoInfo(task.pixelId, this.getDefaultGeoInfo(), task.drawTimestamp, task.userId, task.gridId, task.historyMetadata);
    }
  }

  /**
   * 更新像素地理信息
   * @param {string} pixelId - 像素ID
   * @param {Object} geoInfo - 地理信息
   */
  async updatePixelGeoInfo(pixelId, geoInfo, drawTimestamp = null, userId = null, gridId = null, historyMetadata = null) {
    logger.debug('🆕 updatePixelGeoInfo 被调用', { pixelId });
    try {
      const updateData = {
        // 基础地理信息（对应数据库现有字段）
        country: geoInfo.country || '中国',
        province: geoInfo.province || null,
        city: geoInfo.city || null,
        district: geoInfo.district || null,
        adcode: geoInfo.adcode || '',
        formatted_address: geoInfo.formatted_address || null,

        // 地理编码状态
        geocoded: geoInfo.geocoded || true,
        geocoded_at: geoInfo.geocoded_at || new Date()
      };

      // 1. 更新pixels表
      await db('pixels')
        .where('id', pixelId)
        .update(updateData);

      // 2. 🆕 异步写入完整的pixels_history记录
      this.writeCompleteHistoryRecord(pixelId, updateData, drawTimestamp, userId, gridId, historyMetadata)
        .catch(error => {
          logger.warn('写入完整历史记录失败（非阻塞）', {
            pixelId,
            error: error.message
          });
        });

      logger.debug('像素地理信息已更新', {
        pixelId,
        city: geoInfo.city,
        province: geoInfo.province
      });

    } catch (error) {
      logger.error('更新像素地理信息失败', {
        pixelId,
        error: error.message
      });
    }
  }

  /**
   * 🆕 写入完整的pixels_history记录
   * 包含完整的地理信息，确保流水表的完整性
   * @param {string} pixelId - 像素ID
   * @param {Object} geoData - 地理信息数据
   */
  async writeCompleteHistoryRecord(pixelId, geoData, drawTimestamp = null, userId = null, gridId = null, historyMetadata = null) {
    try {
      logger.debug('🆕 开始写入或者更新历史记录', { pixelId });

      // 1. 获取基础像素信息
      const pixel = await db('pixels')
        .where('id', pixelId)
        .select([
          'grid_id', 'latitude', 'longitude', 'color', 'pattern_id',
          'user_id', 'pixel_type', 'related_id', 'session_id', 'created_at', 'updated_at'
        ])
        .first();

      if (!pixel) {
        logger.warn('像素记录不存在，无法写入历史记录', { pixelId });
        return;
      }

      const targetTime = drawTimestamp ? new Date(drawTimestamp) : new Date(pixel.created_at);
      const historyDate = targetTime.toISOString().split('T')[0];
      const targetUserId = userId || pixel.user_id;
      const targetGridId = gridId || pixel.grid_id;

      // 🚨 竞态条件处理：由于 BatchPixelService 每1秒刷新一次，历史记录可能还没入库
      // 增加重试机制 (最多3次，每次间隔1秒)
      let existingHistory = null;
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        existingHistory = await db('pixels_history')
          .where({
            grid_id: targetGridId,
            user_id: targetUserId,
            history_date: historyDate
          })
          .where('created_at', '>=', new Date(targetTime.getTime() - 5000))
          .where('created_at', '<=', new Date(targetTime.getTime() + 5000))
          // 💡 优先选择未地理编码的记录
          .orderByRaw(`(geocoded = false) DESC, ABS(EXTRACT(EPOCH FROM (created_at - ?))) ASC`, [targetTime])
          .first();

        if (existingHistory) break;

        attempts++;
        if (attempts < maxAttempts) {
          logger.debug(`未找到匹配的历史记录，等待重试 (${attempts}/${maxAttempts})...`, { gridId: targetGridId });
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // 构建地理信息更新数据
      const geoUpdateData = {
        country: geoData.country,
        province: geoData.province,
        city: geoData.city,
        district: geoData.district,
        adcode: geoData.adcode,
        formatted_address: geoData.formatted_address,
        geocoded: geoData.geocoded,
        geocoded_at: geoData.geocoded_at,
        updated_at: new Date()
      };

      // 🚨 核心重构：如果提供了完整的历史记录元数据，则直接插入（唯一写入源）
      if (historyMetadata) {
        const year = targetTime.getFullYear();
        const month = String(targetTime.getMonth() + 1).padStart(2, '0');
        const partitionTable = `pixels_history_${year}${month}`;

        const fullHistoryRecord = {
          ...historyMetadata,
          ...geoUpdateData,
          created_at: historyMetadata.created_at || targetTime,
          updated_at: new Date()
        };

        logger.debug('🚀 正在一次性写入完整历史记录 (Sole Writer Flow)', {
          gridId: targetGridId,
          partitionTable
        });

        // 🔧 FIX 2026-03-02: 防止重复插入 - 先检查是否已存在相同的记录
        const existing = await db('pixels_history')
          .where({
            grid_id: targetGridId,
            user_id: targetUserId,
            history_date: historyDate
          })
          .where('created_at', '>=', new Date(targetTime.getTime() - 5000))
          .where('created_at', '<=', new Date(targetTime.getTime() + 5000))
          .first();

        if (existing) {
          // 记录已存在，更新地理信息而不是插入新记录
          logger.info('⚠️ 历史记录已存在，更新地理信息而非重复插入', {
            gridId: targetGridId,
            existingId: existing.id,
            hasCity: !!existing.city,
            newCity: geoUpdateData.city
          });

          await db('pixels_history')
            .where('id', existing.id)
            .update(geoUpdateData);

          logger.info('✅ 历史记录地理信息已更新', { gridId: targetGridId });
          return;
        }

        // 记录不存在，执行插入
        await db(partitionTable).insert(fullHistoryRecord);
        logger.info('✅ 完整历史记录已成功写入 (无冲突插入)', { gridId: targetGridId });
        return;
      }

      // 🚨 下面是传统逻辑：在数据库中查找并更新（用于兜底或未传 Metadata 的场景）
      if (existingHistory) {
        // 更新现有历史记录的地理信息
        logger.debug('🔄 更新现有历史记录的地理信息', {
          pixelId,
          gridId: targetGridId,
          historyId: existingHistory.id
        });

        await db('pixels_history')
          .where({
            id: existingHistory.id,
            history_date: existingHistory.history_date // 🚨 包含分区键
          })
          .update(geoUpdateData);

        logger.debug('历史记录地理信息已更新', {
          pixelId,
          gridId: targetGridId,
          province: geoData.province,
          city: geoData.city,
          district: geoData.district
        });
        return;
      }

      // 🚨 如果重试后仍未找到，执行兜底插入（防止丢失地理编码结果）
      logger.warn('⚠️ 重试后仍未找到匹配的历史记录，执行补录', {
        pixelId,
        gridId: targetGridId,
        drawTime: targetTime
      });

      const historyDateForInsert = targetTime.toISOString().split('T')[0];
      const year = targetTime.getFullYear();
      const month = String(targetTime.getMonth() + 1).padStart(2, '0');
      const partitionTable = `pixels_history_${year}${month}`;

      const historyRecord = {
        grid_id: targetGridId,
        latitude: pixel.latitude,
        longitude: pixel.longitude,
        color: pixel.color,
        pattern_id: pixel.pattern_id,
        user_id: targetUserId,
        pixel_type: pixel.pixel_type,
        related_id: pixel.related_id,
        session_id: pixel.session_id,
        action_type: 'draw_fallback',
        history_date: historyDateForInsert,
        ...geoUpdateData,
        created_at: targetTime,
        updated_at: targetTime
      };

      await db(partitionTable).insert(historyRecord);
      logger.info('✅ 已补录缺失的历史记录', { gridId: targetGridId, partitionTable });

      // 🆕 如果有关联会话，且会话尚未设置城市，则更新会话信息
      if (pixel.session_id && geoData.city) {
        try {
          const session = await db('drawing_sessions')
            .where('id', pixel.session_id)
            .select(['start_city', 'session_name'])
            .first();

          if (session && !session.start_city) {
            const sessionUpdate = {
              start_city: geoData.city,
              start_country: geoData.country || '中国',
              updated_at: new Date()
            };

            // 如果 session_name 是默认值，则更新为城市名
            if (!session.session_name ||
              session.session_name === '绘制任务' ||
              session.session_name === 'GPS绘制' ||
              session.session_name === '手动绘制') {
              sessionUpdate.session_name = `${geoData.city || geoData.province || '未知地点'}绘制`;
            }

            await db('drawing_sessions')
              .where('id', pixel.session_id)
              .update(sessionUpdate);

            logger.info('✅ 异步地理编码：已成功更新会话地理信息', {
              sessionId: pixel.session_id,
              city: geoData.city
            });
          }
        } catch (sessionError) {
          logger.warn('更新会话地理信息失败（非阻塞）', {
            sessionId: pixel.session_id,
            error: sessionError.message
          });
        }
      }

      logger.debug('完整历史记录已写入', {
        pixelId,
        gridId: pixel.grid_id,
        partitionTable,
        province: geoData.province,
        city: geoData.city,
        district: geoData.district
      });

    } catch (error) {
      logger.error('写入完整历史记录失败', {
        pixelId,
        error: error.message
      });
      // 不抛出错误，避免影响主流程
    }
  }

  /**
   * 获取默认地理信息
   * @returns {Object} 默认地理信息
   */
  getDefaultGeoInfo() {
    return {
      // 基础地理信息（对应数据库现有字段）
      country: '中国',
      province: null,
      city: '未知城市',
      district: null,
      adcode: '',
      formatted_address: '未知地区',

      // 地理编码状态
      geocoded: false,
      geocoded_at: new Date()
    };
  }

  /**
   * 根据优先级获取队列键
   * @param {string} priority - 优先级
   * @returns {string} 队列键
   */
  getQueueKey(priority) {
    switch (priority) {
      case 'high':
        return `${this.queueKey}:high`;
      case 'low':
        return `${this.queueKey}:low`;
      default:
        return `${this.queueKey}:normal`;
    }
  }

  /**
   * 更新平均延迟统计
   * @param {number} processingTime - 处理时间
   * @param {number} taskCount - 任务数量
   */
  updateAverageLatency(processingTime, taskCount) {
    if (this.stats.averageLatency === 0) {
      this.stats.averageLatency = processingTime / taskCount;
    } else {
      // 使用指数移动平均
      const alpha = 0.1;
      this.stats.averageLatency =
        alpha * (processingTime / taskCount) +
        (1 - alpha) * this.stats.averageLatency;
    }
  }

  /**
   * 获取队列统计信息
   * @returns {Object} 统计信息
   */
  async getQueueStats() {
    try {
      // 获取Redis客户端（运行时获取）
      const redis = getRedisClient();

      // 检查 Redis 是否已初始化
      if (!redis) {
        return {
          ...this.stats,
          queueSizes: {
            high: 0,
            normal: 0,
            low: 0,
            retry: 0,
            total: 0
          },
          timestamp: new Date().toISOString(),
          redisAvailable: false
        };
      }

      const highQueueSize = await redis.lLen(`${this.queueKey}:high`);
      const normalQueueSize = await redis.lLen(`${this.queueKey}:normal`);
      const lowQueueSize = await redis.lLen(`${this.queueKey}:low`);
      const retryQueueSize = await redis.lLen(this.retryKey);

      return {
        ...this.stats,
        queueSizes: {
          high: highQueueSize,
          normal: normalQueueSize,
          low: lowQueueSize,
          retry: retryQueueSize,
          total: highQueueSize + normalQueueSize + lowQueueSize + retryQueueSize
        },
        timestamp: new Date().toISOString(),
        redisAvailable: true
      };
    } catch (error) {
      logger.error('获取队列统计失败', { error: error.message });
      return { ...this.stats, error: error.message };
    }
  }

  /**
   * 清空所有队列（管理用途）
   */
  async clearAllQueues() {
    try {
      // 获取Redis客户端（运行时获取）
      const redis = getRedisClient();

      if (!redis) {
        logger.warn('Redis 未初始化，无法清空队列');
        return false;
      }

      await redis.del(`${this.queueKey}:high`);
      await redis.del(`${this.queueKey}:normal`);
      await redis.del(`${this.queueKey}:low`);
      await redis.del(this.retryKey);

      // 重置统计
      this.stats = {
        totalQueued: 0,
        totalProcessed: 0,
        totalFailed: 0,
        batchProcessed: 0,
        averageLatency: 0
      };

      logger.info('所有地理编码队列已清空');
      return true;
    } catch (error) {
      logger.error('清空队列失败', { error: error.message });
      return false;
    }
  }

  /**
   * 休眠指定毫秒数
   * @param {number} ms - 毫秒数
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 创建单例实例
const asyncGeocodingService = new AsyncGeocodingService();

module.exports = asyncGeocodingService;