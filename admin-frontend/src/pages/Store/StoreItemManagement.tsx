import React, { useState, useRef } from 'react'
import { Button, Space, Tag, message, Drawer, Form, Input, Select, Modal, Switch, InputNumber, Input as TextArea } from 'antd'
import { ProColumns, ActionType } from '@ant-design/pro-components'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  ShoppingOutlined
} from '@ant-design/icons'
import { storeService } from '@/services'
import SafeProTable from '@/components/SafeProTable'
import type {
  StoreItem,
  CreateStoreItemRequest,
  UpdateStoreItemRequest,
  PaginationParams
} from '@/types'

const { TextArea: AntTextArea } = Input

const StoreItemManagement: React.FC = () => {
  const [createDrawerVisible, setCreateDrawerVisible] = useState(false)
  const [editDrawerVisible, setEditDrawerVisible] = useState(false)
  const [editingItem, setEditingItem] = useState<StoreItem | null>(null)
  const [loading, setLoading] = useState(false)
  const actionRef = useRef<ActionType>()
  const [form] = Form.useForm()
  const [editForm] = Form.useForm()

  // 商品类型选项
  const itemTypeOptions = [
    { label: '消耗品', value: 'consumable' },
    { label: '装饰品', value: 'cosmetic' },
    { label: '特殊道具', value: 'special' },
    { label: '图案', value: 'pattern' },
    { label: '头像框', value: 'frame' },
    { label: '聊天气泡', value: 'bubble' },
    { label: '徽章', value: 'badge' },
    { label: '广告', value: 'ad' },
  ]

  // 商品类型映射到颜色
  const itemTypeColors = {
    consumable: 'green',
    cosmetic: 'purple',
    special: 'red',
    pattern: 'blue',
    frame: 'orange',
    bubble: 'cyan',
    badge: 'gold',
    ad: 'magenta',
  }

  // 表格列定义
  const columns: ProColumns<StoreItem>[] = [
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
      render: (_, record) => (
        <span style={{ fontSize: '24px' }}>
          {record.icon || getDefaultIcon(record.item_type)}
        </span>
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
      dataIndex: 'item_type',
      width: 120,
      valueType: 'select',
      valueEnum: itemTypeOptions.reduce((acc, option) => {
        acc[option.value] = { text: option.label, status: 'Default' }
        return acc
      }, {} as any),
      render: (_, record) => (
        <Tag color={itemTypeColors[record.item_type as keyof typeof itemTypeColors]}>
          {itemTypeOptions.find(opt => opt.value === record.item_type)?.label}
        </Tag>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      width: 100,
      search: false,
      render: (_, record) => (
        <Tag color="blue">{record.category}</Tag>
      ),
    },
    {
      title: '价格(积分)',
      dataIndex: 'price_points',
      width: 100,
      search: false,
      render: (text) => (
        <span style={{ color: '#10b981', fontWeight: '600' }}>
          {text} 积分
        </span>
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
              color: '#6366f1',
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
    item_type?: string
    category?: string
    active?: boolean
    keyword?: string
  }) => {
    try {
      setLoading(true)
      const response = await storeService.storeItem.getList(params)
      return {
        data: response.list,
        success: true,
        total: response.total,
      }
    } catch (error) {
      console.error('Get store items failed:', error)
      message.error('获取商店商品列表失败')
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
  const handleStatusUpdate = async (id: string, active: boolean) => {
    try {
      await storeService.storeItem.update(id, { active })
      message.success(active ? '商品已上架' : '商品已下架')
      actionRef.current?.reload()
    } catch (error) {
      console.error('Update store item status failed:', error)
      message.error('状态更新失败')
    }
  }

  // 编辑
  const handleEdit = (record: StoreItem) => {
    setEditingItem(record)
    editForm.setFieldsValue({
      name: record.name,
      description: record.description,
      price_points: record.price_points,
      item_type: record.item_type,
      category: record.category,
      icon: record.icon,
      metadata: record.metadata ? JSON.stringify(record.metadata, null, 2) : null,
      active: record.active,
    })
    setEditDrawerVisible(true)
  }

  // 删除
  const handleDelete = (record: StoreItem) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除商品 "${record.name}" 吗？此操作不可恢复。`,
      okText: '确认删除',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await storeService.storeItem.delete(record.id)
          message.success('删除成功')
          actionRef.current?.reload()
        } catch (error) {
          console.error('Delete store item failed:', error)
          message.error('删除失败')
        }
      },
    })
  }

  // 创建新商品
  const handleCreate = async (values: CreateStoreItemRequest) => {
    try {
      // 处理metadata字段
      if (values.metadata) {
        try {
          values.metadata = JSON.parse(values.metadata as string)
        } catch (e) {
          message.error('metadata 必须是合法的 JSON 格式')
          return
        }
      }

      await storeService.storeItem.create(values)
      message.success('创建成功')
      setCreateDrawerVisible(false)
      form.resetFields()
      actionRef.current?.reload()
    } catch (error) {
      console.error('Create store item failed:', error)
      message.error('创建失败')
    }
  }

  // 更新商品
  const handleUpdate = async (values: UpdateStoreItemRequest) => {
    if (!editingItem) return

    try {
      // 处理metadata字段
      if (values.metadata !== undefined) {
        if (values.metadata === null || values.metadata === '') {
          values.metadata = null
        } else {
          try {
            values.metadata = JSON.parse(values.metadata as string)
          } catch (e) {
            message.error('metadata 必须是合法的 JSON 格式')
            return
          }
        }
      }

      await storeService.storeItem.update(editingItem.id, values)
      message.success('更新成功')
      setEditDrawerVisible(false)
      setEditingItem(null)
      editForm.resetFields()
      actionRef.current?.reload()
    } catch (error) {
      console.error('Update store item failed:', error)
      message.error('更新失败')
    }
  }

  // 获取默认图标
  const getDefaultIcon = (itemType: string) => {
    const iconMap = {
      consumable: '🧪',
      cosmetic: '✨',
      special: '💣',
      pattern: '🎨',
      frame: '🖼️',
      bubble: '💭',
      badge: '🏆',
      ad: '📢'
    }
    return iconMap[itemType as keyof typeof iconMap] || '📦'
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
            backgroundColor: '#10b981',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '16px'
          }}>
            <span style={{
              color: 'white',
              fontSize: '20px'
            }}>🛍️</span>
          </div>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: '28px',
              fontWeight: '700',
              color: '#1f2937',
              lineHeight: '1.2'
            }}>
              道具商品管理
            </h1>
            <p style={{
              margin: '4px 0 0 0',
              fontSize: '14px',
              color: '#6b7280',
              lineHeight: '1.4'
            }}>
              管理消耗品、装饰品、特殊道具、图案、头像框、聊天气泡、徽章等道具商品
            </p>
          </div>
        </div>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateDrawerVisible(true)}
            style={{
              backgroundColor: '#10b981',
              borderColor: '#10b981',
              borderRadius: '8px',
              fontWeight: '500'
            }}
          >
            添加商品
          </Button>
        </Space>
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
            persistenceKey: 'store-item-list-table',
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
        title="添加商店商品"
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
            <Input placeholder="请输入商品名称" />
          </Form.Item>
          <Form.Item
            name="description"
            label="商品描述"
            rules={[{ required: true, message: '请输入商品描述' }]}
          >
            <AntTextArea rows={4} placeholder="请输入商品描述" />
          </Form.Item>
          <Form.Item
            name="item_type"
            label="商品类型"
            rules={[{ required: true, message: '请选择商品类型' }]}
          >
            <Select placeholder="请选择商品类型">
              {itemTypeOptions.map(option => (
                <Select.Option key={option.value} value={option.value}>
                  {option.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="price_points"
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
            name="category"
            label="商品分类"
          >
            <Input placeholder="请输入商品分类（可选）" />
          </Form.Item>
          <Form.Item
            name="icon"
            label="商品图标"
          >
            <Input placeholder="请输入商品图标（emoji，可选）" />
          </Form.Item>
          <Form.Item
            name="metadata"
            label="商品元数据"
          >
            <AntTextArea
              rows={4}
              placeholder="请输入JSON格式的元数据（可选）"
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
        </Form>
      </Drawer>

      {/* 编辑商品抽屉 */}
      <Drawer
        title="编辑商店商品"
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
            <Input placeholder="请输入商品名称" />
          </Form.Item>
          <Form.Item
            name="description"
            label="商品描述"
            rules={[{ required: true, message: '请输入商品描述' }]}
          >
            <AntTextArea rows={4} placeholder="请输入商品描述" />
          </Form.Item>
          <Form.Item
            name="item_type"
            label="商品类型"
            rules={[{ required: true, message: '请选择商品类型' }]}
          >
            <Select placeholder="请选择商品类型">
              {itemTypeOptions.map(option => (
                <Select.Option key={option.value} value={option.value}>
                  {option.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="price_points"
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
            name="category"
            label="商品分类"
          >
            <Input placeholder="请输入商品分类" />
          </Form.Item>
          <Form.Item
            name="icon"
            label="商品图标"
          >
            <Input placeholder="请输入商品图标（emoji）" />
          </Form.Item>
          <Form.Item
            name="metadata"
            label="商品元数据"
          >
            <AntTextArea
              rows={4}
              placeholder="请输入JSON格式的元数据"
            />
          </Form.Item>
          <Form.Item
            name="active"
            label="商品状态"
            valuePropName="checked"
          >
            <Switch checkedChildren="上架" unCheckedChildren="下架" />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  )
}

export default StoreItemManagement