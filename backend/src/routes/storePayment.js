const express = require('express');
const StorePaymentController = require('../controllers/storePaymentController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// 公开接口
router.get('/items', StorePaymentController.getStoreItems);

// 需要认证的接口
router.use(authenticateToken);

// 钱包相关
router.get('/wallet', StorePaymentController.getWallet);
router.get('/points', StorePaymentController.getUserPoints);

// 商店相关
router.post('/buy', StorePaymentController.buyItem);
router.get('/inventory', StorePaymentController.getInventory);
router.post('/use', StorePaymentController.useItem);

// 充值相关
router.post('/recharge/session', StorePaymentController.createRechargeSession);
router.post('/recharge', StorePaymentController.createRechargeSession);
router.get('/recharge-orders', StorePaymentController.getRechargeOrders);
router.get('/transactions', StorePaymentController.getTransactions);
router.get('/orders/:orderId', StorePaymentController.getOrderStatus);
router.get('/orders/:orderId/status', StorePaymentController.getOrderStatus);
router.post('/orders/:orderId/confirm', StorePaymentController.confirmPayment);

// Apple In-App Purchase 验证
router.post('/apple/verify', StorePaymentController.verifyAppleIAP);

// 支付回调（无需认证）
router.post('/webhooks/wechat', StorePaymentController.wechatCallback);
router.post('/webhooks/alipay', StorePaymentController.alipayCallback);

// 开发环境模拟支付
if (process.env.NODE_ENV !== 'production') {
  router.post('/__dev/pay/:orderId', StorePaymentController.simulatePayment);
}

module.exports = router;
