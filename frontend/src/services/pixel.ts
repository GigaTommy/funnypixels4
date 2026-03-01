import { api } from './api';
import { logger } from '../utils/logger';
import { PixelInfo, PixelLike, PixelReport } from '../types/pixel';

export class PixelService {
  // 获取像素信息
  static async getPixel(lat: number, lng: number): Promise<{ success: boolean; data: PixelInfo }> {
    const response = await api.get(`/pixels/${lat}/${lng}`);
    return response.data;
  }

  // 获取像素详细信息 - 包含用户信息和联盟信息
  static async getPixelDetails(gridId: string): Promise<{ success: boolean; data: PixelInfo | null }> {
    try {
      logger.info(`🔄 获取像素详细信息: gridId=${gridId}`);

      // 🔧 添加更短的超时设置，避免长时间等待
      const response = await api.get(`/pixels/details/${gridId}`, {
        timeout: 5000 // 5秒超时
      });

      logger.info(`✅ 像素详细信息获取成功:`, response.data);
      return response.data;
    } catch (error: any) {
      // 如果是404错误，说明像素不存在，这是正常情况
      if (error.response?.status === 404) {
        logger.info(`ℹ️ 像素不存在: gridId=${gridId}`);
        return { success: true, data: null };
      }

      // 如果是超时错误，记录为警告而不是错误
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        logger.warn(`⏰ 像素详细信息获取超时: gridId=${gridId}`);
        return { success: false, data: null };
      }

      // 其他错误才记录为错误
      logger.error('❌ 获取像素详细信息失败:', error);
      throw error;
    }
  }

  // 批量获取像素
  static async getPixelsBatch(gridIds: string[]): Promise<{ success: boolean; data: PixelInfo[] }> {
    const response = await api.post('/pixels/batch', { gridIds: gridIds });
    return response.data;
  }

  // 创建像素
  static async createPixel(data: {
    lat: number;
    lng: number;
    color: string;
    pattern_id?: string;
    pattern_anchor_x?: number;
    pattern_anchor_y?: number;
    pattern_rotation?: number;
    pattern_mirror?: boolean;
  }): Promise<{ success: boolean; data: PixelInfo }> {
    const response = await api.post('/pixels', data);
    return response.data;
  }

  // 更新像素
  static async updatePixel(
    lat: number,
    lng: number,
    data: Partial<PixelInfo>
  ): Promise<{ success: boolean; data: PixelInfo }> {
    const response = await api.put(`/pixels/${lat}/${lng}`, data);
    return response.data;
  }

  // 删除像素
  static async deletePixel(lat: number, lng: number): Promise<{ success: boolean; message: string }> {
    const response = await api.delete(`/pixels/${lat}/${lng}`);
    return response.data;
  }

  // 点赞像素
  static async likePixel(lat: number, lng: number): Promise<{ success: boolean; data: PixelLike }> {
    const response = await api.post(`/pixels/${lat}/${lng}/like`);
    return response.data;
  }

  // 取消点赞
  static async unlikePixel(lat: number, lng: number): Promise<{ success: boolean; message: string }> {
    const response = await api.delete(`/pixels/${lat}/${lng}/like`);
    return response.data;
  }

  // 检查点赞状态
  static async checkLikeStatus(lat: number, lng: number): Promise<{ success: boolean; data: { isLiked: boolean } }> {
    const response = await api.get(`/pixels/${lat}/${lng}/like-status`);
    return response.data;
  }

  // 获取像素点赞列表
  static async getPixelLikes(
    lat: number,
    lng: number,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ success: boolean; data: PixelLike[] }> {
    const response = await api.get(`/pixels/${lat}/${lng}/likes`, {
      params: { limit, offset }
    });
    return response.data;
  }

  // 举报像素
  static async reportPixel(data: {
    lat: number;
    lng: number;
    reason: string;
    context: string;
  }): Promise<{ success: boolean; data: PixelReport }> {
    const response = await api.post(`/pixels/${data.lat}/${data.lng}/report`, {
      reason: data.reason,
      context: data.context
    });
    return response.data;
  }

  // 获取像素举报列表（管理员功能）
  static async getPixelReports(
    status?: 'pending' | 'reviewed' | 'resolved' | 'dismissed',
    limit: number = 20,
    offset: number = 0
  ): Promise<{ success: boolean; data: PixelReport[] }> {
    const response = await api.get('/pixels/reports', {
      params: { status, limit, offset }
    });
    return response.data;
  }

  // 处理举报（管理员功能）
  static async handleReport(
    reportId: string,
    action: 'resolve' | 'dismiss',
    notes?: string
  ): Promise<{ success: boolean; message: string }> {
    const response = await api.put(`/pixels/reports/${reportId}`, {
      action,
      notes
    });
    return response.data;
  }

  // 计算网格ID
  static calculateGridId(lat: number, lng: number): string {
    // 这里可以根据实际需求实现网格ID计算逻辑
    const gridSize = 0.01; // 假设网格大小为0.01度
    const gridLat = Math.floor(lat / gridSize) * gridSize;
    const gridLng = Math.floor(lng / gridSize) * gridSize;
    return `${gridLat.toFixed(6)}_${gridLng.toFixed(6)}`;
  }

  // 获取范围内的网格ID
  static getGridIdsInBounds(bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  }): string[] {
    const gridSize = 0.01;
    const gridIds: string[] = [];
    
    for (let lat = bounds.south; lat <= bounds.north; lat += gridSize) {
      for (let lng = bounds.west; lng <= bounds.east; lng += gridSize) {
        gridIds.push(this.calculateGridId(lat, lng));
      }
    }
    
    return gridIds;
  }

  // 获取像素统计信息
  static async getPixelStats(): Promise<{ success: boolean; data: {
    totalPixels: number;
    totalUsers: number;
    totalLikes: number;
    totalReports: number;
  } }> {
    const response = await api.get('/pixels/stats');
    return response.data;
  }

  // 获取用户像素统计
  static async getUserPixelStats(userId: string): Promise<{ success: boolean; data: {
    totalPixels: number;
    totalLikes: number;
    totalReports: number;
    favoriteColor: string;
    mostUsedPattern: string;
  } }> {
    const response = await api.get(`/pixels/user-stats/${userId}`);
    return response.data;
  }
}
