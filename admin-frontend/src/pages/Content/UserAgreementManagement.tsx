import React, { useState, useEffect, useCallback } from 'react'
import { Card, Form, Input, Button, message, Spin, Typography, Space, Modal, Timeline, DatePicker, Select, Tag, Row, Col, Upload, Divider, Alert, Segmented, Table, Badge, Popconfirm } from 'antd'
import { SaveOutlined, HistoryOutlined, ReloadOutlined, UploadOutlined, FilePdfOutlined, EyeOutlined, DownloadOutlined, GlobalOutlined, SendOutlined, CheckCircleOutlined, SyncOutlined } from '@ant-design/icons'
import type { UploadFile, UploadProps } from 'antd'
import { logger } from '@/utils/logger'
import dayjs from 'dayjs'

const { Title, Text, Link } = Typography
const { Option } = Select

interface SystemConfig {
  id?: number
  config_key: string
  config_value: string
  config_type: string
  description?: string
  version_number?: string
  effective_date?: string
  status?: 'draft' | 'published' | 'archived'
  file_path?: string
  file_name?: string
  file_type?: string
  file_size?: number
  file_url?: string
  updated_at?: string
  updated_by_user?: {
    id: number
    username: string
    display_name: string
  }
}

// 支持的语言列表
const LANG_OPTIONS = [
  { label: 'English', value: 'en', icon: '🇺🇸' },
  { label: '中文', value: 'zh-Hans', icon: '🇨🇳' },
  { label: '日本語', value: 'ja', icon: '🇯🇵' },
  { label: '한국어', value: 'ko', icon: '🇰🇷' },
  { label: 'Español', value: 'es', icon: '🇪🇸' },
  { label: 'Português', value: 'pt-BR', icon: '🇧🇷' },
]

