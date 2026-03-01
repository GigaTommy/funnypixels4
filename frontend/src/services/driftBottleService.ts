import { api } from './api';
import { getAuthToken } from '../utils/authUtils';
import { logger } from '../utils/logger';

export interface DriftBottle {
  bottle_id: string;
  owner_id?: number;
  original_owner_id: number;
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
  last_drift_time: string;
  created_at: string;
  is_active: boolean;
  messages?: DriftBottleMessage[];
  latest_message?: DriftBottleMessage;
  message_count?: number;
  current_holder_name?: string;
  original_owner_name?: string;
}

export interface DriftBottleMessage {
  id: number;
  bottle_id: string;
  author_id: number;
  message: string;
  author_name: string;
  author_avatar?: string;
  sequence_number: number;
  created_at: string;
}

export interface DriftBottleHistory {
  id: number;
  bottle_id: string;
  user_id: number;
  action: 'throw' | 'pickup' | 'hold';
  lat: number;
  lng: number;
  city?: string;
  country?: string;
  message?: string;
  created_at: string;
  username: string;
  user_avatar?: string;
}

export interface DriftBottleStats {
  totalDistance: number;
  pickupCount: number;
  journeyTime: number;
  currentStatus: 'held' | 'drifting';
  currentLocation: {
    lat: number;
    lng: number;
    city?: string;
    country?: string;
  };
  originLocation: {
    lat: number;
    lng: number;
    city?: string;
    country?: string;
  };
}

export interface DriftBottleProduct {
  id: number;
  name: string;
  description: string;
  price: number;
  category: string;
  image_url?: string;
  properties?: any;
  is_active: boolean;
  stock: number;
}

export interface NearbyBottlesResponse {
  bottles: DriftBottle[];
  count: number;
  searchArea: {
    center: { lat: number; lng: number };
    radius: number;
  };
}

export interface PurchaseResponse {
  bottle: DriftBottle;
  product: {
    name: string;
    description: string;
    price: number;
  };
}

class DriftBottleService {
  private baseUrl = '/drift-bottles';

  /**
   * 购买并创建漂流瓶
   */
  async purchaseAndCreate(lat: number, lng: number): Promise<{ success: boolean; data?: PurchaseResponse; message: string }> {
    try {
      const response = await api.post(`${this.baseUrl}/purchase`, { lat, lng });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || '购买漂流瓶失败'
      };
    }
  }

  /**
   * 捡起漂流瓶
   */
  async pickupBottle(bottleId: string, lat: number, lng: number): Promise<{ success: boolean; data?: { bottle: DriftBottle }; message: string }> {
    try {
      const response = await api.post(`${this.baseUrl}/pickup`, { bottleId, lat, lng });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || '捡起漂流瓶失败'
      };
    }
  }

  /**
   * 继续漂流
   */
  async continueDrift(bottleId: string, message?: string): Promise<{ success: boolean; data?: { bottle: DriftBottle }; message: string }> {
    try {
      const response = await api.post(`${this.baseUrl}/drift`, { bottleId, message });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || '继续漂流失败'
      };
    }
  }

  /**
   * 添加纸条
   */
  async addMessage(bottleId: string, message: string): Promise<{ success: boolean; data?: { message: DriftBottleMessage }; message: string }> {
    try {
      const response = await api.post(`${this.baseUrl}/messages`, { bottleId, message });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || '添加纸条失败'
      };
    }
  }

  /**
   * 获取漂流瓶详情
   */
  async getBottleDetails(bottleId: string): Promise<{ success: boolean; data?: { bottle: DriftBottle }; message: string }> {
    try {
      const response = await api.get(`${this.baseUrl}/${bottleId}`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || '获取漂流瓶详情失败'
      };
    }
  }

  /**
   * 获取用户漂流瓶库存
   */
  async getUserInventory(): Promise<{ success: boolean; data?: { inventory: DriftBottle[] }; message: string }> {
    try {
      const response = await api.get(`${this.baseUrl}/inventory`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || '获取库存失败'
      };
    }
  }

  /**
   * 获取附近正在漂流的瓶子
   */
  async getNearbyBottles(lat: number, lng: number, radiusKm: number = 50): Promise<{ success: boolean; data?: NearbyBottlesResponse; message: string }> {
    try {
      // 检查用户是否已认证 - 使用统一工具
      const token = getAuthToken();
      if (!token) {
        logger.debug('🍾 用户未认证，跳过获取附近漂流瓶');
        return {
          success: false,
          message: '请先登录后再查看附近漂流瓶'
        };
      }

      const response = await api.get(`${this.baseUrl}/nearby`, {
        params: { lat, lng, radius: radiusKm }
      });
      return response.data;
    } catch (error: any) {
      // 处理401认证错误
      if (error.response?.status === 401) {
        logger.warn('⚠️ 获取附近漂流瓶认证失败，用户可能需要重新登录');
        return {
          success: false,
          message: '认证失败，请重新登录'
        };
      }

      return {
        success: false,
        message: error.response?.data?.message || '获取附近漂流瓶失败'
      };
    }
  }

  /**
   * 获取漂流瓶历史
   */
  async getBottleHistory(bottleId: string): Promise<{ success: boolean; data?: { history: DriftBottleHistory[] }; message: string }> {
    try {
      const response = await api.get(`${this.baseUrl}/${bottleId}/history`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || '获取漂流瓶历史失败'
      };
    }
  }

  /**
   * 获取漂流瓶统计信息
   */
  async getBottleStats(bottleId: string): Promise<{ success: boolean; data?: { stats: DriftBottleStats }; message: string }> {
    try {
      const response = await api.get(`${this.baseUrl}/${bottleId}/stats`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || '获取漂流瓶统计失败'
      };
    }
  }

  /**
   * 格式化距离显示
   */
  formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${meters}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  }

  /**
   * 格式化时间显示
   */
  formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}天${hours % 24}小时`;
    } else if (hours > 0) {
      return `${hours}小时${minutes % 60}分钟`;
    } else if (minutes > 0) {
      return `${minutes}分钟`;
    } else {
      return `${seconds}秒`;
    }
  }

  /**
   * 格式化相对时间
   */
  formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days > 0) {
      return `${days}天前`;
    } else if (hours > 0) {
      return `${hours}小时前`;
    } else if (minutes > 0) {
      return `${minutes}分钟前`;
    } else {
      return '刚刚';
    }
  }
}

export const driftBottleService = new DriftBottleService();
export default driftBottleService;