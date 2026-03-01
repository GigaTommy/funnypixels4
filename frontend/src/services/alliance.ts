import { api } from './api';

export interface Alliance {
  id: string;
  name: string;
  description?: string;
  flag_pattern_id: string;
  flag_pattern_anchor_x: number;
  flag_pattern_anchor_y: number;
  flag_pattern_rotation: number;
  flag_pattern_mirror: boolean;
  banner_url?: string;
  leader_id: string;
  member_count: number;
  max_members: number;
  is_public: boolean;
  approval_required: boolean;
  created_at: string;
  user_role?: 'leader' | 'admin' | 'member';
}

export interface AllianceMember {
  id: string;
  username: string;
  avatar_url?: string;
  avatar?: string;
  role: 'leader' | 'admin' | 'member';
  joined_at: string;
  last_active_at: string;
}

export interface CreateAllianceData {
  name: string;
  description?: string;
  flagPatternId: string;
  is_public?: boolean;
  approval_required?: boolean;
}

export interface UpdateAllianceData {
  name?: string;
  description?: string;
  flagPatternId?: string;
  banner_url?: string;
  is_public?: boolean;
  approval_required?: boolean;
}

export class AllianceAPI {
  // 创建联盟
  static async createAlliance(data: CreateAllianceData): Promise<{ success: boolean; alliance: Alliance; message: string }> {
    const response = await api.post('/alliances', data);
    return response.data;
  }

  // 搜索联盟
  static async searchAlliances(query: string, limit: number = 20, offset: number = 0): Promise<{
    success: boolean;
    alliances: Alliance[];
    pagination: { limit: number; offset: number; total: number };
  }> {
    const response = await api.get('/alliances/search', {
      params: { q: query, limit, offset }
    });
    return response.data;
  }

  // 获取联盟详情
  static async getAllianceDetails(id: string): Promise<{
    success: boolean;
    alliance: Alliance;
    members: AllianceMember[];
  }> {
    const response = await api.get(`/alliances/${id}`);
    return response.data;
  }

  // 申请加入联盟
  static async applyToAlliance(id: string, message?: string): Promise<{ success: boolean; message: string }> {
    const response = await api.post(`/alliances/${id}/apply`, { message });
    return response.data;
  }

  // 获取用户所属联盟
  static async getUserAlliance(): Promise<{ success: boolean; alliance: Alliance | null; message?: string }> {
    const response = await api.get('/alliances/user/alliance');
    return response.data;
  }

  // 获取用户联盟图案信息
  static async getUserAlliancePattern(): Promise<{ success: boolean; pattern_id: string }> {
    const response = await api.get('/alliances/user/pattern');
    return response.data;
  }

  // 获取用户联盟旗帜信息
  static async getUserAllianceFlag(): Promise<{
    success: boolean;
    flag: {
      pattern_id: string;
      unicode_char?: string;
      render_type?: string;
      payload?: string;  // 添加payload字段，用于渲染complex图案
      encoding?: string;  // 添加encoding字段
      anchor_x: number;
      anchor_y: number;
      rotation?: number;
      mirror?: boolean;
      pattern_info?: any;  // 添加pattern_info字段
    };
  }> {
    const response = await api.get('/alliances/user/flag');
    return response.data;
  }

  // 获取可用的联盟旗帜图案
  static async getAvailableFlagPatterns(): Promise<{
    success: boolean;
    patterns: Array<{
      id?: number;
      pattern_id: string;
      name: string;
      description: string;
      image_url?: string;
      category: string;
      tags?: string[];
      is_owned: boolean;
      is_free: boolean;
      price: number;
    }>;
    total: number;
  }> {
    const response = await api.get('/alliances/flag-patterns');
    return response.data;
  }

  // 退出联盟
  static async leaveAlliance(): Promise<{ success: boolean; message: string }> {
    const response = await api.post('/alliances/leave');
    return response.data;
  }

  // 更新联盟信息
  static async updateAlliance(id: string, data: UpdateAllianceData): Promise<{ success: boolean; alliance: Alliance; message: string }> {
    const response = await api.put(`/alliances/${id}`, data);
    return response.data;
  }

  // 转让盟主
  static async transferLeadership(id: string, newLeaderId: string): Promise<{ success: boolean; message: string }> {
    const response = await api.post(`/alliances/${id}/transfer-leadership`, { new_leader_id: newLeaderId });
    return response.data;
  }

  // 解散联盟
  static async disbandAlliance(id: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete(`/alliances/${id}`);
    return response.data;
  }

  // 加入联盟（使用联盟ID）
  static async joinAlliance(allianceId: string, message?: string): Promise<{ success: boolean; message: string }> {
    const response = await api.post(`/alliances/${allianceId}/join`, { message });
    return response.data;
  }

  // 获取联盟成员列表
  static async getAllianceMembers(allianceId: string): Promise<{
    success: boolean;
    members: AllianceMember[];
  }> {
    const response = await api.get(`/alliances/${allianceId}/members`);
    return response.data;
  }

  // 踢出成员
  static async kickMember(memberId: string): Promise<{ success: boolean; message: string }> {
    const response = await api.post(`/alliances/kick-member`, { memberId });
    return response.data;
  }

  // 更新成员角色
  static async updateMemberRole(allianceId: string, memberId: string, role: 'admin' | 'member'): Promise<{ success: boolean; message: string }> {
    const response = await api.post(`/alliances/${allianceId}/update-member-role`, { member_id: memberId, role });
    return response.data;
  }

  // 获取联盟排行榜
  static async getAllianceLeaderboard(period: 'daily' | 'weekly' | 'monthly' = 'weekly'): Promise<{
    success: boolean;
    leaderboard: Array<{
      id: string;
      name: string;
      flag?: string;
      memberCount: number;
      totalPixels: number;
      currentPixels: number;
      rank: number;
    }>;
  }> {
    const response = await api.get(`/alliances/leaderboard`, {
      params: { period }
    });
    return response.data;
  }

  // 获取联盟统计数据
  static async getAllianceStats(allianceId: string): Promise<{
    success: boolean;
    stats: {
      totalPixels: number;
      currentPixels: number;
      memberCount: number;
      territory: number;
      rank: number;
    };
  }> {
    const response = await api.get(`/alliances/${allianceId}/stats`);
    return response.data;
  }

  // 获取申请列表
  static async getApplications(allianceId: string): Promise<{
    success: boolean;
    applications: Array<{
      id: string;
      user_id: string;
      username: string;
      message: string;
      created_at: string;
      status: 'pending' | 'approved' | 'rejected';
    }>;
  }> {
    const response = await api.get(`/alliances/${allianceId}/applications`);
    return response.data;
  }

  // 审批申请
  static async reviewApplication(applicationId: string, action: 'approve' | 'reject', message?: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const response = await api.post(`/alliances/review-application`, {
      application_id: applicationId,
      action,
      message
    });
    return response.data;
  }

  // 生成邀请链接
  static async generateInviteLink(allianceId: string): Promise<{
    success: boolean;
    data: {
      invite_link: string;
      invite_code: string;
      expires_at: string;
      alliance_name: string;
    };
    message: string;
  }> {
    const response = await api.post(`/alliances/${allianceId}/invite`);
    return response.data;
  }
}
