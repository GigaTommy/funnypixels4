import React, { useState, useEffect } from 'react'
import {
  Card,
  Table,
  Tag,
  Select,
  Input,
  DatePicker,
  Row,
  Col,
  Statistic,
  Space,
  Button,
  message
} from 'antd'
import {
  SearchOutlined,
  ReloadOutlined,
  AuditOutlined,
  FileProtectOutlined,
  BarChartOutlined
} from '@ant-design/icons'
import { auditService, type AuditLog, type AuditLogStats } from '@/services/audit'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'

const { Option } = Select
const { RangePicker } = DatePicker

const actionColorMap: Record<string, string> = {
  create: 'blue',
  update: 'orange',
  delete: 'red',
  approve: 'green',
  reject: 'red',
  ban: 'red',
  disband: 'red',
  refund: 'purple'
}

const moduleColorMap: Record<string, string> = {
  user: 'blue',
  alliance: 'purple',
  achievement: 'gold',
  payment: 'green',
  feedback: 'cyan'
}

const moduleOptions = [
  { label: '用户', value: 'user' },
  { label: '联盟', value: 'alliance' },
  { label: '成就', value: 'achievement' },
  { label: '公告', value: 'announcement' },
  { label: '广告', value: 'ad' },
  { label: '自定义旗帜', value: 'custom_flag' },
  { label: '签到', value: 'checkin' },
  { label: '挑战', value: 'challenge' },
  { label: '支付', value: 'payment' },
  { label: '反馈', value: 'feedback' }
]

const actionOptions = [
  { label: '创建', value: 'create' },
  { label: '更新', value: 'update' },
  { label: '删除', value: 'delete' },
  { label: '审批通过', value: 'approve' },
  { label: '审批拒绝', value: 'reject' },
  { label: '封禁', value: 'ban' },
  { label: '解散', value: 'disband' },
  { label: '退款', value: 'refund' }
]

const AuditLogPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [current, setCurrent] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [stats, setStats] = useState<AuditLogStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)

  // 筛选状态
  const [searchAdmin, setSearchAdmin] = useState('')
  const [filterModule, setFilterModule] = useState<string | undefined>(undefined)
  const [filterAction, setFilterAction] = useState<string | undefined>(undefined)
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)

  // 加载审计日志
  const loadLogs = async () => {
    setLoading(true)
    try {
      const params: any = {
        current,
        pageSize,
      }
      if (searchAdmin) params.admin_name = searchAdmin
      if (filterModule) params.module = filterModule
      if (filterAction) params.action = filterAction
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.start_date = dateRange[0].format('YYYY-MM-DD')
        params.end_date = dateRange[1].format('YYYY-MM-DD')
      }

      const response = await auditService.getLogs(params)
      setLogs(response.list)
      setTotal(response.total)
    } catch (error) {
      message.error('加载审计日志失败')
      console.error('加载审计日志失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 加载统计数据
  const loadStats = async () => {
    setStatsLoading(true)
    try {
      const data = await auditService.getStats()
      setStats(data)
    } catch (error) {
      console.error('加载统计数据失败:', error)
    } finally {
      setStatsLoading(false)
    }
  }

  // 处理搜索
  const handleSearch = () => {
    setCurrent(1)
    loadLogs()
  }

  // 处理重置
  const handleReset = () => {
    setSearchAdmin('')
    setFilterModule(undefined)
    setFilterAction(undefined)
    setDateRange(null)
    setCurrent(1)
  }

  // 处理分页变化
  const handleTableChange = (pagination: any) => {
    setCurrent(pagination.current)
    setPageSize(pagination.pageSize)
  }

  // 获取模块分布描述（前3个）
  const getModuleDistribution = (): string => {
    if (!stats || !stats.module_stats || stats.module_stats.length === 0) {
      return '-'
    }
    const sorted = [...stats.module_stats].sort((a, b) => b.count - a.count)
    return sorted
      .slice(0, 3)
      .map((item) => {
        const label = moduleOptions.find((m) => m.value === item.module)?.label || item.module
        return `${label}(${item.count})`
      })
      .join(', ')
  }

  // 获取状态码颜色
  const getStatusColor = (status: number): string => {
    if (status >= 200 && status < 300) return 'green'
    if (status >= 400 && status < 500) return 'orange'
    if (status >= 500) return 'red'
    return 'default'
  }

  // 表格列定义
  const columns: ColumnsType<AuditLog> = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => (
        <span style={{ color: '#6b7280', fontSize: '13px' }}>
          {dayjs(date).format('YYYY-MM-DD HH:mm:ss')}
        </span>
      ),
      sorter: (a, b) => dayjs(a.created_at).unix() - dayjs(b.created_at).unix(),
      defaultSortOrder: 'descend'
    },
    {
      title: '管理员',
      dataIndex: 'admin_name',
      key: 'admin_name',
      width: 120,
      render: (name: string) => (
        <span style={{ fontWeight: 500, color: '#1f2937' }}>{name}</span>
      )
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      width: 100,
      render: (action: string) => (
        <Tag
          color={actionColorMap[action] || 'default'}
          style={{
            borderRadius: '12px',
            fontWeight: '500',
            padding: '2px 10px'
          }}
        >
          {actionOptions.find((a) => a.value === action)?.label || action}
        </Tag>
      )
    },
    {
      title: '模块',
      dataIndex: 'module',
      key: 'module',
      width: 110,
      render: (module: string) => (
        <Tag
          color={moduleColorMap[module] || 'default'}
          style={{
            borderRadius: '12px',
            fontWeight: '500',
            padding: '2px 10px'
          }}
        >
          {moduleOptions.find((m) => m.value === module)?.label || module}
        </Tag>
      )
    },
    {
      title: '目标',
      key: 'target',
      width: 160,
      render: (_: any, record: AuditLog) => (
        <span style={{ color: '#6b7280', fontSize: '13px' }}>
          {record.target_type && record.target_id
            ? `${record.target_type} #${record.target_id}`
            : '-'}
        </span>
      )
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text: string) => (
        <span style={{ color: '#6b7280', fontSize: '13px' }}>{text || '-'}</span>
      )
    },
    {
      title: 'IP地址',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 140,
      render: (ip: string) => (
        <span style={{ color: '#6b7280', fontSize: '13px', fontFamily: 'monospace' }}>
          {ip || '-'}
        </span>
      )
    },
    {
      title: '状态码',
      dataIndex: 'response_status',
      key: 'response_status',
      width: 90,
      align: 'center',
      render: (status: number) => (
        <Tag
          color={getStatusColor(status)}
          style={{
            borderRadius: '12px',
            fontWeight: '500',
            padding: '2px 10px'
          }}
        >
          {status}
        </Tag>
      )
    }
  ]

  // 初始加载
  useEffect(() => {
    loadLogs()
  }, [current, pageSize])

  useEffect(() => {
    loadStats()
  }, [])

  // 重置后重新加载
  useEffect(() => {
    if (!searchAdmin && !filterModule && !filterAction && !dateRange) {
      loadLogs()
    }
  }, [searchAdmin, filterModule, filterAction, dateRange])

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      {/* 页面标题区域 */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          padding: '24px',
          marginBottom: '24px',
          border: '1px solid #f0f0f0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              backgroundColor: '#1677ff',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '16px'
            }}
          >
            <FileProtectOutlined style={{ color: 'white', fontSize: '20px' }} />
          </div>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: '28px',
                fontWeight: '700',
                color: '#1f2937',
                lineHeight: '1.2'
              }}
            >
              审计日志
            </h1>
            <p
              style={{
                margin: '4px 0 0 0',
                fontSize: '14px',
                color: '#6b7280',
                lineHeight: '1.4'
              }}
            >
              记录管理员的所有操作行为，保障系统安全与可追溯性
            </p>
          </div>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              handleReset()
              loadStats()
            }}
            style={{ borderRadius: '8px', fontWeight: '500' }}
          >
            重置
          </Button>
        </Space>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={8}>
          <Card
            loading={statsLoading}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #f0f0f0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
            }}
          >
            <Statistic
              title="今日操作数"
              value={stats?.today_count || 0}
              prefix={<AuditOutlined style={{ color: '#1677ff' }} />}
              valueStyle={{ color: '#1677ff' }}
            />
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
              今日管理员操作总量
            </p>
          </Card>
        </Col>
        <Col span={16}>
          <Card
            loading={statsLoading}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #f0f0f0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
            }}
          >
            <Statistic
              title="模块分布 (Top 3)"
              value={getModuleDistribution()}
              prefix={<BarChartOutlined style={{ color: '#10b981' }} />}
              valueStyle={{ color: '#10b981', fontSize: '18px' }}
            />
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
              操作最频繁的模块
            </p>
          </Card>
        </Col>
      </Row>

      {/* 搜索和筛选区域 */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '24px',
          border: '1px solid #f0f0f0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '16px',
            alignItems: 'center',
            flexWrap: 'wrap'
          }}
        >
          <Input
            placeholder="搜索管理员名称"
            value={searchAdmin}
            onChange={(e) => setSearchAdmin(e.target.value)}
            style={{ width: 200, borderRadius: '8px' }}
            prefix={<SearchOutlined />}
            allowClear
          />
          <Select
            placeholder="选择模块"
            value={filterModule}
            onChange={(value) => setFilterModule(value)}
            style={{ width: 160 }}
            allowClear
          >
            {moduleOptions.map((opt) => (
              <Option key={opt.value} value={opt.value}>
                {opt.label}
              </Option>
            ))}
          </Select>
          <Select
            placeholder="操作类型"
            value={filterAction}
            onChange={(value) => setFilterAction(value)}
            style={{ width: 140 }}
            allowClear
          >
            {actionOptions.map((opt) => (
              <Option key={opt.value} value={opt.value}>
                {opt.label}
              </Option>
            ))}
          </Select>
          <RangePicker
            value={dateRange}
            onChange={(dates) =>
              setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)
            }
            style={{ borderRadius: '8px' }}
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={handleSearch}
            style={{ borderRadius: '6px', fontWeight: '500' }}
          >
            搜索
          </Button>
        </div>
      </div>

      {/* 主要内容区域 */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #f0f0f0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          padding: '24px'
        }}
      >
        <Table
          columns={columns}
          dataSource={logs}
          rowKey="id"
          loading={loading}
          pagination={{
            current,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
            pageSizeOptions: ['10', '20', '50', '100']
          }}
          onChange={handleTableChange}
          scroll={{ x: 1100 }}
          style={{ borderRadius: '12px' }}
        />
      </div>
    </div>
  )
}

export default AuditLogPage
