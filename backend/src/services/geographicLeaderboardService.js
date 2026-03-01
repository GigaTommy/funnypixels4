const { db } = require('../config/database');
const CacheService = require('./cacheService');
const PixelLocationService = require('./pixelLocationService');

/**
 * 地理统计排行榜服务
 * 基于行政区划的像素和用户统计
 */
class GeographicLeaderboardService {
  constructor() {
    this.pixelLocationService = new PixelLocationService();
    this.cachePrefix = 'geo_leaderboard:';
    this.cacheExpiry = 300; // 5分钟缓存
  }

  /**
   * 更新地理统计排行榜
   * @param {string} period 统计周期
   * @param {Date} periodStart 周期开始时间
   * @param {Date} periodEnd 周期结束时间
   */
  async updateGeographicLeaderboard(period, periodStart, periodEnd) {
    console.log(`📊 开始更新地理统计排行榜 (${period})...`);
    
    try {
      // 1. 更新省级统计
      await this.updateProvinceStats(period, periodStart, periodEnd);
      
      // 2. 更新市级统计
      await this.updateCityStats(period, periodStart, periodEnd);
      
      // 3. 更新国家级统计
      await this.updateCountryStats(period, periodStart, periodEnd);
      
      console.log(`✅ 地理统计排行榜更新完成 (${period})`);
      
    } catch (error) {
      console.error('❌ 更新地理统计排行榜失败:', error);
      throw error;
    }
  }

  /**
   * 更新省级统计
   * @param {string} period 统计周期
   * @param {Date} periodStart 周期开始时间
   * @param {Date} periodEnd 周期结束时间
   */
  async updateProvinceStats(period, periodStart, periodEnd, trx = db) {
    console.log('  🏛️ 更新省级统计...');
    
    try {
      // 获取省级像素统计 - 使用pixels_history表
      const provinceStats = await db.raw(`
        WITH latest_pixels AS (
          SELECT DISTINCT ON (grid_id) 
            grid_id,
            user_id,
            latitude,
            longitude,
            created_at
          FROM pixels_history 
          WHERE created_at >= ? AND created_at < ?
          ORDER BY grid_id, created_at DESC
        )
        SELECT 
          r.code as province_code,
          r.name as province_name,
          COUNT(DISTINCT lp.grid_id) as pixel_count,
          COUNT(DISTINCT lp.user_id) as user_count
        FROM latest_pixels lp
        INNER JOIN regions r ON (
          ABS(lp.latitude - r.center_lat) < 0.1 AND 
          ABS(lp.longitude - r.center_lng) < 0.1
        )
        WHERE r.level = 'province'
        AND LENGTH(r.code) = 6
        GROUP BY r.code, r.name
        ORDER BY pixel_count DESC
      `, [periodStart, periodEnd]);
      
      // 先删除该时间段的所有省级统计数据
      await trx('leaderboard_stats')
        .where('leaderboard_type', 'geographic')
        .where('region_level', 'province')
        .where('period', period)
        .where('period_start', '>=', periodStart)
        .where('period_start', '<', new Date(periodStart.getTime() + 24 * 60 * 60 * 1000)) // 删除当天内的所有记录
        .del();
      
      // 插入新的省级统计
      if (provinceStats.rows.length > 0) {
        for (const stat of provinceStats.rows) {
          // 为每个省份使用不同的时间戳来避免唯一约束冲突
          const uniquePeriodStart = new Date(periodStart.getTime() + Math.random() * 1000);
          
          const statsData = {
            leaderboard_type: 'geographic',
            region_level: 'province',
            region_code: stat.province_code,
            region_name: stat.province_name,
            pixel_count: parseInt(stat.pixel_count),
            user_count: parseInt(stat.user_count),
            period: period,
            period_start: uniquePeriodStart,
            period_end: periodEnd,
            updated_at: new Date()
          };
          
          await trx('leaderboard_stats').insert(statsData);
        }
        console.log(`    ✅ 更新了 ${provinceStats.rows.length} 个省份的统计`);
      }
      
    } catch (error) {
      console.error('  ❌ 更新省级统计失败:', error);
    }
  }

