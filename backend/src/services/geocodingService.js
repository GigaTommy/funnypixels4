const https = require('https');
const logger = require('../utils/logger');
const regionsGeolocationService = require('./regionsGeolocationService');
const amapWebService = require('./amapWebService');
const googleGeocodingService = require('./googleGeocodingService');
// 注意：已移除PostGIS服务，数据质量不佳

/**
 * 混合逆地理编码服务（简化版）
 * 优先级：高德地图Web服务API -> PostGIS OSM精确匹配 -> Regions数据库 -> 默认结果
 * 已移除：离线服务、MaxMind、SimplePostGIS等冗余服务
 * 新增：优先使用高德地图Web服务API，超时保护、连接池管理、并发控制、PostGIS空间匹配
 */
class GeocodingService {
  constructor() {
    // 高德地图API配置（备用）
    this.apiKey = process.env.AMAP_API_KEY || 'your-amap-api-key';
    this.baseUrl = 'https://restapi.amap.com/v3/geocode/regeo';

    // 限流控制（高德免费版：QPS=20）
    this.requestQueue = [];
    this.processing = false;
    this.requestDelay = 60; // 每个请求间隔60ms（约16 QPS，留有余量）

    // 🆕 超时和并发控制
    this.defaultTimeout = parseInt(process.env.GEOCODING_TIMEOUT) || 2000; // 2秒默认超时
    this.maxConcurrency = parseInt(process.env.GEOCODING_MAX_CONCURRENCY) || 10; // 最大并发数
    this.currentRequests = 0; // 当前活跃请求数
    this.requestTimeouts = new Map(); // 跟踪请求超时

    // 服务配置（简化版）
    this.useAmapWebService = process.env.USE_AMAP_WEBSERVICE !== 'false'; // 默认启用高德地图Web服务
    this.usePostgis = process.env.USE_POSTGIS_GEOCODING !== 'false'; // 默认启用PostGIS服务
    this.useRegions = process.env.USE_REGIONS_GEOCODING !== 'false'; // 默认启用Regions服务
    this.fallbackToAmap = process.env.FALLBACK_TO_AMAP !== 'false'; // 默认启用回退（旧API）
    this.useGoogleGeocoding = process.env.USE_GOOGLE_GEOCODING !== 'false'; // 默认启用Google海外逆地理编码

    // 注意：已移除离线服务、MaxMind等冗余服务的配置选项

    // 🆕 地理信息缓存（简单内存缓存）
    this.cache = new Map();
    this.cacheMaxSize = parseInt(process.env.GEOCODING_CACHE_SIZE) || 1000;
    this.cacheTTL = parseInt(process.env.GEOCODING_CACHE_TTL) || 300000; // 5分钟缓存
  }

  /**
   * 逆地理编码 - 将经纬度转换为地区信息（原版，保持兼容性）
   * @param {number} latitude - 纬度（WGS-84坐标系）
   * @param {number} longitude - 经度（WGS-84坐标系）
   * @returns {Promise<Object>} 地区信息
   */
  async reverseGeocode(latitude, longitude) {
    return this.reverseGeocodeWithTimeout(latitude, longitude, this.defaultTimeout);
  }

