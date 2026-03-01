const express = require('express');
const StoreController = require('../controllers/storeController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// 公开接口
router.get('/items', StoreController.getAllItems);
router.get('/items/type/:type', StoreController.getItemsByType);

// 需要认证的接口
router.use(authenticateToken);

// 商店相关
router.post('/purchase', StoreController.purchaseItem);
router.post('/callback/:orderId', StoreController.handlePaymentCallback);
router.get('/inventory', StoreController.getUserInventory);
router.post('/use', StoreController.useItem);
router.get('/points', StoreController.getUserPoints);

// 联盟旗帜相关
router.get('/flag-patterns', StoreController.getAvailableFlagPatterns);

// 装饰品相关
router.get('/cosmetics', StoreController.getUserCosmetics);

module.exports = router;
