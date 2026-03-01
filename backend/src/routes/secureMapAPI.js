const express = require('express');
const axios = require('axios');
const { db } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// 高德地图API配置（从环境变量获取）
const AMAP_API_KEY = process.env.AMAP_API_KEY;
const AMAP_WEB_SERVICE_KEY = process.env.AMAP_WEB_SERVICE_KEY;
const AMAP_BASE_URL = 'https://restapi.amap.com/v3';

// 请求频率限制（每个IP每分钟最多60次请求）
const rateLimit = new Map();

const checkRateLimit = (req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowStart = now - 60000; // 1分钟窗口

  if (!rateLimit.has(clientIP)) {
    rateLimit.set(clientIP, []);
  }

  const requests = rateLimit.get(clientIP);

  // 清理过期的请求记录
  const validRequests = requests.filter(timestamp => timestamp > windowStart);
  rateLimit.set(clientIP, validRequests);

  if (validRequests.length >= 60) {
    return res.status(429).json({
      success: false,
      error: '请求过于频繁，请稍后再试'
    });
  }

  // 记录当前请求
  validRequests.push(now);
  next();
};

// 应用速率限制
router.use(checkRateLimit);

/**
 * 地理编码代理
 * POST /api/map/geocode
 */
router.post('/geocode', async (req, res) => {
  try {
    const { address } = req.body;

    if (!address || typeof address !== 'string') {
      return res.status(400).json({
        success: false,
        error: '地址参数无效'
      });
    }

    if (!AMAP_WEB_SERVICE_KEY) {
      return res.status(500).json({
        success: false,
        error: '地图服务未配置'
      });
    }

    const response = await axios.get(`${AMAP_BASE_URL}/geocode/geo`, {
      params: {
        key: AMAP_WEB_SERVICE_KEY,
        address: address.trim(),
        output: 'json'
      },
      timeout: 5000
    });

    // 记录API使用情况（不记录敏感信息）
    logger.info('Geocoding request processed', {
      address: address.substring(0, 10) + '...', // 只记录前10个字符
      success: response.data.status === '1'
    });

    res.json(response.data);

  } catch (error) {
    logger.error('Geocoding proxy error:', error.message);
    res.status(500).json({
      success: false,
      error: '地理编码服务暂时不可用'
    });
  }
});

/**
 * 逆地理编码代理
 * POST /api/map/reverse-geocode
 */
router.post('/reverse-geocode', async (req, res) => {
  try {
    const { lng, lat } = req.body;

    if (!lng || !lat || isNaN(lng) || isNaN(lat)) {
      return res.status(400).json({
        success: false,
        error: '坐标参数无效'
      });
    }

    if (!AMAP_WEB_SERVICE_KEY) {
      return res.status(500).json({
        success: false,
        error: '地图服务未配置'
      });
    }

    const response = await axios.get(`${AMAP_BASE_URL}/geocode/regeo`, {
      params: {
        key: AMAP_WEB_SERVICE_KEY,
        location: `${lng},${lat}`,
        output: 'json'
      },
      timeout: 5000
    });

    // 记录API使用情况（不记录具体坐标）
    logger.info('Reverse geocoding request processed', {
      lng: parseFloat(lng).toFixed(2),
      lat: parseFloat(lat).toFixed(2),
      success: response.data.status === '1'
    });

    res.json(response.data);

  } catch (error) {
    logger.error('Reverse geocoding proxy error:', error.message);
    res.status(500).json({
      success: false,
      error: '逆地理编码服务暂时不可用'
    });
  }
});

/**
 * POI搜索代理
 * POST /api/map/search-poi
 */
router.post('/search-poi', async (req, res) => {
  try {
    const { keyword, city } = req.body;

    if (!keyword || typeof keyword !== 'string') {
      return res.status(400).json({
        success: false,
        error: '搜索关键词无效'
      });
    }

    if (!AMAP_WEB_SERVICE_KEY) {
      return res.status(500).json({
        success: false,
        error: '地图服务未配置'
      });
    }

    const response = await axios.get(`${AMAP_BASE_URL}/place/text`, {
      params: {
        key: AMAP_WEB_SERVICE_KEY,
        keywords: keyword.trim(),
        city: city || '',
        output: 'json',
        offset: 20,
        page: 1
      },
      timeout: 5000
    });

    // 记录搜索请求（不记录完整关键词）
    logger.info('POI search request processed', {
      keyword: keyword.substring(0, 5) + '...',
      city: city || '全国',
      resultCount: response.data.pois?.length || 0,
      success: response.data.status === '1'
    });

    res.json(response.data);

  } catch (error) {
    logger.error('POI search proxy error:', error.message);
    res.status(500).json({
      success: false,
      error: 'POI搜索服务暂时不可用'
    });
  }
});

/**
 * 搜索建议代理
 * POST /api/map/suggestions
 */
router.post('/suggestions', async (req, res) => {
  try {
    const { keyword, city } = req.body;

    if (!keyword || typeof keyword !== 'string') {
      return res.status(400).json({
        success: false,
        error: '搜索关键词无效'
      });
    }

    if (!AMAP_WEB_SERVICE_KEY) {
      return res.status(500).json({
        success: false,
        error: '地图服务未配置'
      });
    }

    const response = await axios.get(`${AMAP_BASE_URL}/place/text`, {
      params: {
        key: AMAP_WEB_SERVICE_KEY,
        keywords: keyword.trim(),
        city: city || '',
        output: 'json',
        offset: 10,
        page: 1,
        type: '080000' // 综合类型
      },
      timeout: 5000
    });

    logger.info('Suggestions request processed', {
      keyword: keyword.substring(0, 5) + '...',
      city: city || '全国',
      success: response.data.status === '1'
    });

    res.json(response.data);

  } catch (error) {
    logger.error('Suggestions proxy error:', error.message);
    res.status(500).json({
      success: false,
      error: '搜索建议服务暂时不可用'
    });
  }
});

module.exports = router;