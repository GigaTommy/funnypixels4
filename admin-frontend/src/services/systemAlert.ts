import request from './request'

export interface SystemAlert {
  id: number
  type: string
  severity: string
  title: string
  message: string
  details: any
  is_resolved: boolean
  resolved_by?: string
  resolution_note?: string
  resolved_at?: string
  created_at: string
}

export const systemAlertService = {
  getList: async (params: {
    type?: string
    severity?: string
    is_resolved?: string
    page?: number
    limit?: number
  }) => {
    const response = await request.get('/admin/system-alerts', { params })
    return response.data.data
  },

  getUnresolvedCount: async (): Promise<number> => {
    const response = await request.get('/admin/system-alerts/unresolved-count')
    return response.data.count
  },

  resolve: async (id: number, resolution_note?: string) => {
    const response = await request.put(`/admin/system-alerts/${id}/resolve`, {
      resolution_note,
    })
    return response.data
  },
}
