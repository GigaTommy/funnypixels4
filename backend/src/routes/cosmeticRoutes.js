const express = require('express');
const router = express.Router();
const CosmeticController = require('../controllers/cosmeticController');
const { authenticateToken } = require('../middleware/auth');

// 所有路由都需要认证
router.use(authenticateToken);

// 获取用户的所有装饰品
router.get('/user', CosmeticController.getUserCosmetics);

// 获取用户装备的装饰品
router.get('/equipped', CosmeticController.getEquippedCosmetics);

// 获取用户特定类型的装饰品
router.get('/type/:cosmeticType', CosmeticController.getUserCosmeticsByType);

// 装备装饰品
router.put('/equip/:cosmeticId', CosmeticController.equipCosmetic);

// 取消装备装饰品
router.put('/unequip/:cosmeticType', CosmeticController.unequipCosmetic);

// 删除装饰品
router.delete('/:cosmeticId', CosmeticController.deleteCosmetic);

// 获取装饰品预览
router.get('/preview/:cosmeticType/:cosmeticName', CosmeticController.getCosmeticPreview);

// 获取所有装饰品类型
router.get('/types', CosmeticController.getCosmeticTypes);

// 从商店购买装饰品
router.post('/purchase', CosmeticController.purchaseCosmetic);

// 检查用户是否拥有特定装饰品
router.get('/check/:cosmeticType/:cosmeticName', CosmeticController.checkHasCosmetic);

// 使用装饰品（从商店库存中使用）
router.post('/use-from-inventory', CosmeticController.useCosmeticFromInventory);

// 获取用户最新使用的装饰品
router.get('/latest', CosmeticController.getLatestUsedCosmetic);

module.exports = router;
