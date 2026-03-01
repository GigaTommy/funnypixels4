import { api } from './api';
import { logger } from '../utils/logger';

export interface DriftBottle {
  bottle_id: string;
  title: string;
  content: string;
  image_url?: string;
  owner_id?: string;
  original_owner_id: string;
  current_lat: number;
  current_lng: number;
  origin_lat: number;
  origin_lng: number;
  current_city?: string;
  current_country?: string;
  origin_city?: string;
  origin_country?: string;
  total_distance: number;
  pickup_count: number;
  message_count: number;
  last_drift_time?: string;
  created_at: string;
  expires_at?: string;
  is_active: boolean;
  messages?: DriftBottleMessage[];
}

export interface DriftBottleMessage {
  id: number;
  bottle_id: string;
  author_id: string;
  author_name: string;
  author_avatar?: string;
  message: string;
  sequence_number: number;
  created_at: string;
}

export interface UseBottleParams {
  title: string;
  content: string;
  image?: string;
  lat: number;
  lng: number;
}

export class DriftBottleService {
  private baseUrl = '/drift-bottles';

  /**
   * 从库存使用漂流瓶（抛入地图）
   */
  async useBottle(params: UseBottleParams) {
    try {
      const response = await api.post(`${this.baseUrl}/use`, params);
      logger.info('使用漂流瓶成功:', response.data);
      return {
        success: true,
        data: response.data.data
      };
    } catch (error: any) {
      logger.error('使用漂流瓶失败:', error);
      return {
        success: false,
        message: error.response?.data?.message || '使用漂流瓶失败'
      };
    }
  }

  /**
   * 捡起漂流瓶
   */
  async pickupBottle(bottleId: string, lat: number, lng: number) {
    try {
      const response = await api.post(`${this.baseUrl}/pickup`, {
        bottleId,
        lat,
        lng
      });
      return {
        success: true,
        data: response.data.data
      };
    } catch (error: any) {
      logger.error('捡起漂流瓶失败:', error);
      return {
        success: false,
        message: error.response?.data?.message || '捡起漂流瓶失败'
      };
    }
  }

  /**
   * 继续漂流
   */
  async continueDrift(bottleId: string, message?: string) {
    try {
      const response = await api.post(`${this.baseUrl}/drift`, {
        bottleId,
        message
      });
      return {
        success: true,
        data: response.data.data
      };
    } catch (error: any) {
      logger.error('继续漂流失败:', error);
      return {
        success: false,
        message: error.response?.data?.message || '继续漂流失败'
      };
    }
  }

  /**
   * 添加纸条
   */
  async addMessage(bottleId: string, message: string) {
    try {
      const response = await api.post(`${this.baseUrl}/messages`, {
        bottleId,
        message
      });
      return {
        success: true,
        data: response.data.data
      };
    } catch (error: any) {
      logger.error('添加纸条失败:', error);
      return {
        success: false,
        message: error.response?.data?.message || '添加纸条失败'
      };
    }
  }

  /**
   * 获取用户漂流瓶库存
   */
  async getUserInventory() {
    try {
      const response = await api.get(`${this.baseUrl}/inventory`);
      return {
        success: true,
        data: response.data.data
      };
    } catch (error: any) {
      logger.error('获取库存失败:', error);
      return {
        success: false,
        message: error.response?.data?.message || '获取库存失败'
      };
    }
  }

  /**
   * 获取附近的漂流瓶
   */
  async getNearbyBottles(lat: number, lng: number, radiusKm: number = 10) {
    try {
      const response = await api.get(`${this.baseUrl}/nearby`, {
        params: { lat, lng, radiusKm }
      });
      return {
        success: true,
        data: response.data.data
      };
    } catch (error: any) {
      logger.error('获取附近漂流瓶失败:', error);
      return {
        success: false,
        message: error.response?.data?.message || '获取附近漂流瓶失败'
      };
    }
  }

  /**
   * 获取漂流瓶详情
   */
  async getBottleDetails(bottleId: string) {
    try {
      const response = await api.get(`${this.baseUrl}/${bottleId}`);
      return {
        success: true,
        data: response.data.data
      };
    } catch (error: any) {
      logger.error('获取漂流瓶详情失败:', error);
      return {
        success: false,
        message: error.response?.data?.message || '获取漂流瓶详情失败'
      };
    }
  }

  /**
   * 获取漂流瓶历史
   */
  async getBottleHistory(bottleId: string) {
    try {
      const response = await api.get(`${this.baseUrl}/${bottleId}/history`);
      return {
        success: true,
        data: response.data.data
      };
    } catch (error: any) {
      logger.error('获取漂流瓶历史失败:', error);
      return {
        success: false,
        message: error.response?.data?.message || '获取漂流瓶历史失败'
      };
    }
  }

  /**
   * 格式化相对时间
   */
  formatRelativeTime(dateString: string): string {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) {
      return '刚刚';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}分钟前`;
    } else if (diffHours < 24) {
      return `${diffHours}小时前`;
    } else if (diffDays < 30) {
      return `${diffDays}天前`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months}个月前`;
    } else {
      const years = Math.floor(diffDays / 365);
      return `${years}年前`;
    }
  }
}

export const driftBottleService = new DriftBottleService();
