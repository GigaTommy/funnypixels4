const express = require('express');
const FeedController = require('../controllers/feedController');
const { authenticateToken } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// 所有路由都需要认证 + 限流
router.use(authenticateToken);
router.use(apiLimiter);

// 获取动态流
router.get('/', FeedController.getFeed);

// 创建心情动态
router.post('/create', FeedController.createMoment);

// 创建作品展示
router.post('/create-showcase', FeedController.createShowcase);

// 创建投票
router.post('/create-poll', FeedController.createPoll);

// 对投票进行投票
router.post('/:id/vote', FeedController.votePoll);

// 点赞
router.post('/:id/like', FeedController.likeFeedItem);

// 取消点赞
router.delete('/:id/unlike', FeedController.unlikeFeedItem);

// 获取评论
router.get('/:id/comments', FeedController.getComments);

// 发表评论
router.post('/:id/comments', FeedController.addComment);

// 删除评论
router.delete('/comments/:commentId', FeedController.deleteComment);

// 收藏动态
router.post('/:id/bookmark', FeedController.bookmarkFeedItem);

// 取消收藏动态
router.delete('/:id/bookmark', FeedController.unbookmarkFeedItem);

// 举报动态
router.post('/:id/report', FeedController.reportFeedItem);

module.exports = router;
