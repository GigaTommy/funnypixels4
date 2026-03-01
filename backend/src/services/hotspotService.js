const { db } = require('../config/database');
const IncrementalHotspotService = require('./incrementalHotspotService');

/**
 * 热点区域服务
 * 负责从 pixels_history 统计周期（daily/weekly/monthly）热门城市定位点
 * 用于地图工具栏的"漫游"功能
 */
class HotspotService {
  /**
   * 获取期间范围（复用IncrementalHotspotService的方法）
   */
  static getPeriodRange(period = 'monthly', now = new Date()) {
    const service = new IncrementalHotspotService();
    return service.getPeriodRange(period, now);
  }
  /**
   * 计算并保存热点（支持 daily/weekly/monthly，默认 monthly）
   * 优化：使用增量统计，大幅提升性能
   */
  static async computeAndStoreHotspots(period = 'monthly', limit = 10, forceIncremental = true) {
    const { label, statDate } = this.getPeriodRange(period);

    try {
      console.log(`🔥 开始 ${period} 热点统计 (${forceIncremental ? '增量' : '全量'})`);

      // 使用增量统计服务
      const incrementalService = new IncrementalHotspotService();
      const result = await incrementalService.computeIncrementalHotspots(period, !forceIncremental);

      // 将增量统计结果同步到原有的pixel_hotspots表（保持兼容性）
      await this.syncToPixelHotspots(statDate, label, period, limit);

      console.log(`✅ ${period} 热点统计完成: ${result.message}`);
      return result.processed || 0;

    } catch (error) {
      console.error(`❌ ${period} 热点统计失败:`, error);

      // 如果增量统计失败，回退到全量统计
      if (forceIncremental) {
        console.warn('⚠️ 增量统计失败，回退到全量统计...');
        return await this.computeAndStoreHotspots(period, limit, false);
      }

      throw error;
    }
  }

  /**
   * 将增量统计结果同步到原有pixel_hotspots表（保持向后兼容）
   */
  static async syncToPixelHotspots(statDate, label, period, limit = 10) {
    console.log('🔄 同步增量统计结果到pixel_hotspots表...');

    // 从增量统计表获取数据
    const cityStats = await db('city_hotspot_stats')
      .where('stat_date', '=', statDate)
      .andWhere('period', '=', period)
      .orderBy('rank', 'asc')
      .limit(limit + 5); // 多获取一些，确保有固定城市

    const rows = Array.isArray(cityStats) ? cityStats : (cityStats.rows || []);

    // 保存到pixel_hotspots表，使用 onConflict().merge() 避免重复数据
    console.log(`📝 同步 ${rows.length} 个城市数据到 pixel_hotspots 表...`);
    for (let i = 0; i < rows.length; i++) {
      const city = rows[i];
      let meta = {};
      try {
        meta = city.meta ? (typeof city.meta === 'string' ? JSON.parse(city.meta) : city.meta) : {};
      } catch (e) {
        console.warn('解析meta字段失败，使用空对象:', e.message);
        meta = {};
      }

      const metaString = JSON.stringify({
        city: city.city,
        province: city.province,
        is_fixed: city.is_fixed_city,
        active_users: city.active_users,
        period_type: period,
        computed_at: new Date().toISOString(),
        source: 'incremental_stats',
        original_label: label // 保留原始label用于显示
      });

      // 确保 rank 总是有值
      const rank = city.rank !== null && city.rank !== undefined ? city.rank : i + 1;

      await db('pixel_hotspots').insert({
        hotspot_date: statDate, // 使用statDate
        period,
        rank: rank,
        center_lat: city.center_lat,
        center_lng: city.center_lng,
        pixel_count: city.pixel_count,
        unique_users: city.user_count,
        region_level: 'city',
        region_code: city.city,
        region_name: city.city,
        meta: metaString,
        created_at: new Date(),
        updated_at: new Date()
      }).onConflict(['hotspot_date', 'period', 'rank']).merge({
        center_lat: city.center_lat,
        center_lng: city.center_lng,
        pixel_count: city.pixel_count,
        unique_users: city.user_count,
        region_code: city.city,
        region_name: city.city,
        meta: metaString,
        updated_at: new Date()
      });
    }

    console.log(`✅ 同步完成: ${rows.length} 个城市`);
    return rows.length;
  }

