const { db } = require('../config/database');

class UserFollow {
  // 关注用户
  static async follow(followerId, followingId) {
    if (followerId === followingId) {
      throw new Error('不能关注自己');
    }
    
    try {
      const [follow] = await db('user_follows')
        .insert({
          follower_id: followerId,
          following_id: followingId
        })
        .returning('*');
      
      return follow;
    } catch (error) {
      if (error.code === '23505') { // 唯一约束违反
        throw new Error('已经关注该用户');
      }
      throw error;
    }
  }

  // 取消关注
  static async unfollow(followerId, followingId) {
    const deleted = await db('user_follows')
      .where({
        follower_id: followerId,
        following_id: followingId
      })
      .del();
    
    return deleted > 0;
  }

  // 检查是否关注
  static async isFollowing(followerId, followingId) {
    const follow = await db('user_follows')
      .where({
        follower_id: followerId,
        following_id: followingId
      })
      .first();
    
    return !!follow;
  }

  // 获取关注列表
  static async getFollowing(userId, limit = 20, offset = 0) {
    const following = await db('user_follows')
      .select(
        'user_follows.*',
        'users.username',
        'users.display_name',
        'users.avatar_url',
        'users.account_status',
        'users.total_pixels',
        'users.current_pixels'
      )
      .join('users', 'user_follows.following_id', 'users.id')
      .where('user_follows.follower_id', userId)
      .orderBy('user_follows.created_at', 'desc')
      .limit(limit)
      .offset(offset);

    return following;
  }

  // 获取粉丝列表
  static async getFollowers(userId, limit = 20, offset = 0) {
    const followers = await db('user_follows')
      .select(
        'user_follows.*',
        'users.username',
        'users.display_name',
        'users.avatar_url',
        'users.account_status',
        'users.total_pixels',
        'users.current_pixels'
      )
      .join('users', 'user_follows.follower_id', 'users.id')
      .where('user_follows.following_id', userId)
      .orderBy('user_follows.created_at', 'desc')
      .limit(limit)
      .offset(offset);

    return followers;
  }

  // 获取关注数量
  static async getFollowingCount(userId) {
    const result = await db('user_follows')
      .where('follower_id', userId)
      .count('* as count')
      .first();
    
    return parseInt(result.count);
  }

  // 获取粉丝数量
  static async getFollowersCount(userId) {
    const result = await db('user_follows')
      .where('following_id', userId)
      .count('* as count')
      .first();
    
    return parseInt(result.count);
  }

  // 获取互相关注的用户
  static async getMutualFollows(userId, limit = 20, offset = 0) {
    const mutual = await db('user_follows as f1')
      .select(
        'f1.following_id',
        'users.username',
        'users.display_name',
        'users.avatar_url',
        'users.account_status',
        'users.total_pixels',
        'users.current_pixels'
      )
      .join('user_follows as f2', function() {
        this.on('f1.following_id', '=', 'f2.follower_id')
          .andOn('f1.follower_id', '=', 'f2.following_id');
      })
      .join('users', 'f1.following_id', 'users.id')
      .where('f1.follower_id', userId)
      .orderBy('f1.created_at', 'desc')
      .limit(limit)
      .offset(offset);

    return mutual;
  }

  // 获取推荐关注用户（基于共同关注）
  static async getRecommendedFollows(userId, limit = 10) {
    // 获取用户关注的人的关注列表，排除已关注的
    const recommended = await db('user_follows as f1')
      .select(
        'f1.following_id',
        'users.username',
        'users.display_name',
        'users.avatar_url',
        'users.account_status',
        'users.total_pixels',
        'users.current_pixels',
        db.raw('COUNT(f2.follower_id) as mutual_count')
      )
      .join('user_follows as f2', 'f1.following_id', 'f2.following_id')
      .join('users', 'f1.following_id', 'users.id')
      .where('f1.follower_id', userId)
      .whereNotExists(function() {
        this.select('*')
          .from('user_follows as f3')
          .whereRaw('f3.follower_id = ? AND f3.following_id = f1.following_id', [userId]);
      })
      .whereNot('f1.following_id', userId)
      .groupBy('f1.following_id', 'users.username', 'users.display_name', 'users.avatar_url', 'users.account_status', 'users.total_pixels', 'users.current_pixels')
      .orderBy('mutual_count', 'desc')
      .limit(limit);

    return recommended;
  }
}

module.exports = UserFollow;
