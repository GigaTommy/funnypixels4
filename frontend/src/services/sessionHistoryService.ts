import { api } from './api';
import { logger } from '../utils/logger';
import { materialLoaderService } from './materialLoaderService';
import { patternCache } from '../patterns/patternCache';

export interface SessionHistoryItem {
  id: string;
  user_id: string;
  session_name: string;
  drawing_type: 'manual' | 'gps';
  start_time?: string;
  end_time?: string;
  status: 'active' | 'completed' | 'paused';
  start_city?: string;
  start_country?: string;
  end_city?: string;
  end_country?: string;
  alliance_id?: string;
  alliance_name?: string;
  alliance_color?: string;
  alliance_flag?: string;
  alliance_pattern_id?: string;  // 新增：联盟图案ID，用于渲染complex类型旗帜
  alliance_pattern_type?: 'color' | 'emoji' | 'complex';  // 新增：联盟图案类型
  start_location?: {
    latitude: number;
    longitude: number;
  };
  end_location?: {
    latitude: number;
    longitude: number;
  };
  metadata?: {
    statistics?: {
      pixelCount: number;
      distance: number;
      duration: number;
      avgSpeed?: number;
      efficiency?: number;
      boundaries?: {
        north: number;
        south: number;
        east: number;
        west: number;
      };
    };
    track?: Array<{
      timestamp: number;
      latitude: number;
      longitude: number;
    }>;
  };
  created_at: string;
  updated_at: string;
}

export interface SessionHistoryResponse {
  success: boolean;
  data?: {
    sessions: SessionHistoryItem[];
    total: number;
    page: number;
    limit: number;
  };
  error?: string;
  message?: string;
}

export interface SessionStatisticsResponse {
  success: boolean;
  data?: {
    sessionId: string;
    sessionName: string;
    userId: string;
    pixelCount: number;
    duration: number;
    distance: number;
    avgSpeed: number;
    efficiency: number;
    startTime?: string;
    endTime?: string;
    boundaries?: {
      north: number;
      south: number;
      east: number;
      west: number;
    };
    center?: {
      latitude: number;
      longitude: number;
    };
    track?: Array<{
      timestamp: number;
      latitude: number;
      longitude: number;
    }>;
  };
  error?: string;
  message?: string;
}

export interface SessionHistoryQuery {
  page?: number;
  limit?: number;
  status?: 'active' | 'completed' | 'paused' | 'all';
  startDate?: string;
  endDate?: string;
  drawingType?: 'manual' | 'gps';
}

/**
 * 绘制会话历史服务
 * 提供与后端 drawing-session API 的交互
 */
export class SessionHistoryService {
  private static instance: SessionHistoryService;

  private constructor() {}

  static getInstance(): SessionHistoryService {
    if (!SessionHistoryService.instance) {
      SessionHistoryService.instance = new SessionHistoryService();
    }
    return SessionHistoryService.instance;
  }

  /**
   * 获取用户绘制会话历史
   */
  async getUserSessions(query: SessionHistoryQuery = {}): Promise<SessionHistoryResponse> {
    try {
      const params = new URLSearchParams();

      if (query.page) params.append('page', query.page.toString());
      if (query.limit) params.append('limit', Math.min(query.limit, 100).toString());
      if (query.status) params.append('status', query.status);
      if (query.startDate) params.append('startDate', query.startDate);
      if (query.endDate) params.append('endDate', query.endDate);
      if (query.drawingType) params.append('drawingType', query.drawingType);

      const response = await api.get(`/drawing-sessions?${params.toString()}`);

      // 🆕 预加载联盟旗帜的Material
      if (response.data.success && response.data.data?.sessions) {
        const sessions = response.data.data.sessions;
        const patternIds = sessions
          .map((s: SessionHistoryItem) => s.alliance_pattern_id)
          .filter((id): id is string => !!id);

        if (patternIds.length > 0) {
          // 批量获取图案数据
          const patterns = await Promise.all(
            patternIds.map(id => patternCache.getPattern(id).catch(() => null))
          );

          // 提取Material IDs
          const materialIds = patterns
            .map(p => p?.material_id)
            .filter((id): id is string => !!id);

          // 批量预加载Material（不阻塞返回）
          if (materialIds.length > 0) {
            materialLoaderService.preloadMaterials(materialIds).catch(err => {
              logger.warn('预加载Material失败:', err);
            });
          }
        }
      }

      return response.data;
    } catch (error: any) {
      logger.error('获取用户绘制会话失败:', error);
      return {
        success: false,
        error: error.response?.data?.error || '获取会话历史失败'
      };
    }
  }

