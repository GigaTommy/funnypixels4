import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card,
  Button,
  Space,
  Tag,
  Image,
  message,
  Modal,
  Input,
  Spin
} from 'antd'
import { FooterToolbar } from '@ant-design/pro-components'
import {
  ArrowLeftOutlined,
  CheckOutlined,
  CloseOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons'
import { ProDescriptions } from '@ant-design/pro-components'
import { advertisementService } from '@/services'
import type { Advertisement } from '@/types'

const { TextArea } = Input

const AdDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [ad, setAd] = useState<Advertisement | null>(null)
  const [loading, setLoading] = useState(true)
  const [approveLoading, setApproveLoading] = useState(false)
  const [rejectModalVisible, setRejectModalVisible] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  // 加载广告详情
  useEffect(() => {
    const loadAdDetail = async () => {
      if (!id) return

      try {
        const data = await advertisementService.getAdById(id)
        setAd(data)
      } catch (error) {
        console.error('Load ad detail failed:', error)
        message.error('加载广告详情失败')
      } finally {
        setLoading(false)
      }
    }

    loadAdDetail()
  }, [id])

  // 处理审批通过
  const handleApprove = async () => {
    if (!ad) return

    Modal.confirm({
      title: '确认通过',
      content: `确定要通过广告 "${ad.title}" 的审批吗？`,
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        setApproveLoading(true)
        try {
          await advertisementService.approveAd({
            id: ad.id,
            status: 'approved',
          })
          message.success('审批通过成功')

          // 重新加载数据
          const updatedAd = await advertisementService.getAdById(ad.id)
          setAd(updatedAd)
        } catch (error) {
          console.error('Approve ad failed:', error)
          message.error('审批通过失败')
        } finally {
          setApproveLoading(false)
        }
      },
    })
  }

  // 处理审批拒绝
  const handleReject = async () => {
    if (!ad) return

    if (!rejectReason.trim()) {
      message.error('请输入拒绝理由')
      return
    }

    setApproveLoading(true)
    try {
      await advertisementService.approveAd({
        id: ad.id,
        status: 'rejected',
        rejectReason: rejectReason.trim(),
      })
      message.success('审批拒绝成功')
      setRejectModalVisible(false)
      setRejectReason('')

      // 重新加载数据
      const updatedAd = await advertisementService.getAdById(ad.id)
      setAd(updatedAd)
    } catch (error) {
      console.error('Reject ad failed:', error)
      message.error('审批拒绝失败')
    } finally {
      setApproveLoading(false)
    }
  }

  // 获取状态配置
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          label: '待审批',
          color: 'orange',
          icon: <ClockCircleOutlined />
        }
      case 'approved':
        return {
          label: '已通过',
          color: 'green',
          icon: <CheckCircleOutlined />
        }
      case 'rejected':
        return {
          label: '已拒绝',
          color: 'red',
          icon: <CloseCircleOutlined />
        }
      case 'expired':
        return {
          label: '已过期',
          color: 'gray',
          icon: <ClockCircleOutlined />
        }
      default:
        return { label: '未知状态', color: 'default', icon: null }
    }
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh'
      }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!ad) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh'
      }}>
        <div>
          <h3>广告不存在</h3>
          <Button type="primary" onClick={() => navigate('/ad/approval')}>
            返回列表
          </Button>
        </div>
      </div>
    )
  }

  const statusConfig = getStatusConfig(ad.status)

  return (
    <div style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh' }}>
      {/* 顶部操作栏 */}
      <Card style={{ marginBottom: '24px' }}>
        <Space>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/ad/approval')}
          >
            返回列表
          </Button>
          <Tag
            color={statusConfig.color}
            icon={statusConfig.icon}
            style={{ fontSize: '14px', padding: '4px 12px' }}
          >
            {statusConfig.label}
          </Tag>
        </Space>
      </Card>

      {/* 广告详情 */}
      <Card title="广告详情" style={{ marginBottom: '24px' }}>
        <ProDescriptions
          column={2}
          dataSource={ad}
          columns={[
            {
              title: '广告ID',
              dataIndex: 'id',
              span: 1,
            },
            {
              title: '状态',
              dataIndex: 'status',
              span: 1,
              render: () => (
                <Tag color={statusConfig.color} icon={statusConfig.icon}>
                  {statusConfig.label}
                </Tag>
              ),
            },
            {
              title: '广告标题',
              dataIndex: 'title',
              span: 2,
            },
            {
              title: '广告描述',
              dataIndex: 'description',
              span: 2,
              render: (_, record: any) => (
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                  {record.description}
                </div>
              ),
            },
            {
              title: '广告图片',
              dataIndex: 'image_url',
              span: 2,
              render: (_, record: any) => (
                <Image
                  src={record.image_url}
                  alt="广告图片"
                  style={{
                    maxWidth: '300px',
                    maxHeight: '200px',
                    objectFit: 'contain',
                    border: '1px solid #d9d9d9',
                    borderRadius: '6px'
                  }}
                  placeholder={
                    <div style={{
                      width: '300px',
                      height: '200px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#f5f5f5',
                      border: '1px dashed #d9d9d9',
                      borderRadius: '6px'
                    }}>
                      图片加载中...
                    </div>
                  }
                />
              ),
            },
            {
              title: '经纬度',
              span: 1,
              render: (_, record: any) => `${record.lat}, ${record.lng}`,
            },
            {
              title: '网格ID',
              dataIndex: 'grid_id',
              span: 1,
            },
            {
              title: '尺寸',
              span: 1,
              render: (_, record: any) => `${record.width} × ${record.height}`,
            },
            {
              title: '用户ID',
              dataIndex: 'user_id',
              span: 1,
            },
            {
              title: '用户名',
              dataIndex: 'username',
              span: 1,
            },
            {
              title: '昵称',
              dataIndex: 'nickname',
              span: 1,
            },
            {
              title: '开始时间',
              dataIndex: 'start_time',
              span: 1,
              valueType: 'dateTime',
            },
            {
              title: '结束时间',
              dataIndex: 'end_time',
              span: 1,
              valueType: 'dateTime',
            },
            {
              title: '重复次数',
              dataIndex: 'repeat_count',
              span: 1,
            },
          ]}
        />
      </Card>

      {/* 底部操作栏 - 仅对待审批状态显示 */}
      {ad.status === 'pending' && (
        <FooterToolbar extra="操作栏">
          <Space size="large">
            <Button
              size="large"
              icon={<CloseOutlined />}
              onClick={() => setRejectModalVisible(true)}
              loading={approveLoading}
            >
              拒绝
            </Button>
            <Button
              type="primary"
              size="large"
              icon={<CheckOutlined />}
              onClick={handleApprove}
              loading={approveLoading}
              style={{
                backgroundColor: '#52c41a',
                borderColor: '#52c41a'
              }}
            >
              通过
            </Button>
          </Space>
        </FooterToolbar>
      )}

      {/* 拒绝理由模态框 */}
      <Modal
        title="拒绝理由"
        open={rejectModalVisible}
        onCancel={() => {
          setRejectModalVisible(false)
          setRejectReason('')
        }}
        footer={[
          <Button key="cancel" onClick={() => setRejectModalVisible(false)}>
            取消
          </Button>,
          <Button
            key="submit"
            type="primary"
            danger
            onClick={handleReject}
            loading={approveLoading}
            disabled={!rejectReason.trim()}
          >
            确认拒绝
          </Button>,
        ]}
      >
        <div style={{ marginBottom: 16 }}>
          <p>请输入拒绝该广告申请的理由：</p>
          <TextArea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="请详细说明拒绝理由..."
            rows={4}
            maxLength={500}
            showCount
          />
        </div>
      </Modal>
    </div>
  )
}

export default AdDetail