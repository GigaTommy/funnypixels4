import { api } from './api';
import { logger } from '../utils/logger';

export interface StoreItem {
  id: string;
  name: string;
  description: string;
  price: number;
  type: 'consumable' | 'decoration' | 'special' | 'advertisement';
  category: string;
  icon: string;
  effects?: string[];
  requirements?: string[];
  dailyLimit?: number;
  metadata?: any;
}

export interface UserInventoryItem extends StoreItem {
  quantity: number;
  purchasedAt: string;
  expiresAt?: string;
}

export interface Transaction {
  id: string;
  userId: string;
  itemId: string;
  itemName: string;
  quantity: number;
  price: number;
  type: 'purchase' | 'use' | 'refund';
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
  metadata?: any;
}

export interface UserPoints {
  points: number;
  totalEarned: number;
  totalSpent: number;
  lastUpdated: string;
}

export class StoreAPI {
  private static baseUrl = '/store-payment';

  /**
   * 获取商店商品列表
   */
  static async getItems(category?: string): Promise<{
    success: boolean;
    data: StoreItem[];
    message?: string;
  }> {
    try {
      const params = new URLSearchParams();
      if (category) {
        params.append('category', category);
      }

      const response = await api.get(`${this.baseUrl}/items?${params.toString()}`);
      
      // 映射字段，确保所有商品都有正确的 price 字段
      const mappedData = (response.data.data || []).map((item: any) => ({
        ...item,
        price: item.price || item.price_points || 0,
        type: item.type || item.item_type || 'consumable',
        icon: item.icon || '🎁'
      }));
      
      return {
        success: true,
        data: mappedData
      };
    } catch (error) {
      logger.error('获取商店商品失败:', error);
      return {
        success: false,
        data: [],
        message: error instanceof Error ? error.message : '获取商品失败'
      };
    }
  }

  /**
   * 获取用户库存
   */
  static async getInventory(): Promise<{
    success: boolean;
    data: UserInventoryItem[];
    message?: string;
  }> {
    try {
      const response = await api.get(`${this.baseUrl}/inventory`);
      logger.info('📦 库存API响应:', response.data);
      return {
        success: true,
        data: response.data.data || []
      };
    } catch (error) {
      logger.error('获取用户库存失败:', error);
      return {
        success: false,
        data: [],
        message: error instanceof Error ? error.message : '获取库存失败'
      };
    }
  }

  /**
   * 获取用户积分信息
   */
  static async getUserPoints(): Promise<UserPoints> {
    try {
      const response = await api.get(`${this.baseUrl}/points`);
      return {
        points: response.data.data.points || 0,
        totalEarned: response.data.data.totalEarned || 0,
        totalSpent: response.data.data.totalSpent || 0,
        lastUpdated: response.data.data.lastUpdated || new Date().toISOString()
      };
    } catch (error) {
      logger.error('获取用户积分失败:', error);
      return {
        points: 0,
        totalEarned: 0,
        totalSpent: 0,
        lastUpdated: new Date().toISOString()
      };
    }
  }

