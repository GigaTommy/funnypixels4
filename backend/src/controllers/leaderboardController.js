const { db } = require('../config/database');
const logger = require('../utils/logger');
const CacheService = require('../services/cacheService');
const RegionLeaderboardCacheService = require('../services/regionLeaderboardCacheService');

const RankTierService = require('../services/rankTierService');
const Cosmetic = require('../models/Cosmetic');
const { normalizeUserForDisplay, isUserDeleted } = require('../utils/userDisplayHelper');

/**
 * Strip hardcoded localhost URLs from avatar paths so clients
 * can resolve them relative to their configured API base.
 */
function sanitizeAvatarUrl(url) {
  if (!url) return url;
  // Remove http://localhost:PORT or http://IP:PORT prefix, keep the path
  // This allows clients to resolve URLs relative to their configured API base
  return url.replace(/^https?:\/\/(localhost|[\d.]+)(:\d+)?/, '');
}

// 🚀 优化：使用Redis缓存替代内存Map，支持多实例部署
const COUNT_CACHE_TTL = 3600; // 1小时（秒）

/**
 * 从Redis获取缓存的计数
 * @param {string} key - 缓存键
 * @returns {Promise<number|null>} 计数值或null
 */
async function getCachedCount(key) {
  const cacheKey = `leaderboard:count:${key}`;
  const cached = await CacheService.get(cacheKey);

  if (cached !== null && cached !== undefined) {
    return parseInt(cached);
  }
  return null;
}

/**
 * 设置Redis缓存计数
 * @param {string} key - 缓存键
 * @param {number} value - 计数值
 */
async function setCachedCount(key, value) {
  const cacheKey = `leaderboard:count:${key}`;
  await CacheService.set(cacheKey, value.toString(), COUNT_CACHE_TTL);
}

/**
 * 清除排行榜计数缓存
 * @param {string} period - 时间周期
 * @param {string} periodStart - 周期开始时间
 */
async function invalidateCountCache(period, periodStart) {
  const patterns = [
    `leaderboard:count:personal:${period}:${periodStart}`,
    `leaderboard:count:alliance:${period}:${periodStart}`,
    `leaderboard:count:city:${period}:${periodStart}`,
    `leaderboard:count:user_count:${period}:${periodStart}`,
    `leaderboard:count:alliance_count:${period}:${periodStart}`
  ];

  for (const pattern of patterns) {
    await CacheService.del(pattern);
  }

  logger.info('✅ 排行榜计数缓存已清除', { period, periodStart });
}

