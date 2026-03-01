const express = require('express');
const DailyTaskController = require('../controllers/dailyTaskController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

// 获取今日任务
router.get('/', DailyTaskController.getTasks);

// 领取任务奖励
router.post('/:id/claim', DailyTaskController.claimReward);

// 领取全勤奖励
router.post('/bonus/claim', DailyTaskController.claimBonus);

module.exports = router;
