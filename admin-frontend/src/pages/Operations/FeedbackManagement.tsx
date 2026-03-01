import React, { useState, useEffect } from 'react'
import {
  Card,
  Table,
  Button,
  Input,
  Select,
  Space,
  Tag,
  Modal,
  message,
  Tooltip,
  Drawer,
  Descriptions,
  Image,
  Typography,
  Divider,
  Row,
  Col,
  Statistic,
  Tabs,
  Avatar,
  Form,
} from 'antd'
import {
  CommentOutlined,
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  MessageOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { feedbackService, type UserFeedback, type FeedbackStats } from '@/services/feedback'
import { formatDateTime } from '@/utils/format'
import PageHeader from '@/components/PageHeader'

const { TextArea } = Input
const { Text } = Typography

const typeOptions = [
  { label: 'Bug', value: 'bug' },
  { label: '建议', value: 'suggestion' },
  { label: '投诉', value: 'complaint' },
  { label: '咨询', value: 'question' },
  { label: '其他', value: 'other' },
]

const priorityOptions = [
  { label: '低', value: 'low' },
  { label: '普通', value: 'normal' },
  { label: '高', value: 'high' },
  { label: '紧急', value: 'urgent' },
]

const statusTabItems = [
  { label: '全部', key: 'all' },
  { label: '待处理', key: 'pending' },
  { label: '处理中', key: 'in_progress' },
  { label: '已解决', key: 'resolved' },
  { label: '已关闭', key: 'closed' },
]

const FeedbackManagement: React.FC = () => {
  // 列表数据
  const [feedbackList, setFeedbackList] = useState<UserFeedback[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // 统计
  const [stats, setStats] = useState<FeedbackStats | null>(null)

  // 筛选
  const [activeTab, setActiveTab] = useState('all')
  const [keyword, setKeyword] = useState('')
  const [filterType, setFilterType] = useState<string | undefined>(undefined)
  const [filterPriority, setFilterPriority] = useState<string | undefined>(undefined)

  // 详情抽屉
  const [detailVisible, setDetailVisible] = useState(false)
  const [selectedFeedback, setSelectedFeedback] = useState<UserFeedback | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // 回复弹窗
  const [replyVisible, setReplyVisible] = useState(false)
  const [replyForm] = Form.useForm()
  const [replyLoading, setReplyLoading] = useState(false)

  // 状态修改弹窗
  const [statusVisible, setStatusVisible] = useState(false)
  const [statusForm] = Form.useForm()
  const [statusLoading, setStatusLoading] = useState(false)

  // 加载统计数据
  const fetchStats = async () => {
    try {
      const data = await feedbackService.getStats()
      setStats(data)
    } catch (error) {
      console.error('获取反馈统计失败:', error)
    }
  }

  // 加载列表数据
  const fetchList = async () => {
    setLoading(true)
    try {
      const params: any = {
        page: currentPage,
        pageSize,
      }
      if (activeTab !== 'all') {
        params.status = activeTab
      }
      if (keyword) {
        params.keyword = keyword
      }
      if (filterType) {
        params.type = filterType
      }
      if (filterPriority) {
        params.priority = filterPriority
      }
      const response = await feedbackService.getList(params)
      setFeedbackList(response.list || [])
      setTotal(response.total || 0)
    } catch (error) {
      message.error('加载反馈列表失败')
      console.error('加载反馈列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchList()
    fetchStats()
  }, [currentPage, pageSize, activeTab])

  // 搜索
  const handleSearch = () => {
    setCurrentPage(1)
    fetchList()
  }

  // 重置筛选
  const handleReset = () => {
    setKeyword('')
    setFilterType(undefined)
    setFilterPriority(undefined)
    setActiveTab('all')
    setCurrentPage(1)
  }

  // 查看详情
  const handleViewDetail = async (record: UserFeedback) => {
    setDetailLoading(true)
    setDetailVisible(true)
    try {
      const detail = await feedbackService.getById(record.id)
      setSelectedFeedback(detail)
    } catch (error) {
      message.error('获取反馈详情失败')
      console.error('获取反馈详情失败:', error)
    } finally {
      setDetailLoading(false)
    }
  }

  // 打开回复弹窗
  const handleOpenReply = (record: UserFeedback) => {
    setSelectedFeedback(record)
    replyForm.resetFields()
    setReplyVisible(true)
  }

  // 提交回复
  const handleReplySubmit = async () => {
    if (!selectedFeedback) return
    try {
      const values = await replyForm.validateFields()
      setReplyLoading(true)
      await feedbackService.reply(selectedFeedback.id, values.reply)
      if (values.status) {
        await feedbackService.updateStatus(selectedFeedback.id, { status: values.status })
      }
      message.success('回复成功')
      setReplyVisible(false)
      fetchList()
      fetchStats()
    } catch (error) {
      message.error('回复失败')
      console.error('回复失败:', error)
    } finally {
      setReplyLoading(false)
    }
  }

  // 打开状态修改弹窗
  const handleOpenStatus = (record: UserFeedback) => {
    setSelectedFeedback(record)
    statusForm.setFieldsValue({
      status: record.status,
      priority: record.priority,
    })
    setStatusVisible(true)
  }

  // 提交状态修改
  const handleStatusSubmit = async () => {
    if (!selectedFeedback) return
    try {
      const values = await statusForm.validateFields()
      setStatusLoading(true)
      await feedbackService.updateStatus(selectedFeedback.id, {
        status: values.status,
        priority: values.priority,
      })
      message.success('更新成功')
      setStatusVisible(false)
      fetchList()
      fetchStats()
    } catch (error) {
      message.error('更新失败')
      console.error('更新失败:', error)
    } finally {
      setStatusLoading(false)
    }
  }

  // 删除反馈
  const handleDelete = (record: UserFeedback) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这条反馈吗？删除后不可恢复。',
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await feedbackService.delete(record.id)
          message.success('删除成功')
          fetchList()
          fetchStats()
        } catch (error) {
          message.error('删除失败')
          console.error('删除失败:', error)
        }
      },
    })
  }

  // 类型标签
  const getTypeTag = (type: string) => {
    const config: Record<string, { color: string; text: string }> = {
      bug: { color: 'red', text: 'Bug' },
      suggestion: { color: 'blue', text: '建议' },
      complaint: { color: 'orange', text: '投诉' },
      question: { color: 'green', text: '咨询' },
      other: { color: 'default', text: '其他' },
    }
    const item = config[type] || config.other
    return <Tag color={item.color}>{item.text}</Tag>
  }

  // 优先级标签
  const getPriorityTag = (priority: string) => {
    const config: Record<string, { color: string; text: string }> = {
      urgent: { color: 'red', text: '紧急' },
      high: { color: 'orange', text: '高' },
      normal: { color: 'blue', text: '普通' },
      low: { color: 'default', text: '低' },
    }
    const item = config[priority] || config.normal
    return <Tag color={item.color}>{item.text}</Tag>
  }

  // 状态标签
  const getStatusTag = (status: string) => {
    const config: Record<string, { color: string; text: string }> = {
      pending: { color: 'orange', text: '待处理' },
      in_progress: { color: 'processing', text: '处理中' },
      resolved: { color: 'green', text: '已解决' },
      closed: { color: 'default', text: '已关闭' },
    }
    const item = config[status] || config.pending
    return <Tag color={item.color}>{item.text}</Tag>
  }

  // 表格列
  const columns: ColumnsType<UserFeedback> = [
    {
      title: '用户',
      key: 'user',
      width: 180,
      render: (_, record) => (
        <Space>
          <Avatar
            size="small"
            src={record.avatar_url}
            icon={!record.avatar_url ? <UserOutlined /> : undefined}
          />
          <div>
            <div style={{ fontWeight: 500 }}>{record.nickname || '-'}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.username || record.user_id}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 90,
      render: (type: string) => getTypeTag(type),
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 200,
      ellipsis: {
        showTitle: false,
      },
      render: (text: string) => (
        <Tooltip placement="topLeft" title={text}>
          {text}
        </Tooltip>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 90,
      render: (priority: string) => getPriorityTag(priority),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => getStatusTag(status),
    },
    {
      title: '提交时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (time: string) => formatDateTime(time),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Tooltip title="查看">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetail(record)}
            />
          </Tooltip>
          <Tooltip title="回复">
            <Button
              type="link"
              size="small"
              icon={<MessageOutlined />}
              onClick={() => handleOpenReply(record)}
            />
          </Tooltip>
          <Tooltip title="修改状态">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleOpenStatus(record)}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      {/* 页面标题 */}
      <PageHeader
        title="用户反馈"
        description="管理用户反馈和建议"
        icon={<CommentOutlined style={{ color: 'white', fontSize: 20 }} />}
        extra={
          <Button
            icon={<ReloadOutlined />}
            onClick={() => { fetchList(); fetchStats() }}
            style={{ borderRadius: '8px', fontWeight: '500' }}
          >
            刷新
          </Button>
        }
      />

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #f0f0f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          }}>
            <Statistic
              title="待处理"
              value={stats?.pending ?? 0}
              valueStyle={{ color: '#f5222d' }}
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
              title="处理中"
              value={stats?.in_progress ?? 0}
              valueStyle={{ color: '#fa8c16' }}
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
              title="今日已解决"
              value={stats?.today_resolved ?? 0}
              valueStyle={{ color: '#52c41a' }}
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
              title="平均响应时间"
              value={stats?.avg_response_hours ?? '-'}
              suffix="小时"
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 筛选区域 */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: 24,
        border: '1px solid #f0f0f0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
      }}>
        <Space wrap style={{ width: '100%' }}>
          <Input
            placeholder="搜索关键词"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: 200, borderRadius: '8px' }}
            allowClear
          />
          <Select
            placeholder="反馈类型"
            value={filterType}
            onChange={(val) => setFilterType(val)}
            options={typeOptions}
            style={{ width: 140, borderRadius: '8px' }}
            allowClear
          />
          <Select
            placeholder="优先级"
            value={filterPriority}
            onChange={(val) => setFilterPriority(val)}
            options={priorityOptions}
            style={{ width: 140, borderRadius: '8px' }}
            allowClear
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={handleSearch}
            style={{ borderRadius: '6px', fontWeight: '500' }}
          >
            搜索
          </Button>
          <Button
            onClick={handleReset}
            style={{ borderRadius: '8px', fontWeight: '500' }}
          >
            重置
          </Button>
        </Space>
      </div>

      {/* 表格区域 */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        border: '1px solid #f0f0f0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        padding: '24px',
      }}>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => {
            setActiveTab(key)
            setCurrentPage(1)
          }}
          items={statusTabItems}
          style={{ marginBottom: 16 }}
        />

        <Table
          columns={columns}
          dataSource={feedbackList}
          rowKey="id"
          loading={loading}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (t) => `共 ${t} 条记录`,
            onChange: (page, size) => {
              setCurrentPage(page)
              setPageSize(size || 10)
            },
          }}
          scroll={{ x: 1020 }}
        />
      </div>

      {/* 详情抽屉 */}
      <Drawer
        title="反馈详情"
        placement="right"
        size="large"
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        loading={detailLoading}
      >
        {selectedFeedback && (
          <div>
            <Descriptions title="基本信息" column={2} bordered>
              <Descriptions.Item label="反馈ID">{selectedFeedback.id}</Descriptions.Item>
              <Descriptions.Item label="状态">
                {getStatusTag(selectedFeedback.status)}
              </Descriptions.Item>
              <Descriptions.Item label="类型">
                {getTypeTag(selectedFeedback.type)}
              </Descriptions.Item>
              <Descriptions.Item label="优先级">
                {getPriorityTag(selectedFeedback.priority)}
              </Descriptions.Item>
              <Descriptions.Item label="提交时间">
                {formatDateTime(selectedFeedback.created_at)}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {formatDateTime(selectedFeedback.updated_at)}
              </Descriptions.Item>
            </Descriptions>

            <Divider />

            <Descriptions title="用户信息" column={2} bordered>
              <Descriptions.Item label="用户">
                <Space>
                  <Avatar
                    size="small"
                    src={selectedFeedback.avatar_url}
                    icon={!selectedFeedback.avatar_url ? <UserOutlined /> : undefined}
                  />
                  {selectedFeedback.nickname || '-'}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="用户名">
                {selectedFeedback.username || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="用户ID" span={2}>
                <Text copyable={{ text: selectedFeedback.user_id }}>
                  {selectedFeedback.user_id}
                </Text>
              </Descriptions.Item>
            </Descriptions>

            <Divider />

            <Descriptions title="反馈内容" column={1} bordered>
              <Descriptions.Item label="标题">
                {selectedFeedback.title}
              </Descriptions.Item>
              <Descriptions.Item label="详细内容">
                <div style={{ whiteSpace: 'pre-wrap' }}>
                  {selectedFeedback.content}
                </div>
              </Descriptions.Item>
            </Descriptions>

            {selectedFeedback.screenshots && selectedFeedback.screenshots.length > 0 && (
              <>
                <Divider />
                <Text strong style={{ display: 'block', marginBottom: 12 }}>截图</Text>
                <Image.PreviewGroup>
                  <Space wrap>
                    {selectedFeedback.screenshots.map((url, index) => (
                      <Image
                        key={index}
                        width={100}
                        height={100}
                        src={url}
                        style={{ objectFit: 'cover', borderRadius: 4 }}
                      />
                    ))}
                  </Space>
                </Image.PreviewGroup>
              </>
            )}

            <Divider />

            <Descriptions title="设备信息" column={2} bordered>
              <Descriptions.Item label="App版本">
                {selectedFeedback.app_version || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="设备信息">
                {selectedFeedback.device_info || '-'}
              </Descriptions.Item>
            </Descriptions>

            {selectedFeedback.admin_reply && (
              <>
                <Divider />
                <Text strong style={{ display: 'block', marginBottom: 12 }}>管理员回复</Text>
                <div style={{
                  padding: 12,
                  backgroundColor: '#f6ffed',
                  borderRadius: 4,
                  border: '1px solid #b7eb8f',
                  whiteSpace: 'pre-wrap',
                }}>
                  {selectedFeedback.admin_reply}
                </div>
                {selectedFeedback.replied_at && (
                  <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
                    回复时间: {formatDateTime(selectedFeedback.replied_at)}
                  </Text>
                )}
              </>
            )}

            <Divider />

            <Space>
              <Button
                type="primary"
                icon={<MessageOutlined />}
                onClick={() => {
                  setDetailVisible(false)
                  handleOpenReply(selectedFeedback)
                }}
              >
                回复
              </Button>
              <Button
                icon={<EditOutlined />}
                onClick={() => {
                  setDetailVisible(false)
                  handleOpenStatus(selectedFeedback)
                }}
              >
                修改状态
              </Button>
            </Space>
          </div>
        )}
      </Drawer>

      {/* 回复弹窗 */}
      <Modal
        title="回复反馈"
        open={replyVisible}
        onCancel={() => setReplyVisible(false)}
        onOk={handleReplySubmit}
        confirmLoading={replyLoading}
        okText="提交回复"
        cancelText="取消"
      >
        <Form form={replyForm} layout="vertical">
          <Form.Item
            name="reply"
            label="回复内容"
            rules={[{ required: true, message: '请输入回复内容' }]}
          >
            <TextArea
              rows={4}
              placeholder="请输入回复内容..."
              maxLength={1000}
              showCount
            />
          </Form.Item>
          <Form.Item
            name="status"
            label="同时修改状态（可选）"
          >
            <Select placeholder="不修改状态" allowClear>
              <Select.Option value="in_progress">处理中</Select.Option>
              <Select.Option value="resolved">已解决</Select.Option>
              <Select.Option value="closed">已关闭</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 状态修改弹窗 */}
      <Modal
        title="修改状态"
        open={statusVisible}
        onCancel={() => setStatusVisible(false)}
        onOk={handleStatusSubmit}
        confirmLoading={statusLoading}
        okText="确认修改"
        cancelText="取消"
      >
        <Form form={statusForm} layout="vertical">
          <Form.Item
            name="status"
            label="状态"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select placeholder="选择状态">
              <Select.Option value="pending">待处理</Select.Option>
              <Select.Option value="in_progress">处理中</Select.Option>
              <Select.Option value="resolved">已解决</Select.Option>
              <Select.Option value="closed">已关闭</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="priority"
            label="优先级"
            rules={[{ required: true, message: '请选择优先级' }]}
          >
            <Select placeholder="选择优先级">
              <Select.Option value="low">低</Select.Option>
              <Select.Option value="normal">普通</Select.Option>
              <Select.Option value="high">高</Select.Option>
              <Select.Option value="urgent">紧急</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default FeedbackManagement
