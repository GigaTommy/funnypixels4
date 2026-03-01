import { api } from './api';
import { logger } from '../utils/logger';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'global' | 'system' | 'alliance';
  alliance_id?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateAnnouncementData {
  title: string;
  content: string;
  type: 'global' | 'system' | 'alliance';
  alliance_id?: string;
}

export class AnnouncementAPI {
  // 获取全局公告列表
  static async getGlobalAnnouncements(limit = 10, offset = 0) {
    const response = await api.get(`/announcements/global?limit=${limit}&offset=${offset}`);
    return response.data;
  }

  // 获取系统公告列表
  static async getSystemAnnouncements(limit = 10, offset = 0) {
    const response = await api.get(`/announcements/system?limit=${limit}&offset=${offset}`);
    return response.data;
  }

  // 获取联盟公告列表
  static async getAllianceAnnouncements(allianceId: string, limit = 10, offset = 0) {
    const response = await api.get(`/announcements/alliance/${allianceId}?limit=${limit}&offset=${offset}`);
    return response.data;
  }

  // 获取用户可见的所有公告（全局 + 系统 + 联盟）
  static async getAllAnnouncements(limit = 50, offset = 0) {
    try {
      const response = await api.get(`/announcements?limit=${limit}&offset=${offset}`);
      return response.data;
    } catch (error) {
      logger.error('获取公告失败:', error);
      return {
        success: false,
        data: [],
        message: '获取公告失败'
      };
    }
  }

  // 获取公告详情
  static async getAnnouncement(id: string) {
    const response = await api.get(`/announcements/${id}`);
    return response.data;
  }

  // 创建公告
  static async createAnnouncement(data: CreateAnnouncementData) {
    const response = await api.post('/announcements', data);
    return response.data;
  }

  // 更新公告
  static async updateAnnouncement(id: string, data: Partial<CreateAnnouncementData>) {
    const response = await api.put(`/announcements/${id}`, data);
    return response.data;
  }

  // 删除公告
  static async deleteAnnouncement(id: string) {
    const response = await api.delete(`/announcements/${id}`);
    return response.data;
  }
}
