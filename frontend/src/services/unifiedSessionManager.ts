import { drawingSessionService, type DrawingSession, type DrawingSessionResponse } from './drawingSessionService';
import { sessionHeartbeatService } from './sessionHeartbeatService';
import { logger } from '../utils/logger';
import { enhancedGpsService } from './enhancedGpsService';
import { EnhancedGpsService } from './enhancedGpsService';

export type DrawingMode = 'idle' | 'gps' | 'manual' | 'test';

export interface SessionOptions {
  sessionName?: string;
  drawingType: 'gps' | 'manual' | 'test';
  startLocation?: {
    longitude: number;
    latitude: number;
  };
  startCity?: string;
  startCountry?: string;
  allianceId?: string;
  metadata?: Record<string, any>;
}

export interface UnifiedSession {
  id: string;
  userId: string;
  mode: DrawingMode;
  sessionName: string;
  drawingType: 'gps' | 'manual' | 'test';
  startTime: string;
  endTime?: string;
  status: 'active' | 'completed' | 'paused' | 'expired';
  startLocation?: {
    longitude: number;
    latitude: number;
  };
  endLocation?: {
    longitude: number;
    latitude: number;
  };
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

class UnifiedSessionManager {
  private currentSession: UnifiedSession | null = null;
  private currentMode: DrawingMode = 'idle';
  private userId: string | null = null;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.initializeFromStorage();
  }

