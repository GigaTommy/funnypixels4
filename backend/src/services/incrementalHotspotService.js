const { db } = require('../config/database');
const logger = require('../utils/logger');

/**
 * 增量热点统计服务
 * 用于高效的增量统计，避免全表扫描pixels_history
 *
 * 核心思路：
 * 1. 维护城市热点统计缓存表
 * 2. 只处理新增的像素历史数据
 * 3. 利用时间分区减少扫描范围
 * 4. 智能合并固定城市和动态热点
 */
class IncrementalHotspotService {
  constructor() {
    this.fixedCities = ['北京', '上海', '杭州', '广州', '香港'];
    this.batchSize = 1000; // 批处理大小
  }

  /**
   * 增量统计方法（推荐使用）
   * 只处理自上次统计以来的新增数据
   * 性能：O(增量数据量) 而不是 O(全表数据量)
   */
  async computeIncrementalHotspots(period = 'daily', forceFullRecompute = false) {
    const { periodStart, periodEnd, label, statDate } = this.getPeriodRange(period);

    logger.info(`🚀 开始增量统计 ${period} 热点数据 (${forceFullRecompute ? '全量' : '增量'})`);

    try {
      if (forceFullRecompute) {
        return await this.computeFullHotspots(periodStart, periodEnd, statDate, label, period);
      } else {
        return await this.computeIncrementalOnly(periodStart, periodEnd, statDate, label, period);
      }
    } catch (error) {
      logger.error('❌ 增量统计失败:', error);
      throw error;
    }
  }

  /**
   * 真正的增量统计（高性能）
   * 只处理新增的数据，性能极佳
   */
  async computeIncrementalOnly(periodStart, periodEnd, statDate, label, period) {
    // 1. 获取上次统计的时间点
    const lastStats = await this.getLastStatsForPeriod(period);
    const lastUpdateTime = lastStats?.last_updated || new Date(0);

    logger.info(`📊 增量统计范围: ${lastUpdateTime.toISOString()} → ${periodEnd.toISOString()}`);

    // 2. 只处理新增的像素历史数据
    const newPixelsData = await this.getNewPixelsData(lastUpdateTime, periodEnd);

    if (newPixelsData.length === 0) {
      logger.info(`✅ 无新增数据，增量统计完成`);
      return { processed: 0, message: '无新增数据' };
    }

    // 3. 增量更新城市统计
    await this.incrementalUpdateCityStats(newPixelsData, period, statDate);

    // 4. 重新计算当前周期的排名
    await this.recalculateRanks(statDate, period);

    logger.info(`✅ 增量统计完成: 处理 ${newPixelsData.length} 条新增记录`);
    return { processed: newPixelsData.length, message: `增量统计完成，处理 ${newPixelsData.length} 条记录` };
  }

  /**
   * 获取新增的像素数据（性能关键点）
   * 利用时间索引，只查询新数据
   */
  async getNewPixelsData(lastUpdateTime, periodEnd) {
    // 利用时间索引，大幅减少扫描范围
    const result = await db.raw(`
      SELECT
        city,
        province,
        country,
        latitude,
        longitude,
        user_id,
        grid_id,
        created_at
      FROM pixels_history
      WHERE created_at > ?
        AND created_at <= ?
        AND city IS NOT NULL
        AND city != ''
      ORDER BY created_at ASC
      LIMIT ?
    `, [lastUpdateTime, periodEnd, this.batchSize * 10]); // 限制最大处理量

    return result.rows || [];
  }

