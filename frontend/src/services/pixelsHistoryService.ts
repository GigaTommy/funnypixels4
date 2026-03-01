import { api } from './api';
import { logger } from '../utils/logger';

export interface PixelsHistoryItem {
  id: string;
  user_id: string;
  grid_id: string;
  latitude: number;
  longitude: number;
  color: string;
  pattern_id?: string;
  pattern_anchor_x?: number;
  pattern_anchor_y?: number;
  pattern_rotation?: number;
  pattern_mirror?: boolean;
  pixel_type?: string;
  related_id?: string;
  session_id?: string;
  action_type?: string;
  country?: string;
  province?: string;
  city?: string;
  district?: string;
  adcode?: string;
  formatted_address?: string;
  geocoded?: boolean;
  geocoded_at?: string;
  history_date: string;
  region_id?: number;
  original_pixel_id?: string;
  version?: number;
  created_at: string;
  updated_at: string;
}

export interface PixelsHistoryResponse {
  success: boolean;
  data?: PixelsHistoryItem[];
  pagination?: {
    limit: number;
    offset: number;
    count: number;
  };
  error?: string;
  message?: string;
}

export interface PixelsHistoryQuery {
  startDate?: string;
  endDate?: string;
  actionType?: string;
  limit?: number;
  offset?: number;
}

export interface PixelsHistoryStats {
  success: boolean;
  data?: {
    total_pixels: number;
    active_days: number;
    first_draw: string;
    last_draw: string;
    unique_locations: number;
    action_types: number;
    actionBreakdown: Array<{
      action_type: string;
      count: number;
    }>;
  };
  error?: string;
  message?: string;
}

/**
 * 像素历史服务
 * 提供与后端 pixels-history API 的交互
 */
export class PixelsHistoryService {
  private static instance: PixelsHistoryService;

  private constructor() {}

  static getInstance(): PixelsHistoryService {
    if (!PixelsHistoryService.instance) {
      PixelsHistoryService.instance = new PixelsHistoryService();
    }
    return PixelsHistoryService.instance;
  }

  /**
   * 获取用户像素操作历史
   * @param userId 用户ID
   * @param query 查询参数
   */
  async getUserPixelHistory(userId: string, query: PixelsHistoryQuery = {}): Promise<PixelsHistoryResponse> {
    try {
      const params = new URLSearchParams();

      if (query.startDate) params.append('startDate', query.startDate);
      if (query.endDate) params.append('endDate', query.endDate);
      if (query.actionType) params.append('actionType', query.actionType);
      if (query.limit) params.append('limit', Math.min(query.limit, 1000).toString());
      if (query.offset) params.append('offset', query.offset.toString());

      const response = await api.get(`/pixels-history/user/${userId}?${params.toString()}`);
      return response.data;
    } catch (error: any) {
      logger.error('获取用户像素历史失败:', error);
      return {
        success: false,
        error: error.response?.data?.error || '获取像素历史失败'
      };
    }
  }

  /**
   * 获取用户行为统计
   * @param userId 用户ID
   * @param startDate 开始日期
   * @param endDate 结束日期
   */
  async getUserBehaviorStats(userId: string, startDate?: string, endDate?: string): Promise<PixelsHistoryStats> {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await api.get(`/pixels-history/user/${userId}/stats?${params.toString()}`);
      return response.data;
    } catch (error: any) {
      logger.error('获取用户行为统计失败:', error);
      return {
        success: false,
        error: error.response?.data?.error || '获取用户统计失败'
      };
    }
  }

  /**
   * 获取像素位置的历史变化
   * @param gridId 网格ID
   * @param query 查询参数
   */
  async getPixelLocationHistory(gridId: string, query: PixelsHistoryQuery = {}): Promise<PixelsHistoryResponse> {
    try {
      const params = new URLSearchParams();

      if (query.startDate) params.append('startDate', query.startDate);
      if (query.endDate) params.append('endDate', query.endDate);
      if (query.limit) params.append('limit', Math.min(query.limit, 1000).toString());
      if (query.offset) params.append('offset', query.offset.toString());

      const response = await api.get(`/pixels-history/location/${gridId}?${params.toString()}`);
      return response.data;
    } catch (error: any) {
      logger.error('获取像素位置历史失败:', error);
      return {
        success: false,
        error: error.response?.data?.error || '获取位置历史失败'
      };
    }
  }

  /**
   * 格式化历史记录的显示内容
   * @param item 历史记录项
   */
  formatHistoryItem(item: PixelsHistoryItem): {
    id: string;
    session_id?: string;
    session_pixels: number;
    total_pixels: number;
    draw_time: number;
    created_at: string;
    location: string;
    action: string;
    pattern: string;
  } {
    // 构建地理位置描述
    const locationParts = [];
    if (item.city && item.city !== '未知城市') locationParts.push(item.city);
    if (item.district && item.district !== item.city) locationParts.push(item.district);
    const location = locationParts.length > 0 ? locationParts.join('·') : '未知位置';

    // 获取操作类型描述
    const actionMap: { [key: string]: string } = {
      'draw': '绘制',
      'bomb': '炸弹',
      'clear': '清除',
      'pattern_bomb': '图案炸弹'
    };
    const action = actionMap[item.action_type || 'draw'] || '绘制';

    // 获取图案描述
    const pattern = item.pattern_id ? `图案: ${item.pattern_id}` : '纯色';

    return {
      id: item.id,
      session_id: item.session_id,
      session_pixels: 1, // 单个像素操作
      total_pixels: 1,
      draw_time: 0, // 单个像素操作无耗时
      created_at: item.created_at,
      location,
      action,
      pattern
    };
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
}

// 导出单例实例
export const pixelsHistoryService = PixelsHistoryService.getInstance();