  /**
   * 更新市级统计
   * @param {string} period 统计周期
   * @param {Date} periodStart 周期开始时间
   * @param {Date} periodEnd 周期结束时间
   */
  async updateCityStats(period, periodStart, periodEnd, trx = db) {
    console.log('  🏙️ 更新市级统计...');
    
    try {
      // 获取市级像素统计 - 使用pixels_history表
      const cityStats = await db.raw(`
        WITH latest_pixels AS (
          SELECT DISTINCT ON (grid_id) 
            grid_id,
            user_id,
            latitude,
            longitude,
            created_at
          FROM pixels_history 
          WHERE created_at >= ? AND created_at < ?
          ORDER BY grid_id, created_at DESC
        )
        SELECT 
          r.code as city_code,
          CASE 
            WHEN p.name = r.name THEN r.name
            ELSE CONCAT(p.name, ' ', r.name)
          END as city_name,
          p.code as province_code,
          p.name as province_name,
          COUNT(DISTINCT lp.grid_id) as pixel_count,
          COUNT(DISTINCT lp.user_id) as user_count
        FROM latest_pixels lp
        INNER JOIN regions r ON (
          ABS(lp.latitude - r.center_lat) < 0.1 AND 
          ABS(lp.longitude - r.center_lng) < 0.1
        )
        LEFT JOIN regions p ON r.parent_code = p.code
        WHERE r.level = 'city'
        AND LENGTH(r.code) = 6
        GROUP BY r.code, r.name, p.code, p.name
        ORDER BY pixel_count DESC
      `, [periodStart, periodEnd]);
      
      // 先删除该时间段的所有市级统计数据
      await trx('leaderboard_stats')
        .where('leaderboard_type', 'geographic')
        .where('region_level', 'city')
        .where('period', period)
        .where('period_start', '>=', periodStart)
        .where('period_start', '<', new Date(periodStart.getTime() + 24 * 60 * 60 * 1000)) // 删除当天内的所有记录
        .del();
      
      // 插入新的市级统计
      if (cityStats.rows.length > 0) {
        for (const stat of cityStats.rows) {
          // 为每个城市使用不同的时间戳来避免唯一约束冲突
          const uniquePeriodStart = new Date(periodStart.getTime() + Math.random() * 1000);
          
          const statsData = {
            leaderboard_type: 'geographic',
            region_level: 'city',
            region_code: stat.city_code,
            region_name: stat.city_name,
            pixel_count: parseInt(stat.pixel_count),
            user_count: parseInt(stat.user_count),
            period: period,
            period_start: uniquePeriodStart,
            period_end: periodEnd,
            updated_at: new Date()
          };
          
          await trx('leaderboard_stats').insert(statsData);
        }
        console.log(`    ✅ 更新了 ${cityStats.rows.length} 个城市的统计`);
      }
      
    } catch (error) {
      console.error('  ❌ 更新市级统计失败:', error);
    }
  }

  /**
   * 更新国家级统计
   * @param {string} period 统计周期
   * @param {Date} periodStart 周期开始时间
   * @param {Date} periodEnd 周期结束时间
   */
  async updateCountryStats(period, periodStart, periodEnd, trx = db) {
    console.log('  🌍 更新国家级统计...');
    
    try {
      // 获取国家级像素统计 - 使用pixels_history表
      const countryStats = await db.raw(`
        WITH latest_pixels AS (
          SELECT DISTINCT ON (grid_id) 
            grid_id,
            user_id,
            latitude,
            longitude,
            created_at
          FROM pixels_history 
          WHERE created_at >= ? AND created_at < ?
          ORDER BY grid_id, created_at DESC
        )
        SELECT 
          'CN' as country_code,
          '中国' as country_name,
          COUNT(DISTINCT lp.grid_id) as pixel_count,
          COUNT(DISTINCT lp.user_id) as user_count
        FROM latest_pixels lp
      `, [periodStart, periodEnd]);
      
      // 先删除该时间段的所有国家级统计数据
      await trx('leaderboard_stats')
        .where('leaderboard_type', 'geographic')
        .where('region_level', 'country')
        .where('period', period)
        .where('period_start', '>=', periodStart)
        .where('period_start', '<', new Date(periodStart.getTime() + 24 * 60 * 60 * 1000)) // 删除当天内的所有记录
        .del();
      
      // 插入新的国家级统计
      if (countryStats.rows.length > 0) {
        const stat = countryStats.rows[0];
        // 使用稍微不同的时间戳来避免唯一约束冲突
        const uniquePeriodStart = new Date(periodStart.getTime() + Math.random() * 1000);
        
        const statsData = [{
          leaderboard_type: 'geographic',
          region_level: 'country',
          region_code: 'CN',
          region_name: '中国',
          pixel_count: parseInt(stat.pixel_count),
          user_count: parseInt(stat.user_count),
          period: period,
          period_start: uniquePeriodStart,
          period_end: periodEnd,
          updated_at: new Date()
        }];
        
        await trx('leaderboard_stats').insert(statsData);
        console.log('    ✅ 更新了国家级统计');
      }
      
    } catch (error) {
      console.error('  ❌ 更新国家级统计失败:', error);
    }
  }

