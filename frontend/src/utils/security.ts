// 前端安全工具
import { config } from '../config/env';
import { logger } from './logger';

// CSRF令牌管理
class CSRFManager {
  private static token: string | null = null;

  static setToken(token: string) {
    this.token = token;
    localStorage.setItem('csrf_token', token);
  }

  static getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('csrf_token');
    }
    return this.token;
  }

  static clearToken() {
    this.token = null;
    localStorage.removeItem('csrf_token');
  }

  static async refreshToken(): Promise<string | null> {
    try {
      const response = await fetch(`${config.API_BASE_URL}/api/csrf-token`, {
        method: 'GET',
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        this.setToken(data.token);
        return data.token;
      }
    } catch (error) {
      logger.error('刷新CSRF令牌失败:', error);
    }
    
    return null;
  }
}

// 输入验证
class InputValidator {
  // 验证邮箱格式
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // 验证密码强度
  static isStrongPassword(password: string): boolean {
    // 至少8位，包含大小写字母、数字和特殊字符
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
  }

  // 验证用户名格式
  static isValidUsername(username: string): boolean {
    // 2-20位，只允许字母、数字、下划线和中文
    const usernameRegex = /^[a-zA-Z0-9_\u4e00-\u9fa5]{2,20}$/;
    return usernameRegex.test(username);
  }

  // 验证颜色格式
  static isValidHexColor(color: string): boolean {
    const colorRegex = /^#[0-9A-Fa-f]{6}$/;
    return colorRegex.test(color);
  }

  // 验证坐标范围
  static isValidCoordinate(lat: number, lng: number): boolean {
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }

  // 验证网格ID格式
  static isValidGridId(gridId: string): boolean {
    const gridIdRegex = /^grid_\d+_\d+$/;
    return gridIdRegex.test(gridId);
  }

  // 清理HTML内容
  static sanitizeHTML(html: string): string {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }

  // 清理用户输入
  static sanitizeInput(input: string): string {
    return input
      .replace(/[<>]/g, '') // 移除尖括号
      .replace(/javascript:/gi, '') // 移除javascript协议
      .replace(/on\w+=/gi, '') // 移除事件处理器
      .trim();
  }
}

// XSS防护
class XSSProtection {
  // 检查是否包含XSS攻击代码
  static containsXSS(input: string): boolean {
    const xssPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+=/i,
      /vbscript:/i,
      /data:text\/html/i,
      /<iframe/i,
      /<object/i,
      /<embed/i
    ];

    return xssPatterns.some(pattern => pattern.test(input));
  }

  // 转义HTML特殊字符
  static escapeHTML(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // 清理HTML内容
  static sanitizeHTML(html: string): string {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }

  // 安全的innerHTML设置
  static setInnerHTML(element: HTMLElement, content: string): void {
    if (this.containsXSS(content)) {
      logger.warn('检测到潜在的XSS攻击，已阻止');
      element.textContent = content;
    } else {
      element.innerHTML = this.sanitizeHTML(content);
    }
  }
}

// 安全存储
class SecureStorage {
  // 加密存储敏感数据
  static setSecureItem(key: string, value: string): void {
    try {
      // 简单的base64编码（生产环境应使用更强的加密）
      const encoded = btoa(encodeURIComponent(value));
      localStorage.setItem(key, encoded);
    } catch (error) {
      logger.error('安全存储失败:', error);
    }
  }

  // 解密获取敏感数据
  static getSecureItem(key: string): string | null {
    try {
      const encoded = localStorage.getItem(key);
      if (encoded) {
        return decodeURIComponent(atob(encoded));
      }
    } catch (error) {
      logger.error('安全获取失败:', error);
    }
    return null;
  }

  // 清除敏感数据
  static removeSecureItem(key: string): void {
    localStorage.removeItem(key);
  }

