const { db } = require('../config/database');
const logger = require('../utils/logger');
const DriftBottle = require('../models/DriftBottle');

/**
 * 漂流瓶 v2 漂流服务
 * - 6小时漂流间隔
 * - 方向惯性(±45°偏转)
 * - 7天无人遇到加速
 * - 30天兜底沉没
 * - 主动推送遭遇给附近用户
 */
class DriftBottleService {
  constructor() {
    this.isRunning = false;
    this.driftInterval = 6 * 60 * 60 * 1000; // 6小时
    this.encounterInterval = 30 * 60 * 1000; // 30分钟遭遇检测
    this.socketManager = null;
  }

  setSocketManager(socketManager) {
    this.socketManager = socketManager;
  }

  /**
   * 启动服务
   */
  start() {
    if (this.isRunning) {
      logger.warn('漂流瓶v2服务已在运行');
      return;
    }

    this.isRunning = true;
    logger.info('🌊 漂流瓶v2自动漂流服务已启动 (6h间隔)');

    // 立即执行一次
    this.processDriftingBottles();

    // 定期漂流
    this.driftIntervalId = setInterval(() => {
      this.processDriftingBottles();
    }, this.driftInterval);

    // 定期遭遇推送
    this.encounterIntervalId = setInterval(() => {
      this.pushEncountersToNearbyUsers();
    }, this.encounterInterval);
  }

