// 环境变量配置
import { logger } from '../utils/logger';

export const config = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001',
  WS_URL: import.meta.env.VITE_WS_URL || 'ws://localhost:3001',
  // 应用配置
  APP_NAME: import.meta.env.VITE_APP_NAME || 'FunnyPixels',
  APP_VERSION: import.meta.env.VITE_APP_VERSION || '1.0.0',
  // 登录配置
  ENABLE_PHONE_LOGIN: import.meta.env.VITE_ENABLE_PHONE_LOGIN === 'true',
  ENABLE_AUTO_REGISTER: import.meta.env.VITE_ENABLE_AUTO_REGISTER === 'true',
  // 微信登录配置
  WECHAT: {
    APP_ID: import.meta.env.VITE_WECHAT_APP_ID || 'YOUR_WECHAT_APP_ID',
    REDIRECT_URI: import.meta.env.VITE_WECHAT_REDIRECT_URI || `${window.location.origin}/auth/wechat/callback`,
    SCOPE: 'snsapi_login',
    RESPONSE_TYPE: 'code',
    STATE_LENGTH: 32
  },
  // 开发环境配置
  IS_DEVELOPMENT: import.meta.env.DEV,
  IS_PRODUCTION: import.meta.env.PROD,
  // 调试配置
  DEBUG_MODE: import.meta.env.VITE_DEBUG_MODE === 'true',
  // 安全配置
  ENABLE_MOCK_AUTH: import.meta.env.VITE_ENABLE_MOCK_AUTH === 'true',
  // 高德地图配置
  AMAP: {
    API_KEY: import.meta.env.VITE_AMAP_API_KEY || '',
    WEB_SERVICE_KEY: import.meta.env.VITE_AMAP_WEB_SERVICE_KEY || '',
    SECURITY_JS_CODE: import.meta.env.VITE_AMAP_SECURITY_JS_CODE || '',
    VERSION: import.meta.env.VITE_AMAP_VERSION || '2.0'
  }
};

// 初始化高德地图安全配置
// 必须在应用启动时立即执行，在加载任何高德地图API之前
export function initializeAmapSecurity() {
  if (!(window as any)._AMapSecurityConfig) {
    (window as any)._AMapSecurityConfig = {};
  }
  (window as any)._AMapSecurityConfig.securityJsCode = config.AMAP.SECURITY_JS_CODE;

  // 安全：不在日志中输出任何敏感信息
  // 即使在开发环境也只输出基本状态信息
  if (config.DEBUG_MODE && !import.meta.env.PROD) {
    logger.info('[Amap Security] Security configuration loaded', {
      hasApiKey: !!config.AMAP.API_KEY,
      hasSecurityCode: !!config.AMAP.SECURITY_JS_CODE,
      // 不输出密钥长度或任何可识别信息
    });
  }
}
