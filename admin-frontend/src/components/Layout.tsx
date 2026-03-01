import React, { useState, useCallback, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  UserOutlined,
  SafetyOutlined,
  FileSearchOutlined,
  BellOutlined,
  SettingOutlined,
  LogoutOutlined,
  DashboardOutlined,
  TeamOutlined,
  PictureOutlined,
  FileTextOutlined,
  ExclamationCircleOutlined,
  ShoppingCartOutlined,
  FlagOutlined,
  BarChartOutlined,
  ShopOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  FileProtectOutlined,
  LockOutlined,
  NotificationOutlined,
  MailOutlined,
  TrophyOutlined,
  ThunderboltOutlined,
  CalendarOutlined,
  DollarOutlined,
  CommentOutlined,
  AuditOutlined,
  BulbOutlined,
  BulbFilled,
} from '@ant-design/icons'
import { Button, theme } from 'antd'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'

type MenuItem = {
  key: string
  label: string
  icon?: React.ReactNode
  path?: string
  children?: MenuItem[]
  hideInMenu?: boolean
  access?: string[]
  description?: string
}

const Layout: React.FC = () => {
  const { user, logout } = useAuth()
  const { mode, toggleTheme } = useTheme()
  const { token } = theme.useToken()
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [expandedMenus, setExpandedMenus] = useState<string[]>([])

  // 处理子菜单展开/收起
  const toggleSubMenu = (menuKey: string) => {
    setExpandedMenus(prev =>
      prev.includes(menuKey)
        ? prev.filter(key => key !== menuKey)
        : [...prev, menuKey]
    )
  }

  // 自动展开当前页面相关的菜单（已禁用，保持菜单默认折叠）
  const autoExpandMenu = useCallback(() => {
    // 暂时禁用自动展开功能，保持所有菜单默认折叠状态
    // if (collapsed) return

    // const currentPath = location.pathname
    // for (const item of menuData) {
    //   if (item.children) {
    //     // 检查一级菜单
    //     if (currentPath.startsWith(item.path || '/') && item.path !== '/') {
    //       setExpandedMenus(prev =>
    //         prev.includes(item.key) ? prev : [...prev, item.key]
    //       )
    //     }

    //     // 检查二级菜单
    //     for (const child of item.children) {
    //       if (child.children) {
    //         if (currentPath.startsWith(child.path || '/')) {
    //           setExpandedMenus(prev =>
    //             prev.includes(item.key) && prev.includes(child.key)
    //               ? prev
    //               : [...prev.filter(key => key !== child.key), child.key, item.key]
    //           )
    //         }
    //       } else if (currentPath === child.path) {
    //         setExpandedMenus(prev =>
    //           prev.includes(item.key) ? prev : [...prev, item.key]
    //         )
    //       }
    //     }
    //   }
    // }
  }, [location.pathname, collapsed])

  // 监听路由变化，自动展开相关菜单（已禁用）
  useEffect(() => {
    // 暂时禁用自动展开功能
    // autoExpandMenu()
  }, [autoExpandMenu])

  // 检查是否有子菜单被选中
  const hasChildSelected = (item: MenuItem): boolean => {
    if (!item.children) return false

    const checkChildren = (children: MenuItem[]): boolean => {
      for (const child of children) {
        if (location.pathname === child.path) {
          return true
        }
        if (child.children) {
          if (checkChildren(child.children)) {
            return true
          }
        }
      }
      return false
    }

    return checkChildren(item.children)
  }

  // 检查二级菜单是否被选中
  const isSecondLevelSelected = (child: MenuItem): boolean => {
    if (location.pathname === child.path) {
      return true
    }
    if (child.children && child.children.some(grandchild => location.pathname === grandchild.path)) {
      return true
    }
    return false
  }

  // 菜单配置 - 按照用户要求精确调整
  const menuData: MenuItem[] = [
    {
      key: 'dashboard',
      label: '工作台',
      icon: <DashboardOutlined />,
      path: '/',
      description: '系统总览和关键指标',
    },
    {
      key: 'user-management',
      label: '用户管理',
      icon: <UserOutlined />,
      children: [
        {
          key: 'user-list',
          label: '用户列表',
          icon: <UserOutlined />,
          path: '/user/list',
        },
        {
          key: 'role-permissions',
          label: '角色权限',
          icon: <SafetyOutlined />,
          path: '/role/list',
        },
        {
          key: 'alliance-management',
          label: '联盟管理',
          icon: <TeamOutlined />,
          path: '/alliance',
        },
      ],
    },
    {
      key: 'content-management',
      label: '内容管理',
      icon: <PictureOutlined />,
      children: [
        {
          key: 'pattern-assets',
          label: '图案资源',
          icon: <PictureOutlined />,
          path: '/pattern-assets',
        },
        {
          key: 'report-management',
          label: '举报管理',
          icon: <ExclamationCircleOutlined />,
          path: '/reports',
        },
        {
          key: 'user-agreement-management',
          label: '用户协议管理',
          icon: <FileProtectOutlined />,
          path: '/content/user-agreement',
        },
        {
          key: 'privacy-policy-management',
          label: '隐私政策管理',
          icon: <LockOutlined />,
          path: '/content/privacy-policy',
        },
      ],
    },
    {
      key: 'operations-management',
      label: '运营管理',
      icon: <BellOutlined />,
      children: [
        {
          key: 'announcement-management',
          label: '公告管理',
          icon: <NotificationOutlined />,
          path: '/operations/announcements',
        },
        {
          key: 'system-mail',
          label: '系统信箱',
          icon: <MailOutlined />,
          path: '/operations/system-mail',
        },
        {
          key: 'event-management',
          label: '赛事活动',
          icon: <TrophyOutlined />,
          path: '/operations/events/list',
        },
        {
          key: 'achievement-management',
          label: '成就管理',
          icon: <TrophyOutlined />,
          path: '/operations/achievements',
        },
        {
          key: 'challenge-config',
          label: '每日挑战',
          icon: <ThunderboltOutlined />,
          path: '/operations/challenges',
        },
        {
          key: 'checkin-config',
          label: '签到配置',
          icon: <CalendarOutlined />,
          path: '/operations/checkin',
        },
        {
          key: 'feedback-management',
          label: '用户反馈',
          icon: <CommentOutlined />,
          path: '/operations/feedback',
        },
      ],
    },
    {
      key: 'business-management',
      label: '商业管理',
      icon: <ShopOutlined />,
      children: [
        {
          key: 'advertisement',
          label: '广告管理',
          icon: <FileTextOutlined />,
          children: [
            {
              key: 'ad-list',
              label: '广告列表',
              icon: <FileTextOutlined />,
              path: '/advertisements',
            },
            {
              key: 'ad-approval',
              label: '广告审批',
              icon: <FileSearchOutlined />,
              path: '/ad/approval',
            },
          ],
        },
        {
          key: 'custom-flag-management',
          label: '自定义旗帜管理',
          icon: <FlagOutlined />,
          children: [
            {
              key: 'custom-flag-list',
              label: '自定义旗帜列表',
              icon: <FlagOutlined />,
              path: '/store/custom-flags',
            },
            {
              key: 'custom-flag-approval',
              label: '自定义旗帜审批',
              icon: <FileSearchOutlined />,
              path: '/store/custom-flags/approval',
            },
          ],
        },
        {
          key: 'product-management',
          label: '商品管理',
          icon: <ShopOutlined />,
          children: [
            {
              key: 'flag-products',
              label: '旗帜商品',
              icon: <FlagOutlined />,
              path: '/store/products',
              description: '联盟旗帜SKU商品管理',
            },
            {
              key: 'item-products',
              label: '道具商品',
              icon: <ShoppingCartOutlined />,
              path: '/store/store-items',
              description: '消耗品、装饰品、特殊道具等',
            },
            {
              key: 'ad-products',
              label: '广告商品',
              icon: <FileTextOutlined />,
              path: '/store/ad-products',
              description: '地图广告位商品',
            },
          ],
        },
        {
          key: 'order-management',
          label: '订单管理',
          icon: <ShoppingCartOutlined />,
          children: [
            {
              key: 'all-orders',
              label: '全部订单',
              icon: <ShoppingCartOutlined />,
              path: '/store/orders',
              description: '查看和管理所有订单',
            },
          ],
        },
        {
          key: 'payment-management',
          label: '支付退款',
          icon: <DollarOutlined />,
          path: '/business/payment',
        },
      ],
    },
    {
      key: 'data-analytics',
      label: '数据分析',
      icon: <BarChartOutlined />,
      children: [
        {
          key: 'analytics-dashboard',
          label: '分析总览',
          icon: <BarChartOutlined />,
          path: '/analytics/dashboard',
        },
        {
          key: 'user-analytics',
          label: '用户分析',
          icon: <UserOutlined />,
          path: '/analytics/users',
        },
        {
          key: 'content-analytics',
          label: '内容分析',
          icon: <PictureOutlined />,
          path: '/analytics/content',
        },
        {
          key: 'revenue-analytics',
          label: '收入分析',
          icon: <ShopOutlined />,
          path: '/analytics/revenue',
        },
      ],
    },
    {
      key: 'system-settings',
      label: '系统设置',
      icon: <SettingOutlined />,
      children: [
        {
          key: 'basic-settings',
          label: '基础配置',
          icon: <SettingOutlined />,
          path: '/system/basic',
        },
        {
          key: 'log-management',
          label: '日志管理',
          icon: <FileTextOutlined />,
          path: '/system/logs',
        },
        {
          key: 'performance-monitor',
          label: '性能监控',
          icon: <BarChartOutlined />,
          path: '/system/performance',
        },
        {
          key: 'security-settings',
          label: '安全设置',
          icon: <SafetyOutlined />,
          path: '/system/security',
        },
        {
          key: 'audit-log',
          label: '操作审计',
          icon: <AuditOutlined />,
          path: '/system/audit-log',
        },
      ],
    },
  ]

  // 处理菜单点击
  const handleMenuClick = (key: string) => {
    const findMenuPath = (items: MenuItem[], targetKey: string): string | null => {
      for (const item of items) {
        if (item.key === targetKey && item.path) {
          return item.path
        }
        if (item.children) {
          const path = findMenuPath(item.children, targetKey)
          if (path) return path
        }
      }
      return null
    }

    const path = findMenuPath(menuData, key)
    if (path) {
      navigate(path)
    }
  }

  // 处理用户下拉菜单
  const handleUserMenuClick = ({ key }: { key: string }) => {
    switch (key) {
      case 'profile':
        navigate('/profile')
        break
      case 'settings':
        navigate('/settings')
        break
      case 'logout':
        logout()
        break
      default:
        break
    }
  }


  return (
    <div style={{
      minHeight: '100vh',
      position: 'relative',
      backgroundColor: token.colorBgLayout // Use token
    }}>

      <div style={{
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        width: collapsed ? '80px' : '240px',
        backgroundColor: token.colorBgContainer, // Use token
        borderRight: `1px solid ${token.colorBorderSecondary}`,
        zIndex: 1000,
        transition: 'width 0.3s ease, background-color 0.3s ease',
        boxShadow: mode === 'dark' ? 'none' : '2px 0 8px 0 rgba(29, 35, 41, 0.05)'
      }}>
        {/* Logo区域 */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          cursor: 'pointer'
        }} onClick={() => navigate('/')}>
          <div style={{
            width: '32px',
            height: '32px',
            backgroundColor: '#1677ff', // 使用新的主色
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: collapsed ? '0' : '12px'
          }}>
            <span style={{
              color: 'white',
              fontSize: '20px',
              fontWeight: 'bold',
              imageRendering: 'pixelated'
            }}>F</span>
          </div>
          {!collapsed && (
            <span style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#1f2937',
              whiteSpace: 'nowrap'
            }}>
              Funnypixels
            </span>
          )}
        </div>

        {/* 菜单区域 */}
        <div style={{
          padding: '1rem 0.75rem',
          overflowY: 'auto',
          height: 'calc(100% - 200px)'
        }}>
          {menuData.map((item) => (
            <div key={item.key} style={{ marginBottom: '8px' }}>
              {/* 一级菜单 */}
              {item.children ? (
                // 有子菜单的项目
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: collapsed ? 'center' : 'space-between',
                    backgroundColor: hasChildSelected(item) ? '#e6f4ff' : 'transparent',
                    color: hasChildSelected(item) ? '#1677ff' : '#374151',
                    transition: 'all 0.2s ease',
                    whiteSpace: 'nowrap',
                    fontWeight: '500'
                  }}
                  onClick={() => {
                    if (collapsed) return
                    toggleSubMenu(item.key)
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: '16px', marginRight: collapsed ? '0' : '12px' }}>
                      {item.icon}
                    </span>
                    {!collapsed && (
                      <span style={{ fontSize: '14px' }}>
                        {item.label}
                      </span>
                    )}
                  </div>
                  {!collapsed && (
                    <span style={{
                      fontSize: '12px',
                      color: '#9ca3af',
                      transform: expandedMenus.includes(item.key) ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease'
                    }}>
                      ▼
                    </span>
                  )}
                </div>
              ) : (
                // 无子菜单的项目
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    backgroundColor: location.pathname.startsWith(item.path || '/') ? '#e6f4ff' : 'transparent',
                    color: location.pathname.startsWith(item.path || '/') ? '#1677ff' : '#374151',
                    transition: 'all 0.2s ease',
                    whiteSpace: 'nowrap'
                  }}
                  onClick={() => item.path && navigate(item.path)}
                >
                  <span style={{ fontSize: '16px', marginRight: collapsed ? '0' : '12px' }}>
                    {item.icon}
                  </span>
                  {!collapsed && (
                    <span style={{ fontSize: '14px', fontWeight: '500' }}>
                      {item.label}
                    </span>
                  )}
                </div>
              )}

              {/* 二级和三级菜单 */}
              {item.children && !collapsed && expandedMenus.includes(item.key) && (
                <div style={{ marginLeft: '1rem', marginTop: '4px' }}>
                  {item.children.map((child) => (
                    <div key={child.key} style={{ marginBottom: '4px' }}>
                      {child.children ? (
                        // 有三级菜单的二级项目
                        <div
                          style={{
                            padding: '0.5rem 0.75rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            backgroundColor: isSecondLevelSelected(child) ? '#e6f4ff' : 'transparent',
                            color: isSecondLevelSelected(child) ? '#1677ff' : '#6b7280',
                            transition: 'all 0.2s ease',
                          }}
                          onClick={() => toggleSubMenu(child.key)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <span style={{ fontSize: '14px', marginRight: '8px' }}>
                              {child.icon}
                            </span>
                            <span style={{ fontSize: '13px', fontWeight: '500' }}>
                              {child.label}
                            </span>
                          </div>
                          <span style={{
                            fontSize: '10px',
                            color: '#9ca3af',
                            transform: expandedMenus.includes(child.key) ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s ease'
                          }}>
                            ▼
                          </span>
                        </div>
                      ) : (
                        // 无三级菜单的二级项目
                        <div
                          style={{
                            padding: '0.5rem 0.75rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            backgroundColor: location.pathname === child.path ? '#e6f4ff' : 'transparent',
                            color: location.pathname === child.path ? '#1677ff' : '#6b7280',
                            transition: 'all 0.2s ease',
                          }}
                          onClick={() => child.path && navigate(child.path)}
                        >
                          <span style={{ fontSize: '14px', marginRight: '8px' }}>
                            {child.icon}
                          </span>
                          <span style={{ fontSize: '13px' }}>
                            {child.label}
                          </span>
                        </div>
                      )}

                      {/* 三级菜单 */}
                      {child.children && expandedMenus.includes(child.key) && (
                        <div style={{ marginLeft: '1.5rem', marginTop: '2px' }}>
                          {child.children.map((grandchild) => (
                            <div
                              key={grandchild.key}
                              style={{
                                padding: '0.4rem 0.75rem',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                backgroundColor: location.pathname === grandchild.path ? '#e6f4ff' : 'transparent',
                                color: location.pathname === grandchild.path ? '#1677ff' : '#6b7280',
                                transition: 'all 0.2s ease',
                                marginBottom: '1px',
                              }}
                              onClick={() => grandchild.path && navigate(grandchild.path)}
                            >
                              <span style={{ fontSize: '12px', marginRight: '8px' }}>
                                {grandchild.icon}
                              </span>
                              <span style={{ fontSize: '12px' }}>
                                {grandchild.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 用户信息区域 */}
        {!collapsed && (
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '1rem',
            borderTop: '1px solid #e5e7eb'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '8px'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                backgroundColor: '#e5e7eb',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '8px'
              }}>
                <UserOutlined style={{ color: '#6b7280' }} />
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>
                  {user?.nickname || user?.username}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  {user?.role}
                </div>
              </div>
            </div>
            <Button
              type="text"
              size="small"
              icon={<LogoutOutlined />}
              onClick={logout}
              style={{
                color: '#ef4444',
                width: '100%',
                textAlign: 'left'
              }}
            >
              退出登录
            </Button>
          </div>
        )}
      </div>

      {/* 主内容区域 */}
      <div style={{
        marginLeft: collapsed ? '80px' : '240px',
        minHeight: '100vh',
        transition: 'margin-left 0.3s ease'
      }}>
        {/* 顶部操作栏 */}
        <div style={{
          position: 'fixed',
          top: 0,
          right: 0,
          left: collapsed ? '80px' : '240px',
          height: '64px',
          backgroundColor: token.colorBgContainer, // Use token
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          transition: 'left 0.3s ease, background-color 0.3s ease'
        }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{
              fontSize: '16px',
              color: token.colorTextSecondary
            }}
          />

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <Button
              type="text"
              icon={mode === 'dark' ? <BulbFilled /> : <BulbOutlined />}
              onClick={toggleTheme}
              style={{ color: token.colorTextSecondary }}
            />

            {collapsed && (
              <>
                <div style={{
                  padding: '4px 12px',
                  backgroundColor: token.colorFillTertiary,
                  borderRadius: '16px',
                  fontSize: '12px',
                  color: token.colorTextSecondary
                }}>
                  {user?.nickname || user?.username}
                </div>
                <Button
                  type="text"
                  size="small"
                  icon={<LogoutOutlined />}
                  onClick={logout}
                  style={{ color: token.colorError }}
                />
              </>
            )}
          </div>
        </div>

        {/* 页面内容 */}
        <div style={{ paddingTop: '80px', padding: '80px 24px 24px' }}>
          <Outlet />
        </div>
      </div>
    </div>
  )
}

export default Layout