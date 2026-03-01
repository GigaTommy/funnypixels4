/**
 * 高德地图API测试接口
 * 用于验证AMap API与MapLibre GL的兼容性
 */

const express = require('express');
const router = express.Router();
const amapWebService = require('../services/amapWebService');

/**
 * 测试高德API与MapLibre GL兼容性
 * GET /api/test/amap-compatibility
 */
router.get('/amap-compatibility', async (req, res) => {
  try {
    const { lat, lng } = req.query;

    // 使用默认坐标（北京天安门）或用户提供坐标
    const testLat = parseFloat(lat) || 39.9042;
    const testLng = parseFloat(lng) || 116.4074;

    // 执行兼容性测试
    const results = await amapWebService.testMapLibreGLCompatibility(testLat, testLng);

    res.json({
      success: true,
      data: {
        testCoordinates: { lat: testLat, lng: testLng },
        compatibility: results,
        config: amapWebService.getMapLibreGLConfig(),
        serviceStatus: amapWebService.getServiceStatus()
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('AMap API兼容性测试失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 测试坐标转换
 * GET /api/test/coordinate-transform
 */
router.get('/coordinate-transform', async (req, res) => {
  try {
    const { lat, lng, system = 'WGS84' } = req.query;

    const testLat = parseFloat(lat) || 39.9042;
    const testLng = parseFloat(lng) || 116.4074;

    // 获取坐标转换信息
    const transformInfo = amapWebService.getCoordinateTransformInfo(testLat, testLng, system);

    // 测试实际逆地理编码
    const geocodeResult = await amapWebService.reverseGeocodeForMapLibre(testLat, testLng, {
      inputCoordSys: system
    });

    res.json({
      success: true,
      data: {
        input: { lat: testLat, lng: testLng, system },
        transform: transformInfo,
        geocode: geocodeResult,
        summary: {
          originalSystem: system,
          wgs84: transformInfo.wgs84,
          gcj02: transformInfo.gcj02,
          mapLibreGL: transformInfo.forMapLibreGL,
          amapAPI: transformInfo.forAmapAPI
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('坐标转换测试失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 测试批量坐标转换
 * POST /api/test/batch-transform
 */
router.post('/batch-transform', async (req, res) => {
  try {
    const { coordinates, targetSystem = 'WGS84' } = req.body;

    if (!Array.isArray(coordinates) || coordinates.length === 0) {
      return res.status(400).json({
        success: false,
        error: '坐标数组不能为空'
      });
    }

    // 执行批量转换
    const transformed = amapWebService.batchCoordinateTransform(coordinates, targetSystem);

    res.json({
      success: true,
      data: {
        inputCount: coordinates.length,
        targetSystem,
        results: transformed
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('批量坐标转换测试失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 获取AMap Web Service服务状态
 * GET /api/test/amap-status
 */
router.get('/amap-status', (req, res) => {
  try {
    const status = amapWebService.getServiceStatus();
    const config = amapWebService.getMapLibreGLConfig();

    res.json({
      success: true,
      data: {
        service: status,
        mapLibreGL: config,
        environment: {
          nodeEnv: process.env.NODE_ENV,
          hasApiKey: !!process.env.AMAP_API_KEY,
          apiKeyPrefix: process.env.AMAP_API_KEY ? process.env.AMAP_API_KEY.substring(0, 8) + '...' : 'null'
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('获取AMap服务状态失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;