  /**
   * 购买商品
   */
  static async purchaseItem(itemId: string, quantity: number = 1, additionalData?: any): Promise<{
    success: boolean;
    transaction?: Transaction;
    message?: string;
  }> {
    try {
      // 生成幂等键
      const idempotencyKey = `purchase_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      logger.info('🛒 购买商品请求:', {
        itemId,
        quantity,
        additionalData,
        idempotencyKey,
        url: `${this.baseUrl}/buy`
      });
      
      const requestData: any = {
        itemId,
        quantity
      };
      
      // 如果是广告商品，添加额外数据
      if (additionalData) {
        requestData.adTitle = additionalData.adTitle;
        requestData.adDescription = additionalData.adDescription;
        requestData.imageData = additionalData.imageData;
      }
      
      const response = await api.post(`${this.baseUrl}/buy`, requestData, {
        headers: {
          'x-idempotency-key': idempotencyKey
        }
      });
      
      logger.info('✅ 购买商品成功:', response.data);
      
      return {
        success: true,
        transaction: response.data.data,
        message: '购买成功'
      };
    } catch (error: unknown) {
      logger.error('❌ 购买商品失败:', error);
      
      let errorMessage = '购买失败';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      logger.error('❌ 错误详情:', {
        message: errorMessage,
        response: error && typeof error === 'object' && 'response' in error ? (error as any).response?.data : undefined,
        status: error && typeof error === 'object' && 'response' in error ? (error as any).response?.status : undefined,
        headers: error && typeof error === 'object' && 'response' in error ? (error as any).response?.headers : undefined
      });
      
      throw new Error(errorMessage);
    }
  }

  /**
   * 使用道具
   */
  static async useItem(itemId: string, quantity: number = 1, options?: { targetId?: string }): Promise<{
    success: boolean;
    effects?: any;
    message?: string;
  }> {
    try {
      const requestBody: any = {
        itemId,
        quantity
      };
      
      // 如果有targetId（用于炸弹等需要目标位置的道具），添加到请求中
      if (options?.targetId) {
        requestBody.targetId = options.targetId;
      }
      
      logger.info('🔍 StoreAPI.useItem 请求体:', JSON.stringify(requestBody, null, 2));
      logger.info('🔍 StoreAPI.useItem 请求URL:', `${this.baseUrl}/use`);
      
      // 检查认证token
      const token = localStorage.getItem('funnypixels_token');
      logger.info('🔍 认证token状态:', token ? '存在' : '不存在');
      
      const response = await api.post(`${this.baseUrl}/use`, requestBody);
      
      return {
        success: true,
        effects: response.data.data,
        message: '使用成功'
      };
    } catch (error: unknown) {
      logger.error('使用道具失败:', error);
      
      // 尝试从响应中获取更详细的错误信息
      let errorMessage = '使用失败';
      
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as any;
        if (axiosError.response?.data?.error) {
          errorMessage = axiosError.response.data.error;
        } else if (axiosError.message) {
          errorMessage = axiosError.message;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      throw new Error(errorMessage);
    }
  }

  /**
   * 获取交易记录
   */
  static async getTransactions(page: number = 1, limit: number = 20): Promise<{
    success: boolean;
    data: Transaction[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    message?: string;
  }> {
    try {
      const response = await api.get(`${this.baseUrl}/transactions?page=${page}&limit=${limit}`);
      return {
        success: true,
        data: response.data.transactions || [],
        pagination: response.data.pagination
      };
    } catch (error) {
      logger.error('获取交易记录失败:', error);
      return {
        success: false,
        data: [],
        message: error instanceof Error ? error.message : '获取交易记录失败'
      };
    }
  }

  /**
   * 获取商品详情
   */
  static async getItemDetails(itemId: string): Promise<{
    success: boolean;
    data?: StoreItem;
    message?: string;
  }> {
    try {
      const response = await api.get(`${this.baseUrl}/items/${itemId}`);
      return {
        success: true,
        data: response.data.item
      };
    } catch (error) {
      logger.error('获取商品详情失败:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : '获取商品详情失败'
      };
    }
  }

  /**
   * 创建广告投放
   */
  static async createAdvertisement(adData: {
    title: string;
    description: string;
    imageUrl?: string;
    targetLocation: {
      lat: number;
      lng: number;
    };
    radius: number;
    duration: number; // 小时
    budget: number;
    startTime?: string;
    endTime?: string;
  }): Promise<{
    success: boolean;
    advertisement?: any;
    message?: string;
  }> {
    try {
      const response = await api.post(`${this.baseUrl}/advertisements`, adData);
      return {
        success: true,
        advertisement: response.data.advertisement,
        message: '广告创建成功，等待审核'
      };
    } catch (error) {
      logger.error('创建广告失败:', error);
      throw new Error(error instanceof Error ? error.message : '创建广告失败');
    }
  }

  /**
   * 获取用户广告列表
   */
  static async getUserAdvertisements(): Promise<{
    success: boolean;
    data: any[];
    message?: string;
  }> {
    try {
      const response = await api.get(`${this.baseUrl}/advertisements/user`);
      return {
        success: true,
        data: response.data.data || []
      };
    } catch (error) {
      logger.error('获取用户广告列表失败:', error);
      throw new Error(error instanceof Error ? error.message : '获取广告列表失败');
    }
  }

  /**
   * 获取用户广告额度
   */
  static async getAdCredits(): Promise<{
    success: boolean;
    data: {
      total: number;
      used: number;
      available: number;
    };
    message?: string;
  }> {
    try {
      const response = await api.get(`${this.baseUrl}/ad-credits`);
      return {
        success: true,
        data: response.data.data || { total: 0, used: 0, available: 0 }
      };
    } catch (error) {
      logger.error('获取广告额度失败:', error);
      throw new Error(error instanceof Error ? error.message : '获取广告额度失败');
    }
  }

  /**
   * 获取每日使用限制
   */
  static async getDailyUsage(itemId: string): Promise<{
    used: number;
    limit: number;
    remaining: number;
    resetTime: string;
  }> {
    try {
      const response = await api.get(`${this.baseUrl}/daily-usage/${itemId}`);
      return {
        used: response.data.used || 0,
        limit: response.data.limit || 0,
        remaining: response.data.remaining || 0,
        resetTime: response.data.resetTime || new Date().toISOString()
      };
    } catch (error) {
      logger.error('获取每日使用限制失败:', error);
      return {
        used: 0,
        limit: 0,
        remaining: 0,
        resetTime: new Date().toISOString()
      };
    }
  }

  /**
   * 赠送道具给其他用户
   */
  static async giftItem(itemId: string, recipientId: string, quantity: number = 1, message?: string): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      await api.post(`${this.baseUrl}/gift`, {
        itemId,
        recipientId,
        quantity,
        message
      });
      
      return {
        success: true,
        message: '赠送成功'
      };
    } catch (error) {
      logger.error('赠送道具失败:', error);
      throw new Error(error instanceof Error ? error.message : '赠送失败');
    }
  }

  /**
   * 获取推荐商品
   */
  static async getRecommendedItems(): Promise<{
    success: boolean;
    data: StoreItem[];
    message?: string;
  }> {
    try {
      const response = await api.get(`${this.baseUrl}/recommended`);
      return {
        success: true,
        data: response.data.items || []
      };
    } catch (error) {
      logger.error('获取推荐商品失败:', error);
      return {
        success: false,
        data: [],
        message: error instanceof Error ? error.message : '获取推荐商品失败'
      };
    }
  }

  /**
   * 创建充值会话
   */
  static async createRechargeSession(amountRmb: number, channel: 'wechat' | 'alipay' | 'mock'): Promise<{
    success: boolean;
    data?: {
      orderId: string;
      paymentOrderId: string;
      payUrl?: string;
      qrCode?: string;
      channel: string;
      paymentUrl?: string;
      qrCodeDataUrl?: string;
    };
    message?: string;
  }> {
    try {
      const response = await api.post(`${this.baseUrl}/recharge`, {
        amountRmb,
        channel
      });
      
      return {
        success: true,
        data: response.data.data,
        message: '充值会话创建成功'
      };
    } catch (error) {
      logger.error('创建充值会话失败:', error);
      throw new Error(error instanceof Error ? error.message : '充值失败');
    }
  }

  /**
   * 确认支付
   */
  static async confirmPayment(orderId: string): Promise<{
    success: boolean;
    data?: any;
    message?: string;
  }> {
    try {
      const response = await api.post(`${this.baseUrl}/orders/${orderId}/confirm`);
      return {
        success: true,
        data: response.data.data,
        message: '支付确认成功'
      };
    } catch (error) {
      logger.error('确认支付失败:', error);
      throw new Error(error instanceof Error ? error.message : '确认支付失败');
    }
  }

  /**
   * 获取充值订单列表
   */
  static async getRechargeOrders(): Promise<{
    success: boolean;
    data: any[];
    message?: string;
  }> {
    try {
      const response = await api.get(`${this.baseUrl}/recharge-orders`);
      return {
        success: true,
        data: response.data.data || []
      };
    } catch (error) {
      logger.error('获取充值订单失败:', error);
      return {
        success: false,
        data: [],
        message: error instanceof Error ? error.message : '获取充值订单失败'
      };
    }
  }
}

export default StoreAPI;
