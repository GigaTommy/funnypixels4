/**
 * 漂流瓶友好引导系统
 * 检测用户行为并提供智能引导
 */

const Logger = require('../utils/logger');
const { redisUtils } = require('../config/redis');
const quotaService = require('./driftBottleQuotaService');

const GUIDANCE_COOLDOWN = 30 * 60; // 30分钟冷却
const EMPTY_SEARCH_THRESHOLD = 3;  // 连续3次空搜索触发引导
const ABANDON_THRESHOLD = 2;       // 连续2次放弃触发引导
const ONLY_PICKUP_THRESHOLD = 5;   // 只拾取不抛出达到5次触发引导
const NEW_USER_PICKUP_THRESHOLD = 2; // 新手2次拾取后提示

/**
 * 场景检测类型
 */
const GUIDANCE_SCENARIOS = {
  NO_QUOTA: 'no_quota',              // 配额用完
  ONLY_PICKUP: 'only_pickup',        // 只拾取不抛出
  FREQUENT_ABANDON: 'frequent_abandon', // 频繁放弃
  EMPTY_AREA: 'empty_area',          // 空区域
  NEW_USER: 'new_user',              // 新手引导
  GPS_POOR: 'gps_poor'               // GPS质量差
};

class BottleGuidanceService {
  /**
   * 获取用户引导（主入口）
   * @param {string} userId
   * @returns {Promise<Object|null>} { scenarioKey, messageKey, priority }
   */
  static async getGuidance(userId) {
    try {
      // 检查冷却时间
      const inCooldown = await this.isInCooldown(userId);
      if (inCooldown) {
        return null;
      }

      // 按优先级检测各场景
      const scenarios = [
        () => this.checkNoQuota(userId),
        () => this.checkOnlyPickup(userId),
        () => this.checkFrequentAbandon(userId),
        () => this.checkEmptyArea(userId),
        () => this.checkNewUser(userId),
        () => this.checkGpsPoor(userId)
      ];

      for (const checkScenario of scenarios) {
        const guidance = await checkScenario();
        if (guidance) {
          // 设置冷却
          await this.setCooldown(userId);
          return guidance;
        }
      }

      return null;
    } catch (error) {
      Logger.error('Get guidance failed:', error);
      return null;
    }
  }

  /**
   * 场景1: 配额用完
   */
  static async checkNoQuota(userId) {
    try {
      const quota = await quotaService.getQuota(userId);

      if (quota.total_pickup_available === 0 && quota.total_throw_available === 0) {
        return {
          scenarioKey: GUIDANCE_SCENARIOS.NO_QUOTA,
          messageKey: 'drift_bottle.guidance.no_quota',
          priority: 1,
          data: {
            pixelsNeeded: quota.pixels_for_next_bottle,
            resetTime: quota.reset_time
          }
        };
      }

      return null;
    } catch (error) {
      Logger.error('Check no quota scenario failed:', error);
      return null;
    }
  }

  /**
   * 场景2: 只拾取不抛出
   */
  static async checkOnlyPickup(userId) {
    try {
      const pickupCount = await quotaService.getTodayPickupCount(userId);
      const throwCount = await quotaService.getTodayThrowCount(userId);

      // 拾取>=5次且从未抛出
      if (pickupCount >= ONLY_PICKUP_THRESHOLD && throwCount === 0) {
        return {
          scenarioKey: GUIDANCE_SCENARIOS.ONLY_PICKUP,
          messageKey: 'drift_bottle.guidance.only_pickup',
          priority: 2,
          data: {
            pickupCount,
            bonusPerThrow: quotaService.PICKUP_BONUS_PER_THROW
          }
        };
      }

      return null;
    } catch (error) {
      Logger.error('Check only pickup scenario failed:', error);
      return null;
    }
  }

  /**
   * 场景3: 频繁放弃
   */
  static async checkFrequentAbandon(userId) {
    try {
      const abandonCount = await this.getRecentAbandonCount(userId);

      if (abandonCount >= ABANDON_THRESHOLD) {
        return {
          scenarioKey: GUIDANCE_SCENARIOS.FREQUENT_ABANDON,
          messageKey: 'drift_bottle.guidance.frequent_abandon',
          priority: 3,
          data: {
            abandonCount
          }
        };
      }

      return null;
    } catch (error) {
      Logger.error('Check frequent abandon scenario failed:', error);
      return null;
    }
  }

  /**
   * 场景4: 空区域（连续多次搜索无结果）
   */
  static async checkEmptyArea(userId) {
    try {
      const emptyCount = await this.getRecentEmptySearchCount(userId);

      if (emptyCount >= EMPTY_SEARCH_THRESHOLD) {
        return {
          scenarioKey: GUIDANCE_SCENARIOS.EMPTY_AREA,
          messageKey: 'drift_bottle.guidance.empty_area',
          priority: 4,
          data: {
            emptyCount
          }
        };
      }

      return null;
    } catch (error) {
      Logger.error('Check empty area scenario failed:', error);
      return null;
    }
  }

