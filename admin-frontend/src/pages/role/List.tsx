import React, { useState, useRef } from 'react'
import { Button, Space, Tag, message, Modal, Form, Input, Tree, Card, Row, Col, Statistic } from 'antd'
import { ProColumns, ActionType } from '@ant-design/pro-components'
import { PlusOutlined, EditOutlined, DeleteOutlined, SafetyOutlined, TeamOutlined, CrownOutlined, KeyOutlined } from '@ant-design/icons'
import { roleService } from '@/services'
import SafeProTable from '@/components/SafeProTable'
import type { Role, Permission, CreateRoleRequest, UpdateRoleRequest } from '@/types'

const RoleList: React.FC = () => {
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [permissionModalVisible, setPermissionModalVisible] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(false)
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])
  const [roleStats, setRoleStats] = useState({
    total: 0,
    active: 0,
    withPermissions: 0,
    avgPermissions: 0
  })
  const actionRef = useRef<ActionType>()
  const [form] = Form.useForm()

  // 加载权限数据
  const loadPermissions = async () => {
    try {
      const data = await roleService.getPermissionsTree()
      setPermissions(data)
    } catch (error) {
      console.error('Load permissions failed:', error)
    }
  }

  // 将扁平权限列表转换为树形结构
  const buildPermissionTree = (permissions: Permission[]): Permission[] => {
    const map = new Map<number, Permission>()
    const roots: Permission[] = []

    // 创建映射
    permissions.forEach(permission => {
      map.set(permission.id, { ...permission, children: [] })
    })

    // 构建树形结构
    permissions.forEach(permission => {
      const node = map.get(permission.id)!
      if (permission.parentId && map.has(permission.parentId)) {
        map.get(permission.parentId)!.children!.push(node)
      } else {
        roots.push(node)
      }
    })

    return roots
  }

  // 表格列定义
  const columns: ProColumns<Role>[] = [
    {
      title: '角色信息',
      key: 'roleInfo',
      width: 200,
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            backgroundColor: '#1677ff',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '16px'
          }}>
            <CrownOutlined />
          </div>
          <div>
            <div style={{
              fontWeight: '600',
              color: '#1f2937',
              fontSize: '14px',
              marginBottom: '2px'
            }}>
              {record.name}
            </div>
            <div style={{
              color: '#6b7280',
              fontSize: '12px'
            }}>
              ID: {record.id}
            </div>
          </div>
        </div>
      )
    },
    {
      title: '描述',
      dataIndex: 'description',
      width: 250,
      ellipsis: true,
      search: false,
      render: (description) => (
        <div style={{
          color: '#6b7280',
          fontSize: '13px',
          lineHeight: '1.4'
        }}>
          {description}
        </div>
      )
    },
    {
      title: '权限数量',
      key: 'permissionCount',
      width: 120,
      search: false,
      render: (_, record) => {
        const count = record.permissions?.length || 0
        return (
          <Tag
            color="#1677ff"
            style={{
              borderRadius: '12px',
              fontWeight: '500',
              padding: '4px 12px'
            }}
          >
            <KeyOutlined style={{ marginRight: '4px' }} />
            {count} 个权限
          </Tag>
        )
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 180,
      valueType: 'dateTime',
      search: false,
      render: (date) => (
        <span style={{
          color: '#6b7280',
          fontSize: '13px'
        }}>
          {date}
        </span>
      )
    },
    {
      title: '操作',
      valueType: 'option',
      width: 200,
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
            icon={<SafetyOutlined />}
            onClick={() => handleEditPermissions(record)}
            style={{
              color: '#10b981',
              fontSize: '12px'
            }}
          >
            权限
          </Button>
          <Button
            type="text"
            size="small"
            danger
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

  // 处理创建角色
  const handleCreate = async (values: CreateRoleRequest) => {
    setLoading(true)
    try {
      await roleService.createRole(values)
      message.success('角色创建成功')
      setCreateModalVisible(false)
      form.resetFields()
      actionRef.current?.reload()
    } catch (error) {
      console.error('Create role failed:', error)
    } finally {
      setLoading(false)
    }
  }

  // 更新统计数据
  const updateRoleStats = (roles: Role[]) => {
    const total = roles.length
    const active = roles.filter(role => role.permissions && role.permissions.length > 0).length
    const withPermissions = active
    const totalPermissions = roles.reduce((sum, role) => sum + (role.permissions?.length || 0), 0)
    const avgPermissions = total > 0 ? Math.round(totalPermissions / total) : 0

    setRoleStats({
      total,
      active,
      withPermissions,
      avgPermissions
    })
  }

  // 处理编辑角色
  const handleEdit = (role: Role) => {
    setEditingRole(role)
    form.setFieldsValue({
      name: role.name,
      description: role.description,
    })
    setEditModalVisible(true)
  }

  // 处理更新角色
  const handleUpdate = async (values: UpdateRoleRequest) => {
    if (!editingRole) return

    setLoading(true)
    try {
      await roleService.updateRole(editingRole.id, values)
      message.success('角色更新成功')
      setEditModalVisible(false)
      setEditingRole(null)
      form.resetFields()
      actionRef.current?.reload()
    } catch (error) {
      console.error('Update role failed:', error)
    } finally {
      setLoading(false)
    }
  }

  // 处理删除角色
  const handleDelete = (role: Role) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除角色 "${role.name}" 吗？此操作不可恢复。`,
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await roleService.deleteRole(role.id)
          message.success('角色删除成功')
          actionRef.current?.reload()
        } catch (error) {
          console.error('Delete role failed:', error)
        }
      },
    })
  }

  // 处理编辑权限
  const handleEditPermissions = async (role: Role) => {
    setEditingRole(role)
    setSelectedPermissions(role.permissions || [])

    // 加载权限数据
    await loadPermissions()

    setPermissionModalVisible(true)
  }

  // 处理保存权限
  const handleSavePermissions = async () => {
    if (!editingRole) return

    setLoading(true)
    try {
      await roleService.updateRole(editingRole.id, {
        permissions: selectedPermissions,
      })
      message.success('权限更新成功')
      setPermissionModalVisible(false)
      setEditingRole(null)
      setSelectedPermissions([])
      actionRef.current?.reload()
    } catch (error) {
      console.error('Update permissions failed:', error)
    } finally {
      setLoading(false)
    }
  }

  // 将权限转换为 Tree 组件需要的数据格式
  const convertPermissionsToTreeData = (permissions: Permission[]) => {
    return permissions.map(permission => ({
      title: permission.description,
      key: permission.code,
      children: permission.children?.map(child => ({
        title: child.description,
        key: child.code,
      })),
    }))
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
            }}>👑</span>
          </div>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: '28px',
              fontWeight: '700',
              color: '#1f2937',
              lineHeight: '1.2'
            }}>
              角色权限管理
            </h1>
            <p style={{
              margin: '4px 0 0 0',
              fontSize: '14px',
              color: '#6b7280',
              lineHeight: '1.4'
            }}>
              管理系统角色权限，分配访问控制
            </p>
          </div>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateModalVisible(true)}
          style={{
            borderRadius: '6px',
            fontWeight: '500'
          }}
        >
          新增角色
        </Button>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card style={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(8px)',
            borderRadius: '16px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <Statistic
              title="总角色数"
              value={roleStats.total}
              prefix={<TeamOutlined style={{ color: '#1677ff' }} />}
              valueStyle={{ color: '#1677ff' }}
            />
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>系统角色总量</p>
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
              title="活跃角色"
              value={roleStats.active}
              prefix={<CrownOutlined style={{ color: '#10b981' }} />}
              valueStyle={{ color: '#10b981' }}
            />
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>拥有权限的角色</p>
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
              title="配置权限"
              value={roleStats.withPermissions}
              prefix={<SafetyOutlined style={{ color: '#0958d9' }} />}
              valueStyle={{ color: '#0958d9' }}
            />
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>已配置权限的角色</p>
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(8px)',
            borderRadius: '16px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <Statistic
              title="平均权限数"
              value={roleStats.avgPermissions}
              prefix={<KeyOutlined style={{ color: '#f59e0b' }} />}
              valueStyle={{ color: '#f59e0b' }}
            />
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>每个角色平均权限数</p>
          </Card>
        </Col>
      </Row>

      {/* 主要内容区域 */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        border: '1px solid #f0f0f0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        padding: '24px'
      }}>
        <SafeProTable
          columns={columns}
          actionRef={actionRef}
          rowKey="id"
          search={false}
          request={async (params) => {
            try {
              const response = await roleService.getRoles(params)
              // 更新统计数据
              updateRoleStats(response.list)
              return {
                data: response.list,
                success: true,
                total: response.total,
              }
            } catch (error) {
              console.error('Get roles failed:', error)
              return {
                data: [],
                success: false,
                total: 0,
              }
            }
          }}
          pagination={{
            defaultPageSize: 10,
            showSizeChanger: true,
          }}
          dateFormatter="string"
          headerTitle="角色列表"
        />
      </div>

      {/* 创建角色模态框 */}
      <Modal
        title="新增角色"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false)
          form.resetFields()
        }}
        footer={[
          <Button key="cancel" onClick={() => setCreateModalVisible(false)}>
            取消
          </Button>,
          <Button key="submit" type="primary" onClick={() => form.submit()} loading={loading}>
            确定
          </Button>,
        ]}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
        >
          <Form.Item
            name="name"
            label="角色名称"
            rules={[
              { required: true, message: '请输入角色名称' },
              { max: 50, message: '角色名称最多50个字符' },
            ]}
          >
            <Input placeholder="请输入角色名称" />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
            rules={[
              { required: true, message: '请输入描述' },
              { max: 200, message: '描述最多200个字符' },
            ]}
          >
            <Input.TextArea placeholder="请输入角色描述" rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑角色模态框 */}
      <Modal
        title="编辑角色"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false)
          setEditingRole(null)
          form.resetFields()
        }}
        footer={[
          <Button key="cancel" onClick={() => setEditModalVisible(false)}>
            取消
          </Button>,
          <Button key="submit" type="primary" onClick={() => form.submit()} loading={loading}>
            确定
          </Button>,
        ]}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleUpdate}
        >
          <Form.Item
            name="name"
            label="角色名称"
            rules={[
              { required: true, message: '请输入角色名称' },
              { max: 50, message: '角色名称最多50个字符' },
            ]}
          >
            <Input placeholder="请输入角色名称" />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
            rules={[
              { required: true, message: '请输入描述' },
              { max: 200, message: '描述最多200个字符' },
            ]}
          >
            <Input.TextArea placeholder="请输入角色描述" rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑权限模态框 */}
      <Modal
        title={`编辑角色权限 - ${editingRole?.name}`}
        open={permissionModalVisible}
        onCancel={() => {
          setPermissionModalVisible(false)
          setEditingRole(null)
          setSelectedPermissions([])
        }}
        footer={[
          <Button key="cancel" onClick={() => setPermissionModalVisible(false)}>
            取消
          </Button>,
          <Button key="submit" type="primary" onClick={handleSavePermissions} loading={loading}>
            保存
          </Button>,
        ]}
        width={600}
      >
        <Tree
          checkable
          checkedKeys={selectedPermissions}
          onCheck={(checkedKeys) => {
            setSelectedPermissions(checkedKeys as string[])
          }}
          treeData={convertPermissionsToTreeData(buildPermissionTree(permissions))}
          height={400}
          style={{ marginTop: 16 }}
        />
      </Modal>
    </div>
  )
}

export default RoleList