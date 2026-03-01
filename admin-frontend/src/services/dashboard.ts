import request from './request'
import type { DashboardStats, RecentActivitiesResponse } from '@/types'

export const dashboardService = {
  // 获取Dashboard统计数据
  getStats: async (): Promise<DashboardStats> => {
    const response = await request.get('/admin/dashboard/stats')
    return response.data.data
  },

  // 获取最近活动
  getRecentActivities: async (): Promise<RecentActivitiesResponse> => {
    const response = await request.get('/admin/dashboard/recent-activities')
    return response.data.data
  },
}

export default dashboardService