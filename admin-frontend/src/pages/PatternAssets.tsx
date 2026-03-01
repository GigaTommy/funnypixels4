import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Input,
  Select,
  Space,
  Tag,
  Modal,
  message,
  Avatar,
  Tooltip,
  Image,
  Badge,
  Descriptions,
  Row,
  Col,
  Statistic,
  Switch,
  Drawer,
  Form,
  InputNumber
} from 'antd';
import {
  SearchOutlined,
  PictureOutlined,
  UserOutlined,
  EyeOutlined,
  ReloadOutlined,
  DownloadOutlined,
  HeartOutlined,
  FolderOutlined,
  AppstoreOutlined,
  FireOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  UploadOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { patternService, type PatternAsset, type UpdatePatternRequest } from '@/services/pattern';
import { useAuth } from '@/contexts/AuthContext';
import { BatchImportModal } from '@/components/BatchImportModal';
import type { ColumnsType } from 'antd/es/table';

const { Option } = Select;
const { TextArea } = Input;

const PatternAssets: React.FC = () => {
  const { user } = useAuth();
  const [patterns, setPatterns] = useState<PatternAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [current, setCurrent] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchName, setSearchName] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [selectedPattern, setSelectedPattern] = useState<PatternAsset | null>(null);
  const [editDrawerVisible, setEditDrawerVisible] = useState(false);
  const [createDrawerVisible, setCreateDrawerVisible] = useState(false);
  const [editForm] = Form.useForm();
  const [createForm] = Form.useForm();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    public: 0,
    todayAdded: 0
  });

  // 加载图案资源列表
  const loadPatterns = async () => {
    setLoading(true);
    try {
      const response = await patternService.getPatternAssets({
        current,
        pageSize,
        name: searchName || undefined,
        category: filterCategory || undefined,
        type: filterType || undefined
      });
      setPatterns(response.list);
      setTotal(response.total);

      // 更新统计数据
      setStats({
        total: response.total,
        active: response.list.filter(p => p.status === 'active').length,
        public: response.list.filter(p => p.is_public).length,
        todayAdded: response.list.filter(p => {
          const today = new Date();
          const patternDate = new Date(p.created_at);
          return patternDate.toDateString() === today.toDateString();
        }).length
      });
    } catch (error) {
      message.error('加载图案资源列表失败');
      console.error('加载图案资源列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 查看图案详情
  const viewPatternDetail = (pattern: PatternAsset) => {
    setSelectedPattern(pattern);
    setDetailModalVisible(true);
  };

  // 编辑图案
  const handleEdit = (pattern: PatternAsset) => {
    setSelectedPattern(pattern);
    editForm.setFieldsValue({
      name: pattern.name,
      description: pattern.description || '',
      category: pattern.category,
      type: pattern.type,
      is_public: pattern.is_public,
      status: pattern.status,
    });
    setEditDrawerVisible(true);
  };

  // 提交编辑
  const handleEditSubmit = async (values: UpdatePatternRequest) => {
    if (!selectedPattern) return;
    try {
      await patternService.updatePattern(selectedPattern.id, values);
      message.success('图案更新成功');
      setEditDrawerVisible(false);
      setSelectedPattern(null);
      editForm.resetFields();
      loadPatterns();
    } catch (error) {
      message.error('图案更新失败');
      console.error('图案更新失败:', error);
    }
  };

  // 创建图案
  const handleCreateSubmit = async (values: any) => {
    try {
      await patternService.createPattern(values);
      message.success('图案创建成功');
      setCreateDrawerVisible(false);
      createForm.resetFields();
      loadPatterns();
    } catch (error) {
      message.error('图案创建失败');
      console.error('图案创建失败:', error);
    }
  };

  // 删除图案
  const handleDelete = (pattern: PatternAsset) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除图案 "${pattern.name}" 吗？此操作不可恢复。`,
      okText: '确认删除',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await patternService.deletePattern(pattern.id);
          message.success('图案删除成功');
          loadPatterns();
        } catch (error) {
          message.error('图案删除失败');
          console.error('图案删除失败:', error);
        }
      },
    });
  };

  // 切换上架/下架
  const handleToggleStatus = async (pattern: PatternAsset, checked: boolean) => {
    try {
      const newStatus = checked ? 'active' : 'inactive';
      await patternService.togglePatternStatus(pattern.id, newStatus);
      message.success(checked ? '已上架' : '已下架');
      loadPatterns();
    } catch (error) {
      message.error('状态切换失败');
      console.error('状态切换失败:', error);
    }
  };

  // 切换公开/私有
  const handleTogglePublic = async (pattern: PatternAsset, checked: boolean) => {
    try {
      await patternService.togglePatternPublic(pattern.id, checked);
      message.success(checked ? '已设为公开' : '已设为私有');
      loadPatterns();
    } catch (error) {
      message.error('公开性切换失败');
      console.error('公开性切换失败:', error);
    }
  };

  // 批量删除
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要删除的图案');
      return;
    }
    Modal.confirm({
      title: '批量删除',
      content: `确定要删除选中的 ${selectedRowKeys.length} 个图案吗？此操作不可恢复。`,
      okText: '确认删除',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await Promise.all(selectedRowKeys.map(id => patternService.deletePattern(id as string)));
          message.success(`成功删除 ${selectedRowKeys.length} 个图案`);
          setSelectedRowKeys([]);
          loadPatterns();
        } catch (error) {
          message.error('批量删除失败');
        }
      },
    });
  };

  // 处理搜索
  const handleSearch = () => {
    setCurrent(1);
    loadPatterns();
  };

  // 处理重置
  const handleReset = () => {
    setSearchName('');
    setFilterCategory('');
    setFilterType('');
    setCurrent(1);
    loadPatterns();
  };

  // 处理分页变化
  const handleTableChange = (pagination: any) => {
    setCurrent(pagination.current);
    setPageSize(pagination.pageSize);
  };

  // 获取状态标签
  const getStatusTag = (status: string) => {
    const statusConfig = {
      active: { color: '#10b981', text: '已上架', icon: <CheckCircleOutlined /> },
      inactive: { color: '#f59e0b', text: '已下架', icon: <ClockCircleOutlined /> },
      deleted: { color: '#ef4444', text: '已删除', icon: <FireOutlined /> }
    };
    const config = statusConfig[status as keyof typeof statusConfig] || { color: '#6b7280', text: status, icon: null };
    return (
      <Tag
        color={config.color}
        style={{
          borderRadius: '12px',
          fontWeight: '500',
          padding: '4px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}
      >
        {config.icon} {config.text}
      </Tag>
    );
  };

  // 获取分类标签
  const getCategoryTag = (category: string) => {
    const categoryConfig = {
      alliance_flag: { color: '#1677ff', text: '联盟旗帜', icon: <FolderOutlined /> },
      user_pattern: { color: '#10b981', text: '用户图案', icon: <UserOutlined /> },
      system_pattern: { color: '#0958d9', text: '系统图案', icon: <AppstoreOutlined /> },
      emoji: { color: '#f59e0b', text: '表情符号', icon: <HeartOutlined /> },
      color: { color: '#06b6d4', text: '纯色', icon: <PictureOutlined /> }
    };
    const config = categoryConfig[category as keyof typeof categoryConfig] || { color: '#6b7280', text: category, icon: null };
    return (
      <Tag
        color={config.color}
        style={{
          borderRadius: '12px',
          fontWeight: '500',
          padding: '4px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}
      >
        {config.icon} {config.text}
      </Tag>
    );
  };

  // 格式化文件大小
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  // 渲染图案预览
  const renderPatternPreview = (pattern: PatternAsset) => {
    if (pattern.thumbnail_url) {
      return (
        <Avatar
          size={48}
          src={pattern.thumbnail_url}
          shape="square"
          style={{
            border: '2px solid #e5e7eb',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
          }}
        />
      );
    }

    if (pattern.data && typeof pattern.data === 'object') {
      return (
        <Avatar
          size={48}
          style={{
            backgroundColor: pattern.category === 'color' ? '#f0f0f0' : '#1890ff',
            fontSize: '14px',
            border: '2px solid #e5e7eb',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
          }}
          shape="square"
        />
      );
    }

    return (
      <Avatar
        size={48}
        style={{
          backgroundColor: '#f0f0f0',
          border: '2px solid #e5e7eb',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
        }}
        shape="square"
      />
    );
  };

  // 分类选项
  const categoryOptions = [
    { label: '联盟旗帜', value: 'alliance_flag' },
    { label: '用户图案', value: 'user_pattern' },
    { label: '系统图案', value: 'system_pattern' },
    { label: '表情符号', value: 'emoji' },
    { label: '纯色', value: 'color' },
  ];

  // 类型选项
  const typeOptions = [
    { label: '材质', value: 'material' },
    { label: '表情', value: 'emoji' },
    { label: '颜色', value: 'color' },
    { label: '图片', value: 'image' },
  ];

  // 图案表格列定义
  const patternColumns: ColumnsType<PatternAsset> = [
    {
      title: '预览',
      key: 'preview',
      width: 80,
      render: (_, record) => renderPatternPreview(record)
    },
    {
      title: '图案信息',
      key: 'info',
      width: 200,
      render: (_, record) => (
        <div>
          <div style={{
            fontWeight: '600',
            color: '#1f2937',
            fontSize: '14px',
            marginBottom: '4px'
          }}>
            {record.name}
          </div>
          <div style={{
            color: '#6b7280',
            fontSize: '12px',
            marginBottom: '2px'
          }}>
            ID: {record.id}
          </div>
        </div>
      )
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (category) => getCategoryTag(category)
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (type) => (
        <Tag color="#1677ff" style={{ borderRadius: '12px', fontWeight: '500' }}>
          {type}
        </Tag>
      )
    },
    {
      title: '尺寸',
      key: 'dimensions',
      width: 100,
      render: (_, record) => (
        <span style={{ color: '#6b7280', fontSize: '13px' }}>
          {record.width && record.height ? `${record.width} x ${record.height}` : '-'}
        </span>
      )
    },
    {
      title: '使用次数',
      dataIndex: 'used_count',
      key: 'used_count',
      width: 90,
      render: (usedCount) => (
        <Badge count={usedCount || 0} showZero style={{ backgroundColor: '#1677ff' }} />
      ),
      sorter: (a, b) => (a.used_count || 0) - (b.used_count || 0)
    },
    {
      title: '公开',
      dataIndex: 'is_public',
      key: 'is_public',
      width: 80,
      render: (isPublic, record) => (
        <Switch
          checked={isPublic}
          onChange={(checked) => handleTogglePublic(record, checked)}
          size="small"
          checkedChildren="公开"
          unCheckedChildren="私有"
        />
      )
    },
    {
      title: '上架',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status, record) => (
        <Switch
          checked={status === 'active'}
          onChange={(checked) => handleToggleStatus(record, checked)}
          size="small"
          checkedChildren="上架"
          unCheckedChildren="下架"
        />
      )
    },
    {
      title: '创建者',
      key: 'creator',
      width: 120,
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Avatar size={24} icon={<UserOutlined />} />
          <span style={{ fontSize: '13px', color: '#6b7280' }}>
            {record.creator_name || `ID: ${record.creator_id?.slice(0, 8)}...`}
          </span>
        </div>
      )
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => viewPatternDetail(record)}
            style={{ color: '#1677ff' }}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            style={{ color: '#f59e0b' }}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
            style={{ color: '#ef4444' }}
          >
            删除
          </Button>
        </Space>
      )
    }
  ];

  // 初始加载
  useEffect(() => {
    loadPatterns();
  }, [current, pageSize]);

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
            <span style={{ color: 'white', fontSize: '20px' }}>🎨</span>
          </div>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: '28px',
              fontWeight: '700',
              color: '#1f2937',
              lineHeight: '1.2'
            }}>
              图案资源管理
            </h1>
            <p style={{
              margin: '4px 0 0 0',
              fontSize: '14px',
              color: '#6b7280',
              lineHeight: '1.4'
            }}>
              管理公共颜色、Emoji旗帜、图案资源的上架下架与编辑
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              createForm.resetFields();
              setCreateDrawerVisible(true);
            }}
            style={{ borderRadius: '6px', fontWeight: '500' }}
          >
            新建图案
          </Button>
          <Button
            icon={<UploadOutlined />}
            onClick={() => setBatchModalVisible(true)}
            style={{ borderRadius: '8px', fontWeight: '500' }}
          >
            批量导入
          </Button>
          {selectedRowKeys.length > 0 && (
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={handleBatchDelete}
              style={{ borderRadius: '8px', fontWeight: '500' }}
            >
              批量删除 ({selectedRowKeys.length})
            </Button>
          )}
          <Button
            icon={<ReloadOutlined />}
            onClick={handleReset}
            style={{ borderRadius: '8px', fontWeight: '500' }}
          >
            重置
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
              title="总图案数"
              value={stats.total}
              prefix={<PictureOutlined style={{ color: '#1677ff' }} />}
              valueStyle={{ color: '#1677ff' }}
            />
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>平台图案资源总量</p>
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
              title="已上架"
              value={stats.active}
              prefix={<CheckCircleOutlined style={{ color: '#10b981' }} />}
              valueStyle={{ color: '#10b981' }}
            />
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>当前上架状态图案</p>
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
              title="公开图案"
              value={stats.public}
              prefix={<FolderOutlined style={{ color: '#1677ff' }} />}
              valueStyle={{ color: '#1677ff' }}
            />
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>公开可用的图案</p>
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
              value={stats.todayAdded}
              prefix={<FireOutlined style={{ color: '#f59e0b' }} />}
              valueStyle={{ color: '#f59e0b' }}
            />
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>今日新增图案</p>
          </Card>
        </Col>
      </Row>

      {/* 搜索和筛选区域 */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '24px',
        border: '1px solid #f0f0f0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
      }}>
        <div style={{
          display: 'flex',
          gap: '16px',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <Input
            placeholder="搜索图案名称"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            style={{ width: 240, borderRadius: '8px' }}
            prefix={<SearchOutlined />}
            onPressEnter={handleSearch}
          />
          <Select
            placeholder="选择分类"
            value={filterCategory || undefined}
            onChange={setFilterCategory}
            style={{ width: 160, borderRadius: '8px' }}
            allowClear
          >
            {categoryOptions.map(opt => (
              <Option key={opt.value} value={opt.value}>{opt.label}</Option>
            ))}
          </Select>
          <Select
            placeholder="选择类型"
            value={filterType || undefined}
            onChange={setFilterType}
            style={{ width: 140, borderRadius: '8px' }}
            allowClear
          >
            {typeOptions.map(opt => (
              <Option key={opt.value} value={opt.value}>{opt.label}</Option>
            ))}
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

      {/* 主要内容区域 */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        border: '1px solid #f0f0f0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        padding: '24px'
      }}>
        <Table
          columns={patternColumns}
          dataSource={patterns}
          rowKey="id"
          loading={loading}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          pagination={{
            current,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 个图案`,
            pageSizeOptions: ['10', '20', '50', '100'],
            onChange: (page, size) => {
              setCurrent(page);
              setPageSize(size);
            }
          }}
          onChange={handleTableChange}
          style={{ borderRadius: '12px' }}
        />
      </div>

      <BatchImportModal
        open={batchModalVisible}
        onCancel={() => setBatchModalVisible(false)}
        onSuccess={() => {
          setBatchModalVisible(false);
          loadPatterns();
        }}
      />

      {/* 新建图案抽屉 */}
      <Drawer
        title="新建图案"
        width={600}
        open={createDrawerVisible}
        onClose={() => {
          setCreateDrawerVisible(false);
          createForm.resetFields();
        }}
        footer={
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setCreateDrawerVisible(false)}>取消</Button>
              <Button type="primary" onClick={() => createForm.submit()} style={{ borderRadius: '6px', fontWeight: '500' }}>
                确定创建
              </Button>
            </Space>
          </div>
        }
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreateSubmit} initialValues={{ is_public: true }}>
          <Form.Item name="name" label="图案名称" rules={[{ required: true, message: '请输入图案名称' }]}>
            <Input placeholder="请输入图案名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={3} placeholder="请输入描述" />
          </Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true, message: '请选择分类' }]}>
            <Select placeholder="请选择分类">
              {categoryOptions.map(opt => (
                <Option key={opt.value} value={opt.value}>{opt.label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true, message: '请选择类型' }]}>
            <Select placeholder="请选择类型">
              {typeOptions.map(opt => (
                <Option key={opt.value} value={opt.value}>{opt.label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="is_public" label="是否公开" valuePropName="checked">
            <Switch checkedChildren="公开" unCheckedChildren="私有" />
          </Form.Item>
        </Form>
      </Drawer>

      {/* 编辑图案抽屉 */}
      <Drawer
        title={`编辑图案 - ${selectedPattern?.name || ''}`}
        width={600}
        open={editDrawerVisible}
        onClose={() => {
          setEditDrawerVisible(false);
          setSelectedPattern(null);
          editForm.resetFields();
        }}
        footer={
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setEditDrawerVisible(false)}>取消</Button>
              <Button type="primary" onClick={() => editForm.submit()} style={{ borderRadius: '6px', fontWeight: '500' }}>
                保存修改
              </Button>
            </Space>
          </div>
        }
      >
        <Form form={editForm} layout="vertical" onFinish={handleEditSubmit}>
          <Form.Item name="name" label="图案名称" rules={[{ required: true, message: '请输入图案名称' }]}>
            <Input placeholder="请输入图案名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={3} placeholder="请输入描述" />
          </Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true, message: '请选择分类' }]}>
            <Select placeholder="请选择分类">
              {categoryOptions.map(opt => (
                <Option key={opt.value} value={opt.value}>{opt.label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true, message: '请选择类型' }]}>
            <Select placeholder="请选择类型">
              {typeOptions.map(opt => (
                <Option key={opt.value} value={opt.value}>{opt.label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="is_public" label="是否公开" valuePropName="checked">
            <Switch checkedChildren="公开" unCheckedChildren="私有" />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select placeholder="请选择状态">
              <Option value="active">已上架</Option>
              <Option value="inactive">已下架</Option>
            </Select>
          </Form.Item>
        </Form>
      </Drawer>

      {/* 图案详情模态框 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PictureOutlined />
            <span>图案详情 - {selectedPattern?.name}</span>
          </div>
        }
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={
          selectedPattern ? (
            <Space>
              <Button onClick={() => setDetailModalVisible(false)}>关闭</Button>
              <Button
                type="primary"
                icon={<EditOutlined />}
                onClick={() => {
                  setDetailModalVisible(false);
                  handleEdit(selectedPattern);
                }}
              >
                编辑
              </Button>
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={() => {
                  setDetailModalVisible(false);
                  handleDelete(selectedPattern);
                }}
              >
                删除
              </Button>
            </Space>
          ) : null
        }
        width={800}
      >
        {selectedPattern && (
          <div>
            <div style={{ marginBottom: '16px', textAlign: 'center' }}>
              {renderPatternPreview(selectedPattern)}
              {selectedPattern.thumbnail_url && (
                <div style={{ marginTop: '12px' }}>
                  <Image
                    width={200}
                    src={selectedPattern.thumbnail_url}
                    alt={selectedPattern.name}
                    style={{ borderRadius: '12px', border: '2px solid #e5e7eb' }}
                  />
                </div>
              )}
            </div>

            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="图案名称" span={2}>
                <span style={{ fontWeight: '600', color: '#1f2937' }}>{selectedPattern.name}</span>
              </Descriptions.Item>
              <Descriptions.Item label="图案ID" span={2}>
                <span style={{ color: '#6b7280', fontSize: '13px' }}>{selectedPattern.id}</span>
              </Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>
                {selectedPattern.description || '暂无描述'}
              </Descriptions.Item>
              <Descriptions.Item label="分类">{getCategoryTag(selectedPattern.category)}</Descriptions.Item>
              <Descriptions.Item label="类型">
                <Tag color="#6366f1" style={{ borderRadius: '12px', fontWeight: '500' }}>{selectedPattern.type}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="尺寸">
                {selectedPattern.width && selectedPattern.height ? `${selectedPattern.width} x ${selectedPattern.height}` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="文件大小">{formatFileSize(selectedPattern.file_size)}</Descriptions.Item>
              <Descriptions.Item label="使用次数">
                <Badge count={selectedPattern.used_count || 0} showZero style={{ backgroundColor: '#1677ff' }} />
              </Descriptions.Item>
              <Descriptions.Item label="公开性">
                <Tag color={selectedPattern.is_public ? '#10b981' : '#f59e0b'} style={{ borderRadius: '12px', fontWeight: '500' }}>
                  {selectedPattern.is_public ? '公开' : '私有'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">{getStatusTag(selectedPattern.status)}</Descriptions.Item>
              <Descriptions.Item label="创建者">
                {selectedPattern.creator_name || `ID: ${selectedPattern.creator_id?.slice(0, 8)}...`}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {new Date(selectedPattern.created_at).toLocaleString('zh-CN')}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {new Date(selectedPattern.updated_at).toLocaleString('zh-CN')}
              </Descriptions.Item>
            </Descriptions>

            {selectedPattern.data && (
              <div style={{ marginTop: '16px' }}>
                <h4 style={{ marginBottom: '12px', color: '#1f2937', fontWeight: '600' }}>数据预览：</h4>
                <div style={{
                  backgroundColor: '#f5f5f5',
                  padding: '16px',
                  borderRadius: '12px',
                  maxHeight: '200px',
                  overflow: 'auto',
                  fontSize: '12px',
                  fontFamily: 'monospace'
                }}>
                  <pre>
                    {JSON.stringify(selectedPattern.data, null, 2).substring(0, 500)}
                    {JSON.stringify(selectedPattern.data).length > 500 && '...'}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PatternAssets;
