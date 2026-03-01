import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Select,
  DatePicker,
  Spin,
  message,
  Table,
  Tag,
  Progress
} from 'antd';
import {
  UserOutlined,
  PictureOutlined,
  ShoppingCartOutlined,
  DollarOutlined,
  TrophyOutlined,
  FlagOutlined,
  RiseOutlined,
  FallOutlined,
  ShopOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import {
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts';
import { api } from '../../utils/api';

const { Option } = Select;
const { RangePicker } = DatePicker;

interface ComprehensiveStats {
  period: string;
  startDate: string;
  endDate: string;
  users: {
    total: number;
    new: number;
    active: number;
    banned: number;
  };
  pixels: {
    total: number;
    new: number;
  };
  orders: {
    total: {
      advertisement: number;
      customFlag: number;
      recharge: number;
    };
    revenue: {
      advertisement: number;
      customFlag: number;
      recharge: number;
    };
  };
  advertisements: {
    pending: number;
    approved: number;
    rejected: number;
    total: number;
    approvalRate: string;
  };
  customFlags: {
    pending: number;
    approved: number;
    rejected: number;
    total: number;
    approvalRate: string;
  };
  revenue: {
    recharge: {
      total: number;
      count: number;
    };
    orders: {
      advertisement: number;
      customFlag: number;
    };
    total: number;
  };
}

interface TrendData {
  date: string;
  count: number;
  total: number;
}

interface PopularProduct {
  id: string;
  name: string;
  price: number;
  orderCount: number;
  totalRevenue: number;
  type: string;
}

const AnalyticsDashboard: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState('7d');
  const [stats, setStats] = useState<ComprehensiveStats | null>(null);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [popularProducts, setPopularProducts] = useState<PopularProduct[]>([]);
  const [trendType, setTrendType] = useState('orders');

  // 获取综合统计数据
  const fetchComprehensiveStats = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/stats/comprehensive', {
        params: { period }
      });

      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      message.error('获取统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取趋势数据
  const fetchTrendData = async () => {
    try {
      const response = await api.get('/admin/stats/trends', {
        params: { period, type: trendType }
      });

      if (response.data.success) {
        setTrendData(response.data.data.trendData);
      }
    } catch (error) {
      message.error('获取趋势数据失败');
    }
  };

  // 获取热门商品
  const fetchPopularProducts = async () => {
    try {
      const response = await api.get('/admin/stats/popular-products', {
        params: { period, limit: 10 }
      });

      if (response.data.success) {
        setPopularProducts(response.data.data.popularAds);
      }
    } catch (error) {
      message.error('获取热门商品失败');
    }
  };

  useEffect(() => {
    fetchComprehensiveStats();
    fetchTrendData();
    fetchPopularProducts();
  }, [period, trendType]);

  // 订单类型饼图数据
  const orderTypeData = stats ? [
    { name: '广告订单', value: stats.orders.total.advertisement, color: '#1890ff' },
    { name: '自定义旗帜', value: stats.orders.total.customFlag, color: '#52c41a' },
    { name: '充值订单', value: stats.orders.total.recharge, color: '#faad14' }
  ] : [];

  // 收入来源饼图数据
  const revenueData = stats ? [
    { name: '充值收入', value: stats.revenue.recharge.total, color: '#722ed1' },
    { name: '广告订单', value: stats.revenue.orders.advertisement, color: '#eb2f96' },
    { name: '自定义旗帜', value: stats.revenue.orders.customFlag, color: '#13c2c2' }
  ] : [];

  // 广告审批状态数据
  const adStatusData = stats ? [
    { name: '待审批', value: stats.advertisements.pending, color: '#faad14' },
    { name: '已批准', value: stats.advertisements.approved, color: '#52c41a' },
    { name: '已拒绝', value: stats.advertisements.rejected, color: '#f5222d' }
  ] : [];

  // 热门商品表格列
  const productColumns: ColumnsType<PopularProduct> = [
    {
      title: '商品名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <div style={{ fontWeight: 'bold' }}>{text}</div>
    },
    {
      title: '价格',
      dataIndex: 'price',
      key: 'price',
      render: (price: number) => <span style={{ color: '#1890ff' }}>{price} 积分</span>
    },
    {
      title: '订单数量',
      dataIndex: 'orderCount',
      key: 'orderCount',
      sorter: (a, b) => a.orderCount - b.orderCount,
    },
    {
      title: '总收入',
      dataIndex: 'totalRevenue',
      key: 'totalRevenue',
      render: (revenue: number) => <span style={{ color: '#52c41a', fontWeight: 'bold' }}>{revenue} 积分</span>,
      sorter: (a, b) => a.totalRevenue - b.totalRevenue,
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      {/* 顶部控制栏 */}
      <Card style={{ marginBottom: '24px' }}>
        <Row gutter={16} align="middle">
          <Col span={4}>
            <Select
              style={{ width: '100%' }}
              value={period}
              onChange={setPeriod}
            >
              <Option value="1d">最近1天</Option>
              <Option value="7d">最近7天</Option>
              <Option value="30d">最近30天</Option>
              <Option value="90d">最近90天</Option>
            </Select>
          </Col>
          <Col span={4}>
            <Select
              style={{ width: '100%' }}
              value={trendType}
              onChange={setTrendType}
            >
              <Option value="orders">订单趋势</Option>
              <Option value="revenue">收入趋势</Option>
              <Option value="users">用户增长</Option>
              <Option value="pixels">像素增长</Option>
            </Select>
          </Col>
        </Row>
      </Card>

      <Spin spinning={loading}>
        {stats && (
          <>
            {/* 核心统计卡片 */}
            <Row gutter={16} style={{ marginBottom: '24px' }}>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="总用户数"
                    value={stats.users.total}
                    prefix={<UserOutlined />}
                    valueStyle={{ color: '#1890ff' }}
                    suffix={
                      <span style={{ fontSize: '14px', color: '#666' }}>
                        新增: {stats.users.new}
                      </span>
                    }
                  />
                  <div style={{ marginTop: '8px' }}>
                    <Progress
                      percent={Math.round((stats.users.active / stats.users.total) * 100)}
                      size="small"
                      status="active"
                      format={() => `活跃率: ${Math.round((stats.users.active / stats.users.total) * 100)}%`}
                    />
                  </div>
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="总像素数"
                    value={stats.pixels.total}
                    prefix={<PictureOutlined />}
                    valueStyle={{ color: '#52c41a' }}
                    suffix={
                      <span style={{ fontSize: '14px', color: '#666' }}>
                        新增: {stats.pixels.new}
                      </span>
                    }
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="总收入"
                    value={stats.revenue.total}
                    prefix={<DollarOutlined />}
                    precision={2}
                    valueStyle={{ color: '#faad14' }}
                    suffix="元"
                  />
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                    充值: {stats.revenue.recharge.count}笔
                  </div>
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="总订单数"
                    value={stats.orders.total.advertisement + stats.orders.total.customFlag + stats.orders.total.recharge}
                    prefix={<ShoppingCartOutlined />}
                    valueStyle={{ color: '#722ed1' }}
                  />
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                    待处理: {stats.advertisements.pending + stats.customFlags.pending}
                  </div>
                </Card>
              </Col>
            </Row>

            {/* 订单和审批统计 */}
            <Row gutter={16} style={{ marginBottom: '24px' }}>
              <Col span={8}>
                <Card title="订单分布" extra={<ShopOutlined />}>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={orderTypeData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {orderTypeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`${value} 单`, '订单数']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
              <Col span={8}>
                <Card title="收入分布" extra={<DollarOutlined />}>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={revenueData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {revenueData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`¥${value.toFixed(2)}`, '收入']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
              <Col span={8}>
                <Card title="广告审批状态" extra={<FlagOutlined />}>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={adStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {adStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`${value} 单`, '订单数']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ textAlign: 'center', marginTop: '8px' }}>
                    <Tag color="green">批准率: {stats.advertisements.approvalRate}%</Tag>
                  </div>
                </Card>
              </Col>
            </Row>

            {/* 趋势图 */}
            <Row gutter={16} style={{ marginBottom: '24px' }}>
              <Col span={24}>
                <Card title={`${trendType === 'orders' ? '订单' : trendType === 'revenue' ? '收入' : trendType === 'users' ? '用户' : '像素'}趋势图`}>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(value: string) => dayjs(value).format('MM-DD')}
                      />
                      <YAxis />
                      <Tooltip
                        labelFormatter={(value: string) => dayjs(value).format('YYYY-MM-DD')}
                        formatter={(value: number, name: string) => [
                          name === 'count' ? `${value} 单` : `¥${value}`,
                          name === 'count' ? '数量' : '金额'
                        ]}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#1890ff"
                        name="数量"
                        strokeWidth={2}
                      />
                      {trendType === 'revenue' && (
                        <Line
                          type="monotone"
                          dataKey="total"
                          stroke="#52c41a"
                          name="金额"
                          strokeWidth={2}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
            </Row>

            {/* 热门商品 */}
            <Row gutter={16}>
              <Col span={24}>
                <Card title="热门商品排行" extra={<TrophyOutlined />}>
                  <Table
                    columns={productColumns}
                    dataSource={popularProducts}
                    rowKey="id"
                    pagination={false}
                    size="small"
                  />
                </Card>
              </Col>
            </Row>
          </>
        )}
      </Spin>
    </div>
  );
};

export default AnalyticsDashboard;