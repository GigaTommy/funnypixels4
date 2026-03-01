/**
 * 图案API路由
 * 提供图案的CRUD操作和批量处理接口
 */

const express = require('express');
const router = express.Router();
const PatternStorageService = require('../services/patternStorageService');
const PatternCacheService = require('../services/patternCacheService');
const logger = require('../utils/logger');
const auth = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

// 创建服务实例
const patternStorageService = new PatternStorageService();
const patternCacheService = new PatternCacheService();

// 限流配置
const patternLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 1000, // 限制每个IP 15分钟内最多1000个请求（增加10倍，支持大量像素渲染）
  message: {
    success: false,
    error: '请求过于频繁，请稍后再试'
  }
});

const batchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 20, // 限制每个IP 15分钟内最多20个批量请求
  message: {
    success: false,
    error: '批量请求过于频繁，请稍后再试'
  }
});

/**
 * 获取单个图案
 * GET /api/patterns/:patternId
 */
router.get('/:patternId', patternLimiter, async (req, res) => {
  try {
    const { patternId } = req.params;
    const { resolution = 'original', format = 'webp' } = req.query;
    
    logger.info(`获取图案: ${patternId} (${resolution}, ${format})`);
    
    // 1. 从存储服务获取（包含Redis缓存和数据库查询）
    const pattern = await patternStorageService.getPattern(patternId, {
      resolution,
      format
    });
    
    if (!pattern) {
      return res.status(404).json({
        success: false,
        error: '图案不存在'
      });
    }
    
    res.json({
      success: true,
      data: pattern,
      cached: pattern.cached || false,
      source: pattern.cached ? 'redis' : 'database'
    });
    
  } catch (error) {
    logger.error('获取图案失败:', error);
    res.status(500).json({
      success: false,
      error: '获取图案失败'
    });
  }
});

/**
 * 批量获取图案
 * POST /api/patterns/batch
 */
router.post('/batch', batchLimiter, async (req, res) => {
  try {
    const { patternIds, resolution = 'original', format = 'webp' } = req.body;
    
    if (!Array.isArray(patternIds) || patternIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: '图案ID列表不能为空'
      });
    }
    
    if (patternIds.length > 100) {
      return res.status(400).json({
        success: false,
        error: '批量请求数量不能超过100个'
      });
    }
    
    logger.info(`批量获取图案: ${patternIds.length}个`);
    
    // 1. 批量检查Redis缓存
    const cachedPatterns = await patternCacheService.batchGet(patternIds, resolution, format);
    
    // 2. 获取未缓存的图案
    const uncachedIds = patternIds.filter(id => !cachedPatterns.has(id));
    let dbPatterns = new Map();
    
    if (uncachedIds.length > 0) {
      dbPatterns = await patternStorageService.batchGetPatterns(uncachedIds, {
        resolution,
        format
      });
      
      // 3. 缓存新获取的图案
      if (dbPatterns.size > 0) {
        await patternCacheService.batchSet(dbPatterns, resolution, format, 'normal');
      }
    }
    
    // 4. 合并结果
    const allPatterns = new Map([...cachedPatterns, ...dbPatterns]);
    
    res.json({
      success: true,
      data: Object.fromEntries(allPatterns),
      cached: cachedPatterns.size,
      total: allPatterns.size,
      source: {
        redis: cachedPatterns.size,
        database: dbPatterns.size
      }
    });
    
  } catch (error) {
    logger.error('批量获取图案失败:', error);
    res.status(500).json({
      success: false,
      error: '批量获取图案失败'
    });
  }
});

module.exports = router;