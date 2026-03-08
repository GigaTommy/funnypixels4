const express = require('express');
const DailyTaskController = require('../controllers/dailyTaskController');
const { authenticateToken } = require('../middleware/auth');
const { rewardClaimLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.use(authenticateToken);

// 获取今日任务
router.get('/', DailyTaskController.getTasks);

// 领取任务奖励
router.post('/:id/claim', rewardClaimLimiter, DailyTaskController.claimReward);

// 领取全勤奖励
router.post('/bonus/claim', rewardClaimLimiter, DailyTaskController.claimBonus);

module.exports = router;
