const express = require('express');
const LeaderboardController = require('../controllers/leaderboardController');
const { authenticateToken } = require('../middleware/auth');
const { leaderboardLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// 所有路由都需要认证 + 限流（使用排行榜专用限流器，独立计数器，避免与其他API路由互相干扰）
router.use(authenticateToken);
router.use(leaderboardLimiter);

// HTTP 缓存头：让客户端 URLSession 自动缓存 GET 请求（30 秒）
// private = 仅客户端私有缓存（含用户特定数据），不被 CDN/代理缓存
// 429 响应不经过此中间件（被 leaderboardLimiter 拦截后不调用 next()）
router.use((req, res, next) => {
  if (req.method === 'GET') {
    res.set('Cache-Control', 'private, max-age=30');
  }
  next();
});

// 聚合接口：一次请求返回所有排行榜（个人+好友+联盟+城市）
router.get('/all', LeaderboardController.getAllLeaderboards);

// 获取个人排行榜
router.get('/personal', LeaderboardController.getPersonalLeaderboard);

// 获取联盟排行榜
router.get('/alliance', LeaderboardController.getAllianceLeaderboard);

// 获取城市排行榜
router.get('/city', LeaderboardController.getCityLeaderboard);

// 获取好友排行榜
router.get('/friends', LeaderboardController.getFriendsLeaderboard);

// 点赞排行榜项目
router.post('/like', LeaderboardController.likeLeaderboardItem);

// 取消点赞排行榜项目
router.delete('/unlike', LeaderboardController.unlikeLeaderboardItem);

// 缓存管理路由
router.delete('/cache/clear', LeaderboardController.clearLeaderboardCache);
router.delete('/cache/city/clear', LeaderboardController.clearCityLeaderboardCache);
router.get('/cache/stats', LeaderboardController.getCacheStats);
router.post('/cache/city/preload', LeaderboardController.preloadCityCache);

module.exports = router;
