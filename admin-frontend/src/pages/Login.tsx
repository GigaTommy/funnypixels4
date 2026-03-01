import React, { useState } from 'react'
import { Form, Input, Button, Card, message } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useAuth } from '@/contexts/AuthContext'
import type { LoginForm } from '@/types'
import './Login.css'

const Login: React.FC = () => {
  const { login, loading } = useAuth()
  const [form] = Form.useForm()
  const [loginLoading, setLoginLoading] = useState(false)

  const handleSubmit = async (values: LoginForm) => {
    setLoginLoading(true)
    try {
      const success = await login(values)
      if (!success) {
        // 登录失败，清空密码字段
        form.setFieldsValue({ password: '' })
      }
    } finally {
      setLoginLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-content">
        <Card className="login-form">
          <div className="login-logo">
            <UserOutlined style={{ fontSize: '64px', color: '#1890ff' }} />
          </div>
          <h1 className="login-title">Funnypixels 管理控制台</h1>

          <Form
            form={form}
            name="login"
            onFinish={handleSubmit}
            autoComplete="off"
            size="large"
          >
            <Form.Item
              name="username"
              rules={[
                { required: true, message: '请输入用户名' },
                { min: 3, message: '用户名至少3个字符' },
              ]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="用户名"
                autoComplete="username"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 6, message: '密码至少6个字符' },
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="密码"
                autoComplete="current-password"
                onPressEnter={() => form.submit()}
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loginLoading}
                block
                style={{ height: '40px' }}
              >
                {loginLoading ? '登录中...' : '登录'}
              </Button>
            </Form.Item>
          </Form>

          <div style={{ textAlign: 'center', color: '#666', fontSize: '12px', marginTop: '20px' }}>
            <p>请使用管理员账号登录</p>
          </div>
        </Card>
      </div>
    </div>
  )
}

export default Login