const express = require('express');
const router = express.Router();
const pixelSessionController = require('../controllers/pixelSessionController');
const { authenticateToken } = require('../middleware/auth');

// 所有路由都需要身份验证
router.use(authenticateToken);

/**
 * GET /api/pixel-sessions/sessions
 * 获取用户绘制会话历史
 * Query参数:
 * - page: 页码 (默认: 1)
 * - limit: 每页数量 (默认: 20)
 * - threshold: 会话间隔阈值，分钟 (默认: 30)
 */
router.get('/sessions', pixelSessionController.getUserDrawingSessions);

/**
 * GET /api/pixel-sessions/sessions/:sessionId
 * 获取指定会话的详情
 * 路径参数:
 * - sessionId: 会话ID
 */
router.get('/sessions/:sessionId', pixelSessionController.getSessionDetails);

/**
 * GET /api/pixel-sessions/stats
 * 获取用户绘制统计数据
 */
router.get('/stats', pixelSessionController.getUserDrawingStats);

/**
 * GET /api/pixel-sessions/overview
 * 获取绘制历史概览（用于仪表板）
 */
router.get('/overview', pixelSessionController.getDrawingHistoryOverview);

/**
 * GET /api/pixel-sessions/export
 * 导出绘制历史数据
 * Query参数:
 * - format: 导出格式 (json/csv, 默认: json)
 * - startDate: 开始日期
 * - endDate: 结束日期
 */
router.get('/export', pixelSessionController.exportDrawingHistory);

module.exports = router;