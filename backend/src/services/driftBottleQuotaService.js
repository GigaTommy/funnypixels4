/**
 * 漂流瓶配额管理服务
 * 处理每日配额、画像素奖励、抛瓶奖励、消耗逻辑
 */

const { db } = require('../config/database');
const Logger = require('../utils/logger');
const { redisUtils } = require('../config/redis');

const DAILY_FREE_QUOTA = 5;        // 每日免费次数
const PIXELS_PER_BOTTLE = 50;      // 每50像素奖励1个瓶子
const PICKUP_BONUS_PER_THROW = 2;  // 每抛1个瓶子获得2次额外拾取机会

/**
 * 获取用户漂流瓶配额（包含抛瓶奖励）
 * @param {string} userId
 * @returns {Promise<Object>} 配额信息
 */
async function getQuota(userId) {
  const today = getCurrentDate();

  try {
    // 1. 查询或创建今日使用记录
    let dailyUsage = await db('drift_bottle_daily_usage')
      .where({ user_id: userId, date: today })
      .first();

    if (!dailyUsage) {
      await db('drift_bottle_daily_usage').insert({
        user_id: userId,
        date: today,
        used: 0,
        created_at: db.fn.now()
      });
      dailyUsage = { used: 0 };
    }

    const dailyUsed = dailyUsage.used || 0;
    const dailyRemaining = Math.max(0, DAILY_FREE_QUOTA - dailyUsed);

    // 2. 计算画像素奖励
    const user = await db('users')
      .where({ id: userId })
      .select('total_pixels', 'drift_bottle_pixels_redeemed')
      .first();

    const totalPixels = user?.total_pixels || 0;
    const redeemed = user?.drift_bottle_pixels_redeemed || 0;
    const unredeemed = totalPixels - redeemed;
    const earnedFromPixels = Math.floor(unredeemed / PIXELS_PER_BOTTLE);
    const pixelsForNextBottle = PIXELS_PER_BOTTLE - (unredeemed % PIXELS_PER_BOTTLE);

    // 3. 从Redis获取今日抛瓶和拾取统计
    const throwCount = await getTodayThrowCount(userId);
    const pickupCount = await getTodayPickupCount(userId);
    const bonusFromThrow = throwCount * PICKUP_BONUS_PER_THROW;
    const bonusUsed = Math.min(pickupCount, bonusFromThrow);
    const bonusRemaining = Math.max(0, bonusFromThrow - bonusUsed);

    // 4. 计算总可用数（拾取配额 = 每日免费 + 抛瓶奖励）
    const totalPickupAvailable = dailyRemaining + bonusRemaining;
    const totalThrowAvailable = earnedFromPixels; // 抛瓶仅依赖画像素

    // 5. 下次重置时间（明天0点）
    const resetTime = getNextDayResetTime();

    // 6. 计算提示消息key
    let hintKey = null;
    if (totalPickupAvailable === 0 && totalThrowAvailable === 0) {
      hintKey = 'drift_bottle.quota.no_quota';
    } else if (totalPickupAvailable === 0 && totalThrowAvailable > 0) {
      hintKey = 'drift_bottle.quota.can_only_throw';
    } else if (totalPickupAvailable > 0 && totalThrowAvailable === 0) {
      hintKey = 'drift_bottle.quota.can_only_pickup';
    }

    return {
      daily_free: DAILY_FREE_QUOTA,
      daily_used: dailyUsed,
      daily_remaining: dailyRemaining,
      bonus_from_pixels: earnedFromPixels,
      total_available: totalThrowAvailable, // iOS兼容字段（抛瓶配额）
      bonus_from_throw: bonusRemaining,
      throw_count_today: throwCount,
      pickup_count_today: pickupCount,
      total_pickup_available: totalPickupAvailable,
      total_throw_available: totalThrowAvailable,
      pixels_for_next_bottle: pixelsForNextBottle,
      reset_time: resetTime,
      hint_key: hintKey
    };

  } catch (error) {
    Logger.error('Get quota failed:', error);
    throw error;
  }
}