  /** 获取当前周期热点列表（默认 monthly） */
  static async getHotspots(period = 'monthly', limit = 10) {
    const { label, statDate } = this.getPeriodRange(period);

    try {
      // 优先使用新的 city_hotspot_stats 表
      const currentDate = new Date().toISOString().slice(0, 10);

      // 所有周期都按 stat_date 过滤，确保只取当前周期的数据
      let rows = await db('city_hotspot_stats')
        .where({ period, stat_date: statDate })
        .orderBy('rank', 'asc')
        .orderBy('pixel_count', 'desc')
        .limit(limit);

      // 如果当前周期数据不足，尝试获取最近一个有数据的周期
      if (rows.length < 3) {
        console.log(`当前 ${period} 周期 (stat_date=${statDate}) 仅有 ${rows.length} 条记录，尝试获取最近有数据的周期...`);
        const latestRows = await db('city_hotspot_stats')
          .where({ period })
          .orderBy('stat_date', 'desc')
          .orderBy('pixel_count', 'desc')
          .limit(limit * 3); // 多取一些，后续去重

        // 按城市去重，保留最新 stat_date 的记录
        const seenCities = new Set(rows.map(r => r.city));
        for (const row of latestRows) {
          if (!seenCities.has(row.city)) {
            rows.push(row);
            seenCities.add(row.city);
          }
          if (rows.length >= limit) break;
        }
      }

      // 按城市去重（同一城市可能在不同 stat_date 下有多条记录）
      const cityMap = new Map();
      for (const row of rows) {
        if (!row.city) continue;
        // 保留 pixel_count 最高的记录
        if (!cityMap.has(row.city) || (parseInt(row.pixel_count) || 0) > (parseInt(cityMap.get(row.city).pixel_count) || 0)) {
          cityMap.set(row.city, row);
        }
      }
      const dedupedRows = [...cityMap.values()].slice(0, limit);

      // 转换为标准格式
      // 注意：parseInt/parseFloat 对 null 会产生 NaN，需要兜底为 0，否则 JSON 序列化后变成 null 导致客户端解码失败
      return dedupedRows.map(row => ({
        id: row.id,
        hotspot_date: row.stat_date || currentDate,
        period: row.period,
        rank: row.rank || 0,
        center_lat: parseFloat(row.center_lat) || 0,
        center_lng: parseFloat(row.center_lng) || 0,
        pixel_count: parseInt(row.pixel_count) || 0,
        unique_users: parseInt(row.user_count) || 0,
        region_level: 'city',
        region_code: row.city,
        region_name: row.city,
        meta: JSON.stringify({
          province: row.province || '',
          country: row.country || '',
          is_fixed_city: !!row.is_fixed_city,
          rank_change: row.rank_change || 0,
          new_pixels_today: row.new_pixels_today || 0,
          new_users_today: row.new_users_today || 0
        }),
        created_at: row.created_at,
        updated_at: row.last_updated
      }));

    } catch (error) {
      console.warn('使用新表失败，回退到旧表:', error.message);

      // 回退到旧的 pixel_hotspots 表
      try {
        // 对于 monthly，需要将 label 转换为有效的日期格式
        let dateLabel = label;
        if (period === 'monthly' && label.match(/^\d{4}-\d{2}$/)) {
          // 将 "2025-11" 转换为 "2025-11-01"
          dateLabel = label + '-01';
        } else if (period === 'yearly' && label.match(/^\d{4}$/)) {
          // 将 "2025" 转换为 "2025-01-01"
          dateLabel = label + '-01-01';
        } else if (period === 'allTime') {
          // 对于全量统计，使用项目开始日期
          dateLabel = '2024-01-01';
        }

        const rows = await db('pixel_hotspots')
          .where({ hotspot_date: dateLabel, period })
          .orderBy('rank', 'asc')
          .limit(limit);
        return rows;
      } catch (fallbackError) {
        console.error('新旧表查询都失败:', fallbackError.message);
        return [];
      }
    }
  }

  /**
   * 手动触发热点统计（用于排行榜任务完成后调用）
   */
  static async triggerHotspotComputation(periods = ['daily', 'weekly', 'monthly', 'yearly', 'allTime']) {
    const results = {};

    for (const period of periods) {
      try {
        console.log(`🔥 开始计算 ${period} 热点统计...`);
        const count = await this.computeAndStoreHotspots(period, 10);
        results[period] = {
          success: true,
          hotspots_count: count,
          message: `${period} 热点统计完成，共 ${count} 个城市`
        };
        console.log(`✅ ${period} 热点统计完成: ${count} 个城市`);
      } catch (error) {
        console.error(`❌ ${period} 热点统计失败:`, error);
        results[period] = {
          success: false,
          error: error.message,
          message: `${period} 热点统计失败`
        };
      }
    }

    return results;
  }

  /**
   * 获取漫游城市列表（为地图工具栏提供数据）
   * 只返回有真实像素数据的城市，不补充虚假默认城市
   */
  static async getRoamingCities(period = 'monthly') {
    try {
      const hotspots = await this.getHotspots(period, 20);

      // 只保留有真实像素且坐标有效的城市
      const roamingCities = hotspots
        .filter(hotspot => {
          if (!hotspot.region_name) return false;
          const lat = parseFloat(hotspot.center_lat) || 0;
          const lng = parseFloat(hotspot.center_lng) || 0;
          if (lat === 0 && lng === 0) return false;
          // 过滤掉没有真实像素的记录
          if ((parseInt(hotspot.pixel_count) || 0) === 0) return false;
          return true;
        })
        .map(hotspot => {
          let meta = {};
          try {
            meta = hotspot.meta ? (typeof hotspot.meta === 'string' ? JSON.parse(hotspot.meta) : hotspot.meta) : {};
          } catch (e) {
            meta = {};
          }

          return {
            rank: hotspot.rank || 0,
            city: hotspot.region_name || '',
            province: meta.province || '',
            center: {
              lat: parseFloat(hotspot.center_lat) || 0,
              lng: parseFloat(hotspot.center_lng) || 0
            },
            pixel_count: hotspot.pixel_count || 0,
            unique_users: hotspot.unique_users || 0,
            is_fixed: !!(meta.is_fixed_city || meta.is_fixed),
            period: hotspot.period || 'monthly',
            hotspot_date: hotspot.hotspot_date || new Date().toISOString().slice(0, 10)
          };
        });

      return {
        success: true,
        data: roamingCities,
        period: period,
        total: roamingCities.length
      };

    } catch (error) {
      console.error('❌ 获取漫游城市列表失败:', error);
      return {
        success: true,
        data: [],
        period: period,
        total: 0
      };
    }
  }
}

module.exports = HotspotService;


