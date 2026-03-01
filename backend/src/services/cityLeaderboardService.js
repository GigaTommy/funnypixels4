const { db } = require('../config/database');
const logger = require('../utils/logger');
const redis = require('../config/redis').redis;
// 注意：已移除PostGIS依赖，改用高德地图API

/**
 * 城市排行榜服务
 * 基于高德地图API地理编码数据提供排行榜统计
 * 注意：已移除PostGIS/OSM依赖，使用简化版统计逻辑
 */
class CityLeaderboardService {
  constructor() {
    // 配置参数
    this.cacheTTL = parseInt(process.env.LEADERBOARD_CACHE_TTL) || 300; // 5分钟缓存
    this.batchSize = parseInt(process.env.LEADERBOARD_BATCH_SIZE) || 1000;
    this.maxTopCities = parseInt(process.env.LEADERBOARD_MAX_CITIES) || 100;

    // 缓存key模板
    this.cacheKeys = {
      daily: 'leaderboard:cities:daily:{date}',
      weekly: 'leaderboard:cities:weekly:{date}',
      monthly: 'leaderboard:cities:monthly:{date}',
      yearly: 'leaderboard:cities:yearly:{date}',
      allTime: 'leaderboard:cities:allTime:{date}',
      realtime: 'leaderboard:cities:realtime:{window}'
    };

    // 高德地图API查询参数（只查询中国主要城市）
    this.geoFilters = {
      minPopulation: 100000, // 最少10万人口
      useAmapData: true // 使用高德地图数据
    };

    logger.info('🏆 城市排行榜服务初始化完成 (简化版)');
  }

  /**
   * 生成排行榜（使用缓存数据）
   * @param {string} period - 统计周期: 'daily'/'weekly'/'monthly'/'yearly'/'allTime'
   * @param {string} date - 日期格式 YYYY-MM-DD (可选)
   * @param {Object} options - 选项
   * @returns {Promise<Array>} 城市排行榜数据
   */
  async generateLeaderboard(period = 'daily', date = null, options = {}) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const cacheKey = this.cacheKeys[period]?.replace('{date}', targetDate) ||
                     `leaderboard:cities:${period}:${targetDate}`;

    // 第一层缓存：Redis缓存
    if (!options.forceRefresh) {
      const cached = await this.getCachedLeaderboard(cacheKey);
      if (cached) {
        logger.debug(`📋 使用Redis缓存的${period}排行榜: ${targetDate}`);
        return cached;
      }
    }

