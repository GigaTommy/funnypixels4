import React from 'react'
import { Button, Space, Breadcrumb } from 'antd'
import { HomeOutlined } from '@ant-design/icons'

export interface PageAction {
  key: string
  label: string
  icon?: React.ReactNode
  type?: 'primary' | 'default' | 'dashed' | 'text' | 'link'
  danger?: boolean
  onClick: () => void
}

export interface BreadcrumbItem {
  title: string
  path?: string
}

interface PageHeaderProps {
  title: string
  description?: string
  icon?: string | React.ReactNode
  iconBg?: string
  actions?: PageAction[]
  breadcrumbs?: BreadcrumbItem[]
  extra?: React.ReactNode
  style?: React.CSSProperties
}

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  icon,
  iconBg = '#1677ff',
  actions = [],
  breadcrumbs,
  extra,
  style
}) => {
  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        padding: '24px',
        marginBottom: '24px',
        border: '1px solid #f0f0f0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        ...style
      }}
    >
      {/* 面包屑导航 */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb
          style={{ marginBottom: 16 }}
          items={[
            {
              title: <HomeOutlined />,
            },
            ...breadcrumbs.map(item => ({
              title: item.title,
              href: item.path
            }))
          ]}
        />
      )}

      {/* 标题区域 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          flex: 1
        }}>
          {/* 图标 */}
          {icon && (
            <div style={{
              width: '40px',
              height: '40px',
              backgroundColor: iconBg,
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '16px',
              flexShrink: 0
            }}>
              {typeof icon === 'string' ? (
                <span style={{
                  color: 'white',
                  fontSize: '20px'
                }}>{icon}</span>
              ) : icon}
            </div>
          )}

          {/* 标题和描述 */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{
              margin: 0,
              fontSize: '28px',
              fontWeight: '700',
              color: '#1f2937',
              lineHeight: '1.2',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {title}
            </h1>
            {description && (
              <p style={{
                margin: '4px 0 0 0',
                fontSize: '14px',
                color: '#6b7280',
                lineHeight: '1.4'
              }}>
                {description}
              </p>
            )}
          </div>
        </div>

        {/* 操作按钮 */}
        {(actions.length > 0 || extra) && (
          <div style={{ marginLeft: 16, flexShrink: 0 }}>
            <Space>
              {actions.map(action => (
                <Button
                  key={action.key}
                  type={action.type || 'default'}
                  icon={action.icon}
                  danger={action.danger}
                  onClick={action.onClick}
                  style={{
                    borderRadius: '6px',
                    fontWeight: '500'
                  }}
                >
                  {action.label}
                </Button>
              ))}
              {extra}
            </Space>
          </div>
        )}
      </div>
    </div>
  )
}

export default PageHeader
