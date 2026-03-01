import request from './request'
import type { PaginationParams, PaginationResponse } from '@/types'

export interface PatternAsset {
  id: string
  name: string
  category: string
  type: string
  description?: string
  data: any
  thumbnail_url?: string
  creator_id?: string
  creator_name?: string
  is_public: boolean
  status: 'active' | 'inactive' | 'deleted'
  created_at: string
  updated_at: string
  used_count?: number
  file_size?: number
  width?: number
  height?: number
}

export interface GetPatternAssetsParams extends PaginationParams {
  category?: string
  type?: string
  name?: string
  status?: 'active' | 'inactive' | 'deleted'
}

export interface CreatePatternRequest {
  name: string
  category: string
  type: string
  description?: string
  data?: any
  is_public?: boolean
}

export interface UpdatePatternRequest {
  name?: string
  category?: string
  type?: string
  description?: string
  is_public?: boolean
  status?: 'active' | 'inactive' | 'deleted'
}

export const patternService = {
  // 获取图案资源列表
  getPatternAssets: async (params: GetPatternAssetsParams): Promise<PaginationResponse<PatternAsset>> => {
    const response = await request.get('/admin/pattern-assets', { params })
    return response.data.data
  },

  // 创建单个图案
  createPattern: async (data: CreatePatternRequest): Promise<PatternAsset> => {
    const response = await request.post('/admin/pattern-assets', data)
    return response.data.data
  },

  // 更新图案
  updatePattern: async (id: string, data: UpdatePatternRequest): Promise<PatternAsset> => {
    const response = await request.put(`/admin/pattern-assets/${id}`, data)
    return response.data.data
  },

  // 删除图案
  deletePattern: async (id: string): Promise<void> => {
    await request.delete(`/admin/pattern-assets/${id}`)
  },

  // 切换图案状态（上架/下架）
  togglePatternStatus: async (id: string, status: 'active' | 'inactive'): Promise<void> => {
    await request.patch(`/admin/pattern-assets/${id}/status`, { status })
  },

  // 切换图案公开/私有
  togglePatternPublic: async (id: string, is_public: boolean): Promise<void> => {
    await request.patch(`/admin/pattern-assets/${id}/public`, { is_public })
  },

  // 分析单个图案
  analyzePattern: async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    const response = await request.post('/admin/pattern-assets/analyze', formData)
    return response.data;
  },

  // 批量创建图案
  batchCreatePatterns: async (patterns: any[]) => {
    const response = await request.post('/admin/pattern-assets/batch', { patterns })
    return response.data;
  }
}

export default patternService