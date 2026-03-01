/**
 * 移动端手机号自动检测服务
 * 支持在WebView环境中自动获取用户手机号
 */

import { logger } from '../utils/logger';

export interface PhoneDetectionResult {
  phone: string | null;
  source: 'webview_android' | 'webview_ios' | 'user_input' | 'none';
  success: boolean;
  error?: string;
}

export interface WebViewInterface {
  getPhoneNumber?(): string;
  postMessage?(message: any): void;
}

export interface MobileDeviceInfo {
  isMobile: boolean;
  isWebView: boolean;
  platform: 'android' | 'ios' | 'unknown';
  userAgent: string;
}

class MobileAuthService {
  private static instance: MobileAuthService;

  constructor() {
    // 私有构造函数
  }

  static getInstance(): MobileAuthService {
    if (!MobileAuthService.instance) {
      MobileAuthService.instance = new MobileAuthService();
    }
    return MobileAuthService.instance;
  }

  /**
   * 检测设备信息
   */
  detectDevice(): MobileDeviceInfo {
    const userAgent = navigator.userAgent.toLowerCase();

    const isMobile = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);

    // 检测是否为WebView环境
    const isWebView = this.isWebViewEnvironment(userAgent);

    // 检测平台
    let platform: 'android' | 'ios' | 'unknown' = 'unknown';
    if (/android/i.test(userAgent)) {
      platform = 'android';
    } else if (/iphone|ipad|ipod/i.test(userAgent)) {
      platform = 'ios';
    }

