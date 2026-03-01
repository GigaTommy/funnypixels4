import React, { useState, useRef, useEffect } from 'react'
import { Button, Space, Tag, message, Drawer, Form, Input, Select, Switch, Modal, Row, Col, Statistic, Card, Avatar } from 'antd'
import { ProColumns, ActionType } from '@ant-design/pro-components'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  UserOutlined,
  TeamOutlined,
  CrownOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  StopOutlined,
  ReloadOutlined
} from '@ant-design/icons'
import { userService } from '@/services'
import { useNavigate } from 'react-router-dom'
import SafeProTable from '@/components/SafeProTable'
import UserAvatar from '@/components/UserAvatar'
import type { User, CreateUserRequest, UpdateUserRequest, PaginationParams, DashboardStats } from '@/types'

const UserList: React.FC = () => {
  const [createDrawerVisible, setCreateDrawerVisible] = useState(false)
  const [editDrawerVisible, setEditDrawerVisible] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(false)
  const [userStats, setUserStats] = useState<DashboardStats & { bannedUsers: number }>({
    totalUsers: 0,
    activeUsers: 0,
    todayUsers: 0,
    totalPixels: 0,
    bannedUsers: 0
  })
  const [statsLoading, setStatsLoading] = useState(false)
  const actionRef = useRef<ActionType>()
  const [createForm] = Form.useForm()
  const [editForm] = Form.useForm()
  const [banForm] = Form.useForm()
  const [banModalVisible, setBanModalVisible] = useState(false)
  const navigate = useNavigate()

  // 获取用户统计数据
  const fetchUserStats = async () => {
    setStatsLoading(true)
    try {
      const stats = await userService.getUserStats()
      setUserStats(stats)
    } catch (error) {
      console.error('获取用户统计失败:', error)
      message.error('获取用户统计失败')
    } finally {
      setStatsLoading(false)
    }
  }

  // 初始化时获取统计数据
  useEffect(() => {
    fetchUserStats()
  }, [])

  // 用户状态选项
  const statusOptions = [
    { label: '活跃', value: 'active', color: '#10b981', icon: <CheckCircleOutlined /> },
    { label: '禁用', value: 'inactive', color: '#f59e0b', icon: <StopOutlined /> },
    { label: '封禁', value: 'banned', color: '#ef4444', icon: <ExclamationCircleOutlined /> },
  ]

  // 角色选项
  const roleOptions = [
    { label: '超级管理员', value: 'super_admin', color: '#ef4444', icon: <CrownOutlined /> },
    { label: '管理员', value: 'admin', color: '#f59e0b', icon: <UserOutlined /> },
    { label: '审核员', value: 'reviewer', color: '#1677ff', icon: <TeamOutlined /> },
    { label: '普通用户', value: 'user', color: '#10b981', icon: <UserOutlined /> },
  ]

  // 表格列定义
  const columns: ProColumns<User>[] = [
    {
      title: '头像',
      dataIndex: 'avatar',
      width: 80,
      search: false,
      render: (_, record) => (
        <UserAvatar
          src={record.avatar}
          alt={`${record.nickname || record.username}头像`}
          fallback={record.nickname || record.username}
          size="large"
          style={{ backgroundColor: '#1677ff' }}
        />
      ),
    },
    {
      title: '用户信息',
      dataIndex: 'username',
      width: 200,
      render: (_, record) => (
        <div>
          <div style={{
            fontWeight: '600',
            color: '#1f2937',
            fontSize: '14px',
            marginBottom: '4px'
          }}>
            {record.username}
          </div>
          <div style={{
            color: '#6b7280',
            fontSize: '12px',
            marginBottom: '2px'
          }}>
            昵称: {record.nickname || '未设置'}
          </div>
          <div style={{
            color: '#6b7280',
            fontSize: '12px'
          }}>
            ID: <a onClick={() => navigate(`/user/detail/${record.id}`)}>{record.id}</a>
          </div>
        </div>
      ),
    },
    {
      title: '联系方式',
      dataIndex: 'phone',
      width: 200,
      render: (_, record) => (
        <div>
          <div style={{
            color: '#6b7280',
            fontSize: '12px',
            marginBottom: '2px'
          }}>
            📱 {record.phone || '未设置'}
          </div>
          <div style={{
            color: '#6b7280',
            fontSize: '12px'
          }}>
            ✉️ {record.email || '未设置'}
          </div>
        </div>
      ),
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      width: 200,
      hideInTable: true,
      fieldProps: {
        placeholder: '请输入邮箱地址'
      }
    },
    {
      title: '角色',
      dataIndex: 'role',
      width: 120,
      valueType: 'select',
      valueEnum: roleOptions.reduce((acc, role) => {
        acc[role.value] = { text: role.label }
        return acc
      }, {} as Record<string, { text: string }>),
      render: (_, record) => {
        const roleConfig = roleOptions.find(r => r.value === record.role)
        return (
          <Tag
            color={roleConfig?.color}
            style={{
              borderRadius: '12px',
              fontWeight: '500',
              padding: '4px 12px'
            }}
          >
            {roleConfig?.icon} {roleConfig?.label}
          </Tag>
        )
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: statusOptions.reduce((acc, status) => {
        acc[status.value] = { text: status.label, status: status.color }
        return acc
      }, {} as Record<string, { text: string; status: string }>),
      render: (_, record) => {
        const statusConfig = statusOptions.find(s => s.value === record.status)
        return (
          <Tag
            color={statusConfig?.color}
            style={{
              borderRadius: '12px',
              fontWeight: '500',
              padding: '4px 12px'
            }}
          >
            {statusConfig?.icon} {statusConfig?.label}
          </Tag>
        )
      },
    },
    {
      title: '注册时间',
      dataIndex: 'createdAt',
      width: 180,
      valueType: 'dateTime',
      search: false,
      render: (text) => (
        <span style={{ color: '#6b7280', fontSize: '13px' }}>
          {text}
        </span>
      ),
    },
    {
      title: '操作',
      valueType: 'option',
      width: 200,
      render: (_, record) => [
        <Button
          key="edit"
          type="link"
          size="small"
          icon={<EditOutlined />}
          onClick={() => handleEdit(record)}
          style={{ color: '#1677ff' }}
        >
          编辑
        </Button>,
        <Button
          key="detail"
          type="link"
          size="small"
          onClick={() => navigate(`/user/detail/${record.id}`)}
        >
          详情
        </Button>,
        <Button
          key="ban"
          type="link"
          size="small"
          danger={!record.is_banned}
          icon={record.is_banned ? <CheckCircleOutlined /> : <StopOutlined />}
          onClick={() => {
            if (record.is_banned) {
              handleBan(record.id, { banType: 'none', banReason: '管理员手动解封', banDuration: '0' });
            } else {
              setEditingUser(record);
              banForm.setFieldsValue({ banType: 'login', banDuration: 'permanent' });
              setBanModalVisible(true);
            }
          }}
        >
          {record.is_banned ? '解封' : '封禁'}
        </Button>,
        <Button
          key="delete"
          type="link"
          size="small"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleDelete(record)}
        >
          删除
        </Button>,
      ],
    },
  ]

  // 处理创建用户
  const handleCreate = async (values: CreateUserRequest) => {
    setLoading(true)
    try {
      await userService.createUser(values)
      message.success('用户创建成功')
      setCreateDrawerVisible(false)
      createForm.resetFields()
      actionRef.current?.reload()
      // 重新获取统计数据
      fetchUserStats()
    } catch (error) {
      console.error('Create user failed:', error)
    } finally {
      setLoading(false)
    }
  }

  // 处理编辑用户
  const handleEdit = (user: User) => {
    setEditingUser(user)
    editForm.setFieldsValue({
      nickname: user.nickname,
      phone: user.phone,
      email: user.email,
      role: user.role,
      status: user.status,
    })
    setEditDrawerVisible(true)
  }

  // 处理更新用户
  const handleUpdate = async (values: UpdateUserRequest) => {
    if (!editingUser) return

    setLoading(true)
    try {
      await userService.updateUser(editingUser.id.toString(), values)
      message.success('用户更新成功')
      setEditDrawerVisible(false)
      setEditingUser(null)
      editForm.resetFields()
      actionRef.current?.reload()
    } catch (error) {
      console.error('Update user failed:', error)
    } finally {
      setLoading(false)
    }
  }

  // 处理删除用户
  const handleDelete = (user: User) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除用户 "${user.nickname || user.username}" 吗？此操作不可恢复。`,
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await userService.deleteUser(user.id.toString())
          message.success('用户删除成功')
          actionRef.current?.reload()
          // 重新获取统计数据
          fetchUserStats()
        } catch (error) {
          console.error('Delete user failed:', error)
        }
      },
    })
  }

  // 处理精细化封禁
  const handleBan = async (userId: string, values: any) => {
    try {
      await userService.banUser(userId, {
        banType: values.banType,
        banReason: values.banReason,
        banDuration: values.banDuration,
      });
      message.success(values.banType === 'none' ? '解封成功' : '封禁成功');
      setBanModalVisible(false);
      actionRef.current?.reload();
      fetchUserStats();
    } catch (error) {
      console.error('Ban user failed:', error);
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
            }}>👥</span>
          </div>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: '28px',
              fontWeight: '700',
              color: '#1f2937',
              lineHeight: '1.2'
            }}>
              用户管理
            </h1>
            <p style={{
              margin: '4px 0 0 0',
              fontSize: '14px',
              color: '#6b7280',
              lineHeight: '1.4'
            }}>
              管理平台用户信息，维护用户数据安全
            </p>
          </div>
        </div>
        <div style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center'
        }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateDrawerVisible(true)}
            style={{
              borderRadius: '6px',
              fontWeight: '500'
            }}
          >
            新增用户
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchUserStats}
            loading={statsLoading}
            style={{
              borderRadius: '8px',
              fontWeight: '500'
            }}
          >
            刷新统计
          </Button>
        </div>
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
              title="总用户数"
              value={userStats.totalUsers}
              prefix={<UserOutlined style={{ color: '#1677ff' }} />}
              valueStyle={{ color: '#1677ff' }}
              loading={statsLoading}
            />
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>平台注册用户总量</p>
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
              title="活跃用户"
              value={userStats.activeUsers}
              prefix={<CheckCircleOutlined style={{ color: '#10b981' }} />}
              valueStyle={{ color: '#10b981' }}
              loading={statsLoading}
            />
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>当前活跃状态用户</p>
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
              title="今日新增"
              value={userStats.todayUsers}
              prefix={<UserOutlined style={{ color: '#f59e0b' }} />}
              valueStyle={{ color: '#f59e0b' }}
              loading={statsLoading}
            />
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>今日注册用户</p>
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
              title="封禁用户"
              value={userStats.bannedUsers}
              prefix={<ExclamationCircleOutlined style={{ color: '#ef4444' }} />}
              valueStyle={{ color: '#ef4444' }}
              loading={statsLoading}
            />
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>被封禁的用户数量</p>
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
          search={{
            labelWidth: 120,
          }}
          request={async (params) => {
            try {
              const { current, pageSize, nickname, phone, status, role, email } = params as PaginationParams & {
                nickname?: string
                phone?: string
                status?: string
                role?: string
                email?: string
              }

              // 检查是否是用户ID搜索
              const userId = nickname && /^\d+$/.test(nickname) ? nickname : undefined

              const response = await userService.getUsers({
                current,
                pageSize,
                nickname: userId ? undefined : nickname, // 如果是纯数字，作为ID搜索
                user_id: userId,
                phone,
                email,
                status,
                role,
              })

              return {
                data: response.list,
                success: true,
                total: response.total,
              }
            } catch (error) {
              console.error('Get users failed:', error)
              return {
                data: [],
                success: false,
                total: 0,
              }
            }
          }}
          columnsState={{
            persistenceKey: 'user-list-table',
            persistenceType: 'localStorage',
          }}
          pagination={{
            defaultPageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
          dateFormatter="string"
          headerTitle="用户列表"
          toolBarRender={() => [
            <Button
              key="refresh"
              icon={<ReloadOutlined />}
              onClick={() => {
                actionRef.current?.reload()
                fetchUserStats()
              }}
              style={{
                borderRadius: '8px',
                fontWeight: '500'
              }}
            >
              刷新
            </Button>
          ]}
        />
      </div>

      {/* 创建用户抽屉 */}
      <Drawer
        title="新增用户"
        width={600}
        open={createDrawerVisible}
        onClose={() => {
          setCreateDrawerVisible(false)
          createForm.resetFields()
        }}
        style={{
          borderRadius: '16px 0 0 16px'
        }}
        footer={
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setCreateDrawerVisible(false)}>取消</Button>
              <Button
                type="primary"
                onClick={() => createForm.submit()}
                loading={loading}
                style={{
                  borderRadius: '6px',
                  fontWeight: '500'
                }}
              >
                确定
              </Button>
            </Space>
          </div>
        }
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreate}
          initialValues={{ status: 'active', role: 'user' }}
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, message: '用户名至少3个字符' },
              { max: 20, message: '用户名最多20个字符' },
              { pattern: /^[a-zA-Z0-9_]+$/, message: '用户名只能包含字母、数字和下划线' },
            ]}
          >
            <Input placeholder="请输入用户名" />
          </Form.Item>

          <Form.Item
            name="password"
            label="密码"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, message: '密码至少6个字符' },
            ]}
          >
            <Input.Password placeholder="请输入密码" />
          </Form.Item>

          <Form.Item
            name="nickname"
            label="昵称"
            rules={[
              { required: true, message: '请输入昵称' },
              { max: 50, message: '昵称最多50个字符' },
            ]}
          >
            <Input placeholder="请输入昵称" />
          </Form.Item>

          <Form.Item
            name="phone"
            label="手机号"
            rules={[
              { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号' },
            ]}
          >
            <Input placeholder="请输入手机号" />
          </Form.Item>

          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { type: 'email', message: '请输入正确的邮箱地址' },
            ]}
          >
            <Input placeholder="请输入邮箱" />
          </Form.Item>

          <Form.Item
            name="role"
            label="角色"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select placeholder="请选择角色">
              {roleOptions.map(role => (
                <Select.Option key={role.value} value={role.value}>
                  {role.icon} {role.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Drawer>

      {/* 编辑用户抽屉 */}
      <Drawer
        title="编辑用户"
        width={600}
        open={editDrawerVisible}
        onClose={() => {
          setEditDrawerVisible(false)
          setEditingUser(null)
          editForm.resetFields()
        }}
        style={{
          borderRadius: '16px 0 0 16px'
        }}
        footer={
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setEditDrawerVisible(false)}>取消</Button>
              <Button
                type="primary"
                onClick={() => editForm.submit()}
                loading={loading}
                style={{
                  borderRadius: '6px',
                  fontWeight: '500'
                }}
              >
                确定
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
            name="nickname"
            label="昵称"
            rules={[
              { required: true, message: '请输入昵称' },
              { max: 50, message: '昵称最多50个字符' },
            ]}
          >
            <Input placeholder="请输入昵称" />
          </Form.Item>

          <Form.Item
            name="phone"
            label="手机号"
            rules={[
              { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号' },
            ]}
          >
            <Input placeholder="请输入手机号" />
          </Form.Item>

          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { type: 'email', message: '请输入正确的邮箱地址' },
            ]}
          >
            <Input placeholder="请输入邮箱" />
          </Form.Item>

          <Form.Item
            name="role"
            label="角色"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select placeholder="请选择角色">
              {roleOptions.map(role => (
                <Select.Option key={role.value} value={role.value}>
                  {role.icon} {role.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="status"
            label="状态"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select placeholder="请选择状态">
              {statusOptions.map(status => (
                <Select.Option key={status.value} value={status.value}>
                  {status.icon} {status.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Drawer>

      <Modal
        title="用户封禁设置"
        open={banModalVisible}
        onCancel={() => setBanModalVisible(false)}
        onOk={() => banForm.submit()}
      >
        <Form form={banForm} layout="vertical" onFinish={(values) => handleBan(editingUser?.id!, values)}>
          <Form.Item name="banType" label="封禁类型" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="login">禁止登录 (全功能封锁)</Select.Option>
              <Select.Option value="draw">禁止绘图 (只读模式)</Select.Option>
              <Select.Option value="chat">内禁言 (社交屏蔽)</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="banDuration" label="封禁时长" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="1440">1 天</Select.Option>
              <Select.Option value="4320">3 天</Select.Option>
              <Select.Option value="10080">7 天</Select.Option>
              <Select.Option value="43200">30 天</Select.Option>
              <Select.Option value="permanent">永久</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="banReason" label="封禁原因" rules={[{ required: true, message: '请填写封禁理由以便备查' }]}>
            <Input.TextArea rows={4} placeholder="例如：发表恶意政治言论 / 批量脚本刷币" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default UserList