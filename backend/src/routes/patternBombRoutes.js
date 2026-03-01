const express = require('express');
const router = express.Router();
const PatternBombController = require('../controllers/patternBombController');
const { authenticateToken } = require('../middleware/auth');

// 所有路由都需要认证
router.use(authenticateToken);

// 获取预设图案列表
router.get('/patterns', PatternBombController.getPresetPatterns);

// 创建图案炸弹
router.post('/create', PatternBombController.createBomb);

// 获取用户的图案炸弹
router.get('/user-bombs', PatternBombController.getUserBombs);

// 应用图案炸弹效果
router.post('/apply', PatternBombController.applyBombEffect);

// 获取用户的图案炸弹使用历史
router.get('/history', PatternBombController.getBombHistory);

// 删除图案炸弹
router.delete('/:bombId', PatternBombController.deleteBomb);

// 检查用户是否有可用的图案炸弹
router.get('/check-available', PatternBombController.checkAvailableBomb);

// 预览图案效果
router.post('/preview', PatternBombController.previewPattern);

module.exports = router;
