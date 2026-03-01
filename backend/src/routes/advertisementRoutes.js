const express = require('express');
const AdvertisementController = require('../controllers/advertisementController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// 公开接口
router.get('/active', AdvertisementController.getActiveAdvertisements);

// 需要认证的接口
router.use(authenticateToken);

// 创建广告投放
router.post('/', AdvertisementController.createAdvertisement);

// 获取用户广告列表
router.get('/user', AdvertisementController.getUserAdvertisements);

// 获取用户广告额度
router.get('/ad-credits', AdvertisementController.getUserAdCredits);

// 更新广告状态
router.patch('/:id/status', AdvertisementController.updateAdvertisementStatus);

// 删除广告
router.delete('/:id', AdvertisementController.deleteAdvertisement);

module.exports = router;
