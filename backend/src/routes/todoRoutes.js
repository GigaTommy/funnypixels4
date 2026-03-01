const express = require('express');
const router = express.Router();
const TodoController = require('../controllers/todoController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// 所有路由都需要管理员权限
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * @route GET /api/admin/todos/stats
 * @desc 获取待办统计数据
 * @access Private (Admin only)
 */
router.get('/stats', TodoController.getTodoStats);

/**
 * @route GET /api/admin/todos
 * @desc 获取待办列表
 * @access Private (Admin only)
 */
router.get('/', TodoController.getTodos);

/**
 * @route POST /api/admin/todos/process
 * @desc 处理单个待办事项
 * @access Private (Admin only)
 */
router.post('/process', TodoController.processTodo);

/**
 * @route POST /api/admin/todos/batch-process
 * @desc 批量处理待办事项
 * @access Private (Admin only)
 */
router.post('/batch-process', TodoController.batchProcess);

module.exports = router;