  /**
   * 增量更新城市统计
   * 批量处理新增数据，性能优化
   */
  async incrementalUpdateCityStats(newPixelsData, period, statDate) {
    // 按城市分组新增数据
    const cityGrouped = this.groupPixelsByCity(newPixelsData);

    for (const [cityKey, cityData] of Object.entries(cityGrouped)) {
      const { city, province, country } = this.parseCityKey(cityKey);

      // 检查是否已存在该城市的统计记录
      const existingStat = await this.getCityStat(statDate, period, city);

      const stats = this.calculateCityStats(cityData);
      const boundingBox = this.calculateBoundingBox(cityData);
      const densityCenter = this.calculateDensityCenter(cityData);

      if (existingStat) {
        // 增量更新现有记录
        await db('city_hotspot_stats')
          .where('stat_date', '=', statDate)
          .andWhere('period', '=', period)
          .andWhere('city', '=', city)
          .update({
            pixel_count: existingStat.pixel_count + stats.pixelCount,
            user_count: db.raw(`(
              SELECT COUNT(DISTINCT elem)
              FROM jsonb_array_elements_text(COALESCE(active_users, '[]'::jsonb) || ?::jsonb) AS elem
            )`, [JSON.stringify(stats.activeUsers)]),
            new_pixels_today: db.raw('new_pixels_today + ?', [stats.pixelCount]),
            new_users_today: db.raw(`(
              SELECT COUNT(DISTINCT elem)
              FROM jsonb_array_elements_text(COALESCE(active_users, '[]'::jsonb) || ?::jsonb) AS elem
            )`, [JSON.stringify(stats.activeUsers)]),
            min_lat: db.raw('LEAST(min_lat, ?)', [boundingBox.minLat]),
            max_lat: db.raw('GREATEST(max_lat, ?)', [boundingBox.maxLat]),
            min_lng: db.raw('LEAST(min_lng, ?)', [boundingBox.minLng]),
            max_lng: db.raw('GREATEST(max_lng, ?)', [boundingBox.maxLng]),
            center_lat: this.calculateUpdatedCenter(existingStat, densityCenter, 'lat', stats.pixelCount),
            center_lng: this.calculateUpdatedCenter(existingStat, densityCenter, 'lng', stats.pixelCount),
            active_users: db.raw(`(
              SELECT jsonb_agg(DISTINCT elem)
              FROM jsonb_array_elements_text(COALESCE(active_users, '[]'::jsonb) || ?::jsonb) AS elem
            )`, [JSON.stringify(stats.activeUsers)]),
            last_updated: new Date()
          });
      } else {
        // 插入新记录（使用密度中心作为热点坐标）
        await db('city_hotspot_stats').insert({
          stat_date: statDate,
          period,
          city,
          province,
          country,
          pixel_count: stats.pixelCount,
          user_count: stats.userCount,
          new_pixels_today: stats.pixelCount,
          new_users_today: stats.userCount,
          center_lat: densityCenter.centerLat,
          center_lng: densityCenter.centerLng,
          min_lat: boundingBox.minLat,
          max_lat: boundingBox.maxLat,
          min_lng: boundingBox.minLng,
          max_lng: boundingBox.maxLng,
          is_fixed_city: this.fixedCities.includes(city),
          active_users: JSON.stringify(stats.activeUsers),
          meta: JSON.stringify({
            first_seen: new Date().toISOString(),
            source: 'incremental'
          }),
          last_updated: new Date()
        });
      }
    }
  }

  /**
   * 重新计算当前周期的排名
   * 只在当前周期数据上计算，不扫描全表
   */
  async recalculateRanks(statDate, period) {
    logger.info(`🏆 重新计算 ${period} 周期排名...`);

    // 获取当前周期的所有城市统计
    // 注意：Knex query builder 直接返回数组，不是 { rows: [] } 对象
    const allStats = await db('city_hotspot_stats')
      .where({ stat_date: statDate, period })
      .orderBy('pixel_count', 'desc');

    const stats = Array.isArray(allStats) ? allStats : (allStats.rows || []);

    // 统一排序：按像素数量倒序
    // 即使是固定城市，如果没有热度也应该排在后面
    // 但为了保证固定城市至少显示在列表中（如果列表很长），它们保留 is_fixed_city 标记
    // 这里我们纯粹按热度排名，以支持"真实的用户热点"

    // 给固定城市一个极小的初始权重，或者完全平等？
    // 用户需求是"根据热点区域坐标进行漫游...把硬编码的几个地点设较后的排序"
    // 所以完全按 pixel_count 排序即可。

    let rank = 1;
    for (const cityStat of stats) {
      await db('city_hotspot_stats')
        .where({ id: cityStat.id })
        .update({ rank });
      rank++;
    }

    logger.info(`✅ 排名计算完成: ${stats.length} 个城市`);
  }

