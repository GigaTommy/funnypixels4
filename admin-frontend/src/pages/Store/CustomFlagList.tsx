import React, { useState, useRef } from 'react'
import { Button, Space, Tag, message, Drawer, Form, Input, Select, Modal, Image } from 'antd'
import { ProColumns, ActionType } from '@ant-design/pro-components'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons'
import { storeService } from '@/services'
import SafeProTable from '@/components/SafeProTable'
import type {
  CustomFlag,
  CreateCustomFlagRequest,
  UpdateCustomFlagRequest,
  PaginationParams
} from '@/types'

const { TextArea } = Input

const CustomFlagList: React.FC = () => {
  const [createDrawerVisible, setCreateDrawerVisible] = useState(false)
  const [editDrawerVisible, setEditDrawerVisible] = useState(false)
  const [viewModalVisible, setViewModalVisible] = useState(false)
  const [viewingFlag, setViewingFlag] = useState<CustomFlag | null>(null)
  const [editingFlag, setEditingFlag] = useState<CustomFlag | null>(null)
  const [loading, setLoading] = useState(false)
  const actionRef = useRef<ActionType>()
  const [form] = Form.useForm()
  const [editForm] = Form.useForm()

  // 状态选项
  const statusOptions = {
    pending: { label: '待审核', color: 'orange' },
    approved: { label: '已通过', color: 'green' },
    rejected: { label: '已拒绝', color: 'red' },
  }

  // 表格列定义
  const columns: ProColumns<CustomFlag>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
      search: false,
    },
    {
      title: '标题',
      dataIndex: 'title',
      width: 200,
      ellipsis: true,
      copyable: true,
    },
    {
      title: '申请人',
      dataIndex: 'username',
      width: 120,
      search: false,
      render: (_, record) => (
        <Space>
          <span>{record.username}</span>
          {record.nickname && (
            <Tag color="blue" style={{ fontSize: '12px' }}>
              {record.nickname}
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: '尺寸',
      dataIndex: 'width',
      width: 100,
      search: false,
      render: (_, record) => `${record.width} × ${record.height}`,
    },
    {
      title: '位置',
      dataIndex: 'grid_x',
      width: 120,
      search: false,
      render: (_, record) => `(${record.grid_x}, ${record.grid_y})`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        pending: { text: '待审核', status: 'Pending' },
        approved: { text: '已通过', status: 'Success' },
        rejected: { text: '已拒绝', status: 'Error' },
      },
      render: (_, record) => {
        const statusConfig = statusOptions[record.status as keyof typeof statusOptions]
        return (
          <Tag
            color={statusConfig?.color}
            style={{
              fontWeight: '500',
              borderRadius: '12px',
              padding: '4px 12px'
            }}
          >
            {statusConfig?.label}
          </Tag>
        )
      },
    },
    {
      title: '提交时间',
      dataIndex: 'created_at',
      width: 180,
      valueType: 'dateTime',
      search: false,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 180,
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
            style={{
              color: '#6366f1',
              fontSize: '12px'
            }}
          >
            查看
          </Button>
          {record.status === 'pending' && (
            <>
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
                style={{
                  color: '#6366f1',
                  fontSize: '12px'
                }}
              >
                编辑
              </Button>
              <Button
                type="text"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => handleApprove(record, 'approved')}
                style={{
                  color: '#10b981',
                  fontSize: '12px'
                }}
              >
                通过
              </Button>
              <Button
                type="text"
                size="small"
                icon={<CloseCircleOutlined />}
                onClick={() => handleApprove(record, 'rejected')}
                style={{
                  color: '#ef4444',
                  fontSize: '12px'
                }}
              >
                拒绝
              </Button>
            </>
          )}
          <Button
            type="text"
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
            style={{
              color: '#ef4444',
              fontSize: '12px'
            }}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ]

  // 获取表格数据
  const fetchData = async (params: PaginationParams & {
    title?: string
    status?: 'pending' | 'approved' | 'rejected'
  }) => {
    try {
      setLoading(true)
      const response = await storeService.customFlag.getList(params)
      return {
        data: response.list,
        success: true,
        total: response.total,
      }
    } catch (error) {
      console.error('Get custom flags failed:', error)
      message.error('获取自定义旗帜列表失败')
      return {
        data: [],
        success: false,
        total: 0,
      }
    } finally {
      setLoading(false)
    }
  }

  // 查看详情
  const handleView = (record: CustomFlag) => {
    setViewingFlag(record)
    setViewModalVisible(true)
  }

  // 编辑
  const handleEdit = (record: CustomFlag) => {
    setEditingFlag(record)
    editForm.setFieldsValue({
      title: record.title,
      description: record.description,
    })
    setEditDrawerVisible(true)
  }

  // 审批
  const handleApprove = async (record: CustomFlag, status: 'approved' | 'rejected') => {
    try {
      await storeService.customFlag.approve(record.id, { status })
      message.success(status === 'approved' ? '已通过审批' : '已拒绝审批')
      actionRef.current?.reload()
    } catch (error) {
      console.error('Approve custom flag failed:', error)
      message.error('审批操作失败')
    }
  }

  // 删除
  const handleDelete = (record: CustomFlag) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除自定义旗帜 "${record.title}" 吗？此操作不可恢复。`,
      okText: '确认删除',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await storeService.customFlag.delete(record.id)
          message.success('删除成功')
          actionRef.current?.reload()
        } catch (error) {
          console.error('Delete custom flag failed:', error)
          message.error('删除失败')
        }
      },
    })
  }

  // 创建新自定义旗帜
  const handleCreate = async (values: CreateCustomFlagRequest) => {
    try {
      await storeService.customFlag.create(values)
      message.success('创建成功')
      setCreateDrawerVisible(false)
      form.resetFields()
      actionRef.current?.reload()
    } catch (error) {
      console.error('Create custom flag failed:', error)
      message.error('创建失败')
    }
  }

  // 更新自定义旗帜
  const handleUpdate = async (values: UpdateCustomFlagRequest) => {
    if (!editingFlag) return

    try {
      await storeService.customFlag.update(editingFlag.id, values)
      message.success('更新成功')
      setEditDrawerVisible(false)
      setEditingFlag(null)
      editForm.resetFields()
      actionRef.current?.reload()
    } catch (error) {
      console.error('Update custom flag failed:', error)
      message.error('更新失败')
    }
  }

  return (
    <div style={{
      position: 'relative',
      minHeight: '100vh'
    }}>
      {/* 页面标题区域 */}
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(8px)',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '24px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            backgroundColor: '#6366f1',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '16px'
          }}>
            <span style={{
              color: 'white',
              fontSize: '20px'
            }}>🚩</span>
          </div>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: '28px',
              fontWeight: '700',
              color: '#1f2937',
              lineHeight: '1.2'
            }}>
              自定义旗帜管理
            </h1>
            <p style={{
              margin: '4px 0 0 0',
              fontSize: '14px',
              color: '#6b7280',
              lineHeight: '1.4'
            }}>
              管理用户提交的自定义旗帜申请
            </p>
          </div>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateDrawerVisible(true)}
          style={{
            backgroundColor: '#6366f1',
            borderColor: '#6366f1',
            borderRadius: '8px',
            fontWeight: '500'
          }}
        >
          创建自定义旗帜
        </Button>
      </div>

      {/* 主要内容区域 */}
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(8px)',
        borderRadius: '16px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden'
      }}>
        <SafeProTable
          columns={columns}
          actionRef={actionRef}
          rowKey="id"
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
            persistenceKey: 'custom-flag-list-table',
            persistenceType: 'localStorage',
          }}
          pagination={{
            defaultPageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            style: {
              paddingTop: '16px',
              borderTop: '1px solid #e5e7eb'
            }
          }}
          dateFormatter="string"
          headerTitle=""
          options={{
            fullScreen: false,
            reload: true,
            setting: true
          }}
          toolBarRender={() => []}
        />
      </div>

      {/* 创建自定义旗帜抽屉 */}
      <Drawer
        title="创建自定义旗帜"
        width={600}
        open={createDrawerVisible}
        onClose={() => {
          setCreateDrawerVisible(false)
          form.resetFields()
        }}
        styles={{
          body: { padding: '24px' },
          header: { borderBottom: '1px solid #e5e7eb' }
        }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
        >
          <Form.Item
            name="title"
            label="旗帜标题"
            rules={[{ required: true, message: '请输入旗帜标题' }]}
          >
            <Input placeholder="请输入旗帜标题" />
          </Form.Item>
          <Form.Item
            name="description"
            label="旗帜描述"
            rules={[{ required: true, message: '请输入旗帜描述' }]}
          >
            <TextArea rows={4} placeholder="请输入旗帜描述" />
          </Form.Item>
          <Form.Item
            name="pattern_data"
            label="图案数据"
            rules={[{ required: true, message: '请输入图案数据' }]}
          >
            <TextArea rows={6} placeholder="请输入RLE编码的图案数据" />
          </Form.Item>
          <Form.Item
            name="grid_x"
            label="网格X坐标"
            rules={[{ required: true, message: '请输入网格X坐标' }]}
          >
            <Input type="number" placeholder="请输入网格X坐标" />
          </Form.Item>
          <Form.Item
            name="grid_y"
            label="网格Y坐标"
            rules={[{ required: true, message: '请输入网格Y坐标' }]}
          >
            <Input type="number" placeholder="请输入网格Y坐标" />
          </Form.Item>
          <Form.Item
            name="width"
            label="宽度"
            rules={[{ required: true, message: '请输入宽度' }]}
          >
            <Input type="number" placeholder="请输入宽度" />
          </Form.Item>
          <Form.Item
            name="height"
            label="高度"
            rules={[{ required: true, message: '请输入高度' }]}
          >
            <Input type="number" placeholder="请输入高度" />
          </Form.Item>
        </Form>
      </Drawer>

      {/* 编辑自定义旗帜抽屉 */}
      <Drawer
        title="编辑自定义旗帜"
        width={600}
        open={editDrawerVisible}
        onClose={() => {
          setEditDrawerVisible(false)
          setEditingFlag(null)
          editForm.resetFields()
        }}
        styles={{
          body: { padding: '24px' },
          header: { borderBottom: '1px solid #e5e7eb' }
        }}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleUpdate}
        >
          <Form.Item
            name="title"
            label="旗帜标题"
            rules={[{ required: true, message: '请输入旗帜标题' }]}
          >
            <Input placeholder="请输入旗帜标题" />
          </Form.Item>
          <Form.Item
            name="description"
            label="旗帜描述"
            rules={[{ required: true, message: '请输入旗帜描述' }]}
          >
            <TextArea rows={4} placeholder="请输入旗帜描述" />
          </Form.Item>
        </Form>
      </Drawer>

      {/* 查看详情弹窗 */}
      <Modal
        title="自定义旗帜详情"
        open={viewModalVisible}
        onCancel={() => {
          setViewModalVisible(false)
          setViewingFlag(null)
        }}
        width={800}
        footer={[
          <Button key="close" onClick={() => setViewModalVisible(false)}>
            关闭
          </Button>
        ]}
      >
        {viewingFlag && (
          <div style={{ padding: '16px 0' }}>
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ marginBottom: '8px' }}>基本信息</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <p style={{ margin: '4px 0', color: '#6b7280' }}>标题：</p>
                  <p style={{ fontWeight: '500' }}>{viewingFlag.title}</p>
                </div>
                <div>
                  <p style={{ margin: '4px 0', color: '#6b7280' }}>申请人：</p>
                  <p style={{ fontWeight: '500' }}>
                    {viewingFlag.username}
                    {viewingFlag.nickname && (
                      <Tag color="blue" style={{ marginLeft: '8px' }}>
                        {viewingFlag.nickname}
                      </Tag>
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ marginBottom: '8px' }}>旗帜描述</h4>
              <p style={{ lineHeight: '1.6', color: '#374151' }}>
                {viewingFlag.description}
              </p>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ marginBottom: '8px' }}>位置信息</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <p style={{ margin: '4px 0', color: '#6b7280' }}>坐标：</p>
                  <p style={{ fontWeight: '500' }}>
                    ({viewingFlag.grid_x}, {viewingFlag.grid_y})
                  </p>
                </div>
                <div>
                  <p style={{ margin: '4px 0', color: '#6b7280' }}>尺寸：</p>
                  <p style={{ fontWeight: '500' }}>
                    {viewingFlag.width} × {viewingFlag.height}
                  </p>
                </div>
              </div>
            </div>

            {viewingFlag.pattern_data && (
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ marginBottom: '8px' }}>旗帜预览</h4>
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  padding: '16px',
                  backgroundColor: '#f3f4f6',
                  borderRadius: '8px'
                }}>
                  <Image
                    width={200}
                    src={viewingFlag.pattern_data.startsWith('data:image')
                      ? viewingFlag.pattern_data
                      : `data:image/png;base64,${viewingFlag.pattern_data}`}
                    alt="旗帜预览"
                    style={{ objectFit: 'contain' }}
                  />
                </div>
              </div>
            )}

            {viewingFlag.reject_reason && (
              <div>
                <h4 style={{ marginBottom: '8px', color: '#ef4444' }}>拒绝原因</h4>
                <p style={{
                  padding: '12px',
                  backgroundColor: '#fee2e2',
                  borderRadius: '8px',
                  color: '#dc2626',
                  lineHeight: '1.6'
                }}>
                  {viewingFlag.reject_reason}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

export default CustomFlagList