/**
 * 消耗抛瓶配额（仅画像素奖励）
 * @param {string} userId
 * @param {Object} trx 事务对象
 * @returns {Promise<Object>} 消耗结果 { source, remaining, messageKey }
 */
async function consumeThrowQuota(userId, trx) {
  try {
    // 检查画像素奖励
    const user = await (trx || db)('users')
      .where({ id: userId })
      .select('total_pixels', 'drift_bottle_pixels_redeemed')
      .first();

    if (!user) {
      throw new Error('drift_bottle.error.user_not_found');
    }

    const totalPixels = user.total_pixels || 0;
    const redeemed = user.drift_bottle_pixels_redeemed || 0;
    const unredeemed = totalPixels - redeemed;
    const available = Math.floor(unredeemed / PIXELS_PER_BOTTLE);

    if (available > 0) {
      // 消耗画像素奖励
      const newRedeemed = redeemed + PIXELS_PER_BOTTLE;
      await (trx || db)('users')
        .where({ id: userId })
        .update({ drift_bottle_pixels_redeemed: newRedeemed });

      // 增加今日抛瓶计数
      await incrementTodayThrowCount(userId);

      const remaining = available - 1;
      Logger.info(`✅ Consumed throw quota for user ${userId}. Remaining: ${remaining}`);

      return {
        source: 'pixel_bonus',
        remaining,
        messageKey: 'drift_bottle.throw.success'
      };
    }

    // 无可用配额
    throw new Error('drift_bottle.error.no_throw_quota');

  } catch (error) {
    Logger.error('Consume throw quota failed:', error);
    throw error;
  }
}

/**
 * 消耗拾取配额
 * 优先级：每日免费 > 抛瓶奖励
 * @param {string} userId
 * @param {Object} trx 事务对象
 * @returns {Promise<Object>} 消耗结果 { source, remaining, messageKey }
 */
async function consumePickupQuota(userId, trx) {
  const today = getCurrentDate();

  try {
    // 1. 检查每日免费配额
    const dailyUsage = await (trx || db)('drift_bottle_daily_usage')
      .where({ user_id: userId, date: today })
      .first();

    if (dailyUsage && dailyUsage.used < DAILY_FREE_QUOTA) {
      // 消耗每日免费配额
      await (trx || db)('drift_bottle_daily_usage')
        .where({ user_id: userId, date: today })
        .increment('used', 1);

      // 增加今日拾取计数
      await incrementTodayPickupCount(userId);

      const remaining = DAILY_FREE_QUOTA - (dailyUsage.used + 1);
      Logger.info(`✅ Consumed daily pickup quota for user ${userId}. Remaining: ${remaining}`);

      return {
        source: 'daily_free',
        remaining,
        messageKey: 'drift_bottle.pickup.success'
      };
    }

    // 2. 检查抛瓶奖励
    const throwCount = await getTodayThrowCount(userId);
    const pickupCount = await getTodayPickupCount(userId);
    const bonusAvailable = throwCount * PICKUP_BONUS_PER_THROW;
    const bonusUsed = pickupCount;

    if (bonusUsed < bonusAvailable) {
      // 消耗抛瓶奖励
      await incrementTodayPickupCount(userId);

      const remaining = bonusAvailable - bonusUsed - 1;
      Logger.info(`✅ Consumed throw bonus for user ${userId}. Remaining: ${remaining}`);

      return {
        source: 'throw_bonus',
        remaining,
        messageKey: 'drift_bottle.pickup.success'
      };
    }

    // 3. 无可用配额
    throw new Error('drift_bottle.error.no_pickup_quota');

  } catch (error) {
    Logger.error('Consume pickup quota failed:', error);
    throw error;
  }
}

