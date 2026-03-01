const express = require('express');
const RankTierController = require('../controllers/rankTierController');
const { authenticateToken } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.use(apiLimiter);

// 获取所有段位列表（公开）
router.get('/', RankTierController.getAllTiers);

// 获取当前用户段位（需要认证）
router.get('/me', authenticateToken, RankTierController.getMyTier);

module.exports = router;
