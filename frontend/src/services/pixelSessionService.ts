import { api } from './api';
import { logger } from '../utils/logger';

export interface DrawingSession {
  sessionId: string;
  startTime: string;
  endTime: string;
  duration: {
    minutes: number;
    formatted: string;
  };
  statistics: {
    pixelCount: number;
    uniqueGrids: number;
    citiesVisited: number;
    patternsUsed: number;
  };
  locations: {
    start: {
      coordinates: [number, number] | null;
      city: string | null;
      country: string | null;
      gridId: string | null;
    };
    end: {
      coordinates: [number, number] | null;
      city: string | null;
      country: string | null;
      gridId: string | null;
    };
  };
  patterns: {
    main: {
      id: string | null;
      name: string;
    };
    all: string[];
    uniqueCount: number;
  };
  alliance: {
    name: string;
  };
}

export interface DrawingStats {
  totalPixels: number;
  activeDays: number;
  uniqueGrids: number;
  uniquePatterns: number;
  citiesVisited: number;
  countriesVisited: number;
  firstDraw: string;
  lastDraw: string;
  mostActiveCity: string;
  favoritePattern: string;
  experience: {
    level: string;
    color: string;
    totalPixels: number;
    progress: number;
    nextLevel: string | null;
    pixelsToNext: number;
  };
}

export interface PixelSessionResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  summary?: {
    totalSessions: number;
    totalPixels: number;
    averageDuration: number;
  };
}

export interface ExportOptions {
  format?: 'json' | 'csv';
  startDate?: string;
  endDate?: string;
}

class PixelSessionService {
  private readonly baseUrl = '/pixel-sessions';

  /**
   * 获取用户绘制会话历史
   */
  async getUserDrawingSessions(options: {
    page?: number;
    limit?: number;
    sessionThreshold?: number;
  } = {}): Promise<PixelSessionResponse<{ sessions: DrawingSession[] }>> {
    try {
      const params = new URLSearchParams();

      if (options.page) params.append('page', options.page.toString());
      if (options.limit) params.append('limit', options.limit.toString());
      if (options.sessionThreshold) params.append('threshold', options.sessionThreshold.toString());

      const response = await api.get(`${this.baseUrl}/sessions?${params}`);
      return response.data;
    } catch (error) {
      logger.error('获取绘制会话失败:', error);
      throw error;
    }
  }

  /**
   * 获取会话详情
   */
  async getSessionDetails(sessionId: string): Promise<PixelSessionResponse<{ pixels: any[] }>> {
    try {
      const response = await api.get(`${this.baseUrl}/sessions/${sessionId}`);
      return response.data;
    } catch (error) {
      logger.error('获取会话详情失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户绘制统计数据
   */
  async getUserDrawingStats(): Promise<PixelSessionResponse<DrawingStats>> {
    try {
      const response = await api.get(`${this.baseUrl}/stats`);
      return response.data;
    } catch (error) {
      logger.error('获取用户统计数据失败:', error);
      throw error;
    }
  }

  /**
   * 获取绘制历史概览
   */
  async getDrawingHistoryOverview(): Promise<PixelSessionResponse<{
    recentSessions: DrawingSession[];
    statistics: DrawingStats;
    summary: any;
  }>> {
    try {
      const response = await api.get(`${this.baseUrl}/overview`);
      return response.data;
    } catch (error) {
      logger.error('获取绘制历史概览失败:', error);
      throw error;
    }
  }

  /**
   * 导出绘制历史数据
   */
  async exportDrawingHistory(options: ExportOptions = {}): Promise<PixelSessionResponse<any>> {
    try {
      const params = new URLSearchParams();

      if (options.format) params.append('format', options.format);
      if (options.startDate) params.append('startDate', options.startDate);
      if (options.endDate) params.append('endDate', options.endDate);

      const response = await api.get(`${this.baseUrl}/export?${params}`);
      return response.data;
    } catch (error) {
      logger.error('导出绘制历史失败:', error);
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
   * 计算经验等级进度条颜色
   */
  getExperienceColor(level: string): string {
    const colors: { [key: string]: string } = {
      '新手画家': '#666666',
      '业余画手': '#8B4513',
      '专业画师': '#4169E1',
      '艺术大师': '#8A2BE2',
      '传奇画圣': '#FFD700'
    };
    return colors[level] || '#666666';
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
   * 格式化坐标显示
   */
  formatCoordinates(coordinates: [number, number] | null): string {
    if (!coordinates) return '未知';
    return `${coordinates[1].toFixed(4)}, ${coordinates[0].toFixed(4)}`;
  }

  /**
   * 生成会话缩略图描述
   */
  generateSessionDescription(session: DrawingSession): string {
    const {
      statistics: { pixelCount, citiesVisited },
      duration: { formatted },
      alliance: { name }
    } = session;

    return `${pixelCount}像素 ${citiesVisited}城 ${formatted} ${name}`;
  }

  /**
   * 检查会话是否为长途绘制
   */
  isLongSession(session: DrawingSession): boolean {
    return session.duration.minutes > 60; // 超过1小时认为是长途绘制
  }

  /**
   * 检查会话是否为高产出绘制
   */
  isHighProductivitySession(session: DrawingSession): boolean {
    return session.statistics.pixelCount > 50; // 超过50个像素认为是高产出
  }

  /**
   * 计算会话效率（像素/分钟）
   */
  calculateSessionEfficiency(session: DrawingSession): number {
    if (session.duration.minutes === 0) return 0;
    return Math.round(session.statistics.pixelCount / session.duration.minutes * 10) / 10;
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
}

export const pixelSessionService = new PixelSessionService();