  /**
   * 获取会话统计信息
   */
  async getSessionStatistics(sessionId: string): Promise<SessionStatisticsResponse> {
    try {
      const response = await api.get(`/drawing-sessions/${sessionId}/statistics`);
      return response.data;
    } catch (error: any) {
      logger.error('获取会话统计失败:', error);
      return {
        success: false,
        error: error.response?.data?.error || '获取会话统计失败'
      };
    }
  }

  /**
   * 获取会话详情
   */
  async getSessionDetails(sessionId: string): Promise<{
    success: boolean;
    data?: SessionHistoryItem;
    error?: string;
    message?: string;
  }> {
    try {
      const response = await api.get(`/drawing-sessions/${sessionId}`);
      return response.data;
    } catch (error: any) {
      logger.error('获取会话详情失败:', error);
      return {
        success: false,
        error: error.response?.data?.error || '获取会话详情失败'
      };
    }
  }

  /**
   * 计算会话效率
   */
  calculateSessionEfficiency(pixelCount: number, duration: number): number {
    if (duration === 0) return 0;
    return Math.round((pixelCount / (duration / 60)) * 10) / 10; // 像素/分钟
  }

  /**
   * 格式化会话时长
   */
  formatSessionDuration(seconds: number): string {
    if (seconds < 60) {
      return `${seconds}秒`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return remainingSeconds > 0 ? `${minutes}分${remainingSeconds}秒` : `${minutes}分钟`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const remainingSeconds = seconds % 60;

      if (minutes > 0 && remainingSeconds > 0) {
        return `${hours}小时${minutes}分${remainingSeconds}秒`;
      } else if (minutes > 0) {
        return `${hours}小时${minutes}分钟`;
      } else {
        return `${hours}小时`;
      }
    }
  }

  /**
   * 格式化相对时间
   */
  formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return '刚刚';
    if (diffMinutes < 60) return `${diffMinutes}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;

    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * 获取会话状态文本
   */
  getSessionStatusText(status: string): string {
    const statusMap: { [key: string]: string } = {
      'active': '进行中',
      'completed': '已完成',
      'paused': '已暂停'
    };
    return statusMap[status] || status;
  }

  /**
   * 获取会话状态颜色
   */
  getSessionStatusColor(status: string): string {
    const colorMap: { [key: string]: string } = {
      'active': '#10b981', // 绿色
      'completed': '#3b82f6', // 蓝色
      'paused': '#f59e0b' // 琥珀色
    };
    return colorMap[status] || '#6b7280'; // 默认灰色
  }

  /**
   * 格式化距离
   */
  formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${Math.round(meters)}米`;
    } else {
      return `${(meters / 1000).toFixed(1)}公里`;
    }
  }

  /**
   * 获取绘制类型文本
   */
  getDrawingTypeText(drawingType: 'manual' | 'gps'): string {
    return drawingType === 'gps' ? 'GPS绘制' : '手动绘制';
  }

  /**
   * 生成会话缩略图
   */
  generateSessionThumbnail(session: SessionHistoryItem): string {
    // 如果有轨迹数据，可以生成轨迹图
    if (session.metadata?.track && session.metadata.track.length > 0) {
      // 这里可以实现轨迹图的生成逻辑
      // 暂时返回默认图标
      return '';
    }

    // 生成默认缩略图
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';

      const THUMBNAIL_SIZE = 80;
      canvas.width = THUMBNAIL_SIZE;
      canvas.height = THUMBNAIL_SIZE;

      // 背景渐变
      const gradient = ctx.createLinearGradient(0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);
      gradient.addColorStop(0, '#8b5cf6');
      gradient.addColorStop(1, '#3b82f6');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);

      // 绘制类型图标
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const icon = session.drawing_type === 'gps' ? '📍' : '🎨';
      ctx.fillText(icon, THUMBNAIL_SIZE / 2, THUMBNAIL_SIZE / 2 - 8);

      // 绘制统计信息
      ctx.font = '10px sans-serif';
      const pixelCount = session.metadata?.statistics?.pixelCount || 0;
      ctx.fillText(`${pixelCount}像素`, THUMBNAIL_SIZE / 2, THUMBNAIL_SIZE / 2 + 8);

      return canvas.toDataURL('image/png');
    } catch (error) {
      logger.warn('生成会话缩略图失败:', error);
      return '';
    }
  }
}

// 导出单例实例
export const sessionHistoryService = SessionHistoryService.getInstance();