class LeaderboardController {
  // 获取个人排行榜 - 查询基础数据表
  static async getPersonalLeaderboard(req, res) {
    // 🚀 性能监控：记录开始时间
    const startTime = Date.now();

    try {
      let { period = 'daily', limit = 50, offset = 0 } = req.query;
      const currentUserId = req.user ? req.user.id : null;

      // 将 allTime 映射到 yearly
      if (period === 'allTime') {
        period = 'yearly';
      }

      // 计算时间范围
      const { periodStart, periodEnd } = LeaderboardController.getPeriodRange(period);

      // 🔐 Fetch privacy settings and account status
      const query = db('leaderboard_personal')
        .leftJoin('privacy_settings', 'leaderboard_personal.user_id', 'privacy_settings.user_id')
        .leftJoin('users', 'leaderboard_personal.user_id', 'users.id')
        .leftJoin('alliance_members', function () {
          this.on('leaderboard_personal.user_id', '=', 'alliance_members.user_id')
            .andOn('alliance_members.status', '=', db.raw('?', ['active']));
        })
        .leftJoin('alliances', 'alliance_members.alliance_id', 'alliances.id')
        .select(
          // 显式列名，排除 avatar 列（~7KB/用户 的原始像素数据）
          'leaderboard_personal.id',
          'leaderboard_personal.user_id',
          'leaderboard_personal.username',
          'leaderboard_personal.display_name',
          'leaderboard_personal.avatar_url',
          'leaderboard_personal.pixel_count',
          'leaderboard_personal.rank',
          'leaderboard_personal.previous_rank',
          'leaderboard_personal.period',
          'leaderboard_personal.period_start',
          'leaderboard_personal.period_end',
          'leaderboard_personal.last_updated',
          'users.account_status',
          'privacy_settings.hide_nickname',
          'privacy_settings.hide_alliance',
          'privacy_settings.hide_alliance_flag',
          'alliances.name as alliance_name',
          'alliances.flag_pattern_id',
          'alliances.flag_pattern_id as alliance_flag'
        )
        .where('period', period)
        .where('period_start', periodStart)
        .orderBy('rank', 'asc')
        .limit(parseInt(limit))
        .offset(parseInt(offset));

      const results = await query;

      // 批量获取所有用户的装饰品
      const userIds = results.map(r => r.user_id).filter(Boolean);
      let cosmeticsMap = {};
      try {
        cosmeticsMap = await Cosmetic.getEquippedCosmeticsMapBatch(userIds);
      } catch (e) { /* ignore */ }

      // 字段映射：pixel_count -> total_pixels（适配 iOS 客户端）
      // 同时应用隐私屏蔽和删除用户处理
      const mappedResults = results.map(user => {
        // 判断是否是当前用户
        const isCurrentUser = currentUserId && user.user_id === currentUserId;

        // First check if user is deleted
        const userDeleted = isUserDeleted(user);

        // 隐私屏蔽逻辑
        let displayName = user.display_name || user.username;
        let avatarUrl = sanitizeAvatarUrl(user.avatar_url);
        let allianceName = user.alliance_name;
        let allianceFlag = user.alliance_flag || user.flag_pattern;
        let flagPatternId = user.flag_pattern_id;
        let isDeleted = false;
        let clickable = true;

        // Deleted user takes precedence over privacy settings
        if (userDeleted) {
          const normalized = normalizeUserForDisplay(user);
          displayName = normalized.display_name;
          avatarUrl = null;
          allianceName = null;
          allianceFlag = null;
          flagPatternId = null;
          isDeleted = true;
          clickable = false;
        } else if (!isCurrentUser) {
          // Apply privacy settings only if not deleted
          if (user.hide_nickname) {
            displayName = '匿名像素师'; // Anonymous Pixel Artist
            avatarUrl = null;
          }
          if (user.hide_alliance) {
            allianceName = null;
          }
          if (user.hide_alliance_flag) {
            allianceFlag = null;
            flagPatternId = null;
          }
        }

        const pixelCount = parseInt(user.pixel_count) || 0;
        const previousRank = user.previous_rank || null;
        const rankChange = previousRank ? previousRank - user.rank : null;
        const userCosmetics = (userDeleted || user.hide_nickname) ? null : (cosmeticsMap[user.user_id] || null);
        return {
          ...user,
          display_name: displayName,
          avatar_url: avatarUrl,
          avatar: null, // raw pixel data excluded for performance (~7KB per user)
          alliance_name: allianceName,
          alliance_flag: allianceFlag,
          flag_pattern: allianceFlag,
          flag_pattern_id: flagPatternId,
          is_deleted: isDeleted,
          clickable: clickable,
          equipped_cosmetics: userCosmetics && Object.keys(userCosmetics).length > 0 ? userCosmetics : null,

          pixel_count: pixelCount,
          total_pixels: pixelCount,
          is_current_user: isCurrentUser,
          rankTier: RankTierService.getTierForPixels(pixelCount),
          previous_rank: previousRank,
          rank_change: rankChange
        };
      });

      // 获取总数（带 1 小时内存缓存）
      const personalCountKey = `personal_count:${period}:${periodStart}`;
      let total = await getCachedCount(personalCountKey);
      if (total === null) {
        const totalCount = await db('leaderboard_personal')
          .where('period', period)
          .where('period_start', periodStart)
          .count('* as count')
          .first();
        total = parseInt(totalCount.count);
        await setCachedCount(personalCountKey, total);
      }

      // 计算当前用户的 myRank 信息
      let myRank = null;
      if (currentUserId) {
        try {
          const myEntry = await db('leaderboard_personal')
            .where({ user_id: currentUserId, period, period_start: periodStart })
            .select('rank', 'pixel_count')
            .first();

          if (myEntry) {
            const myPixels = parseInt(myEntry.pixel_count) || 0;
            const myRankNum = myEntry.rank;

            // 获取上一名的像素数（用于计算差距）
            let gapToNext = 0;
            if (myRankNum > 1) {
              const nextEntry = await db('leaderboard_personal')
                .where({ period, period_start: periodStart, rank: myRankNum - 1 })
                .select('pixel_count')
                .first();
              if (nextEntry) {
                gapToNext = (parseInt(nextEntry.pixel_count) || 0) - myPixels;
              }
            }

            // 计算百分位（击败了多少百分比的玩家）
            const percentile = total > 1 ? Math.round(((total - myRankNum) / (total - 1)) * 1000) / 10 : 100;

            myRank = {
              rank: myRankNum,
              totalPixels: myPixels,
              gapToNext,
              percentile,
              rankTier: RankTierService.getTierForPixels(myPixels)
            };
          }
        } catch (e) {
          logger.warn('计算 myRank 失败:', e.message);
        }
      }

      const leaderboard = {
        period,
        data: mappedResults,
        myRank,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total
        }
      };

      // 🚀 性能优化：添加缓存头
      res.setHeader('Cache-Control', 'private, max-age=60'); // 60秒客户端缓存
      res.setHeader('X-Cache-Hit', 'false');

      // 🚀 性能监控：记录响应时间
      const duration = Date.now() - startTime;
      if (duration > 500) {
        logger.warn('排行榜响应慢', {
          endpoint: 'personal',
          period,
          duration: `${duration}ms`,
          dataSize: mappedResults.length
        });
      }

      res.json({
        success: true,
        data: leaderboard,
        _performance: process.env.NODE_ENV === 'development' ? {
          queryTime: `${duration}ms`,
          dataSize: mappedResults.length
        } : undefined
      });
    } catch (error) {
      console.error('获取个人排行榜失败:', error);
      res.status(500).json({
        success: false,
        message: '获取个人排行榜失败',
        error: error.message
      });
    }
  }

  // 获取联盟排行榜 - 查询基础数据表
  static async getAllianceLeaderboard(req, res) {
    try {
      let { period = 'daily', limit = 50, offset = 0 } = req.query;

      // 将 allTime 映射到 yearly
      if (period === 'allTime') {
        period = 'yearly';
      }

      // 计算时间范围
      const { periodStart, periodEnd } = LeaderboardController.getPeriodRange(period);

      // 从排行榜基础数据表查询，JOIN pattern_assets 获取 render_type
      const query = db('leaderboard_alliance')
        .leftJoin('pattern_assets', 'leaderboard_alliance.pattern_id', 'pattern_assets.key')
        .select(
          'leaderboard_alliance.*',
          'leaderboard_alliance.pattern_id as flag_pattern',
          'pattern_assets.render_type',
          'pattern_assets.unicode_char',
          'pattern_assets.color as pattern_color'
        )
        .where('leaderboard_alliance.period', period)
        .where('leaderboard_alliance.period_start', periodStart)
        .orderBy('leaderboard_alliance.rank', 'asc')
        .limit(parseInt(limit))
        .offset(parseInt(offset));

      const results = await query;

      // 字段映射：添加 id 和 total_pixels（适配 iOS 客户端）
      const mappedResults = results.map((alliance, index) => {
        const count = parseInt(alliance.total_pixels || alliance.pixel_count) || 0;
        return {
          ...alliance,
          id: String(alliance.id || alliance.alliance_id || index + 1), // 确保是字符串类型
          pixel_count: count, // 确保 pixel_count 是整数类型
          total_pixels: count, // 添加 total_pixels 字段
          flag_pattern_id: alliance.flag_pattern_id || alliance.flag_pattern,
          pattern_type: alliance.render_type, // 从 pattern_assets 获取的 render_type
          unicode_char: alliance.unicode_char, // emoji 字符
          flag_color: alliance.pattern_color || alliance.color // pattern 颜色优先
        };
      });

      // 获取总数（带 1 小时内存缓存）
      const allianceCountKey = `alliance_count:${period}:${periodStart}`;
      let allianceTotal = await getCachedCount(allianceCountKey);
      if (allianceTotal === null) {
        const totalCount = await db('leaderboard_alliance')
          .where('period', period)
          .where('period_start', periodStart)
          .count('* as count')
          .first();
        allianceTotal = parseInt(totalCount.count);
        await setCachedCount(allianceCountKey, allianceTotal);
      }

      const leaderboard = {
        period,
        data: mappedResults,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: allianceTotal
        }
      };

      res.json({
        success: true,
        data: leaderboard
      });
    } catch (error) {
      console.error('获取联盟排行榜失败:', error);
      res.status(500).json({
        success: false,
        message: '获取联盟排行榜失败',
        error: error.message
      });
    }
  }

  // 获取城市排行榜 - 使用预计算 leaderboard_region 表（与个人榜/联盟榜一致）
  static async getCityLeaderboard(req, res) {
    const startTime = Date.now();

    try {
      let { period = 'daily', limit = 50, offset = 0 } = req.query;

      // 将 allTime 映射到 yearly（与个人榜/联盟榜一致）
      if (period === 'allTime') {
        period = 'yearly';
      }

      // 参数验证
      limit = Math.min(parseInt(limit) || 50, 200);
      offset = Math.max(parseInt(offset) || 0, 0);

      // 1. 尝试从 Redis 缓存获取
      const cachedData = await RegionLeaderboardCacheService.getCachedRegionLeaderboard('city', period, limit, offset);
      if (cachedData) {
        const queryTime = Date.now() - startTime;
        logger.info(`✅ 城市榜缓存命中: city-${period}, 耗时: ${queryTime}ms`);
        // Normalize cached data field names for iOS CityLeaderboardEntry compatibility
        if (cachedData.data && Array.isArray(cachedData.data)) {
          cachedData.data = cachedData.data.map(item => ({
            ...item,
            id: String(item.id || item.rank),
            city_name: item.city_name || item.region_name || item.region_code || '',
            total_pixels: parseInt(item.total_pixels ?? item.pixel_count ?? 0),
            total_users: parseInt(item.total_users ?? item.user_count ?? 0),
            country_code: null, // region_code contains city name, not ISO country code
            region_code: null,
          }));
        }
        return res.json({ success: true, data: cachedData, cached: true, queryTime });
      }

      // 2. 查询预计算表 leaderboard_region（与个人榜/联盟榜使用相同模式）
      const { periodStart, periodEnd } = LeaderboardController.getPeriodRange(period);

      const results = await db('leaderboard_region')
        .where('period', period)
        .where('period_start', periodStart)
        .orderBy('rank', 'asc')
        .limit(limit)
        .offset(offset);

      // 字段映射：适配 iOS CityLeaderboardEntry 模型
      const mappedResults = results.map(row => ({
        id: String(row.id || row.rank),
        city_name: row.region_flag || row.region_name,
        region_name: row.region_name,
        country_code: null, // region_flag contains city name, not ISO country code
        region_code: null,
        color: row.color,
        user_count: parseInt(row.user_count) || 0,
        total_users: parseInt(row.user_count) || 0,
        alliance_count: parseInt(row.alliance_count) || 0,
        pixel_count: parseInt(row.total_pixels) || 0,
        total_pixels: parseInt(row.total_pixels) || 0,
        rank: row.rank,
        period,
        period_start: row.period_start,
        period_end: row.period_end,
        last_updated: row.last_updated
      }));

      // 获取总数（带内存缓存）
      const countCacheKey = `city_count:${period}:${periodStart}`;
      let total = await getCachedCount(countCacheKey);
      if (total === null) {
        const totalCount = await db('leaderboard_region')
          .where('period', period)
          .where('period_start', periodStart)
          .count('* as count')
          .first();
        total = parseInt(totalCount?.count || 0);
        await setCachedCount(countCacheKey, total);
      }

      const leaderboard = {
        period,
        data: mappedResults,
        pagination: { limit, offset, total }
      };

      // 3. 异步回填 Redis 缓存
      RegionLeaderboardCacheService.cacheRegionLeaderboard('city', period, leaderboard, limit, offset)
        .catch(err => logger.warn('城市榜缓存回填失败:', err.message));

      const queryTime = Date.now() - startTime;
      logger.info(`✅ 城市榜查询完成: ${period}, 数据条数=${mappedResults.length}, 耗时: ${queryTime}ms`);

      res.json({ success: true, data: leaderboard, cached: false, queryTime });

    } catch (error) {
      const queryTime = Date.now() - startTime;
      logger.error('❌ 获取城市排行榜失败:', { error: error.message, stack: error.stack, queryTime });
      res.status(500).json({ success: false, message: '获取城市排行榜失败', error: error.message, queryTime });
    }
  }

  // 获取用户排名 - 优化版：使用预生成表
  static async getUserRank(req, res) {
    try {
      const { userId } = req.params;
      const { period = 'daily' } = req.query;

      // 构建缓存键
      const cacheKey = `user_rank:${userId}:${period}`;

      // 先从缓存获取
      let rankInfo = await CacheService.get(cacheKey);

      if (!rankInfo) {
        // 🚀 优化：使用预生成的排行榜表，避免实时计算
        const timeFilter = this.getTimeFilter(period);
        const { periodStart } = this.getPeriodRange(period);

        // 查询预生成表，性能提升巨大
        const userRank = await db('leaderboard_personal')
          .where({
            user_id: userId,
            period: period,
            period_start: periodStart
          })
          .leftJoin('privacy_settings', 'leaderboard_personal.user_id', 'privacy_settings.user_id')
          .select([
            'leaderboard_personal.rank',
            'leaderboard_personal.pixel_count',
            'leaderboard_personal.username',
            'leaderboard_personal.display_name',
            'leaderboard_personal.avatar_url',
            'leaderboard_personal.last_updated',
            'privacy_settings.hide_nickname',
            'privacy_settings.hide_alliance',
            'privacy_settings.hide_alliance_flag'
          ])
          .first();

        if (userRank) {
          rankInfo = {
            period,
            rank: userRank.rank,
            user: {
              id: userId,
              username: (userRank.hide_nickname && userId !== req.user?.id) ? '匿名' : userRank.username,
              display_name: (userRank.hide_nickname && userId !== req.user?.id) ? '匿名像素师' : userRank.display_name,
              avatar: null, // raw pixel data excluded for performance
              avatar_url: (userRank.hide_nickname && userId !== req.user?.id) ? null : sanitizeAvatarUrl(userRank.avatar_url),
              pixel_count: userRank.pixel_count
            },
            total_users: await this.getTotalUserCount(period, periodStart),
            data_source: 'precomputed_table',
            last_updated: userRank.last_updated
          };
        } else {
          // 用户未在排行榜中，返回默认信息
          rankInfo = {
            period,
            rank: null,
            user: {
              id: userId,
              pixel_count: 0
            },
            total_users: await this.getTotalUserCount(period, periodStart),
            data_source: 'precomputed_table',
            note: 'User not in current leaderboard'
          };
        }

        // 🚀 优化：延长缓存时间到30分钟，减少数据库压力
        await CacheService.set(cacheKey, rankInfo, 1800); // 30分钟缓存
      }

      res.json({
        success: true,
        data: rankInfo,
        cached: true
      });
    } catch (error) {
      console.error('获取用户排名失败:', error);
      res.status(500).json({
        success: false,
        message: '获取用户排名失败',
        error: error.message
      });
    }
  }

  // 🆕 辅助方法：获取总用户数（带 1 小时内存缓存）
  static async getTotalUserCount(period, periodStart) {
    const cacheKey = `user_count:${period}:${periodStart}`;
    const cached = await getCachedCount(cacheKey);
    if (cached !== null) return cached;

    try {
      const count = await db('leaderboard_personal')
        .where({
          period: period,
          period_start: periodStart
        })
        .count('* as count')
        .first();

      const result = parseInt(count?.count || 0);
      await setCachedCount(cacheKey, result);
      return result;
    } catch (error) {
      console.warn('获取总用户数失败:', error.message);
      return 0;
    }
  }

  // 获取联盟排名 - 优化版：使用预生成表
  static async getAllianceRank(req, res) {
    try {
      const { allianceId } = req.params;
      const { period = 'daily' } = req.query;

      // 构建缓存键
      const cacheKey = `alliance_rank:${allianceId}:${period}`;

      // 先从缓存获取
      let rankInfo = await CacheService.get(cacheKey);

      if (!rankInfo) {
        // 🚀 优化：使用预生成的排行榜表，避免实时计算
        const { periodStart } = this.getPeriodRange(period);

        // 查询预生成表，性能提升巨大
        const allianceRank = await db('leaderboard_alliance')
          .where({
            alliance_id: parseInt(allianceId),
            period: period,
            period_start: periodStart
          })
          .select([
            'rank',
            'alliance_name',
            'alliance_flag',
            'color',
            'member_count',
            'total_pixels',
            'last_updated'
          ])
          .first();

        if (allianceRank) {
          rankInfo = {
            period,
            rank: allianceRank.rank,
            alliance: {
              id: parseInt(allianceId),
              name: allianceRank.alliance_name,
              flag: allianceRank.alliance_flag,
              color: allianceRank.color,
              member_count: allianceRank.member_count,
              total_pixels: allianceRank.total_pixels
            },
            total_alliances: await this.getTotalAllianceCount(period, periodStart),
            data_source: 'precomputed_table',
            last_updated: allianceRank.last_updated
          };
        } else {
          // 联盟未在排行榜中，返回默认信息
          rankInfo = {
            period,
            rank: null,
            alliance: {
              id: parseInt(allianceId),
              total_pixels: 0,
              member_count: 0
            },
            total_alliances: await this.getTotalAllianceCount(period, periodStart),
            data_source: 'precomputed_table',
            note: 'Alliance not in current leaderboard'
          };
        }

        // 🚀 优化：延长缓存时间到30分钟，减少数据库压力
        await CacheService.set(cacheKey, rankInfo, 1800); // 30分钟缓存
      }

      res.json({
        success: true,
        data: rankInfo,
        cached: true
      });
    } catch (error) {
      console.error('获取联盟排名失败:', error);
      res.status(500).json({
        success: false,
        message: '获取联盟排名失败',
        error: error.message
      });
    }
  }

  // 🆕 辅助方法：获取总联盟数（带 1 小时内存缓存）
  static async getTotalAllianceCount(period, periodStart) {
    const cacheKey = `alliance_count:${period}:${periodStart}`;
    const cached = await getCachedCount(cacheKey);
    if (cached !== null) return cached;

    try {
      const count = await db('leaderboard_alliance')
        .where({
          period: period,
          period_start: periodStart
        })
        .count('* as count')
        .first();

      const result = parseInt(count?.count || 0);
      await setCachedCount(cacheKey, result);
      return result;
    } catch (error) {
      console.warn('获取总联盟数失败:', error.message);
      return 0;
    }
  }

  // 点赞排行榜项目
  static async likeLeaderboardItem(req, res) {
    try {
      const { itemType, itemId } = req.body;
      const userId = req.user.id;

      // 验证输入
      if (!itemType || !itemId) {
        return res.status(400).json({
          success: false,
          message: '缺少必要参数'
        });
      }

      // 检查是否已经点赞
      const existingLike = await db('leaderboard_likes')
        .where({
          user_id: userId,
          item_type: itemType,
          item_id: itemId
        })
        .first();

      if (existingLike) {
        return res.status(400).json({
          success: false,
          message: '已经点赞过了'
        });
      }

      // 添加点赞记录
      await db('leaderboard_likes').insert({
        user_id: userId,
        item_type: itemType,
        item_id: itemId,
        created_at: new Date()
      });

      // 清除相关缓存
      await CacheService.delPattern(`leaderboard:${itemType}:*`);

      res.json({
        success: true,
        message: '点赞成功'
      });
    } catch (error) {
      console.error('点赞失败:', error);
      res.status(500).json({
        success: false,
        message: '点赞失败',
        error: error.message
      });
    }
  }

  // 取消点赞排行榜项目
  static async unlikeLeaderboardItem(req, res) {
    try {
      const { itemType, itemId } = req.body;
      const userId = req.user.id;

      // 验证输入
      if (!itemType || !itemId) {
        return res.status(400).json({
          success: false,
          message: '缺少必要参数'
        });
      }

      // 删除点赞记录
      const deleted = await db('leaderboard_likes')
        .where({
          user_id: userId,
          item_type: itemType,
          item_id: itemId
        })
        .del();

      if (deleted === 0) {
        return res.status(400).json({
          success: false,
          message: '没有找到点赞记录'
        });
      }

      // 清除相关缓存
      await CacheService.delPattern(`leaderboard:${itemType}:*`);

      res.json({
        success: true,
        message: '取消点赞成功'
      });
    } catch (error) {
      console.error('取消点赞失败:', error);
      res.status(500).json({
        success: false,
        message: '取消点赞失败',
        error: error.message
      });
    }
  }

  // 清除排行榜缓存
  static async clearLeaderboardCache(req, res) {
    try {
      const { type, period } = req.query;

      if (type) {
        await CacheService.clearLeaderboardCache(type);
      } else {
        // 清除所有排行榜缓存
        await CacheService.delPattern('leaderboard:*');
        await CacheService.delPattern('user_rank:*');
        await CacheService.delPattern('alliance_rank:*');
      }

      res.json({
        success: true,
        message: '排行榜缓存清除成功'
      });
    } catch (error) {
      console.error('清除排行榜缓存失败:', error);
      res.status(500).json({
        success: false,
        message: '清除排行榜缓存失败',
        error: error.message
      });
    }
  }

  // 清除城市榜缓存
  static async clearCityLeaderboardCache(req, res) {
    try {
      const { period } = req.query;

      if (period) {
        await RegionLeaderboardCacheService.clearPeriodCache(period);
      } else {
        await RegionLeaderboardCacheService.clearAllCache();
      }

      res.json({
        success: true,
        message: '城市榜缓存清除成功'
      });
    } catch (error) {
      logger.error('清除城市榜缓存失败:', error);
      res.status(500).json({
        success: false,
        message: '清除城市榜缓存失败',
        error: error.message
      });
    }
  }

  // 获取缓存统计信息
  static async getCacheStats(req, res) {
    try {
      const regionCacheStats = await RegionLeaderboardCacheService.getCacheStats();

      res.json({
        success: true,
        data: {
          city_leaderboard: regionCacheStats,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('获取缓存统计失败:', error);
      res.status(500).json({
        success: false,
        message: '获取缓存统计失败',
        error: error.message
      });
    }
  }

  // 预加载城市榜缓存
  static async preloadCityCache(req, res) {
    try {
      // 异步启动预加载
      RegionLeaderboardCacheService.preloadHotRegions()
        .then(() => {
          logger.info('✅ 城市榜缓存预加载任务完成');
        })
        .catch(error => {
          logger.error('❌ 城市榜缓存预加载任务失败:', error);
        });

      res.json({
        success: true,
        message: '城市榜缓存预加载任务已启动'
      });
    } catch (error) {
      logger.error('启动预加载任务失败:', error);
      res.status(500).json({
        success: false,
        message: '启动预加载任务失败',
        error: error.message
      });
    }
  }

  // 获取时间范围
  static getPeriodRange(period) {
    const now = new Date();
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
        // 总榜：从项目开始时间到现在
        periodStart = new Date('2024-01-01T00:00:00.000Z');
        periodEnd = new Date(); // 当前时间
        break;
      default:
        periodStart = new Date(0);
        periodEnd = new Date();
    }

    return { periodStart, periodEnd };
  }

  // 获取时间过滤器（保留向后兼容）
  static getTimeFilter(period) {
    const { periodStart } = this.getPeriodRange(period);
    return periodStart;
  }

  /**
   * 聚合接口：一次请求返回所有排行榜数据
   * GET /api/leaderboard/all?period=daily&limit=50
   *
   * 后端内部并行查询 4 个排行榜，客户端只需 1 个 RTT 即可获取全部数据。
   * 复用已有的 getPersonalLeaderboard / getFriendsLeaderboard / getAllianceLeaderboard / getCityLeaderboard
   * 逻辑，通过 mock response 捕获各自结果。
   */
  static async getAllLeaderboards(req, res) {
    try {
      // 创建轻量 mock response，捕获 handler 写入的 JSON 数据
      const capture = () => {
        let result = null;
        const mockRes = {
          json(data) { result = data; return mockRes; },
          status() { return mockRes; },
          setHeader() { return mockRes; } // 添加 setHeader 方法支持缓存头
        };
        return { res: mockRes, getData: () => result?.success ? result.data : null };
      };

      const p = capture(), f = capture(), a = capture(), c = capture();

      // 并行执行 4 个查询（Promise.allSettled 保证互不影响）
      await Promise.allSettled([
        LeaderboardController.getPersonalLeaderboard(req, p.res),
        LeaderboardController.getFriendsLeaderboard(req, f.res),
        LeaderboardController.getAllianceLeaderboard(req, a.res),
        LeaderboardController.getCityLeaderboard(req, c.res),
      ]);

      res.json({
        success: true,
        data: {
          personal: p.getData(),
          friends: f.getData(),
          alliance: a.getData(),
          city: c.getData(),
        }
      });
    } catch (error) {
      logger.error('获取聚合排行榜失败:', error);
      res.status(500).json({
        success: false,
        message: '获取聚合排行榜失败',
        error: error.message
      });
    }
  }

  // 获取好友排行榜
  static async getFriendsLeaderboard(req, res) {
    try {
      const currentUserId = req.user.id;
      let { period = 'weekly', limit = 50, offset = 0 } = req.query;

      if (period === 'allTime') period = 'yearly';

      const { periodStart } = LeaderboardController.getPeriodRange(period);

      // 获取当前用户关注的人
      const following = await db('user_follows')
        .where('follower_id', currentUserId)
        .select('following_id');

      const followingIds = following.map(f => f.following_id);

      // 也包含当前用户自己
      const allIds = [...followingIds, currentUserId];

      if (allIds.length === 0) {
        return res.json({
          success: true,
          data: { entries: [], myRank: null, totalFriends: 0 }
        });
      }

      // 从排行榜表查询这些用户的数据
      const entries = await db('leaderboard_personal')
        .leftJoin('users', 'leaderboard_personal.user_id', 'users.id')
        .leftJoin('privacy_settings', 'leaderboard_personal.user_id', 'privacy_settings.user_id')
        .leftJoin('alliance_members', function () {
          this.on('leaderboard_personal.user_id', '=', 'alliance_members.user_id')
            .andOn('alliance_members.status', '=', db.raw('?', ['active']));
        })
        .leftJoin('alliances', 'alliance_members.alliance_id', 'alliances.id')
        .select(
          // 显式列名，排除 avatar 列（~7KB/用户 的原始像素数据）
          'leaderboard_personal.id',
          'leaderboard_personal.user_id',
          'leaderboard_personal.username',
          'leaderboard_personal.display_name',
          'leaderboard_personal.avatar_url',
          'leaderboard_personal.pixel_count',
          'leaderboard_personal.rank',
          'leaderboard_personal.previous_rank',
          'leaderboard_personal.period',
          'leaderboard_personal.period_start',
          'leaderboard_personal.period_end',
          'leaderboard_personal.last_updated',
          'users.account_status',
          'privacy_settings.hide_nickname',
          'privacy_settings.hide_alliance',
          'privacy_settings.hide_alliance_flag',
          'alliances.name as alliance_name',
          'alliances.color as alliance_color',
          'alliances.flag_pattern_id'
        )
        .where('period', period)
        .where('period_start', periodStart)
        .whereIn('leaderboard_personal.user_id', allIds)
        .orderBy('pixel_count', 'desc')
        .limit(parseInt(limit))
        .offset(parseInt(offset));

      // 检查互关关系
      const mutualFollows = await db('user_follows')
        .whereIn('follower_id', followingIds)
        .where('following_id', currentUserId)
        .select('follower_id');
      const mutualSet = new Set(mutualFollows.map(f => f.follower_id));

      // 批量获取所有用户的装饰品
      const friendUserIds = entries.map(e => e.user_id).filter(Boolean);
      let friendCosmeticsMap = {};
      try {
        friendCosmeticsMap = await Cosmetic.getEquippedCosmeticsMapBatch(friendUserIds);
      } catch (e) { /* ignore */ }

      // 映射结果并添加排名，处理删除用户
      let myRankData = null;
      const mappedEntries = entries.map((user, index) => {
        const rank = index + 1;
        const isCurrentUser = user.user_id === currentUserId;
        const pixelCount = parseInt(user.pixel_count) || 0;

        if (isCurrentUser) {
          myRankData = { rank, pixelCount };
        }

        // Check if user is deleted
        const userDeleted = isUserDeleted(user);
        let displayName = user.display_name || user.username;
        let avatarUrl = sanitizeAvatarUrl(user.avatar_url);
        let isDeleted = false;
        let clickable = true;

        if (userDeleted) {
          const normalized = normalizeUserForDisplay(user);
          displayName = normalized.display_name;
          avatarUrl = null;
          isDeleted = true;
          clickable = false;
        }

        const userCosmetics = userDeleted ? null : (friendCosmeticsMap[user.user_id] || null);
        return {
          rank,
          user_id: user.user_id,
          username: user.username,
          display_name: displayName,
          avatar_url: avatarUrl,
          avatar: null, // raw pixel data excluded for performance
          is_deleted: isDeleted,
          clickable: clickable,
          equipped_cosmetics: userCosmetics && Object.keys(userCosmetics).length > 0 ? userCosmetics : null,
          total_pixels: pixelCount,
          alliance_id: user.alliance_id || null,
          alliance_name: user.alliance_name,
          flag_color: user.alliance_color,
          flag_pattern_id: user.flag_pattern_id,
          is_current_user: isCurrentUser,
          is_mutual: mutualSet.has(user.user_id),
          rankTier: RankTierService.getTierForPixels(pixelCount),
          previous_rank: user.previous_rank || null,
          rank_change: user.previous_rank ? user.previous_rank - rank : null
        };
      });

      // 计算 myRank
      let myRank = null;
      if (myRankData) {
        const tier = RankTierService.getTierForPixels(myRankData.pixelCount);
        myRank = {
          rank: myRankData.rank,
          totalPixels: myRankData.pixelCount,
          gapToNext: tier.nextTierPixels > 0 ? tier.nextTierPixels - myRankData.pixelCount : 0,
          percentile: entries.length > 0 ? Math.round((1 - (myRankData.rank - 1) / Math.max(1, entries.length)) * 100) : 100,
          rankTier: tier
        };
      }

      res.json({
        success: true,
        data: {
          period,
          data: mappedEntries,
          myRank,
          totalFriends: followingIds.length
        }
      });
    } catch (error) {
      logger.error('获取好友排行榜失败:', error);
      res.status(500).json({ success: false, message: '获取好友排行榜失败', error: error.message });
    }
  }
}

module.exports = LeaderboardController;
module.exports.invalidateCountCache = invalidateCountCache;
