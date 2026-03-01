const { db } = require('../config/database');

class PixelLike {
  // 点赞像素
  static async likePixel(pixelId, userId, pixelOwnerId) {
    try {
      // 防止自己给自己点赞
      if (userId === pixelOwnerId) {
        throw new Error('不能为自己的像素点赞');
      }

      // 检查是否已经点赞（未删除的记录）
      const existingLike = await db('pixel_likes')
        .where({
          pixel_id: pixelId,
          user_id: userId,
          deleted_at: null
        })
        .first();

      if (existingLike) {
        throw new Error('已经点赞过此像素');
      }

      // 检查是否之前点赞过但删除了（可以恢复）
      const deletedLike = await db('pixel_likes')
        .where({
          pixel_id: pixelId,
          user_id: userId
        })
        .whereNotNull('deleted_at')
        .first();

      let like;

      if (deletedLike) {
        // 恢复之前的点赞
        [like] = await db('pixel_likes')
          .where('id', deletedLike.id)
          .update({
            deleted_at: null,
            created_at: db.fn.now() // 更新点赞时间
          })
          .returning('*');
      } else {
        // 创建新的点赞记录
        [like] = await db('pixel_likes')
          .insert({
            pixel_id: pixelId,
            user_id: userId,
            pixel_owner_id: pixelOwnerId
          })
          .returning('*');
      }

      console.log(`用户 ${userId} 点赞了像素 ${pixelId}（所有者：${pixelOwnerId}）`);
      return like;
    } catch (error) {
      console.error('点赞像素失败:', error);
      throw error;
    }
  }

  // 取消点赞
  static async unlikePixel(pixelId, userId) {
    try {
      const like = await db('pixel_likes')
        .where({
          pixel_id: pixelId,
          user_id: userId,
          deleted_at: null
        })
        .first();

      if (!like) {
        throw new Error('未找到点赞记录');
      }

      // 软删除
      await db('pixel_likes')
        .where('id', like.id)
        .update({
          deleted_at: db.fn.now()
        });

      console.log(`用户 ${userId} 取消了对像素 ${pixelId} 的点赞`);
      return true;
    } catch (error) {
      console.error('取消点赞失败:', error);
      throw error;
    }
  }

  // 检查是否已点赞
  static async isLiked(pixelId, userId) {
    try {
      const like = await db('pixel_likes')
        .where({
          pixel_id: pixelId,
          user_id: userId,
          deleted_at: null
        })
        .first();

      return !!like;
    } catch (error) {
      console.error('检查点赞状态失败:', error);
      return false;
    }
  }

  // 获取像素点赞数
  static async getPixelLikeCount(pixelId) {
    try {
      const result = await db('pixel_likes')
        .where({
          pixel_id: pixelId,
          deleted_at: null
        })
        .count('id as count')
        .first();

      return parseInt(result.count) || 0;
    } catch (error) {
      console.error('获取像素点赞数失败:', error);
      return 0;
    }
  }

  // 获取多个像素的点赞数
  static async getMultiplePixelLikeCounts(pixelIds) {
    try {
      if (!pixelIds || pixelIds.length === 0) {
        return {};
      }

      const results = await db('pixel_likes')
        .select('pixel_id')
        .count('id as count')
        .whereIn('pixel_id', pixelIds)
        .where('deleted_at', null)
        .groupBy('pixel_id');

      const counts = {};
      results.forEach(result => {
        counts[result.pixel_id] = parseInt(result.count) || 0;
      });

      // 为没有点赞的像素设置0
      pixelIds.forEach(pixelId => {
        if (!(pixelId in counts)) {
          counts[pixelId] = 0;
        }
      });

      return counts;
    } catch (error) {
      console.error('获取多个像素点赞数失败:', error);
      return {};
    }
  }

  // 获取用户给出的点赞列表
  static async getUserLikes(userId, limit = 20, offset = 0) {
    try {
      const likes = await db('pixel_likes')
        .select('pixel_likes.*')
        .leftJoin('users', 'pixel_likes.pixel_owner_id', 'users.id')
        .select(
          'pixel_likes.*',
          'users.username as owner_username',
          'users.display_name as owner_display_name',
          'users.avatar_url as owner_avatar'
        )
        .where('pixel_likes.user_id', userId)
        .where('pixel_likes.deleted_at', null)
        .orderBy('pixel_likes.created_at', 'desc')
        .limit(limit)
        .offset(offset);

      return likes;
    } catch (error) {
      console.error('获取用户点赞列表失败:', error);
      return [];
    }
  }

