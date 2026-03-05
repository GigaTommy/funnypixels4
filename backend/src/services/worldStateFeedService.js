/**
 * 世界状态Feed数据服务
 * 定期生成区域活跃度统计和联盟动态事件，写入announcements表
 * 让世界感觉"活着"
 */

const { db } = require('../config/database');
const { getRedis } = require('../config/redis');
const logger = require('../utils/logger');
const cron = require('node-cron');

class WorldStateFeedService {
  constructor() {
    this.isRunning = false;
    this.lastGeneration = null;
  }

  /**
   * 启动定时生成服务
   * 每小时生成一次区域活跃度事件
   */
  start() {
    if (this.isRunning) {
      logger.warn('WorldStateFeedService 已在运行中');
      return;
    }

    this.isRunning = true;
    logger.info('启动世界状态Feed数据服务...');

    // 每小时整点生成区域活跃度统计
    cron.schedule('5 * * * *', async () => {
      await this.generateRegionActivityEvents();
    });

    // 每3小时生成联盟动态变化事件
    cron.schedule('15 */3 * * *', async () => {
      await this.generateAllianceDominanceEvents();
    });

    logger.info('世界状态Feed数据服务已启动');
  }

  /**
   * 停止服务
   */
  stop() {
    this.isRunning = false;
    logger.info('世界状态Feed数据服务已停止');
  }

  /**
   * 生成区域活跃度事件
   * 查询过去1小时内最活跃的区域，写入announcements表
   */
  async generateRegionActivityEvents() {
    if (!this.isRunning) return;

    try {
      logger.info('开始生成区域活跃度事件...');

      // 查询过去1小时最活跃的5个城市（按像素数排序）
      const activeRegions = await db('pixels')
        .whereNotNull('city')
        .where('city', '!=', '')
        .where('updated_at', '>', db.raw("NOW() - INTERVAL '1 hour'"))
        .select(
          'city',
          'province',
          db.raw('COUNT(*) as pixel_count'),
          db.raw('COUNT(DISTINCT user_id) as active_users')
        )
        .groupBy('city', 'province')
        .orderBy('pixel_count', 'desc')
        .limit(5);

      if (activeRegions.length === 0) {
        logger.debug('过去1小时无活跃区域数据，跳过');
        return;
      }

      // 获取系统用户ID（用作公告作者）
      const systemUser = await this._getSystemUserId();
      if (!systemUser) {
        logger.warn('未找到系统用户，无法生成公告');
        return;
      }

      // 检查是否已经在最近1小时内生成过类似的公告（避免重复）
      const recentAnnouncement = await db('announcements')
        .where('type', 'system')
        .where('author_id', systemUser)
        .where('created_at', '>', db.raw("NOW() - INTERVAL '50 minutes'"))
        .whereRaw("title LIKE '%热门区域%'")
        .first();

      if (recentAnnouncement) {
        logger.debug('最近已生成过热门区域公告，跳过');
        return;
      }

      // 构建公告内容
      const topRegion = activeRegions[0];
      const regionSummary = activeRegions
        .map((r, i) => `${i + 1}. ${r.city || r.province} - ${r.pixel_count}像素 / ${r.active_users}人`)
        .join('\n');

      const title = `热门区域 - ${topRegion.city || topRegion.province}最为活跃`;
      const content = `过去1小时最活跃的区域：\n${regionSummary}\n\n快去这些地方看看吧！`;

      await db('announcements').insert({
        author_id: systemUser,
        title,
        content,
        type: 'system',
        is_active: true,
        is_pinned: false,
        priority: 0,
        publish_at: new Date()
      });

      logger.info(`区域活跃度公告已生成: ${title}`);
      this.lastGeneration = new Date();

    } catch (error) {
      logger.error('生成区域活跃度事件失败:', error);
    }
  }

  /**
   * 生成联盟占比变化事件
   * 检测联盟在各区域的像素占比变化
   */
  async generateAllianceDominanceEvents() {
    if (!this.isRunning) return;

    try {
      logger.info('开始生成联盟动态变化事件...');

      // 查询各城市中联盟像素占比最高的联盟
      const dominantAlliances = await db('pixels')
        .leftJoin('alliances', 'pixels.alliance_id', 'alliances.id')
        .whereNotNull('pixels.city')
        .where('pixels.city', '!=', '')
        .whereNotNull('pixels.alliance_id')
        .where('pixels.updated_at', '>', db.raw("NOW() - INTERVAL '24 hours'"))
        .select(
          'pixels.city',
          'alliances.name as alliance_name',
          'alliances.id as alliance_id',
          db.raw('COUNT(*) as pixel_count')
        )
        .groupBy('pixels.city', 'alliances.name', 'alliances.id')
        .orderBy('pixel_count', 'desc')
        .limit(20);

      if (dominantAlliances.length === 0) {
        logger.debug('过去24小时无联盟活跃数据，跳过');
        return;
      }

      // 按城市分组，找出每个城市中占比最高的联盟
      const cityDominance = {};
      for (const row of dominantAlliances) {
        if (!cityDominance[row.city]) {
          cityDominance[row.city] = row;
        }
      }

      // 获取系统用户ID
      const systemUser = await this._getSystemUserId();
      if (!systemUser) return;

      // 检查近期是否已生成过联盟动态公告
      const recentAnnouncement = await db('announcements')
        .where('type', 'system')
        .where('author_id', systemUser)
        .where('created_at', '>', db.raw("NOW() - INTERVAL '2 hours 50 minutes'"))
        .whereRaw("title LIKE '%联盟动态%'")
        .first();

      if (recentAnnouncement) {
        logger.debug('最近已生成过联盟动态公告，跳过');
        return;
      }

      // 构建联盟动态内容
      const cities = Object.entries(cityDominance).slice(0, 5);
      if (cities.length === 0) return;

      const topCity = cities[0];
      const dominanceSummary = cities
        .map(([city, data]) => `${city}: ${data.alliance_name} (${data.pixel_count}像素)`)
        .join('\n');

      const title = `联盟动态 - ${topCity[1].alliance_name}在${topCity[0]}占据领先`;
      const content = `各城市联盟活跃排名（24小时内）：\n${dominanceSummary}`;

      await db('announcements').insert({
        author_id: systemUser,
        title,
        content,
        type: 'system',
        is_active: true,
        is_pinned: false,
        priority: 0,
        publish_at: new Date()
      });

      logger.info(`联盟动态公告已生成: ${title}`);

    } catch (error) {
      logger.error('生成联盟动态变化事件失败:', error);
    }
  }