    try {
      // 从定时任务生成的leaderboard_region表读取
      const cachedLeaderboard = await this.getLeaderboardFromCache(period, targetDate);
      if (cachedLeaderboard && cachedLeaderboard.length > 0 && !options.forceRefresh) {
        logger.info(`✅ 使用定时任务缓存数据: ${period}排行榜, ${cachedLeaderboard.length} 个城市`);

        // 存入Redis缓存
        await this.setCachedLeaderboard(cacheKey, cachedLeaderboard);

        return cachedLeaderboard;
      }

      // 如果缓存数据不存在，使用简化版生成
      logger.info(`🔄 生成简化版${period}排行榜: ${targetDate}`);

      const leaderboard = await this.generateSimpleLeaderboard(
        period,
        targetDate,
        options
      );

      // 缓存结果
      await this.setCachedLeaderboard(cacheKey, leaderboard);

      logger.info(`✅ ${period}排行榜生成完成: ${targetDate}, ${leaderboard.length} 个城市`);
      return leaderboard;

    } catch (error) {
      logger.error(`❌ ${period}排行榜获取失败: ${targetDate}`, error);

      // 回退到基于city字段的统计
      return this.generateFallbackLeaderboard(period, targetDate, options);
    }
  }

  /**
   * 从定时任务缓存表获取排行榜数据
   * @param {string} period - 时间周期
   * @param {string} date - 日期
   * @returns {Promise<Array>} 排行榜数据
   */
  async getLeaderboardFromCache(period, date) {
    try {
      const timeFilter = this.getTimeFilter(period, date);
      const periodStart = new Date(timeFilter.start.replace(/'/g, '').replace('::timestamp', ''));

      // 从leaderboard_region表查询
      const results = await db('leaderboard_region')
        .where('period', period)
        .where('period_start', '>=', periodStart)
        .orderBy('rank', 'asc')
        .select('*');

      if (results.length === 0) {
        logger.debug(`📭 定时任务缓存无数据: ${period}, ${date}`);
        return [];
      }

      // 转换为统一格式
      const leaderboard = results.map(row => ({
        rank: row.rank,
        city: row.region_flag,  // 城市名称
        province: row.region_name.includes(' ') ? row.region_name.split(' ')[0] : null,
        full_name: row.region_name,
        osm_id: row.region_id,
        pixel_count: row.total_pixels,
        user_count: row.user_count,
        alliance_count: row.alliance_count,
        color: row.color,
        period: row.period,
        date: date,
        generated_at: row.last_updated,
        source: 'cached_maintenance',  // 标记数据来源为定时任务
        metadata: row.metadata ? JSON.parse(row.metadata) : null
      }));

      logger.debug(`📊 从缓存表获取${period}排行榜: ${leaderboard.length} 条记录`);
      return leaderboard;

    } catch (error) {
      logger.error(`❌ 从缓存表获取排行榜失败: ${period}, ${date}`, error);
      return [];
    }
  }

  /**
   * 生成简化版排行榜（基于高德地图数据）
   * @param {string} period - 时间周期
   * @param {string} date - 日期
   * @param {Object} options - 选项
   * @returns {Promise<Array>} 排行榜数据
   */
  async generateSimpleLeaderboard(period, date, options = {}) {
    const timeFilter = this.getTimeFilter(period, date);

    // 使用简化版查询：直接使用pixels_history的高德地图数据
    const query = `
      WITH latest_pixels AS (
        SELECT DISTINCT ON (grid_id)
          grid_id,
          user_id,
          city,
          province,
          geocoded
        FROM pixels_history
        WHERE created_at >= ${timeFilter.start}
          AND created_at < ${timeFilter.end}
          AND city IS NOT NULL
          AND geocoded = true
        ORDER BY grid_id, created_at DESC
      )
      SELECT
        lp.city,
        lp.province,
        CONCAT(COALESCE(lp.province, ''), ' ', lp.city) as full_name,
        COUNT(DISTINCT lp.grid_id) as pixel_count,
        COUNT(DISTINCT lp.user_id) as user_count,
        CASE
          WHEN COUNT(DISTINCT lp.grid_id) >= 1000 THEN '#2196F3'  -- High activity - Blue
          WHEN COUNT(DISTINCT lp.grid_id) >= 500 THEN '#4CAF50'   -- Medium activity - Green
          ELSE '#FF9800'                                        -- Low activity - Orange
        END as color,
        '${period}' as period,
        '${date}' as date,
        'simple_amap' as source
      FROM latest_pixels lp
      GROUP BY lp.city, lp.province
      HAVING COUNT(DISTINCT lp.grid_id) > ${options.minPixels || 0}
      ORDER BY pixel_count DESC
      LIMIT ${this.maxTopCities}
    `;

    const result = await db.raw(query);

    // 添加排名
    return result.rows.map((row, index) => ({
      rank: index + 1,
      city: row.city,
      province: row.province,
      full_name: row.full_name,
      pixel_count: parseInt(row.pixel_count),
      user_count: parseInt(row.user_count),
      color: row.color,
      period: row.period,
      date: row.date,
      source: row.source,
      generated_at: new Date()
    }));
  }

  /**
   * 生成日排行榜（兼容旧接口）
   * @deprecated 使用 generateLeaderboard('daily', date, options) 代替
   */
  async generateDailyLeaderboard(date = null, options = {}) {
    return this.generateLeaderboard('daily', date, options);
  }

  /**
   * 回退方案：基于city字段的排行榜
   * @param {string} period - 时间周期
   * @param {string} date - 日期
   * @param {Object} options - 选项
   * @returns {Promise<Array>} 排行榜数据
   */
  async generateFallbackLeaderboard(period, date, options = {}) {
    const timeFilter = this.getTimeFilter(period, date);

    logger.info(`🔄 使用回退方案生成排行榜: ${period}, ${date}`);

    const query = `
      SELECT
        city,
        province,
        COUNT(DISTINCT id) as pixel_count,
        COUNT(DISTINCT user_id) as user_count,
        MAX(created_at) as latest_activity,
        '${period}' as period,
        '${date}' as date,
        'fallback' as source
      FROM pixels_history
      WHERE created_at >= ${timeFilter.start}
        AND created_at < ${timeFilter.end}
        AND city IS NOT NULL
        AND city != '未知'
        AND city != ''
      GROUP BY city, province
      HAVING COUNT(DISTINCT id) > ${options.minPixels || 0}
      ORDER BY pixel_count DESC
      LIMIT ${this.maxTopCities}
    `;

    const result = await db.raw(query);

    // 添加排名
    const leaderboard = result.rows.map((row, index) => ({
      ...row,
      rank: index + 1,
      generated_at: new Date(),
      total_cities: result.rows.length
    }));

    return leaderboard;
  }

  /**
   * 获取时间过滤器
   * @param {string} period - 时间周期: 'daily'/'weekly'/'monthly'/'yearly'/'allTime'
   * @param {string} date - 日期
   * @returns {Object} 时间过滤器
   */
  getTimeFilter(period, date) {
    const start = new Date(date);
    const end = new Date(date);

    switch (period) {
      case 'daily':
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'weekly':
        const dayOfWeek = start.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        start.setDate(start.getDate() - daysToMonday); // 周一
        start.setHours(0, 0, 0, 0);
        end.setDate(start.getDate() + 6); // 周日
        end.setHours(23, 59, 59, 999);
        break;
      case 'monthly':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(start.getMonth() + 1);
        end.setDate(0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'yearly':
        start.setMonth(0, 1);
        start.setHours(0, 0, 0, 0);
        end.setFullYear(start.getFullYear() + 1);
        end.setMonth(0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'allTime':
        // 总榜：从项目开始到现在
        start.setTime(new Date('2024-01-01T00:00:00.000Z').getTime());
        end.setTime(new Date().getTime());
        break;
      default:
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
    }

    return {
      start: `'${start.toISOString()}'::timestamp`,
      end: `'${end.toISOString()}'::timestamp`
    };
  }

  /**
   * 实时排行榜（滑动窗口）
   * @param {string} window - 窗口大小 1h/6h/24h
   * @param {Object} options - 选项
   * @returns {Promise<Array>} 实时排行榜
   */
  async getRealtimeLeaderboard(window = '24h', options = {}) {
    const cacheKey = this.cacheKeys.realtime.replace('{window}', window);
    const cached = await this.getCachedLeaderboard(cacheKey);

    if (cached && !options.forceRefresh) {
      return cached;
    }

    // 生成简化版实时排行榜
    const leaderboard = await this.generateSimpleRealtimeLeaderboard(window, options);
    await this.setCachedLeaderboard(cacheKey, leaderboard, 60); // 实时榜缓存1分钟

    return leaderboard;
  }

  /**
   * 生成简化版实时排行榜
   * @param {string} window - 时间窗口
   * @param {Object} options - 选项
   * @returns {Promise<Array>} 实时排行榜
   */
  async generateSimpleRealtimeLeaderboard(window, options = {}) {
    const interval = this.parseWindowInterval(window);

    const query = `
      SELECT
        city,
        province,
        COUNT(*) as pixel_count,
        COUNT(DISTINCT user_id) as user_count,
        MAX(created_at) as latest_activity,
        '${window}' as period,
        'simple_realtime' as source
      FROM pixels_history
      WHERE created_at >= NOW() - INTERVAL '${interval}'
        AND city IS NOT NULL
        AND city != '未知'
        AND city != ''
      GROUP BY city, province
      HAVING COUNT(*) > ${options.minPixels || 0}
      ORDER BY pixel_count DESC
      LIMIT ${this.maxTopCities}
    `;

    const result = await db.raw(query);

    return result.rows.map((row, index) => ({
      ...row,
      rank: index + 1,
      generated_at: new Date()
    }));
  }

  /**
   * 解析时间窗口
   * @param {string} window - 窗口字符串
   * @returns {string} PostgreSQL间隔字符串
   */
  parseWindowInterval(window) {
    const intervalMap = {
      '1h': '1 hour',
      '6h': '6 hours',
      '24h': '24 hours',
      '7d': '7 days',
      '30d': '30 days'
    };
    return intervalMap[window] || '24 hours';
  }

  /**
   * 缓存管理
   */
  async getCachedLeaderboard(key) {
    try {
      const cached = await redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.warn('⚠️ 缓存读取失败:', error.message);
      return null;
    }
  }

  async setCachedLeaderboard(key, data, ttl = null) {
    try {
      const cacheTTL = ttl || this.cacheTTL;
      await redis.set(key, JSON.stringify(data), 'EX', cacheTTL);
    } catch (error) {
      logger.warn('⚠️ 缓存写入失败:', error.message);
    }
  }

  /**
   * 清理排行榜缓存
   * @param {string} pattern - 缓存key模式
   */
  async clearCache(pattern = 'leaderboard:cities:*') {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
        logger.info(`🧹 清理排行榜缓存: ${keys.length} 项`);
      }
      return keys.length;
    } catch (error) {
      logger.error('❌ 缓存清理失败:', error);
      return 0;
    }
  }

  /**
   * 获取服务状态
   */
  async getServiceStatus() {
    const cacheKeys = await redis.keys('leaderboard:cities:*');

    return {
      service: 'city_leaderboard',
      status: 'active',
      version: 'simplified',
      cache_keys_count: cacheKeys.length,
      cache_ttl: this.cacheTTL,
      max_top_cities: this.maxTopCities,
      cache_keys: this.cacheKeys,
      data_sources: ['amap_api', 'fallback'],
      last_updated: new Date().toISOString(),
      postgis_removed: true,
      osm_removed: true
    };
  }
}

module.exports = new CityLeaderboardService();