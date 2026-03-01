const express = require('express');
const router = express.Router();
const { authenticateToken: auth, optionalAuth } = require('../middleware/auth');
const { pixelLimiter } = require('../middleware/rateLimit');
const PixelDrawService = require('../services/pixelDrawService');
const { normalizePixelWritePayload } = require('../utils/pixelPayload');
const DriftBottle = require('../models/DriftBottle');
const logger = require('../utils/logger');

// 获取PixelDrawService实例（需要在server.js中初始化）
let pixelDrawService = null;

// 设置PixelDrawService实例的方法
const setPixelDrawService = (service) => {
  pixelDrawService = service;
};

/**
 * 手动绘制像素
 * POST /api/pixel-draw/manual
 */
router.post('/manual', auth, pixelLimiter, async (req, res) => {
  try {
    if (!pixelDrawService) {
      return res.status(500).json({
        success: false,
        error: '绘制服务未初始化'
      });
    }

    const userId = req.user.id;

    let normalizedPayload;
    try {
      normalizedPayload = normalizePixelWritePayload(req.body, {
        userId,
        drawType: 'manual'
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    console.log('🔍 手动绘制路由接收到的参数:', normalizedPayload);

    const result = await pixelDrawService.handlePixelDraw(normalizedPayload);

    if (result.success) {
      // 🔧 优化：像素绘制成功后，失效今日统计缓存
      try {
        const PersonalStatsController = require('../controllers/personalStatsController');
        await PersonalStatsController.invalidateTodayStatsCache(userId);
      } catch (cacheErr) {
        // 缓存失效失败不影响主流程
        logger.debug('缓存失效失败（不影响主流程）:', cacheErr.message);
      }

      res.json({
        success: true,
        data: {
          pixel: result.pixel,
          consumptionResult: result.consumptionResult,
          processingTime: result.processingTime
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('手动绘制像素失败:', error);
    res.status(500).json({
      success: false,
      error: '绘制失败，请稍后重试'
    });
  }
});

/**
 * GPS绘制像素
 * POST /api/pixel-draw/gps
 */
router.post('/gps', auth, pixelLimiter, async (req, res) => {
  try {
    if (!pixelDrawService) {
      return res.status(500).json({
        success: false,
        error: '绘制服务未初始化'
      });
    }

    const userId = req.user.id;

    let normalizedPayload;
    try {
      normalizedPayload = normalizePixelWritePayload(req.body, {
        userId,
        drawType: 'gps'
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    console.log('🔍 GPS绘制路由接收到的参数:', normalizedPayload);

    const result = await pixelDrawService.handlePixelDraw(normalizedPayload);

    if (result.success) {
      // 🔧 优化：像素绘制成功后，失效今日统计缓存
      try {
        const PersonalStatsController = require('../controllers/personalStatsController');
        await PersonalStatsController.invalidateTodayStatsCache(userId);
      } catch (cacheErr) {
        // 缓存失效失败不影响主流程
        logger.debug('缓存失效失败（不影响主流程）:', cacheErr.message);
      }

      const responseData = {
        pixel: result.pixel,
        consumptionResult: result.consumptionResult,
        processingTime: result.processingTime
      };

      // GPS绘制成功后，检查是否有漂流瓶需要拾取
      try {
        const { latitude: lat, longitude: lng } = normalizedPayload;

        // 查找该位置附近的漂流瓶（100米范围内）
        const nearbyBottles = await DriftBottle.getNearbyDriftingBottles(lat, lng, 0.1);

        if (nearbyBottles && nearbyBottles.length > 0) {
          // 拾取最近的漂流瓶
          const bottle = nearbyBottles[0];

          // 检查用户是否已经持有这个瓶子
          if (bottle.owner_id !== userId) {
            try {
              const pickedBottle = await DriftBottle.pickupBottle(bottle.bottle_id, userId, lat, lng);

              responseData.driftBottlePickup = {
                success: true,
                bottle: pickedBottle,
                message: '🍾 恭喜！你拾到了一个漂流瓶！'
              };

              logger.info('GPS绘制时自动拾取漂流瓶成功', {
                userId,
                bottleId: bottle.bottle_id,
                location: { lat, lng }
              });
            } catch (pickupError) {
              logger.error('GPS绘制时拾取漂流瓶失败:', pickupError);
              // 拾取失败不影响绘制成功的结果
              responseData.driftBottlePickup = {
                success: false,
                message: pickupError.message
              };
            }
          }
        }
      } catch (bottleError) {
        // 漂流瓶检查失败不影响绘制成功的结果
        logger.error('GPS绘制时检查漂流瓶失败:', bottleError);
      }

      res.json({
        success: true,
        data: responseData
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('GPS绘制像素失败:', error);
    res.status(500).json({
      success: false,
      error: '绘制失败，请稍后重试'
    });
  }
});

/**
 * 批量绘制像素
 * POST /api/pixel-draw/batch
 */
router.post('/batch', auth, pixelLimiter, async (req, res) => {
  try {
    if (!pixelDrawService) {
      return res.status(500).json({
        success: false,
        error: '绘制服务未初始化'
      });
    }

    const { pixels, drawType = 'manual' } = req.body;

    // 验证参数
    if (!Array.isArray(pixels) || pixels.length === 0) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: pixels数组'
      });
    }

    if (pixels.length > 100) {
      return res.status(400).json({
        success: false,
        error: '批量绘制数量不能超过100个'
      });
    }

    const userId = req.user.id;

    const normalizationErrors = [];
    const pixelDataArray = pixels.reduce((acc, pixel, index) => {
      try {
        acc.push(normalizePixelWritePayload(pixel, { userId, drawType }));
      } catch (error) {
        normalizationErrors.push({ index, error: error.message });
      }
      return acc;
    }, []);

    if (pixelDataArray.length === 0) {
      return res.status(400).json({
        success: false,
        error: '没有有效的像素数据',
        details: normalizationErrors
      });
    }

    const result = await pixelDrawService.handleBatchPixelDraw(pixelDataArray);

    if (normalizationErrors.length > 0) {
      result.validationErrors = normalizationErrors;
    }

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('批量绘制像素失败:', error);
    res.status(500).json({
      success: false,
      error: '批量绘制失败，请稍后重试'
    });
  }
});

/**
 * 获取绘制服务状态
 * GET /api/pixel-draw/status
 */
router.get('/status', auth, async (req, res) => {
  try {
    if (!pixelDrawService) {
      return res.status(500).json({
        success: false,
        error: '绘制服务未初始化'
      });
    }

    res.json({
      success: true,
      data: {
        service: 'PixelDrawService',
        version: '1.0.0',
        features: ['manual_draw', 'gps_draw', 'batch_draw', 'tile_broadcast'],
        status: 'running',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('获取绘制服务状态失败:', error);
    res.status(500).json({
      success: false,
      error: '获取状态失败'
    });
  }
});

/**
 * 验证用户绘制状态
 * GET /api/pixel-draw/validate
 */
router.get('/validate', optionalAuth, async (req, res) => {
  try {
    if (!pixelDrawService) {
      return res.status(500).json({
        success: false,
        error: '绘制服务未初始化'
      });
    }

    // 支持游客模式
    let userId = req.user?.id;
    
    // 如果没有认证用户，尝试从查询参数获取游客ID
    if (!userId) {
      userId = req.query.userId;
    }
    
    // 检查是否为游客ID（无论来源）
    if (userId && userId.startsWith('guest_')) {
      // 为游客创建简化的状态
      const guestState = {
        canDraw: false,
        reason: '游客模式无法绘制，请先登录',
        userState: {
          user_id: userId,
          pixel_points: 0,
          last_accum_time: Math.floor(Date.now() / 1000),
          freeze_until: 0
        }
      };
      
      return res.json({
        success: true,
        data: guestState
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '需要用户认证或游客ID'
      });
    }

    const userState = await pixelDrawService.validateUserState(userId);

    res.json({
      success: true,
      data: userState
    });

  } catch (error) {
    console.error('验证用户绘制状态失败:', error);
    res.status(500).json({
      success: false,
      error: '验证失败'
    });
  }
});

module.exports = {
  router,
  setPixelDrawService
};