    return {
      isMobile,
      isWebView,
      platform,
      userAgent: navigator.userAgent
    };
  }

  /**
   * 检测是否为WebView环境
   */
  private isWebViewEnvironment(userAgent: string): boolean {
    const webViewPatterns = [
      // Android WebView
      /wv/,
      /version\/[\d.]+.*mobile/,
      // iOS WebView
      /safari\/[\d.]+.*mobile/,
      // 通用WebView特征
      /webview/i,
      // 微信内置浏览器
      /micromessenger/i,
      // 支付宝内置浏览器
      /alipay/i,
      // QQ内置浏览器
      /qq\//i,
      // 小程序环境
      /miniprogram/i
    ];

    return webViewPatterns.some(pattern => pattern.test(userAgent));
  }

  /**
   * 尝试自动获取手机号
   */
  async detectPhoneNumber(): Promise<PhoneDetectionResult> {
    try {
      const deviceInfo = this.detectDevice();

      // 如果不是移动端，直接返回
      if (!deviceInfo.isMobile) {
        return {
          phone: null,
          source: 'none',
          success: false,
          error: '非移动端设备'
        };
      }

      // 如果不是WebView环境，需要用户手动输入
      if (!deviceInfo.isWebView) {
        return {
          phone: null,
          source: 'user_input',
          success: false,
          error: '需要在WebView环境中才能自动获取手机号'
        };
      }

      // 根据平台尝试获取手机号
      if (deviceInfo.platform === 'android') {
        return await this.getAndroidPhoneNumber();
      } else if (deviceInfo.platform === 'ios') {
        return await this.getIOSPhoneNumber();
      }

      return {
        phone: null,
        source: 'none',
        success: false,
        error: '不支持的移动端平台'
      };

    } catch (error) {
      logger.error('手机号检测失败:', error);
      return {
        phone: null,
        source: 'none',
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 从Android WebView获取手机号
   */
  private async getAndroidPhoneNumber(): Promise<PhoneDetectionResult> {
    try {
      // 检查Android接口是否可用
      const androidInterface = (window as any).android;

      if (!androidInterface || typeof androidInterface.getPhoneNumber !== 'function') {
        return {
          phone: null,
          source: 'webview_android',
          success: false,
          error: 'Android WebView接口不可用'
        };
      }

      // 调用Android接口获取手机号
      const phone = androidInterface.getPhoneNumber();

      if (!phone) {
        return {
          phone: null,
          source: 'webview_android',
          success: false,
          error: '无法获取手机号'
        };
      }

      // 验证手机号格式
      if (!this.isValidPhoneNumber(phone)) {
        return {
          phone: null,
          source: 'webview_android',
          success: false,
          error: '手机号格式不正确'
        };
      }

      return {
        phone: this.formatPhoneNumber(phone),
        source: 'webview_android',
        success: true
      };

    } catch (error) {
      return {
        phone: null,
        source: 'webview_android',
        success: false,
        error: error instanceof Error ? error.message : 'Android WebView调用失败'
      };
    }
  }

  /**
   * 从iOS WebView获取手机号
   */
  private async getIOSPhoneNumber(): Promise<PhoneDetectionResult> {
    try {
      // 检查iOS WebView接口是否可用
      const webkit = (window as any).webkit;

      if (!webkit || !webkit.messageHandlers || !webkit.messageHandlers.getPhoneNumber) {
        return {
          phone: null,
          source: 'webview_ios',
          success: false,
          error: 'iOS WebView接口不可用'
        };
      }

      // 使用Promise处理异步回调
      return new Promise<PhoneDetectionResult>((resolve) => {
        // 设置超时时间
        const timeout = setTimeout(() => {
          resolve({
            phone: null,
            source: 'webview_ios',
            success: false,
            error: '获取手机号超时'
          });
        }, 10000); // 10秒超时

        // 发送消息给原生代码
        webkit.messageHandlers.getPhoneNumber.postMessage({
          callback: (phone: string) => {
            clearTimeout(timeout);

            if (!phone) {
              resolve({
                phone: null,
                source: 'webview_ios',
                success: false,
                error: '无法获取手机号'
              });
              return;
            }

            // 验证手机号格式
            if (!this.isValidPhoneNumber(phone)) {
              resolve({
                phone: null,
                source: 'webview_ios',
                success: false,
                error: '手机号格式不正确'
              });
              return;
            }

            resolve({
              phone: this.formatPhoneNumber(phone),
              source: 'webview_ios',
              success: true
            });
          }
        });
      });

    } catch (error) {
      return {
        phone: null,
        source: 'webview_ios',
        success: false,
        error: error instanceof Error ? error.message : 'iOS WebView调用失败'
      };
    }
  }

  /**
   * 验证手机号格式
   */
  private isValidPhoneNumber(phone: string): boolean {
    // 移除所有非数字字符
    const cleanPhone = phone.replace(/\D/g, '');

    // 中国手机号正则表达式（11位，1开头）
    const phoneRegex = /^1[3-9]\d{9}$/;

    return phoneRegex.test(cleanPhone);
  }

  /**
   * 格式化手机号
   */
  private formatPhoneNumber(phone: string): string {
    // 移除所有非数字字符
    const cleanPhone = phone.replace(/\D/g, '');

    // 确保是11位
    if (cleanPhone.length === 11) {
      return cleanPhone;
    }

    // 如果不是11位，返回原始格式（可能包含国际区号）
    return phone;
  }

  /**
   * 检查是否支持自动获取手机号
   */
  isAutoDetectionSupported(): boolean {
    const deviceInfo = this.detectDevice();

    if (!deviceInfo.isMobile || !deviceInfo.isWebView) {
      return false;
    }

    if (deviceInfo.platform === 'android') {
      const androidInterface = (window as any).android;
      return !!(androidInterface && typeof androidInterface.getPhoneNumber === 'function');
    }

    if (deviceInfo.platform === 'ios') {
      const webkit = (window as any).webkit;
      return !!(webkit && webkit.messageHandlers && webkit.messageHandlers.getPhoneNumber);
    }

    return false;
  }

  /**
   * 获取设备详细信息（用于调试）
   */
  getDeviceDebugInfo(): any {
    const deviceInfo = this.detectDevice();

    return {
      ...deviceInfo,
      isAutoDetectionSupported: this.isAutoDetectionSupported(),
      hasAndroidInterface: !!(window as any).android,
      hasIOSWebKit: !!((window as any).webkit?.messageHandlers),
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      screen: {
        width: screen.width,
        height: screen.height,
        colorDepth: screen.colorDepth
      },
      window: {
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio
      }
    };
  }

  /**
   * 生成手机号掩码显示
   */
  maskPhoneNumber(phone: string): string {
    if (!phone || phone.length < 11) {
      return phone;
    }

    return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
  }

  /**
   * 验证手机号归属地（可选功能）
   */
  async getPhoneLocation(phone: string): Promise<{
    province: string;
    city: string;
    carrier: string;
  }> {
    try {
      // 这里可以调用第三方手机号归属地查询API
      // 暂时返回默认值
      const prefix = phone.substring(0, 3);
      const carriers: { [key: string]: string } = {
        '130': '中国联通', '131': '中国联通', '132': '中国联通', '155': '中国联通', '156': '中国联通', '185': '中国联通', '186': '中国联通',
        '134': '中国移动', '135': '中国移动', '136': '中国移动', '137': '中国移动', '138': '中国移动', '139': '中国移动',
        '147': '中国移动', '150': '中国移动', '151': '中国移动', '152': '中国移动', '157': '中国移动', '158': '中国移动',
        '159': '中国移动', '182': '中国移动', '183': '中国移动', '184': '中国移动', '187': '中国移动', '188': '中国移动',
        '133': '中国电信', '153': '中国电信', '180': '中国电信', '181': '中国电信', '189': '中国电信'
      };

      return {
        province: '未知',
        city: '未知',
        carrier: carriers[prefix] || '未知运营商'
      };
    } catch (error) {
      logger.error('获取手机号归属地失败:', error);
      return {
        province: '未知',
        city: '未知',
        carrier: '未知运营商'
      };
    }
  }
}

export default MobileAuthService.getInstance();