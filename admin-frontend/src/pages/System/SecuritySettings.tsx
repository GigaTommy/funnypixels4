import React, { useState, useEffect } from 'react'
import {
  Card,
  Form,
  Input,
  Switch,
  Button,
  message,
  Select,
  InputNumber,
  Space,
  Divider,
  Row,
  Col,
  Table,
  Tag,
  Popconfirm,
  Modal
} from 'antd'
import {
  SaveOutlined,
  ReloadOutlined,
  SafetyOutlined,
  LockOutlined,
  KeyOutlined,
  UserOutlined,
  WarningOutlined,
  PlusOutlined,
  DeleteOutlined,
  EyeOutlined,
  EditOutlined
} from '@ant-design/icons'
import { systemService } from '@/services'

const { TextArea } = Input
const { Option } = Select

interface SecurityConfig {
  password_policy: {
    min_length: number
    require_uppercase: boolean
    require_lowercase: boolean
    require_numbers: boolean
    require_symbols: boolean
  }
  session_security: {
    max_login_attempts: number
    lockout_duration: number
    session_timeout: number
    require_2fa: boolean
  }
  ip_whitelist: Array<{
    id: string
    ip_address: string
    description: string
    created_at: string
  }>
  api_security: {
    rate_limit: number
    cors_origins: string[]
    allow_cors: boolean
  }
  security_headers: {
    x_frame_options: boolean
    x_content_type_options: boolean
    x_xss_protection: boolean
    strict_transport_security: boolean
  }
}

