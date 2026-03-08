const { db } = require('../config/database');
const logger = require('../utils/logger');
const crypto = require('crypto');
const geocodingService = require('../services/geocodingService');
const UserPoints = require('./UserPoints');

class QRTreasure {
  /**
   * 智能识别二维码类型
   */
  static detectQRCodeType(qrContent) {
    // 规则1: 共享单车
    if (/meituan|hellobike|mobike|didi.*bike|ofo/i.test(qrContent)) {
      return { type: 'bike', isUnique: true, mode: 'moving', confidence: 0.95 };
    }

    // 规则2: 快递单号
    if (/track|express|waybill|sf-express|jd.*express|cainiao/i.test(qrContent)) {
      return { type: 'package', isUnique: true, mode: 'moving', confidence: 0.9 };
    }

    // 规则3: 支付宝/微信收款码
    if (/alipay|wxpay|wechat.*pay|qr\.alipay|pay\.weixin/i.test(qrContent)) {
      return { type: 'payment', isUnique: true, mode: 'moving', confidence: 0.85 };
    }

    // 规则4: URL类型
    if (/^https?:\/\//i.test(qrContent)) {
      const hasUniqueParams = /[?&](id|uid|user|order|ticket)=/i.test(qrContent);
      if (hasUniqueParams) {
        return { type: 'url_unique', isUnique: true, mode: 'moving', confidence: 0.7 };
      } else {
        return { type: 'url_common', isUnique: false, mode: 'fixed', confidence: 0.8 };
      }
    }

    // 规则5: EAN/UPC商品码
    if (/^(69|690|691|978|979|471)\d{10,12}$/i.test(qrContent)) {
      return { type: 'product_barcode', isUnique: false, mode: 'fixed', confidence: 0.95 };
    }

    // 规则6: UUID/GUID格式
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(qrContent)) {
      return { type: 'uuid', isUnique: true, mode: 'moving', confidence: 0.9 };
    }

    // 规则7: 纯数字长度判断
    if (/^\d+$/.test(qrContent)) {
      const length = qrContent.length;
      if (length >= 16) {
        return { type: 'numeric_id', isUnique: true, mode: 'moving', confidence: 0.7 };
      } else if (length <= 8) {
        return { type: 'numeric_short', isUnique: false, mode: 'fixed', confidence: 0.6 };
      }
    }