  /**
   * 兜底的全量统计方法（仅在必要时使用）
   */
  async computeFullHotspots(periodStart, periodEnd, statDate, label, period) {
    logger.warn(`⚠️ 执行全量统计，性能消耗较大`);

    // 使用 CTE 实现基于网格密度的热点中心计算
    // grid_density: 按 0.005° (~500m) 网格聚合像素
    // densest: 每个城市取像素最密集的网格单元，用该单元内像素的均值作为中心
    const result = await db.raw(`
      WITH grid_density AS (
        SELECT
          city, province, country,
          ROUND(latitude::numeric / 0.005) * 0.005 as grid_lat,
          ROUND(longitude::numeric / 0.005) * 0.005 as grid_lng,
          COUNT(*) as cell_count,
          ROUND(AVG(latitude)::numeric, 6) as cell_avg_lat,
          ROUND(AVG(longitude)::numeric, 6) as cell_avg_lng
        FROM pixels_history
        WHERE created_at >= ?::timestamp
          AND created_at < ?::timestamp
          AND city IS NOT NULL AND city != ''
          AND latitude IS NOT NULL AND longitude IS NOT NULL
        GROUP BY city, province, country, grid_lat, grid_lng
      ),
      densest AS (
        SELECT DISTINCT ON (city)
          city, cell_avg_lat, cell_avg_lng
        FROM grid_density
        ORDER BY city, cell_count DESC
      ),
      city_agg AS (
        SELECT
          city,
          COALESCE(province, '未知') as province,
          COALESCE(country, '中国') as country,
          COUNT(*) as pixel_count,
          COUNT(DISTINCT user_id) as user_count,
          ROUND(MIN(latitude)::numeric, 6) as min_lat,
          ROUND(MAX(latitude)::numeric, 6) as max_lat,
          ROUND(MIN(longitude)::numeric, 6) as min_lng,
          ROUND(MAX(longitude)::numeric, 6) as max_lng,
          jsonb_agg(DISTINCT user_id) as active_users
        FROM pixels_history
        WHERE created_at >= ?::timestamp
          AND created_at < ?::timestamp
          AND city IS NOT NULL AND city != ''
        GROUP BY city, province, country
      )
      INSERT INTO city_hotspot_stats (
        stat_date, period, city, province, country,
        pixel_count, user_count, new_pixels_today, new_users_today,
        center_lat, center_lng, min_lat, max_lat, min_lng, max_lng,
        is_fixed_city, active_users, meta, last_updated
      )
      SELECT
        ?::date as stat_date,
        ? as period,
        ca.city,
        ca.province,
        ca.country,
        ca.pixel_count,
        ca.user_count,
        ca.pixel_count as new_pixels_today,
        ca.user_count as new_users_today,
        COALESCE(d.cell_avg_lat, ROUND((ca.min_lat + ca.max_lat) / 2, 6)) as center_lat,
        COALESCE(d.cell_avg_lng, ROUND((ca.min_lng + ca.max_lng) / 2, 6)) as center_lng,
        ca.min_lat,
        ca.max_lat,
        ca.min_lng,
        ca.max_lng,
        CASE WHEN ca.city = ANY(?) THEN true ELSE false END as is_fixed_city,
        ca.active_users,
        jsonb_build_object(
          'computed_at', NOW(),
          'data_range', jsonb_build_object('start', ?::timestamp, 'end', ?::timestamp),
          'source', 'full_recompute_density'
        ) as meta,
        NOW() as last_updated
      FROM city_agg ca
      LEFT JOIN densest d ON ca.city = d.city
      ON CONFLICT (stat_date, period, city)
      DO UPDATE SET
        pixel_count = EXCLUDED.pixel_count,
        user_count = EXCLUDED.user_count,
        new_pixels_today = EXCLUDED.new_pixels_today,
        new_users_today = EXCLUDED.new_users_today,
        center_lat = EXCLUDED.center_lat,
        center_lng = EXCLUDED.center_lng,
        min_lat = EXCLUDED.min_lat,
        max_lat = EXCLUDED.max_lat,
        min_lng = EXCLUDED.min_lng,
        max_lng = EXCLUDED.max_lng,
        is_fixed_city = EXCLUDED.is_fixed_city,
        active_users = EXCLUDED.active_users,
        meta = EXCLUDED.meta,
        last_updated = NOW()
    `, [
      periodStart.toISOString(), periodEnd.toISOString(),
      periodStart.toISOString(), periodEnd.toISOString(),
      statDate, period, this.fixedCities,
      periodStart.toISOString(), periodEnd.toISOString()
    ]);

    // 重新计算排名
    await this.recalculateRanks(statDate, period);

    return { processed: result.rowCount || 0, message: '全量统计完成' };
  }

  // ========== 辅助方法 ==========

  groupPixelsByCity(pixelsData) {
    const grouped = {};

    for (const pixel of pixelsData) {
      const key = `${pixel.city}|${pixel.province || ''}|${pixel.country || ''}`;

      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(pixel);
    }

    return grouped;
  }

  parseCityKey(cityKey) {
    const [city, province, country] = cityKey.split('|');
    return { city, province: province || '未知', country: country || '中国' };
  }

  calculateCityStats(cityData) {
    const pixelCount = cityData.length;
    const userCount = new Set(cityData.map(p => p.user_id)).size;
    const activeUsers = [...new Set(cityData.map(p => p.user_id))].slice(0, 100); // 采样前100个用户

    return { pixelCount, userCount, activeUsers };
  }

  calculateBoundingBox(cityData) {
    // 过滤掉 null/NaN 坐标值，避免 NaN 传播导致整个城市中心坐标为 NULL
    const lats = cityData.map(p => parseFloat(p.latitude)).filter(v => !isNaN(v));
    const lngs = cityData.map(p => parseFloat(p.longitude)).filter(v => !isNaN(v));

    if (lats.length === 0 || lngs.length === 0) {
      logger.warn('⚠️ calculateBoundingBox: 无有效坐标数据');
      return { minLat: 0, maxLat: 0, minLng: 0, maxLng: 0 };
    }

    return {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLng: Math.min(...lngs),
      maxLng: Math.max(...lngs)
    };
  }

