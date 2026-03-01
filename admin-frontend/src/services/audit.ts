import request from './request'

export interface AuditLog {
  id: string
  admin_id: string
  admin_name: string
  action: string
  module: string
  target_type: string
  target_id: string
  description: string
  request_method: string
  request_path: string
  request_body: any
  response_status: number
  ip_address: string
  created_at: string
}

export interface AuditLogStats {
  today_count: number
  module_stats: Array<{ module: string; count: number }>
  admin_stats: Array<{ admin_name: string; count: number }>
  action_stats: Array<{ action: string; count: number }>
}

export const auditService = {
  getLogs: async (params: any) => {
    const response = await request.get('/admin/audit-logs', { params })
    return response.data.data
  },

  getStats: async (): Promise<AuditLogStats> => {
    const response = await request.get('/admin/audit-logs/stats')
    return response.data.data
  },
}

export default auditService
