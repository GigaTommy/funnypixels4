const express = require('express');
const router = express.Router();
const pixelsHistoryController = require('../controllers/pixelsHistoryController');
const { authenticateToken } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimit');

/**
 * 像素历史路由
 * 提供像素历史查询和分析功能
 */

// 应用认证中间件到所有路由
router.use(authenticateToken);

// 应用速率限制
router.use(apiLimiter);

/**
 * 获取用户像素操作历史
 * GET /api/pixels-history/user/:userId
 * 
 * 查询参数:
 * - startDate: 开始日期 (YYYY-MM-DD)
 * - endDate: 结束日期 (YYYY-MM-DD)
 * - actionType: 操作类型 (draw, bomb, clear等)
 * - limit: 限制条数 (默认100, 最大1000)
 * - offset: 偏移量 (默认0)
 */
router.get('/user/:userId', async (req, res) => {
  await pixelsHistoryController.getUserPixelHistory(req, res);
});

/**
 * 获取像素位置的历史变化
 * GET /api/pixels-history/location/:gridId
 * 
 * 查询参数:
 * - startDate: 开始日期 (YYYY-MM-DD)
 * - endDate: 结束日期 (YYYY-MM-DD)
 * - limit: 限制条数 (默认100, 最大1000)
 * - offset: 偏移量 (默认0)
 */
router.get('/location/:gridId', async (req, res) => {
  await pixelsHistoryController.getPixelLocationHistory(req, res);
});

/**
 * 获取用户行为统计
 * GET /api/pixels-history/user/:userId/stats
 * 
 * 查询参数:
 * - startDate: 开始日期 (YYYY-MM-DD, 默认30天前)
 * - endDate: 结束日期 (YYYY-MM-DD, 默认今天)
 */
router.get('/user/:userId/stats', async (req, res) => {
  await pixelsHistoryController.getUserBehaviorStats(req, res);
});

/**
 * 获取区域活跃度统计
 * GET /api/pixels-history/region/stats
 * 
 * 查询参数:
 * - startDate: 开始日期 (YYYY-MM-DD, 默认7天前)
 * - endDate: 结束日期 (YYYY-MM-DD, 默认今天)
 * - regionId: 区域ID (可选)
 */
router.get('/region/stats', async (req, res) => {
  await pixelsHistoryController.getRegionActivityStats(req, res);
});

/**
 * 获取像素历史统计概览
 * GET /api/pixels-history/stats/overview
 * 
 * 查询参数:
 * - startDate: 开始日期 (YYYY-MM-DD)
 * - endDate: 结束日期 (YYYY-MM-DD)
 */
router.get('/stats/overview', async (req, res) => {
  await pixelsHistoryController.getHistoryOverview(req, res);
});

module.exports = router;
