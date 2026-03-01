import request from './request'

export interface UserFeedback {
  id: string
  user_id: string
  type: string
  title: string
  content: string
  screenshots: string[]
  app_version?: string
  device_info?: string
  status: string
  priority: string
  assigned_to?: string
  admin_reply?: string
  replied_at?: string
  resolved_at?: string
  created_at: string
  updated_at: string
  username?: string
  nickname?: string
  avatar_url?: string
  assigned_name?: string
}

export interface FeedbackStats {
  pending: number
  in_progress: number
  resolved: number
  closed: number
  today_resolved: number
  avg_response_hours: string
  type_stats: Array<{ type: string; count: number }>
}

export const feedbackService = {
  getList: async (params: any) => {
    const response = await request.get('/admin/feedback', { params })
    return response.data.data
  },

  getById: async (id: string): Promise<UserFeedback> => {
    const response = await request.get(`/admin/feedback/${id}`)
    return response.data.data
  },

  reply: async (id: string, reply: string) => {
    const response = await request.post(`/admin/feedback/${id}/reply`, { reply })
    return response.data.data
  },

  updateStatus: async (id: string, data: { status?: string; priority?: string }) => {
    const response = await request.put(`/admin/feedback/${id}/status`, data)
    return response.data.data
  },

  delete: async (id: string) => {
    const response = await request.delete(`/admin/feedback/${id}`)
    return response.data
  },

  getStats: async (): Promise<FeedbackStats> => {
    const response = await request.get('/admin/feedback/stats')
    return response.data.data
  },
}

export default feedbackService
