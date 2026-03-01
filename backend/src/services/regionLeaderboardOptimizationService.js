const { db } = require('../config/database');
const logger = require('../utils/logger');
const RegionLeaderboardCacheService = require('./regionLeaderboardCacheService');

/**
 * 地区排行榜性能优化服务
 * 提供数据库查询优化、索引建议、批量处理等功能
 */
class RegionLeaderboardOptimizationService {
  constructor() {
    // 查询优化配置
    this.queryOptimization = {
      maxBatchSize: 1000,
      connectionPoolSize: 10,
      queryTimeout: 30000,
      enableParallelQueries: true
    };

    // 性能监控阈值
    this.performanceThresholds = {
      slowQueryTime: 1000,    // 1秒
      memoryUsageMB: 100,      // 100MB
      concurrentQueries: 10     // 10个并发查询
    };

    // 索引建议
    this.indexRecommendations = [
      {
        table: 'pixels',
        columns: ['geocoded', 'created_at'],
        type: 'partial',
        description: '用于按时间和地理编码状态筛选像素'
      },
      {
        table: 'pixels',
        columns: ['province', 'pixel_count'],
        type: 'composite',
        description: '用于省份统计优化'
      },
      {
        table: 'pixels',
        columns: ['city', 'pixel_count'],
        type: 'composite',
        description: '用于城市统计优化'
      },
      {
        table: 'pixels',
        columns: ['user_id', 'created_at'],
        type: 'composite',
        description: '用于用户活跃度统计'
      }
    ];
  }

  /**
   * 优化地区榜查询
   */
  async optimizeRegionQuery(level, period, limit = 50, offset = 0) {
    const startTime = Date.now();

    try {
      logger.debug(`🔄 开始优化地区榜查询: ${level}-${period}, limit=${limit}, offset=${offset}`);

      // 1. 查询优化策略选择
      const strategy = this.selectOptimizationStrategy(level, period, limit, offset);
      logger.debug(`📋 选择优化策略: ${strategy.name}`);

      // 2. 执行优化查询
      let result;
      switch (strategy.type) {
        case 'cached':
          result = await this.executeCachedQuery(level, period, limit, offset);
          break;
        case 'materialized_view':
          result = await this.executeMaterializedViewQuery(level, period, limit, offset);
          break;
        case 'batch_processing':
          result = await this.executeBatchQuery(level, period, limit, offset);
          break;
        case 'parallel_query':
          result = await this.executeParallelQuery(level, period, limit, offset);
          break;
        default:
          result = await this.executeStandardQuery(level, period, limit, offset);
      }

      // 3. 性能监控和日志
      const queryTime = Date.now() - startTime;
      this.logQueryPerformance(level, period, strategy, queryTime, result);

      // 4. 异步优化建议
      this.scheduleOptimizationTasks(result);

      return {
        ...result,
        optimization: {
          strategy: strategy.name,
          queryTime,
          performanceGrade: this.getPerformanceGrade(queryTime)
        }
      };

    } catch (error) {
      const queryTime = Date.now() - startTime;
      logger.error('❌ 地区榜查询优化失败:', {
        error: error.message,
        level,
        period,
        queryTime
      });
      throw error;
    }
  }

  /**
   * 选择优化策略
   */
  selectOptimizationStrategy(level, period, limit, offset) {
    // 缓存优先策略
    if (offset === 0 && limit <= 100) {
      return {
        name: 'cache_first',
        type: 'cached',
        priority: 1,
        description: '优先使用缓存，适用于小数据集查询'
      };
    }

    // 物化视图策略（适用于大数据集）
    if (limit > 100 || offset > 0) {
      return {
        name: 'materialized_view',
        type: 'materialized_view',
        priority: 2,
        description: '使用物化视图，适用于大数据集查询'
      };
    }

    // 并行查询策略（适用于复杂查询）
    if (period === 'monthly' || period === 'yearly') {
      return {
        name: 'parallel_query',
        type: 'parallel_query',
        priority: 3,
        description: '并行查询，适用于长周期统计'
      };
    }

    // 批处理策略（默认）
    return {
      name: 'batch_processing',
      type: 'batch_processing',
      priority: 4,
      description: '批处理查询，适用于一般场景'
    };
  }

  /**
   * 执行缓存查询
   */
  async executeCachedQuery(level, period, limit, offset) {
    // 尝试从缓存获取
    const cachedData = await RegionLeaderboardCacheService.getCachedRegionLeaderboard(level, period, limit, offset);

    if (cachedData) {
      return {
        data: cachedData,
        source: 'cache',
        cached: true
      };
    }

    // 缓存未命中，执行标准查询
    return await this.executeStandardQuery(level, period, limit, offset);
  }

