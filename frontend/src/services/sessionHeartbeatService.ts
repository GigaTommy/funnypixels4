import { api } from './api';
import { logger } from '../utils/logger';

class SessionHeartbeatService {
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private visibilityChangeHandler: (() => void) | null = null;
  private beforeUnloadHandler: (() => void) | null = null;
  private isPageVisible = true;

  /**
   * 开始心跳监控
   */
  startHeartbeat(sessionId: string, userId: string) {
    this.stopHeartbeat(); // 确保之前的心跳已停止

    // 立即发送一次心跳
    this.sendHeartbeat(sessionId, userId);

    // 设置定期心跳
    this.heartbeatInterval = setInterval(() => {
      if (this.isPageVisible) {
        this.sendHeartbeat(sessionId, userId);
      }
    }, 5 * 60 * 1000); // 5分钟间隔

    // 监听页面可见性变化
    this.setupVisibilityMonitoring(sessionId, userId);

    // 监听页面卸载事件
    this.setupPageUnloadMonitoring(sessionId, userId);

    logger.info('SessionHeartbeatService: 心跳监控已启动', { sessionId: sessionId.slice(0, 8) });
  }

  /**
   * 停止心跳监控
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.visibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
      this.visibilityChangeHandler = null;
    }

    if (this.beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
      this.beforeUnloadHandler = null;
    }

    logger.info('SessionHeartbeatService: 心跳监控已停止');
  }

  /**
   * 发送心跳请求
   */
  private async sendHeartbeat(sessionId: string, userId: string) {
    try {
      const response = await api.post('/session-heartbeat/heartbeat', {
        sessionId,
        userId
      });

      if (response.data.success) {
        logger.debug('SessionHeartbeatService: 心跳发送成功', { sessionId: sessionId.slice(0, 8) });
      } else {
        logger.warn('SessionHeartbeatService: 心跳发送失败', {
          sessionId: sessionId.slice(0, 8),
          message: response.data.message
        });
      }
    } catch (error) {
      logger.error('SessionHeartbeatService: 心跳发送错误', error);
    }
  }

  /**
   * 设置页面可见性监控
   */
  private setupVisibilityMonitoring(sessionId: string, userId: string) {
    this.visibilityChangeHandler = () => {
      const isVisible = !document.hidden;
      this.isPageVisible = isVisible;

      this.handleVisibilityChange(sessionId, userId, isVisible);
    };

    document.addEventListener('visibilitychange', this.visibilityChangeHandler);

    // 检查初始可见性状态
    this.isPageVisible = !document.hidden;
    this.handleVisibilityChange(sessionId, userId, this.isPageVisible);
  }

  /**
   * 处理页面可见性变化
   */
  private async handleVisibilityChange(sessionId: string, userId: string, isVisible: boolean) {
    try {
      const response = await api.post('/session-heartbeat/visibility', {
        sessionId,
        userId,
        isVisible
      });

      if (response.data.success) {
        logger.debug('SessionHeartbeatService: 可见性状态已更新', {
          isVisible,
          sessionId: sessionId.slice(0, 8)
        });
      }
    } catch (error) {
      logger.error('SessionHeartbeatService: 更新可见性状态失败', error);
    }
  }

  /**
   * 设置页面卸载监控
   */
  private setupPageUnloadMonitoring(sessionId: string, userId: string) {
    this.beforeUnloadHandler = async () => {
      // 发送最后一次心跳并结束会话
      try {
        await this.endSessionGracefully(sessionId, userId);
      } catch (error) {
        logger.error('SessionHeartbeatService: 页面卸载时结束会话失败', error);
      }
    };

    window.addEventListener('beforeunload', this.beforeUnloadHandler);

    // 监听页面隐藏事件（移动端浏览器切换标签页时）
    document.addEventListener('pagehide', this.beforeUnloadHandler);
  }

  /**
   * 优雅结束会话
   */
  private async endSessionGracefully(sessionId: string, userId: string) {
    try {
      const response = await api.post(`/session-heartbeat/end/${sessionId}`);

      if (response.data.success) {
        logger.info('SessionHeartbeatService: 会话已优雅结束', { sessionId: sessionId.slice(0, 8) });
      } else {
        logger.warn('SessionHeartbeatService: 优雅结束会话失败', {
          sessionId: sessionId.slice(0, 8),
          message: response.data.message
        });
      }
    } catch (error) {
      logger.error('SessionHeartbeatService: 优雅结束会话错误', error);
    }
  }

  /**
   * 检查会话是否仍然活跃
   */
  async checkSessionActive(sessionId: string): Promise<boolean> {
    try {
      const response = await api.get(`/session-heartbeat/heartbeat/${sessionId}/active`);

      return response.data.success && response.data.data.isActive;
    } catch (error) {
      logger.error('SessionHeartbeatService: 检查会话活跃状态失败', error);
      return false;
    }
  }

  /**
   * 获取活跃会话（带心跳检查）
   */
  async getActiveSession(): Promise<any> {
    try {
      const response = await api.get('/session-heartbeat/active');

      if (response.data.success) {
        return response.data.data;
      }

      return null;
    } catch (error) {
      logger.error('SessionHeartbeatService: 获取活跃会话失败', error);
      return null;
    }
  }
}

export const sessionHeartbeatService = new SessionHeartbeatService();