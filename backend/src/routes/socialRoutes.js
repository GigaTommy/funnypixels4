const express = require('express');
const router = express.Router();
const SocialController = require('../controllers/socialController');
const { authenticateToken } = require('../middleware/auth');

// 所有路由都需要认证
router.use(authenticateToken);

// 用户关注相关
router.post('/follow/:userId', SocialController.followUser);
router.delete('/unfollow/:userId', SocialController.unfollowUser);
router.get('/follow-status/:userId', SocialController.checkFollowStatus);
router.get('/following/:userId', SocialController.getFollowing);
router.get('/followers/:userId', SocialController.getFollowers);
router.get('/mutual-follows/:userId', SocialController.getMutualFollows);
router.get('/recommended-follows', SocialController.getRecommendedFollows);
router.get('/user-stats/:userId', SocialController.getUserStats);

// 排行榜相关
router.get('/leaderboard', SocialController.getLeaderboard);
router.get('/user-rank/:userId', SocialController.getUserRank);
router.get('/alliance-rank/:allianceId', SocialController.getAllianceRank);
router.get('/leaderboard-history', SocialController.getLeaderboardHistory);

module.exports = router;
