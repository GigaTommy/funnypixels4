const { redis } = require('../config/redis');
const logger = require('../utils/logger');
const geocodingService = require('./geocodingService');

/**
 * 漂流瓶拾取距离验证服务
 * 根据GPS精度、环境类型动态调整距离阈值
 */
class BottlePickupDistanceService {
  constructor() {
    this.config = {
      baseRadius: 50,           // 基础半径（米）
      minRadius: 50,            // 最小阈值（米）
      maxRadius: 150,           // 最大阈值（米）
      safetyFactor: 1.2,        // 安全裕度
      maxAccuracyError: 50,     // GPS精度上限（米）

      // 环境因子配置
      environmentFactors: {
        'open_area': 0.8,       // 公园、广场
        'residential': 1.0,     // 住宅区
        'commercial': 1.1,      // 商业区
        'cbd': 1.2,             // CBD高楼区
        'underground': 1.3,     // 地铁站等
        'default': 1.0
      },

      // 宽松模式阈值
      lenientAccuracyThreshold: 30,
      lenientFactor: 1.3
    };
  }

  /**
   * 验证拾取距离
   */
  async validatePickupDistance(userId, userLat, userLng, userAccuracy, bottle) {
    const bottleLat = parseFloat(bottle.current_lat);
    const bottleLng = parseFloat(bottle.current_lng);
    const bottleAccuracy = parseFloat(bottle.location_accuracy || 20);

    // 计算实际距离
    const distance = this.calculateDistance(userLat, userLng, bottleLat, bottleLng);

    // 动态计算允许距离
    const dynamicThreshold = await this.calculateThreshold(
      userLat,
      userLng,
      userAccuracy,
      bottleAccuracy
    );

    // 正常验证
    if (distance <= dynamicThreshold) {
      logger.debug('[Distance] 距离验证通过', {
        userId,
        bottleId: bottle.bottle_id,
        distance: distance.toFixed(2),
        threshold: dynamicThreshold.toFixed(2),
        userAccuracy,
        bottleAccuracy
      });

      return {
        valid: true,
        distance: Math.round(distance),
        threshold: Math.round(dynamicThreshold),
        accuracy: 'good',
        mode: 'normal'
      };
    }

    // 宽松模式：GPS精度很差时给予更大容忍
    if (userAccuracy > this.config.lenientAccuracyThreshold) {
      const lenientThreshold = dynamicThreshold * this.config.lenientFactor;

      if (distance <= lenientThreshold) {
        logger.info('[Distance] 宽松模式通过', {
          userId,
          bottleId: bottle.bottle_id,
          distance: distance.toFixed(2),
          normalThreshold: dynamicThreshold.toFixed(2),
          lenientThreshold: lenientThreshold.toFixed(2),
          userAccuracy
        });

        return {
          valid: true,
          distance: Math.round(distance),
          threshold: Math.round(lenientThreshold),
          accuracy: 'poor',
          mode: 'lenient',
          warning: 'GPS信号较弱，建议到空旷处获得更好体验'
        };
      }
    }

    // 验证失败
    logger.info('[Distance] 距离验证失败', {
      userId,
      bottleId: bottle.bottle_id,
      distance: distance.toFixed(2),
      threshold: dynamicThreshold.toFixed(2),
      userAccuracy
    });

    return {
      valid: false,
      distance: Math.round(distance),
      threshold: Math.round(dynamicThreshold),
      shortfall: Math.round(distance - dynamicThreshold),
      reason: `距离瓶子还有${Math.round(distance)}米，请继续靠近`
    };
  }

  /**
   * 动态计算距离阈值
   */
  async calculateThreshold(lat, lng, userAccuracy, bottleAccuracy) {
    // 1. 基础半径
    let threshold = this.config.baseRadius;

    // 2. GPS精度因子（限制上限）
    const userError = Math.min(userAccuracy || 20, this.config.maxAccuracyError);
    const bottleError = Math.min(bottleAccuracy || 20, this.config.maxAccuracyError);

    threshold += userError + bottleError;

    // 3. 安全裕度
    threshold *= this.config.safetyFactor;

    // 4. 环境因子（可选）
    const environmentFactor = await this.getEnvironmentFactor(lat, lng);
    threshold *= environmentFactor;

    // 5. 限制范围
    threshold = Math.max(
      this.config.minRadius,
      Math.min(threshold, this.config.maxRadius)
    );

    return threshold;
  }

  /**
   * 获取环境因子
   */
  async getEnvironmentFactor(lat, lng) {
    try {
      // 检查缓存
      const cacheKey = `environment:${lat.toFixed(3)}:${lng.toFixed(3)}`;
      const cached = await redis.get(cacheKey);

      if (cached) {
        return parseFloat(cached);
      }

      // 获取地理位置信息
      const location = await geocodingService.reverseGeocode(lat, lng);
      let factor = this.config.environmentFactors.default;

      // 根据POI判断环境类型
      if (location.poi) {
        const poi = location.poi.toLowerCase();

        if (poi.includes('公园') || poi.includes('广场') || poi.includes('park') || poi.includes('square')) {
          factor = this.config.environmentFactors.open_area;
        } else if (poi.includes('地铁') || poi.includes('车站') || poi.includes('subway') || poi.includes('station')) {
          factor = this.config.environmentFactors.underground;
        } else if (location.district && location.district.includes('CBD')) {
          factor = this.config.environmentFactors.cbd;
        } else if (poi.includes('商场') || poi.includes('写字楼') || poi.includes('mall') || poi.includes('office')) {
          factor = this.config.environmentFactors.commercial;
        }
      }

      // 缓存结果（1小时）
      await redis.setex(cacheKey, 3600, factor.toString());

      return factor;

    } catch (error) {
      logger.warn('[Distance] 获取环境因子失败，使用默认值', { error: error.message });
      return this.config.environmentFactors.default;
    }
  }

  /**
   * 计算两点间距离
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000;
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
   * 获取配置
   */
  getConfig() {
    return this.config;
  }

  /**
   * 更新配置（热更新）
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    logger.info('[Distance] 配置已更新', newConfig);
  }
}

module.exports = new BottlePickupDistanceService();
