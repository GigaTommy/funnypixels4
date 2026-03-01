import axios from 'axios';
import { TokenManager } from './auth';
import { getAuthToken } from '../utils/authUtils';
import { logger } from '../utils/logger';

const API_BASE_URL = '/api/qr-treasures';

// 创建带认证的axios实例
const qrTreasureApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000
});

// 请求拦截器 - 添加token
qrTreasureApi.interceptors.request.use(
  (config) => {
    const token = TokenManager.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器 - 处理token过期
qrTreasureApi.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    if (error.response?.status === 401) {
      // Token过期，尝试刷新
      const refreshToken = TokenManager.getRefreshToken();
      if (refreshToken) {
        try {
          const response = await axios.post('/api/auth/refresh', { refreshToken });
          const { tokens } = response.data;
          TokenManager.setTokens(tokens.accessToken, tokens.refreshToken);

          // 重试原请求
          const originalRequest = error.config;
          originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
          return qrTreasureApi(originalRequest);
        } catch (refreshError) {
          // 刷新失败，清除token并跳转到登录页
          TokenManager.clearTokens();
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }
      }
    }
    return Promise.reject(error);
  }
);

export interface QRTreasure {
  treasure_id: string;
  qr_code_hash: string;
  qr_code_type: 'fixed' | 'mobile';
  qr_pattern_type: 'qr_code' | 'data_matrix' | 'aztec' | 'pdf417';
  qr_preview: string;
  hide_lat: number;
  hide_lng: number;
  location_grid_lat: number;
  location_grid_lng: number;
  location_radius: number | null;
  city: string;
  country: string;
  hider_id: string;
  hider_name: string;
  title: string;
  description: string;
  hint: string;
  status: 'active' | 'found' | 'expired';
  reward_value: string;
  created_at: string;
  expires_at: string | null;
  found_by: string | null;
  found_at: string | null;
  // 新增字段
  first_hide_lat: number | null;
  first_hide_lng: number | null;
  qr_content: string;
  treasure_type: 'fixed' | 'mobile';
  move_count: number;
}

export interface NearbyTreasuresResponse {
  success: boolean;
  data: {
    treasures: QRTreasure[];
    total: number;
    area: string;
  };
  message?: string;
}

export interface TreasureMapOptions {
  lat: number;
  lng: number;
  radius?: number; // 搜索半径（公里），默认5公里
  limit?: number;  // 返回数量限制，默认50个
  includeFound?: boolean; // 是否包含已找到的宝藏
  treasureType?: 'all' | 'fixed' | 'mobile'; // 宝藏类型过滤
}

class QRTreasureMapService {
  /**
   * 获取附近的宝藏列表
   */
  static async getNearbyTreasures(options: TreasureMapOptions): Promise<NearbyTreasuresResponse> {
    try {
      // 检查用户是否已认证 - 使用统一工具
      const token = getAuthToken();
      if (!token) {
        logger.debug('💎 用户未认证，跳过获取附近宝藏');
        throw new Error('请先登录后再查看附近宝藏');
      }

      const response = await qrTreasureApi.post('/nearby', options);

      logger.debug('🗺️ 获取附近宝藏成功:', {
        count: response.data.data?.treasures?.length || 0,
        area: response.data.data?.area,
        radius: options.radius
      });

      return response.data;
    } catch (error: any) {
      logger.error('获取附近宝藏失败:', error.message);

      if (error.response?.status === 401) {
        logger.warn('⚠️ 获取附近宝藏认证失败，用户可能需要重新登录');
        throw new Error('认证失败，请重新登录');
      } else if (error.response?.status === 403) {
        throw new Error('权限不足');
      } else if (error.response?.status === 404) {
        throw new Error('API接口不存在');
      } else {
        throw new Error('获取附近宝藏失败: ' + (error.message || '网络错误'));
      }
    }
  }

  /**
   * 获取指定区域内的宝藏
   */
  static async getTreasuresInBounds(bounds: {
    northEast: { lat: number; lng: number };
    southWest: { lat: number; lng: number };
  }): Promise<NearbyTreasuresResponse> {
    try {
      const response = await qrTreasureApi.post('/bounds', bounds);

      logger.debug('🗺️ 获取区域宝藏成功:', {
        count: response.data.data?.treasures?.length || 0,
        bounds: bounds
      });

      return response.data;
    } catch (error: any) {
      logger.error('获取区域宝藏失败:', error.message);
      throw new Error('获取区域宝藏失败: ' + (error.message || '网络错误'));
    }
  }

  /**
   * 根据宝藏类型获取附近宝藏
   */
  static async getTreasuresByType(
    lat: number,
    lng: number,
    type: 'fixed' | 'mobile',
    radius: number = 5
  ): Promise<NearbyTreasuresResponse> {
    return this.getNearbyTreasures({
      lat,
      lng,
      radius,
      treasureType: type,
      includeFound: false
    });
  }

  /**
   * 获取移动宝藏轨迹
   */
  static async getMobileTreasureTrail(treasureId: string): Promise<{
    success: boolean;
    data: {
      trail: Array<{
        location: { lat: number; lng: number };
        timestamp: string;
        action: 'hide' | 'find';
        actor: string;
      }>;
      total_moves: number;
    };
  }> {
    try {
      const response = await qrTreasureApi.get(`/${treasureId}/trail`);
      return response.data;
    } catch (error: any) {
      logger.error('获取宝藏轨迹失败:', error.message);
      throw new Error('获取宝藏轨迹失败: ' + (error.message || '网络错误'));
    }
  }

  /**
   * 计算两点间距离（公里）
   */
  static calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // 地球半径（公里）
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * 角度转弧度
   */
  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * 判断宝藏是否在用户附近
   */
  static isTreasureNearby(
    treasure: QRTreasure,
    userLat: number,
    userLng: number,
    threshold: number = 100 // 默认100米阈值
  ): boolean {
    const distance = this.calculateDistance(treasure.hide_lat, treasure.hide_lng, userLat, userLng);
    return distance * 1000 <= threshold; // 转换为米
  }

  /**
   * 获取宝藏状态描述
   */
  static getTreasureStatusText(treasure: QRTreasure): string {
    if (treasure.status === 'found') {
      return '已被找到';
    } else if (treasure.status === 'expired') {
      return '已过期';
    } else if (treasure.expires_at && new Date(treasure.expires_at) < new Date()) {
      return '已过期';
    } else {
      return '可寻宝';
    }
  }

  /**
   * 获取宝藏类型描述
   */
  static getTreasureTypeText(treasure: QRTreasure): string {
    if (treasure.treasure_type === 'fixed') {
      return `固定宝藏`;
    } else {
      return `移动宝藏 (${treasure.move_count || 0}次移动)`;
    }
  }
}

export default QRTreasureMapService;