  /**
   * 场景5: 新手引导
   */
  static async checkNewUser(userId) {
    try {
      const pickupCount = await quotaService.getTodayPickupCount(userId);
      const throwCount = await quotaService.getTodayThrowCount(userId);
      const totalActions = pickupCount + throwCount;

      // 新手：总操作在2-3次之间
      if (totalActions >= NEW_USER_PICKUP_THRESHOLD && totalActions <= 3) {
        const hasShownBefore = await this.hasShownNewUserGuidance(userId);
        if (!hasShownBefore) {
          await this.markNewUserGuidanceShown(userId);
          return {
            scenarioKey: GUIDANCE_SCENARIOS.NEW_USER,
            messageKey: 'drift_bottle.guidance.new_user',
            priority: 5,
            data: {
              totalActions
            }
          };
        }
      }

      return null;
    } catch (error) {
      Logger.error('Check new user scenario failed:', error);
      return null;
    }
  }

  /**
   * 场景6: GPS质量差
   */
  static async checkGpsPoor(userId) {
    try {
      const recentPoorGps = await this.getRecentPoorGpsCount(userId);

      if (recentPoorGps >= 2) {
        return {
          scenarioKey: GUIDANCE_SCENARIOS.GPS_POOR,
          messageKey: 'drift_bottle.guidance.gps_poor',
          priority: 6,
          data: {
            poorGpsCount: recentPoorGps
          }
        };
      }

      return null;
    } catch (error) {
      Logger.error('Check GPS poor scenario failed:', error);
      return null;
    }
  }

  /**
   * 记录空搜索
   */
  static async recordEmptySearch(userId) {
    try {
      const key = `drift_bottle:empty_search:${userId}`;
      const count = await redisUtils.incr(key);
      await redisUtils.expire(key, 3600); // 1小时内有效
      Logger.info(`📊 User ${userId} empty search count: ${count}`);
    } catch (error) {
      Logger.error('Record empty search failed:', error);
    }
  }

  /**
   * 记录锁定瓶子（成功搜索，清空空搜索计数）
   */
  static async recordSuccessfulSearch(userId) {
    try {
      const key = `drift_bottle:empty_search:${userId}`;
      await redisUtils.del(key);
    } catch (error) {
      Logger.error('Record successful search failed:', error);
    }
  }

  /**
   * 记录放弃瓶子
   */
  static async recordAbandon(userId) {
    try {
      const key = `drift_bottle:abandon:${userId}`;
      const count = await redisUtils.incr(key);
      await redisUtils.expire(key, 1800); // 30分钟内有效
      Logger.info(`📊 User ${userId} abandon count: ${count}`);
    } catch (error) {
      Logger.error('Record abandon failed:', error);
    }
  }

  /**
   * 记录成功拾取（清空放弃计数）
   */
  static async recordSuccessfulPickup(userId) {
    try {
      const key = `drift_bottle:abandon:${userId}`;
      await redisUtils.del(key);
    } catch (error) {
      Logger.error('Record successful pickup failed:', error);
    }
  }

  /**
   * 记录GPS质量差
   */
  static async recordPoorGps(userId) {
    try {
      const key = `drift_bottle:poor_gps:${userId}`;
      const count = await redisUtils.incr(key);
      await redisUtils.expire(key, 1800); // 30分钟内有效
      Logger.info(`📊 User ${userId} poor GPS count: ${count}`);
    } catch (error) {
      Logger.error('Record poor GPS failed:', error);
    }
  }

  /**
   * 清除GPS质量差记录
   */
  static async clearPoorGps(userId) {
    try {
      const key = `drift_bottle:poor_gps:${userId}`;
      await redisUtils.del(key);
    } catch (error) {
      Logger.error('Clear poor GPS failed:', error);
    }
  }

  // ─── Redis辅助函数 ───────────────────────────────────────

  /**
   * 检查是否在冷却期
   */
  static async isInCooldown(userId) {
    const key = `drift_bottle:guidance_cooldown:${userId}`;
    const exists = await redisUtils.exists(key);
    return exists > 0;
  }

  /**
   * 设置冷却期
   */
  static async setCooldown(userId) {
    const key = `drift_bottle:guidance_cooldown:${userId}`;
    await redisUtils.setex(key, GUIDANCE_COOLDOWN, '1');
  }

  /**
   * 获取近期空搜索次数
   */
  static async getRecentEmptySearchCount(userId) {
    const key = `drift_bottle:empty_search:${userId}`;
    const count = await redisUtils.get(key);
    return count ? parseInt(count) : 0;
  }

  /**
   * 获取近期放弃次数
   */
  static async getRecentAbandonCount(userId) {
    const key = `drift_bottle:abandon:${userId}`;
    const count = await redisUtils.get(key);
    return count ? parseInt(count) : 0;
  }

  /**
   * 获取近期GPS质量差次数
   */
  static async getRecentPoorGpsCount(userId) {
    const key = `drift_bottle:poor_gps:${userId}`;
    const count = await redisUtils.get(key);
    return count ? parseInt(count) : 0;
  }

  /**
   * 检查是否已显示过新手引导
   */
  static async hasShownNewUserGuidance(userId) {
    const key = `drift_bottle:new_user_guidance:${userId}`;
    const exists = await redisUtils.exists(key);
    return exists > 0;
  }

  /**
   * 标记新手引导已显示
   */
  static async markNewUserGuidanceShown(userId) {
    const key = `drift_bottle:new_user_guidance:${userId}`;
    // 永久标记（或设置长期过期，如30天）
    await redisUtils.setex(key, 30 * 24 * 3600, '1');
  }
}

module.exports = BottleGuidanceService;
