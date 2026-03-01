import { AuthService } from './auth';
import { logger } from '../utils/logger';

// 令牌状态事件类型
export type TokenEventType = 'token_refreshed' | 'token_expired' | 'login_required';

// 令牌状态事件监听器
type TokenEventListener = (event: TokenEventType, data?: any) => void;

class TokenManagerService {
  private listeners: TokenEventListener[] = [];
  private refreshTimer: NodeJS.Timeout | null = null;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startTokenMonitoring();
  }

  // 添加事件监听器
  addEventListener(listener: TokenEventListener): void {
    this.listeners.push(listener);
  }

  // 移除事件监听器
  removeEventListener(listener: TokenEventListener): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  // 触发事件
  private emit(event: TokenEventType, data?: any): void {
    this.listeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        logger.error('令牌事件监听器错误:', error);
      }
    });
  }

  // 开始令牌监控
  private startTokenMonitoring(): void {
    // 每30秒检查一次令牌状态
    this.checkInterval = setInterval(() => {
      this.checkTokenStatus();
    }, 30000);

    // 页面可见性变化时检查令牌
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.checkTokenStatus();
      }
    });

    // 页面焦点变化时检查令牌
    window.addEventListener('focus', () => {
      this.checkTokenStatus();
    });
  }

  // 检查令牌状态
  private async checkTokenStatus(): Promise<void> {
    try {
      if (!AuthService.isAuthenticated()) {
        return;
      }

      const token = localStorage.getItem('funnypixels_token');
      if (!token) {
        return;
      }

      // 解析令牌
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp * 1000;
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;

      // 如果令牌在5分钟内过期，自动续期
      if (exp - now < fiveMinutes) {
        logger.info('🔄 检测到令牌即将过期，自动续期...');
        await this.refreshToken();
      }
    } catch (error) {
      logger.warn('令牌状态检查失败:', error);
    }
  }

  // 刷新令牌
  private async refreshToken(): Promise<void> {
    try {
      const success = await AuthService.refreshToken();
      if (success) {
        logger.info('✅ 令牌自动续期成功');
        this.emit('token_refreshed');
      } else {
        logger.info('❌ 令牌自动续期失败');
        this.emit('token_expired');
        this.emit('login_required');
      }
    } catch (error) {
      logger.error('令牌续期失败:', error);
      this.emit('token_expired');
      this.emit('login_required');
    }
  }

  // 手动刷新令牌
  async manualRefresh(): Promise<boolean> {
    try {
      const success = await AuthService.refreshToken();
      if (success) {
        this.emit('token_refreshed');
        return true;
      } else {
        this.emit('token_expired');
        return false;
      }
    } catch (error) {
      logger.error('手动令牌续期失败:', error);
      this.emit('token_expired');
      return false;
    }
  }

  // 停止监控
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  // 获取令牌
  getToken(): string | null {
    return localStorage.getItem('funnypixels_token');
  }

  // 获取令牌信息
  getTokenInfo(): { isValid: boolean; expiresAt: Date | null; timeUntilExpiry: number | null } {
    try {
      const token = localStorage.getItem('funnypixels_token');
      if (!token) {
        return { isValid: false, expiresAt: null, timeUntilExpiry: null };
      }

      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp * 1000;
      const now = Date.now();
      const timeUntilExpiry = exp - now;

      return {
        isValid: timeUntilExpiry > 0,
        expiresAt: new Date(exp),
        timeUntilExpiry: timeUntilExpiry > 0 ? timeUntilExpiry : null
      };
    } catch (error) {
      return { isValid: false, expiresAt: null, timeUntilExpiry: null };
    }
  }
}

// 创建单例实例
export const tokenManager = new TokenManagerService();

// 导出类型
export type { TokenEventListener };
