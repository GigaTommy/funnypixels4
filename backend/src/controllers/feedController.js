const { db } = require('../config/database');
const logger = require('../utils/logger');

class FeedController {
  /**
   * 获取动态流
   * GET /api/feed?offset=0&limit=20&filter=all|following
   */
  static async getFeed(req, res) {
    try {
      const currentUserId = req.user.id;
      const { offset = 0, limit = 20, filter = 'following' } = req.query;
      const parsedLimit = Math.min(parseInt(limit) || 20, 50);
      const parsedOffset = parseInt(offset) || 0;

      // 单条查询：feed + user + 当前用户是否已点赞（LEFT JOIN 合并，避免二次查询）
      let query = db('feed_items')
        .leftJoin('users', 'feed_items.user_id', 'users.id')
        .leftJoin('feed_likes as my_like', function() {
          this.on('my_like.feed_item_id', 'feed_items.id')
              .andOnVal('my_like.user_id', currentUserId);
        })
        .select(
          'feed_items.*',
          'users.username',
          'users.display_name',
          'users.avatar_url',
          'users.avatar',
          db.raw('CASE WHEN my_like.id IS NOT NULL THEN true ELSE false END as is_liked')
        )
        .orderBy('feed_items.created_at', 'desc')
        .limit(parsedLimit)
        .offset(parsedOffset);

      if (filter === 'following') {
        // 只显示关注用户的动态 + 自己的（单条子查询，避免串行两次查询）
        query = query.where(function() {
          this.whereIn('feed_items.user_id',
            db('user_follows')
              .where('follower_id', currentUserId)
              .select('following_id')
          ).orWhere('feed_items.user_id', currentUserId);
        });
      }

      const items = await query;

      const mappedItems = items.map(item => ({
        id: item.id,
        type: item.type,
        content: item.content,
        drawing_session_id: item.drawing_session_id,
        like_count: item.like_count,
        comment_count: item.comment_count,
        is_liked: !!item.is_liked,
        created_at: item.created_at,
        user: {
          id: item.user_id,
          username: item.username,
          display_name: item.display_name,
          avatar_url: item.avatar_url,
          avatar: item.avatar
        }
      }));

      res.json({
        success: true,
        data: {
          items: mappedItems,
          hasMore: items.length === parsedLimit
        }
      });
    } catch (error) {
      logger.error('获取动态流失败:', error);
      res.status(500).json({ success: false, message: '获取动态流失败', error: error.message });
    }
  }

  /**
   * 点赞动态
   * POST /api/feed/:id/like
   */
  static async likeFeedItem(req, res) {
    try {
      const currentUserId = req.user.id;
      const { id } = req.params;

      // 检查是否已点赞
      const existing = await db('feed_likes')
        .where({ feed_item_id: id, user_id: currentUserId })
        .first();

      if (existing) {
        return res.json({ success: true, message: '已点赞' });
      }

      await db.transaction(async trx => {
        await trx('feed_likes').insert({
          feed_item_id: id,
          user_id: currentUserId
        });
        await trx('feed_items')
          .where('id', id)
          .increment('like_count', 1);
      });

      res.json({ success: true, message: '点赞成功' });
    } catch (error) {
      logger.error('点赞动态失败:', error);
      res.status(500).json({ success: false, message: '点赞动态失败', error: error.message });
    }
  }

  /**
   * 取消点赞
   * DELETE /api/feed/:id/unlike
   */
  static async unlikeFeedItem(req, res) {
    try {
      const currentUserId = req.user.id;
      const { id } = req.params;

      const deleted = await db.transaction(async trx => {
        const count = await trx('feed_likes')
          .where({ feed_item_id: id, user_id: currentUserId })
          .del();
        if (count > 0) {
          await trx('feed_items')
            .where('id', id)
            .decrement('like_count', 1);
        }
        return count;
      });

      res.json({ success: true, message: deleted > 0 ? '取消点赞成功' : '未点赞' });
    } catch (error) {
      logger.error('取消点赞失败:', error);
      res.status(500).json({ success: false, message: '取消点赞失败', error: error.message });
    }
  }

