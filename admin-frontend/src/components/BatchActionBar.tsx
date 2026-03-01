import React from 'react'
import { Button, Space, Popconfirm, message } from 'antd'
import { DeleteOutlined, CheckOutlined, CloseOutlined, ExportOutlined } from '@ant-design/icons'

export interface BatchAction {
  key: string
  label: string
  icon?: React.ReactNode
  danger?: boolean
  confirm?: boolean
  confirmTitle?: string
  onClick: () => void | Promise<void>
}

interface BatchActionBarProps {
  selectedCount: number
  totalCount?: number
  actions?: BatchAction[]
  onClearSelection?: () => void
  style?: React.CSSProperties
}

const BatchActionBar: React.FC<BatchActionBarProps> = ({
  selectedCount,
  totalCount,
  actions = [],
  onClearSelection,
  style
}) => {
  if (selectedCount === 0) return null

  const handleAction = async (action: BatchAction) => {
    try {
      await action.onClick()
      message.success('操作成功')
    } catch (error) {
      console.error('Batch action failed:', error)
      message.error('操作失败')
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        backgroundColor: '#fff',
        borderRadius: '8px',
        padding: '16px 24px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
        border: '1px solid #f0f0f0',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        ...style
      }}
    >
      {/* 选中信息 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        paddingRight: '16px',
        borderRight: '1px solid #f0f0f0'
      }}>
        <CheckOutlined style={{ color: '#10b981', fontSize: '16px' }} />
        <span style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>
          已选择 <strong style={{ color: '#1677ff' }}>{selectedCount}</strong> 项
          {totalCount && <span style={{ color: '#6b7280' }}> / 共 {totalCount} 项</span>}
        </span>
      </div>

      {/* 批量操作按钮 */}
      <Space size="small">
        {actions.map(action => {
          const button = (
            <Button
              key={action.key}
              type={action.danger ? 'primary' : 'default'}
              danger={action.danger}
              icon={action.icon}
              size="small"
              onClick={() => !action.confirm && handleAction(action)}
              style={{
                borderRadius: '6px',
                fontSize: '13px'
              }}
            >
              {action.label}
            </Button>
          )

          if (action.confirm) {
            return (
              <Popconfirm
                key={action.key}
                title={action.confirmTitle || `确定要${action.label}吗？`}
                onConfirm={() => handleAction(action)}
                okText="确定"
                cancelText="取消"
                okType={action.danger ? 'danger' : 'primary'}
              >
                {button}
              </Popconfirm>
            )
          }

          return button
        })}
      </Space>

      {/* 取消选择按钮 */}
      <Button
        type="text"
        size="small"
        icon={<CloseOutlined />}
        onClick={onClearSelection}
        style={{
          marginLeft: 'auto',
          color: '#6b7280'
        }}
      >
        取消
      </Button>
    </div>
  )
}

// 预定义的常用批量操作
export const commonBatchActions = {
  batchDelete: (onDelete: () => void | Promise<void>): BatchAction => ({
    key: 'delete',
    label: '批量删除',
    icon: <DeleteOutlined />,
    danger: true,
    confirm: true,
    confirmTitle: '确定要删除选中的项吗？此操作不可恢复。',
    onClick: onDelete
  }),

  batchEnable: (onEnable: () => void | Promise<void>): BatchAction => ({
    key: 'enable',
    label: '批量启用',
    icon: <CheckOutlined />,
    onClick: onEnable
  }),

  batchDisable: (onDisable: () => void | Promise<void>): BatchAction => ({
    key: 'disable',
    label: '批量禁用',
    icon: <CloseOutlined />,
    onClick: onDisable
  }),

  batchExport: (onExport: () => void | Promise<void>): BatchAction => ({
    key: 'export',
    label: '导出选中',
    icon: <ExportOutlined />,
    onClick: onExport
  })
}

export default BatchActionBar
