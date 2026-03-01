import request from './request'
import type { PaginationResponse, PaginationParams } from '@/types'

export interface CustomFlagOrder {
  id: string
  user_id: string
  pattern_name: string
  pattern_description: string
  original_image_url: string
  status: string
  price: number
  admin_notes?: string
  created_at: string
  updated_at: string
  processed_at?: string
  processedByName?: string
  applicantName: string
  applicantAvatar?: string
  submittedAt: string
}

export interface GetCustomFlagOrdersParams extends PaginationParams {
  pattern_name?: string
  status?: string
}

export interface CustomFlagStats {
  total: number
  pending: number
  approved: number
  rejected: number
  approvalRate: string
}

export interface ApproveCustomFlagRequest {
  notes?: string
}

export interface RejectCustomFlagRequest {
  reason: string
}

export const customFlagService = {
  // 获取待审核自定义旗帜订单列表
  getPendingOrders: async (params: GetCustomFlagOrdersParams): Promise<PaginationResponse<CustomFlagOrder>> => {
    const response = await request.get('/admin/custom-flags/admin/orders', { params })
    return response.data
  },

  // 获取自定义旗帜统计数据
  getStats: async (): Promise<CustomFlagStats> => {
    try {
      // 获取所有订单来计算统计
      const response = await request.get('/admin/custom-flags/admin/orders')
      const orders = response.data.orders || []

      const total = orders.length
      const pending = orders.filter((order: any) => order.status === 'pending').length
      const approved = orders.filter((order: any) => order.status === 'approved').length
      const rejected = orders.filter((order: any) => order.status === 'rejected').length
      const approvalRate = total > 0 ? ((approved / total) * 100).toFixed(1) : '0'

      return {
        total,
        pending,
        approved,
        rejected,
        approvalRate
      }
    } catch (error) {
      // 如果API调用失败，返回默认值
      return {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        approvalRate: '0'
      }
    }
  },

  // 获取订单详情
  getOrderDetail: async (id: string): Promise<CustomFlagOrder> => {
    const response = await request.get(`/admin/custom-flags/orders/${id}`)
    return response.data
  },

  // 批准自定义旗帜
  approveOrder: async (id: string, data: ApproveCustomFlagRequest): Promise<void> => {
    await request.post(`/admin/custom-flags/admin/review`, {
      orderId: id,
      action: 'approve',
      notes: data.notes
    })
  },

  // 拒绝自定义旗帜
  rejectOrder: async (id: string, data: RejectCustomFlagRequest): Promise<void> => {
    await request.post(`/admin/custom-flags/admin/review`, {
      orderId: id,
      action: 'reject',
      reason: data.reason
    })
  },

  // 获取所有自定义旗帜订单（包括已处理）
  getAllOrders: async (params: GetCustomFlagOrdersParams): Promise<PaginationResponse<CustomFlagOrder>> => {
    const response = await request.get('/admin/custom-flags/admin/orders', { params })
    return response.data
  }
}

export default customFlagService