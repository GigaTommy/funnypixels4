const { db } = require('../config/database');
const Achievement = require('./Achievement');
const CheckinRewardConfig = require('./CheckinRewardConfig');
const UserPoints = require('./UserPoints');

class DailyCheckin {
  constructor(data) {
    this.id = data.id;
    this.user_id = data.user_id;
    this.checkin_date = data.checkin_date;
    this.consecutive_days = data.consecutive_days;
    this.reward_points = data.reward_points;
    this.reward_items = typeof data.reward_items === 'string'
      ? JSON.parse(data.reward_items)
      : data.reward_items;
    this.is_claimed = data.is_claimed;
    this.claimed_at = data.claimed_at;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  // 用户签到
  static async checkin(userId) {
    const today = new Date().toISOString().split('T')[0];

    // 检查今天是否已经签到
    const existingCheckin = await db('user_checkins')
      .where('user_id', userId)
      .where('checkin_date', today)
      .first();

    if (existingCheckin) {
      throw new Error('ALREADY_CHECKED_IN_TODAY');
    }

    // 获取昨天的签到记录
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const yesterdayCheckin = await db('user_checkins')
      .where('user_id', userId)
      .where('checkin_date', yesterdayStr)
      .first();

    // 计算连续签到天数
    const consecutiveDays = yesterdayCheckin ? yesterdayCheckin.consecutive_days + 1 : 1;

    // Try to calculate reward from config
    let rewardPoints, rewardItems;
    try {
      const configReward = await CheckinRewardConfig.calculateReward(consecutiveDays);
      if (configReward) {
        rewardPoints = configReward.rewardPoints;
        rewardItems = configReward.rewardItems;
      }
    } catch (e) {
      // Config table may not exist yet, fall through to hardcoded
    }

    // Fallback to hardcoded logic if no config
    if (rewardPoints === undefined) {
      const baseReward = 10;
      let multiplier = 1;
      if (consecutiveDays % 30 === 0) {
        multiplier = 10;
      } else if (consecutiveDays % 7 === 0) {
        multiplier = 3;
      }
      const bonusReward = Math.floor(consecutiveDays / 7) * 5;
      rewardPoints = (baseReward + bonusReward) * multiplier;

      rewardItems = [];
      if (consecutiveDays === 7) {
        rewardItems.push(7);
      } else if (consecutiveDays === 30) {
        rewardItems.push(10);
      }
    }

    // 开始事务
    const [checkin] = await db.transaction(async (trx) => {
      // 创建签到记录
      const [newCheckin] = await trx('user_checkins')
        .insert({
          user_id: userId,
          checkin_date: today,
          consecutive_days: consecutiveDays,
          reward_points: rewardPoints,
          reward_items: JSON.stringify(rewardItems),
          is_claimed: false
        })
        .returning('*');

      // 添加奖励道具到用户库存
      for (const itemId of rewardItems) {
        const existingInventory = await trx('user_inventory')
          .where('user_id', userId)
          .where('item_id', itemId)
          .first();

        if (existingInventory) {
          await trx('user_inventory')
            .where('user_id', userId)
            .where('item_id', itemId)
            .increment('quantity', 1);
        } else {
          await trx('user_inventory').insert({
            user_id: userId,
            item_id: itemId,
            quantity: 1
          });
        }
      }

      // 标记奖励已领取
      await trx('user_checkins')
        .where('id', newCheckin.id)
        .update({
          is_claimed: true,
          claimed_at: trx.fn.now()
        });

      // 触发成就：活跃天数（连续签到天数）
      await Achievement.updateUserStats(userId, { days_active_count: consecutiveDays });

      return [newCheckin];
    });

    // 通过 UserPoints 正确发放积分（写入 user_points + wallet_ledger）
    await UserPoints.addPoints(userId, rewardPoints, '每日签到奖励', `checkin_${checkin.id}`);

    return new DailyCheckin({
      ...checkin,
      is_claimed: true,
      claimed_at: checkin.created_at
    });
  }

  // 获取用户签到记录
  static async getUserCheckins(userId, limit = 30) {
    const checkins = await db('user_checkins')
      .where('user_id', userId)
      .orderBy('checkin_date', 'desc')
      .limit(limit);

    return checkins.map(checkin => new DailyCheckin(checkin));
  }

  // 获取用户签到统计
  static async getUserCheckinStats(userId) {
    const stats = await db('user_checkins')
      .where('user_id', userId)
      .select(
        db.raw('COUNT(*) as total_checkins'),
        db.raw('MAX(consecutive_days) as max_consecutive_days'),
        db.raw('SUM(reward_points) as total_reward_points')
      )
      .first();

    // 获取当前连续签到天数
    const today = new Date().toISOString().split('T')[0];
    const todayCheckin = await db('user_checkins')
      .where('user_id', userId)
      .where('checkin_date', today)
      .first();

    const currentConsecutiveDays = todayCheckin ? todayCheckin.consecutive_days : 0;

    return {
      total_checkins: parseInt(stats.total_checkins) || 0,
      max_consecutive_days: parseInt(stats.max_consecutive_days) || 0,
      current_consecutive_days: currentConsecutiveDays,
      total_reward_points: parseInt(stats.total_reward_points) || 0
    };
  }

  // 检查今天是否可以签到
  static async canCheckinToday(userId) {
    const today = new Date().toISOString().split('T')[0];

    const existingCheckin = await db('user_checkins')
      .where('user_id', userId)
      .where('checkin_date', today)
      .first();

    return !existingCheckin;
  }

  // 获取本月签到记录
  static async getMonthlyCheckins(userId, year, month) {
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;

    const checkins = await db('user_checkins')
      .where('user_id', userId)
      .where('checkin_date', '>=', startDate)
      .where('checkin_date', '<=', endDate)
      .orderBy('checkin_date', 'asc');

    return checkins.map(checkin => new DailyCheckin(checkin));
  }

  // 获取签到日历数据
  static async getCheckinCalendar(userId, year, month) {
    const checkins = await this.getMonthlyCheckins(userId, year, month);

    // 创建日历数据
    const calendar = [];
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      const checkin = checkins.find(c => c.checkin_date === date);

      calendar.push({
        date: date,
        day: day,
        is_checked: !!checkin,
        consecutive_days: checkin ? checkin.consecutive_days : 0,
        reward_points: checkin ? checkin.reward_points : 0
      });
    }

    return calendar;
  }
  // Streak recovery: allows user to recover a broken streak once per month
  static async recoverStreak(userId) {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Check if already checked in today
    const todayCheckin = await db('user_checkins')
      .where('user_id', userId)
      .where('checkin_date', todayStr)
      .first();

    if (todayCheckin) {
      throw new Error('ALREADY_CHECKED_IN_TODAY');
    }

    // Check yesterday and day-before-yesterday
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const dayBefore = new Date(today);
    dayBefore.setDate(dayBefore.getDate() - 2);
    const dayBeforeStr = dayBefore.toISOString().split('T')[0];

    const yesterdayCheckin = await db('user_checkins')
      .where('user_id', userId)
      .where('checkin_date', yesterdayStr)
      .first();

    // If yesterday was checked in, streak isn't broken
    if (yesterdayCheckin) {
      throw new Error('STREAK_NOT_BROKEN');
    }

    // Need a check-in from day-before-yesterday to have a streak to recover
    const dayBeforeCheckin = await db('user_checkins')
      .where('user_id', userId)
      .where('checkin_date', dayBeforeStr)
      .first();

    if (!dayBeforeCheckin || dayBeforeCheckin.consecutive_days < 2) {
      throw new Error('NO_STREAK_TO_RECOVER');
    }

    // Check if recovery was already used this month
    const monthStart = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-01`;
    const existingRecovery = await db('user_checkins')
      .where('user_id', userId)
      .where('checkin_date', '>=', monthStart)
      .where('is_recovery', true)
      .first();

    if (existingRecovery) {
      throw new Error('RECOVERY_ALREADY_USED_THIS_MONTH');
    }

    // Insert a recovery check-in for yesterday (preserves streak)
    const recoveredConsecutive = dayBeforeCheckin.consecutive_days + 1;
    const [recovery] = await db('user_checkins')
      .insert({
        user_id: userId,
        checkin_date: yesterdayStr,
        consecutive_days: recoveredConsecutive,
        reward_points: 0, // No reward for recovery day
        reward_items: JSON.stringify([]),
        is_claimed: true,
        is_recovery: true,
        claimed_at: db.fn.now()
      })
      .returning('*');

    return new DailyCheckin(recovery);
  }

  // Check if streak recovery is available
  static async canRecoverStreak(userId) {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const dayBefore = new Date(today);
    dayBefore.setDate(dayBefore.getDate() - 2);
    const dayBeforeStr = dayBefore.toISOString().split('T')[0];

    // Check if streak is broken
    const yesterdayCheckin = await db('user_checkins')
      .where('user_id', userId)
      .where('checkin_date', yesterdayStr)
      .first();

    if (yesterdayCheckin) return { canRecover: false, reason: 'STREAK_NOT_BROKEN' };

    const dayBeforeCheckin = await db('user_checkins')
      .where('user_id', userId)
      .where('checkin_date', dayBeforeStr)
      .first();

    if (!dayBeforeCheckin || dayBeforeCheckin.consecutive_days < 2) {
      return { canRecover: false, reason: 'NO_STREAK_TO_RECOVER' };
    }

    // Check monthly limit
    const monthStart = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-01`;
    const existingRecovery = await db('user_checkins')
      .where('user_id', userId)
      .where('checkin_date', '>=', monthStart)
      .where('is_recovery', true)
      .first();

    if (existingRecovery) {
      return { canRecover: false, reason: 'RECOVERY_ALREADY_USED_THIS_MONTH' };
    }

    return {
      canRecover: true,
      lostStreak: dayBeforeCheckin.consecutive_days,
      missedDate: yesterdayStr
    };
  }
}

module.exports = DailyCheckin;
