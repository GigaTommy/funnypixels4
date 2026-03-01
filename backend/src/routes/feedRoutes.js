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

module.exports = router;
