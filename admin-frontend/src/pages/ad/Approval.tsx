import React, { useState, useRef, useEffect } from 'react'
import {
  Button,
  Tag,
  Card,
  Row,
  Col,
  Modal,
  Form,
  Input,
  Image,
  Descriptions,
  message,
  Space,
  Statistic,
  DatePicker
} from 'antd'
import { ProColumns, ActionType } from '@ant-design/pro-components'
import {
  EyeOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  UserOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { advertisementService } from '@/services'
import SafeProTable from '@/components/SafeProTable'
import type { Advertisement, PaginationParams } from '@/types'
import request from '@/services/request'

const { RangePicker } = DatePicker

interface AdStats {
  pending: number
  approved: number
  rejected: number
  total: number
}

const AdApproval: React.FC = () => {
  const [activeTab, setActiveTab] = useState('pending')
  const actionRef = useRef<ActionType>()
  const [stats, setStats] = useState<AdStats>({
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0
  })

  // 审批相关状态
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [approveModalVisible, setApproveModalVisible] = useState(false)
  const [rejectModalVisible, setRejectModalVisible] = useState(false)
  const [selectedAd, setSelectedAd] = useState<Advertisement | null>(null)
  const [approveForm] = Form.useForm()
  const [rejectForm] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [batchRejectModalVisible, setBatchRejectModalVisible] = useState(false)
  const [batchRejectForm] = Form.useForm()
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)

  // 获取统计数据
  const fetchStats = async () => {
    try {
      const response = await request.get('/admin/stats/comprehensive', {
        params: { period: '30d' }
      })

      if (response.data.success) {
        const adData = response.data.data.ads || {}
        setStats({
          pending: adData.pending || 0,
          approved: adData.approved || 0,
          rejected: adData.rejected || 0,
          total: (adData.pending || 0) + (adData.approved || 0) + (adData.rejected || 0)
        })
      }
    } catch (error) {
      console.error('获取广告统计数据失败:', error)
      setStats({ pending: 0, approved: 0, rejected: 0, total: 0 })
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  // 查看广告详情
  const handleViewDetail = async (record: Advertisement) => {
    try {
      setLoading(true)
      const ad = await advertisementService.getAdById(record.id)
      // Merge list-level fields that the detail endpoint may not return
      setSelectedAd({ ...record, ...ad })
      setDetailModalVisible(true)
    } catch (error) {
      message.error('获取广告详情失败')
    } finally {
      setLoading(false)
    }
  }

  // 批准广告
  const handleApprove = (record: Advertisement) => {
    setSelectedAd(record)
    setApproveModalVisible(true)
    approveForm.resetFields()
  }

  const handleApproveSubmit = async () => {
    if (!selectedAd) return

    try {
      const values = await approveForm.validateFields()
      await advertisementService.approveAd({
        id: selectedAd.id,
        status: 'approved',
        notes: values.notes
      })

      message.success('广告批准成功')
      setApproveModalVisible(false)
      actionRef.current?.reload()
      fetchStats()
    } catch (error) {
      message.error('批准失败')
    }
  }

  // 拒绝广告
  const handleReject = (record: Advertisement) => {
    setSelectedAd(record)
    setRejectModalVisible(true)
    rejectForm.resetFields()
  }

  const handleRejectSubmit = async () => {
    if (!selectedAd) return

    try {
      const values = await rejectForm.validateFields()
      await advertisementService.approveAd({
        id: selectedAd.id,
        status: 'rejected',
        rejectReason: values.reason
      })

      message.success('广告拒绝成功')
      setRejectModalVisible(false)
      actionRef.current?.reload()
      fetchStats()
    } catch (error) {
      message.error('拒绝失败')
    }
  }

  // 批量批准
  const handleBatchApprove = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要批准的广告')
      return
    }
    Modal.confirm({
      title: '批量批准',
      content: `确定要批准选中的 ${selectedRowKeys.length} 条广告吗？`,
      okText: '确认批准',
      cancelText: '取消',
      onOk: async () => {
        try {
          await Promise.all(
            selectedRowKeys.map(id =>
              advertisementService.approveAd({ id: id as string, status: 'approved', notes: '批量审批通过' })
            )
          )
          message.success(`成功批准 ${selectedRowKeys.length} 条广告`)
          setSelectedRowKeys([])
          actionRef.current?.reload()
          fetchStats()
        } catch (error) {
          message.error('批量批准失败')
        }
      },
    })
  }

  // 批量拒绝
  const handleBatchReject = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要拒绝的广告')
      return
    }
    batchRejectForm.resetFields()
    setBatchRejectModalVisible(true)
  }

  const handleBatchRejectSubmit = async () => {
    try {
      const values = await batchRejectForm.validateFields()
      await Promise.all(
        selectedRowKeys.map(id =>
          advertisementService.approveAd({ id: id as string, status: 'rejected', rejectReason: values.reason })
        )
      )
      message.success(`成功拒绝 ${selectedRowKeys.length} 条广告`)
      setSelectedRowKeys([])
      setBatchRejectModalVisible(false)
      actionRef.current?.reload()
      fetchStats()
    } catch (error) {
      message.error('批量拒绝失败')
    }
  }

  // 表格列定义
  const columns: ProColumns<Advertisement>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
      search: false,
    },
    {
      title: '广告标题',
      dataIndex: 'title',
      width: 200,
      ellipsis: true,
    },
    {
      title: '广告图片',
      dataIndex: 'image_url',
      width: 120,
      search: false,
      render: (_, record) => (
        <img
          src={record.image_url}
          alt="广告图片"
          style={{ width: 60, height: 40, objectFit: 'cover', borderRadius: 4 }}
        />
      ),
    },
    {
      title: '申请人',
      dataIndex: 'username',
      width: 120,
      search: false,
      render: (text: string, record: Advertisement) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <UserOutlined style={{ marginRight: '4px' }} />
            {text || record.nickname || '未知用户'}
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            ID: {record.user_id?.substring(0, 8)}...
          </div>
        </div>
      )
    },
    {
      title: '价格',
      dataIndex: 'price',
      width: 80,
      search: false,
      render: (price: number) => price ? `${price}` : '-',
    },
    {
      title: '投放位置',
      dataIndex: 'targetLocation',
      width: 150,
      search: false,
      render: (_: any, record: Advertisement) => {
        const loc = (record as any).targetLocation
        if (!loc) return <span style={{ color: '#999' }}>未指定</span>
        const lat = typeof loc === 'string' ? JSON.parse(loc)?.lat : loc?.lat
        const lng = typeof loc === 'string' ? JSON.parse(loc)?.lng : loc?.lng
        return lat !== undefined && lng !== undefined
          ? <span style={{ fontSize: '12px' }}>{Number(lat).toFixed(4)}, {Number(lng).toFixed(4)}</span>
          : <span style={{ color: '#999' }}>未指定</span>
      }
    },
    {
      title: '投放时间',
      dataIndex: 'scheduledTime',
      width: 160,
      search: false,
      render: (_: any, record: Advertisement) => {
        const time = (record as any).scheduledTime
        return time
          ? <span style={{ fontSize: '12px' }}>{new Date(time).toLocaleString()}</span>
          : <span style={{ color: '#999' }}>即时投放</span>
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      search: false,
      render: (_, record) => {
        const statusStyles: Record<string, { backgroundColor: string; color: string; border: string; label: string }> = {
          pending: { backgroundColor: '#fef3c7', color: '#f59e0b', border: '1px solid #f59e0b', label: '待审批' },
          approved: { backgroundColor: '#d1fae5', color: '#10b981', border: '1px solid #10b981', label: '已通过' },
          rejected: { backgroundColor: '#fee2e2', color: '#ef4444', border: '1px solid #ef4444', label: '已拒绝' }
        }
        const style = statusStyles[record.status] || statusStyles.pending
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '4px 12px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: '600',
            backgroundColor: style.backgroundColor,
            color: style.color,
            border: style.border
          }}>
            {style.label}
          </span>
        )
      },
    },
    {
      title: '提交时间',
      dataIndex: 'submittedAt',
      width: 180,
      valueType: 'dateTime',
      search: false,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 200,
      render: (_, record) => {
        const isPending = record.status === 'pending'
        return (
          <Space size="small">
            <Button
              type="link"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetail(record)}
              style={{ color: '#1677ff', fontWeight: '500' }}
            >
              详情
            </Button>
            {isPending && (
              <>
                <Button
                  type="link"
                  icon={<CheckCircleOutlined />}
                  onClick={() => handleApprove(record)}
                  style={{ color: '#52c41a', fontWeight: '500' }}
                >
                  批准
                </Button>
                <Button
                  type="link"
                  icon={<CloseCircleOutlined />}
                  onClick={() => handleReject(record)}
                  style={{ color: '#ff4d4f', fontWeight: '500' }}
                >
                  拒绝
                </Button>
              </>
            )}
          </Space>
        )
      },
    },
  ]

  // 获取表格数据
  const fetchData = async (params: PaginationParams & {
    title?: string
    applicantId?: number
    startDate?: string
    endDate?: string
  }) => {
    try {
      const response = await advertisementService.getPendingAds({
        ...params,
        status: activeTab !== 'all' ? activeTab as 'pending' | 'approved' | 'rejected' : undefined,
      })

      let list = response?.list || []

      // Client-side filtering for date range
      if (dateRange && dateRange[0] && dateRange[1]) {
        const start = dateRange[0].startOf('day')
        const end = dateRange[1].endOf('day')
        list = list.filter((ad: Advertisement) => {
          const adDate = dayjs((ad as any).submittedAt || ad.created_at)
          return adDate.isAfter(start) && adDate.isBefore(end)
        })
      }

      return {
        data: list,
        success: true,
        total: response?.total || 0,
      }
    } catch (error) {
      console.error('Get ads failed:', error)
      return {
        data: [],
        success: false,
        total: 0,
      }
    }
  }

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      {/* 页面标题区域 */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        padding: '24px',
        marginBottom: '24px',
        border: '1px solid #f0f0f0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
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
            <FileTextOutlined style={{ fontSize: '24px', color: 'white' }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '700', color: '#1f2937', lineHeight: '1.2' }}>
              广告审批管理
            </h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#6b7280', lineHeight: '1.4' }}>
              管理和审核所有广告投放申请，支持批量操作
            </p>
          </div>
        </div>
      </div>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        {[
          { title: '总申请数', value: stats.total, color: '#1677ff', icon: <FileTextOutlined /> },
          { title: '待审批', value: stats.pending, color: '#f59e0b', icon: <FileTextOutlined /> },
          { title: '已通过', value: stats.approved, color: '#10b981', icon: <CheckCircleOutlined /> },
          { title: '已拒绝', value: stats.rejected, color: '#ef4444', icon: <CloseCircleOutlined /> },
        ].map((item, index) => (
          <Col xs={24} sm={12} lg={6} key={index}>
            <Card style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #f0f0f0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
            }}>
              <Statistic
                title={item.title}
                value={item.value}
                prefix={React.cloneElement(item.icon, { style: { color: item.color } })}
                valueStyle={{ color: item.color }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* 主要内容卡片 */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        border: '1px solid #f0f0f0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        overflow: 'hidden'
      }}>
        {/* 标签页 + 批量操作 */}
        <div style={{
          padding: '24px 24px 0',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                { key: 'all', label: '全部', count: stats.total, color: '#1677ff', bgColor: '#e6f4ff' },
                { key: 'pending', label: '待审批', count: stats.pending, color: '#f59e0b', bgColor: '#fef3c7' },
                { key: 'approved', label: '已通过', count: stats.approved, color: '#10b981', bgColor: '#d1fae5' },
                { key: 'rejected', label: '已拒绝', count: stats.rejected, color: '#ef4444', bgColor: '#fee2e2' }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => { setActiveTab(tab.key); setSelectedRowKeys([]); actionRef.current?.reload(); }}
                  style={{
                    padding: '12px 20px',
                    borderRadius: '12px',
                    border: 'none',
                    backgroundColor: activeTab === tab.key ? tab.bgColor : 'transparent',
                    color: activeTab === tab.key ? tab.color : '#6b7280',
                    fontSize: '14px',
                    fontWeight: activeTab === tab.key ? '600' : '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <span>{tab.label}</span>
                  <span style={{
                    backgroundColor: activeTab === tab.key ? 'rgba(255, 255, 255, 0.8)' : '#e5e7eb',
                    color: activeTab === tab.key ? tab.color : '#6b7280',
                    fontSize: '12px',
                    fontWeight: '600',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    minWidth: '20px',
                    textAlign: 'center'
                  }}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
            {activeTab === 'pending' && selectedRowKeys.length > 0 && (
              <Space>
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  onClick={handleBatchApprove}
                  style={{ backgroundColor: '#10b981', borderColor: '#10b981', borderRadius: '8px' }}
                >
                  批量批准 ({selectedRowKeys.length})
                </Button>
                <Button
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={handleBatchReject}
                  style={{ borderRadius: '8px' }}
                >
                  批量拒绝 ({selectedRowKeys.length})
                </Button>
              </Space>
            )}
          </div>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '16px' }}>
            <RangePicker
              onChange={(dates) => {
                setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)
                // Trigger table reload when date range changes
                setTimeout(() => actionRef.current?.reload(), 0)
              }}
              style={{ borderRadius: '8px' }}
            />
          </div>
        </div>

        {/* 表格区域 */}
        <div style={{ padding: '0 24px 24px' }}>
          <SafeProTable
            columns={columns}
            actionRef={actionRef}
            rowKey="id"
            rowSelection={activeTab === 'pending' ? {
              selectedRowKeys,
              onChange: setSelectedRowKeys,
            } : undefined}
            search={{
              labelWidth: 120,
              style: {
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                padding: '16px',
                borderRadius: '12px',
                marginBottom: '16px'
              }
            }}
            request={fetchData}
            columnsState={{
              persistenceKey: 'ad-approval-table',
              persistenceType: 'localStorage',
            }}
            pagination={{
              defaultPageSize: 10,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50', '100'],
              style: { paddingTop: '16px', borderTop: '1px solid #e5e7eb' }
            }}
            dateFormatter="string"
            headerTitle=""
            options={{ fullScreen: false, reload: true, setting: true }}
            toolBarRender={() => []}
          />
        </div>
      </div>

      {/* 广告详情弹窗 */}
      <Modal
        title="广告详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>关闭</Button>
        ]}
        width={800}
      >
        {selectedAd && (
          <Descriptions column={2} bordered>
            <Descriptions.Item label="广告ID" span={2}>{selectedAd.id}</Descriptions.Item>
            <Descriptions.Item label="广告标题" span={2}>{selectedAd.title}</Descriptions.Item>
            <Descriptions.Item label="广告描述" span={2}>{selectedAd.description}</Descriptions.Item>
            <Descriptions.Item label="申请人">{selectedAd.username || selectedAd.nickname || '未知用户'}</Descriptions.Item>
            <Descriptions.Item label="用户ID">{selectedAd.user_id}</Descriptions.Item>
            <Descriptions.Item label="广告尺寸">{selectedAd.width} x {selectedAd.height}</Descriptions.Item>
            <Descriptions.Item label="价格">{selectedAd.price ? `${selectedAd.price} 积分` : '-'}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={selectedAd.status === 'pending' ? 'orange' : selectedAd.status === 'approved' ? 'green' : 'red'}>
                {selectedAd.status === 'pending' ? '待审批' : selectedAd.status === 'approved' ? '已通过' : '已拒绝'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="投放位置">
              {(() => {
                const loc = (selectedAd as any).targetLocation
                if (!loc) return '未指定'
                const parsed = typeof loc === 'string' ? JSON.parse(loc) : loc
                return parsed?.lat !== undefined ? `${Number(parsed.lat).toFixed(4)}, ${Number(parsed.lng).toFixed(4)}` : '未指定'
              })()}
            </Descriptions.Item>
            <Descriptions.Item label="提交时间">
              {dayjs((selectedAd as any).submittedAt || selectedAd.created_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="投放时间">
              {(selectedAd as any).scheduledTime
                ? new Date((selectedAd as any).scheduledTime).toLocaleString()
                : '审批通过后即时投放'}
            </Descriptions.Item>
            <Descriptions.Item label="处理时间">
              {selectedAd.processed_at ? dayjs(selectedAd.processed_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="处理人" span={2}>
              {selectedAd.processedByName || '-'}
            </Descriptions.Item>
            {selectedAd.admin_notes && (
              <Descriptions.Item label={selectedAd.status === 'rejected' ? '拒绝原因' : '管理员备注'} span={2}>
                <div style={{
                  padding: '8px 12px',
                  backgroundColor: selectedAd.status === 'rejected' ? '#fff2f0' : '#f6ffed',
                  borderRadius: '4px',
                  border: `1px solid ${selectedAd.status === 'rejected' ? '#ffccc7' : '#b7eb8f'}`,
                  whiteSpace: 'pre-wrap'
                }}>
                  {selectedAd.admin_notes}
                </div>
              </Descriptions.Item>
            )}
            <Descriptions.Item label="广告图片" span={2}>
              <Image width={300} src={selectedAd.image_url} alt="广告图片" style={{ maxWidth: '100%', maxHeight: '300px', objectFit: 'contain' }} />
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* 批准弹窗 - 备注改为选填 */}
      <Modal
        title="批准广告"
        open={approveModalVisible}
        onOk={handleApproveSubmit}
        onCancel={() => setApproveModalVisible(false)}
        okText="确认批准"
        cancelText="取消"
      >
        <Form form={approveForm} layout="vertical">
          <Form.Item label="批准备注（选填）" name="notes">
            <Input.TextArea rows={4} placeholder="请输入批准原因或备注..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* 拒绝弹窗 */}
      <Modal
        title="拒绝广告"
        open={rejectModalVisible}
        onOk={handleRejectSubmit}
        onCancel={() => setRejectModalVisible(false)}
        okText="确认拒绝"
        cancelText="取消"
      >
        <Form form={rejectForm} layout="vertical">
          <Form.Item label="拒绝原因" name="reason" rules={[{ required: true, message: '请输入拒绝原因' }]}>
            <Input.TextArea rows={4} placeholder="请输入拒绝原因..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* 批量拒绝弹窗 */}
      <Modal
        title={`批量拒绝 ${selectedRowKeys.length} 条广告`}
        open={batchRejectModalVisible}
        onOk={handleBatchRejectSubmit}
        onCancel={() => setBatchRejectModalVisible(false)}
        okText="确认拒绝"
        okType="danger"
        cancelText="取消"
      >
        <Form form={batchRejectForm} layout="vertical">
          <Form.Item label="拒绝原因" name="reason" rules={[{ required: true, message: '请输入拒绝原因' }]}>
            <Input.TextArea rows={4} placeholder="请输入统一的拒绝原因..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default AdApproval
