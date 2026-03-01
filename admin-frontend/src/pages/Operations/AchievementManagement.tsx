import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Input,
  Select,
  Space,
  Tag,
  Switch,
  Drawer,
  Form,
  InputNumber,
  message,
  Avatar,
  Tooltip,
  Row,
  Col,
  Statistic,
  Popconfirm,
} from 'antd';
import {
  SearchOutlined,
  TrophyOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { achievementService, type Achievement, type AchievementStats } from '@/services/achievement';
import type { ColumnsType } from 'antd/es/table';

const { Option } = Select;
const { TextArea } = Input;

const categoryLabelMap: Record<string, string> = {
  likes: '点赞',
  pixels: '像素',
  activity: '活跃',
  social: '社交',
  shop: '商店',
  alliance: '联盟',
  special: '特殊',
};

const categoryColorMap: Record<string, string> = {
  likes: 'red',
  pixels: 'blue',
  activity: 'green',
  social: 'purple',
  shop: 'orange',
  alliance: 'cyan',
  special: 'gold',
};

const typeLabelMap: Record<string, string> = {
  counter: '计数器',
  milestone: '里程碑',
  collection: '收集',
  challenge: '挑战',
};

const repeatCycleLabelMap: Record<string, string> = {
  permanent: '永久',
  daily: '每日',
  weekly: '每周',
};

const AchievementManagement: React.FC = () => {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [current, setCurrent] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [stats, setStats] = useState<AchievementStats>({
    total: 0,
    active: 0,
    category_stats: [],
    total_completions: 0,
    unique_users: 0,
  });
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingAchievement, setEditingAchievement] = useState<Achievement | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  // Load achievement list
  const loadAchievements = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        page: current,
        pageSize,
      };
      if (keyword) params.keyword = keyword;
      if (filterCategory) params.category = filterCategory;
      if (filterStatus === 'active') params.is_active = true;
      if (filterStatus === 'inactive') params.is_active = false;

      const response = await achievementService.getList(params);
      setAchievements(response.list || response.data || []);
      setTotal(response.total || 0);
    } catch (error) {
      message.error('加载成就列表失败');
      console.error('加载成就列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, [current, pageSize, keyword, filterCategory, filterStatus]);

  // Load stats
  const loadStats = async () => {
    try {
      const data = await achievementService.getStats();
      setStats(data);
    } catch (error) {
      console.error('加载成就统计失败:', error);
    }
  };

  // Handle search
  const handleSearch = () => {
    setCurrent(1);
    loadAchievements();
  };

  // Handle reset
  const handleReset = () => {
    setKeyword('');
    setFilterCategory('');
    setFilterStatus('');
    setCurrent(1);
  };

  // Handle pagination change
  const handleTableChange = (pagination: any) => {
    setCurrent(pagination.current);
    setPageSize(pagination.pageSize);
  };

  // Toggle achievement active status
  const handleToggleActive = async (record: Achievement) => {
    try {
      await achievementService.toggleActive(record.id);
      message.success(`成就「${record.name}」状态已更新`);
      loadAchievements();
      loadStats();
    } catch (error) {
      message.error('更新成就状态失败');
      console.error('更新成就状态失败:', error);
    }
  };

  // Open create drawer
  const handleCreate = () => {
    setEditingAchievement(null);
    form.resetFields();
    form.setFieldsValue({
      is_active: true,
      display_priority: 0,
      requirement: 1,
      reward_points: 0,
      repeat_cycle: 'permanent',
    });
    setDrawerVisible(true);
  };

  // Open edit drawer
  const handleEdit = (record: Achievement) => {
    setEditingAchievement(record);
    form.setFieldsValue({
      ...record,
      reward_items: record.reward_items ? JSON.stringify(record.reward_items, null, 2) : '',
    });
    setDrawerVisible(true);
  };

  // Handle delete
  const handleDelete = async (record: Achievement) => {
    try {
      await achievementService.delete(record.id);
      message.success(`成就「${record.name}」已删除`);
      loadAchievements();
      loadStats();
    } catch (error) {
      message.error('删除成就失败');
      console.error('删除成就失败:', error);
    }
  };

  // Handle form submit
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      // Parse reward_items JSON
      let rewardItems: any[] = [];
      if (values.reward_items) {
        try {
          rewardItems = JSON.parse(values.reward_items);
        } catch {
          message.error('奖励物品 JSON 格式不正确');
          setSubmitting(false);
          return;
        }
      }

      const payload = {
        ...values,
        reward_items: rewardItems,
      };

      if (editingAchievement) {
        await achievementService.update(editingAchievement.id, payload);
        message.success('成就更新成功');
      } else {
        await achievementService.create(payload);
        message.success('成就创建成功');
      }

      setDrawerVisible(false);
      form.resetFields();
      loadAchievements();
      loadStats();
    } catch (error: any) {
      if (error?.errorFields) return; // Form validation error
      message.error(editingAchievement ? '更新成就失败' : '创建成就失败');
      console.error('提交成就失败:', error);
    } finally {
      setSubmitting(false);
    }
  };

  // Build category distribution display string
  const getCategoryDistribution = () => {
    if (!stats.category_stats || stats.category_stats.length === 0) return '暂无数据';
    return stats.category_stats
      .map((item) => `${categoryLabelMap[item.category] || item.category}: ${item.count}`)
      .join(', ');
  };

  // Table columns
  const columns: ColumnsType<Achievement> = [
    {
      title: '成就信息',
      key: 'info',
      width: 280,
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Avatar
            size={48}
            src={record.icon_url}
            style={{
              backgroundColor: '#1677ff',
              fontSize: '16px',
              fontWeight: 'bold',
              border: '2px solid #f0f0f0',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
            }}
          >
            {record.name.charAt(0)}
          </Avatar>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontWeight: '600',
                color: '#1f2937',
                fontSize: '14px',
                marginBottom: '2px',
              }}
            >
              {record.name}
            </div>
            <Tooltip placement="topLeft" title={record.description}>
              <div
                style={{
                  color: '#6b7280',
                  fontSize: '12px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {record.description}
              </div>
            </Tooltip>
          </div>
        </div>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (category: string) => (
        <Tag
          color={categoryColorMap[category] || 'default'}
          style={{
            borderRadius: '12px',
            fontWeight: '500',
            padding: '4px 12px',
          }}
        >
          {categoryLabelMap[category] || category}
        </Tag>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: string) => (
        <span style={{ color: '#6b7280', fontSize: '13px' }}>
          {typeLabelMap[type] || type}
        </span>
      ),
    },
    {
      title: '达成条件',
      dataIndex: 'requirement',
      key: 'requirement',
      width: 100,
      render: (requirement: number) => (
        <span style={{ fontWeight: '500', color: '#1f2937' }}>{requirement}</span>
      ),
      sorter: (a, b) => a.requirement - b.requirement,
    },
    {
      title: '奖励积分',
      dataIndex: 'reward_points',
      key: 'reward_points',
      width: 100,
      render: (points: number) => (
        <span style={{ fontWeight: '500', color: '#f59e0b' }}>{points}</span>
      ),
      sorter: (a, b) => a.reward_points - b.reward_points,
    },
    {
      title: '优先级',
      dataIndex: 'display_priority',
      key: 'display_priority',
      width: 80,
      render: (priority: number) => (
        <span style={{ color: '#6b7280', fontSize: '13px' }}>{priority}</span>
      ),
      sorter: (a, b) => a.display_priority - b.display_priority,
    },
    {
      title: '状态',
      key: 'is_active',
      width: 80,
      render: (_, record) => (
        <Switch
          checked={record.is_active}
          onChange={() => handleToggleActive(record)}
          checkedChildren="启用"
          unCheckedChildren="禁用"
          size="small"
        />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 140,
      render: (_, record) => (
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
            description={`确定要删除成就「${record.name}」吗？`}
            onConfirm={() => handleDelete(record)}
            okText="确认"
            cancelText="取消"
          >
            <Button
              type="text"
              size="small"
              icon={<DeleteOutlined />}
              danger
              style={{ fontSize: '12px' }}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Initial load
  useEffect(() => {
    loadAchievements();
  }, [current, pageSize, loadAchievements]);

  useEffect(() => {
    loadStats();
  }, []);

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
      }}
    >
      {/* Page header */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          padding: '24px',
          marginBottom: '24px',
          border: '1px solid #f0f0f0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              backgroundColor: '#1677ff',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '16px',
            }}
          >
            <TrophyOutlined style={{ color: 'white', fontSize: '20px' }} />
          </div>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: '28px',
                fontWeight: '700',
                color: '#1f2937',
                lineHeight: '1.2',
              }}
            >
              成就管理
            </h1>
            <p
              style={{
                margin: '4px 0 0 0',
                fontSize: '14px',
                color: '#6b7280',
                lineHeight: '1.4',
              }}
            >
              管理游戏成就和徽章
            </p>
          </div>
        </div>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
            style={{ borderRadius: '8px', fontWeight: '500' }}
          >
            新建成就
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              handleReset();
              loadAchievements();
              loadStats();
            }}
            style={{ borderRadius: '8px', fontWeight: '500' }}
          >
            重置
          </Button>
        </Space>
      </div>

      {/* Stats cards */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={8}>
          <Card
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #f0f0f0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            }}
          >
            <Statistic
              title="总成就数"
              value={stats.total}
              prefix={<TrophyOutlined style={{ color: '#1677ff' }} />}
              valueStyle={{ color: '#1677ff' }}
            />
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
              平台成就总量
            </p>
          </Card>
        </Col>
        <Col span={8}>
          <Card
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #f0f0f0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            }}
          >
            <Statistic
              title="已激活"
              value={stats.active}
              prefix={<CheckCircleOutlined style={{ color: '#10b981' }} />}
              valueStyle={{ color: '#10b981' }}
            />
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
              当前已激活成就数
            </p>
          </Card>
        </Col>
        <Col span={8}>
          <Card
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #f0f0f0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            }}
          >
            <Statistic
              title="分类分布"
              value={getCategoryDistribution()}
              prefix={<AppstoreOutlined style={{ color: '#f59e0b' }} />}
              valueStyle={{ color: '#f59e0b', fontSize: '14px' }}
            />
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
              各分类成就数量
            </p>
          </Card>
        </Col>
      </Row>

      {/* Search and filter area */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '24px',
          border: '1px solid #f0f0f0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '16px',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <Input
            placeholder="搜索成就名称或描述"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: 240, borderRadius: '8px' }}
            prefix={<SearchOutlined />}
          />
          <Select
            placeholder="选择分类"
            value={filterCategory || undefined}
            onChange={(val) => setFilterCategory(val || '')}
            style={{ width: 160 }}
            allowClear
          >
            <Option value="likes">点赞</Option>
            <Option value="pixels">像素</Option>
            <Option value="activity">活跃</Option>
            <Option value="social">社交</Option>
            <Option value="shop">商店</Option>
            <Option value="alliance">联盟</Option>
            <Option value="special">特殊</Option>
          </Select>
          <Select
            placeholder="选择状态"
            value={filterStatus || undefined}
            onChange={(val) => setFilterStatus(val || '')}
            style={{ width: 160 }}
            allowClear
          >
            <Option value="">全部</Option>
            <Option value="active">已激活</Option>
            <Option value="inactive">已禁用</Option>
          </Select>
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={handleSearch}
            style={{ borderRadius: '6px', fontWeight: '500' }}
          >
            搜索
          </Button>
        </div>
      </div>

      {/* Main table area */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #f0f0f0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          padding: '24px',
        }}
      >
        <Table
          columns={columns}
          dataSource={achievements}
          rowKey="id"
          loading={loading}
          pagination={{
            current,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 个成就`,
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
          onChange={handleTableChange}
          scroll={{ x: 1080 }}
          style={{ borderRadius: '12px' }}
        />
      </div>

      {/* Create/Edit Drawer */}
      <Drawer
        title={editingAchievement ? '编辑成就' : '新建成就'}
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          form.resetFields();
        }}
        width={520}
        extra={
          <Space>
            <Button
              onClick={() => {
                setDrawerVisible(false);
                form.resetFields();
              }}
            >
              取消
            </Button>
            <Button type="primary" loading={submitting} onClick={handleSubmit}>
              {editingAchievement ? '更新' : '创建'}
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" requiredMark="optional">
          <Form.Item
            label="成就名称"
            name="name"
            rules={[{ required: true, message: '请输入成就名称' }]}
          >
            <Input placeholder="请输入成就名称" />
          </Form.Item>

          <Form.Item
            label="成就描述"
            name="description"
            rules={[{ required: true, message: '请输入成就描述' }]}
          >
            <Input placeholder="请输入成就描述" />
          </Form.Item>

          <Form.Item label="图标 URL" name="icon_url">
            <Input placeholder="请输入图标 URL" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="分类"
                name="category"
                rules={[{ required: true, message: '请选择分类' }]}
              >
                <Select placeholder="请选择分类">
                  <Option value="likes">点赞</Option>
                  <Option value="pixels">像素</Option>
                  <Option value="activity">活跃</Option>
                  <Option value="social">社交</Option>
                  <Option value="shop">商店</Option>
                  <Option value="alliance">联盟</Option>
                  <Option value="special">特殊</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="类型"
                name="type"
                rules={[{ required: true, message: '请选择类型' }]}
              >
                <Select placeholder="请选择类型">
                  <Option value="counter">计数器</Option>
                  <Option value="milestone">里程碑</Option>
                  <Option value="collection">收集</Option>
                  <Option value="challenge">挑战</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="达成条件"
                name="requirement"
                rules={[{ required: true, message: '请输入达成条件' }]}
              >
                <InputNumber
                  min={1}
                  style={{ width: '100%' }}
                  placeholder="请输入达成条件数值"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="奖励积分"
                name="reward_points"
                rules={[{ required: true, message: '请输入奖励积分' }]}
              >
                <InputNumber
                  min={0}
                  style={{ width: '100%' }}
                  placeholder="请输入奖励积分"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="奖励物品 (JSON)" name="reward_items">
            <TextArea
              rows={4}
              placeholder='请输入 JSON 格式的奖励物品，例如：[{"type": "item", "id": "xxx", "count": 1}]'
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="重复周期"
                name="repeat_cycle"
                rules={[{ required: true, message: '请选择重复周期' }]}
              >
                <Select placeholder="请选择重复周期">
                  <Option value="permanent">永久</Option>
                  <Option value="daily">每日</Option>
                  <Option value="weekly">每周</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="显示优先级" name="display_priority">
                <InputNumber
                  min={0}
                  style={{ width: '100%' }}
                  placeholder="数值越大越靠前"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="是否激活" name="is_active" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
};

export default AchievementManagement;
