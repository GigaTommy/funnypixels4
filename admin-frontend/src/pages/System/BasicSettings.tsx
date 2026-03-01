import React, { useState, useEffect } from 'react'
import {
  Card,
  Form,
  Input,
  Switch,
  Button,
  message,
  Upload,
  Select,
  InputNumber,
  Space,
  Divider,
  Row,
  Col
} from 'antd'
import { UploadOutlined, SaveOutlined, ReloadOutlined } from '@ant-design/icons'
import type { UploadProps, UploadFile } from 'antd'
import { systemService } from '@/services'
import type { SystemSettings } from '@/types'

const { TextArea } = Input
const { Option } = Select

const BasicSettings: React.FC = () => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState<SystemSettings | null>(null)
  const [logoFileList, setLogoFileList] = useState<UploadFile[]>([])

  // 获取系统设置
  const fetchSettings = async () => {
    try {
      setLoading(true)
      const data = await systemService.settings.getSettings()
      setSettings(data)
      form.setFieldsValue(data)

      // 设置logo文件列表
      if (data.site_logo) {
        setLogoFileList([{
          uid: '-1',
          name: 'logo.png',
          status: 'done',
          url: data.site_logo,
        }])
      }
    } catch (error) {
      console.error('Get system settings failed:', error)
      message.error('获取系统设置失败')
    } finally {
      setLoading(false)
    }
  }

  // 保存系统设置
  const handleSave = async (values: any) => {
    try {
      setLoading(true)
      const updateData = {
        ...values,
        site_logo: logoFileList[0]?.url || settings?.site_logo,
      }
      await systemService.settings.updateSettings(updateData)
      setSettings({ ...settings, ...updateData })
      message.success('保存成功')
    } catch (error) {
      console.error('Update system settings failed:', error)
      message.error('保存失败')
    } finally {
      setLoading(false)
    }
  }

  // 重置表单
  const handleReset = () => {
    if (settings) {
      form.setFieldsValue(settings)
      if (settings.site_logo) {
        setLogoFileList([{
          uid: '-1',
          name: 'logo.png',
          status: 'done',
          url: settings.site_logo,
        }])
      } else {
        setLogoFileList([])
      }
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  // 上传配置
  const uploadProps: UploadProps = {
    name: 'file',
    action: '/api/v1/admin/upload/logo',
    listType: 'picture-card',
    fileList: logoFileList,
    maxCount: 1,
    onChange: (info) => {
      setLogoFileList(info.fileList)
      if (info.file.status === 'done') {
        message.success('Logo上传成功')
      }
    },
    onRemove: () => {
      setLogoFileList([])
      return true
    },
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
            }}>⚙️</span>
          </div>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: '28px',
              fontWeight: '700',
              color: '#1f2937',
              lineHeight: '1.2'
            }}>
              基础配置
            </h1>
            <p style={{
              margin: '4px 0 0 0',
              fontSize: '14px',
              color: '#6b7280',
              lineHeight: '1.4'
            }}>
              管理系统基础配置和全局设置
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
            保存配置
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
          initialValues={{
            site_name: 'FunnyPixels 管理后台',
            site_description: '专业的像素艺术创作与管理平台',
            maintenance_mode: false,
            allow_registration: true,
            email_verification_required: false,
            max_upload_size: 5,
            supported_image_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
            default_user_role: 'user',
            session_timeout: 7200,
          }}
        >
          <Row gutter={24}>
            <Col span={12}>
              <Card
                title="网站基础信息"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(8px)',
                  borderRadius: '12px',
                  border: '1px solid #e5e7eb',
                  marginBottom: '24px'
                }}
              >
                <Form.Item
                  label="网站名称"
                  name="site_name"
                  rules={[{ required: true, message: '请输入网站名称' }]}
                >
                  <Input placeholder="请输入网站名称" />
                </Form.Item>

                <Form.Item
                  label="网站描述"
                  name="site_description"
                  rules={[{ required: true, message: '请输入网站描述' }]}
                >
                  <TextArea
                    rows={3}
                    placeholder="请输入网站描述"
                    showCount
                    maxLength={200}
                  />
                </Form.Item>

                <Form.Item
                  label="网站Logo"
                  name="site_logo"
                >
                  <Upload {...uploadProps}>
                    <div>
                      <UploadOutlined />
                      <div style={{ marginTop: 8 }}>上传Logo</div>
                    </div>
                  </Upload>
                </Form.Item>

                <Form.Item
                  label="联系邮箱"
                  name="contact_email"
                  rules={[
                    { required: true, message: '请输入联系邮箱' },
                    { type: 'email', message: '请输入有效的邮箱地址' }
                  ]}
                >
                  <Input placeholder="admin@example.com" />
                </Form.Item>

                <Form.Item
                  label="备案号"
                  name="icp_number"
                >
                  <Input placeholder="请输入备案号" />
                </Form.Item>
              </Card>
            </Col>

            <Col span={12}>
              <Card
                title="系统设置"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(8px)',
                  borderRadius: '12px',
                  border: '1px solid #e5e7eb',
                  marginBottom: '24px'
                }}
              >
                <Form.Item
                  label="维护模式"
                  name="maintenance_mode"
                  valuePropName="checked"
                  extra="开启后，普通用户将无法访问网站"
                >
                  <Switch />
                </Form.Item>

                <Form.Item
                  label="允许用户注册"
                  name="allow_registration"
                  valuePropName="checked"
                  extra="关闭后，新用户将无法自行注册"
                >
                  <Switch />
                </Form.Item>

                <Form.Item
                  label="邮箱验证"
                  name="email_verification_required"
                  valuePropName="checked"
                  extra="开启后，新用户需要验证邮箱才能使用完整功能"
                >
                  <Switch />
                </Form.Item>

                <Form.Item
                  label="默认用户角色"
                  name="default_user_role"
                  extra="新用户注册时的默认角色"
                >
                  <Select>
                    <Option value="user">普通用户</Option>
                    <Option value="creator">创作者</Option>
                  </Select>
                </Form.Item>
              </Card>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col span={12}>
              <Card
                title="上传设置"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(8px)',
                  borderRadius: '12px',
                  border: '1px solid #e5e7eb',
                  marginBottom: '24px'
                }}
              >
                <Form.Item
                  label="最大上传大小 (MB)"
                  name="max_upload_size"
                  rules={[{ required: true, message: '请设置最大上传大小' }]}
                >
                  <InputNumber
                    min={1}
                    max={100}
                    style={{ width: '100%' }}
                    placeholder="5"
                  />
                </Form.Item>

                <Form.Item
                  label="支持的图片格式"
                  name="supported_image_formats"
                  rules={[{ required: true, message: '请选择支持的图片格式' }]}
                >
                  <Select
                    mode="multiple"
                    placeholder="请选择支持的图片格式"
                  >
                    <Option value="jpg">JPG</Option>
                    <Option value="jpeg">JPEG</Option>
                    <Option value="png">PNG</Option>
                    <Option value="gif">GIF</Option>
                    <Option value="webp">WebP</Option>
                  </Select>
                </Form.Item>
              </Card>
            </Col>

            <Col span={12}>
              <Card
                title="安全设置"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(8px)',
                  borderRadius: '12px',
                  border: '1px solid #e5e7eb',
                  marginBottom: '24px'
                }}
              >
                <Form.Item
                  label="会话超时时间 (秒)"
                  name="session_timeout"
                  rules={[{ required: true, message: '请设置会话超时时间' }]}
                  extra="用户无操作多久后自动登出"
                >
                  <InputNumber
                    min={300}
                    max={86400}
                    style={{ width: '100%' }}
                    placeholder="7200"
                  />
                </Form.Item>
              </Card>
            </Col>
          </Row>
        </Form>
      </div>
    </div>
  )
}

export default BasicSettings