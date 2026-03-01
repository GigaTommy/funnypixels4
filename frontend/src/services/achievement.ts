import { api } from './api';

export interface UserAchievementStats {
  user_id: string;
  like_received_count: number;
  like_given_count: number;
  achievements_unlocked: string[];
  last_updated: string;
}

export interface Achievement {
  id: string;
  key: string;
  name: string;
  description: string;
  category: 'likes' | 'social' | 'pixels' | 'activity' | 'special';
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
}

export interface AchievementOverview {
  stats: UserAchievementStats;
  totalAchievements: number;
  recentAchievements: Achievement[];
}

export class AchievementAPI {
  static async getUserStats(userId: string) {
    const response = await api.get(`/achievements/user/${userId}/stats`);
    return response.data;
  }

  static async getMyAchievementOverview() {
    const response = await api.get('/achievements/my/overview');
    return response.data;
  }

  static async getAllAchievements(category?: string) {
    const response = await api.get('/achievements/definitions', { params: { category } });
    return response.data;
  }
}

export class AchievementUtils {
  static readonly CATEGORY_MAP = {
    likes: '点赞相关',
    social: '社交互动',
    pixels: '像素创作',
    activity: '活跃度',
    special: '特殊成就'
  };

  static getCategoryText(category: string): string {
    return this.CATEGORY_MAP[category as keyof typeof this.CATEGORY_MAP] || category;
  }
}

// Export an instance for backward compatibility
export const achievementService = AchievementAPI;