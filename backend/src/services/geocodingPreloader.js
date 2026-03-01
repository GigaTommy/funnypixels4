/**
 * 地理信息预加载服务（简化版）
 * 预加载热点区域的地理信息，减少实时地理编码延迟
 * 注意：已移除PostGIS/OSM依赖，改用高德地图Web服务API
 *
 * 核心功能:
 * 1. 分析历史像素数据，识别热点区域
 * 2. 使用高德地图Web服务API预加载热点区域地理信息
 * 3. 智能预测下一个热点区域
 * 4. 定期更新预加载缓存
 * 5. 监控预加载效果和缓存命中率
 */

const { db } = require('../config/database');
const redis = require('../config/redis').redis;
const intelligentCacheService = require('./intelligentCacheService');
// 注意：已移除PostGIS服务，改用高德地图Web服务API
const amapWebService = require('./amapWebService');
const logger = require('../utils/logger');

/**
 * 地理信息预加载配置
 */
const PRELOADER_CONFIG = {
  // 预加载缓存配置
  cache: {
    ttl: parseInt(process.env.GEO_PRELOAD_CACHE_TTL) || 86400, // 24小时
    keyPrefix: 'geocoding:preload:',
    batchSize: parseInt(process.env.GEO_PRELOAD_BATCH_SIZE) || 100
  },

  // 热点区域分析配置
  hotspot: {
    analysisPeriod: parseInt(process.env.HOTSPOT_ANALYSIS_PERIOD) || 7, // 7天
    gridSize: parseInt(process.env.HOTSPOT_GRID_SIZE) || 0.01, // 网格大小（度）
    minPixelCount: parseInt(process.env.HOTSPOT_MIN_PIXEL_COUNT) || 10, // 最小像素数
    maxHotspots: parseInt(process.env.HOTSPOT_MAX_COUNT) || 1000 // 最大热点数量
  },

  // 预加载任务配置
  task: {
    interval: parseInt(process.env.GEO_PRELOAD_INTERVAL) || 3600000, // 1小时
    maxConcurrent: parseInt(process.env.GEO_PRELOAD_MAX_CONCURRENT) || 10,
    timeout: parseInt(process.env.GEO_PRELOAD_TIMEOUT) || 30000 // 30秒
  },

  // 预测配置
  prediction: {
    enabled: process.env.GEO_PRELOAD_PREDICTION !== 'false',
    lookAheadHours: parseInt(process.env.GEO_PRELOAD_LOOKAHEAD) || 6, // 预测6小时后的热点
    predictionAccuracy: parseFloat(process.env.GEO_PRELOAD_ACCURACY) || 0.8 // 80%准确度
  }
};

/**
 * 地理信息预加载服务
 */
class GeocodingPreloader {
  constructor() {
    // 预加载状态
    this.isPreloading = false;
    this.lastPreloadTime = null;
    this.currentPreloadProgress = null;

    // 缓存键
    this.cacheKeys = {
      hotspots: PRELOADER_CONFIG.cache.keyPrefix + 'hotspots',
      predictions: PRELOADER_CONFIG.cache.keyPrefix + 'predictions',
      progress: PRELOADER_CONFIG.cache.keyPrefix + 'progress'
    };

    // 性能统计
    this.stats = {
      totalPreloads: 0,
      successfulPreloads: 0,
      failedPreloads: 0,
      hotspotsFound: 0,
      predictionsMade: 0,
      cacheHits: 0,
      averagePreloadTime: 0,
      lastError: null
    };

    // 启动定期任务
    this.startPeriodicTasks();

    logger.info('🌍 地理信息预加载服务初始化完成', {
      interval: PRELOADER_CONFIG.task.interval,
      batchSize: PRELOADER_CONFIG.cache.batchSize,
      predictionEnabled: PRELOADER_CONFIG.prediction.enabled
    });
  }