  // 清除所有敏感数据
  static clearSecureItems(): void {
    const secureKeys = [
      'funnypixels_token',
              'funnypixels_refresh_token',
        'funnypixels_user',
      'csrf_token'
    ];

    secureKeys.forEach(key => {
      localStorage.removeItem(key);
    });
  }
}

// 安全请求
class SecureRequest {
  // 添加安全头到请求
  static addSecurityHeaders(headers: Record<string, string>): Record<string, string> {
    const csrfToken = CSRFManager.getToken();
    
    return {
      ...headers,
      'X-CSRF-Token': csrfToken || '',
      'X-Requested-With': 'XMLHttpRequest',
      'X-Content-Type-Options': 'nosniff'
    };
  }

  // 验证响应安全性
  static validateResponse(response: Response): boolean {
    // 检查内容类型
    const contentType = response.headers.get('content-type');
    if (contentType && !contentType.includes('application/json')) {
      logger.warn('响应内容类型异常:', contentType);
      return false;
    }

    // 检查安全头
    const csp = response.headers.get('content-security-policy');
    if (!csp) {
      logger.warn('缺少CSP头');
    }

    return true;
  }

  // 安全的fetch请求
  static async secureFetch(url: string, options: RequestInit = {}): Promise<Response> {
    // 添加安全头
    options.headers = this.addSecurityHeaders(options.headers as Record<string, string> || {});

    // 确保包含凭证
    options.credentials = 'include';

    try {
      const response = await fetch(url, options);
      
      // 验证响应
      if (!this.validateResponse(response)) {
        throw new Error('响应安全性验证失败');
      }

      return response;
    } catch (error) {
      logger.error('安全请求失败:', error);
      throw error;
    }
  }
}

// 安全监控
class SecurityMonitor {
  private static suspiciousActivities: Array<{
    type: string;
    timestamp: number;
    details: any;
  }> = [];

  // 记录可疑活动
  static logSuspiciousActivity(type: string, details: any): void {
    this.suspiciousActivities.push({
      type,
      timestamp: Date.now(),
      details
    });

    // 保持最近100条记录
    if (this.suspiciousActivities.length > 100) {
      this.suspiciousActivities = this.suspiciousActivities.slice(-100);
    }

    logger.warn(`🚨 可疑活动: ${type}`, details);
  }

  // 检查DOM篡改
  static detectDOMManipulation(): void {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              if (element.tagName === 'SCRIPT' && !element.hasAttribute('data-safe')) {
                this.logSuspiciousActivity('DOM_SCRIPT_INJECTION', {
                  tagName: element.tagName,
                  innerHTML: element.innerHTML
                });
              }
            }
          });
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // 检查异常的网络请求
  static detectAbnormalRequests(): void {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const [url, options] = args;
      
      // 检查可疑的URL
      if (typeof url === 'string') {
        const suspiciousPatterns = [
          /javascript:/i,
          /data:text\/html/i,
          /vbscript:/i
        ];

        if (suspiciousPatterns.some(pattern => pattern.test(url))) {
          this.logSuspiciousActivity('SUSPICIOUS_FETCH_URL', { url });
          throw new Error('可疑的请求URL');
        }
      }

      return originalFetch.apply(window, args);
    };
  }

  // 启动安全监控
  static startMonitoring(): void {
    this.detectDOMManipulation();
    this.detectAbnormalRequests();
    
    logger.info('🔒 前端安全监控已启动');
  }

  // 获取安全报告
  static getSecurityReport(): any {
    return {
      suspiciousActivities: this.suspiciousActivities.length,
      recentActivities: this.suspiciousActivities.slice(-10),
      timestamp: new Date().toISOString()
    };
  }
}

// 导出安全工具
export {
  CSRFManager,
  InputValidator,
  XSSProtection,
  SecureStorage,
  SecureRequest,
  SecurityMonitor
};

// 启动安全监控
if (typeof window !== 'undefined') {
  SecurityMonitor.startMonitoring();
}
