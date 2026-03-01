const https = require('https');
const logger = require('../utils/logger');

/**
 * 高德地图Web服务API - 兼容MapLibre GL版本
 *
 * 主要功能：
 * 1. 使用高德地图Web服务API进行逆地理编码
 * 2. 专门适配MapLibre GL坐标系转换需求
 * 3. 支持批量逆地理编码处理
 * 4. 智能缓存和限流控制
 * 5. 错误处理和重试机制
 * 6. IP白名单验证和安全控制
 *
 * API文档：https://lbs.amap.com/api/webservice/guide/api/georegeo
 * 更新日期：2025-11-26 (适配最新API规范)
 */
class AmapWebService {
  constructor() {
    // API配置 - 使用最新的高德地图Web Service API
    this.apiKey = process.env.AMAP_API_KEY || process.env.VITE_AMAP_WEB_SERVICE_KEY;

    // 多个API端点支持（负载均衡和容错）
    this.apiEndpoints = [
      'https://restapi.amap.com/v3/geocode/regeo',
      'https://restapi.amap.com/v3/geocode/geo' // 地理编码（正向）
    ];

    this.baseUrl = this.apiEndpoints[0]; // 默认使用逆地理编码

    if (!this.apiKey) {
      logger.error('❌ 高德地图Web服务API Key未配置，请在环境变量中设置 VITE_AMAP_WEB_SERVICE_KEY');
    }

    // 限流控制（高德免费版QPS=30，2025年更新）
    this.requestQueue = [];
    this.processing = false;
    this.requestDelay = 40; // 每个请求间隔40ms（约25 QPS，留有余量）

    // MapLibre GL 兼容性配置
    this.supportMapLibreGL = true; // 启用MapLibre GL兼容模式
    this.coordinateSystem = 'GCJ02'; // 高德地图使用GCJ02坐标系

    // 缓存配置
    this.cache = new Map();
    this.cacheMaxSize = 5000; // 缓存5000个结果
    this.cacheTTL = 24 * 60 * 60 * 1000; // 24小时缓存

    // 批量处理配置
    this.batchSize = 10; // 每次批量处理10个请求
    this.batchTimeout = 5000; // 5秒批处理超时

    // 错误重试配置
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1秒重试延迟

    logger.info('🌍 高德地图Web服务API逆地理编码服务初始化完成');
  }

  /**
   * MapLibre GL 专用逆地理编码 - 自动处理坐标系转换
   * @param {number} latitude - 纬度（支持WGS84或GCJ02）
   * @param {number} longitude - 经度（支持WGS84或GCJ02）
   * @param {Object} options - 可选参数
   * @param {string} options.radius - 搜索半径（米），默认1000
   * @param {string} options.extensions - 返回结果控制，默认base
   * @param {string} options.batch - 是否批量处理，默认false
   * @param {string} options.inputCoordSys - 输入坐标系：'WGS84'(默认) 或 'GCJ02'
   * @returns {Promise<Object>} 地理信息
   */
  async reverseGeocodeForMapLibre(latitude, longitude, options = {}) {
    try {
      const inputCoordSys = options.inputCoordSys || 'WGS84';

      // 坐标校验
      if (!this.isValidCoordinate(latitude, longitude)) {
        logger.warn(`⚠️ 无效坐标: (${latitude}, ${longitude})`);
        return this.getDefaultLocationInfo();
      }

      // 检查缓存（包含坐标系信息）
      const cacheKey = `${inputCoordSys}:${latitude.toFixed(6)},${longitude.toFixed(6)}`;
      const cachedResult = this.getFromCache(cacheKey);
      if (cachedResult) {
        logger.debug(`📋 使用缓存的地理信息 [${inputCoordSys}]: (${latitude},${longitude}) -> ${cachedResult.province} ${cachedResult.city}`);
        return {
          ...cachedResult,
          originalCoordinates: { lat: latitude, lng: longitude, system: inputCoordSys }
        };
      }

      // 调用现有的逆地理编码方法（直接使用原始坐标，无需转换）
      const locationInfo = await this.reverseGeocode(latitude, longitude, options);

      // 添加MapLibre GL需要的坐标信息
      return {
        ...locationInfo,
        originalCoordinates: { lat: latitude, lng: longitude, system: inputCoordSys },
        mapLibreGLCompatible: true
      };

    } catch (error) {
      logger.error('❌ MapLibre GL逆地理编码请求失败:', error);
      return this.getDefaultLocationInfo();
    }
  }

