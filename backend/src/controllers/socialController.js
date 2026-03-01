const UserFollow = require('../models/UserFollow');
const Leaderboard = require('../models/Leaderboard');
const Conversation = require('../models/Conversation');

class SocialController {
  // 关注用户 - 支持自动创建私信会话
  static async followUser(req, res) {
    try {
      const { userId: followingId } = req.params;
      const followerId = req.user.id;

      if (followerId === followingId) {
        return res.status(400).json({
          success: false,
          message: '不能关注自己'
        });
      }

      // 执行关注操作
      const follow = await UserFollow.follow(followerId, followingId);

      // 自动创建或获取私信会话
      try {
        const conversation = await Conversation.createOrGetPrivateConversation(followerId, followingId);
        console.log(`自动创建私信会话成功: ${conversation.id}`);
      } catch (convError) {
        console.error('创建私信会话失败，但关注成功:', convError);
        // 会话创建失败不影响关注操作
      }

      // ✨ 创建关注通知
      try {
        const { db } = require('../config/database');
        const NotificationController = require('./notificationController');

        const follower = await db('users')
          .where('id', followerId)
          .select('display_name', 'username')
          .first();

        const followerName = follower?.display_name || follower?.username || '某人';

        await NotificationController.createNotification(
          followingId,  // 被关注者
          'follow',
          `${followerName} 关注了你`,
          `${followerName} 关注了你，快去看看 TA 的主页吧！`,
          {
            follower_id: followerId,
            follower_name: followerName
          }
        );
      } catch (notifError) {
        console.error('创建关注通知失败:', notifError);
        // 不影响主流程
      }

      res.json({
        success: true,
        message: '关注成功',
        data: follow
      });
    } catch (error) {
      console.error('关注用户失败:', error);
      res.status(500).json({
        success: false,
        message: error.message || '关注用户失败',
        error: error.message
      });
    }
  }

  // 取消关注
  static async unfollowUser(req, res) {
    try {
      const { userId: followingId } = req.params;
      const followerId = req.user.id;

      const success = await UserFollow.unfollow(followerId, followingId);

      if (!success) {
        return res.status(404).json({
          success: false,
          message: '未找到关注关系'
        });
      }

      res.json({
        success: true,
        message: '取消关注成功'
      });
    } catch (error) {
      console.error('取消关注失败:', error);
      res.status(500).json({
        success: false,
        message: '取消关注失败',
        error: error.message
      });
    }
  }

  // 检查关注状态 - 返回完整状态信息
  static async checkFollowStatus(req, res) {
    try {
      const { userId: targetUserId } = req.params;
      const currentUserId = req.user.id;

      // 并行查询双向关注关系
      const [isFollowing, isFollowedBy] = await Promise.all([
        UserFollow.isFollowing(currentUserId, targetUserId),
        UserFollow.isFollowing(targetUserId, currentUserId)
      ]);

      // 判断是否互关
      const isMutual = isFollowing && isFollowedBy;

      res.json({
        success: true,
        data: {
          isFollowing,
          isFollowedBy,
          isMutual
        }
      });
    } catch (error) {
      console.error('检查关注状态失败:', error);
      res.status(500).json({
        success: false,
        message: '检查关注状态失败',
        error: error.message
      });
    }
  }

  // 获取关注列表
  static async getFollowing(req, res) {
    try {
      const { userId } = req.params;
      const { limit = 20, offset = 0 } = req.query;

      const following = await UserFollow.getFollowing(
        userId,
        parseInt(limit),
        parseInt(offset)
      );

      res.json({
        success: true,
        data: following
      });
    } catch (error) {
      console.error('获取关注列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取关注列表失败',
        error: error.message
      });
    }
  }

  // 获取粉丝列表
  static async getFollowers(req, res) {
    try {
      const { userId } = req.params;
      const { limit = 20, offset = 0 } = req.query;

      const followers = await UserFollow.getFollowers(
        userId,
        parseInt(limit),
        parseInt(offset)
      );

      res.json({
        success: true,
        data: followers
      });
    } catch (error) {
      console.error('获取粉丝列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取粉丝列表失败',
        error: error.message
      });
    }
  }

  // 获取互相关注的用户
  static async getMutualFollows(req, res) {
    try {
      const { userId } = req.params;
      const { limit = 20, offset = 0 } = req.query;

      const mutual = await UserFollow.getMutualFollows(
        userId,
        parseInt(limit),
        parseInt(offset)
      );

      res.json({
        success: true,
        data: mutual
      });
    } catch (error) {
      console.error('获取互相关注列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取互相关注列表失败',
        error: error.message
      });
    }
  }

  // 获取推荐关注用户
  static async getRecommendedFollows(req, res) {
    try {
      const { limit = 10 } = req.query;
      const userId = req.user.id;

      const recommended = await UserFollow.getRecommendedFollows(
        userId,
        parseInt(limit)
      );

      res.json({
        success: true,
        data: recommended
      });
    } catch (error) {
      console.error('获取推荐关注失败:', error);
      res.status(500).json({
        success: false,
        message: '获取推荐关注失败',
        error: error.message
      });
    }
  }

  // 获取用户统计信息
  static async getUserStats(req, res) {
    try {
      const { userId } = req.params;

      const [followingCount, followersCount] = await Promise.all([
        UserFollow.getFollowingCount(userId),
        UserFollow.getFollowersCount(userId)
      ]);

      res.json({
        success: true,
        data: {
          followingCount,
          followersCount
        }
      });
    } catch (error) {
      console.error('获取用户统计失败:', error);
      res.status(500).json({
        success: false,
        message: '获取用户统计失败',
        error: error.message
      });
    }
  }

  // 获取排行榜
  static async getLeaderboard(req, res) {
    try {
      const { type = 'user', period = 'daily', date, limit = 20 } = req.query;

      const leaderboard = await Leaderboard.getLeaderboard(
        type,
        period,
        date,
        parseInt(limit)
      );

      res.json({
        success: true,
        data: leaderboard
      });
    } catch (error) {
      console.error('获取排行榜失败:', error);
      res.status(500).json({
        success: false,
        message: '获取排行榜失败',
        error: error.message
      });
    }
  }

  // 获取用户排名
  static async getUserRank(req, res) {
    try {
      const { userId } = req.params;
      const { type = 'user', period = 'daily', date } = req.query;

      const rank = await Leaderboard.getUserRank(userId, type, period, date);

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

  // 获取联盟排名
  static async getAllianceRank(req, res) {
    try {
      const { allianceId } = req.params;
      const { period = 'daily', date } = req.query;

      const rank = await Leaderboard.getAllianceRank(allianceId, period, date);

      res.json({
        success: true,
        data: rank
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

  // 获取排行榜历史
  static async getLeaderboardHistory(req, res) {
    try {
      const { type = 'user', period = 'daily', limit = 7 } = req.query;

      const history = await Leaderboard.getLeaderboardHistory(
        type,
        period,
        parseInt(limit)
      );

      res.json({
        success: true,
        data: history
      });
    } catch (error) {
      console.error('获取排行榜历史失败:', error);
      res.status(500).json({
        success: false,
        message: '获取排行榜历史失败',
        error: error.message
      });
    }
  }
}

module.exports = SocialController;