  // 状态订阅机制
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }

  // 获取当前状态
  getCurrentSession(): UnifiedSession | null {
    return this.currentSession;
  }

  getCurrentSessionId(): string | null {
    return this.currentSession?.id || null;
  }

  getCurrentMode(): DrawingMode {
    return this.currentMode;
  }

  isSessionActive(): boolean {
    return this.currentSession !== null && this.currentSession.status === 'active';
  }

  // 初始化用户信息
  setUserId(userId: string) {
    logger.info('🔍 setUserId调用 - userId:', userId);
    logger.info('🔍 setUserId调用 - userId类型:', typeof userId);
    this.userId = userId;
    logger.info('🔍 setUserId完成 - 当前this.userId:', this.userId);
  }

  // 从本地存储恢复状态
  private async initializeFromStorage() {
    try {
      const storedSession = localStorage.getItem('unified_session');
      const storedMode = localStorage.getItem('unified_mode') as DrawingMode;

      if (storedSession && storedMode && storedMode !== 'idle') {
        const session = JSON.parse(storedSession);

        // 验证会话是否仍然有效
        try {
          const activeResult = await drawingSessionService.getActiveSession();
          if (activeResult.success && activeResult.data) {
            // 如果后端有活跃会话，检查是否匹配
            if (activeResult.data.id === session.id) {
              this.currentSession = { ...activeResult.data, mode: storedMode };
              this.currentMode = storedMode;

              // 恢复心跳监控
              if (this.userId) {
                sessionHeartbeatService.startHeartbeat(session.id, this.userId);
              }

              logger.info('✅ 恢复活跃会话:', session.id);
            } else {
              // 会话不匹配，清理本地状态
              this.clearLocalSession();
            }
          } else {
            // 后端没有活跃会话，清理本地状态
            this.clearLocalSession();
          }
        } catch (error) {
          logger.warn('验证会话失败，清理本地状态:', error);
          this.clearLocalSession();
        }
      }
    } catch (error) {
      logger.warn('恢复会话状态失败:', error);
      this.clearLocalSession();
    }
  }

  // 保存到本地存储
  private saveToLocal() {
    if (this.currentSession) {
      localStorage.setItem('unified_session', JSON.stringify(this.currentSession));
      localStorage.setItem('unified_mode', this.currentMode);
    } else {
      this.clearLocalSession();
    }
  }

  // 清理本地存储
  private clearLocalSession() {
    localStorage.removeItem('unified_session');
    localStorage.removeItem('unified_mode');
    localStorage.removeItem('gps_test_route');
    localStorage.removeItem('gps_simulation_enabled');
  }

  // 统一的会话创建方法
  async startSession(mode: DrawingMode, options: SessionOptions): Promise<DrawingSessionResponse<UnifiedSession>> {
    logger.info('🔍 startSession调试 - 当前userId:', this.userId);
    logger.info('🔍 startSession调试 - userId类型:', typeof this.userId);

    if (!this.userId) {
      logger.error('❌ startSession失败 - 用户未登录，userId为空');
      throw new Error('用户未登录');
    }

    // 检查当前状态
    if (this.currentSession && this.currentSession.status === 'active') {
      if (this.currentMode === mode) {
        // 已经是相同模式，返回现有会话
        return {
          success: true,
          data: this.currentSession,
          message: '已在相同模式中'
        };
      } else {
        // 不同模式，需要先结束当前会话
        logger.info(`⚠️ 切换模式: ${this.currentMode} → ${mode}，先结束当前会话`);
        await this.endSession();
      }
    }

    try {
      logger.info(`🚀 创建绘制会话: 模式=${mode}, 类型=${options.drawingType}`);

      // 🔧 对于测试模式，重置GPS网格状态以允许重新绘制
      if (mode === 'test' || options.drawingType === 'test') {
        logger.info('🧹 测试模式启动，重置GPS网格绘制状态');
        // 通过类实例访问静态方法
      (enhancedGpsService as any).resetAllGridStates();
      }

      // 调用后端API创建会话（将test类型转换为gps类型）
      const apiOptions = {
        ...options,
        drawingType: options.drawingType === 'test' ? 'gps' : options.drawingType
      };
      const sessionResult = await drawingSessionService.startSession(apiOptions);

      if (sessionResult.success && sessionResult.data) {
        // 创建统一会话对象
        const unifiedSession: UnifiedSession = {
          ...sessionResult.data,
          mode,
          drawingType: options.drawingType
        };

        this.currentSession = unifiedSession;
        this.currentMode = mode;

        // 启动心跳监控
        sessionHeartbeatService.startHeartbeat(unifiedSession.id, this.userId);

        // 保存到本地存储
        this.saveToLocal();

        // 通知监听器
        this.notifyListeners();

        logger.info(`✅ 绘制会话创建成功: ${unifiedSession.id}, 模式=${mode}`);

        return {
          success: true,
          data: unifiedSession,
          message: '绘制会话已开始'
        };
      } else {
        throw new Error(sessionResult.error || '创建会话失败');
      }

    } catch (error) {
      logger.error('❌ 创建绘制会话失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  // 结束会话
  async endSession(): Promise<DrawingSessionResponse<UnifiedSession>> {
    if (!this.currentSession) {
      return {
        success: true,
        message: '没有活跃会话'
      };
    }

    try {
      logger.info(`🛑 结束绘制会话: ${this.currentSession.id}, 模式=${this.currentMode}`);

      // 停止心跳监控
      sessionHeartbeatService.stopHeartbeat();

      // 调用后端API结束会话
      const endResult = await drawingSessionService.endSession(this.currentSession.id, {
        metadata: {
          endMode: this.currentMode
        }
      });

      // 清理本地状态
      const endedSession = this.currentSession;
      this.currentSession = null;
      this.currentMode = 'idle';
      this.clearLocalSession();

      // 通知监听器
      this.notifyListeners();

      logger.info(`✅ 绘制会话已结束: ${endedSession.id}`);

      // 🎨 触发会话结束事件，通知UI显示分享弹窗
      const sessionEndEvent = new CustomEvent('session:ended', {
        detail: { sessionId: endedSession.id }
      });
      window.dispatchEvent(sessionEndEvent);
      logger.info('🎉 已触发会话结束事件，等待分享界面弹出');

      return {
        success: true,
        data: endedSession,
        message: '绘制会话已结束'
      };

    } catch (error) {
      logger.error('❌ 结束绘制会话失败:', error);

      // 即使API失败，也要清理本地状态
      const endedSession = this.currentSession;
      this.currentSession = null;
      this.currentMode = 'idle';
      this.clearLocalSession();
      this.notifyListeners();

      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  // 暂停会话
  async pauseSession(): Promise<DrawingSessionResponse<UnifiedSession>> {
    if (!this.currentSession || this.currentSession.status !== 'active') {
      return {
        success: false,
        error: '没有活跃会话'
      };
    }

    try {
      const result = await drawingSessionService.pauseSession(this.currentSession.id);

      if (result.success && result.data) {
        this.currentSession.status = 'paused';
        this.saveToLocal();
        this.notifyListeners();
      }

      return {
        success: result.success,
        data: result.data ? {
          ...result.data,
          mode: this.currentMode,
          drawingType: this.currentMode === 'idle' ? 'manual' : this.currentMode
        } : null,
        error: result.error
      };

    } catch (error) {
      logger.error('❌ 暂停会话失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  // 恢复会话
  async resumeSession(): Promise<DrawingSessionResponse<UnifiedSession>> {
    if (!this.currentSession || this.currentSession.status !== 'paused') {
      return {
        success: false,
        error: '没有暂停的会话'
      };
    }

    try {
      const result = await drawingSessionService.resumeSession(this.currentSession.id);

      if (result.success && result.data) {
        this.currentSession.status = 'active';
        this.saveToLocal();
        this.notifyListeners();
      }

      return {
        success: result.success,
        data: result.data ? {
          ...result.data,
          mode: this.currentMode,
          drawingType: this.currentMode === 'idle' ? 'manual' : this.currentMode
        } : null,
        error: result.error
      };

    } catch (error) {
      logger.error('❌ 恢复会话失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  // 记录像素到当前会话
  async recordPixel(pixelData: any): Promise<boolean> {
    if (!this.currentSession || this.currentSession.status !== 'active') {
      logger.warn('⚠️ 没有活跃会话，无法记录像素');
      return false;
    }

    try {
      // TODO: 实现像素记录功能
      logger.info('🎨 记录像素到会话:', pixelData);
      return true; // 暂时返回成功
    } catch (error) {
      logger.error('❌ 记录像素失败:', error);
      return false;
    }
  }

  // 获取会话统计
  async getSessionStatistics(): Promise<any> {
    if (!this.currentSession) {
      return null;
    }

    try {
      const stats = await drawingSessionService.getSessionStatistics(this.currentSession.id);
      return stats;

    } catch (error) {
      logger.error('❌ 获取会话统计失败:', error);
      return null;
    }
  }

  // 强制刷新当前会话状态
  async refreshSession(): Promise<boolean> {
    if (!this.currentSession) {
      return false;
    }

    try {
      const sessionDetails = await drawingSessionService.getSessionDetails(this.currentSession.id);
      if (sessionDetails.success && sessionDetails.data) {
        this.currentSession = {
          ...sessionDetails.data.session,
          mode: this.currentMode
        };
        this.saveToLocal();
        this.notifyListeners();
        return true;
      }

      return false;

    } catch (error) {
      logger.error('❌ 刷新会话状态失败:', error);
      return false;
    }
  }

  // 清理所有状态
  clearAll() {
    sessionHeartbeatService.stopHeartbeat();
    this.currentSession = null;
    this.currentMode = 'idle';
    this.clearLocalSession();
    this.notifyListeners();
  }

  // 获取模式描述
  getModeDescription(mode: DrawingMode): string {
    switch (mode) {
      case 'gps': return 'GPS自动绘制';
      case 'manual': return '手动绘制';
      case 'test': return 'GPS测试模式';
      case 'idle': return '空闲模式';
      default: return '未知模式';
    }
  }

  // 检查是否可以切换到指定模式
  canSwitchToMode(targetMode: DrawingMode): boolean {
    if (this.currentMode === targetMode) {
      return true; // 已是目标模式
    }

    if (this.currentMode === 'idle') {
      return true; // 从空闲模式可以切换到任何模式
    }

    if (targetMode === 'idle') {
      return true; // 可以切换到空闲模式
    }

    // 测试模式下允许切换到任何模式进行测试
    if (this.currentMode === 'test') {
      logger.debug('🧪 测试模式：允许切换到任何模式进行测试');
      return true;
    }

    // 检查模式优先级（非测试模式）
    const priorityMap = {
      'gps': 2,
      'manual': 1,
      'idle': 0
    };

    const currentPriority = priorityMap[this.currentMode as keyof typeof priorityMap] ?? 0;
    const targetPriority = priorityMap[targetMode as keyof typeof priorityMap] ?? 0;

    return targetPriority > currentPriority;
  }
}

// 创建单例实例
export const unifiedSessionManager = new UnifiedSessionManager();

// 导出工具函数
export { UnifiedSessionManager };