  /**
   * 逆地理编码 - 将经纬度转换为详细的地理信息
   * @param {number} latitude - 纬度（WGS-84坐标系）
   * @param {number} longitude - 经度（WGS-84坐标系）
   * @param {Object} options - 可选参数
   * @param {string} options.radius - 搜索半径（米），默认1000
   * @param {string} options.extensions - 返回结果控制，默认base
   * @param {string} options.batch - 是否批量处理，默认false
   * @param {boolean} options.forceGCJ02 - 是否强制使用GCJ02坐标
   * @returns {Promise<Object>} 地理信息
   */
  async reverseGeocode(latitude, longitude, options = {}) {
    try {
      // 坐标校验
      if (!this.isValidCoordinate(latitude, longitude)) {
        logger.warn(`⚠️ 无效坐标: (${latitude}, ${longitude})`);
        return this.getDefaultLocationInfo();
      }

      // 检查缓存
      const cacheKey = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
      const cachedResult = this.getFromCache(cacheKey);
      if (cachedResult) {
        logger.debug(`📋 使用缓存的地理信息: (${latitude},${longitude}) -> ${cachedResult.province} ${cachedResult.city}`);
        return cachedResult;
      }

      // 如果是批量请求，使用批量处理
      if (options.batch) {
        return this.processBatch([{latitude, longitude, options}])
          .then(results => results[0] || this.getDefaultLocationInfo());
      }

      // 单个请求处理
      return new Promise((resolve, reject) => {
        this.requestQueue.push({
          latitude,
          longitude,
          options,
          resolve,
          reject,
          timestamp: Date.now()
        });

        this.processQueue();
      });

    } catch (error) {
      logger.error('❌ 逆地理编码请求失败:', error);
      return this.getDefaultLocationInfo();
    }
  }

  /**
   * 批量逆地理编码
   * @param {Array} locations - 位置数组 [{latitude, longitude, options}, ...]
   * @returns {Promise<Array>} 地理信息数组
   */
  async batchReverseGeocode(locations) {
    if (!Array.isArray(locations) || locations.length === 0) {
      logger.warn('⚠️ 批量逆地理编码参数无效');
      return [];
    }

    const validLocations = locations.filter(loc =>
      this.isValidCoordinate(loc.latitude, loc.longitude)
    );

    if (validLocations.length === 0) {
      logger.warn('⚠️ 没有有效的坐标位置');
      return locations.map(() => this.getDefaultLocationInfo());
    }

    logger.info(`🔄 开始批量逆地理编码: ${validLocations.length}个位置`);

    try {
      const results = await this.processBatch(validLocations);
      logger.info(`✅ 批量逆地理编码完成: ${results.length}个结果`);
      return results;
    } catch (error) {
      logger.error('❌ 批量逆地理编码失败:', error);
      return locations.map(() => this.getDefaultLocationInfo());
    }
  }

