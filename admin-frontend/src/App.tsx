import React, { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider, theme, App as AntApp } from 'antd'

import { AuthProvider } from '@/contexts/AuthContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import { setMessageInstance } from '@/services/request'

// 懒加载页面组件
const UserList = React.lazy(() => import('@/pages/user/List'))
const UserDetail = React.lazy(() => import('@/pages/user/Detail'))
const RoleList = React.lazy(() => import('@/pages/role/List'))
const Alliance = React.lazy(() => import('@/pages/Alliance'))
const PatternAssets = React.lazy(() => import('@/pages/PatternAssets'))
const AdvertisementManagement = React.lazy(() => import('@/pages/AdvertisementManagement'))
const ReportManagement = React.lazy(() => import('@/pages/ReportManagement'))
const AdApproval = React.lazy(() => import('@/pages/ad/Approval'))
const AdDetail = React.lazy(() => import('@/pages/ad/Detail'))

// 新增页面组件
const StoreOrderManagement = React.lazy(() => import('@/pages/Store/OrderManagement'))
const CustomFlagApproval = React.lazy(() => import('@/pages/Store/CustomFlagApproval'))
const CustomFlagList = React.lazy(() => import('@/pages/Store/CustomFlagList'))
const ProductManagement = React.lazy(() => import('@/pages/Store/ProductManagement'))
const StoreItemManagement = React.lazy(() => import('@/pages/Store/StoreItemManagement'))
const AdProductManagement = React.lazy(() => import('@/pages/Store/AdProductManagement'))

// 分析页面组件
const UserAnalytics = React.lazy(() => import('@/pages/Analytics/UserAnalytics'))
const ContentAnalytics = React.lazy(() => import('@/pages/Analytics/ContentAnalytics'))
const RevenueAnalytics = React.lazy(() => import('@/pages/Analytics/RevenueAnalytics'))
const AnalyticsDashboard = React.lazy(() => import('@/pages/Analytics/Dashboard'))

// 系统页面组件
const BasicSettings = React.lazy(() => import('@/pages/System/BasicSettings'))
const LogManagement = React.lazy(() => import('@/pages/System/LogManagement'))
const PerformanceMonitor = React.lazy(() => import('@/pages/System/PerformanceMonitor'))
const SecuritySettings = React.lazy(() => import('@/pages/System/SecuritySettings'))

// 内容管理页面组件
const UserAgreementManagement = React.lazy(() => import('@/pages/Content/UserAgreementManagement'))
const PrivacyPolicyManagement = React.lazy(() => import('@/pages/Content/PrivacyPolicyManagement'))

// 运营管理页面组件
const AnnouncementList = React.lazy(() => import('@/pages/Operations/AnnouncementList'))
const SystemMail = React.lazy(() => import('@/pages/Operations/SystemMail'))
const EventList = React.lazy(() => import('@/pages/Operations/EventList'))
const EventCreate = React.lazy(() => import('@/pages/Operations/EventCreate'))
const AchievementManagement = React.lazy(() => import('@/pages/Operations/AchievementManagement'))
const ChallengeConfig = React.lazy(() => import('@/pages/Operations/ChallengeConfig'))
const CheckinConfig = React.lazy(() => import('@/pages/Operations/CheckinConfig'))
const PaymentManagement = React.lazy(() => import('@/pages/Operations/PaymentManagement'))
const FeedbackManagement = React.lazy(() => import('@/pages/Operations/FeedbackManagement'))
const SystemAlerts = React.lazy(() => import('@/pages/Operations/SystemAlerts'))
const RewardConfig = React.lazy(() => import('@/pages/Operations/RewardConfig'))

// 系统审计页面
const AuditLog = React.lazy(() => import('@/pages/System/AuditLog'))

import { ThemeProvider, useTheme } from '@/contexts/ThemeContext'

