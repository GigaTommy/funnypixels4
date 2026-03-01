const express = require('express');
const router = express.Router();
const PaymentAdminController = require('../../controllers/paymentAdminController');
const { authenticateToken, requireAdmin } = require('../../middleware/auth');

router.use(authenticateToken, requireAdmin);

router.get('/transactions', PaymentAdminController.getTransactions);
router.get('/recharge-orders', PaymentAdminController.getRechargeOrders);
router.post('/refund', PaymentAdminController.processRefund);
router.get('/stats', PaymentAdminController.getPaymentStats);
router.get('/user/:userId/history', PaymentAdminController.getUserPaymentHistory);

module.exports = router;
