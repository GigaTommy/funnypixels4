const express = require('express');
const UnifiedPaymentController = require('../controllers/unifiedPaymentController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// 公开接口
router.get('/methods', UnifiedPaymentController.getPaymentMethods);

// 需要认证的接口
router.use(authenticateToken);

// 支付相关
router.post('/create', UnifiedPaymentController.createPayment);
router.post('/points', UnifiedPaymentController.payWithPoints);
router.get('/order/:method/:orderId', UnifiedPaymentController.queryOrder);

// 支付回调（无需认证）
router.post('/callback/:method', UnifiedPaymentController.handleCallback);

// 开发环境模拟支付
if (process.env.NODE_ENV !== 'production') {
  router.post('/simulate/:method/:orderId', UnifiedPaymentController.simulatePayment);
}

module.exports = router;
