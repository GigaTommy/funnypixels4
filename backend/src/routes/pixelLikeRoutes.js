const express = require('express');
const router = express.Router();
const PixelLikeController = require('../controllers/pixelLikeController');
const { authenticateToken } = require('../middleware/auth');

// 所有路由都需要认证
router.use(authenticateToken);

// 像素点赞相关路由 - 支持按坐标访问
router.post('/:lat/:lng/like', PixelLikeController.likePixelByCoords);
router.delete('/:lat/:lng/like', PixelLikeController.unlikePixelByCoords);
router.get('/:lat/:lng/like-status', PixelLikeController.checkLikeStatusByCoords);
router.get('/:lat/:lng/likers', PixelLikeController.getPixelLikersByCoords);

// 像素点赞相关路由 - 按像素ID访问
router.post('/:pixelId/like', PixelLikeController.likePixel);
router.delete('/:pixelId/like', PixelLikeController.unlikePixel);
router.get('/:pixelId/like-status', PixelLikeController.checkLikeStatus);
router.get('/:pixelId/likers', PixelLikeController.getPixelLikers);

// 批量操作
router.post('/batch/like-status', PixelLikeController.checkMultipleLikeStatus);

// 用户相关统计
router.get('/user/:userId/stats', PixelLikeController.getUserLikeStats);
router.get('/user/my/likes', PixelLikeController.getUserLikes);
router.get('/user/my/received-likes', PixelLikeController.getUserReceivedLikes);

// 热门像素
router.get('/popular', PixelLikeController.getPopularPixels);

module.exports = router;