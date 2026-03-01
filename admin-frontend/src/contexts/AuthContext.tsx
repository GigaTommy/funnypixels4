import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { App } from 'antd'
import { useNavigate, useLocation } from 'react-router-dom'
import { authService } from '@/services'
import type { LoginForm, LoginResponse } from '@/types'

interface AuthUser {
  id: number
  username: string
  nickname: string
  role: string
  permissions: string[]
  avatar?: string
}

interface AuthContextType {
  user: AuthUser | null
  token: string | null
  loading: boolean
  login: (form: LoginForm) => Promise<boolean>
  logout: () => void
  hasPermission: (permission: string) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const location = useLocation()
  const { message } = App.useApp()

  // 初始化时检查本地存储的 token
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('admin_token')
      const storedUser = localStorage.getItem('admin_user')

      if (storedToken && storedUser) {
        try {
          setToken(storedToken)
          setUser(JSON.parse(storedUser))

          // 验证 token 是否有效
          await authService.getCurrentUser()
        } catch (error) {
          // token 无效，清除本地存储
          localStorage.removeItem('admin_token')
          localStorage.removeItem('admin_user')
          setToken(null)
          setUser(null)
        }
      }

      setLoading(false)
    }

    initAuth()
  }, [])

  // 登录函数
  const login = async (form: LoginForm): Promise<boolean> => {
    try {
      setLoading(true)
      const response: LoginResponse = await authService.login(form)

      // 保存 token 和用户信息
      setToken(response.token)
      setUser(response.user)

      localStorage.setItem('admin_token', response.token)
      localStorage.setItem('admin_user', JSON.stringify(response.user))

      message.success('登录成功')

      // 跳转到之前的页面或首页
      const from = location.state?.from?.pathname || '/'
      navigate(from, { replace: true })

      return true
    } catch (error) {
      console.error('Login failed:', error)
      return false
    } finally {
      setLoading(false)
    }
  }

  // 登出函数
  const logout = async () => {
    try {
      await authService.logout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      // 无论后端登出是否成功，都清除本地状态
      setUser(null)
      setToken(null)
      localStorage.removeItem('admin_token')
      localStorage.removeItem('admin_user')
      navigate('/login', { replace: true })
      message.info('已退出登录')
    }
  }

  // 权限检查函数
  const hasPermission = (permission: string): boolean => {
    if (!user) return false
    return user.permissions.includes(permission) || user.permissions.includes('*')
  }

  const value: AuthContextType = {
    user,
    token,
    loading,
    login,
    logout,
    hasPermission,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// 自定义 Hook 用于使用认证上下文
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext