import request from './request'
import type { PaginationParams, PaginationResponse } from '@/types'

export interface Report {
  id: string
  reporter_id: string
  reporter_username: string
  reporter_nickname: string
  reported_id: string
  reported_type: 'pixel' | 'user' | 'advertisement' | 'comment' | 'alliance'
  reason: string
  description: string
  status: 'pending' | 'investigating' | 'resolved' | 'dismissed'
  admin_notes?: string
  evidence_urls?: string[]
  created_at: string
  updated_at: string
  resolved_at?: string
  resolved_by?: string
}

export interface GetReportsParams extends PaginationParams {
  status?: 'pending' | 'investigating' | 'resolved' | 'dismissed'
  reported_type?: 'pixel' | 'user' | 'advertisement' | 'comment' | 'alliance'
  reason?: string
  reporter_id?: string
  start_date?: string
  end_date?: string
}

export interface UpdateReportData {
  status: 'investigating' | 'resolved' | 'dismissed'
  admin_notes?: string
}

export const reportService = {
  // 获取举报列表
  getReports: async (params: GetReportsParams): Promise<PaginationResponse<Report>> => {
    const response = await request.get('/reports/admin/list', { params })
    return response.data.data
  },

  // 获取举报详情
  getReportById: async (id: string): Promise<Report> => {
    const response = await request.get(`/reports/admin/${id}`)
    return response.data.data
  },

  // 更新举报状态
  updateReport: async (id: string, data: UpdateReportData): Promise<Report> => {
    // 映射到 resolve 接口 (后端 ReportController.resolveReport)
    const response = await request.put(`/reports/admin/${id}/resolve`, {
      resolution: data.status === 'dismissed' ? 'rejected' : 'resolved',
      adminNote: data.admin_notes
    })
    return response.data.data
  },

  // 获取举报统计
  getReportStats: async (): Promise<{
    total: number
    pending: number
    investigating: number
    resolved: number
    dismissed: number
    by_type: Record<string, number>
    recent_trend: Array<{ date: string; count: number }>
  }> => {
    const response = await request.get('/reports/admin/statistics')
    return response.data.data
  }
}

export default reportService