  /**
   * 执行物化视图查询
   */
  async executeMaterializedViewQuery(level, period, limit, offset) {
    try {
      // 检查物化视图是否存在
      const viewName = `mv_region_leaderboard_${level}_${period}`;
      const viewExists = await this.checkMaterializedViewExists(viewName);

      if (viewExists) {
        // 从物化视图查询
        const query = db(`${viewName}`)
          .select('*')
          .orderBy('pixel_count', 'desc')
          .limit(limit)
          .offset(offset);

        const results = await query;

        return {
          data: results,
          source: 'materialized_view',
          cached: false
        };
      } else {
        // 物化视图不存在，创建并刷新
        await this.createMaterializedView(level, period);
        return await this.executeStandardQuery(level, period, limit, offset);
      }
    } catch (error) {
      logger.warn('⚠️ 物化视图查询失败，回退到标准查询:', error.message);
      return await this.executeStandardQuery(level, period, limit, offset);
    }
  }

  /**
   * 执行批处理查询
   */
  async executeBatchQuery(level, period, limit, offset) {
    const batchSize = Math.min(limit, this.queryOptimization.maxBatchSize);
    const timeFilter = this.getTimeFilter(period);
    const groupByField = level === 'city' ? 'city' : 'province';

    // 优化的批处理查询
    const query = db('pixels')
      .select(
        `${groupByField} as region_name`,
        db.raw(`'${groupByField}' as region_level`),
        db.raw('COUNT(DISTINCT user_id) as user_count'),
        db.raw('COUNT(*) as pixel_count'),
        db.raw('MIN(created_at) as first_pixel_at'),
        db.raw('MAX(created_at) as last_pixel_at')
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
      .limit(batchSize)
      .offset(offset);

    const results = await query;

    // 添加排名和额外信息
    const rankedResults = results.map((item, index) => ({
      ...item,
      rank: offset + index + 1,
      region_code: item.region_name,
      pixel_density: parseFloat((item.pixel_count / Math.max(1, item.user_count)).toFixed(2)),
      activity_span: this.calculateActivitySpan(item.first_pixel_at, item.last_pixel_at)
    }));

    return {
      data: rankedResults,
      source: 'batch_query',
      cached: false
    };
  }

  /**
   * 执行并行查询
   */
  async executeParallelQuery(level, period, limit, offset) {
    try {
      const timeFilter = this.getTimeFilter(period);
      const groupByField = level === 'city' ? 'city' : 'province';

      // 并行执行多个查询
      const [mainQuery, countQuery] = await Promise.all([
        // 主查询
        db('pixels')
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
          .limit(limit)
          .offset(offset),

        // 计数查询
        db('pixels')
          .countDistinct(`${groupByField} as count`)
          .where('geocoded', true)
          .whereNotNull(groupByField)
          .where(groupByField, '!=', '')
          .where(groupByField, '!=', '未知')
          .modify((queryBuilder) => {
            if (timeFilter) {
              queryBuilder.where('created_at', '>=', timeFilter);
            }
          })
      ]);

      // 处理结果
      const totalCount = countQuery[0]?.count || 0;
      const rankedResults = mainQuery.map((item, index) => ({
        ...item,
        rank: offset + index + 1,
        region_code: item.region_name
      }));

      return {
        data: rankedResults,
        pagination: {
          total: parseInt(totalCount),
          limit,
          offset
        },
        source: 'parallel_query',
        cached: false
      };

    } catch (error) {
      logger.warn('⚠️ 并行查询失败，回退到标准查询:', error.message);
      return await this.executeStandardQuery(level, period, limit, offset);
    }
  }

  /**
   * 执行标准查询
   */
  async executeStandardQuery(level, period, limit, offset) {
    const timeFilter = this.getTimeFilter(period);
    const groupByField = level === 'city' ? 'city' : 'province';

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
      .limit(limit)
      .offset(offset);

    const results = await query;

    const rankedResults = results.map((item, index) => ({
      ...item,
      rank: offset + index + 1,
      region_code: item.region_name
    }));

    return {
      data: rankedResults,
      source: 'standard_query',
      cached: false
    };
  }

  /**
   * 检查物化视图是否存在
   */
  async checkMaterializedViewExists(viewName) {
    try {
      const result = await db.raw(`
        SELECT EXISTS (
          SELECT FROM information_schema.views
          WHERE table_name = ?
        ) as exists
      `, [viewName]);

      return result[0]?.exists === true;
    } catch (error) {
      logger.warn('检查物化视图存在性失败:', error.message);
      return false;
    }
  }

  /**
   * 创建物化视图
   */
  async createMaterializedView(level, period) {
    try {
      const viewName = `mv_region_leaderboard_${level}_${period}`;
      const timeFilter = this.getTimeFilter(period);
      const groupByField = level === 'city' ? 'city' : 'province';

      await db.raw(`
        CREATE MATERIALIZED VIEW IF NOT EXISTS ${viewName} AS
        SELECT
          ${groupByField} as region_name,
          '${groupByField}' as region_level,
          COUNT(DISTINCT user_id) as user_count,
          COUNT(*) as pixel_count,
          MIN(created_at) as first_pixel_at,
          MAX(created_at) as last_pixel_at
        FROM pixels
        WHERE geocoded = true
          AND ${groupByField} IS NOT NULL
          AND ${groupByField} != ''
          AND ${groupByField} != '未知'
          ${timeFilter ? `AND created_at >= '${timeFilter.toISOString()}'` : ''}
        GROUP BY ${groupByField}
        ORDER BY pixel_count DESC
      `);

      logger.info(`✅ 创建物化视图成功: ${viewName}`);
    } catch (error) {
      logger.error('❌ 创建物化视图失败:', error);
    }
  }

  /**
   * 计算活跃时间跨度
   */
  calculateActivitySpan(firstPixelAt, lastPixelAt) {
    if (!firstPixelAt || !lastPixelAt) return 0;

    const first = new Date(firstPixelAt);
    const last = new Date(lastPixelAt);
    return Math.floor((last - first) / (1000 * 60 * 60 * 24)); // 天数
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
   * 记录查询性能
   */
  logQueryPerformance(level, period, strategy, queryTime, result) {
    const performanceData = {
      level,
      period,
      strategy: strategy.name,
      queryTime,
      resultCount: result.data?.length || 0,
      source: result.source,
      timestamp: new Date().toISOString()
    };

    if (queryTime > this.performanceThresholds.slowQueryTime) {
      logger.warn('🐌 慢查询检测:', performanceData);
    } else {
      logger.debug('📊 查询性能:', performanceData);
    }

    // 记录到性能统计表（如果存在）
    this.recordPerformanceMetrics(performanceData);
  }

  /**
   * 获取性能等级
   */
  getPerformanceGrade(queryTime) {
    if (queryTime < 100) return 'A'; // 优秀
    if (queryTime < 300) return 'B'; // 良好
    if (queryTime < 1000) return 'C'; // 一般
    return 'D'; // 需要优化
  }

  /**
   * 记录性能指标
   */
  async recordPerformanceMetrics(data) {
    try {
      // 这里可以将性能数据记录到数据库或监控系统
      // 暂时只记录日志
      logger.debug('性能指标记录:', data);
    } catch (error) {
      // 忽略性能记录失败
    }
  }

  /**
   * 调度优化任务
   */
  scheduleOptimizationTasks(result) {
    // 异步执行优化任务，不阻塞主查询
    setImmediate(() => {
      this.analyzeQueryPatterns(result);
      this.suggestIndexOptimizations(result);
    });
  }

  /**
   * 分析查询模式
   */
  analyzeQueryPatterns(result) {
    try {
      // 分析查询模式，为后续优化提供数据
      logger.debug('🔍 分析查询模式:', {
        resultCount: result.data?.length,
        source: result.source,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.warn('查询模式分析失败:', error.message);
    }
  }

  /**
   * 建议索引优化
   */
  suggestIndexOptimizations(result) {
    try {
      // 基于查询结果建议索引优化
      logger.debug('💡 索引优化建议:', this.indexRecommendations);
    } catch (error) {
      logger.warn('索引建议生成失败:', error.message);
    }
  }

  /**
   * 获取性能统计信息
   */
  async getPerformanceStats() {
    try {
      // 获取数据库性能统计
      const dbStats = await this.getDatabaseStats();

      return {
        database: dbStats,
        optimization: {
          strategies: Object.keys(this.queryOptimization),
          thresholds: this.performanceThresholds,
          indexRecommendations: this.indexRecommendations
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('获取性能统计失败:', error);
      return null;
    }
  }

  /**
   * 获取数据库统计信息
   */
  async getDatabaseStats() {
    try {
      const stats = await Promise.all([
        db('pixels').count('* as total_pixels'),
        db('pixels').countDistinct('user_id as total_users'),
        db('pixels').countDistinct('province as total_provinces'),
        db('pixels').countDistinct('city as total_cities')
      ]);

      return {
        totalPixels: parseInt(stats[0][0]?.total_pixels || 0),
        totalUsers: parseInt(stats[1][0]?.total_users || 0),
        totalProvinces: parseInt(stats[2][0]?.total_provinces || 0),
        totalCities: parseInt(stats[3][0]?.total_cities || 0)
      };
    } catch (error) {
      logger.warn('获取数据库统计失败:', error.message);
      return {};
    }
  }
}

module.exports = new RegionLeaderboardOptimizationService();