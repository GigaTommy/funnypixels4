import React, { useState, useRef } from 'react'
import { Button, Space, Tag, message, Drawer, Form, Input, Modal, Switch, InputNumber } from 'antd'
import { ProColumns, ActionType } from '@ant-design/pro-components'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ShoppingOutlined
} from '@ant-design/icons'
import { productService } from '@/services'
import SafeProTable from '@/components/SafeProTable'
import type { PaginationParams } from '@/types'

const { TextArea } = Input

// 广告商品接口
interface AdProduct {
  id: number
  name: string
  description?: string
  price: number
  width: number
  height: number
  duration: number
  active: boolean
  created_at: string
  updated_at: string
}

interface CreateAdProductRequest {
  name: string
  description?: string
  price: number
  width: number
  height: number
  duration: number
  active?: boolean
}

const AdProductManagement: React.FC = () => {
  const [createDrawerVisible, setCreateDrawerVisible] = useState(false)
  const [editDrawerVisible, setEditDrawerVisible] = useState(false)
  const [editingItem, setEditingItem] = useState<AdProduct | null>(null)
  const [loading, setLoading] = useState(false)
  const actionRef = useRef<ActionType>()
  const [form] = Form.useForm()
  const [editForm] = Form.useForm()

  // 表格列定义
  const columns: ProColumns<AdProduct>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
      search: false,
    },
    {
      title: '商品图标',
      dataIndex: 'icon',
      width: 80,
      search: false,
      render: () => (
        <span style={{ fontSize: '24px' }}>📢</span>
      ),
    },
    {
      title: '商品名称',
      dataIndex: 'name',
      width: 200,
      ellipsis: true,
      copyable: true,
    },
    {
      title: '商品类型',
      dataIndex: 'type',
      width: 120,
      search: false,
      render: () => (
        <Tag color="magenta">广告商品</Tag>
      ),
    },
    {
      title: '价格(积分)',
      dataIndex: 'price',
      width: 100,
      search: false,
      render: (text) => (
        <span style={{ color: '#10b981', fontWeight: '600' }}>
          {text} 积分
        </span>
      ),
    },
    {
      title: '广告尺寸',
      dataIndex: 'size',
      width: 120,
      search: false,
      render: (_, record) => (
        <span>{record.width} × {record.height}</span>
      ),
    },
    {
      title: '广告时长(天)',
      dataIndex: 'duration',
      width: 120,
      search: false,
      render: (text) => (
        <span>{text} 天</span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'active',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '已上架', status: 'Success' },
        false: { text: '已下架', status: 'Error' },
      },
      render: (_, record) => (
        <Switch
          checked={record.active}
          onChange={(checked) => handleStatusUpdate(record.id, checked)}
          size="small"
        />
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      width: 200,
      search: false,
      ellipsis: true,
    },
    {
      title: '创建时间',
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
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            style={{
              color: '#1677ff',
              fontSize: '12px'
            }}
          >
            编辑
          </Button>
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
    active?: boolean
    keyword?: string
  }) => {
    try {
      setLoading(true)
      const response = await productService.getAdProducts(params)
      const responseData = response.data.data
      return {
        data: responseData.list,
        success: true,
        total: responseData.total,
      }
    } catch (error) {
      console.error('Get ad products failed:', error)
      message.error('获取广告商品列表失败')
      return {
        data: [],
        success: false,
        total: 0,
      }
    } finally {
      setLoading(false)
    }
  }

  // 更新商品状态
  const handleStatusUpdate = async (id: number, active: boolean) => {
    try {
      await productService.updateAdProduct(id, { active })
      message.success(active ? '商品已上架' : '商品已下架')
      actionRef.current?.reload()
    } catch (error) {
      console.error('Update ad product status failed:', error)
      message.error('状态更新失败')
    }
  }

  // 编辑
  const handleEdit = (record: AdProduct) => {
    setEditingItem(record)
    editForm.setFieldsValue({
      name: record.name,
      description: record.description,
      price: record.price,
      width: record.width,
      height: record.height,
      duration: record.duration,
      active: record.active,
    })
    setEditDrawerVisible(true)
  }

  // 删除
  const handleDelete = (record: AdProduct) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除广告商品 "${record.name}" 吗？此操作不可恢复。`,
      okText: '确认删除',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await productService.deleteAdProduct(record.id)
          message.success('删除成功')
          actionRef.current?.reload()
        } catch (error) {
          console.error('Delete ad product failed:', error)
          message.error('删除失败')
        }
      },
    })
  }

  // 创建新商品
  const handleCreate = async (values: CreateAdProductRequest) => {
    try {
      await productService.createAdProduct(values)
      message.success('创建成功')
      setCreateDrawerVisible(false)
      form.resetFields()
      actionRef.current?.reload()
    } catch (error) {
      console.error('Create ad product failed:', error)
      message.error('创建失败')
    }
  }

  // 更新商品
  const handleUpdate = async (values: Partial<CreateAdProductRequest>) => {
    if (!editingItem) return

    try {
      await productService.updateAdProduct(editingItem.id, values)
      message.success('更新成功')
      setEditDrawerVisible(false)
      setEditingItem(null)
      editForm.resetFields()
      actionRef.current?.reload()
    } catch (error) {
      console.error('Update ad product failed:', error)
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
            }}>📢</span>
          </div>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: '28px',
              fontWeight: '700',
              color: '#1f2937',
              lineHeight: '1.2'
            }}>
              广告商品管理
            </h1>
            <p style={{
              margin: '4px 0 0 0',
              fontSize: '14px',
              color: '#6b7280',
              lineHeight: '1.4'
            }}>
              管理地图广告位商品，配置广告尺寸、时长和价格
            </p>
          </div>
        </div>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateDrawerVisible(true)}
            style={{
              borderRadius: '6px',
              fontWeight: '500'
            }}
          >
            添加广告商品
          </Button>
        </Space>
      </div>

      {/* 主要内容区域 */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        border: '1px solid #f0f0f0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        overflow: 'hidden'
      }}>
        <SafeProTable
          columns={columns}
          actionRef={actionRef}
          rowKey="id"
          search={{
            labelWidth: 120,
            style: {
              backgroundColor: '#fafafa',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '16px',
              border: '1px solid #f0f0f0'
            }
          }}
          request={fetchData}
          columnsState={{
            persistenceKey: 'ad-product-list-table',
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

      {/* 创建商品抽屉 */}
      <Drawer
        title="添加广告商品"
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
            name="name"
            label="商品名称"
            rules={[{ required: true, message: '请输入商品名称' }]}
          >
            <Input placeholder="例如: 7天广告位（100×100）" />
          </Form.Item>
          <Form.Item
            name="description"
            label="商品描述"
          >
            <TextArea rows={4} placeholder="请输入商品描述" />
          </Form.Item>
          <Form.Item
            name="price"
            label="商品价格(积分)"
            rules={[{ required: true, message: '请输入商品价格' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="请输入商品价格"
              min={0}
            />
          </Form.Item>
          <Form.Item
            name="width"
            label="广告宽度(像素)"
            rules={[{ required: true, message: '请输入广告宽度' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="请输入广告宽度"
              min={1}
            />
          </Form.Item>
          <Form.Item
            name="height"
            label="广告高度(像素)"
            rules={[{ required: true, message: '请输入广告高度' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="请输入广告高度"
              min={1}
            />
          </Form.Item>
          <Form.Item
            name="duration"
            label="广告时长(天)"
            rules={[{ required: true, message: '请输入广告时长' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="请输入广告时长"
              min={1}
            />
          </Form.Item>
          <Form.Item
            name="active"
            label="商品状态"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch checkedChildren="上架" unCheckedChildren="下架" />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => {
                setCreateDrawerVisible(false)
                form.resetFields()
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                创建
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Drawer>

      {/* 编辑商品抽屉 */}
      <Drawer
        title="编辑广告商品"
        width={600}
        open={editDrawerVisible}
        onClose={() => {
          setEditDrawerVisible(false)
          setEditingItem(null)
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
            name="name"
            label="商品名称"
            rules={[{ required: true, message: '请输入商品名称' }]}
          >
            <Input placeholder="例如: 7天广告位（100×100）" />
          </Form.Item>
          <Form.Item
            name="description"
            label="商品描述"
          >
            <TextArea rows={4} placeholder="请输入商品描述" />
          </Form.Item>
          <Form.Item
            name="price"
            label="商品价格(积分)"
            rules={[{ required: true, message: '请输入商品价格' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="请输入商品价格"
              min={0}
            />
          </Form.Item>
          <Form.Item
            name="width"
            label="广告宽度(像素)"
            rules={[{ required: true, message: '请输入广告宽度' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="请输入广告宽度"
              min={1}
            />
          </Form.Item>
          <Form.Item
            name="height"
            label="广告高度(像素)"
            rules={[{ required: true, message: '请输入广告高度' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="请输入广告高度"
              min={1}
            />
          </Form.Item>
          <Form.Item
            name="duration"
            label="广告时长(天)"
            rules={[{ required: true, message: '请输入广告时长' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="请输入广告时长"
              min={1}
            />
          </Form.Item>
          <Form.Item
            name="active"
            label="商品状态"
            valuePropName="checked"
          >
            <Switch checkedChildren="上架" unCheckedChildren="下架" />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => {
                setEditDrawerVisible(false)
                setEditingItem(null)
                editForm.resetFields()
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                更新
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  )
}

export default AdProductManagement
