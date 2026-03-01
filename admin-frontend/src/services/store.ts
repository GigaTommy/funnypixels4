import request from './request'
import type {
  PaginationParams,
  PaginationResponse,
  CustomFlag,
  CreateCustomFlagRequest,
  UpdateCustomFlagRequest,
  GetCustomFlagsParams,
  Product,
  CreateProductRequest,
  UpdateProductRequest,
  GetProductsParams,
  StoreItem,
  CreateStoreItemRequest,
  UpdateStoreItemRequest,
  GetStoreItemsParams,
  Order,
  GetOrdersParams
} from '@/types'

export const storeService = {
  // 自定义旗帜相关接口
  customFlag: {
    // 获取自定义旗帜列表
    getList: async (params?: GetCustomFlagsParams): Promise<PaginationResponse<CustomFlag>> => {
      const response = await request.get('/admin/custom-flags', { params })
      return response.data.data
    },

    // 获取自定义旗帜详情
    getById: async (id: string): Promise<CustomFlag> => {
      const response = await request.get(`/admin/custom-flags/${id}`)
      return response.data.data
    },

    // 创建自定义旗帜
    create: async (data: CreateCustomFlagRequest): Promise<CustomFlag> => {
      const response = await request.post('/admin/custom-flags', data)
      return response.data.data
    },

    // 更新自定义旗帜
    update: async (id: string, data: UpdateCustomFlagRequest): Promise<CustomFlag> => {
      const response = await request.put(`/admin/custom-flags/${id}`, data)
      return response.data.data
    },

    // 删除自定义旗帜
    delete: async (id: string): Promise<void> => {
      await request.delete(`/admin/custom-flags/${id}`)
    },

    // 审批自定义旗帜
    approve: async (id: string, data: { status: 'approved' | 'rejected', reject_reason?: string }): Promise<void> => {
      await request.post(`/admin/custom-flags/approve/${id}`, data)
    },
  },

  // 商品管理相关接口
  product: {
    // 获取商品列表
    getList: async (params?: GetProductsParams): Promise<PaginationResponse<Product>> => {
      const response = await request.get('/admin/products', { params })
      return response.data.data
    },

    // 获取商品详情
    getById: async (id: string): Promise<Product> => {
      const response = await request.get(`/admin/products/${id}`)
      return response.data.data
    },

    // 创建商品
    create: async (data: CreateProductRequest): Promise<Product> => {
      const response = await request.post('/admin/products', data)
      return response.data.data
    },

    // 更新商品
    update: async (id: string, data: UpdateProductRequest): Promise<Product> => {
      const response = await request.put(`/admin/products/${id}`, data)
      return response.data.data
    },

    // 删除商品
    delete: async (id: string): Promise<void> => {
      await request.delete(`/admin/products/${id}`)
    },

    // 批量更新商品状态
    batchUpdateStatus: async (ids: string[], active: boolean): Promise<void> => {
      await request.post('/admin/products/batch-update-status', { ids, active })
    },
  },

  // store_items 商品管理相关接口
  storeItem: {
    // 获取商店商品列表
    getList: async (params?: GetStoreItemsParams): Promise<PaginationResponse<StoreItem>> => {
      const response = await request.get('/admin/products/store/list', { params })
      return response.data.data
    },

    // 获取商店商品详情
    getById: async (id: string): Promise<StoreItem> => {
      const response = await request.get(`/admin/products/store/${id}`)
      return response.data.data
    },

    // 创建商店商品
    create: async (data: CreateStoreItemRequest): Promise<StoreItem> => {
      const response = await request.post('/admin/products/store', data)
      return response.data.data
    },

    // 更新商店商品
    update: async (id: string, data: UpdateStoreItemRequest): Promise<StoreItem> => {
      const response = await request.put(`/admin/products/store/${id}`, data)
      return response.data.data
    },

    // 删除商店商品
    delete: async (id: string): Promise<void> => {
      await request.delete(`/admin/products/store/${id}`)
    },

    // 批量更新商店商品状态
    batchUpdateStatus: async (ids: string[], active: boolean): Promise<void> => {
      await request.post('/admin/products/store/batch/status', { ids, active })
    },

    // 获取商店商品类型列表
    getTypes: async (): Promise<string[]> => {
      const response = await request.get('/admin/products/store/types')
      return response.data.data
    },
  },

  // 订单管理相关接口
  order: {
    // 获取订单列表
    getList: async (params?: GetOrdersParams): Promise<PaginationResponse<Order>> => {
      const response = await request.get('/admin/store-orders', { params })
      return response.data.data
    },

    // 获取订单详情
    getById: async (id: string): Promise<Order> => {
      const response = await request.get(`/admin/store-orders/${id}`)
      return response.data.data
    },

    // 更新订单状态
    updateStatus: async (id: string, status: Order['status']): Promise<Order> => {
      const response = await request.put(`/admin/store-orders/${id}/status`, { status })
      return response.data.data
    },

    // 发货
    ship: async (id: string, tracking_number?: string): Promise<void> => {
      await request.post(`/admin/store-orders/${id}/ship`, { tracking_number })
    },

    // 取消订单
    cancel: async (id: string, reason?: string): Promise<void> => {
      await request.post(`/admin/store-orders/${id}/cancel`, { reason })
    },
  },
}

export default storeService