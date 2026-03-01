const { db } = require('../config/database');
const logger = require('../utils/logger');
const crypto = require('crypto');
const cacheService = require('../services/driftBottleCacheService');
const geocodingService = require('../services/geocodingService');
const quotaService = require('../services/driftBottleQuotaService');

class DriftBottle {
  /**
   * 生成唯一的漂流瓶ID
   */
  static generateBottleId() {
    return 'bottle_' + crypto.randomBytes(12).toString('hex');
  }

  /**
   * 格式化漂流瓶对象，确保数值类型正确（decimal列返回string需转number）
   */
  static formatBottle(bottle) {
    if (!bottle) return null;
    return {
      ...bottle,
      current_lat: parseFloat(bottle.current_lat),
      current_lng: parseFloat(bottle.current_lng),
      origin_lat: parseFloat(bottle.origin_lat),
      origin_lng: parseFloat(bottle.origin_lng),
      total_distance: parseInt(bottle.total_distance) || 0,
      pickup_count: parseInt(bottle.pickup_count) || 0,
      message_count: parseInt(bottle.message_count) || 0,
      open_count: parseInt(bottle.open_count) || 0,
      max_openers: parseInt(bottle.max_openers) || 5,
      direction_angle: parseFloat(bottle.direction_angle) || 0
    };
  }

  // ─── 创建瓶子 ──────────────────────────────────────────────

