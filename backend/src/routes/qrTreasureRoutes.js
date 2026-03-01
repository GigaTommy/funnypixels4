const express = require('express');
const router = express.Router();
const { QRTreasureController, upload } = require('../controllers/qrTreasureController');
const { authMiddleware } = require('../middleware/auth');

// 所有路由都需要认证
router.use(authMiddleware);

/**
 * @route POST /api/qr-treasures/scan
 * @desc 扫一扫 - 统一入口
 * @access Private
 */
router.post('/scan', QRTreasureController.scanQRCode);

/**
 * @route POST /api/qr-treasures/hide
 * @desc 藏宝（支持图片上传）
 * @access Private
 */
router.post('/hide', upload.single('image'), QRTreasureController.hideTreasure);

/**
 * @route POST /api/qr-treasures/:treasureId/claim
 * @desc 领取宝藏
 * @access Private
 */
router.post('/:treasureId/claim', QRTreasureController.claimTreasure);

/**
 * @route GET /api/qr-treasures/my-hidden
 * @desc 获取我的藏宝记录
 * @access Private
 */
router.get('/my-hidden', QRTreasureController.getMyHiddenTreasures);

/**
 * @route GET /api/qr-treasures/my-found
 * @desc 获取我的寻宝记录
 * @access Private
 */
router.get('/my-found', QRTreasureController.getMyFoundTreasures);

/**
 * @route GET /api/qr-treasures/:treasureId
 * @desc 获取宝藏详情
 * @access Private
 */
router.get('/:treasureId', QRTreasureController.getTreasureDetail);

/**
 * @route POST /api/qr-treasures/nearby
 * @desc 获取附近宝藏列表
 * @access Private
 */
router.post('/nearby', QRTreasureController.getNearbyTreasures);

/**
 * @route POST /api/qr-treasures/bounds
 * @desc 获取指定区域内的宝藏
 * @access Private
 */
router.post('/bounds', QRTreasureController.getTreasuresInBounds);

/**
 * @route GET /api/qr-treasures/:treasureId/trail
 * @desc 获取移动宝藏轨迹
 * @access Private
 */
router.get('/:treasureId/trail', QRTreasureController.getTreasureTrail);

module.exports = router;
