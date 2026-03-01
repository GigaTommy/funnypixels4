const express = require('express');
const router = express.Router();
const BadgeController = require('../controllers/badgeController');
const { authenticateToken } = require('../middleware/auth');

// GET /api/badges — 获取所有 Tab 的 badge 计数
router.get('/', authenticateToken, BadgeController.getBadgeCounts);

module.exports = router;
