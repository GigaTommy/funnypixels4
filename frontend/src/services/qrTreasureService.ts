import axios from 'axios';
import { TokenManager } from './auth';
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
      } else {
        // 无刷新token，清除token并跳转
        TokenManager.clearTokens();
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export interface ScanResult {
  success: boolean;
  status: 'found' | 'nearby' | 'empty';
  treasure?: any;
  distance?: number;
  direction?: string;
  hint?: string;
  message: string;
  qrType?: any;
  qrHash?: string;
  treasureHidden?: boolean;
}

export interface HideTreasureData {
  qrContent: string;
  lat: number;
  lng: number;
  title: string;
  description?: string;
  hint?: string;
  rewardPoints: number;
  image?: File;
}

export interface ClaimResult {
  success: boolean;
  treasure: any;
  reward: number;
  message: string;
}

class QRTreasureService {
  /**
   * 扫描二维码
   */
  async scanQRCode(qrContent: string, lat: number, lng: number): Promise<ScanResult> {
    try {
      logger.info('📱 开始扫描二维码:', { qrContent: qrContent.substring(0, 20) + '...', lat, lng });

      const response = await qrTreasureApi.post('/scan', {
        qrContent,
        lat,
        lng
      });

      logger.info('✅ 扫描API调用成功:', response.data);
      return response.data;
    } catch (error: any) {
      logger.error('❌ 扫描API调用失败:', error);

      // 处理特定的错误情况
      if (error.response?.status === 401) {
        throw new Error('认证失败，请重新登录');
      } else if (error.response?.status === 403) {
        throw new Error('权限不足');
      } else if (error.response?.status === 404) {
        throw new Error('扫描接口不存在');
      } else {
        const message = error.response?.data?.message || error.message || '扫描失败';
        throw new Error(message);
      }
    }
  }

  /**
   * 藏宝
   */
  async hideTreasure(data: HideTreasureData): Promise<any> {
    try {
      logger.info('📦 开始藏宝:', { title: data.title, rewardPoints: data.rewardPoints });

      const formData = new FormData();
      formData.append('qrContent', data.qrContent);
      formData.append('lat', data.lat.toString());
      formData.append('lng', data.lng.toString());
      formData.append('title', data.title);
      if (data.description) {
        formData.append('description', data.description);
      }
      if (data.hint) {
        formData.append('hint', data.hint);
      }
      formData.append('rewardPoints', data.rewardPoints.toString());
      if (data.image) {
        formData.append('image', data.image);
      }

      const response = await qrTreasureApi.post('/hide', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      logger.info('✅ 藏宝API调用成功:', response.data);
      return response.data;
    } catch (error: any) {
      logger.error('❌ 藏宝API调用失败:', error);
      throw new Error(error.response?.data?.message || '藏宝失败');
    }
  }

  /**
   * 领取宝藏
   */
  async claimTreasure(treasureId: string, lat: number, lng: number): Promise<ClaimResult> {
    try {
      logger.info('🎁 开始领取宝藏:', { treasureId });

      const response = await qrTreasureApi.post(`/${treasureId}/claim`, {
        lat,
        lng
      });

      logger.info('✅ 领取宝藏API调用成功:', response.data);
      return response.data;
    } catch (error: any) {
      logger.error('❌ 领取宝藏API调用失败:', error);
      throw new Error(error.response?.data?.message || '领取失败');
    }
  }

  /**
   * 获取我的藏宝记录
   */
  async getMyHiddenTreasures(): Promise<any[]> {
    try {
      const response = await qrTreasureApi.get('/my-hidden');
      return response.data.treasures;
    } catch (error: any) {
      logger.error('❌ 获取藏宝记录API调用失败:', error);
      throw new Error(error.response?.data?.message || '获取失败');
    }
  }

  /**
   * 获取我的寻宝记录
   */
  async getMyFoundTreasures(): Promise<any[]> {
    try {
      const response = await qrTreasureApi.get('/my-found');
      return response.data.treasures;
    } catch (error: any) {
      logger.error('❌ 获取寻宝记录API调用失败:', error);
      throw new Error(error.response?.data?.message || '获取失败');
    }
  }

  /**
   * 获取宝藏详情
   */
  async getTreasureDetail(treasureId: string): Promise<any> {
    try {
      const response = await qrTreasureApi.get(`/${treasureId}`);
      return response.data.treasure;
    } catch (error: any) {
      logger.error('❌ 获取宝藏详情API调用失败:', error);
      throw new Error(error.response?.data?.message || '获取失败');
    }
  }
}

export default new QRTreasureService();
