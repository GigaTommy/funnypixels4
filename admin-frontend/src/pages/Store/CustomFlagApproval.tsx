import React, { useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Descriptions,
  Image,
  Input,
  Row,
  Col,
  Statistic,
  message,
  Form,
  Input as AntInput,
  DatePicker
} from 'antd';
import {
  SearchOutlined,
  EyeOutlined,
  CheckOutlined,
  CloseOutlined,
  FlagOutlined,
  UserOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { customFlagService } from '@/services';
import type { CustomFlagOrder, CustomFlagStats } from '@/services/customFlag';

const { TextArea } = AntInput;
const { RangePicker } = DatePicker;

const CustomFlagApproval: React.FC = () => {
  const [orders, setOrders] = useState<CustomFlagOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState<string>('pending');
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [approveModalVisible, setApproveModalVisible] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<CustomFlagOrder | null>(null);
  const [stats, setStats] = useState<CustomFlagStats>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    approvalRate: '0'
  });
  const [approveForm] = Form.useForm();
  const [rejectForm] = Form.useForm();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [batchRejectModalVisible, setBatchRejectModalVisible] = useState(false);
  const [batchRejectForm] = Form.useForm();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [applicantSearch, setApplicantSearch] = useState('');

  // 获取订单列表
  const fetchOrders = async (params: any = {}) => {
    setLoading(true);
    try {
      const queryParams = {
        current: params.current || pagination.current,
        pageSize: params.pageSize || pagination.pageSize,
        pattern_name: searchText || undefined,
        status: activeTab !== 'all' ? activeTab : undefined
      };

      const response = await customFlagService.getAllOrders(queryParams);
      let list = response.list || [];

      // Client-side filtering for date range
      if (dateRange && dateRange[0] && dateRange[1]) {
        const start = dateRange[0].startOf('day');
        const end = dateRange[1].endOf('day');
        list = list.filter((order: CustomFlagOrder) => {
          const orderDate = dayjs(order.created_at || order.submittedAt);
          return orderDate.isAfter(start) && orderDate.isBefore(end);
        });
      }

      // Client-side filtering for applicant name
      if (applicantSearch) {
        const search = applicantSearch.toLowerCase();
        list = list.filter((order: CustomFlagOrder) =>
          (order.applicantName || '').toLowerCase().includes(search)
        );
      }

      setOrders(list);
      setPagination({
        current: response.current,
        pageSize: response.pageSize,
        total: response.total
      });
    } catch (error) {
      message.error('获取订单列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取统计数据
  const fetchStats = async () => {
    try {
      const data = await customFlagService.getStats();
      setStats(data);
    } catch (error) {
      console.error('获取统计数据失败:', error);
    }
  };

  React.useEffect(() => {
    fetchOrders();
    fetchStats();
  }, [activeTab]);

  // 查看订单详情
  const handleViewDetail = async (record: CustomFlagOrder) => {
    try {
      const order = await customFlagService.getOrderDetail(record.id);
      // Merge list-level fields that the detail endpoint may not return
      setSelectedOrder({ ...record, ...order });
      setDetailModalVisible(true);
    } catch (error) {
      message.error('获取订单详情失败');
    }
  };

  // 批准订单
  const handleApprove = (record: CustomFlagOrder) => {
    setSelectedOrder(record);
    setApproveModalVisible(true);
    approveForm.resetFields();
  };

  const handleApproveSubmit = async () => {
    if (!selectedOrder) return;

    try {
      const values = await approveForm.validateFields();
      await customFlagService.approveOrder(selectedOrder.id, {
        notes: values.notes
      });

      message.success('自定义旗帜批准成功');
      setApproveModalVisible(false);
      fetchOrders();
      fetchStats();
    } catch (error) {
      message.error('批准失败');
    }
  };

  // 拒绝订单
  const handleReject = (record: CustomFlagOrder) => {
    setSelectedOrder(record);
    setRejectModalVisible(true);
    rejectForm.resetFields();
  };

  const handleRejectSubmit = async () => {
    if (!selectedOrder) return;

    try {
      const values = await rejectForm.validateFields();
      await customFlagService.rejectOrder(selectedOrder.id, {
        reason: values.reason
      });

      message.success('自定义旗帜拒绝成功');
      setRejectModalVisible(false);
      fetchOrders();
      fetchStats();
    } catch (error) {
      message.error('拒绝失败');
    }
  };

  // 批量批准
  const handleBatchApprove = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要批准的订单');
      return;
    }
    Modal.confirm({
      title: '批量批准',
      content: `确定要批准选中的 ${selectedRowKeys.length} 个自定义旗帜申请吗？`,
      okText: '确认批准',
      cancelText: '取消',
      onOk: async () => {
        try {
          await Promise.all(
            selectedRowKeys.map(id =>
              customFlagService.approveOrder(id as string, { notes: '批量审批通过' })
            )
          );
          message.success(`成功批准 ${selectedRowKeys.length} 个申请`);
          setSelectedRowKeys([]);
          fetchOrders();
          fetchStats();
        } catch (error) {
          message.error('批量批准失败');
        }
      },
    });
  };

  // 批量拒绝
  const handleBatchReject = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要拒绝的订单');
      return;
    }
    batchRejectForm.resetFields();
    setBatchRejectModalVisible(true);
  };

  const handleBatchRejectSubmit = async () => {
    try {
      const values = await batchRejectForm.validateFields();
      await Promise.all(
        selectedRowKeys.map(id =>
          customFlagService.rejectOrder(id as string, { reason: values.reason })
        )
      );
      message.success(`成功拒绝 ${selectedRowKeys.length} 个申请`);
      setSelectedRowKeys([]);
      setBatchRejectModalVisible(false);
      fetchOrders();
      fetchStats();
    } catch (error) {
      message.error('批量拒绝失败');
    }
  };

  // 搜索处理
  const handleSearch = (value: string) => {
    setSearchText(value);
    fetchOrders({ current: 1, keyword: value });
  };

  // 状态标签
  const getStatusTag = (status: string) => {
    const statusConfig: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
      pending: { color: 'orange', text: '待审核', icon: <ClockCircleOutlined /> },
      approved: { color: 'green', text: '已通过', icon: <CheckCircleOutlined /> },
      rejected: { color: 'red', text: '已拒绝', icon: <CloseCircleOutlined /> },
    };
    const config = statusConfig[status] || statusConfig.pending;
    return (
      <Tag color={config.color} style={{ fontWeight: '500', borderRadius: '4px', padding: '2px 8px' }}>
        {config.icon} <span style={{ marginLeft: 4 }}>{config.text}</span>
      </Tag>
    );
  };

  const columns: ColumnsType<CustomFlagOrder> = [
    {
      title: '订单ID',
      dataIndex: 'id',
      key: 'id',
      width: 220,
      ellipsis: true,
    },
    {
      title: '图案名称',
      dataIndex: 'pattern_name',
      key: 'pattern_name',
      render: (text: string, record: CustomFlagOrder) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{text}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>¥{record.price}</div>
        </div>
      )
    },
    {
      title: '申请人',
      dataIndex: 'applicantName',
      key: 'applicantName',
      render: (name: string, record: CustomFlagOrder) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <UserOutlined style={{ marginRight: '4px' }} />
            {name}
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            ID: {record.user_id?.substring(0, 8)}...
          </div>
        </div>
      )
    },
    {
      title: '图案描述',
      dataIndex: 'pattern_description',
      key: 'pattern_description',
      ellipsis: true,
      width: 200,
    },
    {
      title: '提交时间',
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      width: 180,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
      sorter: (a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime(),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => getStatusTag(status)
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record: CustomFlagOrder) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
            style={{ color: '#1890ff', fontWeight: '500' }}
          >
            详情
          </Button>
          {record.status === 'pending' && (
            <>
              <Button
                type="link"
                icon={<CheckOutlined />}
                onClick={() => handleApprove(record)}
                style={{ color: '#52c41a', fontWeight: '500' }}
              >
                批准
              </Button>
              <Button
                type="link"
                icon={<CloseOutlined />}
                onClick={() => handleReject(record)}
                style={{ color: '#ff4d4f', fontWeight: '500' }}
              >
                拒绝
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      {/* 页面标题区域 */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        padding: '24px',
        marginBottom: '24px',
        border: '1px solid #f0f0f0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
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
            <span style={{ color: 'white', fontSize: '20px' }}>🎌</span>
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '700', color: '#1f2937', lineHeight: '1.2' }}>
              自定义旗帜审批
            </h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#6b7280', lineHeight: '1.4' }}>
              审核用户提交的自定义旗帜申请，支持批量操作
            </p>
          </div>
        </div>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        {[
          { title: '总申请数', value: stats.total, color: '#6366f1', icon: <FlagOutlined />, desc: '自定义旗帜申请总量' },
          { title: '待审核', value: stats.pending, color: '#f59e0b', icon: <ClockCircleOutlined />, desc: '等待审核的申请' },
          { title: '已批准', value: stats.approved, color: '#10b981', icon: <CheckOutlined />, desc: '已批准的申请' },
          { title: '批准率', value: stats.approvalRate, color: '#8b5cf6', icon: <CheckOutlined />, desc: '申请通过率', suffix: '%' },
        ].map((item, index) => (
          <Col span={6} key={index}>
            <Card style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #f0f0f0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
            }}>
              <Statistic
                title={item.title}
                value={item.value}
                suffix={item.suffix}
                prefix={React.cloneElement(item.icon, { style: { color: item.color } })}
                valueStyle={{ color: item.color }}
              />
              <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{item.desc}</p>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Tab 切换 + 批量操作 */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '24px',
        border: '1px solid #f0f0f0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[
              { key: 'all', label: '全部', count: stats.total, color: '#6366f1', bgColor: '#ede9fe' },
              { key: 'pending', label: '待审核', count: stats.pending, color: '#f59e0b', bgColor: '#fef3c7' },
              { key: 'approved', label: '已通过', count: stats.approved, color: '#10b981', bgColor: '#d1fae5' },
              { key: 'rejected', label: '已拒绝', count: stats.rejected, color: '#ef4444', bgColor: '#fee2e2' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setSelectedRowKeys([]); }}
                style={{
                  padding: '10px 18px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: activeTab === tab.key ? tab.bgColor : 'transparent',
                  color: activeTab === tab.key ? tab.color : '#6b7280',
                  fontSize: '14px',
                  fontWeight: activeTab === tab.key ? '600' : '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>{tab.label}</span>
                <span style={{
                  backgroundColor: activeTab === tab.key ? 'rgba(255,255,255,0.8)' : '#e5e7eb',
                  color: activeTab === tab.key ? tab.color : '#6b7280',
                  fontSize: '12px',
                  fontWeight: '600',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                }}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
          {activeTab === 'pending' && selectedRowKeys.length > 0 && (
            <Space>
              <Button
                type="primary"
                icon={<CheckOutlined />}
                onClick={handleBatchApprove}
                style={{ backgroundColor: '#10b981', borderColor: '#10b981', borderRadius: '8px' }}
              >
                批量批准 ({selectedRowKeys.length})
              </Button>
              <Button
                danger
                icon={<CloseOutlined />}
                onClick={handleBatchReject}
                style={{ borderRadius: '8px' }}
              >
                批量拒绝 ({selectedRowKeys.length})
              </Button>
            </Space>
          )}
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Input.Search
            placeholder="搜索图案名称"
            allowClear
            enterButton={<SearchOutlined />}
            onSearch={handleSearch}
            onChange={(e) => { if (!e.target.value) handleSearch(''); }}
            style={{ width: 280, borderRadius: '8px' }}
          />
          <Input.Search
            placeholder="搜索申请人"
            allowClear
            prefix={<UserOutlined />}
            onSearch={(value) => { setApplicantSearch(value); }}
            onChange={(e) => { if (!e.target.value) setApplicantSearch(''); }}
            style={{ width: 200, borderRadius: '8px' }}
          />
          <RangePicker
            onChange={(dates) => {
              setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null);
            }}
            style={{ borderRadius: '8px' }}
          />
          <Button icon={<SearchOutlined />} onClick={() => fetchOrders()} style={{ borderRadius: '8px', fontWeight: '500' }}>
            刷新
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
          columns={columns}
          dataSource={orders}
          rowKey="id"
          loading={loading}
          rowSelection={activeTab === 'pending' ? {
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          } : undefined}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条/共 ${total} 条`,
            onChange: (page, pageSize) => {
              fetchOrders({ current: page, pageSize });
            },
          }}
          scroll={{ x: 1000 }}
        />
      </div>

      {/* 订单详情弹窗 */}
      <Modal
        title="自定义旗帜订单详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[<Button key="close" onClick={() => setDetailModalVisible(false)}>关闭</Button>]}
        width={800}
      >
        {selectedOrder && (
          <Descriptions column={2} bordered>
            <Descriptions.Item label="订单ID" span={2}>{selectedOrder.id}</Descriptions.Item>
            <Descriptions.Item label="图案名称" span={2}>{selectedOrder.pattern_name}</Descriptions.Item>
            <Descriptions.Item label="图案描述" span={2}>{selectedOrder.pattern_description || '-'}</Descriptions.Item>
            <Descriptions.Item label="申请人">{selectedOrder.applicantName}</Descriptions.Item>
            <Descriptions.Item label="用户ID">{selectedOrder.user_id}</Descriptions.Item>
            <Descriptions.Item label="价格">¥{selectedOrder.price}</Descriptions.Item>
            <Descriptions.Item label="状态">{getStatusTag(selectedOrder.status)}</Descriptions.Item>
            <Descriptions.Item label="提交时间">{dayjs(selectedOrder.submittedAt || selectedOrder.created_at).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
            <Descriptions.Item label="处理时间">
              {selectedOrder.processed_at ? dayjs(selectedOrder.processed_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="处理人" span={2}>
              {selectedOrder.processedByName || '-'}
            </Descriptions.Item>
            {selectedOrder.admin_notes && (
              <Descriptions.Item label={selectedOrder.status === 'rejected' ? '拒绝原因' : '管理员备注'} span={2}>
                <div style={{
                  padding: '8px 12px',
                  backgroundColor: selectedOrder.status === 'rejected' ? '#fff2f0' : '#f6ffed',
                  borderRadius: '4px',
                  border: `1px solid ${selectedOrder.status === 'rejected' ? '#ffccc7' : '#b7eb8f'}`,
                  whiteSpace: 'pre-wrap'
                }}>
                  {selectedOrder.admin_notes}
                </div>
              </Descriptions.Item>
            )}
            <Descriptions.Item label="原图" span={2}>
              <Image
                width={300}
                src={selectedOrder.original_image_url?.startsWith('data:image')
                  ? selectedOrder.original_image_url
                  : `data:image/png;base64,${selectedOrder.original_image_url}`}
                alt="自定义旗帜原图"
                style={{ maxWidth: '100%', maxHeight: '300px', objectFit: 'contain' }}
              />
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* 批准弹窗 - 备注改为选填 */}
      <Modal
        title="批准自定义旗帜"
        open={approveModalVisible}
        onOk={handleApproveSubmit}
        onCancel={() => setApproveModalVisible(false)}
        okText="确认批准"
        cancelText="取消"
      >
        <Form form={approveForm} layout="vertical">
          <Form.Item label="批准备注（选填）" name="notes">
            <TextArea rows={4} placeholder="请输入批准原因或备注..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* 拒绝弹窗 */}
      <Modal
        title="拒绝自定义旗帜"
        open={rejectModalVisible}
        onOk={handleRejectSubmit}
        onCancel={() => setRejectModalVisible(false)}
        okText="确认拒绝"
        cancelText="取消"
      >
        <Form form={rejectForm} layout="vertical">
          <Form.Item label="拒绝原因" name="reason" rules={[{ required: true, message: '请输入拒绝原因' }]}>
            <TextArea rows={4} placeholder="请输入拒绝原因..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* 批量拒绝弹窗 */}
      <Modal
        title={`批量拒绝 ${selectedRowKeys.length} 个申请`}
        open={batchRejectModalVisible}
        onOk={handleBatchRejectSubmit}
        onCancel={() => setBatchRejectModalVisible(false)}
        okText="确认拒绝"
        okType="danger"
        cancelText="取消"
      >
        <Form form={batchRejectForm} layout="vertical">
          <Form.Item label="拒绝原因" name="reason" rules={[{ required: true, message: '请输入拒绝原因' }]}>
            <TextArea rows={4} placeholder="请输入统一的拒绝原因..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CustomFlagApproval;