  /**
   * 获取评论列表
   * GET /api/feed/:id/comments
   */
  static async getComments(req, res) {
    try {
      const { id } = req.params;
      const { offset = 0, limit = 20 } = req.query;

      const comments = await db('feed_comments')
        .leftJoin('users', 'feed_comments.user_id', 'users.id')
        .select(
          'feed_comments.id',
          'feed_comments.content',
          'feed_comments.created_at',
          'feed_comments.user_id',
          'users.username',
          'users.display_name',
          'users.avatar_url',
          'users.avatar'
        )
        .where('feed_comments.feed_item_id', id)
        .orderBy('feed_comments.created_at', 'asc')
        .limit(Math.min(parseInt(limit) || 20, 50))
        .offset(parseInt(offset) || 0);

      const mappedComments = comments.map(c => ({
        id: c.id,
        content: c.content,
        created_at: c.created_at,
        user: {
          id: c.user_id,
          username: c.username,
          display_name: c.display_name,
          avatar_url: c.avatar_url,
          avatar: c.avatar
        }
      }));

      res.json({
        success: true,
        data: { comments: mappedComments }
      });
    } catch (error) {
      logger.error('获取评论失败:', error);
      res.status(500).json({ success: false, message: '获取评论失败', error: error.message });
    }
  }

  /**
   * 发表评论
   * POST /api/feed/:id/comments
   */
  static async addComment(req, res) {
    try {
      const currentUserId = req.user.id;
      const { id } = req.params;
      const { content } = req.body;

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ success: false, message: '评论内容不能为空' });
      }

      if (content.length > 500) {
        return res.status(400).json({ success: false, message: '评论内容不能超过500字' });
      }

      const [comment] = await db.transaction(async trx => {
        const inserted = await trx('feed_comments')
          .insert({
            feed_item_id: id,
            user_id: currentUserId,
            content: content.trim()
          })
          .returning('*');
        await trx('feed_items')
          .where('id', id)
          .increment('comment_count', 1);
        return inserted;
      });

      res.json({
        success: true,
        data: {
          id: comment.id,
          content: comment.content,
          created_at: comment.created_at
        }
      });
    } catch (error) {
      logger.error('发表评论失败:', error);
      res.status(500).json({ success: false, message: '发表评论失败', error: error.message });
    }
  }

  /**
   * 删除评论（只能删除自己的）
   * DELETE /api/feed/comments/:commentId
   */
  static async deleteComment(req, res) {
    try {
      const currentUserId = req.user.id;
      const { commentId } = req.params;

      const comment = await db('feed_comments')
        .where({ id: commentId, user_id: currentUserId })
        .first();

      if (!comment) {
        return res.status(404).json({ success: false, message: '评论不存在或无权删除' });
      }

      await db.transaction(async trx => {
        await trx('feed_comments').where('id', commentId).del();
        await trx('feed_items')
          .where('id', comment.feed_item_id)
          .decrement('comment_count', 1);
      });

      res.json({ success: true, message: '删除成功' });
    } catch (error) {
      logger.error('删除评论失败:', error);
      res.status(500).json({ success: false, message: '删除评论失败', error: error.message });
    }
  }

  /**
   * 创建动态条目（内部调用）
   * 用于绘画完成、成就解锁等自动生成动态
   */
  static async createFeedItem(userId, type, content, drawingSessionId = null) {
    try {
      const [item] = await db('feed_items')
        .insert({
          user_id: userId,
          type,
          content: JSON.stringify(content),
          drawing_session_id: drawingSessionId
        })
        .returning('*');
      logger.info(`Feed item created: type=${type}, userId=${userId}`);
      return item;
    } catch (error) {
      logger.error('创建动态条目失败:', error);
      return null;
    }
  }
}

module.exports = FeedController;
