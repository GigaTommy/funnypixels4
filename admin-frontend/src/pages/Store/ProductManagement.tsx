import React, { useState, useRef } from 'react'
import { Button, Space, Tag, message, Drawer, Form, Input, Select, Modal, Switch, InputNumber, Image } from 'antd'
import { ProColumns, ActionType } from '@ant-design/pro-components'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  ShopOutlined
} from '@ant-design/icons'
import { storeService } from '@/services'
import SafeProTable from '@/components/SafeProTable'
import type {
  Product,
  CreateProductRequest,
  UpdateProductRequest,
  PaginationParams
} from '@/types'

const { TextArea } = Input

const ProductManagement: React.FC = () => {
  const [createDrawerVisible, setCreateDrawerVisible] = useState(false)
  const [editDrawerVisible, setEditDrawerVisible] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(false)
  const actionRef = useRef<ActionType>()
  const [form] = Form.useForm()
  const [editForm] = Form.useForm()

  // 分类选项
  const categoryOptions = [
    { label: '消耗品', value: 'consumable' },
    { label: '装饰品', value: 'decoration' },
    { label: '特殊道具', value: 'special' },
    { label: 'VIP会员', value: 'vip' },
  ]

  // 表格列定义
  const columns: ProColumns<Product>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
      search: false,
    },
    {
      title: '商品名称',
      dataIndex: 'name',
      width: 200,
      ellipsis: true,
      copyable: true,
    },
    {
      title: '商品图片',
      dataIndex: 'image_url',
      width: 120,
      search: false,
      render: (_, record) => (
        record.image_url ? (
          <Image
            src={record.image_url}
            alt={record.name}
            width={60}
            height={40}
            style={{ objectFit: 'cover', borderRadius: '4px' }}
            placeholder="暂无图片"
          />
        ) : (
          <div style={{
            width: 60,
            height: 40,
            backgroundColor: '#f3f4f6',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#9ca3af',
            fontSize: '12px'
          }}>
            暂无图片
          </div>
        )
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      width: 120,
      valueType: 'select',
      valueEnum: {
        consumable: { text: '消耗品', status: 'Default' },
        decoration: { text: '装饰品', status: 'Processing' },
        special: { text: '特殊道具', status: 'Success' },
        vip: { text: 'VIP会员', status: 'Warning' },
      },
      render: (_, record) => {
        const categoryOption = categoryOptions.find(opt => opt.value === record.category)
        return (
          <Tag color={categoryOption?.value === 'vip' ? 'gold' : 'blue'}>
            {categoryOption?.label}
          </Tag>
        )
      },
    },
    {
      title: '价格',
      dataIndex: 'price',
      width: 100,
      search: false,
      render: (text) => (
        <span style={{ color: '#10b981', fontWeight: '600' }}>
          ¥{text}
        </span>
      ),
    },
    {
      title: '库存',
      dataIndex: 'stock',
      width: 100,
      search: false,
      render: (text) => {
        const stockValue = typeof text === 'number' ? text : parseInt(text as string) || 0;
        return (
          <span style={{
            color: stockValue < 10 ? '#ef4444' : stockValue < 50 ? '#f59e0b' : '#10b981',
            fontWeight: '500'
          }}>
            {text}
          </span>
        )
      },
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
          onChange={(checked) => handleStatusUpdate(record.id, checked as boolean)}
          size="small"
        />
      ),
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
    name?: string
    category?: string
    active?: boolean
  }) => {
    try {
      setLoading(true)
      const response = await storeService.product.getList(params)
      return {
        data: response.list,
        success: true,
        total: response.total,
      }
    } catch (error) {
      console.error('Get products failed:', error)
      message.error('获取商品列表失败')
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
      await storeService.product.update(id, { active })
      message.success(active ? '商品已上架' : '商品已下架')
      actionRef.current?.reload()
    } catch (error) {
      console.error('Update product status failed:', error)
      message.error('状态更新失败')
    }
  }

  // 编辑
  const handleEdit = (record: Product) => {
    setEditingProduct(record)
    editForm.setFieldsValue({
      name: record.name,
      description: record.description,
      price: record.price,
      category: record.category,
      image_url: record.image_url,
      stock: record.stock,
      active: record.active,
    })
    setEditDrawerVisible(true)
  }

  // 删除
  const handleDelete = (record: Product) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除商品 "${record.name}" 吗？此操作不可恢复。`,
      okText: '确认删除',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await storeService.product.delete(record.id)
          message.success('删除成功')
          actionRef.current?.reload()
        } catch (error) {
          console.error('Delete product failed:', error)
          message.error('删除失败')
        }
      },
    })
  }

  // 创建新商品
  const handleCreate = async (values: CreateProductRequest) => {
    try {
      await storeService.product.create(values)
      message.success('创建成功')
      setCreateDrawerVisible(false)
      form.resetFields()
      actionRef.current?.reload()
    } catch (error) {
      console.error('Create product failed:', error)
      message.error('创建失败')
    }
  }

  // 更新商品
  const handleUpdate = async (values: UpdateProductRequest) => {
    if (!editingProduct) return

    try {
      await storeService.product.update(editingProduct.id, values)
      message.success('更新成功')
      setEditDrawerVisible(false)
      setEditingProduct(null)
      editForm.resetFields()
      actionRef.current?.reload()
    } catch (error) {
      console.error('Update product failed:', error)
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
              旗帜商品管理
            </h1>
            <p style={{
              margin: '4px 0 0 0',
              fontSize: '14px',
              color: '#6b7280',
              lineHeight: '1.4'
            }}>
              管理联盟旗帜SKU商品，包括颜色旗帜、emoji旗帜、自定义旗帜等
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
            添加商品
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
            persistenceKey: 'product-list-table',
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
        title="添加商品"
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
        footer={
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => { setCreateDrawerVisible(false); form.resetFields() }}>取消</Button>
              <Button type="primary" onClick={() => form.submit()} style={{ borderRadius: '6px', fontWeight: '500' }}>
                确定创建
              </Button>
            </Space>
          </div>
        }
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
            <TextArea rows={4} placeholder="请输入商品描述" />
          </Form.Item>
          <Form.Item
            name="category"
            label="商品分类"
            rules={[{ required: true, message: '请选择商品分类' }]}
          >
            <Select placeholder="请选择商品分类">
              {categoryOptions.map(option => (
                <Select.Option key={option.value} value={option.value}>
                  {option.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="price"
            label="商品价格"
            rules={[{ required: true, message: '请输入商品价格' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="请输入商品价格"
              min={0}
              precision={2}
            />
          </Form.Item>
          <Form.Item
            name="stock"
            label="库存数量"
            rules={[{ required: true, message: '请输入库存数量' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="请输入库存数量"
              min={0}
            />
          </Form.Item>
          <Form.Item
            name="image_url"
            label="商品图片"
          >
            <Input placeholder="请输入商品图片URL" />
          </Form.Item>
        </Form>
      </Drawer>

      {/* 编辑商品抽屉 */}
      <Drawer
        title="编辑商品"
        width={600}
        open={editDrawerVisible}
        onClose={() => {
          setEditDrawerVisible(false)
          setEditingProduct(null)
          editForm.resetFields()
        }}
        styles={{
          body: { padding: '24px' },
          header: { borderBottom: '1px solid #e5e7eb' }
        }}
        footer={
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => { setEditDrawerVisible(false); setEditingProduct(null); editForm.resetFields() }}>取消</Button>
              <Button type="primary" onClick={() => editForm.submit()} style={{ borderRadius: '6px', fontWeight: '500' }}>
                保存修改
              </Button>
            </Space>
          </div>
        }
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
            <TextArea rows={4} placeholder="请输入商品描述" />
          </Form.Item>
          <Form.Item
            name="category"
            label="商品分类"
            rules={[{ required: true, message: '请选择商品分类' }]}
          >
            <Select placeholder="请选择商品分类">
              {categoryOptions.map(option => (
                <Select.Option key={option.value} value={option.value}>
                  {option.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="price"
            label="商品价格"
            rules={[{ required: true, message: '请输入商品价格' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="请输入商品价格"
              min={0}
              precision={2}
            />
          </Form.Item>
          <Form.Item
            name="stock"
            label="库存数量"
            rules={[{ required: true, message: '请输入库存数量' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="请输入库存数量"
              min={0}
            />
          </Form.Item>
          <Form.Item
            name="image_url"
            label="商品图片"
          >
            <Input placeholder="请输入商品图片URL" />
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

export default ProductManagement