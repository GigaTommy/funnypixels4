import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { AuthService } from './auth';
import { getAuthToken, isUserAuthenticated } from '../utils/authUtils';
import { config } from '../config/env';
import { logger } from '../utils/logger';

// API基础配置
const API_BASE_URL = config.API_BASE_URL;

// 创建axios实例
export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 30000, // 增加到30秒，解决像素批量获取超时问题
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
api.interceptors.request.use(
  async (config) => {
    logger.debug('🔍 API拦截器被调用:', {
      method: config.method,
      url: config.url,
      baseURL: config.baseURL
    });
    
    logger.debug(`API请求: ${config.method?.toUpperCase()} ${config.url}`);
    logger.debug(`API基础URL: ${API_BASE_URL}`);
    logger.debug(`完整URL: ${config.baseURL}${config.url}`);
    
    // 检查是否为游客模式
    const isGuest = AuthService.isGuest();
    
    // 添加认证token - 使用统一工具
    const token = getAuthToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      logger.debug('🔐 已添加认证token:', {
        hasToken: !!token,
        url: config.url
      });
    } else if (!isGuest) {
      // 只在非游客模式下输出警告
      logger.warn('⚠️ 用户未认证，可能需要重新登录');
      logger.debug('⚠️ localStorage认证状态:', {
        hasToken: !!localStorage.getItem('funnypixels_token'),
        hasRefreshToken: !!localStorage.getItem('funnypixels_refresh_token'),
        hasUser: !!localStorage.getItem('funnypixels_user'),
        url: config.url
      });
    } else {
      logger.debug('👤 游客模式，无需认证token');
      // 为游客模式添加游客ID头部
      const guestId = AuthService.getGuestId();
      if (guestId) {
        config.headers['X-Guest-ID'] = guestId;
        logger.debug('🆔 已添加游客ID头部:', guestId);
      }
    }
    
    // 检查是否需要CSRF令牌
    const csrfToken = localStorage.getItem('csrf_token');
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    } else if (config.method !== 'GET' && config.url !== '/csrf-token') {
      // 对于非GET请求，如果没有CSRF令牌，尝试获取
      try {
        const newToken = await CSRFManager.getToken();
        if (newToken) {
          config.headers['X-CSRF-Token'] = newToken;
        }
      } catch (error) {
        logger.warn('自动获取CSRF令牌失败:', error);
      }
    }
    
    // 确保自定义头部能够正确传递（如幂等键）
    if (config.headers) {
      logger.debug('📋 请求头部:', config.headers);
    }
    
    return config;
  },
  (error) => {
    logger.error('API请求错误:', error);
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    // 检查是否有新的访问令牌
    const newToken = response.headers['x-new-access-token'];
    if (newToken) {
      logger.debug('🔄 收到新的访问令牌，自动更新');
             localStorage.setItem('funnypixels_token', newToken);
    }
    return response;
  },
  async (error) => {
    logger.error('API响应错误:', error.response?.data || error.message);
    
    // 处理401错误 - 尝试自动续期令牌（403权限不足不进行续期）
    if (error.response?.status === 401) {
      const originalRequest = error.config;
      
      // 避免无限重试
      if (originalRequest._retry) {
        logger.warn('❌ 令牌续期失败，需要重新登录');
        // 清除无效的认证信息
        localStorage.removeItem('funnypixels_token');
        localStorage.removeItem('funnypixels_refresh_token');
        localStorage.removeItem('funnypixels_user');
        
        // 跳转到登录页
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
      
      originalRequest._retry = true;
      
      try {
        // 检查是否为游客模式
        const isGuest = AuthService.isGuest();
        if (isGuest) {
          logger.debug('👤 游客模式，跳过令牌续期');
          throw error;
        }
        
        logger.debug('🔄 尝试自动续期令牌...');
        const refreshToken = localStorage.getItem('funnypixels_refresh_token');
        
        if (refreshToken) {
          logger.debug('🔄 调用刷新token端点...');
          const response = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {
            refreshToken
          }, {
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          logger.debug('🔄 刷新token响应:', response.data);
          const { tokens } = response.data;
          
          // 更新令牌
          localStorage.setItem('funnypixels_token', tokens.accessToken);
          if (tokens.refreshToken) {
            localStorage.setItem('funnypixels_refresh_token', tokens.refreshToken);
          }
          
          // 更新原始请求的令牌
          originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
          
          logger.debug('✅ 令牌续期成功，重试原始请求');
          return api(originalRequest);
        } else {
          logger.warn('❌ 无刷新令牌，需要重新登录');
          throw error;
        }
      } catch (refreshError: unknown) {
        logger.error('❌ 令牌续期失败:', refreshError);
        logger.debug('❌ 刷新错误详情:', {
          status: (refreshError as any)?.response?.status,
          data: (refreshError as any)?.response?.data,
          message: (refreshError as any)?.message
        });
        
        // 清除无效的认证信息
        localStorage.removeItem('funnypixels_token');
        localStorage.removeItem('funnypixels_refresh_token');
        localStorage.removeItem('funnypixels_user');
        
        // 跳转到登录页
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    }
    
    // 对于403权限不足错误，不进行令牌续期，直接返回错误
    if (error.response?.status === 403) {
      logger.warn('🚫 权限不足，不进行令牌续期');
    }
    
    return Promise.reject(error);
  }
);

// 像素相关类型
export interface Pixel {
  id: string;
  grid_id: string;
  lat: number;
  lng: number;
  color?: string;
  emoji?: string;
  draw_type?: string;
  pattern_id?: string;
  pattern_anchor_x?: number;
  pattern_anchor_y?: number;
  pattern_rotation?: number;
  pattern_mirror?: boolean;
  user_id: string;
  username?: string;
  created_at: string;
  updated_at: string;
  latitude?: number;
  longitude?: number;
  render_type?: 'color' | 'emoji' | 'complex';  // 🔧 添加 render_type 字段
  material_id?: string;  // 🔧 添加 material_id 字段
  unicode_char?: string;  // 🔧 添加 unicode_char 字段
  extData?: {
    type: string;
    grid_id: string;
    lat: number;
    lng: number;
    color: string;
    pattern_id?: string;
    pattern_anchor_x?: number;
    pattern_anchor_y?: number;
    pattern_rotation?: number;
    pattern_mirror?: boolean;
  };
}

export interface PixelConfig {
  MAX_POINTS: number;
  ACCUM_RATE: number;
  ACCUM_INTERVAL: number;
  FREEZE_DURATION: number;
}

export interface UserPixelState {
  id: string;
  user_id: string;
  pixel_points: number;
  last_accum_time: string;
  freeze_until: string;
  created_at: string;
  updated_at: string;
}

// 用户相关类型
export interface User {
  id: string;
  username: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
  display_name?: string;
  privacy_mode?: boolean;
  points?: number;
  total_pixels?: number;
  current_pixels?: number;
  created_at: string;
  updated_at: string;
}

export interface Alliance {
  id: string;
  name: string;
  description?: string;
  color: string;
  banner_url?: string;
  leader_id: string;
  member_count: number;
  total_pixels: number;
  current_pixels: number;
  settings?: any;
  is_public: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AllianceMember {
  id: string;
  alliance_id: string;
  user_id: string;
  role: 'leader' | 'admin' | 'member';
  contributed_pixels: number;
  joined_at: string;
  last_activity: string;
}

export interface StoreItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  item_type: 'consumable' | 'decoration' | 'special';
  metadata?: any;
  is_active: boolean;
  stock?: number;
  created_at: string;
  updated_at: string;
}

export interface UserInventory {
  id: string;
  user_id: string;
  item_id: string;
  quantity: number;
  acquired_at: string;
  item?: StoreItem;
}

export interface UserTransaction {
  id: string;
  user_id: string;
  item_id: string;
  quantity: number;
  total_price: number;
  transaction_type: 'purchase' | 'use' | 'gift';
  metadata?: any;
  created_at: string;
  item?: StoreItem;
}

// CSRF令牌管理
export class CSRFManager {
  static async getToken(): Promise<string | null> {
    try {
      const response = await api.get('/csrf-token');
      if (response.data.success) {
        localStorage.setItem('csrf_token', response.data.token);
        return response.data.token;
      }
    } catch (error) {
      logger.error('获取CSRF令牌失败:', error);
    }
    return null;
  }

  static clearToken(): void {
    localStorage.removeItem('csrf_token');
  }
}

// 像素API类
export class PixelAPI {
  // 健康检查
  static async healthCheck() {
    const response = await api.get('/health');
    return response.data;
  }

  // 初始化用户
  static async initUser(userId: string) {
    const response = await api.post('/pixel/init', { userId });
    return response.data;
  }

  // 获取用户状态
  static async getUserStatus(userId: string) {
    const response = await api.get(`/pixel/status/${userId}`);
    return response.data;
  }

  // 创建像素 - 🆕 使用新的统一绘制API
  static async createPixel(
    lat: number,
    lng: number,
    patternId: string,
    patternAnchorX: number = 0,
    patternAnchorY: number = 0,
    patternRotation: number = 0,
    patternMirror: boolean = false,
    sessionId?: string | null  // 🆕 添加可选的sessionId参数
  ) {
    // 获取用户身份
    const { userId, isGuest } = AuthService.ensureUserIdentity();
    if (!userId) {
      throw new Error('无法获取用户身份');
    }

    // 游客无法绘制像素
    if (isGuest) {
      throw new Error('游客模式无法绘制像素，请先登录');
    }

    const requestData: any = {
      lat,
      lng,
      patternId,
      anchorX: patternAnchorX,
      anchorY: patternAnchorY,
      rotation: patternRotation,
      mirror: patternMirror
    };

    // 🆕 如果提供了sessionId，则传递给后端
    if (sessionId) {
      requestData.sessionId = sessionId;
      logger.debug('🔗 绘制像素时传递sessionId:', sessionId.slice(0, 8));
    }

    // 🆕 使用新的统一绘制API /pixel-draw/manual
    // 如果传递了sessionId则直接使用，否则后端会尝试自动获取活跃会话
    const response = await api.post('/pixel-draw/manual', requestData);
    return response.data;
  }

  /**
   * 计算网格ID - 与后端完全一致的算法
   */
  private static calculateGridId(lat: number, lng: number): string {
    const GRID_SIZE = 0.0001; // 网格大小（度）
    
    // 与后端完全一致的计算方式
    const gridX = Math.floor((lng + 180) / GRID_SIZE);
    const gridY = Math.floor((lat + 90) / GRID_SIZE);
    
    return `grid_${gridX}_${gridY}`;
  }

  // 获取像素
  static async getPixel(lat: number, lng: number) {
    const response = await api.get('/pixel', {
      params: { lat, lng }
    });
    return response.data;
  }

  // 批量获取像素
  static async getPixelsBatch(gridIds: string[]) {
    const response = await api.post('/pixels/batch', { gridIds });
    return response.data;
  }

  // 获取指定范围内的网格ID列表
  static getGridIdsInBounds(minLat: number, maxLat: number, minLng: number, maxLng: number): string[] {
    const GRID_SIZE = 0.0001; // 网格大小（度）
    const gridIds: string[] = [];
    
    // 计算网格范围
    const startX = Math.floor((minLng + 180) / GRID_SIZE);
    const endX = Math.floor((maxLng + 180) / GRID_SIZE);
    const startY = Math.floor((minLat + 90) / GRID_SIZE);
    const endY = Math.floor((maxLat + 90) / GRID_SIZE);
    
    // 生成网格ID
    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        gridIds.push(`grid_${x}_${y}`);
      }
    }
    
    return gridIds;
  }

  // 清理非活跃用户
  static async cleanupInactiveUsers() {
    const response = await api.post('/pixel/cleanup');
    return response.data;
  }

  /**
   * 按地理范围获取像素 - 高效版本
   */
  static async getPixelsByArea(bounds: any, zoom: number): Promise<any> {
    try {
      const response = await api.post('/pixels/area', { bounds, zoom });
      return response.data;
    } catch (error) {
      logger.error('获取地理范围像素失败:', error);
      throw error;
    }
  }
}