  /**
   * 启动定期预加载任务
   */
  startPeriodicTasks() {
    // 定期预加载任务
    setInterval(async () => {
      if (!this.isPreloading) {
        await this.performPreload().catch(error => {
          logger.error('定期预加载失败', { error: error.message });
          this.stats.failedPreloads++;
          this.stats.lastError = error.message;
        });
      }
    }, PRELOADER_CONFIG.task.interval);

    // 定期热点分析任务
    setInterval(async () => {
      await this.analyzeHotspots().catch(error => {
        logger.error('热点分析失败', { error: error.message });
      });
    }, PRELOADER_CONFIG.task.interval * 2); // 2小时分析一次

    logger.debug('🕐 地理预加载定时任务已启动');
  }

  /**
   * 执行完整的预加载流程
   */
  async performPreload() {
    if (this.isPreloading) {
      logger.warn('预加载任务正在运行中，跳过本次执行');
      return;
    }

    this.isPreloading = true;
    const startTime = Date.now();

    try {
      logger.info('🚀 开始地理信息预加载...');

      // 1. 分析热点区域
      const hotspots = await this.analyzeHotspots();
      if (hotspots.length === 0) {
        logger.info('📊 未发现热点区域，跳过预加载');
        return;
      }

      // 2. 预加载热点区域地理信息
      const preloadResult = await this.preloadHotspots(hotspots);

      // 3. 预测下一个热点区域（可选）
      let predictions = [];
      if (PRELOADER_CONFIG.prediction.enabled) {
        predictions = await this.predictNextHotspots();
      }

      // 4. 更新缓存
      await this.updatePreloadCache(hotspots, predictions);

      // 5. 更新统计信息
      this.updatePreloadStats(startTime, hotspots.length, preloadResult.successCount);

      this.lastPreloadTime = new Date();

      const duration = Date.now() - startTime;
      logger.info('✅ 地理信息预加载完成', {
        hotspotsFound: hotspots.length,
        successCount: preloadResult.successCount,
        failureCount: preloadResult.failureCount,
        predictionsMade: predictions.length,
        duration: `${duration}ms`
      });

      return {
        success: true,
        hotspotsFound: hotspots.length,
        successCount: preloadResult.successCount,
        failureCount: preloadResult.failureCount,
        predictionsMade: predictions.length,
        duration
      };

    } catch (error) {
      logger.error('地理信息预加载失败', { error: error.message });
      this.stats.failedPreloads++;
      this.stats.lastError = error.message;
      throw error;
    } finally {
      this.isPreloading = false;
      this.currentPreloadProgress = null;
    }
  }

  /**
   * 分析热点区域
   * @returns {Promise<Array>} 热点区域数组
   */
  async analyzeHotspots() {
    try {
      logger.debug('🔍 开始分析热点区域...');

      const startTime = Date.now();
      const analysisPeriod = PRELOADER_CONFIG.hotspot.analysisPeriod;
      const gridSize = PRELOADER_CONFIG.hotspot.gridSize;
      const minPixelCount = PRELOADER_CONFIG.hotspot.minPixelCount;
      const maxHotspots = PRELOADER_CONFIG.hotspot.maxHotspots;

      // 计算分析时间范围
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - analysisPeriod * 24 * 60 * 60 * 1000);

      logger.debug('📊 分析参数', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        gridSize,
        minPixelCount
      });

      // 分析像素热点
      const hotspots = await db.raw(`
        WITH pixel_grids AS (
          SELECT
            ROUND(latitude / ?) * ? as lat_grid,
            ROUND(longitude / ?) * ? as lng_grid,
            COUNT(*) as pixel_count,
            COUNT(DISTINCT user_id) as user_count,
            MIN(created_at) as first_pixel,
            MAX(created_at) as last_pixel,
            AVG(created_at) as avg_pixel_time
          FROM pixels
          WHERE created_at >= ? AND created_at <= ?
            AND latitude IS NOT NULL AND longitude IS NOT NULL
          GROUP BY lat_grid, lng_grid
          HAVING COUNT(*) >= ?
        ),
        hotspot_candidates AS (
          SELECT
            lat_grid,
            lng_grid,
            pixel_count,
            user_count,
            first_pixel,
            last_pixel,
            avg_pixel_time,
            -- 计算热度分数（像素数量 + 用户多样性 + 活跃度）
            (pixel_count * 1.0 + user_count * 2.0 +
             EXTRACT(EPOCH FROM (last_pixel - first_pixel)) / 3600.0 * 0.1) as hotness_score
          FROM pixel_grids
        )
        SELECT
          lat_grid,
          lng_grid,
          pixel_count,
          user_count,
          first_pixel,
          last_pixel,
          hotness_score
        FROM hotspot_candidates
        ORDER BY hotness_score DESC
        LIMIT ?
      `, [gridSize, gridSize, gridSize, gridSize, startDate, endDate, minPixelCount, maxHotspots]);

