const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/dashboardController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// 所有路由都需要管理员权限
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * @route GET /api/dashboard/stats
 * @desc 获取Dashboard统计数据
 * @access Private (Admin only)
 */
router.get('/stats', DashboardController.getStats);

/**
 * @route GET /api/dashboard/recent-activities
 * @desc 获取最近活动
 * @access Private (Admin only)
 */
router.get('/recent-activities', DashboardController.getRecentActivities);

module.exports = router;
