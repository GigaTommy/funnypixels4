import request from './request'
import type {
  UserAnalytics,
  ContentAnalytics,
  RevenueAnalytics,
  PaginationResponse
} from '@/types'

export const analyticsService = {
  // 用户分析相关接口
  userAnalytics: {
    // 获取用户分析数据
    getUserAnalytics: async (params?: {
      start_date?: string
      end_date?: string
    }): Promise<UserAnalytics> => {
      // 暂时映射到通用统计接口
      const response = await request.get('/dashboard/stats', { params })
      const data = response.data.data

      // 映射后端 camelCase 到前端 snake_case
      return {
        total_users: data.totalUsers || 0,
        active_users: data.activeUsers || 0,
        new_users_today: data.todayUsers || 0,
        new_users_week: data.newUsersWeek || 0,
        user_growth_rate: data.userGrowthRate || 0,
        daily_active_users: data.dailyNewUsers || [], // 暂时用日新增代替日活跃
        user_role_distribution: data.userRoleDistribution || []
      }
    },
  },

  // 内容分析相关接口
  contentAnalytics: {
    // 获取内容分析数据
    getContentAnalytics: async (params?: {
      start_date?: string
      end_date?: string
    }): Promise<ContentAnalytics> => {
      const response = await request.get('/dashboard/stats', { params })
      const data = response.data.data

      // 映射后端 camelCase 到前端 snake_case
      return {
        total_content: data.totalContent || 0,
        active_content: 0, // 暂无
        new_content_today: data.newContentToday || 0,
        content_growth_rate: data.contentGrowthRate || 0,
        average_views_per_content: data.averageViewsPerContent || 0,
        popular_content: data.popularContent || [],
        content_type_distribution: data.contentTypeDistribution || [],
        top_creators: data.topCreators || [],
        total_pixels: data.totalPixels || 0,
        active_pixels: data.activeUsers || 0, // 暂用活跃用户代替
        total_patterns: 0, // 暂无单独统计
        approved_patterns: 0, // 暂无
        pending_patterns: 0, // 暂无
        content_creation_rate: 0, // 暂无
        daily_content_stats: data.dailyContentStats || []
      }
    },
  },

  // 收入分析相关接口
  revenueAnalytics: {
    // 获取收入分析数据
    getRevenueAnalytics: async (params?: {
      start_date?: string
      end_date?: string
    }): Promise<RevenueAnalytics> => {
      const response = await request.get('/dashboard/stats', { params })
      const data = response.data.data

      // 映射后端 camelCase 到前端 snake_case
      return {
        total_revenue: data.totalRevenue || 0,
        month_revenue: data.monthRevenue || 0,
        revenue_growth_rate: data.revenueGrowthRate || 0,
        monthly_revenue: data.monthlyRevenue || [],
        revenue_by_source: data.revenueBySource || [],
        today_revenue: 0, // Placeholder
        week_revenue: 0, // Placeholder
      }
    },
  },
}

export default analyticsService