      // 格式化热点数据
      const formattedHotspots = hotspots.rows.map(row => ({
        latitude: parseFloat(row.lat_grid),
        longitude: parseFloat(row.lng_grid),
        pixelCount: parseInt(row.pixel_count),
        userCount: parseInt(row.user_count),
        firstPixel: row.first_pixel,
        lastPixel: row.last_pixel,
        hotnessScore: parseFloat(row.hotness_score),
        gridSize: gridSize
      }));

      // 过滤掉已有缓存的热点
      const uncachedHotspots = await this.filterCachedHotspots(formattedHotspots);

      const analysisTime = Date.now() - startTime;
      logger.debug('✅ 热点区域分析完成', {
        totalFound: formattedHotspots.length,
        uncachedCount: uncachedHotspots.length,
        analysisTime: `${analysisTime}ms`
      });

      this.stats.hotspotsFound = uncachedHotspots.length;
      return uncachedHotspots;

    } catch (error) {
      logger.error('热点区域分析失败', { error: error.message });
      return [];
    }
  }

  /**
   * 过滤已有缓存的热点
   * @param {Array} hotspots 热点数组
   * @returns {Promise<Array>} 未缓存的热点数组
   */
  async filterCachedHotspots(hotspots) {
    try {
      const batchSize = PRELOADER_CONFIG.cache.batchSize;
      const uncachedHotspots = [];

      for (let i = 0; i < hotspots.length; i += batchSize) {
        const batch = hotspots.slice(i, i + batchSize);

        // 检查缓存
        const cachePromises = batch.map(async (hotspot) => {
          const cacheKey = this.getCacheKey(hotspot.latitude, hotspot.longitude);
          const cached = await intelligentCacheService.get(cacheKey);
          return { hotspot, cached };
        });

        const results = await Promise.all(cachePromises);

        // 过滤未缓存的热点
        for (const { hotspot, cached } of results) {
          if (!cached) {
            uncachedHotspots.push(hotspot);
          } else {
            this.stats.cacheHits++;
          }
        }
      }

      return uncachedHotspots;

    } catch (error) {
      logger.warn('过滤缓存热点失败', { error: error.message });
      return hotspots; // 出错时返回所有热点
    }
  }

  /**
   * 预加载热点区域地理信息
   * @param {Array} hotspots 热点区域数组
   * @returns {Promise<Object>} 预加载结果
   */
  async preloadHotspots(hotspots) {
    const startTime = Date.now();
    const maxConcurrent = PRELOADER_CONFIG.task.maxConcurrent;
    const timeout = PRELOADER_CONFIG.task.timeout;

    let successCount = 0;
    let failureCount = 0;

    try {
      logger.info('🔄 开始预加载热点地理信息', {
        hotspotCount: hotspots.length,
        maxConcurrent
      });

      // 分批并发处理
      for (let i = 0; i < hotspots.length; i += maxConcurrent) {
        const batch = hotspots.slice(i, i + maxConcurrent);

        const batchPromises = batch.map(async (hotspot) => {
          try {
            // 设置超时
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('预加载超时')), timeout);
            });

            const preloadPromise = this.preloadSingleHotspot(hotspot);

            await Promise.race([preloadPromise, timeoutPromise]);
            successCount++;
            return { success: true, hotspot };

          } catch (error) {
            logger.warn('预加载单个热点失败', {
              latitude: hotspot.latitude,
              longitude: hotspot.longitude,
              error: error.message
            });
            failureCount++;
            return { success: false, hotspot, error: error.message };
          }
        });

        // 等待当前批次完成
        await Promise.allSettled(batchPromises);

        // 更新进度
        this.currentPreloadProgress = {
          total: hotspots.length,
          processed: Math.min(i + maxConcurrent, hotspots.length),
          successCount,
          failureCount
        };

        logger.debug(`预加载进度: ${this.currentPreloadProgress.processed}/${this.currentPreloadProgress.total}`);
      }

      const duration = Date.now() - startTime;
      logger.info('✅ 热点地理信息预加载完成', {
        total: hotspots.length,
        successCount,
        failureCount,
        duration: `${duration}ms`,
        averageTime: `${(duration / hotspots.length).toFixed(2)}ms/hotspot`
      });

      return {
        success: true,
        total: hotspots.length,
        successCount,
        failureCount,
        duration
      };

    } catch (error) {
      logger.error('预加载热点失败', { error: error.message });
      return {
        success: false,
        total: hotspots.length,
        successCount,
        failureCount,
        error: error.message
      };
    }
  }

  /**
   * 预加载单个热点
   * @param {Object} hotspot 热点信息
   */
  async preloadSingleHotspot(hotspot) {
    try {
      // 使用高德地图Web服务API获取地理信息
      const geoResult = await amapWebService.reverseGeocode(
        hotspot.latitude,
        hotspot.longitude,
        { cacheKey: `preload:${hotspot.latitude.toFixed(4)},${hotspot.longitude.toFixed(4)}` }
      );

      if (geoResult && geoResult.geocoded) {
        // 缓存结果
        const cacheKey = this.getCacheKey(hotspot.latitude, hotspot.longitude);
        await intelligentCacheService.set(cacheKey, geoResult, {
          l1TTL: PRELOADER_CONFIG.cache.ttl,
          l2TTL: PRELOADER_CONFIG.cache.ttl * 2
        });

        logger.debug('✅ 单个热点预加载成功', {
          latitude: hotspot.latitude,
          longitude: hotspot.longitude,
          city: geoResult.city,
          province: geoResult.province
        });

        return geoResult;
      } else {
        logger.debug('⚠️ 单个热点无匹配结果', {
          latitude: hotspot.latitude,
          longitude: hotspot.longitude
        });
        return null;
      }

    } catch (error) {
      logger.error('预加载单个热点失败', {
        latitude: hotspot.latitude,
        longitude: hotspot.longitude,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 预测下一个热点区域
   * @returns {Promise<Array>} 预测的热点数组
   */
  async predictNextHotspots() {
    if (!PRELOADER_CONFIG.prediction.enabled) {
      return [];
    }

    try {
      logger.debug('🔮 开始预测下一个热点区域...');

      const lookAheadHours = PRELOADER_CONFIG.prediction.lookAheadHours;
      const maxPredictions = 50; // 最多预测50个区域

      // 分析像素活动的时间模式
      const predictions = await db.raw(`
        WITH hourly_activity AS (
          SELECT
            EXTRACT(HOUR FROM created_at) as hour,
            ROUND(latitude / ?) * ? as lat_grid,
            ROUND(longitude / ?) * ? as lng_grid,
            COUNT(*) as pixel_count,
            COUNT(DISTINCT user_id) as user_count
          FROM pixels
          WHERE created_at >= NOW() - INTERVAL '7 days'
            AND created_at < NOW()
            AND latitude IS NOT NULL AND longitude IS NOT NULL
          GROUP BY hour, lat_grid, lng_grid
          HAVING COUNT(*) >= 3
        ),
        prediction_scores AS (
          SELECT
            lat_grid,
            lng_grid,
            -- 基于历史活动预测未来
            AVG(pixel_count) * 1.5 as predicted_count,
            AVG(user_count) * 1.2 as predicted_users,
            -- 考虑时间模式（当前小时+1）
            AVG(CASE WHEN hour = EXTRACT(HOUR FROM NOW()) + 1 THEN pixel_count ELSE 0 END) * 2.0 as time_boost
          FROM hourly_activity
          GROUP BY lat_grid, lng_grid
        )
        SELECT
          lat_grid * 1.0 as latitude,
          lng_grid * 1.0 as longitude,
          predicted_count,
          predicted_users,
          time_boost,
          (predicted_count + predicted_users + time_boost) as prediction_score
        FROM prediction_scores
        ORDER BY prediction_score DESC
        LIMIT ?
      `, [0.01, 0.01, 0.01, 0.01, maxPredictions]);

      const formattedPredictions = predictions.rows.map(row => ({
        latitude: parseFloat(row.latitude),
        longitude: parseFloat(row.longitude),
        predictedCount: Math.round(parseFloat(row.predicted_count)),
        predictedUsers: Math.round(parseFloat(row.predicted_users)),
        predictionScore: parseFloat(row.prediction_score),
        lookAheadHours: lookAheadHours
      }));

      this.stats.predictionsMade = formattedPredictions.length;

      logger.debug('✅ 热点预测完成', {
        predictionsCount: formattedPredictions.length
      });

      return formattedPredictions;

    } catch (error) {
      logger.error('热点预测失败', { error: error.message });
      return [];
    }
  }

  /**
   * 更新预加载缓存
   * @param {Array} hotspots 热点数组
   * @param {Array} predictions 预测数组
   */
  async updatePreloadCache(hotspots, predictions) {
    try {
      // 缓存热点信息
      await intelligentCacheService.set(this.cacheKeys.hotspots, {
        hotspots: hotspots,
        timestamp: new Date(),
        count: hotspots.length
      }, {
        l1TTL: PRELOADER_CONFIG.cache.tTL,
        l2TTL: PRELOADER_CONFIG.cache.tTL * 2
      });

      // 缓存预测信息
      if (predictions.length > 0) {
        await intelligentCacheService.set(this.cacheKeys.predictions, {
          predictions: predictions,
          timestamp: new Date(),
          count: predictions.length
        }, {
          l1TTL: PRELOADER_CONFIG.cache.tTL,
          l2TTL: PRELOADER_CONFIG.cache.tTL * 2
        });
      }

      logger.debug('💾 预加载缓存已更新', {
        hotspotsCount: hotspots.length,
        predictionsCount: predictions.length
      });

    } catch (error) {
      logger.warn('更新预加载缓存失败', { error: error.message });
    }
  }

  /**
   * 更新预加载统计信息
   */
  updatePreloadStats(startTime, hotspotsFound, successCount) {
    const duration = Date.now() - startTime;

    this.stats.totalPreloads++;
    this.stats.successfulPreloads++;

    // 更新平均预加载时间
    if (this.stats.averagePreloadTime === 0) {
      this.stats.averagePreloadTime = duration;
    } else {
      const alpha = 0.1;
      this.stats.averagePreloadTime = alpha * duration + (1 - alpha) * this.stats.averagePreloadTime;
    }
  }

  /**
   * 获取缓存键
   * @param {number} latitude 纬度
   * @param {number} longitude 经度
   * @returns {string} 缓存键
   */
  getCacheKey(latitude, longitude) {
    // 截断到4位小数以减少缓存项数量
    const lat = latitude.toFixed(4);
    const lng = longitude.toFixed(4);
    return `${PRELOADER_CONFIG.cache.keyPrefix}${lat},${lng}`;
  }

  /**
   * 检查坐标是否在预加载热点附近
   * @param {number} latitude 纬度
   * @param {number} longitude 经度
   * @param {number} radius 搜索半径（度）
   * @returns {Promise<Object>} 最近的预加载热点
   */
  async findNearbyPreloadedHotspot(latitude, longitude, radius = 0.01) {
    try {
      const hotspotsData = await intelligentCacheService.get(this.cacheKeys.hotspots);
      if (!hotspotsData || !hotspotsData.hotspots || hotspotsData.hotspots.length === 0) {
        return null;
      }

      let nearestHotspot = null;
      let minDistance = radius;

      for (const hotspot of hotspotsData.hotspots) {
        const distance = Math.sqrt(
          Math.pow(latitude - hotspot.latitude, 2) +
          Math.pow(longitude - hotspot.longitude, 2)
        );

        if (distance < minDistance) {
          minDistance = distance;
          nearestHotspot = hotspot;
        }
      }

      if (nearestHotspot) {
        logger.debug('🎯 找到附近的预加载热点', {
          requestedLat: latitude,
          requestedLng: longitude,
          nearestLat: nearestHotspot.latitude,
          nearestLng: nearestHotspot.longitude,
          distance: minDistance.toFixed(6)
        });
      }

      return nearestHotspot;

    } catch (error) {
      logger.warn('查找附近预加载热点失败', { error: error.message });
      return null;
    }
  }

  /**
   * 获取预加载统计信息
   */
  getStats() {
    return {
      ...this.stats,
      isPreloading: this.isPreloading,
      lastPreloadTime: this.lastPreloadTime,
      currentProgress: this.currentPreloadProgress,
      config: PRELOADER_CONFIG,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 重置统计信息
   */
  resetStats() {
    this.stats = {
      totalPreloads: 0,
      successfulPreloads: 0,
      failedPreloads: 0,
      hotspotsFound: 0,
      predictionsMade: 0,
      cacheHits: 0,
      averagePreloadTime: 0,
      lastError: null
    };

    logger.info('📊 地理预加载统计信息已重置');
  }

  /**
   * 手动触发预加载
   */
  async forcePreload() {
    try {
      logger.info('🔄 手动触发地理信息预加载...');
      const result = await this.performPreload();
      return result;
    } catch (error) {
      logger.error('手动预加载失败', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * 清空预加载缓存
   */
  async clearCache() {
    try {
      const keys = [
        this.cacheKeys.hotspots,
        this.cacheKeys.predictions,
        this.cacheKeys.progress
      ];

      const deletePromises = keys.map(key => intelligentCacheService.delete(key));
      await Promise.all(deletePromises);

      logger.info('🗑️ 预加载缓存已清空');
    } catch (error) {
      logger.error('清空预加载缓存失败', { error: error.message });
    }
  }

  /**
   * 获取预加载进度
   */
  getPreloadProgress() {
    return this.currentPreloadProgress || {
      total: 0,
      processed: 0,
      successCount: 0,
      failureCount: 0
    };
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      const stats = this.getStats();
      const hotspotsData = await intelligentCacheService.get(this.cacheKeys.hotspots);

      const health = {
        status: 'healthy',
        message: '地理预加载服务运行正常',
        stats,
        hotspotsCount: hotspotsData?.hotspots?.length || 0,
        lastPreloadTime: stats.lastPreloadTime,
        cacheHitRate: stats.hotspotsFound > 0 ?
          ((stats.cacheHits / (stats.hotspotsFound + stats.cacheHits)) * 100).toFixed(2) + '%' : '0%'
      };

      // 健康状态判断
      if (stats.failedPreloads > stats.successfulPreloads * 0.2) {
        health.status = 'warning';
        health.message = '预加载失败率较高';
      }

      if (stats.lastError) {
        health.status = 'warning';
        health.message = '存在预加载错误';
      }

      if (!stats.lastPreloadTime ||
          (Date.now() - new Date(stats.lastPreloadTime).getTime()) > PRELOADER_CONFIG.task.interval * 3) {
        health.status = 'critical';
        health.message = '预加载任务长时间未执行';
      }

      return health;

    } catch (error) {
      logger.error('地理预加载健康检查失败', { error: error.message });
      return {
        status: 'critical',
        message: '健康检查失败',
        error: error.message
      };
    }
  }
}

// 创建单例实例
const geocodingPreloader = new GeocodingPreloader();

module.exports = geocodingPreloader;