  // 获取用户收到的点赞列表
  static async getUserReceivedLikes(userId, limit = 20, offset = 0) {
    try {
      const likes = await db('pixel_likes')
        .select('pixel_likes.*')
        .leftJoin('users', 'pixel_likes.user_id', 'users.id')
        .select(
          'pixel_likes.*',
          'users.username as liker_username',
          'users.display_name as liker_display_name',
          'users.avatar_url as liker_avatar'
        )
        .where('pixel_likes.pixel_owner_id', userId)
        .where('pixel_likes.deleted_at', null)
        .orderBy('pixel_likes.created_at', 'desc')
        .limit(limit)
        .offset(offset);

      return likes;
    } catch (error) {
      console.error('获取用户收到的点赞失败:', error);
      return [];
    }
  }

  // 获取像素的点赞用户列表
  static async getPixelLikers(pixelId, limit = 50, offset = 0) {
    try {
      const likers = await db('pixel_likes')
        .select('users.id', 'users.username', 'users.display_name', 'users.avatar_url', 'pixel_likes.created_at')
        .leftJoin('users', 'pixel_likes.user_id', 'users.id')
        .where('pixel_likes.pixel_id', pixelId)
        .where('pixel_likes.deleted_at', null)
        .orderBy('pixel_likes.created_at', 'desc')
        .limit(limit)
        .offset(offset);

      return likers;
    } catch (error) {
      console.error('获取像素点赞用户列表失败:', error);
      return [];
    }
  }

  // 获取用户点赞统计
  static async getUserLikeStats(userId) {
    try {
      const [givenResult, receivedResult] = await Promise.all([
        // 给出的点赞数
        db('pixel_likes')
          .where({
            user_id: userId,
            deleted_at: null
          })
          .count('id as count')
          .first(),

        // 收到的点赞数
        db('pixel_likes')
          .where({
            pixel_owner_id: userId,
            deleted_at: null
          })
          .count('id as count')
          .first()
      ]);

      return {
        given_likes: parseInt(givenResult.count) || 0,
        received_likes: parseInt(receivedResult.count) || 0
      };
    } catch (error) {
      console.error('获取用户点赞统计失败:', error);
      return {
        given_likes: 0,
        received_likes: 0
      };
    }
  }

  // 获取热门像素（按点赞数排序）
  static async getPopularPixels(limit = 20, offset = 0, timeRange = null) {
    try {
      let query = db('pixel_likes')
        .select('pixel_id', 'pixel_owner_id')
        .count('id as like_count')
        .where('deleted_at', null)
        .groupBy('pixel_id', 'pixel_owner_id')
        .orderBy('like_count', 'desc')
        .limit(limit)
        .offset(offset);

      // 时间范围过滤
      if (timeRange) {
        const now = new Date();
        let startTime;

        switch (timeRange) {
          case 'day':
            startTime = new Date(now - 24 * 60 * 60 * 1000);
            break;
          case 'week':
            startTime = new Date(now - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            startTime = new Date(now - 30 * 24 * 60 * 60 * 1000);
            break;
        }

        if (startTime) {
          query = query.where('created_at', '>=', startTime);
        }
      }

      const results = await query;

      // 获取像素所有者信息
      const pixelsWithOwners = await Promise.all(
        results.map(async (result) => {
          const owner = await db('users')
            .select('id', 'username', 'display_name', 'avatar_url')
            .where('id', result.pixel_owner_id)
            .first();

          return {
            pixel_id: result.pixel_id,
            like_count: parseInt(result.like_count),
            owner: owner || null
          };
        })
      );

      return pixelsWithOwners;
    } catch (error) {
      console.error('获取热门像素失败:', error);
      return [];
    }
  }

  // 批量检查多个像素的点赞状态
  static async checkMultiplePixelLikeStatus(pixelIds, userId) {
    try {
      if (!pixelIds || pixelIds.length === 0) {
        return {};
      }

      const likes = await db('pixel_likes')
        .select('pixel_id')
        .whereIn('pixel_id', pixelIds)
        .where('user_id', userId)
        .where('deleted_at', null);

      const likedPixels = {};
      likes.forEach(like => {
        likedPixels[like.pixel_id] = true;
      });

      // 设置未点赞的像素为false
      pixelIds.forEach(pixelId => {
        if (!(pixelId in likedPixels)) {
          likedPixels[pixelId] = false;
        }
      });

      return likedPixels;
    } catch (error) {
      console.error('批量检查点赞状态失败:', error);
      return {};
    }
  }
}

module.exports = PixelLike;