  /**
   * 更新所有地理统计
   * @param {string} period 统计周期
   */
  async updateAllGeographicStats(period) {
    try {
      console.log(`🔄 开始更新地理统计 (${period})...`);
      
      const now = new Date();
      const { periodStart, periodEnd } = this.getPeriodRange(period, now);
      
      // 分别更新每个地区级别的统计
      // 更新省级统计
      await this.updateProvinceStats(period, periodStart, periodEnd);
      
      // 更新城市统计
      await this.updateCityStats(period, periodStart, periodEnd);
      
      // 更新国家级统计
      await this.updateCountryStats(period, periodStart, periodEnd);
      
      console.log('✅ 地理统计更新完成');
    } catch (error) {
      console.error('❌ 地理统计更新失败:', error);
      throw error;
    }
  }

  /**
   * 获取地理排行榜
   * @param {string} level 地区级别
   * @param {string} period 统计周期
   * @param {number} limit 限制数量
   * @param {number} offset 偏移量
   */
  async getGeographicLeaderboard(level, period, limit = 20, offset = 0) {
    try {
      const cacheKey = `${this.cachePrefix}${level}:${period}:${limit}:${offset}`;
      
      // 先检查缓存
      let leaderboard = await CacheService.get(cacheKey);
      if (leaderboard) {
        return leaderboard;
      }
      
      // 从数据库获取
      const now = new Date();
      const { periodStart, periodEnd } = this.getPeriodRange(period, now);
      
      // 查询最新的统计结果，按 updated_at 降序排列，只取最新的记录
      const results = await db.raw(`
        SELECT DISTINCT ON (region_code) 
          region_code, region_name, pixel_count, user_count, updated_at
        FROM leaderboard_stats
        WHERE leaderboard_type = 'geographic'
        AND region_level = ?
        AND period = ?
        AND period_start >= ?
        AND period_start < ?
        ORDER BY region_code, updated_at DESC
      `, [level, period, periodStart, new Date(periodStart.getTime() + 24 * 60 * 60 * 1000)]);
      
      // 按像素数排序并分页
      const sortedResults = results.rows
        .sort((a, b) => parseInt(b.pixel_count) - parseInt(a.pixel_count))
        .slice(offset, offset + limit);
      
      // 获取总数（去重后的数量）
      const totalCountResult = await db.raw(`
        SELECT COUNT(DISTINCT region_code) as count
        FROM leaderboard_stats
        WHERE leaderboard_type = 'geographic'
        AND region_level = ?
        AND period = ?
        AND period_start >= ?
        AND period_start < ?
      `, [level, period, periodStart, new Date(periodStart.getTime() + 24 * 60 * 60 * 1000)]);
      
      const totalCount = totalCountResult.rows[0];
      
      leaderboard = {
        level,
        period,
        data: sortedResults,
        pagination: {
          limit,
          offset,
          total: parseInt(totalCount.count)
        }
      };
      
      // 缓存结果
      await CacheService.set(cacheKey, leaderboard, this.cacheExpiry);
      
      return leaderboard;
      
    } catch (error) {
      console.error('获取地理排行榜失败:', error);
      throw error;
    }
  }

