import { api } from './api';

export interface UserFollow {
  id: string;
  follower_id: string;
  following_id: string;
  username: string;
  avatar_url?: string;
  total_pixels: number;
  current_pixels: number;
  created_at: string;
}

export interface UserStats {
  followingCount: number;
  followersCount: number;
}

export interface LeaderboardEntry {
  id: string;
  username?: string;
  name?: string;
  avatar_url?: string;
  color?: string;
  banner_url?: string;
  period_pixels: number;
  total_pixels: number;
  current_pixels: number;
  member_count?: number;
  pattern_id?: string;  // 新增：联盟图案ID
  pattern_type?: 'color' | 'emoji' | 'complex';  // 新增：联盟图案类型
}

export interface UserRank {
  rank: number;
  data: LeaderboardEntry;
}

export class SocialAPI {
  // 关注用户
  static async followUser(userId: string): Promise<{ success: boolean; message: string; data: any }> {
    const response = await api.post(`/social/follow/${userId}`);
    return response.data;
  }

  // 取消关注
  static async unfollowUser(userId: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete(`/social/unfollow/${userId}`);
    return response.data;
  }

  // 检查关注状态 - 返回完整状态信息
  static async checkFollowStatus(userId: string): Promise<{
    success: boolean;
    data: {
      isFollowing: boolean;
      isFollowedBy: boolean;
      isMutual: boolean;
    }
  }> {
    const response = await api.get(`/social/follow-status/${userId}`);
    return response.data;
  }

  // 获取关注列表
  static async getFollowing(
    userId: string, 
    limit: number = 20, 
    offset: number = 0
  ): Promise<{ success: boolean; data: UserFollow[] }> {
    const response = await api.get(`/social/following/${userId}`, {
      params: { limit, offset }
    });
    return response.data;
  }

  // 获取粉丝列表
  static async getFollowers(
    userId: string, 
    limit: number = 20, 
    offset: number = 0
  ): Promise<{ success: boolean; data: UserFollow[] }> {
    const response = await api.get(`/social/followers/${userId}`, {
      params: { limit, offset }
    });
    return response.data;
  }

  // 获取互相关注列表
  static async getMutualFollows(
    userId: string, 
    limit: number = 20, 
    offset: number = 0
  ): Promise<{ success: boolean; data: UserFollow[] }> {
    const response = await api.get(`/social/mutual-follows/${userId}`, {
      params: { limit, offset }
    });
    return response.data;
  }

  // 获取推荐关注
  static async getRecommendedFollows(
    limit: number = 10
  ): Promise<{ success: boolean; data: UserFollow[] }> {
    const response = await api.get('/social/recommended-follows', {
      params: { limit }
    });
    return response.data;
  }

  // 获取用户统计
  static async getUserStats(userId: string): Promise<{ success: boolean; data: UserStats }> {
    const response = await api.get(`/social/user-stats/${userId}`);
    return response.data;
  }

  // 获取排行榜
  static async getLeaderboard(
    type: 'user' | 'alliance' = 'user',
    period: 'daily' | 'weekly' | 'monthly' = 'daily',
    date?: string,
    limit: number = 20
  ): Promise<{ success: boolean; data: LeaderboardEntry[] }> {
    const response = await api.get('/social/leaderboard', {
      params: { type, period, date, limit }
    });
    return response.data;
  }

  // 获取用户排名
  static async getUserRank(
    userId: string,
    type: 'user' | 'alliance' = 'user',
    period: 'daily' | 'weekly' | 'monthly' = 'daily',
    date?: string
  ): Promise<{ success: boolean; data: UserRank | null }> {
    const response = await api.get(`/social/user-rank/${userId}`, {
      params: { type, period, date }
    });
    return response.data;
  }

  // 获取联盟排名
  static async getAllianceRank(
    allianceId: string,
    period: 'daily' | 'weekly' | 'monthly' = 'daily',
    date?: string
  ): Promise<{ success: boolean; data: UserRank | null }> {
    const response = await api.get(`/social/alliance-rank/${allianceId}`, {
      params: { period, date }
    });
    return response.data;
  }

  // 获取排行榜历史
  static async getLeaderboardHistory(
    type: 'user' | 'alliance' = 'user',
    period: 'daily' | 'weekly' | 'monthly' = 'daily',
    limit: number = 7
  ): Promise<{ success: boolean; data: Array<{ date: string; rankings: LeaderboardEntry[] }> }> {
    const response = await api.get('/social/leaderboard-history', {
      params: { type, period, limit }
    });
    return response.data;
  }
}
