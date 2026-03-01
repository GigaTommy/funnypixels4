const express = require('express');
const GeographicController = require('../controllers/geographicController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * 地理统计相关路由
 * 支持行政区划边界数据导入、像素地理归属、地理排行榜等功能
 */

// 公开路由 - 不需要认证
router.get('/leaderboard/province', GeographicController.getProvinceLeaderboard);
router.get('/leaderboard/city', GeographicController.getCityLeaderboard);
router.get('/leaderboard/country', GeographicController.getCountryLeaderboard);
router.get('/region/:level/:regionCode/stats', GeographicController.getRegionDetailStats);
router.get('/heatmap', GeographicController.getRegionHeatmapData);
router.get('/hotspots', GeographicController.getDailyHotspots); // 兼容旧接口
router.get('/roaming/cities', GeographicController.getRoamingCities); // 新接口：漫游城市列表
router.get('/pixel/:gridId/location', GeographicController.getPixelLocation);
router.get('/stats', GeographicController.getLocationStats);

// 管理路由 - 需要认证
router.post('/import/regions', authenticateToken, GeographicController.importRegionData);
router.get('/validate/regions', authenticateToken, GeographicController.validateRegionData);
router.post('/process/pixels', authenticateToken, GeographicController.triggerPixelLocationProcessing);
router.post('/update/leaderboard', authenticateToken, GeographicController.triggerLeaderboardUpdate);
router.post('/compute/hotspots', authenticateToken, GeographicController.triggerHotspotComputation); // 手动触发热点统计
router.post('/performance/test', authenticateToken, GeographicController.runHotspotPerformanceTest); // 性能对比测试
router.get('/performance/trends', GeographicController.getHotspotPerformanceTrends); // 性能趋势数据
router.get('/maintenance/status', authenticateToken, GeographicController.getMaintenanceStatus);
router.post('/maintenance/start', authenticateToken, GeographicController.startMaintenanceService);
router.post('/maintenance/stop', authenticateToken, GeographicController.stopMaintenanceService);

module.exports = router;
