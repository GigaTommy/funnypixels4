const express = require('express');
const router = express.Router();
const HashtagController = require('../controllers/hashtagController');
const { authMiddleware, optionalAuth } = require('../middleware/auth');

/**
 * 话题标签路由
 * Base path: /api/hashtags
 */

// 获取话题建议（自动补全）- 需要登录
router.get('/suggestions', authMiddleware, HashtagController.getSuggestions);

// 获取热门话题 - 无需登录
router.get('/trending', optionalAuth, HashtagController.getTrending);

// 搜索话题 - 无需登录
router.get('/search', optionalAuth, HashtagController.searchHashtags);

// 初始化常用话题（管理员）
router.post('/initialize', authMiddleware, HashtagController.initialize);

// 获取话题详情（话题下的动态列表）- 无需登录，但登录后显示点赞状态
router.get('/:tag', optionalAuth, HashtagController.getHashtagDetail);

module.exports = router;
