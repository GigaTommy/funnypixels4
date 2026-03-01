const { redis } = require('../config/redis');
const { db } = require('../config/database');
const logger = require('../utils/logger');

/**
 * 全局GPS轨迹验证服务
 * 用于所有需要位置验证的场景（画像素、漂流瓶等）
 */
class GPSTrajectoryService {
  constructor() {
    // 全局配置
    this.config = {
      maxSpeed: 50,              // 最大速度：50m/s (180km/h)
      minInterval: 1,            // 最小时间间隔：1秒
      anomalyThreshold: 3,       // 24小时内异常次数阈值
      enableLogging: true,       // 是否记录日志到数据库
      cacheExpiry: 3600          // Redis缓存过期时间：1小时
    };
  }

  /**
   * 验证位置变化是否合理
   */
  async validateTrajectory(userId, lat, lng, accuracy = 20, action = 'unknown') {
    try {
      const lastLocationKey = `global:user:${userId}:last_location`;
      const lastLocation = await redis.hgetall(lastLocationKey);

      // 首次记录，直接通过
      if (!lastLocation || !lastLocation.lat) {
        await this.updateLocation(userId, lat, lng, accuracy);

        if (this.config.enableLogging) {
          await this.logTrajectory(userId, lat, lng, accuracy, null, null, action, false);
        }

        return {
          valid: true,
          firstTime: true,
          accuracy
        };
      }

      // 解析上次位置
      const lastLat = parseFloat(lastLocation.lat);
      const lastLng = parseFloat(lastLocation.lng);
      const lastTime = parseInt(lastLocation.timestamp);
      const lastAccuracy = parseFloat(lastLocation.accuracy || 20);

      // 计算距离和速度
      const distance = this.calculateDistance(lastLat, lastLng, lat, lng);
      const timeDiff = (Date.now() - lastTime) / 1000; // 秒

      // 时间间隔太短，跳过检测
      if (timeDiff < this.config.minInterval) {
        return {
          valid: true,
          skipped: true,
          reason: 'interval_too_short'
        };
      }

      const speed = distance / timeDiff; // m/s
      const speedKmh = speed * 3.6;

      // 异常速度检测
      const isAnomalous = this.detectAnomaly(speed, distance, accuracy, lastAccuracy);

      if (isAnomalous) {
        logger.warn('[GPS] 检测到异常移动', {
          userId,
          action,
          distance: distance.toFixed(2),
          timeDiff: timeDiff.toFixed(2),
          speed: speed.toFixed(2),
          speedKmh: speedKmh.toFixed(2),
          accuracy,
          lastAccuracy
        });

        // 记录异常
        await this.recordAnomaly(userId, {
          action,
          speed,
          speedKmh,
          distance,
          timeDiff,
          lat,
          lng,
          accuracy,
          lastLat,
          lastLng,
          lastAccuracy
        });

        // 记录日志
        if (this.config.enableLogging) {
          await this.logTrajectory(userId, lat, lng, accuracy, speed, distance, action, true);
        }

        // 检查异常次数
        const anomalyCount = await this.getAnomalyCount(userId);

        if (anomalyCount >= this.config.anomalyThreshold) {
          return {
            valid: false,
            warning: '位置变化频繁异常，请稍后再试',
            speed: speedKmh.toFixed(2),
            distance: distance.toFixed(2),
            anomalyCount,
            severity: 'high'
          };
        }

        return {
          valid: false,
          warning: '位置变化过快，请稍后再试',
          speed: speedKmh.toFixed(2),
          distance: distance.toFixed(2),
          anomalyCount,
          severity: 'medium'
        };
      }

      // 更新位置
      await this.updateLocation(userId, lat, lng, accuracy);

      // 记录正常日志
      if (this.config.enableLogging) {
        await this.logTrajectory(userId, lat, lng, accuracy, speed, distance, action, false);
      }

      return {
        valid: true,
        speed: speedKmh.toFixed(2),
        distance: distance.toFixed(2),
        accuracy,
        timeDiff: timeDiff.toFixed(2)
      };

    } catch (error) {
      logger.error('[GPS] 轨迹验证失败', { userId, error: error.message });
      // 验证失败时默认通过，避免影响用户体验
      return { valid: true, error: true };
    }
  }

