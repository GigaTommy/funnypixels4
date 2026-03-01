const DriftBottle = require('../models/DriftBottle');
const JourneyCard = require('../models/JourneyCard');
const logger = require('../utils/logger');
const cacheService = require('../services/driftBottleCacheService');
const { db } = require('../config/database');
const quotaService = require('../services/driftBottleQuotaService');
const guidanceService = require('../services/bottleGuidanceService');
const gpsTrajectoryService = require('../services/gpsTrajectoryService');
const bottlePickupDistanceService = require('../services/bottlePickupDistanceService');

class DriftBottleController {
  /**
   * POST /drift-bottles/throw — 扔出漂流瓶
   */
  static async throwBottle(req, res) {
    try {
      const { lat, lng, message, pixel_snapshot } = req.body;
      const userId = req.user.id;

      if (lat == null || lng == null) {
        return res.status(400).json({
          success: false,
          messageKey: 'drift_bottle.error.missing_location'
        });
      }
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return res.status(400).json({
          success: false,
          messageKey: 'drift_bottle.error.invalid_coordinates'
        });
      }
      if (message && message.length > 50) {
        return res.status(400).json({
          success: false,
          messageKey: 'drift_bottle.error.message_too_long'
        });
      }

      const bottle = await DriftBottle.createBottle(
        userId,
        parseFloat(lat),
        parseFloat(lng),
        message,
        pixel_snapshot
      );

      res.json({
        success: true,
        messageKey: 'drift_bottle.throw.success',
        data: { bottle }
      });
    } catch (error) {
      logger.error('扔出漂流瓶失败:', error);

      // 处理i18n key格式的错误
      const messageKey = error.message.startsWith('drift_bottle.')
        ? error.message
        : 'drift_bottle.error.throw_failed';

      res.status(error.message.includes('quota') || error.message.includes('上限') ? 400 : 500).json({
        success: false,
        messageKey
      });
    }
  }

  /**
   * POST /drift-bottles/:bottleId/open — 打开漂流瓶（消耗配额）
   */
  static async openBottle(req, res) {
    try {
      const { bottleId } = req.params;
      const { lat, lng, message } = req.body;
      const userId = req.user.id;

      if (!bottleId) {
        return res.status(400).json({
          success: false,
          messageKey: 'drift_bottle.error.missing_bottle_id'
        });
      }
      if (lat == null || lng == null) {
        return res.status(400).json({
          success: false,
          messageKey: 'drift_bottle.error.missing_location'
        });
      }
      if (message && message.length > 50) {
        return res.status(400).json({
          success: false,
          messageKey: 'drift_bottle.error.message_too_long'
        });
      }

      // 验证锁定状态
      const lockKey = `drift_bottle:lock:${bottleId}:${userId}`;
      const { redisUtils } = require('../config/redis');
      const lockData = await redisUtils.get(lockKey);
      if (!lockData) {
        return res.status(400).json({
          success: false,
          messageKey: 'drift_bottle.error.not_locked'
        });
      }

      const result = await DriftBottle.openBottle(
        bottleId,
        userId,
        parseFloat(lat),
        parseFloat(lng),
        message
      );

      // 清除锁定
      await redisUtils.del(lockKey);

      // 记录成功拾取
      await guidanceService.recordSuccessfulPickup(userId);

      // 如果沉没, 通过socket通知所有参与者
      if (result.didSink && result.journeyCard) {
        try {
          const socketManager = require('../services/socketManager');
          if (socketManager.io) {
            socketManager.broadcastBottleSunk(
              result.journeyCard.participants,
              {
                bottleId,
                reason: 'max_openers',
                journeyDetail: result.journeyCard.journeyDetail
              }
            );
          }
        } catch (socketError) {
          logger.warn('推送沉没事件失败:', socketError);
        }
      }

      const messageKey = result.didSink
        ? 'drift_bottle.open.success_sunk'
        : 'drift_bottle.open.success';

      res.json({
        success: true,
        messageKey,
        data: {
          bottle: result.bottle,
          didSink: result.didSink,
          journeyCard: result.didSink ? result.journeyCard?.journeyDetail : null
        }
      });
    } catch (error) {
      logger.error('打开漂流瓶失败:', error);

      // 处理i18n key格式的错误
      let messageKey = 'drift_bottle.error.open_failed';
      if (error.message.startsWith('drift_bottle.')) {
        messageKey = error.message;
      } else if (error.message.includes('不存在') || error.message.includes('沉没')) {
        messageKey = 'drift_bottle.error.bottle_not_available';
      } else if (error.message.includes('已经打开')) {
        messageKey = 'drift_bottle.error.already_opened';
      } else if (error.message.includes('自己的')) {
        messageKey = 'drift_bottle.error.own_bottle';
      }

      const status = messageKey.includes('not_available') ? 404 : 400;
      res.status(status).json({
        success: false,
        messageKey
      });
    }
  }

  /**
   * GET /drift-bottles/encounter — 检查遭遇(附近瓶子)
   */
  static async checkEncounter(req, res) {
    try {
      const { lat, lng } = req.query;
      const userId = req.user.id;

      if (!lat || !lng) {
        return res.status(400).json({ success: false, message: '缺少位置信息' });
      }

      const encounter = await DriftBottle.findBottlesNearUser(
        userId,
        parseFloat(lat),
        parseFloat(lng)
      );

      res.json({
        success: true,
        data: encounter
      });
    } catch (error) {
      logger.error('检查遭遇失败:', error);
      res.status(500).json({ success: false, message: '检查遭遇失败' });
    }
  }

  /**
   * GET /drift-bottles/quota — 获取配额信息
   */
  static async getQuota(req, res) {
    try {
      const userId = req.user.id;
      const quota = await quotaService.getQuota(userId);

      res.json({
        success: true,
        data: quota
      });
    } catch (error) {
      logger.error('获取配额失败:', error);
      res.status(500).json({ success: false, message: '获取配额信息失败' });
    }
  }

  /**
   * GET /drift-bottles/journey-cards — 获取旅途卡片列表
   */
  static async getJourneyCards(req, res) {
    try {
      const userId = req.user.id;
      const page = parseInt(req.query.page) || 1;
      const limit = Math.min(parseInt(req.query.limit) || 20, 50);

      const result = await JourneyCard.getCardsByUser(userId, { page, limit });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('获取旅途卡片失败:', error);
      res.status(500).json({ success: false, message: '获取旅途卡片失败' });
    }
  }

  /**
   * GET /drift-bottles/journey-cards/:bottleId — 获取旅途卡片详情
   */
  static async getJourneyCardDetail(req, res) {
    try {
      const { bottleId } = req.params;

      const detail = await JourneyCard.getCardDetail(bottleId);

      res.json({
        success: true,
        data: detail
      });
    } catch (error) {
      logger.error('获取旅途卡片详情失败:', error);
      res.status(500).json({ success: false, message: '获取旅途卡片详情失败' });
    }
  }

  /**
   * POST /drift-bottles/:bottleId/reunion — 创建者重逢
   */
  static async reunionBottle(req, res) {
    try {
      const { bottleId } = req.params;
      const { lat, lng } = req.body;
      const userId = req.user.id;

      if (lat == null || lng == null) {
        return res.status(400).json({ success: false, message: '缺少位置信息' });
      }

      const bottle = await DriftBottle.reunionBottle(
        bottleId,
        userId,
        parseFloat(lat),
        parseFloat(lng)
      );

      res.json({
        success: true,
        message: '你的漂流瓶回来了！',
        data: { bottle }
      });
    } catch (error) {
      logger.error('重逢漂流瓶失败:', error);
      res.status(error.message.includes('不是你的') ? 403 : 500).json({
        success: false,
        message: error.message || '重逢失败'
      });
    }
  }

  /**
   * PUT /drift-bottles/journey-cards/:cardId/read — 标记旅途卡片已读
   */
  static async markCardRead(req, res) {
    try {
      const { cardId } = req.params;
      const userId = req.user.id;

      await JourneyCard.markAsRead(parseInt(cardId), userId);

      res.json({ success: true, message: '已标记为已读' });
    } catch (error) {
      logger.error('标记已读失败:', error);
      res.status(500).json({ success: false, message: '标记已读失败' });
    }
  }

  /**
   * GET /drift-bottles/:bottleId — 获取漂流瓶详情
   */
  static async getBottleDetails(req, res) {
    try {
      const { bottleId } = req.params;

      const bottle = await DriftBottle.getBottleById(bottleId);
      if (!bottle) {
        return res.status(404).json({ success: false, message: '漂流瓶不存在' });
      }

      res.json({ success: true, data: { bottle } });
    } catch (error) {
      logger.error('获取漂流瓶详情失败:', error);
      res.status(500).json({ success: false, message: '获取详情失败' });
    }
  }

  /**
   * GET /drift-bottles/:bottleId/history — 获取漂流瓶历史
   */
  static async getBottleHistory(req, res) {
    try {
      const { bottleId } = req.params;

      const history = await db('drift_bottle_history as dbh')
        .join('users as u', 'dbh.user_id', 'u.id')
        .where('dbh.bottle_id', bottleId)
        .orderBy('dbh.created_at', 'desc')
        .select(['dbh.*', 'u.username', 'u.avatar as user_avatar']);

      res.json({ success: true, data: { history } });
    } catch (error) {
      logger.error('获取漂流瓶历史失败:', error);
      res.status(500).json({ success: false, message: '获取历史失败' });
    }
  }

  /**
   * GET /drift-bottles/map-markers — 获取地图标记（附近的瓶子）
   */
  static async getMapMarkers(req, res) {
    try {
      const { lat, lng, radius } = req.query;
      const userId = req.user.id;

      if (!lat || !lng) {
        return res.status(400).json({
          success: false,
          messageKey: 'drift_bottle.error.missing_location'
        });
      }

      const radiusKm = parseFloat(radius) || 2; // 默认2公里

      logger.info(`🗺️ getMapMarkers: lat=${lat}, lng=${lng}, radius=${radiusKm}km, userId=${userId}`);

      // 查找附近的瓶子
      const bottles = await DriftBottle.getNearbyDriftingBottles(
        parseFloat(lat),
        parseFloat(lng),
        radiusKm
      );

      logger.info(`🗺️ getNearbyDriftingBottles returned ${bottles.length} bottles`);

      // 过滤掉用户已经打开过的瓶子
      const openedBottleIds = await db('journey_cards')
        .where({ participant_id: userId })
        .select('bottle_id');
      const openedSet = new Set(openedBottleIds.map(r => r.bottle_id));

      const availableBottles = bottles.filter(bottle =>
        bottle.original_owner_id !== userId && !openedSet.has(bottle.bottle_id)
      );

      if (bottles.length > 0 && availableBottles.length === 0) {
        logger.info(`🗺️ All ${bottles.length} bottles filtered out (own: ${bottles.filter(b => b.original_owner_id === userId).length}, opened: ${bottles.filter(b => openedSet.has(b.bottle_id)).length})`);
      }

      // 记录空搜索或成功搜索
      if (availableBottles.length === 0) {
        await guidanceService.recordEmptySearch(userId);
      }

      res.json({
        success: true,
        data: {
          bottles: availableBottles.map(b => ({
            bottle_id: b.bottle_id,
            lat: parseFloat(b.current_lat),
            lng: parseFloat(b.current_lng),
            distance: DriftBottle.calculateDistance(
              parseFloat(lat),
              parseFloat(lng),
              parseFloat(b.current_lat),
              parseFloat(b.current_lng)
            )
          }))
        }
      });
    } catch (error) {
      logger.error('获取地图标记失败:', error);
      res.status(500).json({
        success: false,
        messageKey: 'drift_bottle.error.get_markers_failed'
      });
    }
  }

  /**
   * POST /drift-bottles/:bottleId/lock — 锁定漂流瓶
   * 整合GPS验证、距离验证、配额检查
   */
  static async lockBottle(req, res) {
    try {
      const { bottleId } = req.params;
      const { lat, lng, accuracy, speed, heading } = req.body;
      const userId = req.user.id;

      // 1. 基本验证
      if (!bottleId) {
        return res.status(400).json({
          success: false,
          messageKey: 'drift_bottle.error.missing_bottle_id'
        });
      }
      if (lat == null || lng == null) {
        return res.status(400).json({
          success: false,
          messageKey: 'drift_bottle.error.missing_location'
        });
      }

      // 2. GPS精度检查（简单验证）
      if (accuracy && accuracy > 100) {
        await guidanceService.recordPoorGps(userId);
        return res.status(400).json({
          success: false,
          messageKey: 'drift_bottle.error.gps_quality_poor',
          data: { accuracy }
        });
      } else if (accuracy) {
        await guidanceService.clearPoorGps(userId);
      }

      // 3. 获取瓶子信息
      const bottle = await DriftBottle.getBottleById(bottleId);
      if (!bottle || !bottle.is_active || bottle.is_sunk) {
        return res.status(404).json({
          success: false,
          messageKey: 'drift_bottle.error.bottle_not_available'
        });
      }

      // 4. 检查是否是自己的瓶子
      if (bottle.original_owner_id === userId) {
        return res.status(400).json({
          success: false,
          messageKey: 'drift_bottle.error.own_bottle'
        });
      }

      // 5. 检查是否已打开过
      const alreadyOpened = await db('journey_cards')
        .where({ bottle_id: bottleId, participant_id: userId })
        .first();
      if (alreadyOpened) {
        return res.status(400).json({
          success: false,
          messageKey: 'drift_bottle.error.already_opened'
        });
      }

      // 6. 距离验证
      const distanceValidation = await bottlePickupDistanceService.validatePickupDistance(
        userId,
        parseFloat(lat),
        parseFloat(lng),
        accuracy || 20,
        bottle
      );

      if (!distanceValidation.valid) {
        return res.status(400).json({
          success: false,
          messageKey: 'drift_bottle.error.too_far',
          data: {
            distance: distanceValidation.distance,
            threshold: distanceValidation.threshold,
            shortfall: distanceValidation.shortfall
          }
        });
      }

      // 7. 配额检查
      const hasQuota = await quotaService.hasPickupQuota(userId);
      if (!hasQuota) {
        return res.status(400).json({
          success: false,
          messageKey: 'drift_bottle.error.no_pickup_quota'
        });
      }

      // 8. 锁定瓶子（记录到Redis，5分钟有效）
      const lockKey = `drift_bottle:lock:${bottleId}:${userId}`;
      const { redisUtils } = require('../config/redis');
      await redisUtils.setex(lockKey, 300, JSON.stringify({
        lat,
        lng,
        accuracy,
        lockedAt: new Date().toISOString()
      }));

      // 记录成功搜索
      await guidanceService.recordSuccessfulSearch(userId);

      res.json({
        success: true,
        messageKey: 'drift_bottle.lock.success',
        data: {
          bottle: {
            bottle_id: bottle.bottle_id,
            content: bottle.content,
            pixel_snapshot: bottle.pixel_snapshot,
            messages: bottle.messages,
            current_city: bottle.current_city,
            current_country: bottle.current_country,
            pickup_count: bottle.pickup_count,
            total_distance: bottle.total_distance
          },
          lockExpireAt: new Date(Date.now() + 300000).toISOString()
        }
      });
    } catch (error) {
      logger.error('锁定漂流瓶失败:', error);
      res.status(500).json({
        success: false,
        messageKey: 'drift_bottle.error.lock_failed'
      });
    }
  }

  /**
   * POST /drift-bottles/:bottleId/abandon — 放弃漂流瓶
   */
  static async abandonBottle(req, res) {
    try {
      const { bottleId } = req.params;
      const userId = req.user.id;

      if (!bottleId) {
        return res.status(400).json({
          success: false,
          messageKey: 'drift_bottle.error.missing_bottle_id'
        });
      }

      // 解锁瓶子
      const lockKey = `drift_bottle:lock:${bottleId}:${userId}`;
      const { redisUtils } = require('../config/redis');
      await redisUtils.del(lockKey);

      // 记录放弃行为
      await guidanceService.recordAbandon(userId);

      res.json({
        success: true,
        messageKey: 'drift_bottle.abandon.success'
      });
    } catch (error) {
      logger.error('放弃漂流瓶失败:', error);
      res.status(500).json({
        success: false,
        messageKey: 'drift_bottle.error.abandon_failed'
      });
    }
  }

  /**
   * GET /drift-bottles/guidance — 获取智能引导
   */
  static async getGuidance(req, res) {
    try {
      const userId = req.user.id;

      const guidance = await guidanceService.getGuidance(userId);

      if (!guidance) {
        return res.json({
          success: true,
          data: null
        });
      }

      res.json({
        success: true,
        data: guidance
      });
    } catch (error) {
      logger.error('获取引导失败:', error);
      res.status(500).json({
        success: false,
        messageKey: 'drift_bottle.error.get_guidance_failed'
      });
    }
  }
}

module.exports = DriftBottleController;