const UserAgreementManagement: React.FC = () => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [publishing, setPublishing] = useState(false)

  // 两个状态：草稿（当前编辑）和 已发布（现网版本）
  const [draftConfig, setDraftConfig] = useState<SystemConfig | null>(null)
  const [publishedConfig, setPublishedConfig] = useState<SystemConfig | null>(null)

  const [previewModalVisible, setPreviewModalVisible] = useState(false)
  const [history, setHistory] = useState<any[]>([]) // 归档列表
  const [historyLoading, setHistoryLoading] = useState(false)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [editMode, setEditMode] = useState<'file' | 'text'>('file')
  const [currentLang, setCurrentLang] = useState('zh-Hans')

  // 根据语言生成 key
  const getBaseKey = useCallback((lang: string) => `user_agreement_${lang}`, [])
  const getDraftKey = useCallback((lang: string) => `user_agreement_${lang}_draft`, [])

  // 加载配置（尝试加载草稿，如果没有则加载已发布版本作为基础）
  const loadConfig = useCallback(async (lang?: string) => {
    const targetLang = lang || currentLang
    setLoading(true)
    try {
      const token = localStorage.getItem('admin_token')
      const baseKey = getBaseKey(targetLang)
      const draftKey = getDraftKey(targetLang)

      // 1. 获取现网已发布版本 (Published)
      // 注意：后端 GET /configs/:key 逻辑是获取最新的，我们这里并行请求两个key看看情况
      // 但为了准确，我们先请求 draftKey，如果 404，说明没有草稿

      let currentDraft: SystemConfig | null = null
      let currentPublished: SystemConfig | null = null

      // 请求草稿
      try {
        const draftRes = await fetch(`/api/system-config/configs/${draftKey}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (draftRes.ok) {
          const draftData = await draftRes.json()
          if (draftData.success) currentDraft = draftData.data
        }
      } catch (e) { /* ignore */ }

      // 请求已发布 (主Key)
      try {
        const pubRes = await fetch(`/api/system-config/configs/${baseKey}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (pubRes.ok) {
          const pubData = await pubRes.json()
          if (pubData.success) currentPublished = pubData.data
        }
      } catch (e) { /* ignore */ }

      setDraftConfig(currentDraft)
      setPublishedConfig(currentPublished)

      // 决定表单显示什么数据
      // 优先显示草稿；如果没有草稿，显示已发布版本；如果都没有，显示空白默认值
      const displayConfig = currentDraft || currentPublished

      if (displayConfig) {
        const mode = (displayConfig.config_type === 'file') ? 'file' : 'text'
        setEditMode(mode)
        form.setFieldsValue({
          version_number: displayConfig.version_number || '',
          effective_date: displayConfig.effective_date ? dayjs(displayConfig.effective_date) : null,
          config_value: displayConfig.config_value || '',
          config_type: mode
        })
      } else {
        // 全新初始化
        form.resetFields()
        setEditMode('file')
        form.setFieldsValue({ config_type: 'file' })
      }

      // 加载归档历史
      loadArchivedHistory(baseKey)

    } catch (error) {
      logger.error('加载配置失败:', error)
      message.error('加载配置失败')
    } finally {
      setLoading(false)
    }
  }, [currentLang, getBaseKey, getDraftKey, form])

  // 加载归档历史
  const loadArchivedHistory = async (key: string) => {
    setHistoryLoading(true)
    try {
      const token = localStorage.getItem('admin_token')
      const response = await fetch(`/api/system-config/configs/${key}/archived`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const result = await response.json()
        setHistory(result.data || [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setHistoryLoading(false)
    }
  }

  // 切换语言
  const handleLangChange = (lang: string | number) => {
    const newLang = String(lang)
    setCurrentLang(newLang)
    setFileList([])
    form.resetFields()
    setDraftConfig(null)
    setPublishedConfig(null)
    loadConfig(newLang)
  }

  // 保存草稿
  const handleSaveDraft = async () => {
    try {
      await form.validateFields()
      const values = form.getFieldsValue()

      // 只有文件模式且没有文件上传时，才需要检查是否已有文件
      // 逻辑：如果是文件模式，且 fileList 为空，且当前不是基于已有文件配置编辑，则报错
      // 但这里我们是在保存草稿，总是保存到 _draft key

      const token = localStorage.getItem('admin_token')
      const draftKey = getDraftKey(currentLang)

      if (editMode === 'file') {
        if (fileList.length === 0 && !draftConfig?.file_url && !publishedConfig?.file_url) {
          message.error('请选择要上传的PDF文件')
          return
        }

        // 如果有新文件，走上传接口
        if (fileList.length > 0) {
          setUploading(true)
          const formData = new FormData()
          formData.append('file', fileList[0] as any)
          formData.append('version_number', values.version_number || '')
          formData.append('effective_date', values.effective_date ? values.effective_date.toISOString() : '')
          formData.append('status', 'draft') // 强制为 draft
          formData.append('update_reason', values.reason || '保存草稿')
          formData.append('description', '用户服务协议(草稿)')

          const response = await fetch(`/api/system-config/configs/${draftKey}/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
          })

          if (!response.ok) throw new Error('上传失败')
          const result = await response.json()
          if (result.success) {
            message.success('草稿已保存')
            setFileList([])
            // 不清空 reason，方便继续编辑发布
            loadConfig()
          }
        } else {
          // 没选新文件，但想更新元数据（如版本号），需确保草稿存在
          // 如果当前显示的是 published 且没有 fileList，我们无法简单地"复制"文件到 draft key
          // 简化逻辑：文件模式下，必须上传新文件才能保存为新草稿，或者后端支持 copy
          // 目前后端不支持 copy file，所以提示用户必须上传
          message.warning('PDF模式下若要创建新版本，请重新上传文件')
          return
        }
      } else {
        // 文本模式
        setLoading(true)
        const response = await fetch(`/api/system-config/configs/${draftKey}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            config_value: values.config_value,
            config_type: 'html',
            version_number: values.version_number,
            effective_date: values.effective_date ? values.effective_date.toISOString() : null,
            status: 'draft',
            update_reason: values.reason || '保存草稿',
            description: '用户服务协议(草稿)'
          })
        })

        if (!response.ok) throw new Error('保存失败')
        const result = await response.json()
        if (result.success) {
          message.success('草稿已保存')
          // 不清空 reason
          loadConfig()
        }
      }
    } catch (error: any) {
      logger.error('保存草稿失败:', error)
      message.error(error.message || '保存失败')
    } finally {
      setUploading(false)
      setLoading(false)
    }
  }

  // 发布
  const handlePublish = async () => {
    if (!draftConfig) {
      message.warning('没有可发布的草稿')
      return
    }

    try {
      await form.validateFields() // 再次验证表单
      const values = form.getFieldsValue()

      setPublishing(true)
      const token = localStorage.getItem('admin_token')
      const baseKey = getBaseKey(currentLang)

      const response = await fetch(`/api/system-config/configs/${baseKey}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          reason: values.reason || '正式发布'
        })
      })

      if (!response.ok) throw new Error('发布失败')
      const result = await response.json()

      if (result.success) {
        message.success('发布成功！旧版本已归档。')
        form.resetFields(['reason']) // 发布成功后才清空原因
        loadConfig()
      } else {
        throw new Error(result.message || '发布失败')
      }

    } catch (error: any) {
      message.error(error.message || '发布失败')
    } finally {
      setPublishing(false)
    }
  }

  // 预览
  const handlePreview = (isDraft: boolean) => {
    if (editMode === 'text' || (isDraft ? draftConfig?.config_type : publishedConfig?.config_type) !== 'file') {
      // Markdown/Text 模式：打开公开渲染页面
      // 如果是一草稿预览，加 params
      const url = `/api/system-config/public/user-agreement?lang=${currentLang}${isDraft ? '&preview=draft' : ''}`
      window.open(url, '_blank')
    } else {
      // 文件模式
      const targetConfig = isDraft ? draftConfig : publishedConfig
      if (targetConfig && targetConfig.file_url) {
        // PDF预览，直接用 iframe (简单起见) 或者 Modal
        // 这里为了简单复用逻辑，如果是文件，我们打开文件URL
        window.open(targetConfig.file_url, '_blank')
      } else {
        message.warning('暂无可预览的文档')
      }
    }
  }

  // 下载PDF
  const handleDownload = (url?: string) => {
    if (url) {
      window.open(url, '_blank')
    } else {
      message.warning('暂无可下载的文档')
    }
  }

  useEffect(() => {
    loadConfig()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 上传组件属性
  const uploadProps: UploadProps = {
    name: 'file',
    maxCount: 1,
    accept: '.pdf',
    fileList: fileList,
    beforeUpload: (file) => {
      const isPDF = file.type === 'application/pdf'
      if (!isPDF) { message.error('只能上传 PDF 文件！'); return false }
      const isLt20M = file.size / 1024 / 1024 < 20
      if (!isLt20M) { message.error('文件大小不能超过 20MB！'); return false }
      setFileList([file])
      return false
    },
    onRemove: () => setFileList([])
  }

  // 表格列定义
  const columns = [
    { title: '版本', dataIndex: 'version_number', key: 'version', render: (text: string) => <Tag>{text}</Tag> },
    { title: '归档时间', dataIndex: 'created_at', key: 'time', render: (text: string) => new Date(text).toLocaleString() },
    { title: '更新人', dataIndex: 'updated_by_user', key: 'user', render: (user: any) => user?.display_name || user?.username || 'System' },
    { title: '原因', dataIndex: 'update_reason', key: 'reason', ellipsis: true },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          {record.file_url ? (
            <Button type="link" size="small" onClick={() => handleDownload(record.file_url)}>下载PDF</Button>
          ) : (
            <Button type="link" size="small" disabled>纯文本</Button> // 历史纯文本暂不支持查看
          )}
        </Space>
      )
    },
  ]

  return (
    <div>
      <Card
        title={
          <Space>
            <FilePdfOutlined />
            <span>用户协议管理</span>
            {draftConfig && <Tag color="warning">有未发布草稿</Tag>}
          </Space>
        }
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => loadConfig()}
              loading={loading}
            >
              刷新
            </Button>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Spin spinning={loading}>
          <Alert
            message="版本管理说明"
            description={
              <ul>
                <li><strong>保存草稿：</strong>保存到草稿箱，不会影响现网用户。您可以多次保存、预览。</li>
                <li><strong>正式发布：</strong>将当前草稿覆盖到现网环境，旧的现网版本会自动归档。</li>
              </ul>
            }
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />

          {/* 语言选择器 */}
          <div style={{ marginBottom: 24 }}>
            <Space>
              <GlobalOutlined />
              <span style={{ fontWeight: 500 }}>语言版本：</span>
            </Space>
            <Segmented
              options={LANG_OPTIONS}
              value={currentLang}
              onChange={handleLangChange}
              style={{ marginLeft: 8 }}
            />
          </div>

          <Form
            form={form}
            layout="vertical"
            initialValues={{ config_type: 'file' }}
          >
            <Row gutter={16}>
              <Col span={24}>
                <Form.Item label="配置模式" name="config_type">
                  <Select onChange={(value) => setEditMode(value)}>
                    <Option value="file">PDF文件</Option>
                    <Option value="text">文本/Markdown</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            {/* 版本管理字段 */}
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="新版本号"
                  name="version_number"
                  rules={[{ required: true, message: '请输入版本号' }]}
                  tooltip="发布后将成为新的现网版本号"
                >
                  <Input placeholder="例如: 2.0.1" maxLength={50} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="生效日期"
                  name="effective_date"
                  rules={[{ required: true, message: '请选择生效日期' }]}
                >
                  <DatePicker style={{ width: '100%' }} showTime />
                </Form.Item>
              </Col>
            </Row>

            <Divider />

            {/* 内容编辑器 */}
            {editMode === 'file' ? (
              <Form.Item
                label="上传PDF文档"
                tooltip="只支持PDF格式，最大20MB"
              >
                <div style={{ marginBottom: 10 }}>
                  {draftConfig?.file_name && <Tag color="orange">草稿文件: {draftConfig.file_name}</Tag>}
                  {(!draftConfig && publishedConfig?.file_name) && <Tag color="green">现网文件: {publishedConfig.file_name}</Tag>}
                </div>
                <Upload {...uploadProps}>
                  <Button icon={<UploadOutlined />}>选择新文件(覆盖)</Button>
                </Upload>
              </Form.Item>
            ) : (
              <>
                <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                  <span>Markdown 编辑器</span>
                  <Upload
                    accept=".md,.markdown,.txt"
                    showUploadList={false}
                    maxCount={1}
                    beforeUpload={(file) => {
                      const reader = new FileReader()
                      reader.onload = (e) => {
                        const content = e.target?.result as string
                        form.setFieldsValue({ config_value: content })
                        message.success(`已导入文件: ${file.name}`)
                      }
                      reader.readAsText(file)
                      return false
                    }}
                  >
                    <Button icon={<UploadOutlined />} size="small">导入文件</Button>
                  </Upload>
                </div>
                <Form.Item
                  name="config_value"
                  rules={[{ required: true, message: '请输入文本内容' }]}
                >
                  <Input.TextArea
                    placeholder="# 输入 Markdown 内容..."
                    rows={20}
                    style={{ fontFamily: 'monospace' }}
                  />
                </Form.Item>
              </>
            )}

            <Form.Item
              label="更新原因 (必填)"
              name="reason"
              rules={[{ required: true, message: '请输入更新原因' }]}
            >
              <Input placeholder="例如：修正了第3条款的笔误" maxLength={200} />
            </Form.Item>

            <Form.Item>
              <Space size="middle">
                <Button
                  type="default"
                  icon={<SaveOutlined />}
                  loading={uploading || loading}
                  onClick={handleSaveDraft}
                  size="large"
                >
                  保存草稿
                </Button>

                <Button
                  icon={<EyeOutlined />}
                  size="large"
                  onClick={() => handlePreview(true)} // true = 预览草稿
                  disabled={!draftConfig && !form.getFieldValue('config_value') && fileList.length === 0}
                >
                  预览草稿
                </Button>

                <Popconfirm
                  title="确认发布?"
                  description="这将覆盖现网版本，旧版本将自动归档。"
                  onConfirm={handlePublish}
                  okText="发布"
                  cancelText="取消"
                  disabled={!draftConfig}
                >
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    loading={publishing}
                    size="large"
                    disabled={!draftConfig} // 必须有已保存的草稿才能发布
                  >
                    正式发布
                  </Button>
                </Popconfirm>
              </Space>
            </Form.Item>
          </Form>
        </Spin>
      </Card>

      <Row gutter={16}>
        <Col span={12}>
          {/* 现网版本卡片 */}
          <Card title={<Space><CheckCircleOutlined style={{ color: '#52c41a' }} /><span>现网运行版本 (Live)</span></Space>} size="small" style={{ height: '100%' }}>
            {publishedConfig ? (
              <Space direction="vertical">
                <Text>版本: <Tag color="success">{publishedConfig.version_number}</Tag></Text>
                <Text>更新时间: {new Date(publishedConfig.updated_at || '').toLocaleString()}</Text>
                <Button type="link" size="small" onClick={() => handlePreview(false)}>查看现网版本</Button>
              </Space>
            ) : <Text type="secondary">暂无发布版本</Text>}
          </Card>
        </Col>
        <Col span={12}>
          {/* 归档列表简略 */}
          <Card title={<Space><HistoryOutlined /><span>历史归档 (Archived)</span></Space>} size="small" style={{ height: '100%' }}>
            <Table
              dataSource={history}
              columns={columns}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 5 }}
              loading={historyLoading}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default UserAgreementManagement
