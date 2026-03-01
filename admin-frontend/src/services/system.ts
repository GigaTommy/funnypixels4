import request from './request'
import type {
  SystemSettings,
  SystemLog,
  SystemMetrics,
  GetSystemLogsParams,
  PaginationResponse
} from '@/types'

export const systemService = {
  // 系统设置相关接口
  settings: {
    // 获取系统设置
    getSettings: async (): Promise<SystemSettings> => {
      // 映射到系统配置列表
      const response = await request.get('/admin/system-config/configs')
      return response.data.data
    },

    // 更新系统设置
    updateSettings: async (data: Partial<SystemSettings>): Promise<SystemSettings> => {
      // 批量更新配置
      const response = await request.put('/admin/system-config/configs', { configs: [data] })
      return response.data.data
    },
  },

  // 日志管理相关接口
  logs: {
    // 获取系统日志
    getLogs: async (params?: GetSystemLogsParams): Promise<PaginationResponse<SystemLog>> => {
      const response = await request.get('/admin/system/logs', { params })
      return response.data.data
    },
  },

  // 性能监控相关接口
  metrics: {
    // 获取系统指标
    getMetrics: async (): Promise<SystemMetrics> => {
      const response = await request.get('/admin/system/metrics')
      return response.data.data
    },
  },
}

export default systemService