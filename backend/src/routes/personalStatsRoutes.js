const express = require('express');
const PersonalStatsController = require('../controllers/personalStatsController');
const { authenticateToken } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.use(authenticateToken);
router.use(apiLimiter);

// 获取个人仪表盘
router.get('/dashboard', PersonalStatsController.getDashboard);

// 获取今日统计
router.get('/today', PersonalStatsController.getTodayStats);

module.exports = router;
