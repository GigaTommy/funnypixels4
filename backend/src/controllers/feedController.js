const { db } = require('../config/database');
const logger = require('../utils/logger');

class FeedController {
  /**
   * 获取动态流
   * GET /api/feed?offset=0&limit=20&filter=all|following|alliance|nearby&lat=30.27&lng=120.15
   */
  static async getFeed(req, res) {
    try {
      const currentUserId = req.user.id;
      const { offset = 0, limit = 20, filter = 'following', lat, lng } = req.query;
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
        .limit(parsedLimit)
        .offset(parsedOffset);

      // 应用筛选逻辑
      if (filter === 'following') {
        // 只显示关注用户的动态 + 自己的（单条子查询，避免串行两次查询）
        query = query.where(function() {
          this.whereIn('feed_items.user_id',
            db('user_follows')
              .where('follower_id', currentUserId)
              .select('following_id')
          ).orWhere('feed_items.user_id', currentUserId);
        });
      } else if (filter === 'alliance') {
        // ✨ 新增：联盟筛选 - 显示同联盟成员的动态
        const userAlliance = await db('alliance_members')
          .where('user_id', currentUserId)
          .first();

        if (userAlliance) {
          // 获取联盟所有成员ID
          const allianceMemberIds = await db('alliance_members')
            .where('alliance_id', userAlliance.alliance_id)
            .pluck('user_id');

          query = query.whereIn('feed_items.user_id', allianceMemberIds);
        } else {
          // 未加入联盟，返回空结果
          return res.json({
            success: true,
            data: {
              items: [],
              hasMore: false,
              message: '未加入联盟'
            }
          });
        }
      } else if (filter === 'nearby') {
        // ✨ 新增：附近筛选 - 5km范围内的动态（需要lat/lng参数）
        if (!lat || !lng) {
          return res.status(400).json({
            success: false,
            message: '附近筛选需要提供lat和lng参数'
          });
        }

        // PostGIS地理查询（5000米 = 5km）
        query = query.whereRaw(
          `ST_DWithin(feed_items.location, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography, ?)`,
          [parseFloat(lng), parseFloat(lat), 5000]
        );

        // 附近动态按距离排序（近的优先）
        query = query.orderByRaw(
          `ST_Distance(feed_items.location, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography)`,
          [parseFloat(lng), parseFloat(lat)]
        );
      } else {
        // filter === 'all' 或其他：显示所有公开动态，按时间排序
        query = query.orderBy('feed_items.created_at', 'desc');
      }

      // 非nearby筛选，按时间排序（nearby已经按距离排序）
      if (filter !== 'nearby') {
        query = query.orderBy('feed_items.created_at', 'desc');
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

      // 获取Feed信息（获取作者ID）
      const feedItem = await db('feed_items')
        .where('id', id)
        .select('user_id', 'content')
        .first();

      if (!feedItem) {
        return res.status(404).json({ success: false, message: 'Feed不存在' });
      }

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

      // ✨ 更新每日任务：社交互动
      try {
        const DailyTaskController = require('./dailyTaskController');
        await DailyTaskController.updateTaskProgress(currentUserId, 'social_interact', 1);
      } catch (taskError) {
        logger.error('更新每日任务失败（点赞）:', taskError);
        // 不影响主流程
      }

      // ✨ 创建点赞通知（不通知自己）
      if (feedItem.user_id !== currentUserId) {
        try {
          const NotificationController = require('./notificationController');
          const liker = await db('users')
            .where('id', currentUserId)
            .select('display_name', 'username')
            .first();

          const likerName = liker?.display_name || liker?.username || '某人';
          const contentPreview = feedItem.content
            ? feedItem.content.substring(0, 30) + (feedItem.content.length > 30 ? '...' : '')
            : '你的动态';

          await NotificationController.createNotification(
            feedItem.user_id,
            'like',
            `${likerName} 赞了你`,
            `${likerName} 赞了你的动态：${contentPreview}`,
            {
              feed_id: id,
              liker_id: currentUserId,
              liker_name: likerName
            }
          );
        } catch (notifError) {
          logger.error('创建点赞通知失败:', notifError);
          // 不影响主流程
        }
      }

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

      // 获取Feed信息（获取作者ID）
      const feedItem = await db('feed_items')
        .where('id', id)
        .select('user_id', 'content as feed_content')
        .first();

      if (!feedItem) {
        return res.status(404).json({ success: false, message: 'Feed不存在' });
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

      // ✨ 更新每日任务：社交互动
      try {
        const DailyTaskController = require('./dailyTaskController');
        await DailyTaskController.updateTaskProgress(currentUserId, 'social_interact', 1);
      } catch (taskError) {
        logger.error('更新每日任务失败（评论）:', taskError);
        // 不影响主流程
      }

      // ✨ 创建评论通知（不通知自己）
      if (feedItem.user_id !== currentUserId) {
        try {
          const NotificationController = require('./notificationController');
          const commenter = await db('users')
            .where('id', currentUserId)
            .select('display_name', 'username')
            .first();

          const commenterName = commenter?.display_name || commenter?.username || '某人';
          const commentPreview = content.substring(0, 30) + (content.length > 30 ? '...' : '');
          const feedPreview = feedItem.feed_content
            ? feedItem.feed_content.substring(0, 20) + (feedItem.feed_content.length > 20 ? '...' : '')
            : '你的动态';

          await NotificationController.createNotification(
            feedItem.user_id,
            'comment',
            `${commenterName} 评论了你`,
            `${commenterName} 评论了你的动态"${feedPreview}"：${commentPreview}`,
            {
              feed_id: id,
              comment_id: comment.id,
              commenter_id: currentUserId,
              commenter_name: commenterName,
              comment_content: commentPreview
            }
          );
        } catch (notifError) {
          logger.error('创建评论通知失败:', notifError);
          // 不影响主流程
        }
      }

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
      const insertData = {
        user_id: userId,
        type,
        content: JSON.stringify(content),
        drawing_session_id: drawingSessionId
      };

      // ✨ 自动提取location（用于nearby筛选）
      if (drawingSessionId) {
        const session = await db('drawing_sessions')
          .where('id', drawingSessionId)
          .select('start_lat', 'start_lng')
          .first();

        if (session && session.start_lat && session.start_lng) {
          // 使用PostGIS ST_MakePoint创建地理位置（lng在前，lat在后）
          insertData.location = db.raw(
            'ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography',
            [session.start_lng, session.start_lat]
          );
        }
      }

      const [item] = await db('feed_items')
        .insert(insertData)
        .returning('*');
      logger.info(`Feed item created: type=${type}, userId=${userId}, hasLocation=${!!insertData.location}`);
      return item;
    } catch (error) {
      logger.error('创建动态条目失败:', error);
      return null;
    }
  }
}

module.exports = FeedController;
