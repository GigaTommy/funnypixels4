/**
 * 头像相关路由
 */

const express = require('express');
const AvatarController = require('../controllers/avatarController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * 头像管理路由
 */

// 公开路由 - 不需要认证
router.get('/stats', AvatarController.getAvatarStats);

// 用户相关路由 - 暂时不需要认证用于测试
router.post('/user/:userId/avatar', AvatarController.generateAvatarUrl);
router.get('/user/:userId', (req, res, next) => {
  console.log('🔍 路由匹配测试:', req.originalUrl, req.params);
  AvatarController.getUserAvatar(req, res, next);
});
router.post('/batch/generate', AvatarController.batchGenerateAvatarUrls);
router.post('/warmup', AvatarController.warmupUserAvatars);
router.delete('/cache/clear', AvatarController.clearAvatarCache);

// TODO: 生产环境中需要认证
// router.post('/user/:userId/avatar', authenticateToken, AvatarController.generateAvatarUrl);
// router.get('/user/:userId', authenticateToken, AvatarController.getUserAvatar);
// router.post('/batch/generate', authenticateToken, AvatarController.batchGenerateAvatarUrls);
// router.post('/warmup', authenticateToken, AvatarController.warmupUserAvatars);
// router.delete('/cache/clear', authenticateToken, AvatarController.clearAvatarCache);

// 管理员路由 - 需要管理员权限
// TODO: 添加管理员权限中间件
// router.get('/admin/stats', requireAdmin, AvatarController.getAvatarStats);
// router.delete('/admin/cleanup', requireAdmin, AvatarController.clearAvatarCache);

module.exports = router;