const AppContent: React.FC = () => {
  const { mode } = useTheme()
  const { message } = AntApp.useApp()

  // 设置全局message实例
  useEffect(() => {
    setMessageInstance(message)
  }, [message])

  return (
    <ConfigProvider
      theme={{
        algorithm: mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#0D9488', // Teal
          colorInfo: '#0D9488',
          colorSuccess: '#10B981',
          colorWarning: '#F59E0B',
          colorError: '#EF4444',
          borderRadius: 12,
          borderRadiusLG: 16,
          borderRadiusSM: 6,
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          fontSize: 14,
          controlHeight: 40,
          // Dark mode specific overrides
          ...(mode === 'dark' ? {
            colorBgLayout: '#0B1120', // Deep Navy for layout bg
            colorBgContainer: '#1E293B', // Slate-800 for cards
            colorBgElevated: '#1E293B', // Dropdowns etc
            colorText: '#E2E8F0', // Slate-200
            colorTextSecondary: '#94A3B8', // Slate-400
            colorBorder: '#334155', // Slate-700
          } : {})
        },
        components: {
          Card: {
            borderRadius: 16,
            boxShadow: mode === 'dark' ? 'none' : '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
          },
          Button: {
            borderRadius: 8,
            controlHeight: 40,
            controlHeightSM: 32,
            controlHeightLG: 48,
            fontWeight: 500,
          },
          Table: {
            borderRadius: 12,
            headerBg: mode === 'dark' ? '#1e293b' : '#fafafa',
            rowHoverBg: mode === 'dark' ? '#334155' : '#f0fdfa',
          },
          Tabs: {
            itemActiveColor: '#0D9488',
            itemSelectedColor: '#0D9488',
            inkBarColor: '#0D9488',
          },
          Input: {
            borderRadius: 8,
            controlHeight: 40,
            controlHeightSM: 32,
            activeBorderColor: '#0D9488',
            hoverBorderColor: '#0D9488',
          },
          Select: {
            borderRadius: 8,
            controlHeight: 40,
          },
          Tag: {
            borderRadius: 6,
          },
          Layout: {
            headerBg: mode === 'dark' ? '#1E293B' : '#ffffff',
            siderBg: mode === 'dark' ? '#0B1120' : '#ffffff',
          }
        },
      }}
    >
      <AntApp>
        <AuthProvider>
          <Routes>
            {/* 登录页面 */}
            <Route path="/login" element={<Login />} />

            {/* 受保护的路由 */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              {/* 工作台 */}
              <Route index element={<Dashboard />} />

              {/* 用户管理 */}
              <Route
                path="user/list"
                element={
                  <React.Suspense fallback={<div>加载中...</div>}>
                    <UserList />
                  </React.Suspense>
                }
              />
              <Route
                path="user/detail/:id"
                element={
                  <React.Suspense fallback={<div>加载中...</div>}>
                    <UserDetail />
                  </React.Suspense>
                }
              />

              {/* 角色管理 */}
              <Route
                path="role/list"
                element={
                  <React.Suspense fallback={<div>加载中...</div>}>
                    <RoleList />
                  </React.Suspense>
                }
              />

              {/* 联盟管理 */}
              <Route
                path="alliance"
                element={
                  <React.Suspense fallback={<div>加载中...</div>}>
                    <Alliance />
                  </React.Suspense>
                }
              />

              {/* 图案资源管理 */}
              <Route
                path="pattern-assets"
                element={
                  <React.Suspense fallback={<div>加载中...</div>}>
                    <PatternAssets />
                  </React.Suspense>
                }
              />

              {/* 用户协议管理 */}
              <Route
                path="content/user-agreement"
                element={
                  <React.Suspense fallback={<div>加载中...</div>}>
                    <UserAgreementManagement />
                  </React.Suspense>
                }
              />

              {/* 隐私政策管理 */}
              <Route
                path="content/privacy-policy"
                element={
                  <React.Suspense fallback={<div>加载中...</div>}>
                    <PrivacyPolicyManagement />
                  </React.Suspense>
                }
              />

              {/* 广告管理 */}
              <Route
                path="advertisements"
                element={
                  <React.Suspense fallback={<div>加载中...</div>}>
                    <AdvertisementManagement />
                  </React.Suspense>
                }
              />

              {/* 举报管理 */}
              <Route
                path="reports"
                element={
                  <React.Suspense fallback={<div>加载中...</div>}>
                    <ReportManagement />
                  </React.Suspense>
                }
              />

              {/* 运营管理 */}
              <Route
                path="operations/announcements"
                element={
                  <React.Suspense fallback={<div>加载中...</div>}>
                    <AnnouncementList />
                  </React.Suspense>
                }
              />
              <Route
                path="operations/system-mail"
                element={
                  <React.Suspense fallback={<div>加载中...</div>}>
                    <SystemMail />
                  </React.Suspense>
                }
              />
              <Route
                path="operations/events/list"
                element={
                  <React.Suspense fallback={<div>加载中...</div>}>
                    <EventList />
                  </React.Suspense>
                }
              />
              <Route
                path="operations/events/create"
                element={
                  <React.Suspense fallback={<div>加载中...</div>}>
                    <EventCreate />
                  </React.Suspense>
                }
              />
              <Route
                path="operations/events/edit/:id"
                element={
                  <React.Suspense fallback={<div>加载中...</div>}>
                    <EventCreate />
                  </React.Suspense>
                }
              />

              {/* 成就管理 */}
              <Route
                path="operations/achievements"
                element={
                  <React.Suspense fallback={<div>加载中...</div>}>
                    <AchievementManagement />
                  </React.Suspense>
                }
              />

              {/* 每日挑战配置 */}
              <Route
                path="operations/challenges"
                element={
                  <React.Suspense fallback={<div>加载中...</div>}>
                    <ChallengeConfig />
                  </React.Suspense>
                }
              />

              {/* 签到配置 */}
              <Route
                path="operations/checkin"
                element={
                  <React.Suspense fallback={<div>加载中...</div>}>
                    <CheckinConfig />
                  </React.Suspense>
                }
              />

              {/* 用户反馈 */}
              <Route
                path="operations/feedback"
                element={
                  <React.Suspense fallback={<div>加载中...</div>}>
                    <FeedbackManagement />
                  </React.Suspense>
                }
              />

              {/* 系统告警 */}
              <Route
                path="operations/system-alerts"
                element={
                  <React.Suspense fallback={<div>加载中...</div>}>
                    <SystemAlerts />
                  </React.Suspense>
                }
              />

              {/* 奖励参数配置 */}
              <Route
                path="operations/reward-config"
                element={
                  <React.Suspense fallback={<div>加载中...</div>}>
                    <RewardConfig />
                  </React.Suspense>
                }
              />

              {/* 广告审批 */}
              <Route
                path="ad/approval"
                element={
                  <React.Suspense fallback={<div>加载中...</div>}>
                    <AdApproval />
                  </React.Suspense>
                }
              />
              <Route
                path="ad/detail/:id"
                element={
                  <React.Suspense fallback={<div>加载中...</div>}>
                    <AdDetail />
                  </React.Suspense>
                }
              />

              {/* 商店订单管理 */}
              <Route
                path="store/orders"
                element={
                  <React.Suspense fallback={<div>加载中...</div>}>
                    <StoreOrderManagement />
                  </React.Suspense>
                }
              />

              {/* 自定义旗帜列表 */}
              <Route
                path="store/custom-flags"
                element={
                  <React.Suspense fallback={<div>加载中...</div>}>
                    <CustomFlagList />
                  </React.Suspense>
                }
              />

              {/* 商品管理 */}
              <Route
                path="store/products"
                element={
                  <React.Suspense fallback={<div>加载中...</div>}>
                    <ProductManagement />
                  </React.Suspense>
                }
              />

              {/* 商店商品管理 */}
              <Route
                path="store/store-items"
                element={
                  <React.Suspense fallback={<div>加载中...</div>}>
                    <StoreItemManagement />
                  </React.Suspense>
                }
              />

              {/* 广告商品管理 */}
              <Route
                path="store/ad-products"
                element={
                  <React.Suspense fallback={<div>加载中...</div>}>
                    <AdProductManagement />
                  </React.Suspense>
                }
              />

              {/* 支付退款管理 */}
              <Route
                path="business/payment"
                element={
                  <React.Suspense fallback={<div>加载中...</div>}>
                    <PaymentManagement />
                  </React.Suspense>
                }
              />

              {/* 用户分析 */}
              <Route
                path="analytics/users"
                element={
                  <React.Suspense fallback={<div>加载中...</div>}>
                    <UserAnalytics />
                  </React.Suspense>
                }
              />

              {/* 内容分析 */}
              <Route
                path="analytics/content"
                element={
                  <React.Suspense fallback={<div>加载中...</div>}>
                    <ContentAnalytics />
                  </React.Suspense>
                }
              />

              {/* 收入分析 */}
              <Route
                path="analytics/revenue"
                element={
                  <React.Suspense fallback={<div>加载中...</div>}>
                    <RevenueAnalytics />
                  </React.Suspense>
                }
              />

              {/* 数据统计分析 */}
              <Route
                path="analytics/dashboard"
                element={
                  <React.Suspense fallback={<div>加载中...</div>}>
                    <AnalyticsDashboard />
                  </React.Suspense>
                }
              />

              {/* 基础配置 */}
              <Route
                path="system/basic"
                element={
                  <React.Suspense fallback={<div>加载中...</div>}>
                    <BasicSettings />
                  </React.Suspense>
                }
              />

              {/* 日志管理 */}
              <Route
                path="system/logs"
                element={
                  <React.Suspense fallback={<div>加载中...</div>}>
                    <LogManagement />
                  </React.Suspense>
                }
              />

              {/* 性能监控 */}
              <Route
                path="system/performance"
                element={
                  <React.Suspense fallback={<div>加载中...</div>}>
                    <PerformanceMonitor />
                  </React.Suspense>
                }
              />

              {/* 安全设置 */}
              <Route
                path="system/security"
                element={
                  <React.Suspense fallback={<div>加载中...</div>}>
                    <SecuritySettings />
                  </React.Suspense>
                }
              />

              {/* 操作审计 */}
              <Route
                path="system/audit-log"
                element={
                  <React.Suspense fallback={<div>加载中...</div>}>
                    <AuditLog />
                  </React.Suspense>
                }
              />

              {/* 自定义旗帜审批 */}
              <Route
                path="store/custom-flags/approval"
                element={
                  <React.Suspense fallback={<div>加载中...</div>}>
                    <CustomFlagApproval />
                  </React.Suspense>
                }
              />

              {/* 其他路由重定向到首页 */}
            </Route>
          </Routes>
        </AuthProvider>
      </AntApp>
    </ConfigProvider>
  )
}

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  )
}

export default App