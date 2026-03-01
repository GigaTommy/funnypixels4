const Achievement = require('../models/Achievement');
const DailyCheckin = require('../models/DailyCheckin');
const User = require('../models/User');

class CurrencyController {
  // 获取用户积分
  static async getUserPoints(req, res) {
    try {
      const userId = req.user.id;
      const user = await User.findById(userId);

      res.json({
        success: true,
        data: {
          points: await User.getUserPoints(user.id)
        }
      });
    } catch (error) {
      console.error('获取用户积分失败:', error);
      res.status(500).json({
        success: false,
        message: '获取用户积分失败',
        error: error.message
      });
    }
  }

  // 获取所有成就
  static async getAllAchievements(req, res) {
    try {
      const achievements = await Achievement.getAllAchievements();

      res.json({
        success: true,
        data: achievements
      });
    } catch (error) {
      console.error('获取所有成就失败:', error);
      res.status(500).json({
        success: false,
        message: '获取所有成就失败',
        error: error.message
      });
    }
  }

  // 获取用户成就
  static async getUserAchievements(req, res) {
    try {
      const userId = req.user.id;
      const userAchievements = await Achievement.getUserAchievements(userId);

      res.json({
        success: true,
        data: userAchievements
      });
    } catch (error) {
      console.error('获取用户成就失败:', error);
      res.status(500).json({
        success: false,
        message: '获取用户成就失败',
        error: error.message
      });
    }
  }

  // 获取用户已完成的成就
  static async getUserCompletedAchievements(req, res) {
    try {
      const userId = req.user.id;
      const completedAchievements = await Achievement.getUserCompletedAchievements(userId);

      res.json({
        success: true,
        data: completedAchievements
      });
    } catch (error) {
      console.error('获取用户已完成成就失败:', error);
      res.status(500).json({
        success: false,
        message: '获取用户已完成成就失败',
        error: error.message
      });
    }
  }

  // 领取成就奖励
  static async claimAchievementReward(req, res) {
    try {
      const userId = req.user.id;
      const { achievementId } = req.params;

      const reward = await Achievement.claimAchievementReward(userId, achievementId);

      res.json({
        success: true,
        message: '成就奖励领取成功',
        reward: reward
      });
    } catch (error) {
      console.error('领取成就奖励失败:', error);
      res.status(500).json({
        success: false,
        message: '领取成就奖励失败',
        error: error.message
      });
    }
  }

