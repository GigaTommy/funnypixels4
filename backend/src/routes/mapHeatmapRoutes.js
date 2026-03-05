const express = require('express');
const MapHeatmapController = require('../controllers/mapHeatmapController');
const { authenticateToken } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');

const router = express.Router();

/**
 * 地图热力图路由
 * 提供绘制活跃区域热力图数据
 */

// 热力图专用限流器: 30 req/min
const heatmapLimiter = createRateLimiter(
  60 * 1000,
  30,
  '热力图请求过于频繁，请稍后再试',
  'rl:heatmap'
);

/**
 * 获取热力图数据
 * GET /api/map/heatmap?zoom=12&bounds=lat1,lng1,lat2,lng2&period=24h
 *
 * 返回 GeoJSON FeatureCollection，每个点包含 weight 属性
 */
router.get('/heatmap', authenticateToken, heatmapLimiter, MapHeatmapController.getHeatmapData);

module.exports = router;