    // 默认：未知类型，采用保守策略（固定模式）
    return { type: 'unknown', isUnique: false, mode: 'fixed', confidence: 0.5 };
  }

  /**
   * 二维码哈希
   */
  static hashQRCode(qrContent) {
    return crypto.createHash('sha256').update(qrContent).digest('hex');
  }

  /**
   * 更新二维码统计信息
   */
  static async getNearbyTreasures(lat, lng, radiusKm = 5, options = {}) {
    try {
      const {
        limit = 50,
        includeFound = false,
        treasureType = 'all',
        userId = null
      } = options;

      // 计算边界范围（将公里转换为度数）
      const latDelta = radiusKm / 111; // 1度纬度约等于111公里
      const lngDelta = radiusKm / (111 * Math.cos(lat * Math.PI / 180)); // 经度根据纬度调整

      const minLat = lat - latDelta;
      const maxLat = lat + latDelta;
      const minLng = lng - lngDelta;
      const maxLng = lng + lngDelta;

      // 构建查询条件
      let query = db('qr_treasures')
        .whereBetween('hide_lat', [minLat, maxLat])
        .whereBetween('hide_lng', [minLng, maxLng])
        .where('status', 'active');

      // 宝藏类型过滤
      if (treasureType !== 'all') {
        query = query.where('qr_code_type', treasureType === 'fixed' ? 'fixed' : 'mobile');
      }

      // 是否包含已找到的宝藏
      if (!includeFound && userId) {
        query = query.andWhere(function() {
          this.where('finder_id', null).orWhere('finder_id', '!=', userId);
        });
      }

      // 按藏宝时间倒序，限制数量
      const treasures = await query
        .orderBy('hidden_at', 'desc')
        .limit(limit);

      // 过滤过期的宝藏
      const validTreasures = treasures.filter(treasure => {
        if (treasure.expires_at && new Date(treasure.expires_at) < new Date()) {
          return false;
        }
        return true;
      });

      return validTreasures;
    } catch (error) {
      logger.error('获取附近宝藏失败:', error);
      throw error;
    }
  }

  static async updateQRStatistics(qrHash, lat, lng, detectedType, qrContent) {
    try {
      const existing = await db('qr_code_patterns').where({ qr_hash: qrHash }).first();

      if (existing) {
        // 检查是否是新位置（距离上次扫描位置超过1km）
        const lastScans = await db('qr_scan_history')
          .where({ qr_code_hash: qrHash })
          .orderBy('scanned_at', 'desc')
          .limit(10);

        let isNewLocation = true;
        for (const scan of lastScans) {
          const distance = this.calculateDistance(scan.scan_lat, scan.scan_lng, lat, lng);
          if (distance < 1000) {
            isNewLocation = false;
            break;
          }
        }

        // 更新统计
        await db('qr_code_patterns')
          .where({ qr_hash: qrHash })
          .update({
            last_seen_at: new Date(),
            scan_count: db.raw('scan_count + 1'),
            unique_location_count: isNewLocation
              ? db.raw('unique_location_count + 1')
              : db.raw('unique_location_count')
          });
      } else {
        // 首次记录
        const preview = qrContent.substring(0, 50) + (qrContent.length > 50 ? '...' : '');
        await db('qr_code_patterns').insert({
          qr_hash: qrHash,
          pattern_type: detectedType.type,
          is_unique: detectedType.isUnique,
          confidence: detectedType.confidence,
          sample_content: preview
        });
      }
    } catch (error) {
      logger.error('更新二维码统计失败:', error);
    }
  }

  /**
   * 扫一扫 - 统一处理函数
   */
  static async handleQRScan(qrContent, userLocation, userId) {
    const { lat, lng } = userLocation;

    // 1. 智能识别二维码类型
    const qrType = this.detectQRCodeType(qrContent);
    const qrHash = this.hashQRCode(qrContent);

    // 2. 更新统计
    await this.updateQRStatistics(qrHash, lat, lng, qrType, qrContent);

    // 3. 智能搜索宝藏
    const searchResult = await this.smartSearchTreasure(qrHash, lat, lng, qrType, userId);

    return {
      ...searchResult,
      qrType,
      qrHash
    };
  }

  /**
   * 智能搜索宝藏
   */
  static async smartSearchTreasure(qrHash, lat, lng, qrType, userId) {
    // 策略1: 先查找移动宝藏
    const movingTreasure = await this.findMovingTreasure(qrHash, userId);

    if (movingTreasure) {
      return {
        status: 'found',
        treasure: movingTreasure,
        type: 'moving',
        distance: 0,
        message: '🎉 找到宝藏了！'
      };
    }

    // 策略2: 查找附近的固定宝藏
    const fixedResult = await this.findNearbyFixedTreasure(qrHash, lat, lng, userId);

    if (fixedResult.found) {
      return {
        status: 'found',
        treasure: fixedResult.treasure,
        type: 'fixed',
        distance: fixedResult.distance,
        message: '🎉 找到宝藏了！'
      };
    }

    // 策略3: 附近有宝藏但距离不够
    if (fixedResult.nearby) {
      return {
        status: 'nearby',
        distance: fixedResult.distance,
        direction: fixedResult.direction,
        hint: fixedResult.treasure.hint,
        message: `宝藏就在${fixedResult.direction}方向，还有${fixedResult.distance}米！`
      };
    }

    // 策略4: 没有找到任何宝藏
    return {
      status: 'empty',
      canHide: true,
      message: '这里还没有宝藏，要不要藏一个？'
    };
  }

  /**
   * 查找移动宝藏
   */
  static async findMovingTreasure(qrHash, userId) {
    const treasure = await db('qr_treasures')
      .where({
        qr_code_hash: qrHash,
        qr_code_type: 'moving',
        status: 'active'
      })
      .first();

    if (!treasure) {
      return null;
    }

    // 检查是否已过期
    if (treasure.expires_at && new Date() > new Date(treasure.expires_at)) {
      await db('qr_treasures')
        .where({ treasure_id: treasure.treasure_id })
        .update({ status: 'expired' });
      return null;
    }

    // 检查是否是自己藏的
    if (treasure.hider_id === userId) {
      return null;
    }

    return treasure;
  }

  /**
   * 查找附近固定宝藏
   */
  static async findNearbyFixedTreasure(qrHash, userLat, userLng, userId) {
    const userGridLat = Math.round(userLat * 100) / 100;
    const userGridLng = Math.round(userLng * 100) / 100;

    // 查找同网格或相邻网格的宝藏
    const nearbyTreasures = await db('qr_treasures')
      .where({
        qr_code_hash: qrHash,
        qr_code_type: 'fixed',
        status: 'active'
      })
      .whereRaw(`
        ABS(location_grid_lat - ?) <= 0.02 AND
        ABS(location_grid_lng - ?) <= 0.02
      `, [userGridLat, userGridLng])
      .select('*');

    if (nearbyTreasures.length === 0) {
      return { found: false, nearby: false };
    }

    let closestTreasure = null;
    let minDistance = Infinity;

    for (const treasure of nearbyTreasures) {
      // 检查是否过期
      if (treasure.expires_at && new Date() > new Date(treasure.expires_at)) {
        continue;
      }

      // 检查是否是自己藏的
      if (treasure.hider_id === userId) {
        continue;
      }

      // 计算距离
      const distance = this.calculateDistance(
        treasure.hide_lat,
        treasure.hide_lng,
        userLat,
        userLng
      );

      // 检查是否在拾取范围内
      if (distance <= treasure.location_radius) {
        return {
          found: true,
          treasure,
          distance: Math.round(distance)
        };
      }

      // 记录最近的宝藏
      if (distance < minDistance) {
        minDistance = distance;
        closestTreasure = treasure;
      }
    }

    // 附近有宝藏，但距离不够（在500米内提示）
    if (closestTreasure && minDistance <= 500) {
      return {
        found: false,
        nearby: true,
        treasure: closestTreasure,
        distance: Math.round(minDistance),
        direction: this.calculateDirection(
          closestTreasure.hide_lat,
          closestTreasure.hide_lng,
          userLat,
          userLng
        )
      };
    }

    return { found: false, nearby: false };
  }

  /**
   * 移动宝藏到新位置
   */
  static async moveTreasure(treasureId, newLat, newLng, userId) {
    try {
      // 获取宝藏信息
      const treasure = await db('qr_treasures')
        .where({ treasure_id: treasureId, status: 'active' })
        .first();

      if (!treasure) {
        throw new Error('宝藏不存在或已被找到');
      }

      // 只有移动宝藏可以被移动
      if (treasure.treasure_type !== 'mobile') {
        throw new Error('只有移动宝藏可以被重新定位');
      }

      // 验证是否为宝藏的创建者或当前持有者
      // 这里可以根据业务需求调整权限验证逻辑

      // 计算移动距离
      const oldDistance = this.calculateDistance(
        treasure.hide_lat || treasure.first_hide_lat,
        treasure.hide_lng || treasure.first_hide_lng,
        newLat,
        newLng
      );

      // 限制移动距离（例如：单次移动不超过10公里）
      if (oldDistance > 10) {
        throw new Error('移动距离过远，请在宝藏附近移动');
      }

      // 更新宝藏位置
      const [updatedTreasure] = await db('qr_treasures')
        .where({ treasure_id: treasureId })
        .update({
          hide_lat: newLat,
          hide_lng: newLng,
          move_count: db.raw('move_count + 1'),
          updated_at: new Date()
        })
        .returning('*');

      // 记录移动日志
      await db('qr_treasure_logs').insert({
        treasure_id: treasureId,
        user_id: userId,
        action: 'move',
        lat: newLat,
        lng: newLng,
        details: JSON.stringify({
          previous_location: {
            lat: treasure.hide_lat || treasure.first_hide_lat,
            lng: treasure.hide_lng || treasure.first_hide_lng
          },
          new_location: { lat: newLat, lng: newLng },
          distance: Math.round(oldDistance * 1000), // 转换为米
          move_count: (treasure.move_count || 0) + 1
        })
      });

      logger.info('🚚 宝藏移动成功', {
        treasureId,
        userId,
        fromLocation: {
          lat: treasure.hide_lat || treasure.first_hide_lat,
          lng: treasure.hide_lng || treasure.first_hide_lng
        },
        toLocation: { lat: newLat, lng: newLng },
        distance: Math.round(oldDistance * 1000),
        totalMoves: (treasure.move_count || 0) + 1
      });

      return updatedTreasure;
    } catch (error) {
      logger.error('移动宝藏失败:', error);
      throw error;
    }
  }

  /**
   * 快速藏宝
   */
  static async quickHideTreasure(userId, qrContent, userLocation, treasureData) {
    const { lat, lng } = userLocation;

    // 1. 自动识别二维码类型
    const qrType = this.detectQRCodeType(qrContent);
    const qrHash = this.hashQRCode(qrContent);

    // 2. 更新统计
    await this.updateQRStatistics(qrHash, lat, lng, qrType, qrContent);

    // 3. 自动选择藏宝模式
    let treasureId, treasureMode, gridLat = null, gridLng = null;

    if (qrType.isUnique) {
      // 唯一二维码 → 移动宝藏
      treasureMode = 'moving';
      treasureId = `treasure_m_${qrHash.substring(0, 20)}`;

      // 检查是否已存在
      const exists = await db('qr_treasures')
        .where({ qr_code_hash: qrHash, qr_code_type: 'moving', status: 'active' })
        .first();

      if (exists) {
        throw new Error('这个二维码已经有宝藏了，快去寻找吧！');
      }
    } else {
      // 普通二维码 → 固定宝藏
      treasureMode = 'fixed';
      gridLat = Math.round(lat * 100) / 100;
      gridLng = Math.round(lng * 100) / 100;

      const combined = `${qrHash}_${gridLat}_${gridLng}`;
      const hash = crypto.createHash('sha256').update(combined).digest('hex');
      treasureId = `treasure_f_${hash.substring(0, 20)}`;

      // 检查该位置是否已有宝藏
      const exists = await db('qr_treasures')
        .where({
          qr_code_hash: qrHash,
          qr_code_type: 'fixed',
          location_grid_lat: gridLat,
          location_grid_lng: gridLng,
          status: 'active'
        })
        .first();

      if (exists) {
        throw new Error('这个位置已经有宝藏了，换个地方试试吧！');
      }
    }

    // 4. 获取位置信息
    const locationInfo = await geocodingService.reverseGeocode(lat, lng);

    // 5. 获取用户信息
    const user = await db('users').where({ id: userId }).first();

    // 6. 计算消耗积分和奖励积分
    const requestedReward = treasureData.rewardPoints || 50; // 用户选择的总奖励积分
    const treasureCost = 50; // 基础藏宝费用
    const baseReward = 50; // 道具包含的基础奖励
    let actualCost = 0; // 实际消耗的积分
    let finalReward = requestedReward; // 最终宝藏的奖励积分
    let usedItem = false;

    // 7. 检查用户库存是否有"寻宝道具"
    const treasureItem = await db('user_inventory')
      .join('store_items', 'user_inventory.item_id', 'store_items.id')
      .where({
        'user_inventory.user_id': userId,
        'store_items.item_type': 'qr_treasure'
      })
      .where('user_inventory.quantity', '>', 0)
      .select(
        'user_inventory.id as inventory_id',
        'user_inventory.user_id',
        'user_inventory.item_id',
        'user_inventory.quantity',
        'store_items.name as item_name',
        'store_items.item_type'
      )
      .first();

    if (treasureItem) {
      // 有道具：消耗1个道具（已包含50积分基础奖励）+ 额外奖励积分
      // 例如：用户选择总奖励100积分，道具已包含50，只需额外支付50积分
      const extraReward = Math.max(0, requestedReward - baseReward);
      actualCost = extraReward;
      finalReward = requestedReward;
      usedItem = true;

      // 消耗道具（减少数量）
      await db('user_inventory')
        .where({ id: treasureItem.inventory_id })
        .decrement('quantity', 1);

      logger.info('使用寻宝道具藏宝', {
        userId,
        itemId: treasureItem.item_id,
        baseReward: baseReward,
        extraReward: extraReward,
        finalReward: finalReward,
        actualCost: actualCost,
        remainingQuantity: treasureItem.quantity - 1
      });
    } else {
      // 无道具：消耗 道具费50 + 奖励积分
      actualCost = treasureCost + requestedReward;
      finalReward = requestedReward;
    }

    // 8. 检查用户积分
    const userPoints = await db('user_points').where({ user_id: userId }).first();
    if (!userPoints || userPoints.total_points < actualCost) {
      if (usedItem) {
        const extraReward = Math.max(0, requestedReward - baseReward);
        throw new Error(
          extraReward > 0
            ? `积分不足，需要 ${actualCost} 积分（额外奖励）`
            : '积分充足，将使用道具藏宝'
        );
      } else {
        throw new Error(
          `积分不足，需要 ${actualCost} 积分（道具费 ${treasureCost} + 奖励 ${requestedReward}）`
        );
      }
    }

    // 9. 扣除积分
    if (actualCost > 0) {
      await db('user_points')
        .where({ user_id: userId })
        .decrement('total_points', actualCost);
    }

    // 9. 设置默认值
    const defaultRadius = treasureMode === 'fixed' ? 50 : null;
    const defaultExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7天

    // 10. 创建宝藏
    const [treasure] = await db('qr_treasures').insert({
      treasure_id: treasureId,
      qr_code_hash: qrHash,
      qr_code_type: treasureMode,
      qr_pattern_type: qrType.type,
      qr_preview: qrContent.substring(0, 50) + (qrContent.length > 50 ? '...' : ''),
      hide_lat: treasureMode === 'fixed' ? lat : null,
      hide_lng: treasureMode === 'fixed' ? lng : null,
      location_grid_lat: gridLat,
      location_grid_lng: gridLng,
      location_radius: defaultRadius,
      city: locationInfo.city,
      country: locationInfo.country,
      hider_id: userId,
      hider_name: user.username,
      title: treasureData.title,
      description: treasureData.description || '',
      hint: treasureData.hint || this.generateAutoHint(treasureMode),
      reward_type: 'points',
      reward_value: JSON.stringify({ amount: finalReward }),
      image_url: treasureData.image_url || null,
      expires_at: defaultExpiry,
      status: 'active',
      // 新增字段
      treasure_type: treasureMode,
      move_count: 0,
      first_hide_lat: treasureMode === 'fixed' ? lat : null,
      first_hide_lng: treasureMode === 'fixed' ? lng : null,
      qr_content: qrContent
    }).returning('*');

    // 11. 记录扫码历史
    await db('qr_scan_history').insert({
      user_id: userId,
      qr_code_hash: qrHash,
      scan_lat: lat,
      scan_lng: lng,
      scan_mode: 'hide',
      scan_result: 'hidden',
      treasure_id: treasureId,
      detected_qr_type: qrType.type
    });

    // 12. 记录日志
    await db('qr_treasure_logs').insert({
      treasure_id: treasureId,
      user_id: userId,
      action: 'hide',
      lat,
      lng,
      details: JSON.stringify({
        title: treasureData.title,
        reward: finalReward,
        mode: treasureMode,
        usedItem: usedItem,
        actualCost: actualCost
      })
    });

    logger.info('宝藏藏匿成功', {
      treasureId,
      userId,
      qrType: qrType.type,
      mode: treasureMode,
      location: `${locationInfo.city}, ${locationInfo.country}`,
      usedItem: usedItem,
      cost: actualCost,
      reward: finalReward
    });

    return {
      success: true,
      treasure,
      usedItem: usedItem,
      actualCost: actualCost,
      finalReward: finalReward,
      message: treasureMode === 'moving'
        ? '宝藏已藏好！无论这个二维码移动到哪里都能被找到。'
        : '宝藏已藏好！只有在这附近才能找到。'
    };
  }

  /**
   * 领取宝藏
   */
  static async claimTreasure(userId, treasureId, lat, lng) {
    const treasure = await db('qr_treasures')
      .where({ treasure_id: treasureId, status: 'active' })
      .first();

    if (!treasure) {
      throw new Error('宝藏不存在或已被领取');
    }

    // 检查是否是自己藏的
    if (treasure.hider_id === userId) {
      throw new Error('不能领取自己藏的宝藏');
    }

    // 获取用户信息
    const user = await db('users').where({ id: userId }).first();

    if (!user) {
      throw new Error('用户不存在');
    }

    // 更新宝藏状态
    await db('qr_treasures')
      .where({ treasure_id: treasureId })
      .update({
        status: 'found',
        finder_id: userId,
        finder_name: user.username || '未知用户',
        found_at: new Date(),
        find_location_lat: lat,
        find_location_lng: lng
      });

    // 发放奖励
    let rewardValue;
    try {
      rewardValue = typeof treasure.reward_value === 'string'
        ? JSON.parse(treasure.reward_value)
        : treasure.reward_value;
    } catch (error) {
      logger.error('解析reward_value失败:', {
        treasureId,
        reward_value: treasure.reward_value,
        error: error.message
      });
      rewardValue = { amount: 50 }; // 默认奖励
    }

    const rewardPoints = rewardValue.amount || 50;

    // 通过 UserPoints 正确发放积分（写入 user_points + wallet_ledger）
    await UserPoints.addPoints(userId, rewardPoints, 'QR宝藏奖励', `qr_treasure_${treasureId}`);

    // 给藏宝者反馈奖励（5积分）
    await UserPoints.addPoints(treasure.hider_id, 5, 'QR宝藏藏宝奖励', `qr_treasure_hider_${treasureId}`);

    // 记录日志
    const logDetails = {
      reward: rewardPoints,
      hider: treasure.hider_name || '未知藏宝者'
    };

    await db('qr_treasure_logs').insert({
      treasure_id: treasureId,
      user_id: userId,
      action: 'found',
      lat,
      lng,
      details: JSON.stringify(logDetails)
    });

    logger.info('宝藏被领取', {
      treasureId,
      finderId: userId,
      hiderId: treasure.hider_id,
      reward: rewardPoints
    });

    // 构建安全的宝藏信息对象
    const safeTreasure = {
      treasure_id: treasure.treasure_id,
      title: treasure.title,
      description: treasure.description,
      reward_type: treasure.reward_type,
      reward_value: rewardPoints,
      hider_name: treasure.hider_name,
      found_at: new Date().toISOString()
    };

    return {
      treasure: safeTreasure,
      reward: rewardPoints,
      message: '宝藏领取成功！'
    };
  }

  /**
   * 自动生成提示语
   */
  static generateAutoHint(mode) {
    if (mode === 'moving') {
      return '寻找特定的物品，扫描它的二维码就能找到宝藏！';
    } else {
      return '就在附近，仔细找找看！';
    }
  }

  /**
   * 计算两点间距离（米）
   */
  static calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000; // 地球半径（米）
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }

  /**
   * 转换为弧度
   */
  static toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * 计算方向
   */
  static calculateDirection(treasureLat, treasureLng, userLat, userLng) {
    const angle = Math.atan2(treasureLng - userLng, treasureLat - userLat);
    const degree = angle * (180 / Math.PI);
    const directions = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
    const index = Math.round(((degree + 360) % 360) / 45) % 8;
    return directions[index];
  }
}

module.exports = QRTreasure;
