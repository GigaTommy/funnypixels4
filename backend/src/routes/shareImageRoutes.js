const express = require('express');
const router = express.Router();
const { generateShareImage } = require('../controllers/shareImageController');
const { authenticateToken } = require('../middleware/auth');

// 生成运动轨迹分享图片
router.post('/generate-share-image', authenticateToken, generateShareImage);

module.exports = router;