  /**
   * 获取省份排行榜
   * @param {string} period 统计周期
   * @param {number} limit 限制数量
   */
  async getProvinceLeaderboard(period = 'daily', limit = 20) {
    return await this.getGeographicLeaderboard('province', period, limit);
  }

  /**
   * 获取城市排行榜
   * @param {string} period 统计周期
   * @param {number} limit 限制数量
   */
  async getCityLeaderboard(period = 'daily', limit = 20) {
    return await this.getGeographicLeaderboard('city', period, limit);
  }

  /**
   * 获取国家排行榜
   * @param {string} period 统计周期
   */
  async getCountryLeaderboard(period = 'daily') {
    return await this.getGeographicLeaderboard('country', period, 1);
  }

  /**
   * 获取地区详细统计
   * @param {string} regionCode 地区编码
   * @param {string} level 地区级别
   * @param {string} period 统计周期
   */
  async getRegionDetailStats(regionCode, level, period = 'daily') {
    try {
      const now = new Date();
      const { periodStart, periodEnd } = this.getPeriodRange(period, now);
      
      const stats = await db('leaderboard_stats')
        .where('region_level', level)
        .where('region_code', regionCode)
        .where('period', period)
        .where('period_start', periodStart)
        .first();
      
      if (!stats) {
        return null;
      }
      
      // 获取历史趋势数据
      const trends = await db('leaderboard_stats')
        .where('region_level', level)
        .where('region_code', regionCode)
        .where('period', period)
        .orderBy('period_start', 'desc')
        .limit(7);
      
      return {
        ...stats,
        trends: trends.reverse()
      };
      
    } catch (error) {
      console.error('获取地区详细统计失败:', error);
      throw error;
    }
  }

  /**
   * 获取地区热力图数据
   * @param {string} level 地区级别
   * @param {string} period 统计周期
   */
  async getRegionHeatmapData(level, period = 'daily') {
    try {
      const now = new Date();
      const { periodStart, periodEnd } = this.getPeriodRange(period, now);
      
      const heatmapData = await db('leaderboard_stats')
        .select('region_code', 'region_name', 'pixel_count', 'user_count')
        .where('region_level', level)
        .where('period', period)
        .where('period_start', periodStart)
        .orderBy('pixel_count', 'desc');
      
      return heatmapData;
      
    } catch (error) {
      console.error('获取地区热力图数据失败:', error);
      throw error;
    }
  }

  /**
   * 获取周期时间范围
   * @param {string} period 统计周期
   * @param {Date} date 基准日期
   */
  getPeriodRange(period, date) {
    const now = new Date(date);
    let periodStart, periodEnd;
    
    switch (period) {
    case 'daily':
      periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      periodEnd = new Date(periodStart.getTime() + 24 * 60 * 60 * 1000);
      break;
    case 'weekly':
      const dayOfWeek = now.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      periodStart = new Date(now.getTime() - daysToMonday * 24 * 60 * 60 * 1000);
      periodStart.setHours(0, 0, 0, 0);
      periodEnd = new Date(periodStart.getTime() + 7 * 24 * 60 * 60 * 1000);
      break;
    case 'monthly':
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      break;
    case 'yearly':
      periodStart = new Date(now.getFullYear(), 0, 1);
      periodEnd = new Date(now.getFullYear() + 1, 0, 1);
      break;
    case 'allTime':
      // 总榜：从项目开始时间到现在
      periodStart = new Date('2024-01-01T00:00:00.000Z');
      periodEnd = new Date();
      break;
    default:
      periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      periodEnd = new Date(periodStart.getTime() + 24 * 60 * 60 * 1000);
    }
    
    return { periodStart, periodEnd };
  }

  /**
   * 清理过期的排行榜数据
   * @param {number} days 保留天数
   */
  async cleanExpiredLeaderboardData(days = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const deletedCount = await db('leaderboard_stats')
        .where('updated_at', '<', cutoffDate)
        .del();
      
      console.log(`🧹 清理了 ${deletedCount} 条过期排行榜数据`);
      return deletedCount;
      
    } catch (error) {
      console.error('清理过期排行榜数据失败:', error);
      return 0;
    }
  }
}

module.exports = GeographicLeaderboardService;
