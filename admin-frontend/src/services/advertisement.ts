import request from './request'
import type { PaginationParams, PaginationResponse } from '@/types'

export interface Advertisement {
  id: string
  user_id: string
  title: string
  description: string
  image_url: string
  lat: number
  lng: number
  grid_id: string
  width: number
  height: number
  type: string
  budget?: number
  price?: number
  start_time: string
  end_time: string
  repeat_count: number
  status: 'pending' | 'approved' | 'rejected' | 'expired'
  created_at: string
  updated_at: string
  username?: string
  nickname?: string
  admin_notes?: string
  processed_at?: string
  processedByName?: string
}

export interface GetAdvertisementsParams extends PaginationParams {
  status?: 'pending' | 'approved' | 'rejected' | 'expired'
  user_id?: string
  title?: string
}

export interface ApproveAdRequest {
  id: string
  status: 'approved' | 'rejected'
  rejectReason?: string
  notes?: string
}

const mapOrder = (order: any) => ({
  ...order,
  title: order.adTitle || order.title,
  description: order.adDescription || order.description,
  image_url: order.originalImageUrl || order.image_url,
  user_id: order.user?.id || order.user_id,
  username: order.user?.username || order.username,
  nickname: order.user?.displayName || order.nickname,
  price: order.price,
  admin_notes: order.adminNotes || order.admin_notes,
  processed_at: order.processedAt || order.processed_at,
  processedByName: order.processedByName,
  submittedAt: order.createdAt,
  targetLocation: order.targetLocation,
  scheduledTime: order.scheduledTime,
})

export const advertisementService = {
  // 获取广告列表（支持状态筛选）
  getPendingAds: async (params?: PaginationParams & {
    title?: string
    user_id?: string
    status?: 'pending' | 'approved' | 'rejected'
  }): Promise<PaginationResponse<Advertisement>> => {
    const response = await request.get('/ads/admin/orders/pending', { params })
    const orders = (response.data.orders || []).map(mapOrder)
    return {
      list: orders,
      total: response.data.total || orders.length,
      current: response.data.current || params?.current || 1,
      pageSize: response.data.pageSize || params?.pageSize || 10
    }
  },

  // 获取广告详情
  getAdById: async (id: string): Promise<Advertisement> => {
    const response = await request.get(`/ads/orders/${id}`)
    const order = response.data.order || response.data
    return {
      ...order,
      title: order.adTitle || order.title,
      description: order.adDescription || order.description,
      image_url: order.originalImageUrl || order.image_url,
    }
  },

  // 审批广告
  approveAd: async (data: ApproveAdRequest): Promise<void> => {
    const { id, status, rejectReason, notes } = data
    if (status === 'approved') {
      await request.post(`/ads/admin/orders/${id}/review`, { action: 'approve', notes })
    } else {
      await request.post(`/ads/admin/orders/${id}/review`, { action: 'reject', reason: rejectReason })
    }
  },

  // 强制下架广告
  takedownAd: async (id: string, reason: string): Promise<void> => {
    await request.post(`/ads/admin/orders/${id}/review`, { action: 'reject', reason })
  },

  // 获取所有广告列表
  getAllAds: async (params?: GetAdvertisementsParams): Promise<PaginationResponse<Advertisement>> => {
    const response = await request.get('/ads/admin/orders/pending', { params })
    const orders = (response.data.orders || []).map(mapOrder)
    return {
      list: orders,
      total: response.data.total || orders.length,
      current: response.data.current || params?.current || 1,
      pageSize: response.data.pageSize || params?.pageSize || 10
    }
  },
}

export default advertisementService
