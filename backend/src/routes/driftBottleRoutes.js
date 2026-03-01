const express = require('express');
const DriftBottleController = require('../controllers/driftBottleController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * 漂流瓶 v2 路由
 */

// 所有路由需要认证
router.use(authenticateToken);

// 创建漂流瓶
router.post('/throw', DriftBottleController.throwBottle);

// 锁定漂流瓶（新）
router.post('/:bottleId/lock', DriftBottleController.lockBottle);

// 打开漂流瓶
router.post('/:bottleId/open', DriftBottleController.openBottle);

// 放弃漂流瓶（新）
router.post('/:bottleId/abandon', DriftBottleController.abandonBottle);

// 创建者重逢
router.post('/:bottleId/reunion', DriftBottleController.reunionBottle);

// 检查遭遇(附近瓶子) - 兼容旧版
router.get('/encounter', DriftBottleController.checkEncounter);

// 获取地图标记（新）
router.get('/map-markers', DriftBottleController.getMapMarkers);

// 获取智能引导（新）
router.get('/guidance', DriftBottleController.getGuidance);

// 获取配额信息
router.get('/quota', DriftBottleController.getQuota);

// 旅途卡片列表
router.get('/journey-cards', DriftBottleController.getJourneyCards);

// 旅途卡片详情
router.get('/journey-cards/:bottleId', DriftBottleController.getJourneyCardDetail);

// 标记旅途卡片已读
router.put('/journey-cards/:cardId/read', DriftBottleController.markCardRead);

// 获取漂流瓶详情
router.get('/:bottleId', DriftBottleController.getBottleDetails);

// 获取漂流瓶历史
router.get('/:bottleId/history', DriftBottleController.getBottleHistory);

module.exports = router;
