import request from './request'
import type {
  TodoItem,
  GetTodosParams,
  ProcessTodoRequest,
  TodoStats,
  PaginationResponse
} from '@/types'

export const todoService = {
  // 获取待办统计（从统一后端接口）
  getTodoStats: async () => {
    try {
      const response = await request.get('/admin/todos/stats')

      if (response.data?.success && response.data?.data) {
        return response.data.data
      }

      // 如果新接口失败，降级到旧的聚合方式
      const [customFlagResponse, adResponse, reportsResponse] = await Promise.all([
        request.get('/custom-flags/admin/orders').catch(() => ({ data: { success: false, orders: [] } })),
        request.get('/ads/admin/orders/pending').catch(() => ({ data: { success: false, orders: [] } })),
        request.get('/reports').then(res => {
          const reports = res.data?.data?.list || [];
          const pendingReports = reports.filter((r: any) => r.status === 'pending');
          return { data: { success: true, pending: pendingReports.length } };
        }).catch(() => ({ data: { success: false, pending: 0 } }))
      ]);

      const customFlagPending = customFlagResponse.data?.success ? customFlagResponse.data.orders?.filter((order: any) => order.status === 'pending').length || 0 : 0;
      const adPending = adResponse.data?.success ? adResponse.data.orders?.length || 0 : 0;
      const reportsPending = reportsResponse.data?.success ? reportsResponse.data.pending || 0 : 0;

      return {
        pending_count: customFlagPending + adPending + reportsPending,
        processed_count: 0,
        ad_approval_pending: adPending,
        custom_flag_pending: customFlagPending,
        report_pending: reportsPending
      }
    } catch (error) {
      console.error('获取待办统计失败:', error)
      return {
        pending_count: 0,
        processed_count: 0,
        ad_approval_pending: 0,
        custom_flag_pending: 0,
        report_pending: 0
      }
    }
  },

  // 获取待办列表（从统一后端接口）
  getTodos: async (params: GetTodosParams) => {
    try {
      // 调用新的统一待办接口
      const response = await request.get('/admin/todos', { params })

      if (response.data?.success && response.data?.data) {
        return response.data
      }

      // 如果新接口失败，降级到旧的聚合方式
      console.warn('新待办接口失败，使用降级方案')
      const todos: TodoItem[] = []

      // 根据筛选条件获取不同类型的待办事项
      if (!params.type || params.type === 'all' || params.type === 'custom_flag_approval') {
        try {
          const customFlagResponse = await request.get('/custom-flags/admin/orders')

          if (customFlagResponse.data?.success && customFlagResponse.data.orders) {
            customFlagResponse.data.orders.forEach((item: any) => {
              if (item.status === 'pending') {
                todos.push({
                  id: item.id,
                  type: 'custom_flag_approval',
                  title: `自定义旗帜申请：${item.pattern_name}`,
                  description: item.pattern_description || '无描述',
                  status: 'pending',
                  priority: 'medium',
                  submitter: {
                    id: item.user_id,
                    username: item.user?.username || item.applicantName || '未知用户',
                    nickname: item.user?.display_name || item.user?.username || item.applicantName || '未知用户'
                  },
                  created_at: item.created_at,
                  updated_at: item.updated_at,
                  flag_data: {
                    id: item.id,
                    pattern_data: item.original_image_url,
                    grid_x: 0,
                    grid_y: 0,
                    width: 100,
                    height: 100
                  }
                })
              }
            })
          }
        } catch (error) {
          console.error('获取自定义旗帜待办失败:', error)
        }
      }

      if (!params.type || params.type === 'all' || params.type === 'ad_approval') {
        try {
          const adResponse = await request.get('/ads/admin/orders/pending')

          if (adResponse.data?.success && adResponse.data.orders) {
            adResponse.data.orders.forEach((item: any) => {
              todos.push({
                id: item.id,
                type: 'ad_approval',
                title: `广告申请：${item.adTitle}`,
                description: item.adDescription || '无描述',
                status: 'pending',
                priority: 'high',
                submitter: {
                  id: item.user_id,
                  username: item.user?.username || '未知用户',
                  nickname: item.user?.display_name || item.user?.username || '未知用户'
                },
                created_at: item.createdAt,
                updated_at: item.updatedAt || item.createdAt,
                ad_data: {
                  id: item.id,
                  content: item.adDescription,
                  image_url: item.originalImageUrl,
                  target_url: item.targetUrl
                }
              })
            })
          }
        } catch (error) {
          console.error('获取广告待办失败:', error)
        }
      }

      // 应用筛选条件
      let filteredTodos = todos

      if (params.status && params.status !== 'all') {
        filteredTodos = filteredTodos.filter(todo => todo.status === params.status)
      }

      if (params.priority && params.priority !== 'all') {
        filteredTodos = filteredTodos.filter(todo => todo.priority === params.priority)
      }

      // 分页处理
      const startIndex = (params.current! - 1) * (params.pageSize || 10)
      const endIndex = startIndex + (params.pageSize || 10)
      const paginatedTodos = filteredTodos.slice(startIndex, endIndex)

      return {
        data: {
          list: paginatedTodos,
          total: filteredTodos.length,
          current: params.current || 1,
          pageSize: params.pageSize || 10
        }
      }
    } catch (error) {
      console.error('获取待办列表失败:', error)
      return {
        data: {
          list: [],
          total: 0,
          current: 1,
          pageSize: 10
        }
      }
    }
  },

  // 处理待办事项（调用统一后端接口）
  processTodo: async (id: string, data: ProcessTodoRequest, type?: string) => {
    if (!type) {
      throw new Error('待办事项类型不能为空')
    }

    try {
      // 优先使用新的统一处理接口
      const response = await request.post('/admin/todos/process', {
        id,
        type,
        action: data.action,
        reason: data.reason
      })

      if (response.data?.success) {
        return response.data
      }

      throw new Error(response.data?.message || '处理失败')
    } catch (error: any) {
      console.warn('统一处理接口失败，使用降级方案:', error)

      // 降级到旧的分散接口
      if (type === 'custom_flag_approval') {
        if (data.action === 'approve') {
          await request.post(`/custom-flags/admin/review`, {
            orderId: id,
            action: 'approve'
          })
        } else if (data.action === 'reject') {
          await request.post(`/custom-flags/admin/review`, {
            orderId: id,
            action: 'reject'
          })
        }
      } else if (type === 'ad_approval') {
        if (data.action === 'approve') {
          await request.post(`/ads/admin/orders/${id}/review`, {
            action: 'approve'
          })
        } else if (data.action === 'reject') {
          await request.post(`/ads/admin/orders/${id}/review`, {
            action: 'reject'
          })
        }
      } else if (type === 'report_review') {
        await request.put(`/api/admin/reports/${id}/resolve`, {
          resolution: data.action === 'approve' ? 'resolved' : 'rejected',
          adminNote: data.reason
        })
      }

      return { success: true }
    }
  },

  // 批量处理待办事项
  batchProcessTodos: async (ids: string[], data: ProcessTodoRequest, type?: string) => {
    try {
      // 使用新的统一批量处理接口
      const response = await request.post('/admin/todos/batch-process', {
        ids,
        type,
        action: data.action,
        reason: data.reason
      })

      if (response.data?.success) {
        return response.data
      }

      throw new Error(response.data?.message || '批量处理失败')
    } catch (error) {
      console.error('批量处理失败:', error)
      throw error
    }
  },

  // 获取待办详情
  getTodoDetail: (id: string) => {
    return request.get<TodoItem>(`/admin/todos/${id}`)
  }
}