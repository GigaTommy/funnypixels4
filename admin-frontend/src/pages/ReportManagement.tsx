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
  Form,
  message,
  Tooltip,
  Drawer,
  Descriptions,
  Image,
  Badge,
  DatePicker,
  Typography,
  Alert,
  Divider,
  Row,
  Col,
  Statistic
} from 'antd'
import {
  SearchOutlined,
  EyeOutlined,
  CheckOutlined,
  CloseOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  QuestionCircleOutlined,
  UserOutlined,
  FileTextOutlined,
  PictureOutlined,
  TeamOutlined,
  MessageOutlined,
  WarningOutlined,
  SafetyOutlined,
  StopOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import { reportService, type Report, type GetReportsParams } from '@/services/report'
import { formatDateTime } from '@/utils/format'

const { RangePicker } = DatePicker
const { TextArea } = Input
const { Text, Title } = Typography

const ReportManagement: React.FC = () => {
  const navigate = useNavigate()
  // 状态管理
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false)
  const [updateModalVisible, setUpdateModalVisible] = useState(false)
  const [updateForm] = Form.useForm()
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [reportStats, setReportStats] = useState({
    total: 0,
    pending: 0,
    resolved: 0,
    investigating: 0
  })

  // 搜索参数
  const [searchParams, setSearchParams] = useState<GetReportsParams>({
    current: 1,
    pageSize: 10,
  })

  // 从后端获取全局统计数据
  const fetchReportStats = async () => {
    try {
      const statsData = await reportService.getReportStats()
      setReportStats({
        total: statsData.total || 0,
        pending: statsData.pending || 0,
        resolved: statsData.resolved || 0,
        investigating: statsData.investigating || 0
      })
    } catch (error) {
      console.error('获取举报统计失败:', error)
    }
  }

  // 加载举报列表
  const loadReports = async (params: GetReportsParams = {}) => {
    setLoading(true)
    try {
      const response = await reportService.getReports({
        ...searchParams,
        ...params,
        current: currentPage,
        pageSize: pageSize,
      })
      setReports(response.list || [])
      setTotal(response.total || 0)
    } catch (error) {
      message.error('加载举报列表失败')
      console.error('加载举报列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 初始化加载数据
  useEffect(() => {
    loadReports()
    fetchReportStats()
  }, [currentPage, pageSize])

  // 搜索
  const handleSearch = (values: any) => {
    const params: GetReportsParams = {
      ...searchParams,
      ...values,
      page: 1,
    }
    setSearchParams(params)
    setCurrentPage(1)
    loadReports(params)
  }

  // 重置搜索
  const handleReset = () => {
    const params: GetReportsParams = {
      current: 1,
      pageSize: pageSize,
    }
    setSearchParams(params)
    setCurrentPage(1)
    loadReports(params)
  }

  // 查看详情
  const handleViewDetail = async (report: Report) => {
    try {
      const detail = await reportService.getReportById(report.id)
      setSelectedReport(detail)
      setDetailDrawerVisible(true)
    } catch (error) {
      message.error('获取举报详情失败')
      console.error('获取举报详情失败:', error)
    }
  }

  // 更新举报状态
  const handleUpdateStatus = (report: Report) => {
    setSelectedReport(report)
    updateForm.setFieldsValue({
      status: report.status,
      admin_notes: report.admin_notes || '',
    })
    setUpdateModalVisible(true)
  }

  // 提交更新
  const handleUpdateSubmit = async (values: any) => {
    if (!selectedReport) return

    try {
      await reportService.updateReport(selectedReport.id, {
        status: values.status,
        admin_notes: values.admin_notes,
      })
      message.success('更新成功')
      setUpdateModalVisible(false)
      loadReports()
      fetchReportStats()
    } catch (error) {
      message.error('更新失败')
      console.error('更新失败:', error)
    }
  }

  // 跳转到被举报用户
  const handleGoToUser = (userId: string) => {
    navigate(`/user/detail/${userId}`)
  }

  // 批量忽略
  const handleBatchDismiss = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要忽略的举报')
      return
    }
    Modal.confirm({
      title: '批量忽略',
      content: `确定要忽略选中的 ${selectedRowKeys.length} 条举报吗？`,
      okText: '确认忽略',
      cancelText: '取消',
      onOk: async () => {
        try {
          await Promise.all(
            selectedRowKeys.map(id =>
              reportService.updateReport(id as string, { status: 'dismissed', admin_notes: '批量忽略' })
            )
          )
          message.success(`成功忽略 ${selectedRowKeys.length} 条举报`)
          setSelectedRowKeys([])
          loadReports()
          fetchReportStats()
        } catch (error) {
          message.error('批量忽略失败')
        }
      },
    })
  }

  // 状态标签
  const getStatusTag = (status: string) => {
    const statusConfig = {
      pending: { color: '#f59e0b', text: '待处理', icon: <ClockCircleOutlined /> },
      investigating: { color: '#1677ff', text: '调查中', icon: <SafetyOutlined /> },
      resolved: { color: '#10b981', text: '已解决', icon: <CheckOutlined /> },
      dismissed: { color: '#6b7280', text: '已忽略', icon: <CloseOutlined /> },
    }
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending
    return (
      <Tag
        color={config.color}
        style={{
          borderRadius: '12px',
          fontWeight: '500',
          padding: '4px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}
      >
        {config.icon} {config.text}
      </Tag>
    )
  }

  // 举报类型标签
  const getTypeTag = (type: string) => {
    const typeConfig = {
      pixel: { color: '#0958d9', text: '像素点', icon: <div style={{ width: 12, height: 12, backgroundColor: '#000', borderRadius: 2 }} /> },
      user: { color: '#1677ff', text: '用户', icon: <UserOutlined /> },
      advertisement: { color: '#10b981', text: '广告', icon: <FileTextOutlined /> },
      comment: { color: '#f59e0b', text: '评论', icon: <MessageOutlined /> },
      alliance: { color: '#06b6d4', text: '联盟', icon: <TeamOutlined /> },
    }
    const config = typeConfig[type as keyof typeof typeConfig] || typeConfig.pixel
    return (
      <Tag
        color={config.color}
        style={{
          borderRadius: '12px',
          fontWeight: '500',
          padding: '4px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}
      >
        {config.icon} {config.text}
      </Tag>
    )
  }

  // 表格列定义
  const columns: ColumnsType<Report> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '举报类型',
      dataIndex: 'reported_type',
      key: 'reported_type',
      width: 100,
      render: (type: string) => getTypeTag(type),
    },
    {
      title: '举报人',
      key: 'reporter',
      width: 150,
      render: (_, record) => (
        <div>
          <div>{record.reporter_nickname || record.reporter_username}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            ID: {record.reporter_id}
          </Text>
        </div>
      ),
    },
    {
      title: '被举报对象',
      dataIndex: 'reported_id',
      key: 'reported_id',
      width: 120,
      render: (id: string) => (
        <Text copyable={{ text: id }}>
          {id.slice(0, 8)}...
        </Text>
      ),
    },
    {
      title: '举报原因',
      dataIndex: 'reason',
      key: 'reason',
      width: 120,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
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
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => getStatusTag(status),
    },
    {
      title: '举报时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (time: string) => formatDateTime(time),
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Tooltip title="查看详情">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetail(record)}
            />
          </Tooltip>
          {(record.reported_type === 'user' || record.reported_type === 'pixel') && (
            <Tooltip title="查看被举报用户">
              <Button
                type="link"
                size="small"
                icon={<StopOutlined />}
                onClick={() => handleGoToUser(record.reported_id)}
                style={{ color: '#ef4444' }}
              />
            </Tooltip>
          )}
          {record.status !== 'resolved' && record.status !== 'dismissed' && (
            <Tooltip title="处理举报">
              <Button
                type="link"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => handleUpdateStatus(record)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

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
            }}>🚨</span>
          </div>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: '28px',
              fontWeight: '700',
              color: '#1f2937',
              lineHeight: '1.2'
            }}>
              举报管理
            </h1>
            <p style={{
              margin: '4px 0 0 0',
              fontSize: '14px',
              color: '#6b7280',
              lineHeight: '1.4'
            }}>
              处理用户举报，维护平台秩序
            </p>
          </div>
        </div>
        <Space>
          <Button
            icon={<SearchOutlined />}
            onClick={() => { loadReports(); fetchReportStats(); }}
            style={{
              borderRadius: '8px',
              fontWeight: '500'
            }}
          >
            刷新
          </Button>
          {selectedRowKeys.length > 0 && (
            <Button
              danger
              icon={<CloseOutlined />}
              onClick={handleBatchDismiss}
              style={{ borderRadius: '8px', fontWeight: '500' }}
            >
              批量忽略 ({selectedRowKeys.length})
            </Button>
          )}
        </Space>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #f0f0f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
          }}>
            <Statistic
              title="总举报数"
              value={reportStats.total}
              prefix={<WarningOutlined style={{ color: '#1677ff' }} />}
              valueStyle={{ color: '#1677ff' }}
            />
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>平台举报总量</p>
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #f0f0f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
          }}>
            <Statistic
              title="待处理"
              value={reportStats.pending}
              prefix={<ClockCircleOutlined style={{ color: '#f59e0b' }} />}
              valueStyle={{ color: '#f59e0b' }}
            />
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>等待处理的举报</p>
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #f0f0f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
          }}>
            <Statistic
              title="调查中"
              value={reportStats.investigating}
              prefix={<SafetyOutlined style={{ color: '#1677ff' }} />}
              valueStyle={{ color: '#1677ff' }}
            />
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>正在调查的举报</p>
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #f0f0f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
          }}>
            <Statistic
              title="已解决"
              value={reportStats.resolved}
              prefix={<CheckOutlined style={{ color: '#10b981' }} />}
              valueStyle={{ color: '#10b981' }}
            />
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>已处理的举报</p>
          </Card>
        </Col>
      </Row>

      {/* 搜索和筛选区域 */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '24px',
        border: '1px solid #f0f0f0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
      }}>
        <Form
          layout="inline"
          onFinish={handleSearch}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '16px',
            alignItems: 'center'
          }}
        >
          <Form.Item name="status" label="状态">
            <Select
              placeholder="选择状态"
              style={{ width: 140, borderRadius: '8px' }}
              allowClear
            >
              <Select.Option value="pending">⏰ 待处理</Select.Option>
              <Select.Option value="investigating">🔍 调查中</Select.Option>
              <Select.Option value="resolved">✅ 已解决</Select.Option>
              <Select.Option value="dismissed">❌ 已忽略</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="reported_type" label="举报类型">
            <Select
              placeholder="选择类型"
              style={{ width: 140, borderRadius: '8px' }}
              allowClear
            >
              <Select.Option value="pixel">🟣 像素点</Select.Option>
              <Select.Option value="user">👤 用户</Select.Option>
              <Select.Option value="advertisement">📢 广告</Select.Option>
              <Select.Option value="comment">💬 评论</Select.Option>
              <Select.Option value="alliance">🏰 联盟</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="reason" label="举报原因">
            <Input placeholder="输入举报原因" style={{ width: 180, borderRadius: '8px' }} />
          </Form.Item>

          <Form.Item name="dateRange" label="时间范围">
            <RangePicker style={{ width: 220, borderRadius: '8px' }} />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SearchOutlined />}
                style={{
                  borderRadius: '6px',
                  fontWeight: '500'
                }}
              >
                搜索
              </Button>
              <Button
                onClick={handleReset}
                style={{
                  borderRadius: '8px',
                  fontWeight: '500'
                }}
              >
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </div>

      {/* 主要内容区域 */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        border: '1px solid #f0f0f0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        padding: '24px'
      }}>
        <Table
          columns={columns}
          dataSource={reports}
          rowKey="id"
          loading={loading}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
            onChange: (page, size) => {
              setCurrentPage(page)
              setPageSize(size || 10)
            },
          }}
          scroll={{ x: 1000 }}
          style={{
            borderRadius: '12px'
          }}
        />
      </div>

      {/* 详情抽屉 */}
      <Drawer
        title="举报详情"
        placement="right"
        size="large"
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
      >
        {selectedReport && (
          <div>
            <Descriptions title="基本信息" column={2} bordered>
              <Descriptions.Item label="举报ID">{selectedReport.id}</Descriptions.Item>
              <Descriptions.Item label="状态">
                {getStatusTag(selectedReport.status)}
              </Descriptions.Item>
              <Descriptions.Item label="举报类型">
                {getTypeTag(selectedReport.reported_type)}
              </Descriptions.Item>
              <Descriptions.Item label="举报时间">
                {formatDateTime(selectedReport.created_at)}
              </Descriptions.Item>
              {selectedReport.updated_at && (
                <Descriptions.Item label="更新时间">
                  {formatDateTime(selectedReport.updated_at)}
                </Descriptions.Item>
              )}
              {selectedReport.resolved_at && (
                <Descriptions.Item label="处理时间">
                  {formatDateTime(selectedReport.resolved_at)}
                </Descriptions.Item>
              )}
            </Descriptions>

            <Divider />

            <Descriptions title="举报人信息" column={2} bordered>
              <Descriptions.Item label="用户名">
                {selectedReport.reporter_username}
              </Descriptions.Item>
              <Descriptions.Item label="昵称">
                {selectedReport.reporter_nickname}
              </Descriptions.Item>
              <Descriptions.Item label="用户ID" span={2}>
                <Text copyable={{ text: selectedReport.reporter_id }}>
                  {selectedReport.reporter_id}
                </Text>
              </Descriptions.Item>
            </Descriptions>

            <Divider />

            <Descriptions title="举报内容" column={1} bordered>
              <Descriptions.Item label="被举报对象">
                <Text copyable={{ text: selectedReport.reported_id }}>
                  {selectedReport.reported_id}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="举报原因">
                {selectedReport.reason}
              </Descriptions.Item>
              <Descriptions.Item label="详细描述">
                <div style={{ whiteSpace: 'pre-wrap' }}>
                  {selectedReport.description}
                </div>
              </Descriptions.Item>
            </Descriptions>

            {selectedReport.evidence_urls && selectedReport.evidence_urls.length > 0 && (
              <>
                <Divider />
                <Title level={5}>证据图片</Title>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {selectedReport.evidence_urls.map((url, index) => (
                    <Image
                      key={index}
                      width={100}
                      height={100}
                      src={url}
                      style={{ objectFit: 'cover', borderRadius: 4 }}
                    />
                  ))}
                </div>
              </>
            )}

            {selectedReport.admin_notes && (
              <>
                <Divider />
                <Title level={5}>管理员备注</Title>
                <div style={{
                  padding: 12,
                  backgroundColor: '#f5f5f5',
                  borderRadius: 4,
                  whiteSpace: 'pre-wrap'
                }}>
                  {selectedReport.admin_notes}
                </div>
              </>
            )}

            <Divider />
            <Space>
              {(selectedReport.reported_type === 'user' || selectedReport.reported_type === 'pixel') && (
                <Button
                  type="primary"
                  danger
                  icon={<StopOutlined />}
                  onClick={() => {
                    setDetailDrawerVisible(false)
                    handleGoToUser(selectedReport.reported_id)
                  }}
                >
                  前往用户页面处理
                </Button>
              )}
              {selectedReport.status !== 'resolved' && selectedReport.status !== 'dismissed' && (
                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  onClick={() => {
                    setDetailDrawerVisible(false)
                    handleUpdateStatus(selectedReport)
                  }}
                >
                  处理此举报
                </Button>
              )}
            </Space>
          </div>
        )}
      </Drawer>

      {/* 更新状态模态框 */}
      <Modal
        title="处理举报"
        open={updateModalVisible}
        onCancel={() => setUpdateModalVisible(false)}
        footer={null}
      >
        <Form
          form={updateForm}
          layout="vertical"
          onFinish={handleUpdateSubmit}
        >
          <Form.Item
            name="status"
            label="处理状态"
            rules={[{ required: true, message: '请选择处理状态' }]}
          >
            <Select placeholder="选择处理状态">
              <Select.Option value="investigating">调查中</Select.Option>
              <Select.Option value="resolved">已解决</Select.Option>
              <Select.Option value="dismissed">已忽略</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="admin_notes"
            label="管理员备注"
          >
            <TextArea
              rows={4}
              placeholder="请输入处理说明或备注..."
              maxLength={500}
              showCount
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                确认更新
              </Button>
              <Button onClick={() => setUpdateModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default ReportManagement