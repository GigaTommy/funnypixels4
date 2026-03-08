const express = require('express');
const router = express.Router();
const AchievementController = require('../controllers/achievementController');
const { authenticateToken } = require('../middleware/auth');
const { rewardClaimLimiter } = require('../middleware/rateLimit');

// 所有路由都需要认证
router.use(authenticateToken);

// 用户成就相关路由
router.get('/user/:userId/stats', AchievementController.getUserStats);
router.get('/user/:userId/achievements', AchievementController.getUserAchievements);
router.get('/user/:userId/rank', AchievementController.getUserRank);

// 领取成就奖励
router.post('/:id/claim', rewardClaimLimiter, AchievementController.claimReward);

// 当前用户相关路由
router.get('/my/overview', AchievementController.getMyAchievementOverview);
router.post('/my/check', AchievementController.triggerAchievementCheck);

// 成就定义和排行榜
router.get('/definitions', AchievementController.getAllAchievements);
router.get('/leaderboard', AchievementController.getAchievementLeaderboard);

module.exports = router;