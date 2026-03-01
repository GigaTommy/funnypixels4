import request from './request'
import type { PaginationParams, PaginationResponse } from '@/types'

export interface Alliance {
  id: string
  name: string
  description?: string
  leader_id: string
  leader_name?: string
  member_count: number
  max_members: number
  status: 'active' | 'inactive' | 'disbanded'
  created_at: string
  updated_at: string
  badge?: string
  motto?: string
  announcement?: string
}

export interface AllianceMember {
  id: string
  alliance_id: string
  user_id: string
  role: 'leader' | 'member' | 'officer'
  joined_at: string
  username: string
  nickname: string
  avatar_url?: string
  user_role: string
}

export interface AllianceModerationLog {
  id: string
  alliance_id: string
  admin_id: string
  admin_name: string
  action: string
  target_user_id?: string
  reason?: string
  metadata?: any
  created_at: string
}

export interface AllianceDetail {
  alliance: Alliance
  members: AllianceMember[]
  moderation_logs: AllianceModerationLog[]
}

export interface GetAlliancesParams extends PaginationParams {
  name?: string
  status?: 'active' | 'inactive' | 'disbanded'
}

export const allianceService = {
  // 获取联盟列表
  getAlliances: async (params: GetAlliancesParams): Promise<PaginationResponse<Alliance>> => {
    const response = await request.get('/admin/alliances', { params })
    return response.data.data
  },

  // 获取联盟成员列表
  getAllianceMembers: async (allianceId: string, params: PaginationParams): Promise<PaginationResponse<AllianceMember>> => {
    const response = await request.get(`/admin/alliances/${allianceId}/members`, { params })
    return response.data.data
  },

  // 获取联盟详情（含成员和管控日志）
  getDetail: async (id: string): Promise<AllianceDetail> => {
    const response = await request.get(`/admin/alliances-mod/${id}/detail`)
    return response.data.data
  },

  // 管理员编辑联盟
  adminEdit: async (id: string, data: Partial<Alliance>) => {
    const response = await request.put(`/admin/alliances-mod/${id}/edit`, data)
    return response.data.data
  },

  // 警告联盟
  adminWarn: async (id: string, reason: string) => {
    const response = await request.post(`/admin/alliances-mod/${id}/warn`, { reason })
    return response.data.data
  },

  // 暂停联盟
  adminSuspend: async (id: string, reason: string) => {
    const response = await request.post(`/admin/alliances-mod/${id}/suspend`, { reason })
    return response.data.data
  },

  // 封禁联盟
  adminBan: async (id: string, reason: string) => {
    const response = await request.post(`/admin/alliances-mod/${id}/ban`, { reason })
    return response.data.data
  },

  // 解封联盟
  adminUnban: async (id: string) => {
    const response = await request.post(`/admin/alliances-mod/${id}/unban`)
    return response.data.data
  },

  // 解散联盟
  adminDisband: async (id: string, reason: string) => {
    const response = await request.post(`/admin/alliances-mod/${id}/disband`, { reason })
    return response.data
  },

  // 踢出成员
  adminKick: async (allianceId: string, userId: string, reason: string) => {
    const response = await request.post(`/admin/alliances-mod/${allianceId}/kick/${userId}`, { reason })
    return response.data
  },

  // 获取管控日志
  getModerationLogs: async (id: string, params?: PaginationParams) => {
    const response = await request.get(`/admin/alliances-mod/${id}/moderation-logs`, { params })
    return response.data.data
  },
}

export default allianceService