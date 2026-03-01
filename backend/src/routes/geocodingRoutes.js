const express = require('express');
const router = express.Router();
const geocodingService = require('../services/geocodingService');
// 注意：已移除MaxMind相关服务，改用高德地图Web服务API

/**
 * 地理编码服务状态API
 */
router.get('/status', async (req, res) => {
  try {
    const status = await geocodingService.getServiceStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取地理编码服务状态失败',
      error: error.message
    });
  }
});

/**
 * 测试地理编码功能
 */
router.post('/test', async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: '缺少经纬度参数'
      });
    }

    const result = await geocodingService.reverseGeocode(parseFloat(latitude), parseFloat(longitude));

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '地理编码测试失败',
      error: error.message
    });
  }
});

/**
 * 注意：MaxMind数据库更新功能已移除
 * 如需类似功能，请使用高德地图Web服务API
 */
router.post('/update-database', async (req, res) => {
  res.status(501).json({
    success: false,
    message: 'MaxMind数据库更新功能已移除，请使用高德地图Web服务API',
    alternative: '高德地图Web服务API自动处理地理编码，无需手动更新数据库'
  });
});

/**
 * 获取数据库信息
 */
router.get('/database-info', async (req, res) => {
  try {
    const dbInfo = maxmindDatabaseManager.getDatabaseInfo();
    res.json({
      success: true,
      data: dbInfo
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取数据库信息失败',
      error: error.message
    });
  }
});

/**
 * 批量测试地理编码
 */
router.post('/batch-test', async (req, res) => {
  try {
    const { coordinates } = req.body;

    if (!coordinates || !Array.isArray(coordinates)) {
      return res.status(400).json({
        success: false,
        message: '缺少坐标数组参数'
      });
    }

    const results = [];
    for (const coord of coordinates) {
      try {
        const result = await geocodingService.reverseGeocode(
          parseFloat(coord.latitude),
          parseFloat(coord.longitude)
        );
        results.push({
          latitude: coord.latitude,
          longitude: coord.longitude,
          result: result,
          success: true
        });
      } catch (error) {
        results.push({
          latitude: coord.latitude,
          longitude: coord.longitude,
          error: error.message,
          success: false
        });
      }
    }

    res.json({
      success: true,
      data: {
        total: coordinates.length,
        success: results.filter(r => r.success).length,
        failed: results.filter(r => r.success === false).length,
        results: results
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '批量测试失败',
      error: error.message
    });
  }
});

module.exports = router;