  /**
   * 基于网格密度的热点中心计算
   * 将城市像素空间按 ~500m 网格（0.005°）划分，找到像素最密集的网格单元，
   * 返回该单元内所有像素的平均坐标作为热点中心
   *
   * @param {Array} cityData - 该城市的像素数据数组
   * @returns {{ centerLat: number, centerLng: number }}
   */
  calculateDensityCenter(cityData) {
    const GRID_SIZE = 0.005; // ~500m

    const validPixels = cityData.filter(p => {
      const lat = parseFloat(p.latitude);
      const lng = parseFloat(p.longitude);
      return !isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0);
    });

    if (validPixels.length === 0) {
      logger.warn('⚠️ calculateDensityCenter: 无有效坐标数据');
      return { centerLat: 0, centerLng: 0 };
    }

    // 将像素分配到网格单元
    const gridCells = new Map();
    for (const pixel of validPixels) {
      const lat = parseFloat(pixel.latitude);
      const lng = parseFloat(pixel.longitude);
      const gridKey = `${Math.round(lat / GRID_SIZE)}|${Math.round(lng / GRID_SIZE)}`;

      if (!gridCells.has(gridKey)) {
        gridCells.set(gridKey, []);
      }
      gridCells.get(gridKey).push({ lat, lng });
    }

    // 找到像素数量最多的网格单元
    let densestCell = null;
    let maxCount = 0;
    for (const [key, pixels] of gridCells) {
      if (pixels.length > maxCount) {
        maxCount = pixels.length;
        densestCell = pixels;
      }
    }

    // 返回最密集单元内所有像素的平均坐标
    const sumLat = densestCell.reduce((s, p) => s + p.lat, 0);
    const sumLng = densestCell.reduce((s, p) => s + p.lng, 0);
    return {
      centerLat: parseFloat((sumLat / densestCell.length).toFixed(6)),
      centerLng: parseFloat((sumLng / densestCell.length).toFixed(6))
    };
  }

  calculateUpdatedCenter(existingStat, densityCenter, axis, newPixelsCount) {
    const existingCenter = parseFloat(existingStat[`center_${axis}`]);
    const newCenter = densityCenter[axis === 'lat' ? 'centerLat' : 'centerLng'];
    const existingCount = parseInt(existingStat.pixel_count) || 0;

    // 加权平均计算
    // 公式: (旧坐标 * 旧数量 + 新坐标 * 新数量) / (旧数量 + 新数量)
    const totalCount = existingCount + newPixelsCount;

    if (totalCount === 0) return newCenter.toFixed(6);

    const weightedSum = (existingCenter * existingCount) + (newCenter * newPixelsCount);
    return (weightedSum / totalCount).toFixed(6);
  }

  async getLastStatsForPeriod(period) {
    const result = await db('city_hotspot_stats')
      .where({ period })
      .orderBy('last_updated', 'desc')
      .first();

    return result || null;
  }

  async getCityStat(statDate, period, city) {
    return await db('city_hotspot_stats')
      .where({ stat_date: statDate, period, city })
      .first();
  }

  getPeriodRange(period = 'daily', now = new Date()) {
    let start, end, label, statDate;
    switch (period) {
      case 'daily':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
        label = start.toISOString().slice(0, 10);
        statDate = label; // 日期格式相同
        break;
      case 'weekly': {
        const day = now.getDay();
        const diffToMonday = day === 0 ? -6 : 1 - day;
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
        start.setHours(0, 0, 0, 0);
        end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
        const year = start.getFullYear();
        const week = Math.ceil((((start - new Date(start.getFullYear(), 0, 1)) / 86400000) + start.getDay() + 1) / 7);
        label = `${year}-W${String(week).padStart(2, '0')}`;
        statDate = start.toISOString().slice(0, 10); // 使用周一的日期作为 stat_date
        break;
      }
      case 'monthly':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        label = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
        statDate = start.toISOString().slice(0, 10); // 使用月初的日期作为 stat_date
        break;
      case 'yearly':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear() + 1, 0, 1);
        label = `${start.getFullYear()}`;
        statDate = start.toISOString().slice(0, 10); // 使用年初的日期作为 stat_date
        break;
      case 'allTime':
        // 总榜：从项目开始时间到现在
        start = new Date('2024-01-01T00:00:00.000Z');
        end = new Date();
        label = 'alltime';
        statDate = '2024-01-01'; // 使用项目开始日期
        break;
      default:
        // 默认为日榜
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
        label = start.toISOString().slice(0, 10);
        statDate = label;
        break;
    }
    return { periodStart: start, periodEnd: end, label, statDate };
  }
}

module.exports = IncrementalHotspotService;