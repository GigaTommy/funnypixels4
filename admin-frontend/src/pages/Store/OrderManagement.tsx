import React, { useState, useRef } from 'react';
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
  Select,
  DatePicker,
  Row,
  Col,
  Statistic,
  message,
  Tabs
} from 'antd';
import {
  SearchOutlined,
  EyeOutlined,
  EditOutlined,
  DollarOutlined,
  ShopOutlined,
  FlagOutlined,
  CreditCardOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { api } from '../../utils/api';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { TextArea } = Input;

interface StoreOrder {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: string;
  price: number;
  product_name: string;
  width?: number;
  height?: number;
  order_type: 'advertisement' | 'custom_flag' | 'recharge';
  user_username: string;
  user_nickname: string;
  created_at: string;
  updated_at: string;
  processed_at?: string;
  admin_notes?: string;
  original_image_url?: string;
  pattern_name?: string;
  pattern_description?: string;
  ad_title?: string;
  ad_description?: string;
  ad_url?: string;
  ad_image_url?: string;
}

interface StoreOrderStats {
  total: number;
  advertisement: number;
  customFlag: number;
  recharge: number;
  pending: number;
  approved: number;
  rejected: number;
  totalRevenue: number;
}

const OrderManagement: React.FC = () => {
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [filters, setFilters] = useState({
    order_type: undefined,
    status: undefined,
    user_id: '',
    keyword: '',
    dateRange: undefined as any
  });
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<StoreOrder | null>(null);
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [updateForm, setUpdateForm] = useState({
    status: '',
    admin_notes: ''
  });
  const [stats, setStats] = useState<StoreOrderStats>({
    total: 0,
    advertisement: 0,
    customFlag: 0,
    recharge: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    totalRevenue: 0
  });

  const searchInputRef = useRef<any>(null);

  // 获取订单列表
  const fetchOrders = async (params: any = {}) => {
    setLoading(true);
    try {
      const queryParams: any = {
        current: params.current || pagination.current,
        pageSize: params.pageSize || pagination.pageSize
      };

      if (filters.order_type) queryParams.order_type = filters.order_type;
      if (filters.status) queryParams.status = filters.status;
      if (filters.user_id) queryParams.user_id = filters.user_id;
      if (filters.keyword) queryParams.keyword = filters.keyword;
      if (filters.dateRange && filters.dateRange.length === 2) {
        queryParams.start_date = filters.dateRange[0].toISOString();
        queryParams.end_date = filters.dateRange[1].toISOString();
      }

      const response = await api.get('/admin/store-orders', { params: queryParams });

      if (response.data.success) {
        setOrders(response.data.data.list);
        setPagination({
          current: response.data.data.current,
          pageSize: response.data.data.pageSize,
          total: response.data.data.total
        });
      }
    } catch (error) {
      message.error('获取订单列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取统计数据
  const fetchStats = async () => {
    try {
      const response = await api.get('/admin/stats/comprehensive', {
        params: { period: '30d' }
      });

      if (response.data.success) {
        const data = response.data.data;
        setStats({
          total: data.orders.total.advertisement + data.orders.total.customFlag + data.orders.total.recharge,
          advertisement: data.orders.total.advertisement,
          customFlag: data.orders.total.customFlag,
          recharge: data.orders.total.recharge,
          pending: data.advertisements.pending + data.customFlags.pending,
          approved: data.advertisements.approved + data.customFlags.approved,
          rejected: data.advertisements.rejected + data.customFlags.rejected,
          totalRevenue: data.revenue.total
        });
      }
    } catch (error) {
      console.error('获取统计数据失败:', error);
    }
  };

  React.useEffect(() => {
    fetchOrders();
    fetchStats();
  }, []);

  // 查看订单详情
  const handleViewDetail = async (record: StoreOrder) => {
    try {
      const response = await api.get(`/admin/store-orders/${record.id}`, {
        params: { order_type: record.order_type }
      });

      if (response.data.success) {
        setSelectedOrder(response.data.data);
        setDetailModalVisible(true);
      }
    } catch (error) {
      message.error('获取订单详情失败');
    }
  };

  // 更新订单状态
  const handleUpdateStatus = (record: StoreOrder) => {
    setSelectedOrder(record);
    setUpdateForm({
      status: record.status,
      admin_notes: record.admin_notes || ''
    });
    setUpdateModalVisible(true);
  };

  // 提交状态更新
  const handleUpdateSubmit = async () => {
    if (!selectedOrder) return;

    try {
      const response = await api.put(
        `/admin/store-orders/${selectedOrder.id}/status`,
        {
          order_type: selectedOrder.order_type,
          status: updateForm.status,
          admin_notes: updateForm.admin_notes
        }
      );

      if (response.data.success) {
        message.success('订单状态更新成功');
        setUpdateModalVisible(false);
        fetchOrders();
        fetchStats();
      }
    } catch (error) {
      message.error('更新订单状态失败');
    }
  };

  // 获取状态标签颜色
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'orange',
      approved: 'green',
      rejected: 'red',
      paid: 'blue',
      processing: 'cyan',
      completed: 'purple',
      cancelled: 'default'
    };
    return colors[status] || 'default';
  };

  // 获取订单类型图标
  const getOrderTypeIcon = (orderType: string) => {
    const icons: Record<string, React.ReactNode> = {
      advertisement: <ShopOutlined />,
      custom_flag: <FlagOutlined />,
      recharge: <CreditCardOutlined />
    };
    return icons[orderType] || <ShopOutlined />;
  };

  // 获取订单类型名称
  const getOrderTypeName = (orderType: string) => {
    const names: Record<string, string> = {
      advertisement: '广告订单',
      custom_flag: '自定义旗帜',
      recharge: '充值订单'
    };
    return names[orderType] || '未知类型';
  };

  const columns: ColumnsType<StoreOrder> = [
    {
      title: '订单ID',
      dataIndex: 'id',
      key: 'id',
      width: 220,
      ellipsis: true,
    },
    {
      title: '类型',
      dataIndex: 'order_type',
      key: 'order_type',
      width: 120,
      render: (type: string) => (
        <Space>
          {getOrderTypeIcon(type)}
          <span>{getOrderTypeName(type)}</span>
        </Space>
      ),
      filters: [
        { text: '广告订单', value: 'advertisement' },
        { text: '自定义旗帜', value: 'custom_flag' },
        { text: '充值订单', value: 'recharge' }
      ],
      onFilter: (value, record) => record.order_type === value,
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (text: string, record: StoreOrder) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{text}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {record.product_name}
          </div>
        </div>
      )
    },
    {
      title: '用户',
      dataIndex: 'user_nickname',
      key: 'user_nickname',
      render: (nickname: string, record: StoreOrder) => (
        <div>
          <div>{nickname || record.user_username}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            ID: {record.user_id.substring(0, 8)}...
          </div>
        </div>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {status === 'pending' ? '待处理' :
            status === 'approved' ? '已批准' :
              status === 'rejected' ? '已拒绝' :
                status === 'paid' ? '已支付' :
                  status === 'processing' ? '处理中' :
                    status === 'completed' ? '已完成' :
                      status === 'cancelled' ? '已取消' : status}
        </Tag>
      ),
      filters: [
        { text: '待处理', value: 'pending' },
        { text: '已批准', value: 'approved' },
        { text: '已拒绝', value: 'rejected' },
        { text: '已支付', value: 'paid' },
        { text: '处理中', value: 'processing' },
        { text: '已完成', value: 'completed' },
        { text: '已取消', value: 'cancelled' }
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: '金额',
      dataIndex: 'price',
      key: 'price',
      width: 100,
      render: (price: number, record: StoreOrder) => (
        <div>
          <div style={{ fontWeight: 'bold', color: '#1890ff' }}>
            {record.order_type === 'recharge' ? '¥' : ''}{price}
          </div>
          {record.width && record.height && (
            <div style={{ fontSize: '12px', color: '#666' }}>
              {record.width}×{record.height}
            </div>
          )}
        </div>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record: StoreOrder) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
          {record.status === 'pending' && (
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => handleUpdateStatus(record)}
            >
              处理
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总订单数"
              value={stats.total}
              prefix={<ShopOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待处理"
              value={stats.pending}
              prefix={<EditOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已批准"
              value={stats.approved}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总收入"
              value={stats.totalRevenue}
              prefix="¥"
              precision={2}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 主要内容卡片 */}
      <Card>
        <div style={{ marginBottom: '16px' }}>
          <Row gutter={16}>
            <Col span={4}>
              <Select
                placeholder="订单类型"
                allowClear
                style={{ width: '100%' }}
                onChange={(value) => {
                  setFilters({ ...filters, order_type: value });
                }}
              >
                <Option value="advertisement">广告订单</Option>
                <Option value="custom_flag">自定义旗帜</Option>
                <Option value="recharge">充值订单</Option>
              </Select>
            </Col>
            <Col span={4}>
              <Select
                placeholder="订单状态"
                allowClear
                style={{ width: '100%' }}
                onChange={(value) => {
                  setFilters({ ...filters, status: value });
                }}
              >
                <Option value="pending">待处理</Option>
                <Option value="approved">已批准</Option>
                <Option value="rejected">已拒绝</Option>
                <Option value="paid">已支付</Option>
                <Option value="processing">处理中</Option>
                <Option value="completed">已完成</Option>
                <Option value="cancelled">已取消</Option>
              </Select>
            </Col>
            <Col span={6}>
              <Input
                placeholder="搜索关键词"
                ref={searchInputRef}
                onPressEnter={() => fetchOrders()}
                onChange={(e) => {
                  setFilters({ ...filters, keyword: e.target.value });
                }}
                suffix={<SearchOutlined />}
              />
            </Col>
            <Col span={6}>
              <RangePicker
                style={{ width: '100%' }}
                onChange={(dates) => {
                  setFilters({ ...filters, dateRange: dates });
                }}
                placeholder={['开始日期', '结束日期']}
              />
            </Col>
            <Col span={4}>
              <Button
                type="primary"
                icon={<SearchOutlined />}
                onClick={() => fetchOrders()}
                style={{ width: '100%' }}
              >
                搜索
              </Button>
            </Col>
          </Row>
        </div>

        <Table
          columns={columns}
          dataSource={orders}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `第 ${range[0]}-${range[1]} 条/共 ${total} 条`,
            onChange: (page, pageSize) => {
              fetchOrders({ current: page, pageSize });
            },
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* 订单详情弹窗 */}
      <Modal
        title="订单详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={800}
      >
        {selectedOrder && (
          <Descriptions column={2} bordered>
            <Descriptions.Item label="订单ID" span={2}>
              {selectedOrder.id}
            </Descriptions.Item>
            <Descriptions.Item label="订单类型">
              <Space>
                {getOrderTypeIcon(selectedOrder.order_type)}
                {getOrderTypeName(selectedOrder.order_type)}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="订单状态">
              <Tag color={getStatusColor(selectedOrder.status)}>
                {selectedOrder.status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="商品名称" span={2}>
              {selectedOrder.title}
            </Descriptions.Item>
            <Descriptions.Item label="商品描述" span={2}>
              {selectedOrder.description}
            </Descriptions.Item>
            <Descriptions.Item label="用户名">
              {selectedOrder.user_nickname || selectedOrder.user_username}
            </Descriptions.Item>
            <Descriptions.Item label="用户ID">
              {selectedOrder.user_id}
            </Descriptions.Item>
            <Descriptions.Item label="金额">
              {selectedOrder.order_type === 'recharge' ? '¥' : ''}{selectedOrder.price}
            </Descriptions.Item>
            <Descriptions.Item label="商品规格">
              {selectedOrder.width && selectedOrder.height
                ? `${selectedOrder.width}×${selectedOrder.height}`
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {dayjs(selectedOrder.created_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="更新时间">
              {dayjs(selectedOrder.updated_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            {selectedOrder.processed_at && (
              <Descriptions.Item label="处理时间">
                {dayjs(selectedOrder.processed_at).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
            )}
            {selectedOrder.original_image_url && (
              <Descriptions.Item label="图片" span={2}>
                <Image
                  width={200}
                  src={selectedOrder.original_image_url}
                  alt="订单图片"
                />
              </Descriptions.Item>
            )}
            {selectedOrder.admin_notes && (
              <Descriptions.Item label="管理员备注" span={2}>
                {selectedOrder.admin_notes}
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>

      {/* 更新订单状态弹窗 */}
      <Modal
        title="处理订单"
        open={updateModalVisible}
        onOk={handleUpdateSubmit}
        onCancel={() => setUpdateModalVisible(false)}
        okText="确认"
        cancelText="取消"
      >
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px' }}>
            订单状态：
          </label>
          <Select
            style={{ width: '100%' }}
            value={updateForm.status}
            onChange={(value) => setUpdateForm({ ...updateForm, status: value })}
          >
            <Option value="approved">批准</Option>
            <Option value="rejected">拒绝</Option>
            <Option value="processing">处理中</Option>
            <Option value="completed">已完成</Option>
            <Option value="cancelled">已取消</Option>
          </Select>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '8px' }}>
            管理员备注：
          </label>
          <Input.TextArea
            rows={4}
            value={updateForm.admin_notes}
            onChange={(e) => setUpdateForm({ ...updateForm, admin_notes: e.target.value })}
            placeholder="请输入处理备注..."
          />
        </div>
      </Modal>
    </div>
  );
};

export default OrderManagement;