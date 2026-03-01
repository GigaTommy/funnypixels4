import { api } from './api';
import { logger } from '../utils/logger';

export interface DrawingHistoryItem {
  id: string;
  user_id: string;
  username: string;
  display_name?: string;
  avatar?: string;
  alliance_name?: string;
  alliance_flag?: string;
  alliance_color?: string;
  session_pixels: number;
  total_pixels: number;
  current_pixels: number;
  draw_time: number;
  center_lat?: number;
  center_lng?: number;
  zoom_level?: number;
  bounds_north?: number;
  bounds_south?: number;
  bounds_east?: number;
  bounds_west?: number;
  track_points?: Array<{ lat: number; lng: number; timestamp: number }>;
  image_url?: string;
  image_path?: string;
  thumbnail_url?: string;
  thumbnail_path?: string;
  thumbnail_generated_at?: string;
  thumbnail_metadata?: any;
  is_shared: boolean;
  shared_at?: string;
  shared_platforms?: string[];
  session_start?: string;
  session_end?: string;
  session_id?: string;
  created_at: string;
  updated_at: string;
}

export interface DrawingHistoryResponse {
  success: boolean;
  data?: DrawingHistoryItem[];
  pagination?: {
    limit: number;
    offset: number;
    count: number;
    total?: number;
  };
  error?: string;
  message?: string;
}

export interface DrawingStatsResponse {
  success: boolean;
  data?: {
    totalSessions: number;
    totalPixels: number;
    totalDistance: number;
    totalDuration: number;
    avgPixelsPerSession: number;
    avgDurationPerSession: number;
  };
  error?: string;
  message?: string;
}

export interface DrawingHistoryQuery {
  startDate?: string;
  endDate?: string;
  actionType?: string;
  limit?: number;
  offset?: number;
}

/**
 * 绘制历史服务
 * 提供用户绘制历史记录的查询和统计功能
 */
export class DrawingHistoryService {
  private static instance: DrawingHistoryService;

  private constructor() {}

  static getInstance(): DrawingHistoryService {
    if (!DrawingHistoryService.instance) {
      DrawingHistoryService.instance = new DrawingHistoryService();
    }
    return DrawingHistoryService.instance;
  }

  /**
   * 获取用户绘制历史记录（足迹系统）
   */
  async getUserDrawingHistory(userId: string, query: DrawingHistoryQuery = {}): Promise<DrawingHistoryResponse> {
    try {
      const params = new URLSearchParams();

      if (query.startDate) params.append('startDate', query.startDate);
      if (query.endDate) params.append('endDate', query.endDate);
      if (query.limit) params.append('limit', Math.min(query.limit, 100).toString());

      // 计算页码：offset / limit + 1
      const page = query.offset ? Math.floor(query.offset / (query.limit || 20)) + 1 : 1;
      params.append('page', page.toString());

      // 使用新的 drawing-sessions API
      const response = await api.get(`/drawing-sessions?${params.toString()}`);

      // 适配数据格式：将 sessions 数据转换为 DrawingHistoryItem 格式
      if (response.data.success && response.data.data) {
        const sessions = response.data.data.sessions || [];
        const pagination = response.data.data.pagination || {};

        // 转换会话数据为绘制历史格式
        const historyItems = sessions.map((session: any) => ({
          id: session.id,
          user_id: session.user_id,
          username: session.user_id, // TODO: 可能需要从用户信息获取
          display_name: session.user_id,
          session_pixels: session.metadata?.statistics?.pixelCount || 0,
          total_pixels: session.metadata?.statistics?.pixelCount || 0,
          current_pixels: session.metadata?.statistics?.pixelCount || 0,
          draw_time: session.metadata?.statistics?.duration || session.duration_minutes || 0,
          session_start: session.start_time || session.created_at,
          session_end: session.end_time,
          session_id: session.id,
          created_at: session.created_at,
          updated_at: session.updated_at,
          is_shared: false, // 足迹系统暂无分享功能
          alliance_name: session.alliance_name,
          alliance_flag: session.alliance_flag,
          alliance_color: session.alliance_color,
          // 地图数据
          center_lat: session.start_location?.latitude,
          center_lng: session.start_location?.longitude,
          bounds_north: session.metadata?.statistics?.boundaries?.north,
          bounds_south: session.metadata?.statistics?.boundaries?.south,
          bounds_east: session.metadata?.statistics?.boundaries?.east,
          bounds_west: session.metadata?.statistics?.boundaries?.west,
          track_points: session.metadata?.track || []
        }));

        return {
          success: true,
          data: historyItems,
          pagination: {
            limit: pagination.limit || query.limit || 20,
            offset: ((pagination.page || 1) - 1) * (pagination.limit || query.limit || 20),
            count: historyItems.length,
            total: pagination.total || 0
          }
        };
      }

      return response.data;
    } catch (error: any) {
      logger.error('获取用户绘制历史失败:', error);
      return {
        success: false,
        error: error.response?.data?.error || '获取绘制历史失败'
      };
    }
  }

