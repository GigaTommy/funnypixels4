import request from './request'
import type { User, CreateUserRequest, UpdateUserRequest, PaginationParams, PaginationResponse, DashboardStats } from '@/types'

export const userService = {
  // 获取用户统计（复用Dashboard统计接口 + 封禁用户统计）
  getUserStats: async (): Promise<DashboardStats & { bannedUsers: number }> => {
    const { dashboardService } = await import('./dashboard')
    const [dashboardStats, bannedResponse] = await Promise.all([
      dashboardService.getStats(),
      request.get('/admin/users/banned-count')
    ])

    return {
      ...dashboardStats,
      bannedUsers: bannedResponse.data.data?.bannedUsers || 0
    }
  },

  // 获取用户列表
  getUsers: async (params?: PaginationParams & {
    nickname?: string
    phone?: string
    status?: string
    role?: string
    user_id?: string
    email?: string
  }): Promise<PaginationResponse<User>> => {
    const response = await request.get('/admin/users', { params })
    return response.data.data
  },

  // 获取基础用户信息
  getUserById: async (id: string): Promise<User> => {
    const response = await request.get(`/admin/users/${id}`)
    return response.data.data
  },

  // 获取完整用户 360 视图详情
  getUserDetails: async (id: string): Promise<{
    user: User & {
      ban_type?: string;
      ban_reason?: string;
      ban_expires_at?: string;
    };
    wallet: {
      points: number;
      current_points: number;
      total_earned: number;
      total_spent: number;
      total_transactions: number;
      recent_ledger: any[];
    };
    alliance: {
      id: string;
      name: string;
      role: string;
      joined_at: string;
    } | null;
  }> => {
    const response = await request.get(`/admin/users/${id}/details`)
    return response.data.data
  },

  // 获取用户流水
  getUserTransactions: async (id: string, params?: PaginationParams & { type?: string; startDate?: string; endDate?: string }): Promise<PaginationResponse<any>> => {
    const response = await request.get(`/admin/users/${id}/transactions`, { params })
    return response.data.data
  },

  // 获取用户日志
  getUserLogs: async (id: string): Promise<any[]> => {
    const response = await request.get(`/admin/users/${id}/logs`)
    return response.data.data
  },

  // 创建用户
  createUser: async (data: CreateUserRequest): Promise<User> => {
    const response = await request.post('/admin/users', data)
    return response.data.data
  },

  // 更新用户
  updateUser: async (id: string | number, data: UpdateUserRequest): Promise<User> => {
    const response = await request.put(`/admin/users/${id}`, data)
    return response.data.data
  },

  // 删除用户
  deleteUser: async (id: string | number): Promise<void> => {
    await request.delete(`/admin/users/${id}`)
  },

  // 切换用户状态 (基础)
  toggleUserStatus: async (id: string, status: 'active' | 'inactive' | 'banned'): Promise<void> => {
    await request.patch(`/admin/users/${id}/status`, { status })
  },

  // 精细化封禁用户
  banUser: async (id: string, data: {
    banType: 'none' | 'login' | 'chat' | 'draw';
    banReason: string;
    banDuration: string | number; // 'permanent' or minutes
  }): Promise<void> => {
    await request.post(`/admin/users/${id}/ban`, data)
  },
}

export default userService