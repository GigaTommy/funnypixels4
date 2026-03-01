/**
 * 排行榜数据维护服务
 * 定期更新排行榜基础数据表，确保数据实时性
 * 
 * 重要改进：
 * - 使用 pixels_history 分区表进行统计，提升查询性能
 * - 通过 DISTINCT ON (grid_id) 确保只统计每个位置的最新像素记录
 * - 避免统计被其他用户覆盖的像素点，确保排行榜准确性
 */

const { db } = require('../config/database');
const cron = require('node-cron');
const HotspotService = require('./hotspotService');
const { PIXEL_TYPES } = require('../constants/pixelTypes');

/**
 * 为没有 OSM ID 的城市生成确定性唯一 region_id（djb2 哈希）
 * 保证同一城市名每次生成相同 ID，不同城市名极大概率不同
 */
function hashCityName(name) {
  let hash = 5381;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) + hash + name.charCodeAt(i)) & 0x7fffffff;
  }
  return hash || 1; // 确保非零
}

class LeaderboardMaintenanceService {
  constructor() {
    this.isRunning = false;
    this.lastUpdate = null;
  }

  /**
   * 启动排行榜维护服务
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️ 排行榜维护服务已在运行中');
      return;
    }

    console.log('🚀 启动排行榜维护服务...');
    this.isRunning = true;

    // 每小时更新一次排行榜数据
    cron.schedule('0 * * * *', async () => {
      console.log('⏰ 开始定时更新排行榜数据...');
      await this.updateAllLeaderboards();
      // 顺便更新当月热点区域
      try {
        const count = await HotspotService.computeAndStoreHotspots('monthly', 10);
        console.log(`🔥 已更新当月热点区域: ${count} 条`);
      } catch (e) {
        console.error('❌ 更新热点区域失败:', e.message);
      }
    });

    // 每天凌晨2点进行深度维护
    cron.schedule('0 2 * * *', async () => {
      console.log('🌙 开始每日深度维护...');
      await this.performDailyMaintenance();
    });

    // 延迟30秒执行首次更新，避免启动时耗尽连接池
    setTimeout(() => {
      this.updateAllLeaderboards();
      HotspotService.computeAndStoreHotspots('monthly', 10).catch(() => {});
    }, 30000);
  }

  /**
   * 停止排行榜维护服务
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️ 排行榜维护服务未运行');
      return;
    }

    console.log('🛑 停止排行榜维护服务...');
    this.isRunning = false;
  }

  /**
   * 更新所有排行榜数据
   */
  async updateAllLeaderboards() {
    try {
      const startTime = Date.now();
      console.log('📊 开始更新排行榜数据...');

      const periods = ['daily', 'weekly', 'monthly', 'yearly', 'allTime'];
      const now = new Date();

      // 所有时间段并行执行（每个时间段内部已并行更新三种排行榜）
      await Promise.all(periods.map(async (period) => {
        console.log(`  📅 更新 ${period} 排行榜...`);
        const { periodStart, periodEnd } = this.getPeriodRange(period, now);
        await Promise.all([
          this.updatePersonalLeaderboard(period, periodStart, periodEnd),
          this.updateAllianceLeaderboard(period, periodStart, periodEnd),
          this.updateRegionLeaderboard(period, periodStart, periodEnd)
        ]);
      }));

      // 更新统计信息
      await this.updateLeaderboardStats();

      const duration = Date.now() - startTime;
      this.lastUpdate = new Date();
      console.log(`✅ 排行榜数据更新完成，耗时: ${duration}ms`);
      
    } catch (error) {
      console.error('❌ 更新排行榜数据失败:', error);
    }
  }

