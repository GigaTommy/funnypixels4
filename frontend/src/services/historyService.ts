import { api } from './api';
import { toast } from 'react-hot-toast';
import { logger } from '../utils/logger';

export interface HistoryItem {
  type: 'bottle' | 'treasure' | 'scan';
  action: 'created' | 'picked' | 'hidden' | 'found' | 'scanned';
  item_id: string;
  title: string;
  description?: string;
  image_url?: string;
  lat?: number;
  lng?: number;
  created_at: string;
  updated_at: string;
  reward_points?: number;
  status: string;
  relative_time?: string;
  location?: {
    lat: number;
    lng: number;
  };
}

export interface HistoryFilters {
  type?: 'bottles' | 'treasures' | 'all';
  period?: 'day' | 'week' | 'month' | 'all';
  action?: 'picked' | 'hidden' | 'found' | 'created' | 'scanned' | 'all';
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface HistoryResponse {
  success: boolean;
  data: {
    items: HistoryItem[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
    filters: HistoryFilters;
  };
}

export interface HistoryStats {
  bottles: {
    total: number;
    created: number;
    picked: number;
  };
  treasures: {
    hidden: number;
    found_treasures: number;
    claimed: number;
    total_rewards_given: number;
    total_rewards_earned: number;
  };
  scans: {
    total: number;
    successful: number;
    success_rate: number;
  };
  recent_activity: Array<{
    scanned_at: string;
    qr_content: string;
    success: boolean;
    relative_time?: string;
  }>;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  completed: boolean;
  progress: number;
  target: number;
  current: number;
}

export interface AchievementsResponse {
  success: boolean;
  data: {
    achievements: Achievement[];
    summary: {
      completed: number;
      total: number;
      completion_rate: number;
    };
  };
}

/**
 * 历史记录服务 - 统一管理用户的所有历史记录
 */
class HistoryService {
  /**
   * 获取用户历史记录
   */
  async getUserHistory(filters: HistoryFilters = {}): Promise<HistoryResponse> {
    try {
      const params = new URLSearchParams();

      // 添加筛选参数
      if (filters.type) params.append('type', filters.type);
      if (filters.period) params.append('period', filters.period);
      if (filters.action) params.append('action', filters.action);
      if (filters.limit) params.append('limit', filters.limit.toString());
      if (filters.offset) params.append('offset', filters.offset.toString());
      if (filters.sortBy) params.append('sortBy', filters.sortBy);
      if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);

      const response = await api.get(`/history?${params.toString()}`);

      logger.info('获取历史记录成功', {
        itemsCount: response.data?.items?.length || 0,
        filters
      });

      return response.data;
    } catch (error: any) {
      logger.error('获取历史记录失败:', error);
      throw new Error(error.response?.data?.message || '获取历史记录失败');
    }
  }

  /**
   * 获取历史记录统计
   */
  async getHistoryStats(): Promise<HistoryStats> {
    try {
      const response = await api.get('/history/stats');

      logger.info('获取历史记录统计成功', response.data);

      return response.data.data;
    } catch (error: any) {
      logger.error('获取历史记录统计失败:', error);
      throw new Error(error.response?.data?.message || '获取统计数据失败');
    }
  }

  /**
   * 获取用户成就进度
   */
  async getUserAchievements(): Promise<AchievementsResponse> {
    try {
      const response = await api.get('/history/achievements');

      logger.info('获取用户成就成功', {
        achievementsCount: response.data?.data?.achievements?.length || 0
      });

      return response.data;
    } catch (error: any) {
      logger.error('获取用户成就失败:', error);
      throw new Error(error.response?.data?.message || '获取成就数据失败');
    }
  }

  /**
   * 获取漂流瓶历史记录（兼容旧接口）
   */
  async getBottleHistory(limit: number = 20, offset: number = 0): Promise<HistoryResponse> {
    return this.getUserHistory({
      type: 'bottles',
      limit,
      offset,
      sortBy: 'created_at',
      sortOrder: 'desc'
    });
  }

  /**
   * 获取QR宝藏历史记录（兼容旧接口）
   */
  async getTreasureHistory(limit: number = 20, offset: number = 0): Promise<HistoryResponse> {
    return this.getUserHistory({
      type: 'treasures',
      limit,
      offset,
      sortBy: 'created_at',
      sortOrder: 'desc'
    });
  }

  /**
   * 获取用户创建的漂流瓶历史
   */
  async getCreatedBottleHistory(limit: number = 20, offset: number = 0): Promise<HistoryResponse> {
    return this.getUserHistory({
      type: 'bottles',
      action: 'created',
      limit,
      offset,
      sortBy: 'created_at',
      sortOrder: 'desc'
    });
  }

  /**
   * 获取用户拾取的漂流瓶历史
   */
  async getPickedBottleHistory(limit: number = 20, offset: number = 0): Promise<HistoryResponse> {
    return this.getUserHistory({
      type: 'bottles',
      action: 'picked',
      limit,
      offset,
      sortBy: 'created_at',
      sortOrder: 'desc'
    });
  }

  /**
   * 获取用户藏宝历史
   */
  async getHiddenTreasureHistory(limit: number = 20, offset: number = 0): Promise<HistoryResponse> {
    return this.getUserHistory({
      type: 'treasures',
      action: 'hidden',
      limit,
      offset,
      sortBy: 'created_at',
      sortOrder: 'desc'
    });
  }

  /**
   * 获取用户寻宝历史
   */
  async getFoundTreasureHistory(limit: number = 20, offset: number = 0): Promise<HistoryResponse> {
    return this.getUserHistory({
      type: 'treasures',
      action: 'found',
      limit,
      offset,
      sortBy: 'created_at',
      sortOrder: 'desc'
    });
  }

  /**
   * 获取用户扫码历史
   */
  async getScanHistory(limit: number = 20, offset: number = 0): Promise<HistoryResponse> {
    return this.getUserHistory({
      type: 'all',
      action: 'scanned',
      limit,
      offset,
      sortBy: 'created_at',
      sortOrder: 'desc'
    });
  }

  /**
   * 根据时间范围获取历史记录
   */
  async getHistoryByPeriod(period: 'day' | 'week' | 'month' | 'all', limit: number = 20): Promise<HistoryResponse> {
    return this.getUserHistory({
      type: 'all',
      period,
      limit,
      sortBy: 'created_at',
      sortOrder: 'desc'
    });
  }

  /**
   * 搜索历史记录
   */
  async searchHistory(keyword: string, filters: HistoryFilters = {}): Promise<HistoryResponse> {
    try {
      // 获取基础历史记录
      const response = await this.getUserHistory({
        ...filters,
        limit: 100 // 获取更多数据用于本地搜索
      });

      // 本地搜索筛选
      if (keyword.trim()) {
        const searchResults = response.data.items.filter(item =>
          item.title.toLowerCase().includes(keyword.toLowerCase()) ||
          (item.description && item.description.toLowerCase().includes(keyword.toLowerCase()))
        );

        return {
          ...response,
          data: {
            ...response.data,
            items: searchResults,
            pagination: {
              ...response.data.pagination,
              total: searchResults.length,
              hasMore: false
            }
          }
        };
      }

      return response;
    } catch (error) {
      logger.error('搜索历史记录失败:', error);
      throw error;
    }
  }

  /**
   * 获取历史记录摘要
   */
  async getHistorySummary(): Promise<{
    totalItems: number;
    todayItems: number;
    weekItems: number;
    monthItems: number;
    recentItems: HistoryItem[];
  }> {
    try {
      const [today, week, month, recent] = await Promise.all([
        this.getHistoryByPeriod('day', 5),
        this.getHistoryByPeriod('week', 10),
        this.getHistoryByPeriod('month', 20),
        this.getUserHistory({ limit: 5 })
      ]);

      return {
        totalItems: month.data.pagination.total,
        todayItems: today.data.pagination.total,
        weekItems: week.data.pagination.total,
        monthItems: month.data.pagination.total,
        recentItems: recent.data.items
      };
    } catch (error) {
      logger.error('获取历史记录摘要失败:', error);
      throw error;
    }
  }
}

// 创建单例实例
const historyService = new HistoryService();

export default historyService;