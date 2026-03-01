import request from './request'

export interface ChallengeTemplate {
  id: string
  type: string
  title: string
  description: string
  target_value: number
  reward_points: number
  reward_items: any[]
  weight: number
  difficulty: string
  is_active: boolean
  metadata: any
  created_at: string
  updated_at: string
}

export interface ChallengeStats {
  total: number
  active: number
  today_completed: number
  type_stats: Array<{ type: string; count: number }>
}

export const challengeService = {
  getTemplates: async (params: any) => {
    const response = await request.get('/admin/challenges/templates', { params })
    return response.data.data
  },

  getTemplateById: async (id: string) => {
    const response = await request.get(`/admin/challenges/templates/${id}`)
    return response.data.data
  },

  createTemplate: async (data: any) => {
    const response = await request.post('/admin/challenges/templates', data)
    return response.data.data
  },

  updateTemplate: async (id: string, data: any) => {
    const response = await request.put(`/admin/challenges/templates/${id}`, data)
    return response.data.data
  },

  deleteTemplate: async (id: string) => {
    const response = await request.delete(`/admin/challenges/templates/${id}`)
    return response.data
  },

  toggleActive: async (id: string) => {
    const response = await request.put(`/admin/challenges/templates/${id}/toggle`)
    return response.data.data
  },

  getStats: async (): Promise<ChallengeStats> => {
    const response = await request.get('/admin/challenges/templates/stats')
    return response.data.data
  },
}

export default challengeService
