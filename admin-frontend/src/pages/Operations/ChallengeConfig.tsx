import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Switch,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Slider,
  Row,
  Col,
  Statistic,
  message,
  Typography,
  Popconfirm,
} from 'antd';
import {
  ThunderboltOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { challengeService, type ChallengeTemplate, type ChallengeStats } from '@/services/challenge';
import PageHeader from '@/components/PageHeader';

const { Text } = Typography;

const typeOptions = [
  { label: '绘制次数', value: 'draw_count' },
  { label: '区域绘制', value: 'region_draw' },
  { label: '图案绘制', value: 'pattern_draw' },
];

const typeColorMap: Record<string, string> = {
  draw_count: 'blue',
  region_draw: 'green',
  pattern_draw: 'purple',
};

const typeLabelMap: Record<string, string> = {
  draw_count: '绘制次数',
  region_draw: '区域绘制',
  pattern_draw: '图案绘制',
};

const difficultyColorMap: Record<string, string> = {
  easy: 'green',
  normal: 'blue',
  hard: 'red',
};

const difficultyLabelMap: Record<string, string> = {
  easy: '简单',
  normal: '普通',
  hard: '困难',
};

const ChallengeConfig: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<ChallengeTemplate[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [stats, setStats] = useState<ChallengeStats | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<ChallengeTemplate | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [form] = Form.useForm();

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await challengeService.getTemplates({
        current: currentPage,
        pageSize,
        keyword: searchKeyword || undefined,
      });
      setTemplates(res.list || res.data || []);
      setTotal(res.total || 0);
    } catch (error) {
      console.error('获取模板列表失败:', error);
      message.error('获取模板列表失败');
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, searchKeyword]);

  const fetchStats = useCallback(async () => {
    try {
      const data = await challengeService.getStats();
      setStats(data);
    } catch (error) {
      console.error('获取统计数据失败:', error);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleCreate = () => {
    setEditingItem(null);
    form.resetFields();
    form.setFieldsValue({
      type: 'draw_count',
      difficulty: 'normal',
      weight: 5,
      is_active: true,
      target_value: 1,
      reward_points: 10,
    });
    setModalVisible(true);
  };

  const handleEdit = (record: ChallengeTemplate) => {
    setEditingItem(record);
    form.setFieldsValue({
      type: record.type,
      title: record.title,
      description: record.description,
      target_value: record.target_value,
      reward_points: record.reward_points,
      weight: record.weight,
      difficulty: record.difficulty,
      is_active: record.is_active,
    });
    setModalVisible(true);
  };

  const handleDelete = async (record: ChallengeTemplate) => {
    try {
      await challengeService.deleteTemplate(record.id);
      message.success('删除成功');
      fetchTemplates();
      fetchStats();
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败');
    }
  };

  const handleToggleActive = async (record: ChallengeTemplate) => {
    try {
      await challengeService.toggleActive(record.id);
      message.success(record.is_active ? '已停用' : '已激活');
      fetchTemplates();
      fetchStats();
    } catch (error) {
      console.error('状态切换失败:', error);
      message.error('状态切换失败');
    }
  };

  const handleFinish = async (values: any) => {
    setSubmitting(true);
    try {
      if (editingItem) {
        await challengeService.updateTemplate(editingItem.id, values);
        message.success('更新成功');
      } else {
        await challengeService.createTemplate(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      fetchTemplates();
      fetchStats();
    } catch (error) {
      console.error('操作失败:', error);
      message.error('操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    fetchTemplates();
  };

  const columns = [
    {
      title: '类型',
      dataIndex: 'type',
      width: 120,
      render: (type: string) => (
        <Tag color={typeColorMap[type] || 'default'}>
          {typeLabelMap[type] || type}
        </Tag>
      ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      width: 180,
      ellipsis: true,
    },
    {
      title: '描述',
      dataIndex: 'description',
      width: 220,
      ellipsis: true,
      render: (text: string) => (
        <Text type="secondary" ellipsis={{ tooltip: text }}>
          {text}
        </Text>
      ),
    },
    {
      title: '目标值',
      dataIndex: 'target_value',
      width: 90,
      align: 'center' as const,
      render: (val: number) => (
        <Text strong>{val}</Text>
      ),
    },
    {
      title: '奖励积分',
      dataIndex: 'reward_points',
      width: 100,
      align: 'center' as const,
      render: (val: number) => (
        <Text strong style={{ color: '#faad14' }}>{val}</Text>
      ),
    },
    {
      title: '权重',
      dataIndex: 'weight',
      width: 80,
      align: 'center' as const,
    },
    {
      title: '难度',
      dataIndex: 'difficulty',
      width: 80,
      align: 'center' as const,
      render: (difficulty: string) => (
        <Tag color={difficultyColorMap[difficulty] || 'default'}>
          {difficultyLabelMap[difficulty] || difficulty}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      width: 80,
      align: 'center' as const,
      render: (_: boolean, record: ChallengeTemplate) => (
        <Switch
          checked={record.is_active}
          size="small"
          onChange={() => handleToggleActive(record)}
        />
      ),
    },
    {
      title: '操作',
      width: 140,
      render: (_: any, record: ChallengeTemplate) => (
        <Space>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            style={{ color: '#1677ff', fontSize: '12px' }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description={`确定要删除挑战模板「${record.title}」吗？`}
            onConfirm={() => handleDelete(record)}
            okText="确认"
            cancelText="取消"
            okType="danger"
          >
            <Button
              type="text"
              size="small"
              icon={<DeleteOutlined />}
              style={{ color: '#ef4444', fontSize: '12px' }}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '0px' }}>
      <PageHeader
        title="每日挑战配置"
        description="管理每日挑战模板"
        icon={<ThunderboltOutlined style={{ color: 'white', fontSize: '20px' }} />}
        iconBg="#722ed1"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => { fetchTemplates(); fetchStats(); }}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              新建模板
            </Button>
          </Space>
        }
      />

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="总模板数"
              value={stats?.total ?? '-'}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="已激活"
              value={stats?.active ?? '-'}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="今日完成数"
              value={stats?.today_completed ?? '-'}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Input.Search
              placeholder="搜索挑战标题"
              allowClear
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onSearch={handleSearch}
              style={{ width: 280 }}
              enterButton={<><SearchOutlined /> 搜索</>}
            />
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={templates}
          rowKey="id"
          loading={loading}
          pagination={{
            current: currentPage,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (total: number) => `共 ${total} 条`,
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size);
            },
          }}
          size="middle"
          scroll={{ x: 1100 }}
        />
      </Card>

      <Modal
        title={editingItem ? '编辑挑战模板' : '新建挑战模板'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        width={640}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleFinish}
          style={{ marginTop: 16 }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="type"
                label="类型"
                rules={[{ required: true, message: '请选择挑战类型' }]}
              >
                <Select placeholder="请选择挑战类型">
                  {typeOptions.map((opt) => (
                    <Select.Option key={opt.value} value={opt.value}>
                      {opt.label}
                    </Select.Option>
                  ))}
                  <Select.Option value="custom">自定义</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="difficulty"
                label="难度"
                rules={[{ required: true, message: '请选择难度' }]}
              >
                <Select placeholder="请选择难度">
                  <Select.Option value="easy">简单</Select.Option>
                  <Select.Option value="normal">普通</Select.Option>
                  <Select.Option value="hard">困难</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入挑战标题' }]}
          >
            <Input placeholder="请输入挑战标题" maxLength={50} showCount />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
            rules={[{ required: true, message: '请输入挑战描述' }]}
          >
            <Input.TextArea rows={3} placeholder="请输入挑战描述" maxLength={200} showCount />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="target_value"
                label="目标值"
                rules={[{ required: true, message: '请输入目标值' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={1}
                  placeholder="完成挑战所需的目标值"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="reward_points"
                label="奖励积分"
                rules={[{ required: true, message: '请输入奖励积分' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  placeholder="完成挑战获得的积分"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="weight"
            label="权重"
            tooltip="权重越高，被选中的概率越大 (1-10)"
          >
            <Slider min={1} max={10} marks={{ 1: '1', 5: '5', 10: '10' }} />
          </Form.Item>

          <Form.Item
            name="is_active"
            label="启用状态"
            valuePropName="checked"
          >
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ChallengeConfig;