  /**
   * 更新个人排行榜
   */
  async updatePersonalLeaderboard(period, periodStart, periodEnd) {
    try {
      // 使用 pixels_history 分区表统计用户在指定时间段内的像素统计
      // 根据时间周期统计：日榜统计当日，周榜统计当周，月榜统计当月，总榜统计所有时间
      // 🆕 只统计真实绘制的像素（pixel_type = 'basic'），剔除广告、联盟、炸弹、活动等道具类像素
      const userStats = await db.raw(`
        WITH latest_pixels AS (
          SELECT DISTINCT ON (grid_id)
            grid_id,
            user_id,
            created_at,
            pixel_type,
            related_id
          FROM pixels_history
          WHERE created_at >= ? AND created_at < ?
            AND pixel_type = ?
          ORDER BY grid_id, created_at DESC
        )
        SELECT
          users.id,
          users.username,
          users.display_name,
          users.avatar_url,
          COUNT(latest_pixels.grid_id) as pixel_count
        FROM latest_pixels
        JOIN users ON latest_pixels.user_id = users.id
        WHERE users.is_banned = false
        GROUP BY users.id, users.username, users.display_name, users.avatar_url
        ORDER BY pixel_count DESC
        LIMIT 100
      `, [periodStart, periodEnd, PIXEL_TYPES.BASIC]);

      // 插入新数据（使用 UPSERT 避免重复键冲突）
      const personalData = userStats.rows.map((user, index) => ({
        user_id: user.id,
        username: user.username,
        display_name: user.display_name,
        avatar: null, // raw pixel data excluded for performance
        avatar_url: user.avatar_url,
        pixel_count: parseInt(user.pixel_count),
        rank: index + 1,
        period: period,
        period_start: periodStart,
        period_end: periodEnd,
        last_updated: new Date(),
        created_at: new Date()
      }));

      if (personalData.length > 0) {
        // 清除当前周期的旧数据，避免已掉出 top 100 的用户保留陈旧排名
        await db('leaderboard_personal')
          .where('period', period)
          .where('period_start', periodStart)
          .del();

        // 批量 UPSERT：参数化 VALUES，一次写入所有行
        const placeholders = personalData.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
        const params = personalData.flatMap(user => [
          user.user_id, user.username, user.display_name, user.avatar, user.avatar_url,
          user.pixel_count, user.rank, user.period, user.period_start, user.period_end,
          user.last_updated, user.created_at
        ]);

        await db.raw(`
          INSERT INTO leaderboard_personal (
            user_id, username, display_name, avatar, avatar_url, pixel_count, rank,
            period, period_start, period_end, last_updated, created_at
          ) VALUES ${placeholders}
          ON CONFLICT (user_id, period, period_start)
          DO UPDATE SET
            username = EXCLUDED.username,
            display_name = EXCLUDED.display_name,
            avatar = EXCLUDED.avatar,
            avatar_url = EXCLUDED.avatar_url,
            pixel_count = EXCLUDED.pixel_count,
            previous_rank = leaderboard_personal.rank,
            rank = EXCLUDED.rank,
            period_end = EXCLUDED.period_end,
            last_updated = EXCLUDED.last_updated
        `, params);
        console.log(`    ✅ 个人排行榜: ${personalData.length} 条记录 (批量写入)`);
      }

    } catch (error) {
      console.error('    ❌ 更新个人排行榜失败:', error.message);
    }
  }

