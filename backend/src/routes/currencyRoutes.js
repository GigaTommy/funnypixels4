const express = require('express');
const router = express.Router();
const CurrencyController = require('../controllers/currencyController');
const { authenticateToken } = require('../middleware/auth');
const { rewardClaimLimiter } = require('../middleware/rateLimit');

// 所有路由都需要认证
router.use(authenticateToken);

// 积分相关
router.get('/points', CurrencyController.getUserPoints);

// 成就相关
router.get('/achievements', CurrencyController.getAllAchievements);
router.get('/achievements/user', CurrencyController.getUserAchievements);
router.get('/achievements/completed', CurrencyController.getUserCompletedAchievements);
router.get('/achievements/stats', CurrencyController.getUserAchievementStats);
router.get('/achievements/highlights', CurrencyController.getUserAchievementHighlights);
router.post('/achievements/:achievementId/claim', rewardClaimLimiter, CurrencyController.claimAchievementReward);

// 签到相关
router.post('/checkin', rewardClaimLimiter, CurrencyController.dailyCheckin);
router.get('/checkin/records', CurrencyController.getUserCheckins);
router.get('/checkin/stats', CurrencyController.getUserCheckinStats);
router.get('/checkin/can-checkin', CurrencyController.canCheckinToday);
router.get('/checkin/calendar', CurrencyController.getCheckinCalendar);
router.get('/checkin/can-recover', CurrencyController.canRecoverStreak);
router.post('/checkin/recover', rewardClaimLimiter, CurrencyController.recoverStreak);

module.exports = router;
