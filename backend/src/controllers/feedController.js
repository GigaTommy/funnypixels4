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

      // 单条查询：feed + user + 当前用户是否已点赞/收藏/投票（LEFT JOIN 合并，避免二次查询）
      let query = db('feed_items')
        .leftJoin('users', 'feed_items.user_id', 'users.id')
        .leftJoin('feed_likes as my_like', function() {
          this.on('my_like.feed_item_id', 'feed_items.id')
              .andOnVal('my_like.user_id', currentUserId);
        })
        .leftJoin('feed_bookmarks as my_bookmark', function() {
          this.on('my_bookmark.feed_item_id', 'feed_items.id')
              .andOnVal('my_bookmark.user_id', currentUserId);
        })
        .leftJoin('poll_votes as my_vote', function() {
          this.on('my_vote.feed_item_id', 'feed_items.id')
              .andOnVal('my_vote.user_id', currentUserId);
        })
        .select(
          'feed_items.*',
          'users.username',
          'users.display_name',
          'users.avatar_url',
          'users.avatar',
          db.raw('CASE WHEN my_like.id IS NOT NULL THEN true ELSE false END as is_liked'),
          db.raw('CASE WHEN my_bookmark.id IS NOT NULL THEN true ELSE false END as is_bookmarked'),
          'my_vote.option_index as my_vote_option_index'
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
      } else if (filter === 'trending') {
        // ✨ 新增：热门筛选 - 按互动分数排序
        query = query
          .orderBy('feed_items.engagement_score', 'desc')
          .orderBy('feed_items.created_at', 'desc');
      } else if (filter === 'challenges') {
        // ✨ 新增：挑战筛选 - 只显示挑战相关动态
        query = query
          .whereNotNull('feed_items.challenge_id')
          .orderBy('feed_items.created_at', 'desc');
      } else {
        // filter === 'all' 或其他：显示所有公开动态，按时间排序
        query = query.orderBy('feed_items.created_at', 'desc');
      }

      // 非nearby和trending筛选，按时间排序
      if (filter !== 'nearby' && filter !== 'trending') {
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
        is_bookmarked: !!item.is_bookmarked,
        poll_data: item.poll_data,
        my_vote_option_index: item.my_vote_option_index !== null ? item.my_vote_option_index : null,
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
   * 创建心情动态（用户主动发布）
   * POST /api/feed/create
   */
  static async createMoment(req, res) {
    try {
      const currentUserId = req.user.id;
      const { content, hashtags, location, media } = req.body;

      // 验证内容
      if (!content || content.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: req.t('feed:validation.content_required')
        });
      }

      if (content.length > 500) {
        return res.status(400).json({
          success: false,
          message: req.t('feed:validation.content_too_long', { max: 500 })
        });
      }

      // 验证图片数量
      if (media && media.length > 9) {
        return res.status(400).json({
          success: false,
          message: req.t('feed:errors.too_many_images')
        });
      }

      // 验证话题标签数量
      if (hashtags && hashtags.length > 10) {
        return res.status(400).json({
          success: false,
          message: req.t('feed:validation.hashtag_too_many', { max: 10 })
        });
      }

      // 规范化话题标签
      const HashtagService = require('../services/hashtagService');
      const userLanguage = req.language || 'zh-Hans';
      const normalizedHashtags = hashtags && hashtags.length > 0
        ? await HashtagService.normalizeBatch(hashtags, userLanguage)
        : null;

      // 构建插入数据
      const insertData = {
        user_id: currentUserId,
        type: 'moment',
        content: JSON.stringify({ text: content.trim() }),
        media: media ? JSON.stringify(media) : null,
        hashtags: normalizedHashtags,
        location_name: location?.name || null
      };

      // 添加地理位置（用于nearby筛选）
      if (location?.lat && location?.lng) {
        insertData.location = db.raw(
          'ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography',
          [location.lng, location.lat]
        );
      }

      // 插入动态
      const [feedItem] = await db('feed_items')
        .insert(insertData)
        .returning('*');

      logger.info(`Moment created: userId=${currentUserId}, id=${feedItem.id}, hashtags=${normalizedHashtags?.length || 0}`);

      // ✨ 更新每日任务：发布动态
      try {
        const DailyTaskController = require('./dailyTaskController');
        await DailyTaskController.updateTaskProgress(currentUserId, 'publish_feed', 1);
      } catch (taskError) {
        logger.error('更新每日任务失败（发布动态）:', taskError);
      }

      res.json({
        success: true,
        data: {
          id: feedItem.id,
          created_at: feedItem.created_at
        },
        message: req.t('feed:success.created')
      });
    } catch (error) {
      logger.error('创建心情动态失败:', error);
      res.status(500).json({
        success: false,
        message: req.t('feed:errors.create_failed')
      });
    }
  }

  /**
   * 创建投票动态
   * POST /api/feed/create-poll
   */
  static async createPoll(req, res) {
    try {
      const currentUserId = req.user.id;
      const { question, options, end_time } = req.body;

      // 验证参数
      if (!question || question.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: '投票问题不能为空'
        });
      }

      if (!options || !Array.isArray(options) || options.length < 2 || options.length > 4) {
        return res.status(400).json({
          success: false,
          message: '投票选项必须为2-4个'
        });
      }

      // 验证选项不为空
      for (const option of options) {
        if (!option || option.trim().length === 0) {
          return res.status(400).json({
            success: false,
            message: '投票选项不能为空'
          });
        }
      }

      // 构建投票数据
      const pollData = {
        question: question.trim(),
        options: options.map(o => o.trim()),
        votes: options.map(() => 0), // 初始化投票数为0
        end_time: end_time || null
      };

      // 插入动态
      const [feedItem] = await db('feed_items').insert({
        user_id: currentUserId,
        type: 'poll',
        content: JSON.stringify({ question: question.trim() }),
        poll_data: JSON.stringify(pollData)
      }).returning('*');

      logger.info(`Poll created: userId=${currentUserId}, id=${feedItem.id}`);

      res.json({
        success: true,
        data: {
          id: feedItem.id,
          created_at: feedItem.created_at
        },
        message: '投票创建成功'
      });
    } catch (error) {
      logger.error('创建投票失败:', error);
      res.status(500).json({
        success: false,
        message: '创建投票失败'
      });
    }
  }

  /**
   * 对投票进行投票
   * POST /api/feed/:id/vote
   */
  static async votePoll(req, res) {
    try {
      const currentUserId = req.user.id;
      const { id } = req.params;
      const { option_index } = req.body;

      // 验证参数
      if (option_index === undefined || option_index === null) {
        return res.status(400).json({
          success: false,
          message: '请选择投票选项'
        });
      }

      // 获取投票动态
      const feedItem = await db('feed_items')
        .where({ id, type: 'poll' })
        .first();

      if (!feedItem) {
        return res.status(404).json({
          success: false,
          message: '投票不存在'
        });
      }

      const pollData = JSON.parse(feedItem.poll_data);

      // 验证选项索引
      if (option_index < 0 || option_index >= pollData.options.length) {
        return res.status(400).json({
          success: false,
          message: '无效的投票选项'
        });
      }

      // 检查投票是否已结束
      if (pollData.end_time && new Date(pollData.end_time) < new Date()) {
        return res.status(400).json({
          success: false,
          message: '投票已结束'
        });
      }

      // 检查是否已投票
      const existingVote = await db('poll_votes')
        .where({ feed_item_id: id, user_id: currentUserId })
        .first();

      if (existingVote) {
        return res.status(400).json({
          success: false,
          message: '您已经投过票了'
        });
      }

      // 记录投票并更新计数
      await db.transaction(async trx => {
        // 插入投票记录
        await trx('poll_votes').insert({
          feed_item_id: id,
          user_id: currentUserId,
          option_index: parseInt(option_index)
        });

        // 更新投票计数
        pollData.votes[option_index] = (pollData.votes[option_index] || 0) + 1;
        await trx('feed_items')
          .where('id', id)
          .update({
            poll_data: JSON.stringify(pollData)
          });
      });

      res.json({
        success: true,
        message: '投票成功',
        data: {
          votes: pollData.votes
        }
      });
    } catch (error) {
      logger.error('投票失败:', error);
      res.status(500).json({
        success: false,
        message: '投票失败'
      });
    }
  }

  /**
   * 创建作品展示动态
   * POST /api/feed/create-showcase
   */
  static async createShowcase(req, res) {
    try {
      const currentUserId = req.user.id;
      const { session_id, story } = req.body;

      // 验证参数
      if (!session_id) {
        return res.status(400).json({
          success: false,
          message: '请选择要展示的作品'
        });
      }

      // 验证故事文本
      if (story && story.length > 500) {
        return res.status(400).json({
          success: false,
          message: '创作故事不能超过500字'
        });
      }

      // 验证绘画会话是否存在且属于当前用户
      const session = await db('drawing_sessions')
        .where({ id: session_id, user_id: currentUserId })
        .select('id', 'pixel_count', 'duration_seconds', 'city', 'start_lat', 'start_lng')
        .first();

      if (!session) {
        return res.status(404).json({
          success: false,
          message: '作品不存在或无权访问'
        });
      }

      // 构建内容
      const content = {
        story: story?.trim() || '',
        pixel_count: session.pixel_count,
        duration_seconds: session.duration_seconds,
        city: session.city
      };

      // 构建插入数据
      const insertData = {
        user_id: currentUserId,
        type: 'showcase',
        content: JSON.stringify(content),
        drawing_session_id: session_id
      };

      // 添加地理位置
      if (session.start_lat && session.start_lng) {
        insertData.location = db.raw(
          'ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography',
          [session.start_lng, session.start_lat]
        );
      }

      // 插入动态
      const [feedItem] = await db('feed_items')
        .insert(insertData)
        .returning('*');

      logger.info(`Showcase created: userId=${currentUserId}, sessionId=${session_id}`);

      res.json({
        success: true,
        data: {
          id: feedItem.id,
          created_at: feedItem.created_at
        },
        message: '作品展示成功'
      });
    } catch (error) {
      logger.error('创建作品展示失败:', error);
      res.status(500).json({
        success: false,
        message: '创建作品展示失败'
      });
    }
  }

  /**
   * 收藏动态
   * POST /api/feed/:id/bookmark
   */
  static async bookmarkFeedItem(req, res) {
    try {
      const currentUserId = req.user.id;
      const { id } = req.params;

      // 检查动态是否存在
      const feedItem = await db('feed_items').where('id', id).first();
      if (!feedItem) {
        return res.status(404).json({ success: false, message: 'Feed不存在' });
      }

      // 检查是否已收藏
      const existing = await db('feed_bookmarks')
        .where({ user_id: currentUserId, feed_item_id: id })
        .first();

      if (existing) {
        return res.json({ success: true, message: '已收藏' });
      }

      // 添加收藏
      await db('feed_bookmarks').insert({
        user_id: currentUserId,
        feed_item_id: id
      });

      res.json({ success: true, message: '收藏成功' });
    } catch (error) {
      logger.error('收藏失败:', error);
      res.status(500).json({ success: false, message: '收藏失败', error: error.message });
    }
  }

  /**
   * 举报动态
   * POST /api/feed/:id/report
   */
  static async reportFeedItem(req, res) {
    try {
      const currentUserId = req.user.id;
      const { id } = req.params;
      const { reason, description } = req.body;

      // 验证原因
      const validReasons = ['spam', 'harassment', 'inappropriate', 'other'];
      if (!reason || !validReasons.includes(reason)) {
        return res.status(400).json({
          success: false,
          message: '请选择举报原因'
        });
      }

      // 检查动态是否存在
      const feedItem = await db('feed_items').where('id', id).first();
      if (!feedItem) {
        return res.status(404).json({ success: false, message: 'Feed不存在' });
      }

      // 检查是否已举报
      const existing = await db('reports')
        .where({
          reporter_id: currentUserId,
          target_type: 'feed_item',
          target_id: id
        })
        .first();

      if (existing) {
        return res.json({ success: true, message: '您已经举报过此内容' });
      }

      // 创建举报
      await db('reports').insert({
        reporter_id: currentUserId,
        target_type: 'feed_item',
        target_id: id,
        reason,
        description: description?.trim() || null,
        status: 'pending'
      });

      res.json({ success: true, message: '举报已提交，感谢您的反馈' });
    } catch (error) {
      logger.error('举报失败:', error);
      res.status(500).json({ success: false, message: '举报失败' });
    }
  }

  /**
   * 取消收藏动态
   * DELETE /api/feed/:id/bookmark
   */
  static async unbookmarkFeedItem(req, res) {
    try {
      const currentUserId = req.user.id;
      const { id } = req.params;

      await db('feed_bookmarks')
        .where({ user_id: currentUserId, feed_item_id: id })
        .del();

      res.json({ success: true, message: '取消收藏成功' });
    } catch (error) {
      logger.error('取消收藏失败:', error);
      res.status(500).json({ success: false, message: '取消收藏失败', error: error.message });
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
