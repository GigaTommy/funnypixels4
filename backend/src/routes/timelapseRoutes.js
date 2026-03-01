const express = require('express');
const router = express.Router();
const timelapseController = require('../controllers/timelapseController');
const { authenticateToken } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimit');

/**
 * 延时摄影路由
 */

// 允许认证用户生成延时记录
router.post('/generate', authenticateToken, apiLimiter, (req, res) => {
    timelapseController.generate(req, res);
});

module.exports = router;
