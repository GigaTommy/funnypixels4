/**
 * URL 配置管理
 * 根据环境自动适配 BASE_URL 和其他 URL 配置
 * 支持开发环境、生产环境自动切换
 */

const logger = require('../utils/logger');

class URLConfig {
  constructor() {
    this.env = process.env.NODE_ENV || 'development';
    this.isDevelopment = this.env === 'development';
    this.isProduction = this.env === 'production';

    // 初始化配置
    this._initializeConfig();

    // 打印配置信息
    this._logConfig();
  }

  /**
   * 初始化配置
   */
  _initializeConfig() {
    // 1. 确定 HOST 和 PORT
    this.host = process.env.HOST || '0.0.0.0';
    this.port = process.env.PORT || 3001;

    // 2. 根据环境构建 BASE_URL
    if (this.isDevelopment) {
      // 开发环境：优先使用 .env 中的 BASE_URL，否则自动构建
      if (process.env.BASE_URL) {
        this.baseURL = process.env.BASE_URL;
      } else {
        // 自动检测局域网IP
        const localIP = this._getLocalIP();
        this.baseURL = `http://${localIP}:${this.port}`;
      }
    } else {
      // 生产环境：必须从环境变量读取
      if (!process.env.BASE_URL) {
        logger.warn('⚠️ 生产环境未设置 BASE_URL，使用默认值');
        this.baseURL = 'https://api.funnypixels.com';
      } else {
        this.baseURL = process.env.BASE_URL;
      }
    }

    // 3. API Base URL（加上 /api 前缀）
    this.apiBaseURL = `${this.baseURL}/api`;

    // 4. CDN Base URL（用于静态资源）
    if (this.isDevelopment) {
      // 开发环境：优先使用 CDN_BASE_URL，否则使用 BASE_URL + /uploads
      this.cdnBaseURL = process.env.CDN_BASE_URL || `${this.baseURL}/uploads`;
    } else {
      // 生产环境：优先使用独立的 CDN 域名
      this.cdnBaseURL = process.env.CDN_BASE_URL || process.env.CDN_DOMAIN || `${this.baseURL}/uploads`;
    }

    // 5. WebSocket URL
    if (this.isDevelopment) {
      this.wsURL = `ws://${this._getLocalIP()}:${this.port}`;
    } else {
      this.wsURL = process.env.WS_URL || `wss://${this._extractDomain(this.baseURL)}`;
    }

    // 6. Frontend URL（用于生成分享链接等）
    if (this.isDevelopment) {
      this.frontendURL = process.env.FRONTEND_URL || `http://${this._getLocalIP()}:3000`;
    } else {
      this.frontendURL = process.env.FRONTEND_URL || 'https://funnypixels.com';
    }
  }

  /**
   * 获取本地IP地址（优先局域网IP）
   * 用于开发环境，让手机等设备可以访问
   */
  _getLocalIP() {
    // 如果环境变量中指定了 LOCAL_IP，优先使用
    if (process.env.LOCAL_IP) {
      return process.env.LOCAL_IP;
    }

    const os = require('os');
    const interfaces = os.networkInterfaces();

    // 优先查找局域网IP（192.168.x.x 或 10.x.x.x）
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        // 跳过内部和非IPv4地址
        if (iface.family === 'IPv4' && !iface.internal) {
          // 优先返回局域网IP
          if (iface.address.startsWith('192.168.') || iface.address.startsWith('10.')) {
            return iface.address;
          }
        }
      }
    }

    // 如果没有找到局域网IP，返回localhost
    return 'localhost';
  }

  /**
   * 从URL中提取域名
   */
  _extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (error) {
      logger.error('Failed to extract domain from URL:', url);
      return 'api.funnypixels.com';
    }
  }

  /**
   * 打印配置信息
   */
  _logConfig() {
    logger.info('🌐 URL Configuration:');
    logger.info(`   Environment: ${this.env}`);
    logger.info(`   Base URL: ${this.baseURL}`);
    logger.info(`   API Base URL: ${this.apiBaseURL}`);
    logger.info(`   CDN Base URL: ${this.cdnBaseURL}`);
    logger.info(`   WebSocket URL: ${this.wsURL}`);
    logger.info(`   Frontend URL: ${this.frontendURL}`);
  }

  /**
   * 获取完整的上传URL
   * @param {string} relativePath - 相对路径
   * @returns {string} 完整URL
   */
  getUploadURL(relativePath) {
    // 如果已经是完整URL，直接返回
    if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
      return relativePath;
    }

    // 确保路径以/开头
    const path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;

    return `${this.cdnBaseURL}${path}`;
  }

  /**
   * 获取完整的API URL
   * @param {string} endpoint - API端点
   * @returns {string} 完整URL
   */
  getAPIURL(endpoint) {
    // 确保端点以/开头
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    return `${this.apiBaseURL}${path}`;
  }

  /**
   * 生成分享链接
   * @param {string} path - 路径
   * @returns {string} 完整分享链接
   */
  getShareURL(path) {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.frontendURL}${cleanPath}`;
  }

  /**
   * 获取配置对象（用于导出）
   */
  getConfig() {
    return {
      env: this.env,
      isDevelopment: this.isDevelopment,
      isProduction: this.isProduction,
      host: this.host,
      port: this.port,
      baseURL: this.baseURL,
      apiBaseURL: this.apiBaseURL,
      cdnBaseURL: this.cdnBaseURL,
      wsURL: this.wsURL,
      frontendURL: this.frontendURL
    };
  }
}

// 创建单例
const urlConfig = new URLConfig();

// 导出实例和配置对象
module.exports = {
  urlConfig,
  // 便捷访问器
  getBaseURL: () => urlConfig.baseURL,
  getAPIBaseURL: () => urlConfig.apiBaseURL,
  getCDNBaseURL: () => urlConfig.cdnBaseURL,
  getWSURL: () => urlConfig.wsURL,
  getFrontendURL: () => urlConfig.frontendURL,
  getUploadURL: (path) => urlConfig.getUploadURL(path),
  getAPIURL: (endpoint) => urlConfig.getAPIURL(endpoint),
  getShareURL: (path) => urlConfig.getShareURL(path),
  getConfig: () => urlConfig.getConfig()
};
