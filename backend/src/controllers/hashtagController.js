const HashtagService = require('../services/hashtagService');
const logger = require('../utils/logger');

/**
 * 话题标签控制器
 */
class HashtagController {
  /**
   * 获取话题标签建议（自动补全）
   * GET /api/hashtags/suggestions?q=像素&lang=zh-Hans&limit=10
   */
  static async getSuggestions(req, res) {
    try {
      const { q = '', lang, limit = 10 } = req.query;

      // 获取用户语言（优先使用query参数，然后是请求头，最后默认中文）
      const userLanguage = lang || req.language || 'zh-Hans';

      const suggestions = await HashtagService.getSuggestions(
        q,
        userLanguage,
        Math.min(parseInt(limit) || 10, 50)
      );

      res.json({
        success: true,
        data: { suggestions }
      });
    } catch (error) {
      logger.error('getSuggestions error:', error);
      res.status(500).json({
        success: false,
        message: req.t('feed:errors.load_failed')
      });
    }
  }

  /**
   * 获取话题详情（该话题下的动态列表）
   * GET /api/hashtags/:tag?offset=0&limit=20
   */
  static async getHashtagDetail(req, res) {
    try {
      const { tag } = req.params;
      const { offset = 0, limit = 20 } = req.query;
      const userLanguage = req.language || 'zh-Hans';

      // 规范化标签
      const normalizedTag = await HashtagService.normalizeHashtag(tag, userLanguage);

      if (!normalizedTag) {
        return res.status(400).json({
          success: false,
          message: req.t('feed:errors.hashtag_invalid')
        });
      }

      // 查询使用该话题的动态
      const { db } = require('../config/database');
      const currentUserId = req.user?.id;

      let query = db('feed_items')
        .leftJoin('users', 'feed_items.user_id', 'users.id')
        .select(
          'feed_items.*',
          'users.username',
          'users.display_name',
          'users.avatar_url',
          'users.avatar'
        )
        .whereRaw('? = ANY(feed_items.hashtags)', [normalizedTag])
        .orderBy('feed_items.created_at', 'desc')
        .limit(Math.min(parseInt(limit) || 20, 50))
        .offset(parseInt(offset) || 0);

      // 如果用户已登录，添加点赞状态
      if (currentUserId) {
        query = query.leftJoin('feed_likes as my_like', function() {
          this.on('my_like.feed_item_id', 'feed_items.id')
              .andOnVal('my_like.user_id', currentUserId);
        })
        .select(
          db.raw('CASE WHEN my_like.id IS NOT NULL THEN true ELSE false END as is_liked')
        );
      }

      const items = await query;

      // 本地化标签
      const localizedTag = await HashtagService.localizeHashtag(normalizedTag, userLanguage);

      // 获取使用次数
      const countResult = await db('feed_items')
        .whereRaw('? = ANY(hashtags)', [normalizedTag])
        .count('* as count')
        .first();

      const mappedItems = items.map(item => ({
        id: item.id,
        type: item.type,
        content: item.content,
        media: item.media,
        hashtags: item.hashtags,
        location_name: item.location_name,
        like_count: item.like_count,
        comment_count: item.comment_count,
        is_liked: currentUserId ? !!item.is_liked : false,
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
          tag: {
            canonical: normalizedTag,
            localized: localizedTag,
            count: parseInt(countResult?.count || 0)
          },
          items: mappedItems,
          hasMore: items.length === parseInt(limit)
        }
      });
    } catch (error) {
      logger.error('getHashtagDetail error:', error);
      res.status(500).json({
        success: false,
        message: req.t('feed:errors.load_failed')
      });
    }
  }

  /**
   * 获取热门话题
   * GET /api/hashtags/trending?lang=zh-Hans&limit=20
   */
  static async getTrending(req, res) {
    try {
      const { lang, limit = 20 } = req.query;
      const userLanguage = lang || req.language || 'zh-Hans';

      const trending = await HashtagService.getTrendingHashtags(
        userLanguage,
        Math.min(parseInt(limit) || 20, 50)
      );

      res.json({
        success: true,
        data: { trending }
      });
    } catch (error) {
      logger.error('getTrending error:', error);
      res.status(500).json({
        success: false,
        message: req.t('feed:errors.load_failed')
      });
    }
  }

  /**
   * 搜索话题
   * GET /api/hashtags/search?q=pixel&lang=en&limit=20
   */
  static async searchHashtags(req, res) {
    try {
      const { q = '', lang, limit = 20 } = req.query;
      const userLanguage = lang || req.language || 'zh-Hans';

      const results = await HashtagService.searchHashtags(
        q,
        userLanguage,
        Math.min(parseInt(limit) || 20, 50)
      );

      res.json({
        success: true,
        data: { results }
      });
    } catch (error) {
      logger.error('searchHashtags error:', error);
      res.status(500).json({
        success: false,
        message: req.t('feed:errors.load_failed')
      });
    }
  }

  /**
   * 初始化常用话题（管理员接口，仅首次运行）
   * POST /api/hashtags/initialize
   */
  static async initialize(req, res) {
    try {
      // TODO: 添加管理员权限检查

      await HashtagService.initializeCommonHashtags();

      res.json({
        success: true,
        message: 'Common hashtags initialized'
      });
    } catch (error) {
      logger.error('initialize error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to initialize hashtags'
      });
    }
  }
}

module.exports = HashtagController;