  /**
   * 获取用户绘制统计数据（足迹系统）
   */
  async getUserDrawingStats(userId: string, startDate?: string, endDate?: string): Promise<DrawingStatsResponse> {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      // 使用新的 drawing-sessions API 获取统计
      const response = await api.get(`/drawing-sessions?${params.toString()}`);

      // 转换会话数据为统计数据格式
      if (response.data.success && response.data.data) {
        const sessions = response.data.data.sessions || [];
        const totalSessions = sessions.length;
        const totalPixels = sessions.reduce((sum: number, session: any) => sum + (session.metadata?.statistics?.pixelCount || 0), 0);
        const totalDistance = sessions.reduce((sum: number, session: any) => sum + (session.metadata?.statistics?.distance || 0), 0);
        const totalDuration = sessions.reduce((sum: number, session: any) => sum + (session.metadata?.statistics?.duration || 0), 0);

        return {
          success: true,
          data: {
            totalSessions,
            totalPixels,
            totalDistance,
            totalDuration,
            avgPixelsPerSession: totalSessions > 0 ? Math.round(totalPixels / totalSessions) : 0,
            avgDurationPerSession: totalSessions > 0 ? Math.round(totalDuration / totalSessions) : 0
          }
        };
      }

      return response.data;
    } catch (error: any) {
      logger.error('获取用户绘制统计失败:', error);
      return {
        success: false,
        error: error.response?.data?.error || '获取绘制统计失败'
      };
    }
  }

  /**
   * 生成绘制历史缩略图 - 优先使用瓦片缩略图
   */
  generateThumbnail(battleResult: DrawingHistoryItem): string {
    // 优先使用绘制缩略图（基于瓦片生成的高清缩略图）
    if (battleResult.thumbnail_url) {
      return battleResult.thumbnail_url;
    }

    // 其次使用原有的绘制图片URL
    if (battleResult.image_url) {
      return battleResult.image_url;
    }

    // 如果都没有，生成默认缩略图
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';

      const THUMBNAIL_SIZE = 48;
      canvas.width = THUMBNAIL_SIZE;
      canvas.height = THUMBNAIL_SIZE;

      // 填充渐变背景
      const gradient = ctx.createLinearGradient(0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);
      gradient.addColorStop(0, '#3b82f6');
      gradient.addColorStop(1, '#8b5cf6');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);

      // 添加绘制文字
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('绘制', THUMBNAIL_SIZE / 2, THUMBNAIL_SIZE / 2 - 6);

      // 添加像素数
      ctx.font = '8px sans-serif';
      ctx.fillText(`${battleResult.session_pixels}像素`, THUMBNAIL_SIZE / 2, THUMBNAIL_SIZE / 2 + 6);

      return canvas.toDataURL('image/png');
    } catch (error) {
      logger.warn('生成缩略图失败:', error);
      return '';
    }
  }

  
  /**
   * 获取会话状态的显示名称
   */
  getSessionStatusLabel(isShared: boolean): string {
    return isShared ? '已分享' : '未分享';
  }

  /**
   * 获取会话状态的颜色
   */
  getSessionStatusColor(isShared: boolean): string {
    return isShared ? '#10b981' : '#6b7280'; // 绿色表示已分享，灰色表示未分享
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
   * 格式化绘制时长
   */
  formatDrawTime(seconds: number): string {
    if (seconds < 60) {
      return `${seconds}秒`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}分${remainingSeconds}秒`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}小时${minutes}分`;
    }
  }
}

// 导出单例实例
export const drawingHistoryService = DrawingHistoryService.getInstance();