  /**
   * 更新联盟排行榜
   */
  async updateAllianceLeaderboard(period, periodStart, periodEnd) {
    try {
      // 使用 pixels_history 分区表统计联盟在指定时间段内的像素统计
      // 根据时间周期统计：日榜统计当日，周榜统计当周，月榜统计当月，总榜统计所有时间
      // 🆕 只统计真实绘制的像素（pixel_type = 'basic'），剔除广告、联盟、炸弹、活动等道具类像素
      const allianceStats = await db.raw(`
        WITH latest_pixels AS (
          SELECT DISTINCT ON (grid_id)
            grid_id,
            user_id,
            created_at,
            pixel_type,
            related_id
          FROM pixels_history
          WHERE created_at >= ? AND created_at < ?
            AND pixel_type = ?
          ORDER BY grid_id, created_at DESC
        )
        SELECT
          alliances.id,
          alliances.name,
          alliances.flag_pattern_id as flag,
          alliances.color,
          alliances.flag_pattern_id,
          COUNT(DISTINCT latest_pixels.user_id) as member_count,
          COUNT(latest_pixels.grid_id) as total_pixels
        FROM latest_pixels
        JOIN alliance_members ON latest_pixels.user_id = alliance_members.user_id
        JOIN alliances ON alliance_members.alliance_id = alliances.id
        WHERE alliances.is_active = true
        GROUP BY
          alliances.id,
          alliances.name,
          alliances.flag_pattern_id,
          alliances.color
        ORDER BY total_pixels DESC
        LIMIT 100
      `, [periodStart, periodEnd, PIXEL_TYPES.BASIC]);

      // 插入新数据（使用 UPSERT 避免重复键冲突）
      const allianceData = allianceStats.rows.map((alliance, index) => ({
        alliance_id: parseInt(alliance.id), // 直接使用 integer 类型
        alliance_name: alliance.name,
        alliance_flag: alliance.flag,
        pattern_id: alliance.flag_pattern_id,
        color: alliance.color,
        member_count: parseInt(alliance.member_count),
        total_pixels: parseInt(alliance.total_pixels),
        rank: index + 1,
        period: period,
        period_start: periodStart,
        period_end: periodEnd,
        last_updated: new Date(),
        created_at: new Date()
      }));

      if (allianceData.length > 0) {
        // 清除当前周期的旧数据，避免已掉出 top 100 的联盟保留陈旧排名
        await db('leaderboard_alliance')
          .where('period', period)
          .where('period_start', periodStart)
          .del();

        // 批量 UPSERT：参数化 VALUES，一次写入所有行
        const placeholders = allianceData.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
        const params = allianceData.flatMap(alliance => [
          alliance.alliance_id, alliance.alliance_name, alliance.alliance_flag,
          alliance.pattern_id, alliance.color, alliance.member_count, alliance.total_pixels,
          alliance.rank, alliance.period, alliance.period_start, alliance.period_end,
          alliance.last_updated, alliance.created_at
        ]);

        await db.raw(`
          INSERT INTO leaderboard_alliance (
            alliance_id, alliance_name, alliance_flag, pattern_id, color, member_count,
            total_pixels, rank, period, period_start, period_end, last_updated, created_at
          ) VALUES ${placeholders}
          ON CONFLICT (alliance_id, period, period_start)
          DO UPDATE SET
            alliance_name = EXCLUDED.alliance_name,
            alliance_flag = EXCLUDED.alliance_flag,
            pattern_id = EXCLUDED.pattern_id,
            color = EXCLUDED.color,
            member_count = EXCLUDED.member_count,
            total_pixels = EXCLUDED.total_pixels,
            previous_rank = leaderboard_alliance.rank,
            rank = EXCLUDED.rank,
            period_end = EXCLUDED.period_end,
            last_updated = EXCLUDED.last_updated
        `, params);
        console.log(`    ✅ 联盟排行榜: ${allianceData.length} 条记录 (批量写入)`);
      }

    } catch (error) {
      console.error('    ❌ 更新联盟排行榜失败:', error.message);
    }
  }