  /**
   * 停止服务
   */
  stop() {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.driftIntervalId) {
      clearInterval(this.driftIntervalId);
      this.driftIntervalId = null;
    }
    if (this.encounterIntervalId) {
      clearInterval(this.encounterIntervalId);
      this.encounterIntervalId = null;
    }
    logger.info('🌊 漂流瓶v2服务已停止');
  }

  /**
   * 处理所有正在漂流的瓶子
   */
  async processDriftingBottles() {
    try {
      logger.info('🌊 开始处理漂流瓶v2漂流...');

      const driftingBottles = await db('drift_bottles')
        .where('is_active', true)
        .where('is_sunk', false)
        .whereNull('owner_id')
        .select('*');

      logger.info(`找到 ${driftingBottles.length} 个正在漂流的瓶子`);

      let driftedCount = 0;
      let sunkCount = 0;

      for (const bottle of driftingBottles) {
        try {
          // 30天兜底沉没
          const bottleAge = Date.now() - new Date(bottle.created_at).getTime();
          const thirtyDays = 30 * 24 * 60 * 60 * 1000;

          if (bottleAge >= thirtyDays) {
            await this.handleTimeoutSink(bottle);
            sunkCount++;
            continue;
          }

          // 检查是否过期
          if (bottle.expires_at && new Date() > new Date(bottle.expires_at)) {
            await this.handleTimeoutSink(bottle);
            sunkCount++;
            continue;
          }

          // 计算漂流距离和方向
          const { distanceKm, newAngle } = this.calculateDriftParameters(bottle);

          const newLocation = this.generateDirectionalLocation(
            parseFloat(bottle.current_lat),
            parseFloat(bottle.current_lng),
            distanceKm,
            newAngle
          );

          const distance = DriftBottle.calculateDistance(
            parseFloat(bottle.current_lat),
            parseFloat(bottle.current_lng),
            newLocation.lat,
            newLocation.lng
          );

          await db('drift_bottles')
            .where('bottle_id', bottle.bottle_id)
            .update({
              current_lat: newLocation.lat,
              current_lng: newLocation.lng,
              total_distance: bottle.total_distance + distance,
              direction_angle: newAngle,
              last_drift_time: new Date()
            });

          driftedCount++;

          logger.debug(`漂流瓶 ${bottle.bottle_id} 漂流了 ${(distance / 1000).toFixed(2)} km, 方向 ${newAngle.toFixed(0)}°`);
        } catch (error) {
          logger.error(`处理漂流瓶 ${bottle.bottle_id} 失败:`, error);
        }
      }

      logger.info(`✅ 漂流瓶v2处理完成: 漂流 ${driftedCount} 个, 沉没 ${sunkCount} 个`);
    } catch (error) {
      logger.error('处理漂流瓶v2漂流失败:', error);
    }
  }

  /**
   * 计算漂流参数(距离+方向)
   */
  calculateDriftParameters(bottle) {
    const currentAngle = parseFloat(bottle.direction_angle) || Math.random() * 360;

    // 方向惯性: 在前一方向 ±45° 内偏转
    const angleOffset = (Math.random() - 0.5) * 90; // -45 to +45
    let newAngle = (currentAngle + angleOffset + 360) % 360;

    // 基础距离: 30-80km
    let minKm = 30;
    let maxKm = 80;

    // 7天无人遇到 → 加速(60-160km) + 方向更随机
    const lastOpenTime = bottle.last_drift_time
      ? new Date(bottle.last_drift_time).getTime()
      : new Date(bottle.created_at).getTime();
    const daysSinceLastActivity = (Date.now() - lastOpenTime) / (1000 * 60 * 60 * 24);

    if (daysSinceLastActivity >= 7) {
      minKm = 60;
      maxKm = 160;
      // 方向更随机以覆盖更大区域
      newAngle = (newAngle + (Math.random() - 0.5) * 90 + 360) % 360;
    }

    const distanceKm = minKm + Math.random() * (maxKm - minKm);

    return { distanceKm, newAngle };
  }

  /**
   * 按方向生成新位置
   */
  generateDirectionalLocation(lat, lng, distanceKm, angleDeg) {
    const earthRadius = 6371;
    const angleRad = angleDeg * (Math.PI / 180);
    const distanceRad = distanceKm / earthRadius;

    const latRad = lat * (Math.PI / 180);
    const lngRad = lng * (Math.PI / 180);

    const newLatRad = Math.asin(
      Math.sin(latRad) * Math.cos(distanceRad) +
      Math.cos(latRad) * Math.sin(distanceRad) * Math.cos(angleRad)
    );

    const newLngRad = lngRad + Math.atan2(
      Math.sin(angleRad) * Math.sin(distanceRad) * Math.cos(latRad),
      Math.cos(distanceRad) - Math.sin(latRad) * Math.sin(newLatRad)
    );

    return {
      lat: newLatRad * (180 / Math.PI),
      lng: newLngRad * (180 / Math.PI)
    };
  }

  /**
   * 超时沉没处理(生成不完整旅途卡片)
   */
  async handleTimeoutSink(bottle) {
    try {
      const result = await DriftBottle.sinkBottle(bottle.bottle_id);

      // 通过 socket 推送沉没事件
      if (this.socketManager && result.participants) {
        for (const participantId of result.participants) {
          this.socketManager.sendToUser(participantId, 'bottle_sunk', {
            bottleId: bottle.bottle_id,
            reason: 'timeout',
            journeyDetail: result.journeyDetail
          });
        }
      }

      logger.info(`漂流瓶 ${bottle.bottle_id} 超时沉没`);
    } catch (error) {
      logger.error(`超时沉没处理失败 ${bottle.bottle_id}:`, error);
    }
  }

  /**
   * 主动推送遭遇给附近用户
   */
  async pushEncountersToNearbyUsers() {
    try {
      if (!this.socketManager) return;

      // 获取所有活跃漂流瓶位置
      const activeBottles = await db('drift_bottles')
        .where('is_active', true)
        .where('is_sunk', false)
        .whereNull('owner_id')
        .select('bottle_id', 'current_lat', 'current_lng', 'origin_city', 'total_distance', 'pixel_snapshot');

      if (activeBottles.length === 0) return;

      // 获取最近活跃的用户位置 (从 drift_bottle_history 或 pixels 表获取最近位置)
      const recentUsers = await db('pixels')
        .where('updated_at', '>', new Date(Date.now() - 30 * 60 * 1000))
        .select('user_id', 'latitude', 'longitude')
        .groupBy('user_id', 'latitude', 'longitude')
        .limit(100);

      let pushCount = 0;

      for (const user of recentUsers) {
        for (const bottle of activeBottles) {
          const distance = DriftBottle.calculateDistance(
            parseFloat(user.latitude),
            parseFloat(user.longitude),
            parseFloat(bottle.current_lat),
            parseFloat(bottle.current_lng)
          );

          // 500m 范围内
          if (distance <= 500) {
            this.socketManager.sendToUser(user.user_id, 'bottle_nearby', {
              bottleId: bottle.bottle_id,
              originCity: bottle.origin_city,
              totalDistance: bottle.total_distance,
              distanceFromUser: distance,
              pixelSnapshot: typeof bottle.pixel_snapshot === 'string'
                ? JSON.parse(bottle.pixel_snapshot)
                : bottle.pixel_snapshot
            });
            pushCount++;
          }
        }
      }

      if (pushCount > 0) {
        logger.info(`🍾 推送了 ${pushCount} 个漂流瓶遭遇`);
      }
    } catch (error) {
      logger.error('推送遭遇失败:', error);
    }
  }

  /**
   * 像素绘制后的配额触发(被 pixelBatchService 调用)
   */
  async onPixelsDrawn(userId, pixelCount) {
    try {
      const result = await DriftBottle.incrementPixelCount(userId, pixelCount);

      if (result.earned && this.socketManager) {
        this.socketManager.sendToUser(userId, 'bottle_earned', {
          available_bottles: result.available_bottles,
          pixels_per_bottle: result.pixels_per_bottle
        });
      }

      return result;
    } catch (error) {
      logger.error('像素绘制配额触发失败:', error);
    }
  }
}

// 导出单例
const driftBottleService = new DriftBottleService();
module.exports = driftBottleService;
