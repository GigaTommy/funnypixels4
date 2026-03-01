import React from 'react'
import { Empty, Button } from 'antd'
import { PlusOutlined, InboxOutlined, SearchOutlined, FileSearchOutlined } from '@ant-design/icons'

export type EmptyStateType = 'noData' | 'noSearch' | 'noPermission' | 'error' | 'custom'

interface EmptyStateProps {
  type?: EmptyStateType
  title?: string
  description?: string
  image?: React.ReactNode
  actionText?: string
  onAction?: () => void
  style?: React.CSSProperties
}

const EmptyState: React.FC<EmptyStateProps> = ({
  type = 'noData',
  title,
  description,
  image,
  actionText,
  onAction,
  style
}) => {
  // 根据类型设置默认值
  const getDefaultConfig = () => {
    switch (type) {
      case 'noData':
        return {
          icon: <InboxOutlined style={{ fontSize: 64, color: '#d1d5db' }} />,
          title: title || '暂无数据',
          description: description || '当前没有任何数据，点击下方按钮添加数据',
          actionText: actionText || '添加数据',
          actionIcon: <PlusOutlined />
        }
      case 'noSearch':
        return {
          icon: <SearchOutlined style={{ fontSize: 64, color: '#d1d5db' }} />,
          title: title || '无搜索结果',
          description: description || '未找到符合条件的数据，请尝试调整搜索条件',
          actionText: actionText || '清空筛选',
          actionIcon: null
        }
      case 'noPermission':
        return {
          icon: <FileSearchOutlined style={{ fontSize: 64, color: '#d1d5db' }} />,
          title: title || '无权限访问',
          description: description || '您没有权限访问此页面，请联系管理员',
          actionText: null,
          actionIcon: null
        }
      case 'error':
        return {
          icon: '⚠️',
          title: title || '加载失败',
          description: description || '数据加载失败，请稍后重试',
          actionText: actionText || '重新加载',
          actionIcon: null
        }
      default:
        return {
          icon: image,
          title: title || '暂无内容',
          description: description,
          actionText: actionText,
          actionIcon: null
        }
    }
  }

  const config = getDefaultConfig()

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '64px 24px',
        minHeight: '400px',
        ...style
      }}
    >
      <Empty
        image={typeof config.icon === 'string' ? (
          <div style={{ fontSize: 64 }}>{config.icon}</div>
        ) : config.icon}
        description={
          <div style={{ marginTop: 16 }}>
            <div style={{
              fontSize: 16,
              fontWeight: 500,
              color: '#1f2937',
              marginBottom: 8
            }}>
              {config.title}
            </div>
            {config.description && (
              <div style={{
                fontSize: 14,
                color: '#6b7280',
                maxWidth: 400,
                margin: '0 auto'
              }}>
                {config.description}
              </div>
            )}
          </div>
        }
      />

      {config.actionText && onAction && (
        <Button
          type="primary"
          icon={config.actionIcon}
          onClick={onAction}
          style={{
            marginTop: 24,
            borderRadius: 8,
            height: 40,
            padding: '0 24px',
            fontSize: 14,
            fontWeight: 500
          }}
        >
          {config.actionText}
        </Button>
      )}
    </div>
  )
}

export default EmptyState
