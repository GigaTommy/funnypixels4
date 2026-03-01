import React, { useState, useEffect } from 'react'
import {
  Card,
  Row,
  Col,
  Statistic,
  Select,
  DatePicker,
  Spin,
  Button,
  Table,
  Tag,
  Progress,
  message
} from 'antd'
import {
  DollarOutlined,
  RiseOutlined,
  FallOutlined,
  ShoppingCartOutlined,
  GiftOutlined,
  TrophyOutlined
} from '@ant-design/icons'
import { analyticsService } from '@/services'
import type { RevenueAnalytics } from '@/types'
import { Line, Pie } from '@ant-design/charts'
import type { RangePickerProps } from 'antd/es/date-picker'

const { RangePicker } = DatePicker
const { Option } = Select

const RevenueAnalytics: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState<RevenueAnalytics | null>(null)
  const [dateRange, setDateRange] = useState<[string, string] | null>(null)

  // 获取收入分析数据
  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const response = await analyticsService.revenueAnalytics.getRevenueAnalytics({
        start_date: dateRange?.[0] || '',
        end_date: dateRange?.[1] || ''
      })
      setAnalytics(response)
    } catch (error) {
      console.error('Get revenue analytics failed:', error)
      message.error('获取收入分析数据失败')
    } finally {
      setLoading(false)
    }
  }

  // 初始化加载
  useEffect(() => {
    fetchAnalytics()
  }, [])

  const handleDateRangeChange: RangePickerProps['onChange'] = (dates, dateStrings) => {
    if (dateStrings && dateStrings[0] && dateStrings[1]) {
      setDateRange([dateStrings[0], dateStrings[1]])
      fetchAnalytics()
    }
  }

  // 月度收入趋势图表数据
  // 月度收入趋势图表数据
  const monthlyRevenueData = analytics?.monthly_revenue ? analytics.monthly_revenue.map(item => ({
    month: item.month,
    revenue: item.revenue,
  })) : []

  // 收入来源分布图表数据
  const revenueSourceData = analytics?.revenue_by_source ? analytics.revenue_by_source.map(item => ({
    type: item.source,
    value: item.amount,
    percentage: item.percentage,
  })) : []

  // 月度收入趋势图表配置
  const monthlyRevenueConfig = {
    data: monthlyRevenueData,
    xField: 'month',
    yField: 'revenue',
    smooth: true,
    color: '#1677ff',
    point: {
      size: 5,
      shape: 'diamond',
    },
    tooltip: {
      formatter: (data: any) => ({
        name: '收入',
        value: `¥${data.revenue.toLocaleString()}`,
      }),
    },
    annotations: [
      {
        type: 'line',
        start: ['min', 'median'],
        end: ['max', 'median'],
        style: {
          stroke: '#F4664A',
          lineDash: [2, 2],
        },
      },
    ],
  }

  // 收入来源分布图表配置
  const revenueSourceConfig = {
    data: revenueSourceData,
    angleField: 'value',
    colorField: 'type',
    radius: 0.8,
    label: {
      type: 'outer',
      content: '{name} {percentage}',
    },
    interactions: [{ type: 'pie-legend-active' }, { type: 'element-active' }],
    color: ['#1677ff', '#10b981', '#f59e0b', '#ef4444', '#0958d9'],
  }

  // 收入来源表格列配置
  const sourceColumns = [
    {
      title: '收入来源',
      dataIndex: 'source',
      key: 'source',
      render: (text: string) => {
        const sourceColors: Record<string, string> = {
          '商品销售': '#1677ff',
          '会员订阅': '#10b981',
          '广告收入': '#f59e0b',
          '其他收入': '#0958d9',
        }
        return (
          <Tag color={sourceColors[text] || '#6b7280'} style={{ borderRadius: '12px' }}>
            {text}
          </Tag>
        )
      },
    },
    {
      title: '收入金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (text: number) => (
        <span style={{ color: '#10b981', fontWeight: '600', fontSize: '16px' }}>
          ¥{text.toLocaleString()}
        </span>
      ),
      sorter: (a: any, b: any) => a.amount - b.amount,
    },
    {
      title: '占比',
      dataIndex: 'percentage',
      key: 'percentage',
      render: (text: number) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Progress
            percent={text}
            size="small"
            style={{ width: '60px' }}
            strokeColor="#1677ff"
          />
          <span style={{ color: '#6b7280', fontSize: '14px' }}>{text}%</span>
        </div>
      ),
    },
  ]

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
            <span style={{
              color: 'white',
              fontSize: '20px'
            }}>💰</span>
          </div>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: '28px',
              fontWeight: '700',
              color: '#1f2937',
              lineHeight: '1.2'
            }}>
              收入分析
            </h1>
            <p style={{
              margin: '4px 0 0 0',
              fontSize: '14px',
              color: '#6b7280',
              lineHeight: '1.4'
            }}>
              全面掌握平台收入情况，优化盈利模式
            </p>
          </div>
        </div>
        <div style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center'
        }}>
          <RangePicker
            style={{ marginBottom: 0 }}
            onChange={handleDateRangeChange}
            allowClear={true}
            placeholder={['开始日期', '结束日期']}
          />
          <Button
            onClick={() => fetchAnalytics()}
            loading={loading}
            style={{
              borderRadius: '6px',
              fontWeight: '500'
            }}
          >
            刷新数据
          </Button>
        </div>
      </div>

      {/* 主要内容区域 */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        border: '1px solid #f0f0f0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        overflow: 'hidden'
      }}>
        {loading ? (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '300px'
          }}>
            <Spin size="large" />
          </div>
        ) : (
          <>
            {/* 统计卡片 */}
            <Row gutter={16} style={{ marginBottom: '24px', padding: '24px' }}>
              <Col span={6}>
                <Card style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '8px',
                  border: '1px solid #f0f0f0',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                }}>
                  <Statistic
                    title="总收入"
                    value={analytics?.total_revenue || 0}
                    prefix={<DollarOutlined style={{ color: '#1677ff' }} />}
                    valueStyle={{ color: '#1677ff' }}
                    formatter={(value) => `¥${Number(value).toLocaleString()}`}
                  />
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>累计总收入</p>
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
                    title="本月收入"
                    value={analytics?.month_revenue || 0}
                    prefix={<ShoppingCartOutlined style={{ color: '#10b981' }} />}
                    valueStyle={{ color: '#10b981' }}
                    formatter={(value) => `¥${Number(value).toLocaleString()}`}
                  />
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>当月收入</p>
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
                    title="收入增长率"
                    value={analytics?.revenue_growth_rate || 0}
                    prefix={analytics?.revenue_growth_rate > 0 ? <RiseOutlined style={{ color: '#10b981' }} /> : <FallOutlined style={{ color: '#ef4444' }} />}
                    valueStyle={{
                      color: analytics?.revenue_growth_rate > 0 ? '#10b981' : '#ef4444'
                    }}
                    suffix="%"
                  />
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>相比上月</p>
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
                    title="平均客单价"
                    value={(analytics?.total_revenue || 0) / 100 || 0}
                    prefix={<GiftOutlined style={{ color: '#f59e0b' }} />}
                    valueStyle={{ color: '#f59e0b' }}
                    formatter={(value) => `¥${Number(value).toFixed(2)}`}
                  />
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>预估平均值</p>
                </Card>
              </Col>
            </Row>

            {/* 图表区域 */}
            <Row gutter={16} style={{ marginBottom: '24px', padding: '0 24px' }}>
              <Col span={12}>
                <Card
                  title="月度收入趋势"
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid #f0f0f0',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                    height: '350px'
                  }}
                >
                  {monthlyRevenueData.length > 0 ? (
                    <Line {...monthlyRevenueConfig} />
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#9ca3af' }}>暂无数据</div>
                  )}
                </Card>
              </Col>
              <Col span={12}>
                <Card
                  title="收入来源分布"
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid #f0f0f0',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                    height: '350px'
                  }}
                >
                  {revenueSourceData.length > 0 ? (
                    <Pie {...revenueSourceConfig} label={{
                      type: 'outer',
                      content: (item: any) => `${item.type} ${item.percentage}%`
                    }} />
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#9ca3af' }}>暂无数据</div>
                  )}
                </Card>
              </Col>
            </Row>

            {/* 收入来源明细表格 */}
            <Row style={{ padding: '0 24px 24px' }}>
              <Col span={24}>
                <Card
                  title="收入来源明细"
                  extra={
                    <span style={{ color: '#6b7280', fontSize: '14px' }}>
                      总收入: ¥{(analytics?.total_revenue || 0).toLocaleString()}
                    </span>
                  }
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid #f0f0f0',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                  }}
                >
                  <Table
                    columns={sourceColumns}
                    dataSource={analytics?.revenue_by_source || []}
                    rowKey="source"
                    pagination={false}
                    size="middle"
                    summary={(data) => (
                      <Table.Summary.Row>
                        <Table.Summary.Cell index={0}>
                          <strong style={{ color: '#1f2937' }}>总计</strong>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={1}>
                          <strong style={{ color: '#10b981', fontSize: '16px' }}>
                            ¥{data.reduce((sum: number, item: any) => sum + item.amount, 0).toLocaleString()}
                          </strong>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={2}>
                          <strong style={{ color: '#6b7280' }}>100%</strong>
                        </Table.Summary.Cell>
                      </Table.Summary.Row>
                    )}
                  />
                </Card>
              </Col>
            </Row>
          </>
        )}
      </div>
    </div>
  )
}

export default RevenueAnalytics