const SecuritySettings: React.FC = () => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [securityConfig, setSecurityConfig] = useState<SecurityConfig | null>(null)
  const [ipModalVisible, setIpModalVisible] = useState(false)
  const [editingIp, setEditingIp] = useState<any>(null)
  const [ipForm] = Form.useForm()

  // 获取安全设置
  const fetchSecuritySettings = async () => {
    try {
      setLoading(true)
      // TODO: 实现获取安全设置的API
      const mockData: SecurityConfig = {
        password_policy: {
          min_length: 8,
          require_uppercase: true,
          require_lowercase: true,
          require_numbers: true,
          require_symbols: false,
        },
        session_security: {
          max_login_attempts: 5,
          lockout_duration: 30,
          session_timeout: 7200,
          require_2fa: false,
        },
        ip_whitelist: [
          {
            id: '1',
            ip_address: '192.168.1.100',
            description: '管理员办公网络',
            created_at: '2024-01-01 10:00:00'
          }
        ],
        api_security: {
          rate_limit: 1000,
          cors_origins: ['http://localhost:3000'],
          allow_cors: true,
        },
        security_headers: {
          x_frame_options: true,
          x_content_type_options: true,
          x_xss_protection: true,
          strict_transport_security: false,
        }
      }
      setSecurityConfig(mockData)
      form.setFieldsValue(mockData)
    } catch (error) {
      console.error('Get security settings failed:', error)
      message.error('获取安全设置失败')
    } finally {
      setLoading(false)
    }
  }

  // 保存安全设置
  const handleSave = async (values: any) => {
    try {
      setLoading(true)
      // TODO: 实现保存安全设置的API
      await new Promise(resolve => setTimeout(resolve, 1000))
      setSecurityConfig(values)
      message.success('安全设置保存成功')
    } catch (error) {
      console.error('Update security settings failed:', error)
      message.error('保存安全设置失败')
    } finally {
      setLoading(false)
    }
  }

  // 重置表单
  const handleReset = () => {
    if (securityConfig) {
      form.setFieldsValue(securityConfig)
    }
  }

  // IP白名单表格列
  const ipColumns = [
    {
      title: 'IP地址',
      dataIndex: 'ip_address',
      key: 'ip_address',
      render: (text: string) => (
        <Tag color="blue" style={{ borderRadius: '12px' }}>
          {text}
        </Tag>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '添加时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => (
        <span style={{ color: '#6b7280', fontSize: '13px' }}>
          {text}
        </span>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record: any) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditIp(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个IP地址吗？"
            onConfirm={() => handleDeleteIp(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  // 编辑IP
  const handleEditIp = (record: any) => {
    setEditingIp(record)
    ipForm.setFieldsValue(record)
    setIpModalVisible(true)
  }

  // 删除IP
  const handleDeleteIp = async (id: string) => {
    try {
      // TODO: 实现删除IP的API
      await new Promise(resolve => setTimeout(resolve, 500))
      const newWhitelist = securityConfig?.ip_whitelist.filter(ip => ip.id !== id) || []
      setSecurityConfig({
        ...securityConfig!,
        ip_whitelist: newWhitelist
      })
      message.success('IP地址删除成功')
    } catch (error) {
      message.error('删除IP地址失败')
    }
  }

  // 添加/编辑IP
  const handleSaveIp = async (values: any) => {
    try {
      if (editingIp) {
        // 编辑
        const newWhitelist = securityConfig?.ip_whitelist.map(ip =>
          ip.id === editingIp.id ? { ...ip, ...values } : ip
        ) || []
        setSecurityConfig({
          ...securityConfig!,
          ip_whitelist: newWhitelist
        })
        message.success('IP地址更新成功')
      } else {
        // 添加
        const newIp = {
          id: Date.now().toString(),
          ...values,
          created_at: new Date().toLocaleString()
        }
        setSecurityConfig({
          ...securityConfig!,
          ip_whitelist: [...securityConfig!.ip_whitelist, newIp]
        })
        message.success('IP地址添加成功')
      }
      setIpModalVisible(false)
      setEditingIp(null)
      ipForm.resetFields()
    } catch (error) {
      message.error('操作失败')
    }
  }

  useEffect(() => {
    fetchSecuritySettings()
  }, [])

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
            }}>🔒</span>
          </div>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: '28px',
              fontWeight: '700',
              color: '#1f2937',
              lineHeight: '1.2'
            }}>
              安全设置
            </h1>
            <p style={{
              margin: '4px 0 0 0',
              fontSize: '14px',
              color: '#6b7280',
              lineHeight: '1.4'
            }}>
              配置系统安全策略，保护平台数据安全
            </p>
          </div>
        </div>
        <Space>
          <Button
            onClick={() => form.submit()}
            loading={loading}
            type="primary"
            icon={<SaveOutlined />}
            style={{
              backgroundColor: '#6366f1',
              borderColor: '#6366f1',
              borderRadius: '8px',
              fontWeight: '500'
            }}
          >
            保存设置
          </Button>
          <Button
            onClick={handleReset}
            icon={<ReloadOutlined />}
            style={{
              borderRadius: '8px',
              fontWeight: '500'
            }}
          >
            重置
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
        padding: '24px'
      }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          initialValues={securityConfig}
        >
          <Row gutter={24}>
            <Col span={12}>
              <Card
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <LockOutlined style={{ color: '#6366f1' }} />
                    <span>密码策略</span>
                  </div>
                }
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(8px)',
                  borderRadius: '12px',
                  border: '1px solid #e5e7eb',
                  marginBottom: '24px'
                }}
              >
                <Form.Item
                  label="最小长度"
                  name={['password_policy', 'min_length']}
                  rules={[{ required: true, message: '请设置最小密码长度' }]}
                >
                  <InputNumber
                    min={6}
                    max={32}
                    style={{ width: '100%' }}
                    placeholder="8"
                  />
                </Form.Item>

                <Form.Item
                  label="密码要求"
                  name={['password_policy', 'require_uppercase']}
                  valuePropName="checked"
                >
                  <Switch /> 必须包含大写字母
                </Form.Item>

                <Form.Item
                  name={['password_policy', 'require_lowercase']}
                  valuePropName="checked"
                >
                  <Switch /> 必须包含小写字母
                </Form.Item>

                <Form.Item
                  name={['password_policy', 'require_numbers']}
                  valuePropName="checked"
                >
                  <Switch /> 必须包含数字
                </Form.Item>

                <Form.Item
                  name={['password_policy', 'require_symbols']}
                  valuePropName="checked"
                >
                  <Switch /> 必须包含特殊字符
                </Form.Item>
              </Card>
            </Col>

            <Col span={12}>
              <Card
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <UserOutlined style={{ color: '#10b981' }} />
                    <span>会话安全</span>
                  </div>
                }
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(8px)',
                  borderRadius: '12px',
                  border: '1px solid #e5e7eb',
                  marginBottom: '24px'
                }}
              >
                <Form.Item
                  label="最大登录尝试次数"
                  name={['session_security', 'max_login_attempts']}
                  rules={[{ required: true, message: '请设置最大登录尝试次数' }]}
                >
                  <InputNumber
                    min={3}
                    max={10}
                    style={{ width: '100%' }}
                    placeholder="5"
                  />
                </Form.Item>

                <Form.Item
                  label="锁定时长（分钟）"
                  name={['session_security', 'lockout_duration']}
                  rules={[{ required: true, message: '请设置锁定时长' }]}
                >
                  <InputNumber
                    min={5}
                    max={1440}
                    style={{ width: '100%' }}
                    placeholder="30"
                  />
                </Form.Item>

                <Form.Item
                  label="会话超时（秒）"
                  name={['session_security', 'session_timeout']}
                  rules={[{ required: true, message: '请设置会话超时时间' }]}
                >
                  <InputNumber
                    min={300}
                    max={86400}
                    style={{ width: '100%' }}
                    placeholder="7200"
                  />
                </Form.Item>

                <Form.Item
                  name={['session_security', 'require_2fa']}
                  valuePropName="checked"
                  extra="开启后，用户需要设置两步验证"
                >
                  <Switch /> 启用两步验证
                </Form.Item>
              </Card>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col span={12}>
              <Card
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <SafetyOutlined style={{ color: '#f59e0b' }} />
                    <span>API安全</span>
                  </div>
                }
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(8px)',
                  borderRadius: '12px',
                  border: '1px solid #e5e7eb',
                  marginBottom: '24px'
                }}
              >
                <Form.Item
                  label="请求频率限制（每小时）"
                  name={['api_security', 'rate_limit']}
                  rules={[{ required: true, message: '请设置请求频率限制' }]}
                >
                  <InputNumber
                    min={100}
                    max={10000}
                    style={{ width: '100%' }}
                    placeholder="1000"
                  />
                </Form.Item>

                <Form.Item
                  name={['api_security', 'allow_cors']}
                  valuePropName="checked"
                >
                  <Switch /> 允许跨域请求
                </Form.Item>

                <Form.Item
                  label="允许的域名"
                  name={['api_security', 'cors_origins']}
                  extra="每行一个域名，例如：http://localhost:3000"
                >
                  <TextArea
                    rows={4}
                    placeholder="http://localhost:3000&#10;https://example.com"
                  />
                </Form.Item>
              </Card>
            </Col>

            <Col span={12}>
              <Card
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <WarningOutlined style={{ color: '#ef4444' }} />
                    <span>安全响应头</span>
                  </div>
                }
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(8px)',
                  borderRadius: '12px',
                  border: '1px solid #e5e7eb',
                  marginBottom: '24px'
                }}
              >
                <Form.Item
                  name={['security_headers', 'x_frame_options']}
                  valuePropName="checked"
                  extra="防止点击劫持攻击"
                >
                  <Switch /> X-Frame-Options
                </Form.Item>

                <Form.Item
                  name={['security_headers', 'x_content_type_options']}
                  valuePropName="checked"
                  extra="防止MIME类型混淆攻击"
                >
                  <Switch /> X-Content-Type-Options
                </Form.Item>

                <Form.Item
                  name={['security_headers', 'x_xss_protection']}
                  valuePropName="checked"
                  extra="启用XSS保护"
                >
                  <Switch /> X-XSS-Protection
                </Form.Item>

                <Form.Item
                  name={['security_headers', 'strict_transport_security']}
                  valuePropName="checked"
                  extra="强制使用HTTPS"
                >
                  <Switch /> Strict-Transport-Security
                </Form.Item>
              </Card>
            </Col>
          </Row>

          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <KeyOutlined style={{ color: '#6366f1' }} />
                  <span>IP白名单</span>
                </div>
                <Button
                  type="primary"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => setIpModalVisible(true)}
                  style={{
                    backgroundColor: '#6366f1',
                    borderColor: '#6366f1',
                    borderRadius: '6px'
                  }}
                >
                  添加IP
                </Button>
              </div>
            }
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              backdropFilter: 'blur(8px)',
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              marginBottom: '24px'
            }}
          >
            <Table
              columns={ipColumns}
              dataSource={securityConfig?.ip_whitelist || []}
              rowKey="id"
              pagination={false}
              size="middle"
              locale={{
                emptyText: '暂无IP白名单'
              }}
            />
          </Card>
        </Form>
      </div>

      {/* IP白名单模态框 */}
      <Modal
        title={editingIp ? '编辑IP地址' : '添加IP地址'}
        open={ipModalVisible}
        onCancel={() => {
          setIpModalVisible(false)
          setEditingIp(null)
          ipForm.resetFields()
        }}
        footer={null}
        style={{
          borderRadius: '16px'
        }}
      >
        <Form
          form={ipForm}
          layout="vertical"
          onFinish={handleSaveIp}
        >
          <Form.Item
            label="IP地址"
            name="ip_address"
            rules={[
              { required: true, message: '请输入IP地址' },
              { pattern: /^(\d{1,3}\.){3}\d{1,3}$/, message: '请输入有效的IP地址' }
            ]}
          >
            <Input placeholder="192.168.1.1" />
          </Form.Item>

          <Form.Item
            label="描述"
            name="description"
            rules={[{ required: true, message: '请输入描述' }]}
          >
            <Input placeholder="管理员办公网络" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button
                onClick={() => {
                  setIpModalVisible(false)
                  setEditingIp(null)
                  ipForm.resetFields()
                }}
              >
                取消
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                style={{
                  backgroundColor: '#6366f1',
                  borderColor: '#6366f1',
                  borderRadius: '6px'
                }}
              >
                {editingIp ? '更新' : '添加'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default SecuritySettings