  // 获取用户成就统计
  static async getUserAchievementStats(req, res) {
    try {
      const userId = req.user.id;
      const stats = await Achievement.getUserAchievementStats(userId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('获取用户成就统计失败:', error);
      res.status(500).json({
        success: false,
        message: '获取用户成就统计失败',
        error: error.message
      });
    }
  }

  // 获取用户成就高亮推荐
  static async getUserAchievementHighlights(req, res) {
    try {
      const userId = req.user.id;
      const highlights = await Achievement.getUserAchievementHighlights(userId);

      res.json({
        success: true,
        data: highlights
      });
    } catch (error) {
      console.error('获取用户成就推荐失败:', error);
      res.status(500).json({
        success: false,
        message: '获取用户成就推荐失败',
        error: error.message
      });
    }
  }

  // 用户签到
  static async dailyCheckin(req, res) {
    try {
      const userId = req.user.id;
      const checkin = await DailyCheckin.checkin(userId);

      // 每日任务进度：签到类型
      try {
        const DailyTaskController = require('./dailyTaskController');
        await DailyTaskController.updateTaskProgress(userId, 'checkin', 1);
      } catch (taskErr) {
        console.error('更新每日任务进度失败（不影响签到）:', taskErr.message);
      }

      res.json({
        success: true,
        message: '签到成功',
        checkin: checkin
      });
    } catch (error) {
      console.error('签到失败:', error);
      res.status(500).json({
        success: false,
        message: '签到失败',
        error: error.message
      });
    }
  }

  // 获取用户签到记录
  static async getUserCheckins(req, res) {
    try {
      const userId = req.user.id;
      const limit = parseInt(req.query.limit) || 30;
      const checkins = await DailyCheckin.getUserCheckins(userId, limit);

      res.json({
        success: true,
        checkins: checkins
      });
    } catch (error) {
      console.error('获取用户签到记录失败:', error);
      res.status(500).json({
        success: false,
        message: '获取用户签到记录失败',
        error: error.message
      });
    }
  }

  // 获取用户签到统计
  static async getUserCheckinStats(req, res) {
    try {
      const userId = req.user.id;
      const stats = await DailyCheckin.getUserCheckinStats(userId);

      // 7-day cycle: position within current week cycle (resets on streak break)
      const currentStreak = stats.current_consecutive_days || 0;
      const cycleDay = currentStreak > 0 ? ((currentStreak - 1) % 7) + 1 : 0;
      const weekRewards = [];
      const baseReward = 10;
      for (let i = 1; i <= 7; i++) {
        const bonus = Math.floor(i / 7) * 5;
        const isDay7 = i === 7;
        const dayReward = isDay7 ? (baseReward + bonus) * 3 : baseReward + bonus;
        weekRewards.push({
          day: i,
          reward: dayReward,
          is_collected: i <= cycleDay,
          is_current: i === cycleDay + 1,
          is_bonus_day: isDay7
        });
      }

      // Milestones: 30/90/180/365
      const totalCheckins = stats.total_checkins || 0;
      const milestoneTargets = [
        { target: 30, reward: 100, icon: 'star.fill' },
        { target: 90, reward: 300, icon: 'star.circle.fill' },
        { target: 180, reward: 600, icon: 'crown.fill' },
        { target: 365, reward: 1500, icon: 'trophy.fill' }
      ];
      const milestones = milestoneTargets.map(m => ({
        target: m.target,
        current: Math.min(totalCheckins, m.target),
        reward: m.reward,
        icon: m.icon,
        is_completed: totalCheckins >= m.target,
        progress: Math.min(totalCheckins / m.target, 1.0)
      }));

      res.json({
        success: true,
        stats: stats,
        week_rewards: weekRewards,
        milestones: milestones,
        cycle_day: cycleDay
      });
    } catch (error) {
      console.error('获取用户签到统计失败:', error);
      res.status(500).json({
        success: false,
        message: '获取用户签到统计失败',
        error: error.message
      });
    }
  }

  // 检查今天是否可以签到
  static async canCheckinToday(req, res) {
    try {
      const userId = req.user.id;
      const canCheckin = await DailyCheckin.canCheckinToday(userId);

      res.json({
        success: true,
        canCheckin: canCheckin
      });
    } catch (error) {
      console.error('检查签到状态失败:', error);
      res.status(500).json({
        success: false,
        message: '检查签到状态失败',
        error: error.message
      });
    }
  }

  // 获取签到日历
  static async getCheckinCalendar(req, res) {
    try {
      const userId = req.user.id;
      const { year, month } = req.query;

      if (!year || !month) {
        return res.status(400).json({
          success: false,
          message: '年份和月份参数必需'
        });
      }

      const calendar = await DailyCheckin.getCheckinCalendar(userId, parseInt(year), parseInt(month));

      res.json({
        success: true,
        calendar: calendar
      });
    } catch (error) {
      console.error('获取签到日历失败:', error);
      res.status(500).json({
        success: false,
        message: '获取签到日历失败',
        error: error.message
      });
    }
  }

  // Check if streak recovery is available
  static async canRecoverStreak(req, res) {
    try {
      const userId = req.user.id;
      const result = await DailyCheckin.canRecoverStreak(userId);
      res.json({ success: true, ...result });
    } catch (error) {
      console.error('Failed to check recovery status:', error);
      res.status(500).json({ success: false, message: 'CHECK_RECOVERY_FAILED', error: error.message });
    }
  }

  // Recover a broken streak
  static async recoverStreak(req, res) {
    try {
      const userId = req.user.id;
      const recovery = await DailyCheckin.recoverStreak(userId);
      res.json({ success: true, message: 'STREAK_RECOVERED', recovery });
    } catch (error) {
      console.error('Failed to recover streak:', error);
      const status = error.message.includes('ALREADY') || error.message.includes('NOT_BROKEN') || error.message.includes('NO_STREAK') ? 400 : 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  // 更新用户成就进度（内部使用）
  static async updateAchievementProgress(userId, achievementId, progress) {
    try {
      const result = await Achievement.updateUserAchievementProgress(userId, achievementId, progress);
      return result;
    } catch (error) {
      console.error('更新成就进度失败:', error);
      return null;
    }
  }

  // 初始化用户成就（新用户注册时调用）
  static async initializeUserAchievements(userId) {
    try {
      await Achievement.initializeUserAchievements(userId);
      return true;
    } catch (error) {
      console.error('初始化用户成就失败:', error);
      return false;
    }
  }
}

module.exports = CurrencyController;
