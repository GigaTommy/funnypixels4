const express = require('express');
const router = express.Router();
const HistoryController = require('../controllers/historyController');
const { authMiddleware } = require('../middleware/auth');

// 所有路由都需要认证
router.use(authMiddleware);

/**
 * @route GET /api/history
 * @desc 获取用户完整历史记录
 * @query type - 记录类型: bottles, treasures, all (默认: all)
 * @query period - 时间范围: day, week, month, all (默认: all)
 * @query action - 行为类型: picked, hidden, found, created, scanned, all (默认: all)
 * @query limit - 分页大小 (默认: 20)
 * @query offset - 分页偏移 (默认: 0)
 * @query sortBy - 排序字段 (默认: created_at)
 * @query sortOrder - 排序方向: asc, desc (默认: desc)
 * @access Private
 */
router.get('/', HistoryController.getUserHistory);

/**
 * @route GET /api/history/stats
 * @desc 获取历史记录统计信息
 * @access Private
 */
router.get('/stats', HistoryController.getHistoryStats);

/**
 * @route GET /api/history/achievements
 * @desc 获取用户成就进度
 * @access Private
 */
router.get('/achievements', HistoryController.getUserAchievements);

module.exports = router;