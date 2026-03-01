const https = require('https');
const logger = require('../utils/logger');

/**
 * Google Geocoding API 封装
 * 用于中国境外地区的逆地理编码，与 amapWebService 返回格式一致
 *
 * API文档：https://developers.google.com/maps/documentation/geocoding/requests-reverse-geocoding
 */
class GoogleGeocodingService {
  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    this.baseUrl = 'https://maps.googleapis.com/maps/api/geocode/json';

    // 缓存配置（同 amapWebService 模式）
    this.cache = new Map();
    this.cacheMaxSize = 5000;
    this.cacheTTL = 24 * 60 * 60 * 1000; // 24h

    if (this.apiKey) {
      logger.info('🌍 Google Geocoding API 服务初始化完成');
    } else {
      logger.warn('⚠️ Google Geocoding API Key 未配置（GOOGLE_MAPS_API_KEY），海外逆地理编码将降级到 Regions DB');
    }
  }

  /**
   * 逆地理编码 - 将经纬度转换为地理信息
   * @param {number} latitude - 纬度（WGS-84坐标系）
   * @param {number} longitude - 经度（WGS-84坐标系）
   * @returns {Promise<Object>} 标准 locationInfo 格式
   */
  async reverseGeocode(latitude, longitude) {
    try {
      // 坐标校验
      if (!this.isValidCoordinate(latitude, longitude)) {
        logger.warn(`⚠️ [Google] 无效坐标: (${latitude}, ${longitude})`);
        return this.getDefaultLocationInfo();
      }

      // 检查缓存
      const cacheKey = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
      const cachedResult = this.getFromCache(cacheKey);
      if (cachedResult) {
        logger.debug(`📋 [Google] 使用缓存: (${latitude},${longitude}) -> ${cachedResult.province} ${cachedResult.city}`);
        return cachedResult;
      }

      // 检查 API Key
      if (!this.apiKey) {
        logger.debug('[Google] API Key 未配置，返回默认结果');
        return this.getDefaultLocationInfo();
      }

      const url = `${this.baseUrl}?latlng=${latitude},${longitude}&key=${this.apiKey}&language=en`;

      logger.debug(`🌍 [Google] 发起逆地理编码请求: (${latitude},${longitude})`);

      return new Promise((resolve) => {
        const request = https.get(url, { timeout: 8000 }, (response) => {
          let data = '';

          response.on('data', (chunk) => {
            data += chunk;
          });

          response.on('end', () => {
            try {
              const result = JSON.parse(data);

              if (result.status === 'OK' && result.results && result.results.length > 0) {
                const locationInfo = this.parseGoogleResponse(result);

                // 缓存结果
                this.setCache(cacheKey, locationInfo);

                logger.info(`✅ [Google] 逆地理编码成功: (${latitude},${longitude}) -> ${locationInfo.country} ${locationInfo.province} ${locationInfo.city}`);
                resolve(locationInfo);
              } else {
                logger.warn(`⚠️ [Google] API 返回非 OK 状态: ${result.status} - ${result.error_message || ''}`);
                resolve(this.getDefaultLocationInfo());
              }
            } catch (error) {
              logger.error('❌ [Google] 解析响应失败:', error);
              resolve(this.getDefaultLocationInfo());
            }
          });
        });

        request.on('error', (error) => {
          logger.error('❌ [Google] 请求失败:', error);
          resolve(this.getDefaultLocationInfo());
        });

        request.on('timeout', () => {
          request.destroy();
          logger.warn('⏰ [Google] API 请求超时');
          resolve(this.getDefaultLocationInfo());
        });
      });

    } catch (error) {
      logger.error('❌ [Google] reverseGeocode 异常:', error);
      return this.getDefaultLocationInfo();
    }
  }

  /**
   * 解析 Google Geocoding API 响应，提取标准 locationInfo
   * @param {Object} data - Google API 响应
   * @returns {Object} 标准 locationInfo 格式
   */
  parseGoogleResponse(data) {
    try {
      const result = data.results[0];
      const components = result.address_components || [];

      let country = '';
      let province = '';
      let city = '';
      let district = '';

      for (const comp of components) {
        const types = comp.types || [];

        if (types.includes('country')) {
          country = comp.long_name;
        } else if (types.includes('administrative_area_level_1')) {
          province = comp.long_name;
        } else if (types.includes('locality')) {
          city = comp.long_name;
        } else if (!city && types.includes('administrative_area_level_2')) {
          // 某些地区没有 locality，用 administrative_area_level_2 作为 city
          city = comp.long_name;
        } else if (types.includes('sublocality_level_1') || types.includes('sublocality')) {
          if (!district) {
            district = comp.long_name;
          }
        }
      }

      return {
        country: country || 'Unknown',
        province: province || '',
        city: city || '',
        district: district || '',
        adcode: '', // Google 无 adcode
        formatted_address: result.formatted_address || '',
        geocoded: true,
        geocoded_at: new Date()
      };
    } catch (error) {
      logger.error('❌ [Google] parseGoogleResponse 失败:', error);
      return this.getDefaultLocationInfo();
    }
  }

  /**
   * 检查 Google Geocoding 服务是否可用（API Key 已配置）
   * @returns {boolean}
   */
  isAvailable() {
    return !!this.apiKey;
  }

  /**
   * 获取默认地理信息（所有服务失败时的兜底）
   * @returns {Object} 默认 locationInfo
   */
  getDefaultLocationInfo() {
    return {
      country: 'Unknown',
      province: '',
      city: '',
      district: '',
      adcode: '',
      formatted_address: '',
      geocoded: false,
      geocoded_at: new Date()
    };
  }

  /**
   * 获取服务状态
   * @returns {Object}
   */
  getServiceStatus() {
    return {
      available: this.isAvailable(),
      apiKey: this.apiKey ? 'configured' : 'missing',
      baseUrl: this.baseUrl,
      cache: {
        size: this.cache.size,
        maxSize: this.cacheMaxSize,
        ttl: this.cacheTTL
      }
    };
  }

  // ── 缓存管理 ──

  getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  setCache(key, data) {
    if (this.cache.size >= this.cacheMaxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  // ── 工具方法 ──

  isValidCoordinate(latitude, longitude) {
    return (
      typeof latitude === 'number' &&
      typeof longitude === 'number' &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180 &&
      !isNaN(latitude) &&
      !isNaN(longitude)
    );
  }
}

// 延迟初始化单例（确保环境变量已加载）
let googleGeocodingServiceInstance = null;

function getGoogleGeocodingService() {
  if (!googleGeocodingServiceInstance) {
    googleGeocodingServiceInstance = new GoogleGeocodingService();
  }
  return googleGeocodingServiceInstance;
}

module.exports = new Proxy({}, {
  get(target, prop) {
    const instance = getGoogleGeocodingService();
    return instance[prop];
  },
  set(target, prop, value) {
    const instance = getGoogleGeocodingService();
    instance[prop] = value;
    return true;
  }
});
