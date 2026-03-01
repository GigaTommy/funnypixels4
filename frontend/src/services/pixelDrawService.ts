import { api } from './api';
import { logger } from '../utils/logger';
import { AuthService } from './auth';

export interface PixelDrawParams {
  lat: number;
  lng: number;
  color?: string;
  patternId?: string;
  anchorX?: number;
  anchorY?: number;
  rotation?: number;
  mirror?: boolean;
  sessionId?: string; // 🆕 绘制会话ID
  drawType?: 'manual' | 'gps' | 'batch'; // 🆕 绘制类型
}

export interface PixelDrawResult {
  success: boolean;
  data?: {
    pixel: any;
    consumptionResult: {
      consumed: number;
      remainingPoints: number;
      itemPoints: number;
      naturalPoints: number;
      isFrozen: boolean;
      freezeUntil: string;
    };
    processingTime: number;
  };
  error?: string;
}

export interface BatchPixelDrawParams {
  pixels: PixelDrawParams[];
  drawType?: 'manual' | 'gps';
}

export interface BatchPixelDrawResult {
  success: boolean;
  data?: {
    results: PixelDrawResult[];
    summary: {
      total: number;
      success: number;
      failed: number;
      totalTime: number;
      averageTime: number;
    };
  };
  error?: string;
}

export interface UserDrawState {
  canDraw: boolean;
  totalPoints?: number;
  itemPoints?: number;
  naturalPoints?: number;
  reason?: string;
  freezeTimeLeft?: number;
}

/**
 * 像素绘制服务
 * 提供统一的绘制API接口
 */
export class PixelDrawService {
  private static instance: PixelDrawService;

  private constructor() {}

  static getInstance(): PixelDrawService {
    if (!PixelDrawService.instance) {
      PixelDrawService.instance = new PixelDrawService();
    }
    return PixelDrawService.instance;
  }

  /**
   * 手动绘制像素
   */
  async drawPixelManual(params: PixelDrawParams): Promise<PixelDrawResult> {
    try {
      const response = await api.post('/pixel-draw/manual', params);
      return response.data;
    } catch (error: any) {
      logger.error('手动绘制像素失败:', error);
      return {
        success: false,
        error: error.response?.data?.error || '绘制失败'
      };
    }
  }

  /**
   * GPS绘制像素
   */
  async drawPixelGps(params: PixelDrawParams): Promise<PixelDrawResult> {
    try {
      const response = await api.post('/pixel-draw/gps', params);
      return response.data;
    } catch (error: any) {
      logger.error('GPS绘制像素失败:', error);
      return {
        success: false,
        error: error.response?.data?.error || '绘制失败'
      };
    }
  }

  /**
   * 批量绘制像素
   */
  async drawPixelBatch(params: BatchPixelDrawParams): Promise<BatchPixelDrawResult> {
    try {
      const response = await api.post('/pixel-draw/batch', params);
      return response.data;
    } catch (error: any) {
      logger.error('批量绘制像素失败:', error);
      return {
        success: false,
        error: error.response?.data?.error || '批量绘制失败'
      };
    }
  }

  /**
   * 获取绘制服务状态
   */
  async getServiceStatus(): Promise<{
    success: boolean;
    data?: {
      service: string;
      version: string;
      features: string[];
      timestamp: string;
    };
    error?: string;
  }> {
    try {
      const response = await api.get('/pixel-draw/status');
      return response.data;
    } catch (error: any) {
      logger.error('获取绘制服务状态失败:', error);
      return {
        success: false,
        error: error.response?.data?.error || '获取状态失败'
      };
    }
  }

  /**
   * 验证用户绘制状态
   */
  async validateUserDrawState(): Promise<{
    success: boolean;
    data?: UserDrawState;
    error?: string;
  }> {
    try {
      // 获取用户ID（包括游客ID）
      const { userId, isGuest } = AuthService.ensureUserIdentity();
      
      // 构建请求参数
      const params = new URLSearchParams();
      if (userId) {
        params.append('userId', userId);
      }
      
      const response = await api.get(`/pixel-draw/validate?${params.toString()}`);
      return response.data;
    } catch (error: any) {
      logger.error('验证用户绘制状态失败:', error);
      return {
        success: false,
        error: error.response?.data?.error || '验证失败'
      };
    }
  }

  /**
   * 统一的绘制函数（根据类型自动选择）
   */
  async drawPixel(
    params: PixelDrawParams,
    drawType: 'manual' | 'gps' = 'manual'
  ): Promise<PixelDrawResult> {
    if (drawType === 'gps') {
      return this.drawPixelGps(params);
    } else {
      return this.drawPixelManual(params);
    }
  }

  /**
   * 检查用户是否可以绘制
   */
  async canUserDraw(): Promise<boolean> {
    try {
      const result = await this.validateUserDrawState();
      return result.success && result.data?.canDraw === true;
    } catch (error) {
      logger.error('检查用户绘制权限失败:', error);
      return false;
    }
  }

  /**
   * 获取用户绘制状态详情
   */
  async getUserDrawState(): Promise<UserDrawState | null> {
    try {
      const result = await this.validateUserDrawState();
      if (result.success && result.data) {
        return result.data;
      }
      return null;
    } catch (error) {
      logger.error('获取用户绘制状态失败:', error);
      return null;
    }
  }
}

// 导出单例实例
export const pixelDrawService = PixelDrawService.getInstance();
