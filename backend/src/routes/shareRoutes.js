const express = require('express');
const router = express.Router();
const ShareController = require('../controllers/shareController');
const { generateThumbnail } = require('../controllers/thumbnailController');
const { authenticateToken } = require('../middleware/auth');
const { rewardClaimLimiter } = require('../middleware/rateLimit');

// 生成战果图
router.post('/generate-battle-result', authenticateToken, ShareController.generateBattleResult);

// 生成二维码
router.post('/generate-qrcode', authenticateToken, ShareController.generateQRCode);

// 获取分享统计
router.get('/stats', authenticateToken, ShareController.getShareStats);

// 记录分享行为
router.post('/record', authenticateToken, ShareController.recordShare);

// 记录分享行为并奖励
router.post('/record-action', authenticateToken, rewardClaimLimiter, ShareController.recordShareAction);

// 🔥 新增：获取分享追踪统计
router.get('/tracking-stats', authenticateToken, ShareController.getShareTrackingStats);

// 生成缩略图 🔧 新增缺失的API
router.post('/thumbnail', authenticateToken, generateThumbnail);

// 生成足迹图
router.post('/generate-footprint', authenticateToken, ShareController.generateFootprint);

// 获取足迹图数据
router.get('/footprint/:sessionId', ShareController.getFootprint);
router.get('/page/session/:sessionId', ShareController.getSessionSharePage);

module.exports = router;