  /**
   * 更新城市排行榜（基于OSM PostGIS精确匹配）
   * 升级版：使用OSM planet_osm_polygon数据进行精确的城市边界匹配
   */
  async updateRegionLeaderboard(period, periodStart, periodEnd) {
    try {
      console.log(`    🏙️ 更新OSM城市排行榜 (${period})...`);

      // 优化版：直接使用pixels_history表中已填充的OSM字段
      // 无需重复进行PostGIS空间查询，大幅提升性能
      // 🆕 只统计真实绘制的像素（pixel_type = 'basic'），剔除广告、联盟、炸弹、活动等道具类像素
      const cityStats = await db.raw(`
        WITH latest_pixels AS (
          -- 获取每个位置的最新像素记录（避免重复统计被覆盖的像素）
          SELECT DISTINCT ON (grid_id)
            grid_id,
            user_id,
            created_at,
            -- 直接使用已填充的OSM字段
            osm_id,
            city,
            province,
            match_quality,
            match_source
          FROM pixels_history
          WHERE created_at >= ? AND created_at < ?
            AND pixel_type = ?
            AND city IS NOT NULL  -- 只统计已匹配到城市的像素
          ORDER BY grid_id, created_at DESC
        )
        SELECT
          -- 城市信息（使用已填充的city字段）
          lp.city as region_name,
          CONCAT(COALESCE(lp.province, ''), ' ', lp.city) as full_name,
          lp.city as flag,

          -- 根据匹配质量设置颜色
          CASE
            WHEN MAX(lp.match_quality) = 'perfect' THEN '#2196F3'      -- 蓝色：精确匹配
            WHEN MAX(lp.match_quality) IN ('excellent', 'good') THEN '#4CAF50'  -- 绿色：优秀匹配
            ELSE '#FF9800'  -- 橙色：一般匹配
          END as color,

          -- 统计数据
          COUNT(DISTINCT lp.user_id) as user_count,
          COUNT(DISTINCT am.alliance_id) as alliance_count,
          COUNT(lp.grid_id) as total_pixels,

          -- 匹配质量统计
          COUNT(CASE WHEN lp.osm_id IS NOT NULL THEN 1 END) as osm_matched_count,
          COUNT(CASE WHEN lp.osm_id IS NULL THEN 1 END) as fallback_count,

          -- 匹配质量分布
          COUNT(CASE WHEN lp.match_quality = 'perfect' THEN 1 END) as perfect_count,
          COUNT(CASE WHEN lp.match_quality IN ('excellent', 'good') THEN 1 END) as good_count,

          -- OSM ID（取第一个非空值）
          MAX(lp.osm_id) as osm_id

        FROM latest_pixels lp
        LEFT JOIN alliance_members am ON lp.user_id = am.user_id
        LEFT JOIN alliances a ON am.alliance_id = a.id AND a.is_active = true
        GROUP BY lp.city, lp.province
        HAVING COUNT(lp.grid_id) > 5  -- 只显示有足够活动的城市
        ORDER BY COUNT(lp.grid_id) DESC
        LIMIT 100
      `, [periodStart, periodEnd, PIXEL_TYPES.BASIC]);

      // 使用 UPSERT 操作避免重复键冲突
      const cityData = cityStats.rows.map((city, index) => ({
        region_id: city.osm_id ? parseInt(city.osm_id) : hashCityName(city.full_name || city.region_name),  // OSM ID 或城市名哈希
        region_name: city.full_name,
        region_flag: city.flag,
        color: city.color,
        user_count: parseInt(city.user_count),
        alliance_count: parseInt(city.alliance_count),
        total_pixels: parseInt(city.total_pixels),
        rank: index + 1,
        period: period,
        period_start: periodStart,
        period_end: periodEnd,
        last_updated: new Date(),
        created_at: new Date(),

        // 扩展字段：存储匹配质量信息
        metadata: JSON.stringify({
          osm_id: city.osm_id,
          osm_matched_count: parseInt(city.osm_matched_count),
          fallback_count: parseInt(city.fallback_count),
          perfect_count: parseInt(city.perfect_count),
          good_count: parseInt(city.good_count),
          match_source: 'pixels_history_osm',  // 标记数据来源
          data_version: '2.0'  // 新版本标识
        })
      }));

      if (cityData.length > 0) {
        // 清除当前周期的旧数据，避免已掉出 top 100 的城市保留陈旧排名
        await db('leaderboard_region')
          .where('period', period)
          .where('period_start', periodStart)
          .del();

        // 批量 INSERT（DELETE 后无需 ON CONFLICT，但保留 UPSERT 以防并发安全）
        const placeholders = cityData.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb)').join(', ');
        const params = cityData.flatMap(city => [
          city.region_id, city.region_name, city.region_flag, city.color,
          city.user_count, city.alliance_count, city.total_pixels, city.rank,
          city.period, city.period_start, city.period_end, city.last_updated,
          city.created_at, city.metadata
        ]);

        await db.raw(`
          INSERT INTO leaderboard_region (
            region_id, region_name, region_flag, color, user_count, alliance_count,
            total_pixels, rank, period, period_start, period_end, last_updated, created_at, metadata
          ) VALUES ${placeholders}
          ON CONFLICT (region_id, period, period_start)
          DO UPDATE SET
            region_name = EXCLUDED.region_name,
            region_flag = EXCLUDED.region_flag,
            color = EXCLUDED.color,
            user_count = EXCLUDED.user_count,
            alliance_count = EXCLUDED.alliance_count,
            total_pixels = EXCLUDED.total_pixels,
            rank = EXCLUDED.rank,
            period_end = EXCLUDED.period_end,
            last_updated = EXCLUDED.last_updated,
            metadata = EXCLUDED.metadata
        `, params);

        const perfectMatched = cityData.filter(c => JSON.parse(c.metadata).perfect_count > 0).length;
        const goodMatched = cityData.filter(c => JSON.parse(c.metadata).good_count > 0).length;
        console.log(`    ✅ OSM城市排行榜: ${cityData.length} 条记录 (批量写入, 精确: ${perfectMatched}, 优秀: ${goodMatched})`);
      } else {
        console.log(`    ⚠️ OSM城市排行榜: 无数据 (pixels_history表中无city数据，需要先运行OSM填充)`);
      }

    } catch (error) {
      console.error('    ❌ 更新OSM城市排行榜失败:', error.message);

      // 回退到原有的regions表匹配
      console.log('    🔄 回退到原有regions表匹配...');
      await this.updateRegionLeaderboardFallback(period, periodStart, periodEnd);
    }
  }

  /**
   * 城市排行榜回退方案（使用原有regions表）
   */
  async updateRegionLeaderboardFallback(period, periodStart, periodEnd) {
    try {
      console.log(`    🔄 使用回退方案更新城市排行榜 (${period})...`);

      // 使用原有的regions表进行城市匹配
      // 🆕 只统计真实绘制的像素（pixel_type = 'basic'），剔除广告、联盟、炸弹、活动等道具类像素
      const cityStats = await db.raw(`
        WITH latest_pixels AS (
          SELECT DISTINCT ON (grid_id)
            grid_id,
            user_id,
            latitude,
            longitude,
            created_at,
            pixel_type,
            related_id,
            city,
            province,
            country
          FROM pixels_history
          WHERE created_at >= ? AND created_at < ?
            AND pixel_type = ?
          ORDER BY grid_id, created_at DESC
        )
        SELECT
          regions.id,
          regions.name,
          regions.country,
          CONCAT(regions.country, ' ', regions.name) as full_name,
          regions.name as flag,
          '#FF9800' as color,  -- 橙色代表回退模式
          COUNT(DISTINCT latest_pixels.user_id) as user_count,
          COUNT(DISTINCT alliances.id) as alliance_count,
          COUNT(latest_pixels.grid_id) as total_pixels
        FROM regions
        LEFT JOIN latest_pixels ON (
          (regions.name = latest_pixels.city OR latest_pixels.city ILIKE CONCAT('%', regions.name, '%'))
          OR
          (ABS(latest_pixels.latitude - regions.center_lat) < 0.05 AND
           ABS(latest_pixels.longitude - regions.center_lng) < 0.05)
        )
        LEFT JOIN alliance_members ON latest_pixels.user_id = alliance_members.user_id
        LEFT JOIN alliances ON alliance_members.alliance_id = alliances.id
        GROUP BY regions.id, regions.name, regions.country
        ORDER BY total_pixels DESC
        LIMIT 100
      `, [periodStart, periodEnd, PIXEL_TYPES.BASIC]);

      // 使用 UPSERT 操作避免重复键冲突（回退模式）
      const cityData = cityStats.rows.map((city, index) => ({
        region_id: parseInt(city.id),
        region_name: city.full_name,
        region_flag: city.flag,
        color: city.color,
        user_count: parseInt(city.user_count),
        alliance_count: parseInt(city.alliance_count),
        total_pixels: parseInt(city.total_pixels),
        rank: index + 1,
        period: period,
        period_start: periodStart,
        period_end: periodEnd,
        last_updated: new Date(),
        created_at: new Date(),

        // 标记为回退模式
        metadata: JSON.stringify({
          is_osm_matched: false,
          match_quality: 'regions_fallback',
          data_source: 'regions_table'
        })
      }));

      if (cityData.length > 0) {
        // 清除当前周期的旧数据（回退路径）
        await db('leaderboard_region')
          .where('period', period)
          .where('period_start', periodStart)
          .del();

        // 批量 UPSERT：参数化 VALUES，一次写入所有行
        const placeholders = cityData.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb)').join(', ');
        const params = cityData.flatMap(city => [
          city.region_id, city.region_name, city.region_flag, city.color,
          city.user_count, city.alliance_count, city.total_pixels, city.rank,
          city.period, city.period_start, city.period_end, city.last_updated,
          city.created_at, city.metadata
        ]);

        await db.raw(`
          INSERT INTO leaderboard_region (
            region_id, region_name, region_flag, color, user_count, alliance_count,
            total_pixels, rank, period, period_start, period_end, last_updated, created_at, metadata
          ) VALUES ${placeholders}
          ON CONFLICT (region_id, period, period_start)
          DO UPDATE SET
            region_name = EXCLUDED.region_name,
            region_flag = EXCLUDED.region_flag,
            color = EXCLUDED.color,
            user_count = EXCLUDED.user_count,
            alliance_count = EXCLUDED.alliance_count,
            total_pixels = EXCLUDED.total_pixels,
            rank = EXCLUDED.rank,
            period_end = EXCLUDED.period_end,
            last_updated = EXCLUDED.last_updated,
            metadata = EXCLUDED.metadata
        `, params);
        console.log(`    ✅ 回退城市排行榜: ${cityData.length} 条记录 (批量写入)`);
      }

    } catch (error) {
      console.error('    ❌ 回退城市排行榜也失败:', error.message);
    }
  }

  /**
   * 更新排行榜统计信息
   */
  async updateLeaderboardStats() {
    try {
      const periods = ['daily', 'weekly', 'monthly', 'yearly'];
      const now = new Date();

      for (const period of periods) {
        const { periodStart, periodEnd } = this.getPeriodRange(period, now);
        
        // 更新个人排行榜统计
        const personalStats = await db('leaderboard_personal')
          .where('period', period)
          .where('period_start', periodStart)
          .select(db.raw('COUNT(*) as total_entries'), db.raw('SUM(pixel_count) as total_pixels'))
          .first();

        await this.upsertLeaderboardStats('personal', period, periodStart, periodEnd, personalStats);

        // 更新联盟排行榜统计
        const allianceStats = await db('leaderboard_alliance')
          .where('period', period)
          .where('period_start', periodStart)
          .select(db.raw('COUNT(*) as total_entries'), db.raw('SUM(total_pixels) as total_pixels'))
          .first();

        await this.upsertLeaderboardStats('alliance', period, periodStart, periodEnd, allianceStats);

        // 更新地区排行榜统计
        const regionStats = await db('leaderboard_region')
          .where('period', period)
          .where('period_start', periodStart)
          .select(db.raw('COUNT(*) as total_entries'), db.raw('SUM(total_pixels) as total_pixels'))
          .first();

        await this.upsertLeaderboardStats('region', period, periodStart, periodEnd, regionStats);
      }

    } catch (error) {
      console.error('❌ 更新排行榜统计信息失败:', error.message);
    }
  }

  /**
   * 插入或更新排行榜统计
   */
  async upsertLeaderboardStats(leaderboardType, period, periodStart, periodEnd, stats) {
    const existing = await db('leaderboard_stats')
      .where('leaderboard_type', leaderboardType)
      .where('period', period)
      .where('period_start', periodStart)
      .first();

    const data = {
      leaderboard_type: leaderboardType,
      period: period,
      period_start: periodStart,
      period_end: periodEnd,
      total_entries: parseInt(stats.total_entries) || 0,
      total_pixels: parseInt(stats.total_pixels) || 0,
      last_calculated: new Date()
    };

    if (existing) {
      await db('leaderboard_stats')
        .where('id', existing.id)
        .update(data);
    } else {
      data.created_at = new Date();
      await db('leaderboard_stats').insert(data);
    }
  }

  /**
   * 获取时间范围
   */
  getPeriodRange(period, now) {
    let periodStart, periodEnd;
    
    switch (period) {
    case 'daily':
      periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      periodEnd = new Date(periodStart);
      periodEnd.setDate(periodEnd.getDate() + 1);
      break;
    case 'weekly':
      periodStart = new Date(now);
      periodStart.setDate(now.getDate() - now.getDay());
      periodStart.setHours(0, 0, 0, 0);
      periodEnd = new Date(periodStart);
      periodEnd.setDate(periodEnd.getDate() + 7);
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
      // 总榜：统计所有时间的数据
      periodStart = new Date(0); // 1970-01-01
      periodEnd = new Date(); // 当前时间
      break;
    default:
      periodStart = new Date(0);
      periodEnd = new Date();
    }
    
    return { periodStart, periodEnd };
  }

  /**
   * 执行每日深度维护
   */
  async performDailyMaintenance() {
    try {
      console.log('🔧 开始每日深度维护...');

      // 清理过期的排行榜数据（保留30天）
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const deletedPersonal = await db('leaderboard_personal')
        .where('created_at', '<', thirtyDaysAgo)
        .del();

      const deletedAlliance = await db('leaderboard_alliance')
        .where('created_at', '<', thirtyDaysAgo)
        .del();

      const deletedRegion = await db('leaderboard_region')
        .where('created_at', '<', thirtyDaysAgo)
        .del();

      console.log(`  🗑️ 清理过期数据: 个人${deletedPersonal}条, 联盟${deletedAlliance}条, 地区${deletedRegion}条`);

      // 重建索引
      await this.rebuildIndexes();

      // 更新统计信息
      await this.updateLeaderboardStats();

      console.log('✅ 每日深度维护完成');

    } catch (error) {
      console.error('❌ 每日深度维护失败:', error);
    }
  }

  /**
   * 重建索引
   */
  async rebuildIndexes() {
    try {
      console.log('  🔧 重建数据库索引...');
      
      // 这里可以添加重建索引的逻辑
      // 例如：ANALYZE TABLE 等操作
      
      console.log('  ✅ 索引重建完成');
    } catch (error) {
      console.error('  ❌ 索引重建失败:', error.message);
    }
  }

  /**
   * 获取服务状态
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastUpdate: this.lastUpdate,
      uptime: this.lastUpdate ? Date.now() - this.lastUpdate.getTime() : 0
    };
  }
}

module.exports = LeaderboardMaintenanceService;
