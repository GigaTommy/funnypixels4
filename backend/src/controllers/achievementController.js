const Achievement = require('../models/Achievement');

class AchievementController {
  // 获取用户成就统计
  static async getUserStats(req, res) {
    try {
      const { userId } = req.params;
      const requesterId = req.user.id;

      // 如果不是查看自己的成就，可能需要权限检查
      // 这里暂时允许查看所有用户的成就统计
      const stats = await Achievement.getUserStats(userId);

      if (!stats) {
        return res.status(404).json({
          success: false,
          message: '用户成就数据不存在'
        });
      }

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

  // 获取用户已解锁的成就
  static async getUserAchievements(req, res) {
    try {
      const { userId } = req.params;

      const achievements = await Achievement.getUserAchievements(userId);

      res.json({
        success: true,
        data: achievements
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

  // 获取所有成就定义
  static async getAllAchievements(req, res) {
    try {
      const { category } = req.query;

      const achievements = await Achievement.getAllAchievements(category);

      res.json({
        success: true,
        data: achievements
      });
    } catch (error) {
      console.error('获取成就定义失败:', error);
      res.status(500).json({
        success: false,
        message: '获取成就定义失败',
        error: error.message
      });
    }
  }

  // 获取成就排行榜
  static async getAchievementLeaderboard(req, res) {
    try {
      const { type = 'like_received_count', limit = 50 } = req.query;

      const leaderboard = await Achievement.getAchievementLeaderboard(
        type,
        parseInt(limit)
      );

      res.json({
        success: true,
        data: leaderboard
      });
    } catch (error) {
      console.error('获取成就排行榜失败:', error);
      res.status(500).json({
        success: false,
        message: '获取成就排行榜失败',
        error: error.message
      });
    }
  }

  // 获取用户排名
  static async getUserRank(req, res) {
    try {
      const { userId } = req.params;
      const { type = 'like_received_count' } = req.query;

      const rank = await Achievement.getUserRank(userId, type);

      if (!rank) {
        return res.json({
          success: true,
          data: null,
          message: '用户暂无排名'
        });
      }

      res.json({
        success: true,
        data: rank
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

  // 手动触发成就检查（调试用）
  static async triggerAchievementCheck(req, res) {
    try {
      const userId = req.user.id;

      const newAchievements = await Achievement.checkAndUnlockAchievements(userId);

      res.json({
        success: true,
        message: '成就检查完成',
        data: {
          newAchievements: newAchievements.length,
          achievements: newAchievements
        }
      });
    } catch (error) {
      console.error('手动触发成就检查失败:', error);
      res.status(500).json({
        success: false,
        message: '手动触发成就检查失败',
        error: error.message
      });
    }
  }

  // 获取当前用户的成就概览（包含统计和最新解锁的成就）
  static async getMyAchievementOverview(req, res) {
    try {
      const userId = req.user.id;

      const [stats, unlockedAchievements] = await Promise.all([
        Achievement.getUserStats(userId),
        Achievement.getUserAchievements(userId)
      ]);

      // 获取最近解锁的成就（最多5个）
      const recentAchievements = unlockedAchievements.slice(-5).reverse();

      // 获取在各个排行榜中的排名
      const ranks = await Promise.all([
        Achievement.getUserRank(userId, 'like_received_count'),
        Achievement.getUserRank(userId, 'like_given_count')
      ]);

      const overview = {
        stats: stats || {
          like_received_count: 0,
          like_given_count: 0,
          achievements_unlocked: []
        },
        totalAchievements: unlockedAchievements.length,
        recentAchievements,
        ranks: {
          like_received: ranks[0],
          like_given: ranks[1]
        }
      };

      res.json({
        success: true,
        data: overview
      });
    } catch (error) {
      console.error('获取成就概览失败:', error);
      res.status(500).json({
        success: false,
        message: '获取成就概览失败',
        error: error.message
      });
    }
  }
  // 领取成就奖励
  static async claimReward(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const reward = await Achievement.claimAchievementReward(userId, parseInt(id));

      res.json({
        success: true,
        message: '领取奖励成功',
        reward,
        pointsAwarded: reward.points
      });
    } catch (error) {
      console.error('领取成就奖励失败:', error);
      res.status(400).json({ // Use 400 for logic errors (e.g. already claimed)
        success: false,
        message: error.message || '领取奖励失败'
      });
    }
  }
}

module.exports = AchievementController;