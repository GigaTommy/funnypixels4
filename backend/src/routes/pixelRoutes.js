const express = require('express');
const PixelController = require('../controllers/pixelController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// 获取像素统计 - 必须放在 /:id 之前
router.get('/stats', PixelController.getPixelStats);

// 获取热门区域
router.get('/hot-zones', PixelController.getHotZones);

// 获取单个像素
router.get('/:id', PixelController.getPixel);

// 获取像素列表
router.get('/', PixelController.getPixels);

// 创建像素
router.post('/', authenticateToken, PixelController.createPixel);

// 更新像素
router.put('/:id', authenticateToken, PixelController.updatePixel);

// 删除像素
router.delete('/:id', authenticateToken, PixelController.deletePixel);

// 批量获取像素
router.post('/batch', PixelController.getPixelsBatch);

// 新增：按地理范围获取像素 - 高效版本
router.post('/area', PixelController.getPixelsByArea);

// 新增：获取像素详细信息 - 包含用户信息和联盟信息
router.get('/details/:gridId', PixelController.getPixelDetails);

// 举报像素
router.post('/:lat/:lng/report', authenticateToken, PixelController.reportPixel);

module.exports = router;

