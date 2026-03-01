const { db } = require('../config/database');
const logger = require('../utils/logger');
const RegionLeaderboardCacheService = require('./regionLeaderboardCacheService');
const RegionLeaderboardOptimizationService = require('./regionLeaderboardOptimizationService');

/**
 * 地区排行榜数据预加载服务
 * 定期预加载热门地区榜数据到缓存，提高响应速度
 */
class RegionLeaderboardPreloadService {
  constructor() {
    // 预加载配置
    this.config = {
      // 预加载周期（分钟）
      preloadInterval: 15,

      // 预加载的统计周期
      periods: ['daily', 'weekly', 'monthly'],

      // 预加载的地理级别
      levels: ['province', 'city'],

      // 预加载的数据量
      preloadLimits: [10, 50, 100],

      // 热门地区列表
      hotRegions: [
        '北京', '上海', '广州', '深圳', '杭州', '南京', '武汉', '成都',
        '重庆', '西安', '天津', '苏州', '青岛', '大连', '厦门', '长沙',
        '广东省', '江苏省', '浙江省', '山东省', '河南省', '四川省', '湖北省', '湖南省'
      ],

      // 最大并发预加载数
      maxConcurrentPreloads: 5
    };

    // 预加载状态
    this.isPreloading = false;
    this.preloadQueue = [];
    this.preloadStats = {
      totalPreloads: 0,
      successfulPreloads: 0,
      failedPreloads: 0,
      lastPreloadTime: null,
      averagePreloadTime: 0
    };
  }

  /**
   * 启动预加载服务
   */
  start() {
    logger.info('🚀 启动地区榜数据预加载服务...');

    // 立即执行一次预加载
    this.preloadAllData();

    // 设置定期预加载
    this.preloadTimer = setInterval(() => {
      this.preloadAllData();
    }, this.config.preloadInterval * 60 * 1000);

    logger.info(`✅ 地区榜预加载服务已启动，预加载间隔: ${this.config.preloadInterval}分钟`);
  }

  /**
   * 停止预加载服务
   */
  stop() {
    if (this.preloadTimer) {
      clearInterval(this.preloadTimer);
      this.preloadTimer = null;
    }

    logger.info('🛑 地区榜数据预加载服务已停止');
  }

  /**
   * 预加载所有数据
   */
  async preloadAllData() {
    if (this.isPreloading) {
      logger.debug('⏳ 预加载正在进行中，跳过本次执行');
      return;
    }

    this.isPreloading = true;
    const startTime = Date.now();

    try {
      logger.info('🔄 开始预加载地区榜数据...');

      // 构建预加载任务队列
      this.buildPreloadQueue();

      // 执行预加载任务
      const results = await this.executePreloadQueue();

      // 统计结果
      this.updatePreloadStats(results, Date.now() - startTime);

      logger.info(`✅ 预加载完成: 成功 ${results.successful}/${results.total}, 耗时: ${Date.now() - startTime}ms`);

    } catch (error) {
      logger.error('❌ 预加载失败:', error);
    } finally {
      this.isPreloading = false;
    }
  }

  /**
   * 构建预加载队列
   */
  buildPreloadQueue() {
    this.preloadQueue = [];

    // 1. 基础数据预加载
    for (const period of this.config.periods) {
      for (const level of this.config.levels) {
        for (const limit of this.config.preloadLimits) {
          this.preloadQueue.push({
            type: 'basic',
            period,
            level,
            limit,
            offset: 0,
            priority: this.calculatePriority('basic', period, level, limit)
          });
        }
      }
    }

    // 2. 热门地区预加载
    for (const regionName of this.config.hotRegions) {
      for (const period of this.config.periods) {
        this.preloadQueue.push({
          type: 'hot_region',
          period,
          level: 'province',
          regionName,
          limit: 1,
          offset: 0,
          priority: this.calculatePriority('hot_region', period, 'province', 1)
        });
      }
    }

    // 3. 分页数据预加载（只预加载前几页）
    for (const period of this.config.periods) {
      for (const level of this.config.levels) {
        for (let offset = 0; offset <= 100; offset += 50) {
          this.preloadQueue.push({
            type: 'pagination',
            period,
            level,
            limit: 50,
            offset,
            priority: this.calculatePriority('pagination', period, level, offset)
          });
        }
      }
    }

    // 按优先级排序
    this.preloadQueue.sort((a, b) => b.priority - a.priority);

    logger.debug(`📋 预加载队列构建完成: ${this.preloadQueue.length} 个任务`);
  }

