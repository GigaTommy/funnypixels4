import React, { useState, useEffect } from 'react'
import {
  Card,
  Tabs,
  Table,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Popconfirm,
  Checkbox,
  Typography,
  Row,
  Col,
  Statistic,
  Empty,
  Tooltip,
  App
} from 'antd'
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  UserOutlined,
  FileTextOutlined,
  FlagOutlined,
  WarningOutlined,
  CheckOutlined,
  CloseOutlined,
  DownOutlined,
  UpOutlined,
  BellOutlined
} from '@ant-design/icons'
import { todoService } from '@/services'
import type { TodoItem, GetTodosParams, TodoStats, ProcessTodoRequest } from '@/types'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

interface TodoModuleProps {
  collapsed?: boolean
  onToggleCollapse?: () => void
}

const TodoModule: React.FC<TodoModuleProps> = ({ collapsed = false, onToggleCollapse }) => {
  const { message } = App.useApp()
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [stats, setStats] = useState<TodoStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('pending')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [selectedPriority, setSelectedPriority] = useState<string>('all')
  const [processModalVisible, setProcessModalVisible] = useState(false)
  const [currentTodo, setCurrentTodo] = useState<TodoItem | null>(null)
  const [processForm] = Form.useForm()
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  })

  // 获取待办统计
  const fetchTodoStats = async () => {
    try {
      const stats = await todoService.getTodoStats()
      setStats(stats)
    } catch (error) {
      console.error('获取待办统计失败:', error)
    }
  }

  // 获取待办列表
  const fetchTodos = async (params: Partial<GetTodosParams> = {}) => {
    try {
      setLoading(true)
      const queryParams: GetTodosParams = {
        current: pagination.current,
        pageSize: pagination.pageSize,
        status: activeTab === 'pending' ? 'pending' : 'processed',
        type: selectedType === 'all' ? undefined : selectedType as any,
        priority: selectedPriority === 'all' ? undefined : selectedPriority as any,
        ...params
      }

      const response = await todoService.getTodos(queryParams)
      setTodos(response.data.list)
      setPagination(prev => ({
        ...prev,
        total: response.data.total,
        current: response.data.current
      }))
    } catch (error) {
      console.error('获取待办列表失败:', error)
      message.error('获取待办列表失败')
    } finally {
      setLoading(false)
    }
  }

  // 处理待办事项
  const handleProcessTodo = async (values: ProcessTodoRequest) => {
    if (!currentTodo) return

    try {
      await todoService.processTodo(currentTodo.id, values, currentTodo.type)
      message.success('处理成功')
      setProcessModalVisible(false)
      processForm.resetFields()
      setCurrentTodo(null)
      fetchTodos()
      fetchTodoStats()
    } catch (error) {
      console.error('处理待办失败:', error)
      message.error('处理失败')
    }
  }

  // 批量处理待办事项
  const handleBatchProcess = async (action: 'approve' | 'reject') => {
    try {
      const pendingTodos = todos.filter(todo => todo.status === 'pending')
      if (pendingTodos.length === 0) {
        message.info('没有待处理的待办事项')
        return
      }

      await todoService.batchProcessTodos(
        pendingTodos.map(todo => todo.id),
        { action }
      )
      message.success(`批量${action === 'approve' ? '通过' : '拒绝'}成功`)
      fetchTodos()
      fetchTodoStats()
    } catch (error) {
      console.error('批量处理失败:', error)
      message.error('批量处理失败')
    }
  }

  // 快速通过
  const handleQuickApprove = async (id: string, type: string) => {
    try {
      await todoService.processTodo(id, { action: 'approve' }, type)
      message.success('已通过')
      fetchTodos()
      fetchTodoStats()
    } catch (error) {
      console.error('快速通过失败:', error)
      message.error('操作失败')
    }
  }

  // 快速拒绝
  const handleQuickReject = async (id: string, type: string) => {
    try {
      await todoService.processTodo(id, { action: 'reject', reason: '快速拒绝' }, type)
      message.success('已拒绝')
      fetchTodos()
      fetchTodoStats()
    } catch (error) {
      console.error('快速拒绝失败:', error)
      message.error('操作失败')
    }
  }

  // 打开处理弹窗
  const openProcessModal = (todo: TodoItem) => {
    setCurrentTodo(todo)
    setProcessModalVisible(true)
  }

  // 获取待办类型标签
  const getTodoTypeTag = (type: string) => {
    const typeMap: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
      ad_approval: { color: 'blue', text: '广告审批', icon: <FileTextOutlined /> },
      custom_flag_approval: { color: 'purple', text: '旗帜审批', icon: <FlagOutlined /> },
      report_review: { color: 'orange', text: '举报处理', icon: <ExclamationCircleOutlined /> }
    }
    const config = typeMap[type] || { color: 'default', text: type, icon: null }
    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    )
  }

  // 获取优先级标签
  const getPriorityTag = (priority: string) => {
    const priorityMap: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
      high: { color: 'red', text: '高', icon: <ExclamationCircleOutlined /> },
      medium: { color: 'orange', text: '中', icon: <WarningOutlined /> },
      low: { color: 'green', text: '低', icon: null }
    }
    const config = priorityMap[priority] || { color: 'default', text: priority, icon: null }
    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    )
  }

  // 表格列配置
  const columns = [
    {
      title: '',
      dataIndex: 'id',
      key: 'checkbox',
      width: 50,
      render: (id: string, record: TodoItem) => (
        <Checkbox
          checked={selectedRowKeys.includes(id)}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedRowKeys([...selectedRowKeys, id])
            } else {
              setSelectedRowKeys(selectedRowKeys.filter(key => key !== id))
            }
          }}
          disabled={record.status !== 'pending'}
        />
      )
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: string) => getTodoTypeTag(type)
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (priority: string) => getPriorityTag(priority)
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: {
        showTitle: false,
      },
      render: (title: string) => (
        <Tooltip placement="topLeft" title={title}>
          {title}
        </Tooltip>
      )
    },
    {
      title: '提交者',
      dataIndex: 'submitter',
      key: 'submitter',
      width: 150,
      render: (submitter: TodoItem['submitter']) => (
        <Space>
          <UserOutlined />
          <span>{submitter.nickname || submitter.username}</span>
        </Space>
      )
    },
    {
      title: '提交时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (time: string) => new Date(time).toLocaleString()
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_, record: TodoItem) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => openProcessModal(record)}
            />
          </Tooltip>
          {record.status === 'pending' && (
            <>
              <Tooltip title="通过">
                <Button
                  type="text"
                  size="small"
                  style={{ color: '#52c41a' }}
                  icon={<CheckOutlined />}
                  onClick={() => handleQuickApprove(record.id, record.type)}
                />
              </Tooltip>
              <Tooltip title="拒绝">
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<CloseOutlined />}
                  onClick={() => handleQuickReject(record.id, record.type)}
                />
              </Tooltip>
            </>
          )}
        </Space>
      )
    }
  ]

  // 行选择配置
  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys)
    },
    getCheckboxProps: (record: TodoItem) => ({
      disabled: record.status !== 'pending',
    }),
  }


  useEffect(() => {
    fetchTodoStats()
  }, [])

  useEffect(() => {
    if (!collapsed) {
      fetchTodos()
    }
  }, [activeTab, selectedType, selectedPriority, pagination.current, collapsed])

  const handleBatchProcessSelected = async (action: 'approve' | 'reject') => {
    if (selectedRowKeys.length === 0) {
      message.info('请选择要操作的待办事项')
      return
    }

    try {
      await todoService.batchProcessTodos(selectedRowKeys as string[], { action })
      message.success(`批量${action === 'approve' ? '通过' : '拒绝'}成功`)
      setSelectedRowKeys([])
      fetchTodos()
      fetchTodoStats()
    } catch (error) {
      console.error('批量处理失败:', error)
      message.error('批量处理失败')
    }
  }

  return (
    <>
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Space>
              <BellOutlined style={{ fontSize: '18px', color: '#1677ff' }} />
              <span style={{ fontSize: '16px', fontWeight: '600' }}>统一待办管理</span>
            </Space>
            <Button
              type="text"
              size="small"
              icon={collapsed ? <DownOutlined /> : <UpOutlined />}
              onClick={onToggleCollapse}
              style={{ fontSize: '14px' }}
            />
          </div>
        }
        style={{
          marginBottom: collapsed ? 0 : 16,
          transition: 'all 0.3s ease'
        }}
      >
        {!collapsed && (
          <>
            {/* 统计卡片 */}
            {stats && (
              <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={12} lg={6} xl={5}>
                  <Card size="small" style={{ textAlign: 'center', borderTop: '2px solid #fa8c16' }}>
                    <Statistic
                      title="待处理总数"
                      value={stats.pending_count}
                      prefix={<ClockCircleOutlined style={{ color: '#fa8c16' }} />}
                      valueStyle={{ color: '#fa8c16', fontSize: '24px', fontWeight: 'bold' }}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} lg={6} xl={5}>
                  <Card size="small" style={{ textAlign: 'center', borderTop: '2px solid #52c41a' }}>
                    <Statistic
                      title="已处理总数"
                      value={stats.processed_count}
                      prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                      valueStyle={{ color: '#52c41a', fontSize: '24px', fontWeight: 'bold' }}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} lg={6} xl={5}>
                  <Card size="small" style={{ textAlign: 'center', borderTop: '2px solid #1677ff' }}>
                    <Statistic
                      title="待审批广告"
                      value={stats.ad_approval_pending}
                      prefix={<FileTextOutlined style={{ color: '#1677ff' }} />}
                      valueStyle={{ color: '#1677ff', fontSize: '24px', fontWeight: 'bold' }}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} lg={6} xl={5}>
                  <Card size="small" style={{ textAlign: 'center', borderTop: '2px solid #722ed1' }}>
                    <Statistic
                      title="待审批旗帜"
                      value={stats.custom_flag_pending}
                      prefix={<FlagOutlined style={{ color: '#722ed1' }} />}
                      valueStyle={{ color: '#722ed1', fontSize: '24px', fontWeight: 'bold' }}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} lg={6} xl={4}>
                  <Card size="small" style={{ textAlign: 'center', borderTop: '2px solid #fa541c' }}>
                    <Statistic
                      title="待处理举报"
                      value={stats.report_pending}
                      prefix={<ExclamationCircleOutlined style={{ color: '#fa541c' }} />}
                      valueStyle={{ color: '#fa541c', fontSize: '24px', fontWeight: 'bold' }}
                    />
                  </Card>
                </Col>
              </Row>
            )}

            {/* 筛选功能区域 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
              padding: '12px 16px',
              backgroundColor: '#fafafa',
              borderRadius: '8px'
            }}>
              <Space wrap>
                <Select
                  value={selectedType}
                  onChange={setSelectedType}
                  style={{ width: 140 }}
                  placeholder="选择类型"
                  size="middle"
                >
                  <Select.Option value="all">全部类型</Select.Option>
                  <Select.Option value="ad_approval">广告审批</Select.Option>
                  <Select.Option value="custom_flag_approval">旗帜审批</Select.Option>
                  <Select.Option value="report_review">举报处理</Select.Option>
                </Select>

                <Select
                  value={selectedPriority}
                  onChange={setSelectedPriority}
                  style={{ width: 120 }}
                  placeholder="选择优先级"
                  size="middle"
                >
                  <Select.Option value="all">全部优先级</Select.Option>
                  <Select.Option value="high">高优先级</Select.Option>
                  <Select.Option value="medium">中优先级</Select.Option>
                  <Select.Option value="low">低优先级</Select.Option>
                </Select>
              </Space>

              {activeTab === 'pending' && selectedRowKeys.length > 0 && (
                <Space>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    已选择 {selectedRowKeys.length} 项
                  </Text>
                  <Popconfirm
                    title={`确定要批量通过选中的 ${selectedRowKeys.length} 项吗？`}
                    onConfirm={() => handleBatchProcessSelected('approve')}
                  >
                    <Button
                      type="primary"
                      size="small"
                      icon={<CheckOutlined />}
                      style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                    >
                      批量通过
                    </Button>
                  </Popconfirm>
                  <Popconfirm
                    title={`确定要批量拒绝选中的 ${selectedRowKeys.length} 项吗？`}
                    onConfirm={() => handleBatchProcessSelected('reject')}
                  >
                    <Button
                      danger
                      size="small"
                      icon={<CloseOutlined />}
                    >
                      批量拒绝
                    </Button>
                  </Popconfirm>
                </Space>
              )}
            </div>

            {/* 待办列表 */}
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              size="small"
              style={{ marginBottom: 16 }}
              items={[
                {
                  key: 'pending',
                  label: (
                    <Space>
                      <span>待办</span>
                      <Tag color="orange" style={{ marginLeft: 4 }}>
                        {stats?.pending_count || 0}
                      </Tag>
                    </Space>
                  ),
                  children: (
                    <Table
                      columns={columns}
                      dataSource={todos}
                      rowKey="id"
                      loading={loading}
                      pagination={{
                        current: pagination.current,
                        pageSize: pagination.pageSize,
                        total: pagination.total,
                        onChange: (page) => setPagination(prev => ({ ...prev, current: page })),
                        showSizeChanger: true,
                        showQuickJumper: true,
                        showTotal: (total, range) => `第 ${range[0]}-${range[1]} 项，共 ${total} 项`,
                        size: 'default'
                      }}
                      rowSelection={activeTab === 'pending' ? rowSelection : undefined}
                      size="small"
                      scroll={{ x: 800 }}
                      locale={{ emptyText: <Empty description="暂无待处理事项" /> }}
                    />
                  )
                },
                {
                  key: 'processed',
                  label: (
                    <Space>
                      <span>已办</span>
                      <Tag color="green" style={{ marginLeft: 4 }}>
                        {stats?.processed_count || 0}
                      </Tag>
                    </Space>
                  ),
                  children: (
                    <Table
                      columns={columns.filter(col => col.key !== 'checkbox')}
                      dataSource={todos}
                      rowKey="id"
                      loading={loading}
                      pagination={{
                        current: pagination.current,
                        pageSize: pagination.pageSize,
                        total: pagination.total,
                        onChange: (page) => setPagination(prev => ({ ...prev, current: page })),
                        showSizeChanger: true,
                        showQuickJumper: true,
                        showTotal: (total, range) => `第 ${range[0]}-${range[1]} 项，共 ${total} 项`,
                        size: 'default'
                      }}
                      size="small"
                      scroll={{ x: 800 }}
                      locale={{ emptyText: <Empty description="暂无已处理事项" /> }}
                    />
                  )
                }
              ]}
            />
          </>
        )}
      </Card>

      {/* 处理弹窗 */}
      <Modal
        title={
          <Space>
            <BellOutlined />
            <span>处理待办事项</span>
          </Space>
        }
        open={processModalVisible}
        onCancel={() => {
          setProcessModalVisible(false)
          setCurrentTodo(null)
          processForm.resetFields()
        }}
        footer={null}
        width={600}
      >
        {currentTodo && (
          <div>
            {/* 待办事项基本信息 */}
            <Card size="small" style={{ marginBottom: 16, backgroundColor: '#f8f9fa' }}>
              <div style={{ marginBottom: 12 }}>
                <Space>
                  {getTodoTypeTag(currentTodo.type)}
                  {getPriorityTag(currentTodo.priority)}
                </Space>
              </div>

              <div style={{ marginBottom: 8 }}>
                <Text strong style={{ fontSize: '16px' }}>{currentTodo.title}</Text>
              </div>

              <div style={{ marginBottom: 8 }}>
                <Text type="secondary">提交者：{currentTodo.submitter.nickname || currentTodo.submitter.username}</Text>
              </div>

              <div>
                <Text type="secondary">提交时间：{new Date(currentTodo.created_at).toLocaleString()}</Text>
              </div>
            </Card>

            {/* 详细内容 */}
            <Card size="small" style={{ marginBottom: 16 }}>
              <Paragraph style={{ color: '#666', marginBottom: 0 }}>
                {currentTodo.description}
              </Paragraph>
            </Card>

            {/* 根据类型显示特定内容 */}
            {currentTodo.ad_data && (
              <Card size="small" title="广告详情" style={{ marginBottom: 16 }}>
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                  {/* 广告图片预览 */}
                  {currentTodo.ad_data.image_url && (
                    <div>
                      <Text strong style={{ display: 'block', marginBottom: 8 }}>广告图片预览：</Text>
                      <div style={{
                        border: '1px solid #d9d9d9',
                        borderRadius: '8px',
                        padding: '12px',
                        backgroundColor: '#fafafa',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        minHeight: '200px'
                      }}>
                        <img
                          src={currentTodo.ad_data.image_url}
                          alt="广告图片"
                          style={{
                            maxWidth: '100%',
                            maxHeight: '400px',
                            objectFit: 'contain',
                            borderRadius: '4px'
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <Text strong>广告标题：</Text>
                    <div style={{ marginTop: 4, fontSize: '16px', fontWeight: 500 }}>
                      {currentTodo.ad_data.title || currentTodo.title}
                    </div>
                  </div>

                  <div>
                    <Text strong>广告内容：</Text>
                    <Paragraph style={{ marginTop: 4, marginBottom: 0, backgroundColor: '#f8f9fa', padding: '12px', borderRadius: '4px' }}>
                      {currentTodo.ad_data.content}
                    </Paragraph>
                  </div>

                  {currentTodo.ad_data.product_name && (
                    <div>
                      <Text strong>广告产品：</Text>
                      <Text style={{ marginLeft: 8 }}>{currentTodo.ad_data.product_name}</Text>
                    </div>
                  )}

                  {(currentTodo.ad_data.width || currentTodo.ad_data.height) && (
                    <div>
                      <Text strong>广告尺寸：</Text>
                      <Text style={{ marginLeft: 8 }}>{currentTodo.ad_data.width} × {currentTodo.ad_data.height} 像素</Text>
                    </div>
                  )}

                  {currentTodo.ad_data.target_url && (
                    <div>
                      <Text strong>目标链接：</Text>
                      <a href={currentTodo.ad_data.target_url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 8 }}>
                        {currentTodo.ad_data.target_url}
                      </a>
                    </div>
                  )}
                </Space>
              </Card>
            )}

            {currentTodo.flag_data && (
              <Card size="small" title="旗帜详情" style={{ marginBottom: 16 }}>
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                  {/* 旗帜图案预览 */}
                  {currentTodo.flag_data.preview_url && (
                    <div>
                      <Text strong style={{ display: 'block', marginBottom: 8 }}>旗帜图案预览：</Text>
                      <div style={{
                        border: '1px solid #d9d9d9',
                        borderRadius: '8px',
                        padding: '12px',
                        backgroundColor: '#fafafa',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        minHeight: '200px'
                      }}>
                        <img
                          src={currentTodo.flag_data.preview_url}
                          alt="旗帜图案"
                          style={{
                            maxWidth: '100%',
                            maxHeight: '400px',
                            objectFit: 'contain',
                            imageRendering: 'pixelated',
                            borderRadius: '4px'
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {currentTodo.flag_data.pattern_name && (
                    <div>
                      <Text strong>图案名称：</Text>
                      <Text style={{ marginLeft: 8 }}>{currentTodo.flag_data.pattern_name}</Text>
                    </div>
                  )}

                  <div>
                    <Text strong>图案尺寸：</Text>
                    <Text style={{ marginLeft: 8 }}>{currentTodo.flag_data.width} × {currentTodo.flag_data.height} 像素</Text>
                  </div>

                  {(currentTodo.flag_data.grid_x !== undefined && currentTodo.flag_data.grid_y !== undefined) && (
                    <div>
                      <Text strong>投放位置：</Text>
                      <Text style={{ marginLeft: 8 }}>网格坐标 ({currentTodo.flag_data.grid_x}, {currentTodo.flag_data.grid_y})</Text>
                    </div>
                  )}
                </Space>
              </Card>
            )}

            {currentTodo.report_data && (
              <Card size="small" title="举报详情" style={{ marginBottom: 16 }}>
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                  <div>
                    <Text strong>举报类型：</Text>
                    <Tag color="orange" style={{ marginLeft: 8 }}>{currentTodo.report_data.target_type}</Tag>
                  </div>

                  <div>
                    <Text strong>举报原因：</Text>
                    <Tag color="red" style={{ marginLeft: 8 }}>{currentTodo.report_data.reason}</Tag>
                  </div>

                  <div>
                    <Text strong>详细描述：</Text>
                    <Paragraph style={{ marginTop: 4, marginBottom: 0, backgroundColor: '#f8f9fa', padding: '12px', borderRadius: '4px' }}>
                      {currentTodo.report_data.description}
                    </Paragraph>
                  </div>

                  {/* 被举报像素信息 */}
                  {currentTodo.report_data.metadata && (
                    <Card
                      size="small"
                      title="被举报像素信息"
                      style={{ backgroundColor: '#fff7e6', border: '1px solid #ffd591' }}
                    >
                      <Space direction="vertical" style={{ width: '100%' }} size="small">
                        {currentTodo.report_data.metadata.username && (
                          <div>
                            <Text strong>涉及用户：</Text>
                            <Tag color="blue" style={{ marginLeft: 8 }}>
                              {currentTodo.report_data.metadata.username}
                            </Tag>
                          </div>
                        )}

                        {currentTodo.report_data.metadata.alliance_name && (
                          <div>
                            <Text strong>所属联盟：</Text>
                            <Tag color="purple" style={{ marginLeft: 8 }}>
                              {currentTodo.report_data.metadata.alliance_name}
                            </Tag>
                          </div>
                        )}

                        {(currentTodo.report_data.metadata.lat && currentTodo.report_data.metadata.lng) && (
                          <div>
                            <Text strong>像素坐标：</Text>
                            <Text style={{ marginLeft: 8 }}>
                              纬度 {currentTodo.report_data.metadata.lat.toFixed(6)},
                              经度 {currentTodo.report_data.metadata.lng.toFixed(6)}
                            </Text>
                          </div>
                        )}

                        {currentTodo.report_data.metadata.color && (
                          <div>
                            <Text strong>像素颜色：</Text>
                            <div style={{
                              marginLeft: 8,
                              display: 'inline-block',
                              width: '80px',
                              height: '24px',
                              backgroundColor: currentTodo.report_data.metadata.color,
                              border: '1px solid #d9d9d9',
                              borderRadius: '4px',
                              verticalAlign: 'middle'
                            }} />
                            <Text type="secondary" style={{ marginLeft: 8 }}>
                              {currentTodo.report_data.metadata.color}
                            </Text>
                          </div>
                        )}

                        {currentTodo.report_data.metadata.pixel_id && (
                          <div>
                            <Text strong>像素ID：</Text>
                            <Text type="secondary" style={{ marginLeft: 8, fontSize: '12px' }}>
                              {currentTodo.report_data.metadata.pixel_id}
                            </Text>
                          </div>
                        )}
                      </Space>
                    </Card>
                  )}

                  {currentTodo.report_data.target_id && (
                    <div>
                      <Text strong>被举报对象ID：</Text>
                      <Text type="secondary" style={{ marginLeft: 8, fontSize: '12px' }}>
                        {currentTodo.report_data.target_id}
                      </Text>
                    </div>
                  )}
                </Space>
              </Card>
            )}

            {/* 处理表单 */}
            <Form
              form={processForm}
              layout="vertical"
              onFinish={handleProcessTodo}
            >
              <Form.Item
                name="action"
                label="处理方式"
                rules={[{ required: true, message: '请选择处理方式' }]}
              >
                <Select placeholder="请选择处理方式" size="large">
                  <Select.Option value="approve">
                    <Space>
                      <CheckOutlined style={{ color: '#52c41a' }} />
                      <span>通过</span>
                    </Space>
                  </Select.Option>
                  <Select.Option value="reject">
                    <Space>
                      <CloseOutlined style={{ color: '#ff4d4f' }} />
                      <span>拒绝</span>
                    </Space>
                  </Select.Option>
                  {currentTodo.type === 'report_review' && (
                    <Select.Option value="process">
                      <Space>
                        <CheckCircleOutlined style={{ color: '#1890ff' }} />
                        <span>标记为已处理</span>
                      </Space>
                    </Select.Option>
                  )}
                </Select>
              </Form.Item>

              <Form.Item
                noStyle
                shouldUpdate={(prevValues, currentValues) => prevValues.action !== currentValues.action}
              >
                {({ getFieldValue }) =>
                  (getFieldValue('action') === 'reject' || getFieldValue('action') === 'process') && (
                    <Form.Item
                      name="reason"
                      label={getFieldValue('action') === 'reject' ? '拒绝理由' : '处理说明'}
                      rules={[{ required: true, message: `请输入${getFieldValue('action') === 'reject' ? '拒绝理由' : '处理说明'}` }]}
                    >
                      <TextArea
                        rows={4}
                        placeholder={getFieldValue('action') === 'reject' ? '请输入拒绝理由...' : '请输入处理说明...'}
                        showCount
                        maxLength={500}
                      />
                    </Form.Item>
                  )
                }
              </Form.Item>

              <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                <Space>
                  <Button
                    size="large"
                    onClick={() => {
                      setProcessModalVisible(false)
                      setCurrentTodo(null)
                      processForm.resetFields()
                    }}
                  >
                    取消
                  </Button>
                  <Button
                    type="primary"
                    size="large"
                    htmlType="submit"
                    style={{ minWidth: 100 }}
                  >
                    确认处理
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </>
  )
}

export default TodoModule