/**
 * 检查用户是否有抛瓶配额
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
async function hasThrowQuota(userId) {
  const quota = await getQuota(userId);
  return quota.total_throw_available > 0;
}

/**
 * 检查用户是否有拾取配额
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
async function hasPickupQuota(userId) {
  const quota = await getQuota(userId);
  return quota.total_pickup_available > 0;
}

/**
 * Redis辅助函数 - 获取今日抛瓶次数
 * Redis不可用时返回0（降级模式）
 */
async function getTodayThrowCount(userId) {
  try {
    const today = getCurrentDate();
    const key = `drift_bottle:throw_count:${userId}:${today}`;
    const count = await redisUtils.get(key);
    return count ? parseInt(count) : 0;
  } catch (error) {
    Logger.warn(`Redis unavailable for getTodayThrowCount: ${error.message}`);
    return 0;
  }
}

/**
 * Redis辅助函数 - 增加今日抛瓶次数
 * Redis不可用时静默失败
 */
async function incrementTodayThrowCount(userId) {
  try {
    const today = getCurrentDate();
    const key = `drift_bottle:throw_count:${userId}:${today}`;
    const tomorrow = getNextDayResetTime();
    const ttl = Math.floor((new Date(tomorrow) - new Date()) / 1000);

    await redisUtils.incr(key);
    await redisUtils.expire(key, ttl);
  } catch (error) {
    Logger.warn(`Redis unavailable for incrementTodayThrowCount: ${error.message}`);
  }
}

/**
 * Redis辅助函数 - 获取今日拾取次数
 * Redis不可用时返回0（降级模式）
 */
async function getTodayPickupCount(userId) {
  try {
    const today = getCurrentDate();
    const key = `drift_bottle:pickup_count:${userId}:${today}`;
    const count = await redisUtils.get(key);
    return count ? parseInt(count) : 0;
  } catch (error) {
    Logger.warn(`Redis unavailable for getTodayPickupCount: ${error.message}`);
    return 0;
  }
}

/**
 * Redis辅助函数 - 增加今日拾取次数
 * Redis不可用时静默失败
 */
async function incrementTodayPickupCount(userId) {
  try {
    const today = getCurrentDate();
    const key = `drift_bottle:pickup_count:${userId}:${today}`;
    const tomorrow = getNextDayResetTime();
    const ttl = Math.floor((new Date(tomorrow) - new Date()) / 1000);

    await redisUtils.incr(key);
    await redisUtils.expire(key, ttl);
  } catch (error) {
    Logger.warn(`Redis unavailable for incrementTodayPickupCount: ${error.message}`);
  }
}

/**
 * 重置所有用户的每日配额（定时任务调用）
 * @returns {Promise<number>} 重置的记录数
 */
async function resetDailyQuota() {
  const today = getCurrentDate();
  const yesterday = getYesterdayDate();

  try {
    // 删除昨天及之前的记录（可选，也可以保留用于统计）
    const deleted = await db('drift_bottle_daily_usage')
      .where('date', '<', today)
      .del();

    Logger.info(`🔄 Daily quota reset: ${deleted} old records deleted`);
    return deleted;

  } catch (error) {
    Logger.error('Reset daily quota failed:', error);
    throw error;
  }
}

/**
 * 获取当前日期字符串 (YYYY-MM-DD)
 * @returns {string}
 */
function getCurrentDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 获取昨天日期字符串
 * @returns {string}
 */
function getYesterdayDate() {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 获取下次重置时间（明天0点）
 * @returns {string} ISO 8601格式
 */
function getNextDayResetTime() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow.toISOString();
}

module.exports = {
  getQuota,
  consumeThrowQuota,
  consumePickupQuota,
  hasThrowQuota,
  hasPickupQuota,
  resetDailyQuota,
  getTodayThrowCount,
  getTodayPickupCount,
  DAILY_FREE_QUOTA,
  PIXELS_PER_BOTTLE,
  PICKUP_BONUS_PER_THROW
};