  /**
   * 🆕 带超时的逆地理编码 - 新的主要方法
   * @param {number} latitude - 纬度（WGS-84坐标系）
   * @param {number} longitude - 经度（WGS-84坐标系）
   * @param {number} timeout - 超时时间（毫秒）
   * @returns {Promise<Object>} 地区信息
   */
  async reverseGeocodeWithTimeout(latitude, longitude, timeout = this.defaultTimeout) {
    // 坐标校验
    if (!this.isValidCoordinate(latitude, longitude)) {
      logger.warn(`⚠️ 无效坐标: (${latitude}, ${longitude})`);
      return this.getDefaultLocationInfo();
    }

    // 🆕 检查缓存
    const cacheKey = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
    const cachedResult = this.getFromCache(cacheKey);
    if (cachedResult) {
      logger.debug(`📋 使用缓存的地理信息: (${latitude},${longitude}) -> ${cachedResult.province} ${cachedResult.city}`);
      return cachedResult;
    }

    // 🆕 并发控制
    if (this.currentRequests >= this.maxConcurrency) {
      logger.warn(`⚠️ 地理编码请求数过多，使用默认结果: ${this.currentRequests}/${this.maxConcurrency}`);
      return this.getDefaultLocationInfo();
    }

    // 🆕 带超时的Promise包装
    return Promise.race([
      this._doReverseGeocodeWithConcurrencyControl(latitude, longitude),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('地理编码请求超时')), timeout);
      })
    ]).then(result => {
      // 🆕 缓存成功结果
      this.setCache(cacheKey, result);
      return result;
    }).catch(error => {
      logger.warn(`⚠️ 地理编码失败或超时: ${error.message}`);
      return this.getDefaultLocationInfo();
    });
  }

  /**
   * 🆕 带并发控制的逆地理编码实现
   */
  async _doReverseGeocodeWithConcurrencyControl(latitude, longitude) {
    this.currentRequests++;
    const requestId = `${Date.now()}-${Math.random()}`;
    const inChina = this.isInChina(latitude, longitude);

    try {
      logger.debug(`🗺️ 开始地理编码请求: (${latitude}, ${longitude}) [${requestId}] 区域: ${inChina ? '中国' : '海外'}`);

      if (inChina) {
        // ── 中国境内：高德 Web Service → Regions DB → Legacy Amap（不变）──

        // 🥇 最高优先级：高德地图Web服务API
        if (this.useAmapWebService) {
          try {
            const result = await amapWebService.reverseGeocode(latitude, longitude);
            if (result && result.geocoded) {
              logger.debug(`✅ 高德地图Web服务API逆地理编码成功: (${latitude},${longitude}) -> ${result.province} ${result.city}`);
              return result;
            }
          } catch (amapError) {
            logger.warn(`⚠️ 高德地图Web服务API失败:`, amapError.message);
          }
        }

        // 🥉 Regions数据库服务
        if (this.useRegions) {
          try {
            const result = await regionsGeolocationService.reverseGeocode(latitude, longitude);
            if (result && result.geocoded) {
              logger.debug(`✅ Regions数据库逆地理编码成功: (${latitude},${longitude}) -> ${result.province} ${result.city}`);
              return result;
            }
          } catch (regionsError) {
            logger.warn(`⚠️ Regions数据库逆地理编码失败:`, regionsError.message);
          }
        }

        // 🏁 旧版高德地图API（备用）
        if (this.fallbackToAmap) {
          return new Promise((resolve, reject) => {
            this.requestQueue.push({ latitude, longitude, resolve, reject, requestId });
            this.processQueue();
          });
        }
      } else {
        // ── 中国境外：Google Geocoding → Regions DB ──

        // 🥇 最高优先级：Google Geocoding API
        if (this.useGoogleGeocoding && googleGeocodingService.isAvailable()) {
          try {
            const result = await googleGeocodingService.reverseGeocode(latitude, longitude);
            if (result && result.geocoded) {
              logger.debug(`✅ Google Geocoding API逆地理编码成功: (${latitude},${longitude}) -> ${result.country} ${result.province} ${result.city}`);
              return result;
            }
          } catch (googleError) {
            logger.warn(`⚠️ Google Geocoding API失败:`, googleError.message);
          }
        }

        // 🥈 Regions数据库服务（降级）
        if (this.useRegions) {
          try {
            const result = await regionsGeolocationService.reverseGeocode(latitude, longitude);
            if (result && result.geocoded) {
              logger.debug(`✅ Regions数据库逆地理编码成功（海外降级）: (${latitude},${longitude}) -> ${result.province} ${result.city}`);
              return result;
            }
          } catch (regionsError) {
            logger.warn(`⚠️ Regions数据库逆地理编码失败:`, regionsError.message);
          }
        }
      }

      // 所有服务都不可用
      logger.warn(`⚠️ 所有地理编码服务都不可用，返回默认结果`);
      return this.getDefaultLocationInfo();
    } finally {
      this.currentRequests--;
      logger.debug(`✅ 地理编码请求完成: [${requestId}] 当前活跃: ${this.currentRequests}`);
    }
  }

  /**
   * 🆕 缓存管理 - 获取缓存
   */
  getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  /**
   * 🆕 缓存管理 - 设置缓存
   */
  setCache(key, data) {
    // 如果缓存已满，删除最旧的条目
    if (this.cache.size >= this.cacheMaxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * 🆕 获取服务状态（包含缓存和并发信息）
   */
  getServiceStatus() {
    return {
      ...this.getBaseServiceStatus(),
      cache: {
        size: this.cache.size,
        maxSize: this.cacheMaxSize,
        ttl: this.cacheTTL
      },
      concurrency: {
        current: this.currentRequests,
        max: this.maxConcurrency
      },
      timeout: this.defaultTimeout,
      services: {
        amap_webservice: {
          enabled: this.useAmapWebService,
          priority: '1 (中国)',
          status: amapWebService.getServiceStatus()
        },
        google_geocoding: {
          enabled: this.useGoogleGeocoding,
          priority: '1 (海外)',
          status: googleGeocodingService.getServiceStatus()
        },
        postgis: {
          enabled: this.usePostgis,
          priority: 2
        },
        regions: {
          enabled: this.useRegions,
          priority: '2 (降级)'
        },
        offline: {
          enabled: false,  // 已移除
          priority: 4
        },
        maxmind: {
          enabled: false,  // 已移除
          priority: 5
        },
        amap_legacy: {
          enabled: this.fallbackToAmap,
          priority: '3 (中国备用)'
        }
      }
    };
  }

  /**
   * 处理请求队列（限流）
   */
  async processQueue() {
    if (this.processing || this.requestQueue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.requestQueue.length > 0) {
      const { latitude, longitude, resolve, reject, requestId } = this.requestQueue.shift();

      try {
        const result = await this._doReverseGeocode(latitude, longitude);
        resolve(result);
      } catch (error) {
        reject(error);
      }

      // 延迟以避免超过QPS限制
      if (this.requestQueue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, this.requestDelay));
      }
    }

    this.processing = false;
  }

  /**
   * 执行逆地理编码请求
   */
  async _doReverseGeocode(latitude, longitude) {
    // 🔧 直接使用原始坐标，无需转换（高德坐标系与 OFM 坐标系一致）
    const location = `${longitude},${latitude}`;

    const url = `${this.baseUrl}?key=${this.apiKey}&location=${location}&output=json&extensions=base`;

    return new Promise((resolve, reject) => {
      https.get(url, (response) => {
        let data = '';

        response.on('data', (chunk) => {
          data += chunk;
        });

        response.on('end', () => {
          try {
            const result = JSON.parse(data);

            if (result.status === '1' && result.regeocode) {
              const addressComponent = result.regeocode.addressComponent;

              // 🔧 修复：安全地提取city字段（处理直辖市情况）
              let cityValue = addressComponent.city;
              let city = '';

              // 检查city是否为有效的非空字符串
              if (typeof cityValue === 'string' && cityValue.trim() !== '') {
                city = cityValue;
              } else if (Array.isArray(cityValue) && cityValue.length > 0 && typeof cityValue[0] === 'string') {
                // 如果city是非空数组，取第一个元素
                city = cityValue[0];
              } else if (typeof addressComponent.province === 'string' && addressComponent.province.trim() !== '') {
                // 直辖市处理：province本身就是城市名（如"上海市"、"北京市"）
                city = addressComponent.province;
              } else {
                city = '';
              }

              const locationInfo = {
                country: addressComponent.country || '中国',
                province: addressComponent.province || '',
                city: city, // 使用处理后的city
                district: addressComponent.district || '',
                adcode: addressComponent.adcode || '',
                formatted_address: result.regeocode.formatted_address || '',
                geocoded: true,
                geocoded_at: new Date()
              };

              logger.info(`✅ 逆地理编码成功: (${latitude},${longitude}) -> ${locationInfo.province} ${locationInfo.city}`);
              resolve(locationInfo);
            } else {
              logger.warn(`⚠️ 逆地理编码失败: ${result.info || '未知错误'}`);
              resolve(this.getDefaultLocationInfo());
            }
          } catch (error) {
            logger.error('❌ 解析逆地理编码响应失败:', error);
            reject(error);
          }
        });
      }).on('error', (error) => {
        logger.error('❌ 逆地理编码请求失败:', error);
        reject(error);
      });
    });
  }

  /**
   * 获取默认地区信息（当API调用失败时）
   */
  getDefaultLocationInfo() {
    return {
      country: '未知',
      province: '未知',
      city: '未知',
      district: '',
      adcode: '',
      formatted_address: '',
      geocoded: false,
      geocoded_at: new Date()
    };
  }

  /**
   * WGS-84转GCJ-02（高德地图坐标系）
   */
  wgs84ToGcj02(wgsLat, wgsLng) {
    const EARTH_RADIUS = 6378137.0;
    const EE = 0.00669342162296594323;

    // 检查是否在中国境内
    if (!this.isInChina(wgsLat, wgsLng)) {
      return { lat: wgsLat, lng: wgsLng };
    }

    let dLat = this.transformLat(wgsLng - 105.0, wgsLat - 35.0);
    let dLng = this.transformLng(wgsLng - 105.0, wgsLat - 35.0);

    const radLat = (wgsLat / 180.0) * Math.PI;
    let magic = Math.sin(radLat);
    magic = 1 - EE * magic * magic;
    const sqrtMagic = Math.sqrt(magic);

    dLat = (dLat * 180.0) / (((EARTH_RADIUS * (1 - EE)) / (magic * sqrtMagic)) * Math.PI);
    dLng = (dLng * 180.0) / ((EARTH_RADIUS / sqrtMagic) * Math.cos(radLat) * Math.PI);

    return {
      lat: wgsLat + dLat,
      lng: wgsLng + dLng
    };
  }

  transformLat(lng, lat) {
    let ret = -100.0 + 2.0 * lng + 3.0 * lat + 0.2 * lat * lat + 0.1 * lng * lat + 0.2 * Math.sqrt(Math.abs(lng));
    ret += (20.0 * Math.sin(6.0 * lng * Math.PI) + 20.0 * Math.sin(2.0 * lng * Math.PI)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(lat * Math.PI) + 40.0 * Math.sin(lat / 3.0 * Math.PI)) * 2.0 / 3.0;
    ret += (160.0 * Math.sin(lat / 12.0 * Math.PI) + 320 * Math.sin(lat * Math.PI / 30.0)) * 2.0 / 3.0;
    return ret;
  }

  transformLng(lng, lat) {
    let ret = 300.0 + lng + 2.0 * lat + 0.1 * lng * lng + 0.1 * lng * lat + 0.1 * Math.sqrt(Math.abs(lng));
    ret += (20.0 * Math.sin(6.0 * lng * Math.PI) + 20.0 * Math.sin(2.0 * lng * Math.PI)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(lng * Math.PI) + 40.0 * Math.sin(lng / 3.0 * Math.PI)) * 2.0 / 3.0;
    ret += (150.0 * Math.sin(lng / 12.0 * Math.PI) + 300.0 * Math.sin(lng / 30.0 * Math.PI)) * 2.0 / 3.0;
    return ret;
  }

  isInChina(lat, lng) {
    return (
      lat >= 3.86 &&
      lat <= 53.55 &&
      lng >= 73.66 &&
      lng <= 135.05
    );
  }

  /**
   * 批量逆地理编码（用于历史数据迁移）
   * @param {Array} pixels - 像素数组 [{id, latitude, longitude}, ...]
   * @param {Function} progressCallback - 进度回调函数
   * @returns {Promise<Array>} 地区信息数组
   */
  async batchReverseGeocode(pixels, progressCallback) {
    const results = [];
    const total = pixels.length;
    let processed = 0;

    // 不再使用MaxMind批量处理，直接使用优化后的处理方式

    // 传统方式处理（使用现有的reverseGeocode方法）
    logger.info('🔄 使用传统方式批量逆地理编码...');
    for (const pixel of pixels) {
      try {
        const locationInfo = await this.reverseGeocode(pixel.latitude, pixel.longitude);
        results.push({
          pixelId: pixel.id,
          ...locationInfo
        });

        processed++;
        if (progressCallback) {
          progressCallback(processed, total);
        }
      } catch (error) {
        logger.error(`❌ 处理像素 ${pixel.id} 的逆地理编码失败:`, error);
        results.push({
          pixelId: pixel.id,
          ...this.getDefaultLocationInfo()
        });
      }
    }

    return results;
  }

  /**
   * 获取服务状态（基础版本）
   */
  async getBaseServiceStatus() {
    const status = {
      useMaxMind: false,  // 已移除
      fallbackToAmap: this.fallbackToAmap,
      services: {}
    };

    // 高德地图服务状态
    if (this.fallbackToAmap) {
      status.services.amap = {
        available: true,
        apiKey: this.apiKey ? 'configured' : 'missing',
        baseUrl: this.baseUrl,
        requestDelay: this.requestDelay,
        queueLength: this.requestQueue.length,
        processing: this.processing
      };
    }

    return status;
  }

  /**
   * 初始化所有服务
   */
  async initializeServices() {
    logger.info('🔄 初始化地理编码服务...');

    const initPromises = [];

    // 初始化Regions数据库服务（第二优先级）
    if (this.useRegions) {
      initPromises.push(
        regionsGeolocationService.initialize()
          .then(() => {
            logger.info('✅ Regions数据库地理编码服务初始化成功');
          })
          .catch(error => {
            logger.warn('⚠️ Regions数据库地理编码服务初始化失败:', error.message);
            // Regions服务失败不是致命错误，因为有备用服务
          })
      );
    }

    // 等待所有服务初始化完成（不因失败而中断）
    await Promise.allSettled(initPromises);
    logger.info('✅ 地理编码服务初始化完成');
  }

  /**
   * 验证坐标是否有效
   * @param {number} latitude - 纬度
   * @param {number} longitude - 经度
   * @returns {boolean} 是否有效
   */
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

module.exports = new GeocodingService();
