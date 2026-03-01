import request from './request'

export interface PaymentStats {
  total_revenue: number
  today_revenue: number
  week_revenue: number
  month_revenue: number
  total_refunds: number
  avg_order_amount: string
  channel_stats: Array<{ channel: string; total: number; count: number }>
}

export const paymentService = {
  getTransactions: async (params: any) => {
    const response = await request.get('/admin/payment/transactions', { params })
    return response.data.data
  },

  getRechargeOrders: async (params: any) => {
    const response = await request.get('/admin/payment/recharge-orders', { params })
    return response.data.data
  },

  processRefund: async (data: { order_id: string; reason: string }) => {
    const response = await request.post('/admin/payment/refund', data)
    return response.data
  },

  getStats: async (): Promise<PaymentStats> => {
    const response = await request.get('/admin/payment/stats')
    return response.data.data
  },

  getUserPaymentHistory: async (userId: string, params: any) => {
    const response = await request.get(`/admin/payment/user/${userId}/history`, { params })
    return response.data.data
  },
}

export default paymentService
