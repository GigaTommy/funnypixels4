import request from './request'
import type { LoginForm, LoginResponse } from '@/types'

export const authService = {
  // 登录
  login: async (data: LoginForm): Promise<LoginResponse> => {
    const response = await request.post('/admin/auth/login', data)
    // 后端返回 { success, message, data: { token, refreshToken, user } }
    const resData = response.data.data
    return {
      token: resData.token,
      user: resData.user
    }
  },

  // 登出
  logout: async (): Promise<void> => {
    await request.post('/admin/auth/logout')
  },

  // 获取当前用户信息
  getCurrentUser: async () => {
    const response = await request.get('/admin/auth/me')
    return response.data.data
  },

  // 刷新 token
  refreshToken: async (): Promise<string> => {
    const response = await request.post('/admin/auth/refresh')
    return response.data.data.token
  },
}

export default authService