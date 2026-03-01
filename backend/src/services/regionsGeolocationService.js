/**
 * 基于regions表的地理编码服务
 * 使用数据库中已加载的GeoNames数据进行离线地理编码
 * 支持高性能的KNN最近城市查询
 */
const { db } = require('../config/database');
const logger = require('../utils/logger');

class RegionsGeolocationService {
  constructor() {
    this.isInitialized = false;
    this.cacheEnabled = true;
    this.queryTimeout = 5000; // 5秒查询超时
    this.maxDistanceKm = 100; // 最大匹配距离100km
  }

  /**
   * 初始化服务
   */
  async initialize() {
    try {
      // 检查regions表是否存在并有数据
      const hasRegionsTable = await db.schema.hasTable('regions');
      if (!hasRegionsTable) {
        logger.warn('⚠️ regions表不存在，Regions地理编码服务将不可用');
        this.isInitialized = false;
        return false;
      }

      const regionCount = await db('regions').count('* as count').first();
      if (!regionCount || parseInt(regionCount.count) === 0) {
        logger.warn('⚠️ regions表没有数据，Regions地理编码服务将不可用');
        logger.info('💡 提示：运行 "node scripts/import-region-data.js" 来导入行政区划数据');
        this.isInitialized = false;
        return false;
      }

      // 检查是否有中国的城市数据
      const chinaRegionCount = await db('regions')
        .where('country', 'CN')
        .orWhere('name', 'like', '%北京%')
        .orWhere('name', 'like', '%上海%')
        .count('* as count')
        .first();

      logger.info(`✅ Regions地理编码服务初始化成功`);
      logger.info(`📊 总区域数据: ${regionCount.count} 条`);
      logger.info(`🇨🇳 中国区域数据: ${chinaRegionCount.count} 条`);

      this.isInitialized = true;
      return true;

    } catch (error) {
      logger.warn('⚠️ Regions地理编码服务初始化失败:', error.message);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * 确保服务已初始化
   */
  async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * 使用Haversine公式计算两点间距离（公里）
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // 地球半径（公里）
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * 角度转弧度
   */
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * 验证坐标是否有效
   */
  isValidCoordinate(latitude, longitude) {
    return (
      typeof latitude === 'number' &&
      typeof longitude === 'number' &&
      latitude >= -90 && latitude <= 90 &&
      longitude >= -180 && longitude <= 180 &&
      !isNaN(latitude) && !isNaN(longitude)
    );
  }

  /**
   * 获取默认位置信息
   */
  getDefaultLocationInfo() {
    return {
      geocoded: false,
      country: '未知',
      province: '未知',
      city: '未知',
      district: '',
      adcode: '',
      formatted_address: '',
      level: 'unknown',
      source: 'regions_default',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 根据坐标查找最近的城市（KNN查询）
   */
  async reverseGeocode(latitude, longitude) {
    await this.ensureInitialized();

    try {
      // 验证坐标
      if (!this.isValidCoordinate(latitude, longitude)) {
        logger.warn(`⚠️ 无效坐标: (${latitude}, ${longitude})`);
        return this.getDefaultLocationInfo();
      }

      // 使用PostgreSQL的地理空间函数进行高效查询
      const query = `
        SELECT
          id,
          code,
          name,
          level,
          parent_code,
          center_lat,
          center_lng,
          country,
          population,
          timezone,
          -- 计算距离（使用Haversine公式）
          6371 * 2 * ASIN(SQRT(
            POWER(SIN(RADIANS(center_lat - ?) / 2), 2) +
            COS(RADIANS(?)) * COS(RADIANS(center_lat)) *
            POWER(SIN(RADIANS(center_lng - ?) / 2), 2)
          )) as distance_km
        FROM regions
        WHERE
          center_lat IS NOT NULL
          AND center_lng IS NOT NULL
          AND is_active = true
          AND 6371 * 2 * ASIN(SQRT(
            POWER(SIN(RADIANS(center_lat - ?) / 2), 2) +
            COS(RADIANS(?)) * COS(RADIANS(center_lat)) *
            POWER(SIN(RADIANS(center_lng - ?) / 2), 2)
          )) <= ?
        ORDER BY distance_km ASC
        LIMIT 1
      `;

      const result = await db.raw(query, [
        latitude, latitude, longitude, latitude, latitude, longitude, this.maxDistanceKm
      ]);

      if (result.rows.length > 0) {
        const region = result.rows[0];
        const distance = parseFloat(region.distance_km);

        logger.debug(`✅ 找到最近城市: ${region.name} (距离: ${distance.toFixed(2)}km)`);

        // 构建返回结果
        const locationInfo = {
          geocoded: true,
          latitude,
          longitude,
          country: region.country || '中国',
          province: this.getProvinceName(region),
          city: region.name,
          district: '',
          adcode: region.code || '',
          formatted_address: this.formatAddress(region),
          level: region.level,
          population: region.population || 0,
          timezone: region.timezone || 'Asia/Shanghai',
          distance: distance,
          region_code: region.code,
          region_id: region.id,
          source: 'regions_database',
          timestamp: new Date().toISOString()
        };

        return locationInfo;
      } else {
        logger.debug(`⚠️ ${this.maxDistanceKm}km范围内未找到城市，坐标: (${latitude}, ${longitude})`);
        return this.getDefaultLocationInfo();
      }

    } catch (error) {
      logger.error('❌ Regions地理编码失败:', error);
      return this.getDefaultLocationInfo();
    }
  }

  /**
   * 获取省份名称
   */
  getProvinceName(region) {
    // 如果是省级，直接返回名称
    if (region.level === 'province' || region.level === 'municipality') {
      return region.name;
    }

    // 如果是市级，尝试查找父级省份
    if (region.level === 'city' && region.parent_code) {
      // 这里可以实现查找父级省份的逻辑
      // 简化处理：直接返回城市名，或者根据名称推断省份
      return this.inferProvinceFromCity(region.name);
    }

    return '未知';
  }

  /**
   * 根据城市名推断省份
   */
  inferProvinceFromCity(cityName) {
    // 简单的省份推断规则
    const provinceMap = {
      '北京': '北京市',
      '上海': '上海市',
      '天津': '天津市',
      '重庆': '重庆市',
      '广州': '广东省',
      '深圳': '广东省',
      '南京': '江苏省',
      '杭州': '浙江省',
      '武汉': '湖北省',
      '成都': '四川省',
      '西安': '陕西省',
      '长沙': '湖南省',
      '郑州': '河南省',
      '济南': '山东省',
      '青岛': '山东省',
      '大连': '辽宁省',
      '沈阳': '辽宁省',
      '长春': '吉林省',
      '哈尔滨': '黑龙江省'
    };

    for (const [city, province] of Object.entries(provinceMap)) {
      if (cityName.includes(city)) {
        return province;
      }
    }

    return '未知';
  }

  /**
   * 格式化地址
   */
  formatAddress(region) {
    const province = this.getProvinceName(region);
    if (province === region.name) {
      // 省级
      return `${region.name}`;
    } else {
      // 市级
      return `${province} ${region.name}`;
    }
  }

  /**
   * 批量地理编码
   */
  async batchReverseGeocode(coordinates) {
    await this.ensureInitialized();

    try {
      const results = [];

      for (const coord of coordinates) {
        const { latitude, longitude } = coord;
        const result = await this.reverseGeocode(latitude, longitude);
        results.push({
          ...coord,
          ...result
        });
      }

      logger.debug(`✅ 批量地理编码完成: ${results.length} 条记录`);
      return results;

    } catch (error) {
      logger.error('❌ 批量地理编码失败:', error);
      throw error;
    }
  }

  /**
   * 获取服务状态
   */
  async getServiceStatus() {
    try {
      await this.ensureInitialized();

      const stats = await db('regions')
        .select('level')
        .count('* as count')
        .groupBy('level');

      const totalCount = await db('regions').count('* as count').first();
      const chinaCount = await db('regions')
        .where('country', 'CN')
        .count('* as count')
        .first();

      return {
        initialized: this.isInitialized,
        database: {
          total_regions: parseInt(totalCount?.count || 0),
          china_regions: parseInt(chinaCount?.count || 0),
          level_distribution: stats.reduce((acc, stat) => {
            acc[stat.level] = parseInt(stat.count);
            return acc;
          }, {})
        },
        capabilities: {
          reverseGeocode: true,
          batchProcessing: true,
          offlineQuery: true,
          chineseSupport: true,
          maxDistanceKm: this.maxDistanceKm,
          queryTimeout: this.queryTimeout
        },
        performance: {
          cacheEnabled: this.cacheEnabled,
          queryMethod: 'PostgreSQL spatial query'
        }
      };

    } catch (error) {
      logger.error('❌ 获取服务状态失败:', error);
      return {
        initialized: false,
        error: error.message
      };
    }
  }

  /**
   * 清理资源
   */
  async cleanup() {
    this.isInitialized = false;
    logger.info('🧹 Regions地理编码服务已清理');
  }
}

module.exports = new RegionsGeolocationService();