  /**
   * 创建漂流瓶(含5x5像素快照)
   */
  static async createBottle(userId, lat, lng, message, pixelSnapshot) {
    const trx = await db.transaction();

    try {
      // 1. 检查并消耗抛瓶配额
      const hasQuota = await quotaService.hasThrowQuota(userId);
      if (!hasQuota) {
        throw new Error('drift_bottle.error.no_throw_quota');
      }

      // 消耗配额（在事务中）
      await quotaService.consumeThrowQuota(userId, trx);

      const bottleId = this.generateBottleId();
      const locationInfo = await this.getLocationInfo(lat, lng);

      // 随机初始漂流方向
      const directionAngle = Math.random() * 360;

      // 计算过期时间(30天)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const bottleData = {
        bottle_id: bottleId,
        owner_id: null,
        original_owner_id: userId,
        content: message || '',
        pixel_snapshot: JSON.stringify(pixelSnapshot || null),
        current_lat: lat,
        current_lng: lng,
        origin_lat: lat,
        origin_lng: lng,
        current_city: locationInfo.city,
        current_country: locationInfo.country,
        origin_city: locationInfo.city,
        origin_country: locationInfo.country,
        total_distance: 0,
        pickup_count: 0,
        message_count: 1,
        direction_angle: directionAngle,
        open_count: 0,
        max_openers: 5,
        is_sunk: false,
        sunk_at: null,
        last_drift_time: new Date(),
        expires_at: expiresAt,
        is_active: true
      };

      const [bottle] = await trx('drift_bottles').insert(bottleData).returning('*');

      // 获取用户信息
      const user = await trx('users').where({ id: userId }).first();

      // 创建者留言 (station_number=0)
      if (message) {
        await trx('drift_bottle_messages').insert({
          bottle_id: bottleId,
          author_id: userId,
          message: message.substring(0, 50),
          author_name: user?.username || '匿名',
          author_avatar: user?.avatar_url || null,
          sequence_number: 0,
          station_number: 0
        });
      }

      // 创建者旅途卡片 (station_number=0)
      await trx('journey_cards').insert({
        bottle_id: bottleId,
        participant_id: userId,
        participant_role: 'creator',
        station_number: 0,
        city: locationInfo.city,
        country: locationInfo.country,
        message: message ? message.substring(0, 50) : null,
        distance_from_prev: 0,
        cumulative_distance: 0
      });

      // 记录历史
      await this.recordHistory(bottleId, userId, 'throw', lat, lng, locationInfo, message || '', trx);

      // 提交事务
      await trx.commit();

      // 缓存
      await cacheService.cacheBottleInfo(bottleId, bottle);
      await cacheService.invalidateNearbyBottles(lat, lng);

      logger.info('漂流瓶v2创建成功', { bottleId, userId, location: locationInfo });
      return this.formatBottle(bottle);
    } catch (error) {
      await trx.rollback();
      logger.error('创建漂流瓶v2失败:', error);
      throw error;
    }
  }

  // ─── 打开瓶子 ──────────────────────────────────────────────

  /**
   * 打开漂流瓶(核心新逻辑)
   */
  static async openBottle(bottleId, userId, lat, lng, message = null) {
    const trx = await db.transaction();

    try {
      const bottle = await this.getBottleById(bottleId);
      if (!bottle || !bottle.is_active) {
        throw new Error('drift_bottle.error.bottle_not_available');
      }
      if (bottle.is_sunk) {
        throw new Error('drift_bottle.error.bottle_sunk');
      }
      if (bottle.open_count >= bottle.max_openers) {
        throw new Error('drift_bottle.error.bottle_max_opened');
      }
      if (bottle.original_owner_id === userId) {
        throw new Error('drift_bottle.error.own_bottle');
      }

      // 检查去重: 用户是否已打开过
      const alreadyOpened = await trx('journey_cards')
        .where({ bottle_id: bottleId, participant_id: userId, participant_role: 'opener' })
        .first();
      if (alreadyOpened) {
        throw new Error('drift_bottle.error.already_opened');
      }

      // 消耗拾取配额
      await quotaService.consumePickupQuota(userId, trx);

      const locationInfo = await this.getLocationInfo(lat, lng);

      // 计算与上一站距离
      const prevLat = parseFloat(bottle.current_lat);
      const prevLng = parseFloat(bottle.current_lng);
      const distance = this.calculateDistance(prevLat, prevLng, parseFloat(lat), parseFloat(lng));

      const newOpenCount = bottle.open_count + 1;
      const newTotalDistance = bottle.total_distance + distance;

      // 更新瓶子
      await trx('drift_bottles')
        .where({ bottle_id: bottleId })
        .update({
          open_count: newOpenCount,
          current_lat: lat,
          current_lng: lng,
          current_city: locationInfo.city,
          current_country: locationInfo.country,
          total_distance: newTotalDistance,
          message_count: trx.raw('message_count + 1'),
          owner_id: null,
          last_drift_time: new Date()
        });

      // 获取用户信息
      const user = await trx('users').where({ id: userId }).first();

      // 插入留言 (message可为null)
      await trx('drift_bottle_messages').insert({
        bottle_id: bottleId,
        author_id: userId,
        message: message ? message.substring(0, 50) : null,
        author_name: user?.username || '匿名',
        author_avatar: user?.avatar_url || null,
        sequence_number: newOpenCount,
        station_number: newOpenCount
      });

      // 插入旅途卡片
      await trx('journey_cards').insert({
        bottle_id: bottleId,
        participant_id: userId,
        participant_role: 'opener',
        station_number: newOpenCount,
        city: locationInfo.city,
        country: locationInfo.country,
        message: message ? message.substring(0, 50) : null,
        distance_from_prev: distance,
        cumulative_distance: newTotalDistance
      });

      // 记录历史
      await this.recordHistory(bottleId, userId, 'open', lat, lng, locationInfo, message || '', trx);

      // 检查是否达到沉没条件
      let didSink = false;
      let journeyCard = null;

      if (newOpenCount >= bottle.max_openers) {
        didSink = true;
        // 沉没操作也在事务中
        await trx('drift_bottles')
          .where({ bottle_id: bottleId })
          .update({
            is_sunk: true,
            is_active: false,
            sunk_at: new Date()
          });

        // 为每个参与者标记旅途卡片为未读
        await trx('journey_cards')
          .where({ bottle_id: bottleId })
          .update({ is_read: false });
      }

      // 提交事务
      await trx.commit();

      // 缓存失效（事务提交后）
      await cacheService.invalidateBottleRelatedCaches(bottleId, userId, lat, lng);

      // 如果沉没，获取完整旅途信息
      if (didSink) {
        const participants = await db('journey_cards')
          .where({ bottle_id: bottleId })
          .select('participant_id')
          .distinct();

        const JourneyCard = require('./JourneyCard');
        const journeyDetail = await JourneyCard.getCardDetail(bottleId);

        journeyCard = {
          participants: participants.map(p => p.participant_id),
          journeyDetail
        };
      }

      const updatedBottle = await this.getBottleById(bottleId);

      logger.info('漂流瓶被打开', {
        bottleId, userId, openCount: newOpenCount, distance, didSink
      });

      return { bottle: this.formatBottle(updatedBottle), didSink, journeyCard };
    } catch (error) {
      await trx.rollback();
      logger.error('打开漂流瓶失败:', error);
      throw error;
    }
  }

  // ─── 沉没处理 ──────────────────────────────────────────────

  /**
   * 沉没漂流瓶
   */
  static async sinkBottle(bottleId) {
    try {
      await db('drift_bottles')
        .where({ bottle_id: bottleId })
        .update({
          is_sunk: true,
          is_active: false,
          sunk_at: new Date()
        });

      // 查询所有参与者
      const participants = await db('journey_cards')
        .where({ bottle_id: bottleId })
        .select('participant_id')
        .distinct();

      // 获取完整旅途信息
      const JourneyCard = require('./JourneyCard');
      const journeyDetail = await JourneyCard.getCardDetail(bottleId);

      // 为每个参与者标记旅途卡片为未读
      await db('journey_cards')
        .where({ bottle_id: bottleId })
        .update({ is_read: false });

      // 缓存失效
      await cacheService.invalidateBottleRelatedCaches(bottleId);

      logger.info('漂流瓶已沉没', {
        bottleId,
        participantCount: participants.length
      });

      return {
        participants: participants.map(p => p.participant_id),
        journeyDetail
      };
    } catch (error) {
      logger.error('沉没漂流瓶失败:', error);
      throw error;
    }
  }

  // ─── 创建者重逢 ────────────────────────────────────────────

  /**
   * 创建者重逢自己的瓶子
   */
  static async reunionBottle(bottleId, userId, lat, lng) {
    try {
      const bottle = await this.getBottleById(bottleId);
      if (!bottle) {
        throw new Error('漂流瓶不存在');
      }
      if (bottle.original_owner_id !== userId) {
        throw new Error('这不是你的漂流瓶');
      }

      const locationInfo = await this.getLocationInfo(lat, lng);
      await this.recordHistory(bottleId, userId, 'reunion', lat, lng, locationInfo, '与自己的漂流瓶重逢');

      logger.info('创建者与漂流瓶重逢', { bottleId, userId });
      return this.formatBottle(bottle);
    } catch (error) {
      logger.error('重逢漂流瓶失败:', error);
      throw error;
    }
  }

  // ─── 配额管理 ──────────────────────────────────────────────

  /**
   * 获取用户配额信息
   */
  static async getUserQuota(userId) {
    try {
      let quota = await db('user_bottle_quota').where({ user_id: userId }).first();

      if (!quota) {
        // 首次查询, 初始化配额记录
        const [newQuota] = await db('user_bottle_quota').insert({
          user_id: userId,
          available_bottles: 0,
          pixels_since_last_bottle: 0,
          pixels_per_bottle: 200,
          max_reserve: 5,
          max_active: 3
        }).returning('*');
        quota = newQuota;
      }

      // 查询活跃瓶子数
      const activeCount = await db('drift_bottles')
        .where({ original_owner_id: userId, is_active: true, is_sunk: false })
        .count('* as count')
        .first();

      return {
        ...quota,
        active_count: parseInt(activeCount.count)
      };
    } catch (error) {
      logger.error('获取用户配额失败:', error);
      throw error;
    }
  }

  /**
   * 增加像素计数(绘画赚瓶子)
   */
  static async incrementPixelCount(userId, count) {
    try {
      let quota = await this.getUserQuota(userId);

      const newPixelCount = quota.pixels_since_last_bottle + count;
      let earned = false;

      if (newPixelCount >= quota.pixels_per_bottle && quota.available_bottles < quota.max_reserve) {
        // 赚到一个新瓶子
        await db('user_bottle_quota')
          .where({ user_id: userId })
          .update({
            available_bottles: db.raw('LEAST(available_bottles + 1, max_reserve)'),
            pixels_since_last_bottle: newPixelCount - quota.pixels_per_bottle,
            updated_at: new Date()
          });
        earned = true;
      } else {
        await db('user_bottle_quota')
          .where({ user_id: userId })
          .update({
            pixels_since_last_bottle: newPixelCount,
            updated_at: new Date()
          });
      }

      // 重新查询最新状态
      const updatedQuota = await this.getUserQuota(userId);

      return {
        earned,
        available_bottles: updatedQuota.available_bottles,
        pixels_since_last_bottle: updatedQuota.pixels_since_last_bottle,
        pixels_per_bottle: updatedQuota.pixels_per_bottle
      };
    } catch (error) {
      logger.error('增加像素计数失败:', error);
      return { earned: false, available_bottles: 0 };
    }
  }

  // ─── 遭遇检测 ──────────────────────────────────────────────

  /**
   * 查找用户附近的漂流瓶
   */
  static async findBottlesNearUser(userId, lat, lng) {
    try {
      const radiusKm = 0.5; // 500m

      // 查找附近漂流中的瓶子（排除自己的）
      const nearbyBottles = await db('drift_bottles')
        .where('is_active', true)
        .where('is_sunk', false)
        .whereNull('owner_id')
        .whereNot('original_owner_id', userId)
        .whereRaw(`
          (6371 * acos(cos(radians(?)) * cos(radians(current_lat)) *
          cos(radians(current_lng) - radians(?)) + sin(radians(?)) *
          sin(radians(current_lat)))) <= ?
        `, [lat, lng, lat, radiusKm])
        .orderBy('last_drift_time', 'desc')
        .limit(5);

      // 查询用户已打开过的瓶子
      const openedBottleIds = await db('journey_cards')
        .where({ participant_id: userId })
        .select('bottle_id');
      const openedSet = new Set(openedBottleIds.map(r => r.bottle_id));

      const bottles = nearbyBottles.filter(b => !openedSet.has(b.bottle_id));

      return {
        bottles: bottles.slice(0, 2).map(b => this.formatBottle(b)),
        reunionBottle: null
      };
    } catch (error) {
      logger.error('查找附近漂流瓶失败:', error);
      return { bottles: [], reunionBottle: null };
    }
  }

  // ─── 保留方法(逻辑调整) ────────────────────────────────────

  /**
   * 获取漂流瓶信息
   */
  static async getBottleById(bottleId) {
    try {
      let bottle = await cacheService.getBottleInfo(bottleId);

      if (!bottle) {
        bottle = await db('drift_bottles')
          .where({ bottle_id: bottleId })
          .first();

        if (bottle) {
          await cacheService.cacheBottleInfo(bottleId, bottle);
        }
      }

      if (bottle) {
        let messages = await cacheService.getBottleMessages(bottleId);

        if (!messages) {
          messages = await db('drift_bottle_messages')
            .where({ bottle_id: bottleId })
            .orderBy('station_number', 'asc');

          await cacheService.cacheBottleMessages(bottleId, messages);
        }

        bottle.messages = messages;
      }

      return this.formatBottle(bottle);
    } catch (error) {
      logger.error('获取漂流瓶信息失败:', error);
      throw error;
    }
  }

  /**
   * 获取附近正在漂流的瓶子
   */
  static async getNearbyDriftingBottles(lat, lng, radiusKm = 50) {
    try {
      let bottles = await cacheService.getNearbyBottles(lat, lng, radiusKm);

      if (!bottles) {
        bottles = await db('drift_bottles')
          .where('is_active', true)
          .where('is_sunk', false)
          .whereNull('owner_id')
          .whereRaw(`
            (6371 * acos(cos(radians(?)) * cos(radians(current_lat)) *
            cos(radians(current_lng) - radians(?)) + sin(radians(?)) *
            sin(radians(current_lat)))) <= ?
          `, [lat, lng, lat, radiusKm])
          .orderBy('last_drift_time', 'desc')
          .limit(20);

        await cacheService.cacheNearbyBottles(lat, lng, bottles, radiusKm);
      }

      return bottles;
    } catch (error) {
      logger.error('获取附近漂流瓶失败:', error);
      throw error;
    }
  }

  // ─── 地理位置工具 ──────────────────────────────────────────

  /**
   * 获取地理位置信息
   */
  static async getLocationInfo(lat, lng) {
    try {
      const locationInfo = await geocodingService.reverseGeocode(parseFloat(lat), parseFloat(lng));

      let countryName = '未知国家';
      if (locationInfo.country && typeof locationInfo.country === 'string') {
        countryName = locationInfo.country;
      } else if (locationInfo.country && typeof locationInfo.country === 'object') {
        countryName = locationInfo.country.name || locationInfo.country.cn || '未知国家';
      } else if (locationInfo.adm1 && typeof locationInfo.adm1 === 'string') {
        countryName = locationInfo.adm1;
      }

      let cityName = '未知城市';
      if (Array.isArray(locationInfo.city) && locationInfo.city.length > 0) {
        cityName = locationInfo.city[0];
      } else if (locationInfo.city && typeof locationInfo.city === 'string') {
        cityName = locationInfo.city;
      } else if (locationInfo.province && typeof locationInfo.province === 'string') {
        cityName = locationInfo.province.includes('市') ? locationInfo.province : locationInfo.province + '市';
      } else if (locationInfo.district && typeof locationInfo.district === 'string') {
        cityName = locationInfo.district;
      }

      return {
        city: cityName,
        country: countryName,
        province: locationInfo.province,
        district: locationInfo.district,
        fullAddress: locationInfo.formatted_address || locationInfo.township
      };
    } catch (error) {
      logger.warn('获取地理位置信息失败:', error);
      return { city: '未知城市', country: '未知国家', province: null, district: null, fullAddress: null };
    }
  }

  /**
   * 计算两点间距离(米)
   */
  static calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }

  static toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  static toDegrees(radians) {
    return radians * (180 / Math.PI);
  }

  /**
   * 记录漂流历史
   */
  static async recordHistory(bottleId, userId, action, lat, lng, locationInfo, message = '', trx = null) {
    try {
      await (trx || db)('drift_bottle_history').insert({
        bottle_id: bottleId,
        user_id: userId,
        action,
        lat,
        lng,
        city: locationInfo.city,
        country: locationInfo.country,
        message
      });
    } catch (error) {
      logger.error('记录漂流历史失败:', error);
    }
  }
}

module.exports = DriftBottle;