  /**
   * 获取全局活动摘要数据（供 activity-summary 端点使用）
   * @returns {Object} 活动摘要
   */
  async getActivitySummary() {
    try {
      // 使用Redis缓存，60秒过期
      let redis;
      try {
        redis = getRedis();
      } catch (e) {
        // Redis不可用
      }

      const CACHE_KEY = 'feed:activity_summary';
      if (redis) {
        try {
          const cached = await redis.get(CACHE_KEY);
          if (cached) {
            return JSON.parse(cached);
          }
        } catch (e) {
          // Redis读取失败，继续从DB查询
        }
      }

      // 1. 过去24小时总绘制像素数
      const pixelsLast24h = await db('pixels')
        .where('updated_at', '>', db.raw("NOW() - INTERVAL '24 hours'"))
        .count('* as count')
        .first();

      // 2. 过去1小时最活跃区域
      const mostActiveRegion = await db('pixels')
        .whereNotNull('city')
        .where('city', '!=', '')
        .where('updated_at', '>', db.raw("NOW() - INTERVAL '1 hour'"))
        .select(
          'city',
          'province',
          db.raw('COUNT(*) as pixel_count')
        )
        .groupBy('city', 'province')
        .orderBy('pixel_count', 'desc')
        .first();

      // 3. 过去1小时活跃用户数
      const activeUsersLastHour = await db('pixels')
        .where('updated_at', '>', db.raw("NOW() - INTERVAL '1 hour'"))
        .countDistinct('user_id as count')
        .first();

      // 4. 今日绘制像素最多的联盟
      const topAllianceToday = await db('pixels')
        .leftJoin('alliances', 'pixels.alliance_id', 'alliances.id')
        .whereNotNull('pixels.alliance_id')
        .where('pixels.updated_at', '>', db.raw("NOW() - INTERVAL '24 hours'"))
        .select(
          'alliances.id as alliance_id',
          'alliances.name as alliance_name',
          'alliances.flag_pattern_id',
          db.raw('COUNT(*) as pixel_count')
        )
        .groupBy('alliances.id', 'alliances.name', 'alliances.flag_pattern_id')
        .orderBy('pixel_count', 'desc')
        .first();

      // 5. 过去24小时完成的绘画会话数
      const completedSessions = await db('drawing_sessions')
        .where('status', 'completed')
        .where('end_time', '>', db.raw("NOW() - INTERVAL '24 hours'"))
        .count('* as count')
        .first();

      const summary = {
        pixels_last_24h: parseInt(pixelsLast24h?.count || 0),
        most_active_region: mostActiveRegion ? {
          city: mostActiveRegion.city,
          province: mostActiveRegion.province,
          pixel_count: parseInt(mostActiveRegion.pixel_count)
        } : null,
        active_users_last_hour: parseInt(activeUsersLastHour?.count || 0),
        top_alliance_today: topAllianceToday ? {
          alliance_id: topAllianceToday.alliance_id,
          alliance_name: topAllianceToday.alliance_name,
          flag_pattern_id: topAllianceToday.flag_pattern_id,
          pixel_count: parseInt(topAllianceToday.pixel_count)
        } : null,
        completed_sessions_24h: parseInt(completedSessions?.count || 0),
        generated_at: new Date().toISOString()
      };

      // 缓存结果（60秒）
      if (redis) {
        try {
          await redis.setEx(CACHE_KEY, 60, JSON.stringify(summary));
        } catch (e) {
          // Redis写入失败（非关键）
        }
      }

      return summary;

    } catch (error) {
      logger.error('获取活动摘要失败:', error);
      return {
        pixels_last_24h: 0,
        most_active_region: null,
        active_users_last_hour: 0,
        top_alliance_today: null,
        completed_sessions_24h: 0,
        generated_at: new Date().toISOString(),
        error: '数据暂时不可用'
      };
    }
  }

  /**
   * 获取或创建系统用户ID（用作自动公告的作者）
   * @returns {string|null} 系统用户ID
   */
  async _getSystemUserId() {
    try {
      // 查找role为admin的用户作为系统用户
      const admin = await db('users')
        .where('role', 'admin')
        .select('id')
        .first();

      if (admin) return admin.id;

      // 如果没有admin用户，使用第一个用户
      const firstUser = await db('users')
        .select('id')
        .orderBy('created_at', 'asc')
        .first();

      return firstUser?.id || null;
    } catch (error) {
      logger.error('获取系统用户ID失败:', error);
      return null;
    }
  }

  /**
   * 获取服务状态
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastGeneration: this.lastGeneration
    };
  }
}

module.exports = new WorldStateFeedService();