  /**
   * 检测是否为异常移动
   */
  detectAnomaly(speed, distance, currentAccuracy, lastAccuracy) {
    // 距离很近，不判定为异常
    if (distance < 10) {
      return false;
    }

    // GPS精度很差时，宽松判断
    const avgAccuracy = (currentAccuracy + lastAccuracy) / 2;
    const speedThreshold = avgAccuracy > 50 ? 70 : this.config.maxSpeed;

    // 速度超过阈值，且距离超过500米
    return speed > speedThreshold && distance > 500;
  }

  /**
   * 更新用户最新位置
   */
  async updateLocation(userId, lat, lng, accuracy) {
    const key = `global:user:${userId}:last_location`;
    await redis.hset(key, {
      lat: lat.toString(),
      lng: lng.toString(),
      accuracy: accuracy.toString(),
      timestamp: Date.now().toString()
    });
    await redis.expire(key, this.config.cacheExpiry);
  }

  /**
   * 记录异常行为
   */
  async recordAnomaly(userId, data) {
    const anomalyKey = `global:user:${userId}:gps_anomalies`;

    await redis.lpush(anomalyKey, JSON.stringify({
      ...data,
      timestamp: Date.now()
    }));

    await redis.ltrim(anomalyKey, 0, 19); // 保留最近20次
    await redis.expire(anomalyKey, 7 * 24 * 60 * 60); // 7天

    // 增加24小时异常计数
    const countKey = `global:user:${userId}:gps_anomaly_count:24h`;
    await redis.incr(countKey);
    await redis.expire(countKey, 24 * 60 * 60);
  }

  /**
   * 获取用户24小时内的异常次数
   */
  async getAnomalyCount(userId) {
    const countKey = `global:user:${userId}:gps_anomaly_count:24h`;
    const count = await redis.get(countKey);
    return parseInt(count || 0);
  }

  /**
   * 记录轨迹日志到数据库
   */
  async logTrajectory(userId, lat, lng, accuracy, speed, distance, action, isAnomaly) {
    try {
      await db('gps_trajectory_log').insert({
        user_id: userId,
        latitude: lat,
        longitude: lng,
        accuracy,
        speed,
        distance,
        action,
        is_anomaly: isAnomaly
      });
    } catch (error) {
      logger.error('[GPS] 记录轨迹日志失败', { error: error.message });
    }
  }

  /**
   * 计算两点间距离（Haversine公式）
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000; // 地球半径（米）
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * 获取用户异常统计
   */
  async getAnomalyStats(userId, days = 7) {
    try {
      const stats = await db('gps_trajectory_log')
        .where('user_id', userId)
        .where('created_at', '>', new Date(Date.now() - days * 24 * 60 * 60 * 1000))
        .select(
          db.raw('COUNT(*) as total'),
          db.raw('SUM(CASE WHEN is_anomaly = true THEN 1 ELSE 0 END) as anomalies'),
          db.raw('AVG(speed) as avg_speed'),
          db.raw('MAX(speed) as max_speed')
        )
        .first();

      return {
        total: parseInt(stats.total || 0),
        anomalies: parseInt(stats.anomalies || 0),
        anomalyRate: stats.total > 0 ? (stats.anomalies / stats.total) : 0,
        avgSpeed: parseFloat(stats.avg_speed || 0),
        maxSpeed: parseFloat(stats.max_speed || 0)
      };
    } catch (error) {
      logger.error('[GPS] 获取异常统计失败', { error: error.message });
      return null;
    }
  }
}

module.exports = new GPSTrajectoryService();
