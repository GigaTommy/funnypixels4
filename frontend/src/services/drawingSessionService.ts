import { api } from './api';
import { logger } from '../utils/logger';

export interface DrawingSession {
  id: string;
  userId: string;
  sessionName: string;
  drawingType: 'gps' | 'manual';
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
  startCity?: string;
  startCountry?: string;
  allianceId?: string;
  metadata?: {
    statistics?: {
      pixelCount: number;
      uniqueGrids: number;
      patternsUsed: number;
      firstPixelTime: string;
      lastPixelTime: string;
      duration: number; // 分钟
    };
    calculatedAt?: string;
    [key: string]: any;
  };
  createdAt: string;
  updatedAt: string;
}

export interface SessionStatistics {
  sessionId: string;
  statistics: {
    pixelCount: number;
    uniqueGrids: number;
    patternsUsed: number;
    firstPixelTime?: string;
    lastPixelTime?: string;
    duration: number;
  };
  pixelCount: number;
  session: DrawingSession;
}

export interface DrawingSessionResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface SessionListResponse {
  sessions: DrawingSession[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface StartSessionOptions {
  sessionName?: string;
  drawingType?: 'gps' | 'manual';
  startLocation?: {
    longitude: number;
    latitude: number;
  };
  startCity?: string;
  startCountry?: string;
  allianceId?: string;
  metadata?: Record<string, any>;
}

export interface EndSessionOptions {
  endLocation?: {
    longitude: number;
    latitude: number;
  };
  endCity?: string;
  endCountry?: string;
  metadata?: Record<string, any>;
}

class DrawingSessionService {
  private readonly baseUrl = '/drawing-sessions';

  /**
   * 开始新的绘制会话
   */
  async startSession(options: StartSessionOptions = {}): Promise<DrawingSessionResponse<DrawingSession>> {
    try {
      const response = await api.post(`${this.baseUrl}/start`, options);
      return response.data;
    } catch (error) {
      logger.error('开始绘制会话失败:', error);
      throw error;
    }
  }

  /**
   * 结束绘制会话
   */
  async endSession(sessionId: string, options: EndSessionOptions = {}): Promise<DrawingSessionResponse<DrawingSession>> {
    try {
      const response = await api.post(`${this.baseUrl}/${sessionId}/end`, options);
      return response.data;
    } catch (error) {
      logger.error('结束绘制会话失败:', error);
      throw error;
    }
  }

  /**
   * 暂停会话
   */
  async pauseSession(sessionId: string): Promise<DrawingSessionResponse<DrawingSession>> {
    try {
      const response = await api.post(`${this.baseUrl}/${sessionId}/pause`);
      return response.data;
    } catch (error) {
      logger.error('暂停会话失败:', error);
      throw error;
    }
  }

  /**
   * 恢复会话
   */
  async resumeSession(sessionId: string): Promise<DrawingSessionResponse<DrawingSession>> {
    try {
      const response = await api.post(`${this.baseUrl}/${sessionId}/resume`);
      return response.data;
    } catch (error) {
      logger.error('恢复会话失败:', error);
      throw error;
    }
  }

  /**
   * 获取当前活跃会话
   */
  async getActiveSession(): Promise<DrawingSessionResponse<DrawingSession | null>> {
    try {
      const response = await api.get(`${this.baseUrl}/active`);
      return response.data;
    } catch (error) {
      logger.error('获取活跃会话失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户会话列表
   */
  async getUserSessions(options: {
    page?: number;
    limit?: number;
    status?: 'all' | 'active' | 'completed' | 'paused';
    startDate?: string;
    endDate?: string;
  } = {}): Promise<DrawingSessionResponse<SessionListResponse>> {
    try {
      const params = new URLSearchParams();

      if (options.page) params.append('page', options.page.toString());
      if (options.limit) params.append('limit', options.limit.toString());
      if (options.status) params.append('status', options.status);
      if (options.startDate) params.append('startDate', options.startDate);
      if (options.endDate) params.append('endDate', options.endDate);

      const response = await api.get(`${this.baseUrl}?${params}`);
      return response.data;
    } catch (error) {
      logger.error('获取用户会话列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取会话详情
   */
  async getSessionDetails(sessionId: string): Promise<DrawingSessionResponse<{
    session: DrawingSession;
    pixels: Array<{
      grid_id: string;
      longitude: number;
      latitude: number;
      pattern_id: string;
      color: string;
      alliance_id: string;
      created_at: string;
    }>;
  }>> {
    try {
      const response = await api.get(`${this.baseUrl}/${sessionId}`);
      return response.data;
    } catch (error) {
      logger.error('获取会话详情失败:', error);
      throw error;
    }
  }

  /**
   * 获取会话统计信息
   */
  async getSessionStatistics(sessionId: string): Promise<DrawingSessionResponse<SessionStatistics>> {
    try {
      const response = await api.get(`${this.baseUrl}/${sessionId}/statistics`);
      return response.data;
    } catch (error) {
      logger.error('获取会话统计失败:', error);
      throw error;
    }
  }

  /**
   * 格式化会话持续时间
   */
  formatSessionDuration(minutes: number): string {
    if (minutes < 1) {
      return '少于1分钟';
    } else if (minutes < 60) {
      return `${Math.round(minutes)}分钟`;
    } else if (minutes < 1440) {
      const hours = Math.floor(minutes / 60);
      const mins = Math.round(minutes % 60);
      return `${hours}小时${mins > 0 ? mins + '分钟' : ''}`;
    } else {
      const days = Math.floor(minutes / 1440);
      const hours = Math.floor((minutes % 1440) / 60);
      return `${days}天${hours > 0 ? hours + '小时' : ''}`;
    }
  }

  /**
   * 格式化时间显示
   */
  formatTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * 获取会话状态显示文本
   */
  getSessionStatusText(status: string): string {
    const statusMap = {
      'active': '进行中',
      'completed': '已完成',
      'paused': '已暂停',
      'expired': '已过期'
    };
    return statusMap[status] || status;
  }

  /**
   * 获取会话状态颜色
   */
  getSessionStatusColor(status: string): string {
    const colorMap = {
      'active': '#10b981', // 绿色
      'completed': '#3b82f6', // 蓝色
      'paused': '#f59e0b', // 黄色
      'expired': '#ef4444' // 红色
    };
    return colorMap[status] || '#666666';
  }

  /**
   * 检查是否可以开始新会话
   */
  async canStartNewSession(): Promise<boolean> {
    try {
      const result = await this.getActiveSession();
      return !result.data || result.data.status !== 'active';
    } catch (error) {
      logger.error('检查是否可以开始新会话失败:', error);
      return false;
    }
  }

  /**
   * 生成会话名称
   */
  generateSessionName(prefix = '绘制任务'): string {
    const now = new Date();
    const timeStr = now.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    return `${prefix} ${timeStr}`;
  }

  /**
   * 计算会话效率（像素/分钟）
   */
  calculateSessionEfficiency(pixelCount: number, durationMinutes: number): number {
    if (durationMinutes === 0) return 0;
    return Math.round(pixelCount / durationMinutes * 10) / 10;
  }

  /**
   * 获取会话效率评级
   */
  getEfficiencyRating(efficiency: number): { rating: string; color: string } {
    if (efficiency >= 10) {
      return { rating: '极高', color: '#10b981' };
    } else if (efficiency >= 5) {
      return { rating: '高效', color: '#3b82f6' };
    } else if (efficiency >= 2) {
      return { rating: '正常', color: '#f59e0b' };
    } else {
      return { rating: '低效', color: '#ef4444' };
    }
  }

  /**
   * 生成会话描述
   */
  generateSessionDescription(session: DrawingSession): string {
    const stats = session.metadata?.statistics;
    if (!stats) {
      return `${this.getSessionStatusText(session.status)} - ${session.sessionName}`;
    }

    return `${stats.pixelCount}像素 ${this.formatSessionDuration(stats.duration)} ${session.sessionName}`;
  }
}

export const drawingSessionService = new DrawingSessionService();