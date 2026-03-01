import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Spin } from 'antd'
import { useAuth } from '@/contexts/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredPermission?: string
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermission
}) => {
  const { user, loading, hasPermission } = useAuth()
  const location = useLocation()

  // 加载中显示加载状态
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh'
      }}>
        <Spin size="large" />
      </div>
    )
  }

  // 未登录则重定向到登录页
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // 检查权限
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column'
      }}>
        <h3>权限不足</h3>
        <p>您没有访问该页面的权限</p>
      </div>
    )
  }

  return <>{children}</>
}

export default ProtectedRoute