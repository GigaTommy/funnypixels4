import request from './request'

export interface CheckinRewardConfig {
  id: string
  config_type: string
  day_number?: number
  min_day?: number
  max_day?: number
  reward_points: number
  multiplier: number
  bonus_points: number
  reward_items: any[]
  description?: string
  is_active: boolean
  priority: number
  created_at: string
  updated_at: string
}

export interface CheckinStats {
  today_checkins: number
  max_streak: number
  avg_streak: string
  total_configs: number
  active_configs: number
}

export interface RewardPreview {
  day: number
  rewardPoints: number
  multiplier: number
  bonusReward: number
  rewardItems: any[]
}

export const checkinService = {
  getConfigs: async (params: any) => {
    const response = await request.get('/admin/checkin/configs', { params })
    return response.data.data
  },

  createConfig: async (data: any) => {
    const response = await request.post('/admin/checkin/configs', data)
    return response.data.data
  },

  updateConfig: async (id: string, data: any) => {
    const response = await request.put(`/admin/checkin/configs/${id}`, data)
    return response.data.data
  },

  deleteConfig: async (id: string) => {
    const response = await request.delete(`/admin/checkin/configs/${id}`)
    return response.data
  },

  getStats: async (): Promise<CheckinStats> => {
    const response = await request.get('/admin/checkin/stats')
    return response.data.data
  },

  previewReward: async (days?: number): Promise<RewardPreview[]> => {
    const response = await request.get('/admin/checkin/preview', { params: { days } })
    return response.data.data
  },
}

export default checkinService
