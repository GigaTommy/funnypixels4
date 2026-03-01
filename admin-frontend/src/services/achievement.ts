import request from './request'

export interface Achievement {
  id: string
  name: string
  description: string
  icon_url?: string
  category: string
  type: string
  requirement: number
  reward_points: number
  reward_items: any[]
  repeat_cycle: string
  display_priority: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AchievementStats {
  total: number
  active: number
  category_stats: Array<{ category: string; count: number }>
  total_completions: number
  unique_users: number
}

export const achievementService = {
  getList: async (params: any) => {
    const response = await request.get('/admin/achievements', { params })
    return response.data.data
  },

  getById: async (id: string) => {
    const response = await request.get(`/admin/achievements/${id}`)
    return response.data.data
  },

  create: async (data: any) => {
    const response = await request.post('/admin/achievements', data)
    return response.data.data
  },

  update: async (id: string, data: any) => {
    const response = await request.put(`/admin/achievements/${id}`, data)
    return response.data.data
  },

  delete: async (id: string) => {
    const response = await request.delete(`/admin/achievements/${id}`)
    return response.data
  },

  toggleActive: async (id: string) => {
    const response = await request.put(`/admin/achievements/${id}/toggle`)
    return response.data.data
  },

  getStats: async (): Promise<AchievementStats> => {
    const response = await request.get('/admin/achievements/stats')
    return response.data.data
  },
}

export default achievementService
