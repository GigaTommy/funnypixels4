const express = require('express');
const router = express.Router();
const CustomFlagController = require('../controllers/customFlagController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// 所有路由都需要认证
router.use(authenticateToken);

/**
 * @route GET /api/custom-flags/patterns
 * @desc 获取用户可用的自定义图案
 * @access Private
 */
router.get('/patterns', CustomFlagController.getUserCustomPatterns);

/**
 * @route POST /api/custom-flags/orders
 * @desc 创建自定义旗帜订单
 * @access Private
 */
router.post('/orders', CustomFlagController.createCustomFlagOrder);

/**
 * @route GET /api/custom-flags/orders
 * @desc 获取用户的自定义旗帜订单
 * @access Private
 */
router.get('/orders', CustomFlagController.getUserCustomFlagOrders);

/**
 * @route GET /api/custom-flags/orders/:orderId
 * @desc 获取自定义旗帜订单详情
 * @access Private
 */
router.get('/orders/:orderId', CustomFlagController.getOrderDetails);

/**
 * @route GET /api/custom-flags/admin/orders
 * @desc 管理员：获取待审核的自定义旗帜订单
 * @access Private (Admin only)
 */
router.get('/admin/orders', requireAdmin, CustomFlagController.getPendingOrders);

/**
 * @route POST /api/custom-flags/admin/review
 * @desc 管理员：审核自定义旗帜订单
 * @access Private (Admin only)
 */
router.post('/admin/review', requireAdmin, CustomFlagController.reviewCustomFlagOrder);

module.exports = router;
