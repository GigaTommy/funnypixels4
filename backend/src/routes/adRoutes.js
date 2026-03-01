const express = require('express');
const router = express.Router();
const AdController = require('../controllers/adController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// 所有路由都需要认证
router.use(authenticateToken);

// 获取广告商品列表
router.get('/products', AdController.getAdProducts);

// 创建广告订单
router.post('/orders', AdController.createAdOrder);

// 获取用户的广告订单
router.get('/orders', AdController.getUserAdOrders);

// 获取用户的广告库存
router.get('/inventory', AdController.getUserAdInventory);

// 使用广告道具
router.post('/inventory/use', AdController.useAdItem);

// 获取用户的广告放置记录
router.get('/placements', AdController.getUserAdPlacements);

// 获取广告订单详情
router.get('/orders/:orderId', AdController.getAdOrderDetails);

// 管理员路由
// 获取待审核的广告订单
router.get('/admin/orders/pending', requireAdmin, AdController.getPendingAdOrders);

// 审核广告订单
router.post('/admin/orders/:orderId/review', requireAdmin, AdController.reviewAdOrder);

module.exports = router;