  /**
   * 计算任务优先级
   */
  calculatePriority(type, period, level, limit) {
    let priority = 0;

    // 基础优先级
    switch (type) {
      case 'hot_region':
        priority += 1000; // 最高优先级
        break;
      case 'basic':
        priority += 500;
        break;
      case 'pagination':
        priority += 100;
        break;
    }

    // 周期优先级
    switch (period) {
      case 'daily':
        priority += 300;
        break;
      case 'weekly':
        priority += 200;
        break;
      case 'monthly':
        priority += 100;
        break;
    }

    // 地理级别优先级
    if (level === 'province') {
      priority += 50;
    }

    // 数据量优先级（小数据量优先）
    if (limit <= 10) {
      priority += 30;
    } else if (limit <= 50) {
      priority += 20;
    }

    return priority;
  }

  /**
   * 执行预加载队列
   */
  async executePreloadQueue() {
    const results = {
      total: this.preloadQueue.length,
      successful: 0,
      failed: 0,
      errors: []
    };

    // 使用并发控制
    const chunks = this.chunkArray(this.preloadQueue, this.config.maxConcurrentPreloads);

    for (const chunk of chunks) {
      const promises = chunk.map(task => this.executePreloadTask(task));
      const chunkResults = await Promise.allSettled(promises);

      // 处理结果
      chunkResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.successful++;
        } else {
          results.failed++;
          results.errors.push({
            task: chunk[index],
            error: result.reason.message
          });
        }
      });

      // 短暂延迟，避免数据库压力过大
      await this.delay(100);
    }

    return results;
  }

  /**
   * 执行单个预加载任务
   */
  async executePreloadTask(task) {
    const startTime = Date.now();

    try {
      let data;

      switch (task.type) {
        case 'basic':
        case 'pagination':
          data = await this.preloadLeaderboardData(task);
          break;
        case 'hot_region':
          data = await this.preloadHotRegionData(task);
          break;
        default:
          throw new Error(`未知的预加载任务类型: ${task.type}`);
      }

      // 缓存数据
      if (data && data.data && data.data.length > 0) {
        await RegionLeaderboardCacheService.cacheRegionLeaderboard(
          task.level,
          task.period,
          data,
          task.limit,
          task.offset
        );
      }

      const duration = Date.now() - startTime;
      logger.debug(`✅ 预加载任务完成: ${this.formatTaskDescription(task)}, 耗时: ${duration}ms`);

      return { success: true, data, duration };

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.warn(`❌ 预加载任务失败: ${this.formatTaskDescription(task)}, 错误: ${error.message}`);

      return { success: false, error: error.message, duration };
    }
  }

  /**
   * 预加载排行榜数据
   */
  async preloadLeaderboardData(task) {
    const timeFilter = this.getTimeFilter(task.period);
    const groupByField = task.level === 'city' ? 'city' : 'province';

    const query = db('pixels')
      .select(
        `${groupByField} as region_name`,
        db.raw(`'${groupByField}' as region_level`),
        db.raw('COUNT(DISTINCT user_id) as user_count'),
        db.raw('COUNT(*) as pixel_count')
      )
      .where('geocoded', true)
      .whereNotNull(groupByField)
      .where(groupByField, '!=', '')
      .where(groupByField, '!=', '未知')
      .modify((queryBuilder) => {
        if (timeFilter) {
          queryBuilder.where('created_at', '>=', timeFilter);
        }
      })
      .groupBy(groupByField)
      .orderBy('pixel_count', 'desc')
      .limit(task.limit)
      .offset(task.offset);

    const results = await query;

    // 添加排名和额外信息
    const rankedResults = results.map((item, index) => ({
      ...item,
      rank: task.offset + index + 1,
      region_code: item.region_name,
      pixel_density: parseFloat((item.pixel_count / Math.max(1, item.user_count)).toFixed(2))
    }));

    return {
      level: groupByField,
      period: task.period,
      data: rankedResults,
      pagination: {
        limit: task.limit,
        offset: task.offset,
        total: rankedResults.length
      },
      generated_at: new Date().toISOString()
    };
  }

  /**
   * 预加载热门地区数据
   */
  async preloadHotRegionData(task) {
    const timeFilter = this.getTimeFilter(task.period);
    const groupByField = task.level === 'city' ? 'city' : 'province';

    const query = db('pixels')
      .select(
        `${groupByField} as region_name`,
        db.raw(`'${groupByField}' as region_level`),
        db.raw('COUNT(DISTINCT user_id) as user_count'),
        db.raw('COUNT(*) as pixel_count')
      )
      .where('geocoded', true)
      .where(groupByField, task.regionName)
      .whereNotNull(groupByField)
      .modify((queryBuilder) => {
        if (timeFilter) {
          queryBuilder.where('created_at', '>=', timeFilter);
        }
      })
      .groupBy(groupByField)
      .orderBy('pixel_count', 'desc')
      .limit(1);

    const results = await query;

    return {
      level: groupByField,
      period: task.period,
      data: results.map(item => ({
        ...item,
        rank: 1,
        region_code: item.region_name,
        pixel_density: parseFloat((item.pixel_count / Math.max(1, item.user_count)).toFixed(2))
      })),
      generated_at: new Date().toISOString()
    };
  }

  /**
   * 获取时间过滤器
   */
  getTimeFilter(period) {
    const now = new Date();
    let startDate;

    switch (period) {
      case 'daily':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'weekly':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay());
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'yearly':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    return startDate;
  }

  /**
   * 更新预加载统计
   */
  updatePreloadStats(results, duration) {
    this.preloadStats.totalPreloads += results.total;
    this.preloadStats.successfulPreloads += results.successful;
    this.preloadStats.failedPreloads += results.failed;
    this.preloadStats.lastPreloadTime = new Date();

    // 计算平均时间
    const totalTime = this.preloadStats.averagePreloadTime * (this.preloadStats.totalPreloads - results.total) + duration;
    this.preloadStats.averagePreloadTime = Math.round(totalTime / this.preloadStats.totalPreloads);

    logger.debug('📊 预加载统计更新:', this.preloadStats);
  }

  /**
   * 获取预加载统计信息
   */
  getPreloadStats() {
    return {
      ...this.preloadStats,
      isPreloading: this.isPreloading,
      queueLength: this.preloadQueue.length,
      config: this.config
    };
  }

  /**
   * 手动触发预加载
   */
  async triggerPreload(type = 'all') {
    logger.info(`🔄 手动触发预加载: ${type}`);

    switch (type) {
      case 'all':
        await this.preloadAllData();
        break;
      case 'hot_regions':
        await this.preloadHotRegionsOnly();
        break;
      case 'basic_data':
        await this.preloadBasicDataOnly();
        break;
      default:
        logger.warn(`未知的预加载类型: ${type}`);
    }
  }

  /**
   * 仅预加载热门地区
   */
  async preloadHotRegionsOnly() {
    const startTime = Date.now();
    let successful = 0;
    let total = 0;

    for (const period of this.config.periods) {
      for (const regionName of this.config.hotRegions) {
        total++;
        try {
          const task = {
            type: 'hot_region',
            period,
            level: 'province',
            regionName,
            limit: 1,
            offset: 0
          };

          const result = await this.executePreloadTask(task);
          if (result.success) {
            successful++;
          }
        } catch (error) {
          logger.warn(`热门地区预加载失败: ${regionName}-${period}`, error.message);
        }
      }
    }

    logger.info(`✅ 热门地区预加载完成: ${successful}/${total}, 耗时: ${Date.now() - startTime}ms`);
  }

  /**
   * 仅预加载基础数据
   */
  async preloadBasicDataOnly() {
    const startTime = Date.now();
    let successful = 0;
    let total = 0;

    for (const period of this.config.periods) {
      for (const level of this.config.levels) {
        for (const limit of [10, 50]) {
          total++;
          try {
            const task = {
              type: 'basic',
              period,
              level,
              limit,
              offset: 0
            };

            const result = await this.executePreloadTask(task);
            if (result.success) {
              successful++;
            }
          } catch (error) {
            logger.warn(`基础数据预加载失败: ${level}-${period}-${limit}`, error.message);
          }
        }
      }
    }

    logger.info(`✅ 基础数据预加载完成: ${successful}/${total}, 耗时: ${Date.now() - startTime}ms`);
  }

  /**
   * 工具方法
   */
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  formatTaskDescription(task) {
    switch (task.type) {
      case 'basic':
        return `${task.level}-${task.period}-${task.limit}`;
      case 'hot_region':
        return `${task.regionName}-${task.period}`;
      case 'pagination':
        return `${task.level}-${task.period}-offset${task.offset}`;
      default:
        return JSON.stringify(task);
    }
  }
}

module.exports = new RegionLeaderboardPreloadService();