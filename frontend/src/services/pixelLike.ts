import { api } from './api';

export interface PixelLike {
  id: string;
  pixel_id: string;
  user_id: string;
  pixel_owner_id: string;
  created_at: string;
  deleted_at?: string;
}

export interface PixelLikeStatus {
  isLiked: boolean;
  likeCount: number;
}

export interface PixelLiker {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  created_at: string;
}

export interface UserLikeStats {
  given_likes: number;
  received_likes: number;
}

export interface PopularPixel {
  pixel_id: string;
  like_count: number;
  owner: {
    id: string;
    username: string;
    display_name?: string;
    avatar_url?: string;
  } | null;
}

export class PixelLikeAPI {
  // 点赞像素
  static async likePixel(pixelId: string, pixelOwnerId: string): Promise<{ success: boolean; data: PixelLike; message: string }> {
    const response = await api.post(`/pixel-likes/${pixelId}/like`, { pixelOwnerId });
    return response.data;
  }

  // 取消点赞
  static async unlikePixel(pixelId: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete(`/pixel-likes/${pixelId}/like`);
    return response.data;
  }

  // 检查单个像素的点赞状态
  static async checkLikeStatus(pixelId: string): Promise<{ success: boolean; data: PixelLikeStatus }> {
    const response = await api.get(`/pixel-likes/${pixelId}/like-status`);
    return response.data;
  }

  // 批量检查多个像素的点赞状态
  static async checkMultipleLikeStatus(pixelIds: string[]): Promise<{ success: boolean; data: Record<string, PixelLikeStatus> }> {
    const response = await api.post('/pixel-likes/batch/like-status', { pixelIds });
    return response.data;
  }

  // 获取像素点赞用户列表
  static async getPixelLikers(pixelId: string, limit: number = 50, offset: number = 0): Promise<{ success: boolean; data: PixelLiker[] }> {
    const response = await api.get(`/pixel-likes/${pixelId}/likers`, {
      params: { limit, offset }
    });
    return response.data;
  }

  // 获取用户点赞统计
  static async getUserLikeStats(userId: string): Promise<{ success: boolean; data: UserLikeStats }> {
    const response = await api.get(`/pixel-likes/user/${userId}/stats`);
    return response.data;
  }

  // 获取用户的点赞历史
  static async getUserLikes(limit: number = 20, offset: number = 0): Promise<{ success: boolean; data: PixelLike[] }> {
    const response = await api.get('/pixel-likes/user/my/likes', {
      params: { limit, offset }
    });
    return response.data;
  }

  // 获取用户收到的点赞
  static async getUserReceivedLikes(limit: number = 20, offset: number = 0): Promise<{ success: boolean; data: PixelLike[] }> {
    const response = await api.get('/pixel-likes/user/my/received-likes', {
      params: { limit, offset }
    });
    return response.data;
  }

  // 获取热门像素
  static async getPopularPixels(
    limit: number = 20,
    offset: number = 0,
    timeRange?: 'day' | 'week' | 'month'
  ): Promise<{ success: boolean; data: PopularPixel[] }> {
    const response = await api.get('/pixel-likes/popular', {
      params: { limit, offset, timeRange }
    });
    return response.data;
  }
}

// 像素点赞相关的工具函数
export class PixelLikeUtils {
  // 格式化点赞数显示
  static formatLikeCount(count: number): string {
    if (count < 1000) {
      return count.toString();
    } else if (count < 1000000) {
      return (count / 1000).toFixed(1) + 'K';
    } else {
      return (count / 1000000).toFixed(1) + 'M';
    }
  }

  // 获取点赞动画效果
  static getLikeAnimation(isLiked: boolean): string {
    return isLiked ? 'animate-bounce' : 'animate-pulse';
  }

  // 获取点赞按钮样式
  static getLikeButtonStyle(isLiked: boolean): string {
    return isLiked
      ? 'text-red-500 hover:text-red-600'
      : 'text-gray-400 hover:text-red-400';
  }
}