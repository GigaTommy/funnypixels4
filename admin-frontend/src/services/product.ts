import request from './request'

export interface Product {
  id: number
  name: string
  description?: string
  price: number
  currency: 'coins' | 'gems' | 'points'
  item_type?: string
  item_id?: number
  image_url?: string
  category?: string
  type?: string
  pattern_id?: number
  active: boolean
  verified: boolean
  is_available: boolean
  sort_order: number
  metadata?: any
  created_at: string
  updated_at: string
}

export interface AdProduct {
  id: number
  name: string
  description?: string
  price: number
  width: number
  height: number
  duration: number
  active: boolean
  created_at: string
  updated_at: string
}

export interface GetProductsParams {
  current?: number
  pageSize?: number
  category?: string
  type?: string
  currency?: string
  active?: boolean
  keyword?: string
}

export interface CreateProductRequest {
  name: string
  description?: string
  price: number
  currency: 'coins' | 'gems' | 'points'
  item_type?: string
  item_id?: number
  image_url?: string
  category?: string
  type?: string
  pattern_id?: number
  active?: boolean
  verified?: boolean
  sort_order?: number
  metadata?: any
}

export interface UpdateProductRequest extends Partial<CreateProductRequest> {
  is_available?: boolean
}

export interface CreateAdProductRequest {
  name: string
  description?: string
  price: number
  width: number
  height: number
  duration: number
  active?: boolean
}

export const productService = {
  /**
   * 获取商品列表
   */
  getProducts: (params?: GetProductsParams) => {
    return request.get<{
      success: boolean
      data: {
        list: Product[]
        total: number
        current: number
        pageSize: number
      }
    }>('/admin/products', { params })
  },

  /**
   * 获取商品详情
   */
  getProductById: (id: number) => {
    return request.get<{
      success: boolean
      data: Product
    }>(`/admin/products/${id}`)
  },

  /**
   * 创建商品
   */
  createProduct: (data: CreateProductRequest) => {
    return request.post<{
      success: boolean
      message: string
      data: Product
    }>('/admin/products', data)
  },

  /**
   * 更新商品
   */
  updateProduct: (id: number, data: UpdateProductRequest) => {
    return request.put<{
      success: boolean
      message: string
      data: Product
    }>(`/admin/products/${id}`, data)
  },

  /**
   * 删除商品
   */
  deleteProduct: (id: number) => {
    return request.delete<{
      success: boolean
      message: string
    }>(`/admin/products/${id}`)
  },

  /**
   * 批量更新商品状态
   */
  batchUpdateStatus: (ids: number[], active: boolean) => {
    return request.post<{
      success: boolean
      message: string
    }>('/admin/products/batch/status', { ids, active })
  },

  /**
   * 获取商品分类列表
   */
  getCategories: () => {
    return request.get<{
      success: boolean
      data: string[]
    }>('/admin/products/categories')
  },

  /**
   * 获取广告商品列表
   */
  getAdProducts: (params?: { current?: number; pageSize?: number; active?: boolean; keyword?: string }) => {
    return request.get<{
      success: boolean
      data: {
        list: AdProduct[]
        total: number
        current: number
        pageSize: number
      }
    }>('/admin/products/ad/list', { params })
  },

  /**
   * 创建广告商品
   */
  createAdProduct: (data: CreateAdProductRequest) => {
    return request.post<{
      success: boolean
      message: string
      data: AdProduct
    }>('/admin/products/ad', data)
  },

  /**
   * 更新广告商品
   */
  updateAdProduct: (id: number, data: Partial<CreateAdProductRequest>) => {
    return request.put<{
      success: boolean
      message: string
      data: AdProduct
    }>(`/admin/products/ad/${id}`, data)
  },

  /**
   * 删除广告商品
   */
  deleteAdProduct: (id: number) => {
    return request.delete<{
      success: boolean
      message: string
    }>(`/admin/products/ad/${id}`)
  }
}
