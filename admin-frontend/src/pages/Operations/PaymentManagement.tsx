import React, { useState, useEffect } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Input,
  Select,
  DatePicker,
  Row,
  Col,
  Statistic,
  message,
  Tabs,
  Descriptions,
  Popconfirm,
  Typography,
} from 'antd'
import {
  DollarOutlined,
  SearchOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import PageHeader from '@/components/PageHeader'
import { paymentService, type PaymentStats } from '@/services/payment'

const { RangePicker } = DatePicker
const { Option } = Select
const { TextArea } = Input
const { Text } = Typography

// 交易流水记录
interface Transaction {
  id: string
  user_id: string
  username: string
  nickname: string
  delta_points: number
  reason: string
  ref_id: string
  created_at: string
}

// 充值订单
interface RechargeOrder {
  id: string
  user_id: string
  username: string
  nickname: string
  amount: number
  points_amount: number
  channel: string
  status: 'pending' | 'paid' | 'failed'
  refund_status: string | null
  created_at: string
}

const PaymentManagement: React.FC = () => {
  // 统计数据
  const [stats, setStats] = useState<PaymentStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)

  // 交易流水
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [transLoading, setTransLoading] = useState(false)
  const [transPagination, setTransPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  })
  const [transFilters, setTransFilters] = useState({
    username: '',
    dateRange: null as any,
  })

  // 充值订单
  const [orders, setOrders] = useState<RechargeOrder[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersPagination, setOrdersPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  })
  const [ordersFilters, setOrdersFilters] = useState({
    status: undefined as string | undefined,
    dateRange: null as any,
  })

  // 退款记录
  const [refunds, setRefunds] = useState<Transaction[]>([])
  const [refundsLoading, setRefundsLoading] = useState(false)
  const [refundsPagination, setRefundsPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  })

  // 退款弹窗
  const [refundModalVisible, setRefundModalVisible] = useState(false)
  const [refundOrder, setRefundOrder] = useState<RechargeOrder | null>(null)
  const [refundReason, setRefundReason] = useState('')
  const [refundSubmitting, setRefundSubmitting] = useState(false)

  // 当前 Tab
  const [activeTab, setActiveTab] = useState('transactions')

  // 获取统计数据
  const fetchStats = async () => {
    setStatsLoading(true)
    try {
      const data = await paymentService.getStats()
      setStats(data)
    } catch (error) {
      console.error('获取支付统计失败:', error)
      message.error('获取支付统计失败')
    } finally {
      setStatsLoading(false)
    }
  }

  // 获取交易流水
  const fetchTransactions = async (params: any = {}) => {
    setTransLoading(true)
    try {
      const queryParams: any = {
        current: params.current || transPagination.current,
        pageSize: params.pageSize || transPagination.pageSize,
      }
      if (transFilters.username) queryParams.username = transFilters.username
      if (transFilters.dateRange && transFilters.dateRange.length === 2) {
        queryParams.start_date = transFilters.dateRange[0].toISOString()
        queryParams.end_date = transFilters.dateRange[1].toISOString()
      }

      const data = await paymentService.getTransactions(queryParams)
      setTransactions(data.list || [])
      setTransPagination({
        current: data.current || queryParams.current,
        pageSize: data.pageSize || queryParams.pageSize,
        total: data.total || 0,
      })
    } catch (error) {
      console.error('获取交易流水失败:', error)
      message.error('获取交易流水失败')
    } finally {
      setTransLoading(false)
    }
  }

  // 获取充值订单
  const fetchOrders = async (params: any = {}) => {
    setOrdersLoading(true)
    try {
      const queryParams: any = {
        current: params.current || ordersPagination.current,
        pageSize: params.pageSize || ordersPagination.pageSize,
      }
      if (ordersFilters.status) queryParams.status = ordersFilters.status
      if (ordersFilters.dateRange && ordersFilters.dateRange.length === 2) {
        queryParams.start_date = ordersFilters.dateRange[0].toISOString()
        queryParams.end_date = ordersFilters.dateRange[1].toISOString()
      }

      const data = await paymentService.getRechargeOrders(queryParams)
      setOrders(data.list || [])
      setOrdersPagination({
        current: data.current || queryParams.current,
        pageSize: data.pageSize || queryParams.pageSize,
        total: data.total || 0,
      })
    } catch (error) {
      console.error('获取充值订单失败:', error)
      message.error('获取充值订单失败')
    } finally {
      setOrdersLoading(false)
    }
  }

  // 获取退款记录
  const fetchRefunds = async (params: any = {}) => {
    setRefundsLoading(true)
    try {
      const queryParams: any = {
        current: params.current || refundsPagination.current,
        pageSize: params.pageSize || refundsPagination.pageSize,
        type: 'refund',
      }

      const data = await paymentService.getTransactions(queryParams)
      setRefunds(data.list || [])
      setRefundsPagination({
        current: data.current || queryParams.current,
        pageSize: data.pageSize || queryParams.pageSize,
        total: data.total || 0,
      })
    } catch (error) {
      console.error('获取退款记录失败:', error)
      message.error('获取退款记录失败')
    } finally {
      setRefundsLoading(false)
    }
  }

  // 初始化加载
  useEffect(() => {
    fetchStats()
    fetchTransactions()
    fetchOrders()
    fetchRefunds()
  }, [])

  // Tab 切换时刷新对应数据
  const handleTabChange = (key: string) => {
    setActiveTab(key)
    if (key === 'transactions') fetchTransactions()
    if (key === 'orders') fetchOrders()
    if (key === 'refunds') fetchRefunds()
  }

  // 打开退款弹窗
  const handleOpenRefund = (record: RechargeOrder) => {
    setRefundOrder(record)
    setRefundReason('')
    setRefundModalVisible(true)
  }

  // 提交退款
  const handleRefundSubmit = async () => {
    if (!refundOrder) return
    if (!refundReason.trim()) {
      message.warning('请填写退款原因')
      return
    }

    setRefundSubmitting(true)
    try {
      await paymentService.processRefund({
        order_id: refundOrder.id,
        reason: refundReason.trim(),
      })
      message.success('退款处理成功')
      setRefundModalVisible(false)
      setRefundOrder(null)
      setRefundReason('')
      fetchOrders()
      fetchStats()
      fetchRefunds()
    } catch (error) {
      console.error('退款处理失败:', error)
      message.error('退款处理失败')
    } finally {
      setRefundSubmitting(false)
    }
  }

  // 交易流水表格列
  const transactionColumns: ColumnsType<Transaction> = [
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
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    },
    {
      title: '用户',
      dataIndex: 'nickname',
      key: 'nickname',
      width: 150,
      render: (nickname: string, record) => (
        <div>
          <div style={{ fontWeight: 600, color: '#1f2937' }}>{nickname || record.username}</div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>@{record.username}</div>
        </div>
      ),
    },
    {
      title: '类型',
      dataIndex: 'delta_points',
      key: 'type',
      width: 80,
      render: (delta: number) => (
        <Tag color={delta > 0 ? 'green' : 'red'}>
          {delta > 0 ? '收入' : '支出'}
        </Tag>
      ),
    },
    {
      title: '金额',
      dataIndex: 'delta_points',
      key: 'delta_points',
      width: 120,
      render: (delta: number) => (
        <span style={{
          fontWeight: 600,
          color: delta > 0 ? '#10b981' : '#ef4444',
          fontSize: '14px',
        }}>
          {delta > 0 ? '+' : ''}{delta}
        </span>
      ),
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
    },
    {
      title: '关联ID',
      dataIndex: 'ref_id',
      key: 'ref_id',
      width: 200,
      ellipsis: true,
      render: (refId: string) => (
        <Text copyable={refId ? { text: refId } : false} style={{ fontSize: '12px', color: '#6b7280' }}>
          {refId || '-'}
        </Text>
      ),
    },
  ]

  // 充值订单表格列
  const orderColumns: ColumnsType<RechargeOrder> = [
    {
      title: '订单号',
      dataIndex: 'id',
      key: 'id',
      width: 220,
      ellipsis: true,
      render: (id: string) => (
        <Text copyable={{ text: id }} style={{ fontSize: '12px' }}>
          {id}
        </Text>
      ),
    },
    {
      title: '用户',
      dataIndex: 'nickname',
      key: 'nickname',
      width: 150,
      render: (nickname: string, record) => (
        <div>
          <div style={{ fontWeight: 600, color: '#1f2937' }}>{nickname || record.username}</div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>@{record.username}</div>
        </div>
      ),
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 100,
      render: (amount: number) => (
        <span style={{ fontWeight: 600, color: '#1677ff', fontSize: '14px' }}>
          ¥{amount}
        </span>
      ),
    },
    {
      title: '积分',
      dataIndex: 'points_amount',
      key: 'points_amount',
      width: 100,
      render: (points: number) => (
        <span style={{ fontWeight: 600, color: '#f59e0b' }}>
          {points}
        </span>
      ),
    },
    {
      title: '渠道',
      dataIndex: 'channel',
      key: 'channel',
      width: 100,
      render: (channel: string) => {
        const channelColors: Record<string, string> = {
          apple: 'blue',
          google: 'green',
          wechat: 'lime',
          alipay: 'cyan',
          stripe: 'purple',
        }
        return (
          <Tag color={channelColors[channel] || 'default'}>
            {channel}
          </Tag>
        )
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: string) => {
        const statusConfig: Record<string, { color: string; label: string }> = {
          paid: { color: 'green', label: '已支付' },
          pending: { color: 'orange', label: '待支付' },
          failed: { color: 'red', label: '失败' },
        }
        const config = statusConfig[status] || { color: 'default', label: status }
        return <Tag color={config.color}>{config.label}</Tag>
      },
    },
    {
      title: '退款状态',
      dataIndex: 'refund_status',
      key: 'refund_status',
      width: 100,
      render: (refundStatus: string | null) => {
        if (!refundStatus) return <span style={{ color: '#9ca3af' }}>-</span>
        const refundConfig: Record<string, { color: string; label: string }> = {
          refunded: { color: 'red', label: '已退款' },
          partial: { color: 'orange', label: '部分退款' },
          processing: { color: 'blue', label: '退款中' },
        }
        const config = refundConfig[refundStatus] || { color: 'default', label: refundStatus }
        return <Tag color={config.color}>{config.label}</Tag>
      },
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (date: string) => (
        <span style={{ color: '#6b7280', fontSize: '13px' }}>
          {dayjs(date).format('YYYY-MM-DD HH:mm:ss')}
        </span>
      ),
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => {
        if (record.status === 'paid' && !record.refund_status) {
          return (
            <Button
              type="link"
              danger
              size="small"
              icon={<ExclamationCircleOutlined />}
              onClick={() => handleOpenRefund(record)}
            >
              退款
            </Button>
          )
        }
        return <span style={{ color: '#9ca3af' }}>-</span>
      },
    },
  ]

  // 退款记录表格列
  const refundColumns: ColumnsType<Transaction> = [
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
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    },
    {
      title: '用户',
      dataIndex: 'nickname',
      key: 'nickname',
      width: 150,
      render: (nickname: string, record) => (
        <div>
          <div style={{ fontWeight: 600, color: '#1f2937' }}>{nickname || record.username}</div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>@{record.username}</div>
        </div>
      ),
    },
    {
      title: '退款金额',
      dataIndex: 'delta_points',
      key: 'delta_points',
      width: 120,
      render: (delta: number) => (
        <span style={{ fontWeight: 600, color: '#ef4444', fontSize: '14px' }}>
          {delta}
        </span>
      ),
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
    },
    {
      title: '关联订单',
      dataIndex: 'ref_id',
      key: 'ref_id',
      width: 220,
      ellipsis: true,
      render: (refId: string) => (
        <Text copyable={refId ? { text: refId } : false} style={{ fontSize: '12px', color: '#6b7280' }}>
          {refId || '-'}
        </Text>
      ),
    },
  ]

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      {/* 页面头部 */}
      <PageHeader
        title="支付退款管理"
        description="管理支付交易和退款"
        icon={<DollarOutlined style={{ color: 'white', fontSize: '20px' }} />}
        actions={[
          {
            key: 'refresh',
            label: '刷新数据',
            icon: <ReloadOutlined />,
            onClick: () => {
              fetchStats()
              if (activeTab === 'transactions') fetchTransactions()
              if (activeTab === 'orders') fetchOrders()
              if (activeTab === 'refunds') fetchRefunds()
            },
          },
        ]}
      />

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #f0f0f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          }}>
            <Statistic
              title="总收入"
              value={stats?.total_revenue || 0}
              prefix="¥"
              precision={2}
              valueStyle={{ color: '#1677ff' }}
              loading={statsLoading}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #f0f0f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          }}>
            <Statistic
              title="今日收入"
              value={stats?.today_revenue || 0}
              prefix="¥"
              precision={2}
              valueStyle={{ color: '#10b981' }}
              loading={statsLoading}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #f0f0f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          }}>
            <Statistic
              title="退款总数"
              value={stats?.total_refunds || 0}
              valueStyle={{ color: '#ef4444' }}
              loading={statsLoading}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #f0f0f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          }}>
            <Statistic
              title="平均订单金额"
              value={stats?.avg_order_amount || 0}
              prefix="¥"
              valueStyle={{ color: '#f59e0b' }}
              loading={statsLoading}
            />
          </Card>
        </Col>
      </Row>

      {/* 主要内容区域 */}
      <Card
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #f0f0f0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          items={[
            {
              key: 'transactions',
              label: '交易流水',
              children: (
                <>
                  {/* 筛选器 */}
                  <div style={{ marginBottom: '16px' }}>
                    <Row gutter={16}>
                      <Col span={6}>
                        <Input
                          placeholder="搜索用户名"
                          value={transFilters.username}
                          onChange={(e) =>
                            setTransFilters({ ...transFilters, username: e.target.value })
                          }
                          onPressEnter={() => fetchTransactions({ current: 1 })}
                          suffix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                          allowClear
                        />
                      </Col>
                      <Col span={8}>
                        <RangePicker
                          style={{ width: '100%' }}
                          onChange={(dates) =>
                            setTransFilters({ ...transFilters, dateRange: dates })
                          }
                          placeholder={['开始日期', '结束日期']}
                        />
                      </Col>
                      <Col span={4}>
                        <Button
                          type="primary"
                          icon={<SearchOutlined />}
                          onClick={() => fetchTransactions({ current: 1 })}
                          style={{ width: '100%' }}
                        >
                          搜索
                        </Button>
                      </Col>
                      <Col span={4}>
                        <Button
                          icon={<ReloadOutlined />}
                          onClick={() => {
                            setTransFilters({ username: '', dateRange: null })
                            fetchTransactions({ current: 1 })
                          }}
                          style={{ width: '100%' }}
                        >
                          重置
                        </Button>
                      </Col>
                    </Row>
                  </div>

                  <Table
                    columns={transactionColumns}
                    dataSource={transactions}
                    rowKey="id"
                    loading={transLoading}
                    pagination={{
                      ...transPagination,
                      showSizeChanger: true,
                      showQuickJumper: true,
                      showTotal: (total, range) =>
                        `第 ${range[0]}-${range[1]} 条/共 ${total} 条`,
                      onChange: (page, pageSize) => {
                        fetchTransactions({ current: page, pageSize })
                      },
                    }}
                    scroll={{ x: 900 }}
                  />
                </>
              ),
            },
            {
              key: 'orders',
              label: '充值订单',
              children: (
                <>
                  {/* 筛选器 */}
                  <div style={{ marginBottom: '16px' }}>
                    <Row gutter={16}>
                      <Col span={5}>
                        <Select
                          placeholder="订单状态"
                          allowClear
                          style={{ width: '100%' }}
                          value={ordersFilters.status}
                          onChange={(value) =>
                            setOrdersFilters({ ...ordersFilters, status: value })
                          }
                        >
                          <Option value="pending">待支付</Option>
                          <Option value="paid">已支付</Option>
                          <Option value="failed">失败</Option>
                        </Select>
                      </Col>
                      <Col span={8}>
                        <RangePicker
                          style={{ width: '100%' }}
                          onChange={(dates) =>
                            setOrdersFilters({ ...ordersFilters, dateRange: dates })
                          }
                          placeholder={['开始日期', '结束日期']}
                        />
                      </Col>
                      <Col span={4}>
                        <Button
                          type="primary"
                          icon={<SearchOutlined />}
                          onClick={() => fetchOrders({ current: 1 })}
                          style={{ width: '100%' }}
                        >
                          搜索
                        </Button>
                      </Col>
                      <Col span={4}>
                        <Button
                          icon={<ReloadOutlined />}
                          onClick={() => {
                            setOrdersFilters({ status: undefined, dateRange: null })
                            fetchOrders({ current: 1 })
                          }}
                          style={{ width: '100%' }}
                        >
                          重置
                        </Button>
                      </Col>
                    </Row>
                  </div>

                  <Table
                    columns={orderColumns}
                    dataSource={orders}
                    rowKey="id"
                    loading={ordersLoading}
                    pagination={{
                      ...ordersPagination,
                      showSizeChanger: true,
                      showQuickJumper: true,
                      showTotal: (total, range) =>
                        `第 ${range[0]}-${range[1]} 条/共 ${total} 条`,
                      onChange: (page, pageSize) => {
                        fetchOrders({ current: page, pageSize })
                      },
                    }}
                    scroll={{ x: 1300 }}
                  />
                </>
              ),
            },
            {
              key: 'refunds',
              label: '退款记录',
              children: (
                <Table
                  columns={refundColumns}
                  dataSource={refunds}
                  rowKey="id"
                  loading={refundsLoading}
                  pagination={{
                    ...refundsPagination,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total, range) =>
                      `第 ${range[0]}-${range[1]} 条/共 ${total} 条`,
                    onChange: (page, pageSize) => {
                      fetchRefunds({ current: page, pageSize })
                    },
                  }}
                  scroll={{ x: 900 }}
                />
              ),
            },
          ]}
        />
      </Card>

      {/* 退款弹窗 */}
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#faad14' }} />
            <span>订单退款</span>
          </Space>
        }
        open={refundModalVisible}
        onCancel={() => {
          setRefundModalVisible(false)
          setRefundOrder(null)
          setRefundReason('')
        }}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setRefundModalVisible(false)
              setRefundOrder(null)
              setRefundReason('')
            }}
          >
            取消
          </Button>,
          <Popconfirm
            key="confirm"
            title="确认退款"
            description="退款操作不可撤销，确认要执行退款吗？"
            onConfirm={handleRefundSubmit}
            okText="确认退款"
            cancelText="再想想"
            okButtonProps={{ danger: true }}
          >
            <Button
              type="primary"
              danger
              loading={refundSubmitting}
              disabled={!refundReason.trim()}
            >
              提交退款
            </Button>
          </Popconfirm>,
        ]}
        width={560}
      >
        {refundOrder && (
          <>
            <Descriptions
              column={2}
              bordered
              size="small"
              style={{ marginBottom: '16px' }}
            >
              <Descriptions.Item label="订单号" span={2}>
                <Text copyable={{ text: refundOrder.id }}>
                  {refundOrder.id}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="用户">
                {refundOrder.nickname || refundOrder.username}
              </Descriptions.Item>
              <Descriptions.Item label="用户名">
                @{refundOrder.username}
              </Descriptions.Item>
              <Descriptions.Item label="金额">
                <span style={{ fontWeight: 600, color: '#1677ff' }}>
                  ¥{refundOrder.amount}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="积分">
                <span style={{ fontWeight: 600, color: '#f59e0b' }}>
                  {refundOrder.points_amount}
                </span>
              </Descriptions.Item>
            </Descriptions>

            <div>
              <div style={{ marginBottom: '8px', fontWeight: 500 }}>
                退款原因 <span style={{ color: '#ef4444' }}>*</span>
              </div>
              <TextArea
                rows={4}
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="请详细描述退款原因..."
                maxLength={500}
                showCount
              />
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}

export default PaymentManagement