// 用户服务类 - 统一使用AuthService
export class UserService {
  // 获取用户ID - 优先使用AuthService的用户ID
  static getUserId(): string | null {
    // 如果用户已登录，使用AuthService的用户ID
    if (AuthService.isAuthenticated()) {
      return AuthService.getUserId();
    }
    
    // 如果未登录，返回游客ID
    if (AuthService.isGuest()) {
      return AuthService.getGuestId();
    }
    
    // 如果既未登录也不是游客，返回null
    logger.warn('用户未登录且不是游客，无法获取用户ID');
    return null;
  }

  // 初始化用户 - 需要登录
  static async initializeUser() {
    const userId = this.getUserId();
    if (!userId) {
      throw new Error('用户未登录，请先登录');
    }

    const response = await api.post('/pixel/init', { userId });
    return response.data;
  }

  // 获取用户状态 - 需要登录
  static async getUserStatus() {
    const userId = this.getUserId();
    if (!userId) {
      throw new Error('用户未登录，请先登录');
    }

    const response = await api.get(`/pixel/status/${userId}`);
    return response.data;
  }

  // 重置用户状态 - 需要登录
  static async resetUserStatus() {
    const userId = this.getUserId();
    if (!userId) {
      throw new Error('用户未登录，请先登录');
    }

    const response = await api.post(`/pixel/reset/${userId}`);
    return response.data;
  }

