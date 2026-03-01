import React, { useState, useRef } from 'react'
import {
  Card,
  Button,
  Space,
  Input,
  Select,
  DatePicker,
  Table,
  Tag,
  App,
  Popconfirm,
  Row,
  Col
} from 'antd'
import {
  SearchOutlined,
  ReloadOutlined,
  DeleteOutlined,
  ExportOutlined,
  EyeOutlined,
  BugOutlined,
  InfoCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons'
import { systemService } from '@/services'
import type { SystemLog, GetSystemLogsParams } from '@/types'
import SafeProTable from '@/components/SafeProTable'
import type { ProColumns, ActionType } from '@ant-design/pro-components'

const { Option } = Select
const { RangePicker } = DatePicker

const LogManagement: React.FC = () => {
  const { message } = App.useApp()
  const actionRef = useRef<ActionType>()

  // 日志级别配置
  const logLevelConfig = {
    info: { color: '#10b981', icon: <InfoCircleOutlined />, label: '信息' },
    warn: { color: '#f59e0b', icon: <ExclamationCircleOutlined />, label: '警告' },
    error: { color: '#ef4444', icon: <CloseCircleOutlined />, label: '错误' },
    debug: { color: '#6b7280', icon: <BugOutlined />, label: '调试' }
  }

  // 表格列配置
  const columns: ProColumns<SystemLog>[] = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      search: false,
      render: (text) => (
        <span style={{ color: '#6b7280', fontSize: '13px' }}>
          {text}
        </span>
      ),
    },
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      width: 100,
      filters: true,
      onFilter: true,
      valueType: 'select',
      valueEnum: {
        info: { text: '信息', status: 'Default' },
        warn: { text: '警告', status: 'Warning' },
        error: { text: '错误', status: 'Error' },
        debug: { text: '调试', status: 'Default' },
      },
      render: (_, record) => {
        const config = logLevelConfig[record.level as keyof typeof logLevelConfig]
        return (
          <Tag color={config?.color} style={{ borderRadius: '12px' }}>
            {config?.icon} {config?.label}
          </Tag>
        )
      },
    },
    {
      title: '模块',
      dataIndex: 'module',
      key: 'module',
      width: 120,
      filters: true,
      onFilter: true,
      valueType: 'select',
      valueEnum: {
        auth: { text: '认证' },
        user: { text: '用户' },
        system: { text: '系统' },
        api: { text: '接口' },
        database: { text: '数据库' },
        file: { text: '文件' },
      },
      render: (text) => (
        <Tag color="blue" style={{ borderRadius: '12px' }}>
          {text}
        </Tag>
      ),
    },
    {
      title: '消息',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
      search: false,
      render: (text) => (
        <span style={{ color: '#1f2937', fontSize: '14px' }}>
          {text}
        </span>
      ),
    },
    {
      title: '用户ID',
      dataIndex: 'user_id',
      key: 'user_id',
      width: 120,
      search: false,
      render: (text) => text ? (
        <span style={{ color: '#1677ff', fontSize: '13px' }}>
          {text}
        </span>
      ) : (
        <span style={{ color: '#6b7280', fontSize: '13px' }}>系统</span>
      ),
    },
    {
      title: 'IP地址',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 140,
      search: false,
      render: (text) => text ? (
        <span style={{ color: '#6b7280', fontSize: '13px' }}>
          {text}
        </span>
      ) : (
        <span style={{ color: '#6b7280', fontSize: '13px' }}>-</span>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      search: false,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetails(record)}
          >
            详情
          </Button>
        </Space>
      ),
    },
  ]

  // 查看日志详情
  const handleViewDetails = (record: SystemLog) => {
    message.info(`查看日志详情: ${record.id}`)
  }

  // 清理过期日志
  const handleClearLogs = async () => {
    try {
      message.loading('正在清理日志...', 0)
      // TODO: 实现清理日志的API
      await new Promise(resolve => setTimeout(resolve, 1000))
      message.destroy()
      message.success('日志清理完成')
      actionRef.current?.reload()
    } catch (error) {
      message.destroy()
      message.error('日志清理失败')
    }
  }

  // 导出日志
  const handleExportLogs = () => {
    message.info('导出功能开发中...')
  }

  return (
    <div style={{
      position: 'relative',
      minHeight: '100vh'
    }}>
      {/* 页面标题区域 */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        padding: '24px',
        marginBottom: '24px',
        border: '1px solid #f0f0f0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            backgroundColor: '#1677ff',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '16px'
          }}>
            <span style={{
              color: 'white',
              fontSize: '20px'
            }}>📋</span>
          </div>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: '28px',
              fontWeight: '700',
              color: '#1f2937',
              lineHeight: '1.2'
            }}>
              日志管理
            </h1>
            <p style={{
              margin: '4px 0 0 0',
              fontSize: '14px',
              color: '#6b7280',
              lineHeight: '1.4'
            }}>
              监控系统运行状态，快速定位问题
            </p>
          </div>
        </div>
        <Space>
          <Popconfirm
            title="确定要清理30天前的日志吗？"
            onConfirm={handleClearLogs}
            okText="确定"
            cancelText="取消"
          >
            <Button
              icon={<DeleteOutlined />}
              style={{
                borderRadius: '8px',
                fontWeight: '500',
                borderColor: '#ef4444',
                color: '#ef4444'
              }}
            >
              清理日志
            </Button>
          </Popconfirm>
          <Button
            icon={<ExportOutlined />}
            onClick={handleExportLogs}
            type="primary"
            style={{
              borderRadius: '6px',
              fontWeight: '500'
            }}
          >
            导出日志
          </Button>
        </Space>
      </div>

      {/* 主要内容区域 */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        border: '1px solid #f0f0f0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        padding: '24px'
      }}>
        {/* 日志统计卡片 */}
        <Row gutter={16} style={{ marginBottom: '24px' }}>
          <Col span={6}>
            <Card style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #f0f0f0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{
                    fontSize: '24px',
                    fontWeight: '700',
                    color: '#1f2937'
                  }}>
                    1,234
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: '#6b7280',
                    marginTop: '4px'
                  }}>
                    今日日志总数
                  </div>
                </div>
                <div style={{
                  width: '48px',
                  height: '48px',
                  backgroundColor: 'rgba(22, 119, 255, 0.1)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <InfoCircleOutlined style={{
                    fontSize: '24px',
                    color: '#1677ff'
                  }} />
                </div>
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #f0f0f0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{
                    fontSize: '24px',
                    fontWeight: '700',
                    color: '#ef4444'
                  }}>
                    23
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: '#6b7280',
                    marginTop: '4px'
                  }}>
                    错误日志
                  </div>
                </div>
                <div style={{
                  width: '48px',
                  height: '48px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <CloseCircleOutlined style={{
                    fontSize: '24px',
                    color: '#ef4444'
                  }} />
                </div>
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #f0f0f0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{
                    fontSize: '24px',
                    fontWeight: '700',
                    color: '#f59e0b'
                  }}>
                    156
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: '#6b7280',
                    marginTop: '4px'
                  }}>
                    警告日志
                  </div>
                </div>
                <div style={{
                  width: '48px',
                  height: '48px',
                  backgroundColor: 'rgba(245, 158, 11, 0.1)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <ExclamationCircleOutlined style={{
                    fontSize: '24px',
                    color: '#f59e0b'
                  }} />
                </div>
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card style={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(8px)',
              borderRadius: '16px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{
                    fontSize: '24px',
                    fontWeight: '700',
                    color: '#10b981'
                  }}>
                    1,055
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: '#6b7280',
                    marginTop: '4px'
                  }}>
                    正常日志
                  </div>
                </div>
                <div style={{
                  width: '48px',
                  height: '48px',
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <InfoCircleOutlined style={{
                    fontSize: '24px',
                    color: '#10b981'
                  }} />
                </div>
              </div>
            </Card>
          </Col>
        </Row>

        {/* 日志列表 */}
        <SafeProTable
          columns={columns}
          actionRef={actionRef}
          request={async (params) => {
            try {
              const response = await systemService.logs.getLogs({
                current: params.current,
                pageSize: params.pageSize,
                level: params.level as any,
                module: params.module,
                start_date: params.created_at && Array.isArray(params.created_at) ? params.created_at[0] : undefined,
                end_date: params.created_at && Array.isArray(params.created_at) ? params.created_at[1] : undefined,
              })

              return {
                data: response?.list || [],
                success: true,
                total: response?.total || 0,
              }
            } catch (error) {
              console.error('Get logs failed:', error)
              message.error('获取日志列表失败')
              return {
                data: [],
                success: false,
                total: 0,
              }
            }
          }}
          rowKey="id"
          search={{
            labelWidth: 'auto',
            defaultCollapsed: false,
          }}
          pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条日志`,
          }}
          dateFormatter="string"
          headerTitle="系统日志"
          toolBarRender={() => [
            <Button
              key="refresh"
              icon={<ReloadOutlined />}
              onClick={() => actionRef.current?.reload()}
              style={{
                borderRadius: '8px',
                fontWeight: '500'
              }}
            >
              刷新
            </Button>,
          ]}
          scroll={{ x: 1200 }}
        />
      </div>
    </div>
  )
}

export default LogManagement