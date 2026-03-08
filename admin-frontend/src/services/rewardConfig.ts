import request from './request'

export interface RewardConfigItem {
  config_key: string
  config_value: string
  description: string
}

export const rewardConfigService = {
  /** Fetch all reward / rate-limit / reconciliation configs */
  getAll: async (): Promise<RewardConfigItem[]> => {
    const response = await request.get('/system-config/reward-config')
    return response.data.data
  },

  /** Batch update configs */
  update: async (configs: Record<string, string | number>) => {
    const response = await request.put('/system-config/reward-config', { configs })
    return response.data
  },

  /** Force refresh backend in-memory cache */
  refreshCache: async () => {
    const response = await request.post('/system-config/reward-config/refresh')
    return response.data
  },
}