  // 检查用户是否可以绘制
  static async canDraw(): Promise<boolean> {
    try {
      const status = await this.getUserStatus();
      return status.state.pixel_points > 0 && status.state.freeze_until === '0';
    } catch (error) {
      logger.error('检查绘制权限失败:', error);
      return false;
    }
  }
}

// 联盟服务类
export class AllianceService {
  // 创建联盟
  static async createAlliance(token: string, data: {
    name: string;
    description?: string;
    color: string;
    is_public?: boolean;
  }) {
    const response = await api.post('/alliances', data, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  }

  // 搜索联盟
  static async searchAlliances(token: string, query: string, limit: number = 10) {
    const response = await api.get('/alliances/search', {
      params: { q: query, limit },
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  }

  // 获取联盟排行榜
  static async getLeaderboard(token: string, limit: number = 10) {
    const response = await api.get('/alliances/leaderboard', {
      params: { limit },
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  }

  // 获取用户联盟
  static async getUserAlliance(token: string) {
    const response = await api.get('/alliances/user/alliance', {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  }

  // 获取联盟详情
  static async getAllianceDetails(token: string, allianceId: string) {
    const response = await api.get(`/alliances/${allianceId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  }

  // 加入联盟
  static async joinAlliance(token: string, allianceId: string) {
    const response = await api.post(`/alliances/${allianceId}/join`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  }

  // 退出联盟
  static async leaveAlliance(token: string) {
    const response = await api.post('/alliances/leave', {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  }
}

// 商店服务类
export class StoreService {
  // 获取所有商品
  static async getAllItems() {
    const response = await api.get('/store/items');
    return response.data;
  }

  // 按类型获取商品
  static async getItemsByType(type: string) {
    const response = await api.get(`/store/items/type/${type}`);
    return response.data;
  }

  // 购买商品
  static async purchaseItem(token: string, itemId: string, quantity: number = 1) {
    const response = await api.post('/store/purchase', {
      itemId,
      quantity
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  }

  // 使用道具
  static async useItem(token: string, itemId: string, quantity: number = 1, metadata?: any) {
    const response = await api.post('/store/use', {
      itemId,
      quantity,
      metadata
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  }

  // 获取用户库存
  static async getUserInventory(token: string) {
    const response = await api.get('/store/inventory', {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  }

  // 获取用户交易记录
  static async getUserTransactions(token: string, limit: number = 20) {
    const response = await api.get('/store/transactions', {
      params: { limit },
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  }
}

// 地理热点服务类
export interface Hotspot {
  id: number;
  hotspot_date: string;
  period: string;
  rank: number;
  center_lat: number;
  center_lng: number;
  pixel_count: number;
  unique_users: number;
  region_level?: string;
  region_code?: string;
  region_name?: string;
  meta?: any;
  created_at: string;
  updated_at: string;
}

export class GeographicService {
  /**
   * 获取热点区域列表
   * @param period 周期类型：daily/weekly/monthly（默认monthly）
   * @param limit 返回数量（默认10）
   */
  static async getHotspots(period: string = 'monthly', limit: number = 10): Promise<Hotspot[]> {
    try {
      const response = await api.get('/geographic/hotspots', {
        params: { period, limit }
      });
      return response.data.data || [];
    } catch (error) {
      logger.error('获取热点区域失败:', error);
      return [];
    }
  }
}
