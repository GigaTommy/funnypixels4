import React, { useState, useEffect, useCallback } from 'react'
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Modal,
  Input,
  message,
  Tabs,
  Typography,
} from 'antd'
import {
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { systemAlertService, type SystemAlert } from '@/services/systemAlert'
import { formatDateTime } from '@/utils/format'
import PageHeader from '@/components/PageHeader'

const { TextArea } = Input
const { Text } = Typography

const severityColor: Record<string, string> = {
  info: 'blue',
  warning: 'orange',
  critical: 'red',
}

const severityLabel: Record<string, string> = {
  info: '信息',
  warning: '警告',
  critical: '严重',
}

const typeLabel: Record<string, string> = {
  reconciliation: '积分对账',
  security: '安全告警',
  system: '系统异常',
}

const SystemAlerts: React.FC = () => {
  const [alerts, setAlerts] = useState<SystemAlert[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [activeTab, setActiveTab] = useState('unresolved')
  const [resolveModalVisible, setResolveModalVisible] = useState(false)
  const [selectedAlert, setSelectedAlert] = useState<SystemAlert | null>(null)
  const [resolutionNote, setResolutionNote] = useState('')
  const [detailModalVisible, setDetailModalVisible] = useState(false)

  const fetchAlerts = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = { page, limit: 20 }
      if (activeTab === 'unresolved') params.is_resolved = 'false'
      if (activeTab === 'resolved') params.is_resolved = 'true'

      const result = await systemAlertService.getList(params)
      setAlerts(result.alerts)
      setTotal(result.total)
    } catch {
      message.error('获取告警列表失败')
    } finally {
      setLoading(false)
    }
  }, [page, activeTab])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  const handleResolve = async () => {
    if (!selectedAlert) return
    try {
      await systemAlertService.resolve(selectedAlert.id, resolutionNote)
      message.success('告警已标记为已处理')
      setResolveModalVisible(false)
      setResolutionNote('')
      setSelectedAlert(null)
      fetchAlerts()
    } catch {
      message.error('操作失败')
    }
  }

  const columns: ColumnsType<SystemAlert> = [
    {
      title: '级别',
      dataIndex: 'severity',
      width: 80,
      render: (severity: string) => (
        <Tag color={severityColor[severity]}>{severityLabel[severity] || severity}</Tag>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 100,
      render: (type: string) => typeLabel[type] || type,
    },
    {
      title: '标题',
      dataIndex: 'title',
      ellipsis: true,
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      width: 170,
      render: (val: string) => formatDateTime(val),
    },
    {
      title: '状态',
      dataIndex: 'is_resolved',
      width: 90,
      render: (resolved: boolean) =>
        resolved ? (
          <Tag color="green" icon={<CheckCircleOutlined />}>已处理</Tag>
        ) : (
          <Tag color="red" icon={<ExclamationCircleOutlined />}>待处理</Tag>
        ),
    },
    {
      title: '操作',
      width: 150,
      render: (_: any, record: SystemAlert) => (
        <Space>
          <Button
            size="small"
            onClick={() => {
              setSelectedAlert(record)
              setDetailModalVisible(true)
            }}
          >
            详情
          </Button>
          {!record.is_resolved && (
            <Button
              size="small"
              type="primary"
              onClick={() => {
                setSelectedAlert(record)
                setResolutionNote('')
                setResolveModalVisible(true)
              }}
            >
              处理
            </Button>
          )}
        </Space>
      ),
    },
  ]

  const tabItems = [
    { label: '待处理', key: 'unresolved' },
    { label: '已处理', key: 'resolved' },
    { label: '全部', key: 'all' },
  ]

  return (
    <div>
      <PageHeader
        title="系统告警"
        description="积分对账异常、安全告警等需要管理员处理的事件"
      />
      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Tabs
            activeKey={activeTab}
            items={tabItems}
            onChange={(key) => {
              setActiveTab(key)
              setPage(1)
            }}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchAlerts}>
            刷新
          </Button>
        </Space>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={alerts}
          loading={loading}
          pagination={{
            current: page,
            total,
            pageSize: 20,
            onChange: setPage,
            showTotal: (t) => `共 ${t} 条`,
          }}
        />
      </Card>

      {/* 详情弹窗 */}
      <Modal
        title="告警详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={640}
      >
        {selectedAlert && (
          <div>
            <p><Text strong>级别：</Text><Tag color={severityColor[selectedAlert.severity]}>{severityLabel[selectedAlert.severity]}</Tag></p>
            <p><Text strong>类型：</Text>{typeLabel[selectedAlert.type] || selectedAlert.type}</p>
            <p><Text strong>标题：</Text>{selectedAlert.title}</p>
            <p><Text strong>描述：</Text>{selectedAlert.message}</p>
            <p><Text strong>时间：</Text>{formatDateTime(selectedAlert.created_at)}</p>
            {selectedAlert.is_resolved && (
              <>
                <p><Text strong>处理人：</Text>{selectedAlert.resolved_by}</p>
                <p><Text strong>处理时间：</Text>{formatDateTime(selectedAlert.resolved_at || '')}</p>
                <p><Text strong>处理说明：</Text>{selectedAlert.resolution_note}</p>
              </>
            )}
            {selectedAlert.details && (
              <div style={{ marginTop: 16 }}>
                <Text strong>详细数据：</Text>
                <pre style={{
                  background: '#f5f5f5',
                  padding: 12,
                  borderRadius: 6,
                  maxHeight: 300,
                  overflow: 'auto',
                  fontSize: 12,
                  marginTop: 8,
                }}>
                  {JSON.stringify(selectedAlert.details, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* 处理弹窗 */}
      <Modal
        title="处理告警"
        open={resolveModalVisible}
        onCancel={() => setResolveModalVisible(false)}
        onOk={handleResolve}
        okText="确认处理"
      >
        <p style={{ marginBottom: 8 }}>{selectedAlert?.title}</p>
        <TextArea
          rows={3}
          placeholder="处理说明（可选）"
          value={resolutionNote}
          onChange={(e) => setResolutionNote(e.target.value)}
        />
      </Modal>
    </div>
  )
}

export default SystemAlerts
