import { api } from './api';
import { logger } from '../utils/logger';

export interface Region {
  id: string;
  name: string;
  code: string;
  center_lat: number;
  center_lng: number;
  radius: number;
  description?: string;
  flag: string;
  color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RegionLeaderboardEntry extends Region {
  rank: number;
  user_count: number;
  pixel_count: number;
  alliance_count: number;
  score: number;
}

export interface RegionStats {
  user_count: number;
  pixel_count: number;
  alliance_count: number;
  active_users: Array<{
    id: string;
    username: string;
    avatar_url?: string;
    total_pixels: number;
  }>;
  active_alliances: Array<{
    id: string;
    name: string;
    flag: string;
    color: string;
    member_count: number;
    total_pixels: number;
  }>;
}

export interface RegionWithStats extends Region {
  stats: RegionStats;
}

export class RegionAPI {
  // 获取所有地区列表
  static async getAllRegions(): Promise<Region[]> {
    const response = await api.get('/regions');
    return response.data.regions;
  }

  // 获取地区详情
  static async getRegionDetails(id: string): Promise<Region> {
    const response = await api.get(`/regions/${id}`);
    return response.data.region;
  }

  // 获取地区排行榜
  static async getRegionLeaderboard(period: string = 'all'): Promise<RegionLeaderboardEntry[]> {
    const response = await api.get(`/regions/leaderboard?period=${period}`);
    return response.data.regions;
  }

  // 获取地区详情（包含统计数据）
  static async getRegionDetailsWithStats(id: string): Promise<RegionWithStats> {
    const response = await api.get(`/regions/${id}/stats`);
    return response.data.region;
  }

  // 根据坐标查找最近的地区
  static async findNearestRegion(lat: number, lng: number): Promise<Region | null> {
    try {
      const regions = await this.getAllRegions();
      
      let nearestRegion: Region | null = null;
      let minDistance = Infinity;
      
      for (const region of regions) {
        const distance = this.calculateDistance(lat, lng, region.center_lat, region.center_lng);
        if (distance <= region.radius && distance < minDistance) {
          minDistance = distance;
          nearestRegion = region;
        }
      }
      
      return nearestRegion;
    } catch (error) {
      logger.error('查找最近地区失败:', error);
      return null;
    }
  }

  // 计算两点之间的距离（公里）
  private static calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // 地球半径（公里）
    const dLat = this.deg2rad(lat2 - lat1);
    const dLng = this.deg2rad(lng2 - lng1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private static deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }
}