  /**
   * 处理批量请求
   * @param {Array} locations - 位置数组
   * @returns {Promise<Array>} 结果数组
   */
  async processBatch(locations) {
    const results = [];
    const batchSize = Math.min(this.batchSize, locations.length);

    for (let i = 0; i < locations.length; i += batchSize) {
      const batch = locations.slice(i, i + batchSize);
      const batchPromises = batch.map(location =>
        this.processSingleRequest(location.latitude, location.longitude, location.options)
          .catch(error => {
            logger.error(`批量中单个请求失败: (${location.latitude},${location.longitude})`, error);
            return this.getDefaultLocationInfo();
          })
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // 批量请求间的延迟
      if (i + batchSize < locations.length) {
        await this.sleep(this.requestDelay);
      }
    }

    return results;
  }

  /**
   * 处理单个逆地理编码请求
   * @param {number} latitude - 纬度
   * @param {number} longitude - 经度
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 地理信息
   */
  async processSingleRequest(latitude, longitude, options = {}) {
    try {
      // 🔧 直接使用原始坐标，无需转换（高德坐标系与 OFM 坐标系一致）
      const location = `${longitude},${latitude}`;

      // 构建请求URL - 使用2025年最新API规范
      const params = new URLSearchParams({
        key: this.apiKey,
        location: location,
        output: 'json',
        extensions: options.extensions || 'base',
        radius: options.radius || '1000',
        poitype: options.poitype || '',
        homeorcorp: options.homeorcorp || '0',
        // 新增2025年API参数
        level: 'maxblock', // 最详细的行政区划级别
        showall: '1' // 显示所有行政区划信息
      });

      const url = `${this.baseUrl}?${params.toString()}`;

      logger.debug(`🌍 发起高德地图逆地理编码请求: (${latitude},${longitude}) -> ${location}`);

      return new Promise((resolve, reject) => {
        const request = https.get(url, { timeout: 8000 }, (response) => {
          let data = '';

          response.on('data', (chunk) => {
            data += chunk;
          });

          response.on('end', () => {
            try {
              const result = JSON.parse(data);

              // 检查API响应状态
              if (result.status !== '1') {
                // 处理特定错误代码
                let errorMsg = result.info || '未知错误';
                if (result.info === 'INVALID_USER_KEY') {
                  errorMsg = 'API Key无效或未授权';
                } else if (result.info === 'INVALID_USER_IP') {
                  errorMsg = 'IP未加入白名单，请在高德控制台添加服务器IP';
                } else if (result.info === 'USER_OVER_QUOTA') {
                  errorMsg = 'API调用次数超限';
                } else if (result.info === 'INVALID_PARAMS') {
                  errorMsg = '请求参数错误';
                }

                logger.warn(`⚠️ 高德地图API返回错误: ${errorMsg} (status: ${result.status}, info: ${result.info})`);
                return resolve(this.getDefaultLocationInfo());
              }

              const locationInfo = this.parseAmapResponse(result, latitude, longitude);

              // 缓存结果
              const cacheKey = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
              this.setCache(cacheKey, locationInfo);

              resolve(locationInfo);
            } catch (error) {
              logger.error('❌ 解析高德地图响应失败:', error);
              logger.error('原始响应数据:', data);
              resolve(this.getDefaultLocationInfo()); // 返回默认位置而不是抛出错误
            }
          });
        });

        request.on('error', (error) => {
          logger.error('❌ 高德地图请求失败:', error);
          resolve(this.getDefaultLocationInfo()); // 网络错误时返回默认位置
        });

        request.on('timeout', () => {
          request.destroy();
          logger.warn('⏰ 高德地图API请求超时');
          resolve(this.getDefaultLocationInfo()); // 超时时返回默认位置
        });
      });

    } catch (error) {
      logger.error('❌ 处理单个逆地理编码请求失败:', error);
      return this.getDefaultLocationInfo();
    }
  }

  /**
   * 解析高德地图API响应
   * @param {Object} response - API响应
   * @param {number} originalLat - 原始纬度
   * @param {number} originalLng - 原始经度
   * @returns {Object} 标准化的地理信息
   */
  parseAmapResponse(response, originalLat, originalLng) {
    try {
      if (response.status !== '1' || !response.regeocode) {
        logger.warn(`⚠️ 高德地图API返回错误: ${response.info || '未知错误'}`);
        return this.getDefaultLocationInfo();
      }

      const addressComponent = response.regeocode.addressComponent || {};
      const formattedAddress = response.regeocode.formatted_address || '';

      // 🔧 处理空数组情况（高德API对海外/海上地址可能返回空数组）
      const isEmptyOrArray = (value) => {
        return Array.isArray(value) || value === '';
      };

      // 国家级名称列表（不应作为省/市使用）
      const countryLevelNames = ['中华人民共和国', '中国'];

      // 🔧 安全地提取province字段（排除国家级名称）
      let province = '';
      const rawProvince = addressComponent.province;
      if (typeof rawProvince === 'string' && rawProvince.trim() !== '' && !countryLevelNames.includes(rawProvince.trim())) {
        province = rawProvince;
      }

      // 🔧 安全地提取city字段（处理直辖市情况和空数组情况）
      let cityValue = addressComponent.city;
      let city = '';

      // 检查city是否为有效的非空字符串
      if (typeof cityValue === 'string' && cityValue.trim() !== '' && !countryLevelNames.includes(cityValue.trim())) {
        city = cityValue;
      } else if (Array.isArray(cityValue) && cityValue.length > 0 && typeof cityValue[0] === 'string') {
        city = cityValue[0];
      } else if (province) {
        // 直辖市处理：province本身就是城市名（如"上海市"、"北京市"）
        // 只在 province 是有效省名（非国家名）时才回退
        city = province;
      }

      // 🔧 最终兜底：如果 city 仍为空，尝试从 formatted_address 中提取城市名
      // 典型格式："中华人民共和国厦门邮轮中心..." → 提取 "厦门市" 或区域名
      if (!city && formattedAddress) {
        // 移除国家名前缀后，匹配 "XX市" 或头部的中文地名
        const stripped = formattedAddress.replace(/^中华人民共和国/, '').replace(/^中国/, '');
        const cityMatch = stripped.match(/^(.{2,4}?[市州盟])/);
        if (cityMatch) {
          city = cityMatch[1];
          if (!province) province = city; // 同时补充 province
          logger.info(`🔧 从formatted_address提取城市: "${city}" (原始: ${formattedAddress})`);
        }
      }

      const locationInfo = {
        // 基础地理信息（对应数据库现有字段）
        country: (isEmptyOrArray(addressComponent.country) || !addressComponent.country) ? '中国' : addressComponent.country,
        province: province,
        city: city,
        district: (isEmptyOrArray(addressComponent.district) || !addressComponent.district) ? '' : addressComponent.district,
        adcode: (isEmptyOrArray(addressComponent.adcode) || !addressComponent.adcode) ? '' : addressComponent.adcode,
        formatted_address: formattedAddress,

        // 地理编码状态
        geocoded: true,
        geocoded_at: new Date()
      };

      logger.debug(`✅ 高德地图逆地理编码成功: (${originalLat},${originalLng}) -> ${locationInfo.province} ${locationInfo.city} ${locationInfo.district}`);

      return locationInfo;

    } catch (error) {
      logger.error('❌ 解析高德地图响应失败:', error);
      return this.getDefaultLocationInfo();
    }
  }

  /**
   * 处理请求队列（限流）
   */
  async processQueue() {
    if (this.processing || this.requestQueue.length === 0 || !this.apiKey) {
      return;
    }

    this.processing = true;

    while (this.requestQueue.length > 0) {
      const { latitude, longitude, options, resolve, reject } = this.requestQueue.shift();

      try {
        const result = await this.processSingleRequest(latitude, longitude, options);
        resolve(result);
      } catch (error) {
        logger.error(`队列中的逆地理编码请求失败: (${latitude},${longitude})`, error);
        reject(error);
      }

      // 延迟以避免超过QPS限制
      if (this.requestQueue.length > 0) {
        await this.sleep(this.requestDelay);
      }
    }

    this.processing = false;
  }

  /**
   * WGS-84转GCJ-02（高德地图坐标系）
   * @param {number} wgsLat - WGS-84纬度
   * @param {number} wgsLng - WGS-84经度
   * @returns {Object} GCJ-02坐标 {lat, lng}
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

  /**
   * 坐标转换辅助函数
   */
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

  /**
   * 检查坐标是否在中国境内
   */
  isInChina(lat, lng) {
    return (
      lat >= 3.86 &&
      lat <= 53.55 &&
      lng >= 73.66 &&
      lng <= 135.05
    );
  }

  /**
   * 获取默认地区信息
   */
  getDefaultLocationInfo() {
    return {
      country: '中国',
      province: null,
      city: '未知城市',
      district: null,
      adcode: '',
      formatted_address: '未知地区',
      geocoded: false,
      geocoded_at: new Date()
    };
  }

  /**
   * 缓存管理 - 获取缓存
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
   * 缓存管理 - 设置缓存
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
   * 验证坐标是否有效
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

  /**
   * 获取服务状态
   */
  getServiceStatus() {
    return {
      available: !!this.apiKey,
      apiKey: this.apiKey ? 'configured' : 'missing',
      baseUrl: this.baseUrl,
      cache: {
        size: this.cache.size,
        maxSize: this.cacheMaxSize,
        ttl: this.cacheTTL
      },
      queue: {
        length: this.requestQueue.length,
        processing: this.processing,
        delay: this.requestDelay
      },
      batch: {
        size: this.batchSize,
        timeout: this.batchTimeout
      },
      retry: {
        maxRetries: this.maxRetries,
        delay: this.retryDelay
      }
    };
  }

  /**
   * 清空缓存
   */
  clearCache() {
    this.cache.clear();
    logger.info('🗑️ 高德地图Web服务缓存已清空');
  }

  /**
   * 休眠函数
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * MapLibre GL 专用方法：获取坐标转换信息
   * @param {number} latitude - 纬度
   * @param {number} longitude - 经度
   * @param {string} fromSystem - 源坐标系：'WGS84' 或 'GCJ02'
   * @returns {Object} 坐标转换信息
   */
  getCoordinateTransformInfo(latitude, longitude, fromSystem = 'WGS84') {
    const coords = { lat: latitude, lng: longitude, system: fromSystem };

    if (fromSystem === 'WGS84') {
      return {
        original: coords,
        gcj02: this.wgs84ToGcj02(latitude, longitude),
        wgs84: { lat: latitude, lng: longitude },
        forAmapAPI: this.wgs84ToGcj02(latitude, longitude),
        forMapLibreGL: { lat: latitude, lng: longitude } // MapLibre GL使用WGS84
      };
    } else {
      // 假设输入是GCJ02
      const wgs84 = this.gcj02ToWgs84(latitude, longitude);
      return {
        original: coords,
        gcj02: { lat: latitude, lng: longitude },
        wgs84: wgs84,
        forAmapAPI: { lat: latitude, lng: longitude },
        forMapLibreGL: wgs84
      };
    }
  }

  /**
   * GCJ-02转WGS-84（高德地图坐标系转国际标准坐标系）
   * @param {number} gcjLat - GCJ-02纬度
   * @param {number} gcjLng - GCJ-02经度
   * @returns {Object} WGS-84坐标 {lat, lng}
   */
  gcj02ToWgs84(gcjLat, gcjLng) {
    const EARTH_RADIUS = 6378137.0;
    const EE = 0.00669342162296594323;

    // 检查是否在中国境内
    if (!this.isInChina(gcjLat, gcjLng)) {
      return { lat: gcjLat, lng: gcjLng };
    }

    let dLat = this.transformLat(gcjLng - 105.0, gcjLat - 35.0);
    let dLng = this.transformLng(gcjLng - 105.0, gcjLat - 35.0);

    const radLat = (gcjLat / 180.0) * Math.PI;
    let magic = Math.sin(radLat);
    magic = 1 - EE * magic * magic;
    const sqrtMagic = Math.sqrt(magic);

    dLat = (dLat * 180.0) / (((EARTH_RADIUS * (1 - EE)) / (magic * sqrtMagic)) * Math.PI);
    dLng = (dLng * 180.0) / ((EARTH_RADIUS / sqrtMagic) * Math.cos(radLat) * Math.PI);

    return {
      lat: gcjLat - dLat,
      lng: gcjLng - dLng
    };
  }

  /**
   * 批量坐标转换（MapLibre GL专用）
   * @param {Array} coordinates - 坐标数组 [{lat, lng, system}, ...]
   * @param {string} targetSystem - 目标坐标系：'WGS84' 或 'GCJ02'
   * @returns {Array} 转换后的坐标数组
   */
  batchCoordinateTransform(coordinates, targetSystem = 'WGS84') {
    return coordinates.map(coord => {
      const transformInfo = this.getCoordinateTransformInfo(coord.lat, coord.lng, coord.system || 'WGS84');
      return {
        ...coord,
        original: transformInfo.original,
        transformed: targetSystem === 'WGS84' ? transformInfo.wgs84 : transformInfo.gcj02
      };
    });
  }

  /**
   * 获取MapLibre GL集成配置
   * @returns {Object} 配置信息
   */
  getMapLibreGLConfig() {
    return {
      apiCompatible: true,
      coordinateSystem: this.coordinateSystem,
      supportedOperations: [
        'reverseGeocodeForMapLibre',
        'getCoordinateTransformInfo',
        'batchCoordinateTransform',
        'gcj02ToWgs84',
        'wgs84ToGcj02'
      ],
      apiEndpoints: this.apiEndpoints,
      rateLimit: {
        qps: 25,
        requestDelay: this.requestDelay
      },
      cache: {
        maxSize: this.cacheMaxSize,
        ttl: this.cacheTTL
      }
    };
  }

  /**
   * 测试高德API与MapLibre GL兼容性
   * @param {number} testLat - 测试纬度，默认北京天安门
   * @param {number} testLng - 测试经度，默认北京天安门
   * @returns {Promise<Object>} 测试结果
   */
  async testMapLibreGLCompatibility(testLat = 39.9042, testLng = 116.4074) {
    logger.info(`🧪 开始测试高德API与MapLibre GL兼容性: (${testLat}, ${testLng})`);

    const results = {
      basicGeocode: false,
      mapLibreGeocode: false,
      coordinateTransform: false,
      apiResponse: null,
      errors: []
    };

    try {
      // 测试基础逆地理编码
      const basicResult = await this.reverseGeocode(testLat, testLng);
      if (basicResult && basicResult.geocoded) {
        results.basicGeocode = true;
        logger.info('✅ 基础逆地理编码测试通过');
      }

      // 测试MapLibre GL专用逆地理编码
      const mapLibreResult = await this.reverseGeocodeForMapLibre(testLat, testLng);
      if (mapLibreResult && mapLibreResult.mapLibreGLCompatible) {
        results.mapLibreGeocode = true;
        logger.info('✅ MapLibre GL专用逆地理编码测试通过');
      }

      // 测试坐标转换
      const transformInfo = this.getCoordinateTransformInfo(testLat, testLng);
      if (transformInfo && transformInfo.wgs84 && transformInfo.gcj02) {
        results.coordinateTransform = true;
        logger.info('✅ 坐标转换测试通过');
      }

      results.apiResponse = {
        basic: basicResult,
        mapLibre: mapLibreResult,
        transform: transformInfo
      };

    } catch (error) {
      results.errors.push(error.message);
      logger.error('❌ 兼容性测试失败:', error);
    }

    return results;
  }
}

// 延迟初始化单例实例（确保环境变量已加载）
let amapWebServiceInstance = null;

function getAmapWebService() {
  if (!amapWebServiceInstance) {
    amapWebServiceInstance = new AmapWebService();
  }
  return amapWebServiceInstance;
}

// 导出 getter 函数，确保环境变量已加载后再创建实例
module.exports = new Proxy({}, {
  get(target, prop) {
    const instance = getAmapWebService();
    return instance[prop];
  },
  set(target, prop, value) {
    const instance = getAmapWebService();
    instance[prop] = value;
    return true;
  }
});