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
  message
} from 'antd'
import {
  FileImageOutlined,
  EyeOutlined,
  DownloadOutlined,
  HeartOutlined,
  TrophyOutlined,
  RiseOutlined,
  FallOutlined
} from '@ant-design/icons'
import { analyticsService } from '@/services'
import type { ContentAnalytics } from '@/types'
import { Column } from '@ant-design/charts'
import type { RangePickerProps } from 'antd/es/date-picker'

const { RangePicker } = DatePicker
const { Option } = Select

const ContentAnalytics: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState<ContentAnalytics | null>(null)
  const [dateRange, setDateRange] = useState<[string, string] | null>(null)

  // 获取内容分析数据
  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const response = await analyticsService.contentAnalytics.getContentAnalytics({
        start_date: dateRange?.[0] || '',
        end_date: dateRange?.[1] || ''
      })
      setAnalytics(response)
    } catch (error) {
      console.error('Get content analytics failed:', error)
      message.error('获取内容分析数据失败')
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

  // 热门内容图表数据
  const popularContentData = analytics?.popular_content ? analytics.popular_content.map(item => ({
    title: item.title.length > 20 ? item.title.substring(0, 20) + '...' : item.title,
    views: item.views,
    downloads: item.downloads,
    type: item.title // 临时修复 seriesField 引用问题
  })) : []

  // 内容类型分布图表数据
  const contentTypeData = analytics?.content_type_distribution ? analytics.content_type_distribution.map(item => ({
    type: item.type,
    count: item.count,
    percentage: item.percentage,
  })) : []

  // 内容创建趋势图表配置
  const popularContentConfig = {
    data: popularContentData,
    xField: 'title',
    yField: 'views',
    seriesField: 'type',
    legend: {
      position: 'top' as const,
    },
    smooth: true,
    color: ['#1677ff', '#69b1ff'],
    columnWidthRatio: 0.8,
    meta: {
      views: {
        alias: '浏览量',
      },
      downloads: {
        alias: '下载量',
      },
    },
  }

  // 热门创作者表格列配置
  const creatorColumns = [
    {
      title: '创作者',
      dataIndex: 'username',
      key: 'username',
      render: (text: string, record: any) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: '500' }}>{text}</span>
          <Tag color="blue" style={{ borderRadius: '12px' }}>
            {record.role === 'creator' ? '创作者' : '普通用户'}
          </Tag>
        </div>
      ),
    },
    {
      title: '作品数量',
      dataIndex: 'content_count',
      key: 'content_count',
      render: (text: number) => (
        <span style={{ color: '#1677ff', fontWeight: '500' }}>{text}</span>
      ),
    },
    {
      title: '总浏览量',
      dataIndex: 'total_views',
      key: 'total_views',
      render: (text: number) => (
        <span style={{ color: '#10b981', fontWeight: '500' }}>{text.toLocaleString()}</span>
      ),
    },
    {
      title: '总下载量',
      dataIndex: 'total_downloads',
      key: 'total_downloads',
      render: (text: number) => (
        <span style={{ color: '#f59e0b', fontWeight: '500' }}>{text.toLocaleString()}</span>
      ),
    },
    {
      title: '获赞数',
      dataIndex: 'total_likes',
      key: 'total_likes',
      render: (text: number) => (
        <span style={{ color: '#ef4444', fontWeight: '500' }}>{text.toLocaleString()}</span>
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
            }}>📊</span>
          </div>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: '28px',
              fontWeight: '700',
              color: '#1f2937',
              lineHeight: '1.2'
            }}>
              内容分析
            </h1>
            <p style={{
              margin: '4px 0 0 0',
              fontSize: '14px',
              color: '#6b7280',
              lineHeight: '1.4'
            }}>
              深入了解内容创作情况，优化内容策略
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
                    title="总内容数"
                    value={analytics?.total_content || 0}
                    prefix={<FileImageOutlined style={{ color: '#1677ff' }} />}
                    valueStyle={{ color: '#1677ff' }}
                  />
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>平台总内容数量</p>
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
                    value={analytics?.new_content_today || 0}
                    prefix={<TrophyOutlined style={{ color: '#10b981' }} />}
                    valueStyle={{ color: '#10b981' }}
                  />
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>今日新增内容</p>
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
                    title="内容增长率"
                    value={analytics?.content_growth_rate || 0}
                    prefix={analytics?.content_growth_rate > 0 ? <RiseOutlined style={{ color: '#10b981' }} /> : <FallOutlined style={{ color: '#ef4444' }} />}
                    valueStyle={{
                      color: analytics?.content_growth_rate > 0 ? '#10b981' : '#ef4444'
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
                    title="平均浏览量"
                    value={analytics?.average_views_per_content || 0}
                    prefix={<EyeOutlined style={{ color: '#1677ff' }} />}
                    valueStyle={{ color: '#1677ff' }}
                  />
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>每内容平均浏览</p>
                </Card>
              </Col>
            </Row>

            {/* 图表区域 */}
            <Row gutter={16} style={{ marginBottom: '24px', padding: '0 24px' }}>
              <Col span={12}>
                <Card
                  title="热门内容排行"
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid #f0f0f0',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                    height: '350px'
                  }}
                >
                  <Column {...popularContentConfig} />
                </Card>
              </Col>
              <Col span={12}>
                <Card
                  title="内容类型分布"
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid #f0f0f0',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                    height: '350px'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {contentTypeData.map((item, index) => (
                      <div key={index} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 16px',
                        backgroundColor: '#fafafa',
                        borderRadius: '8px',
                        border: '1px solid #f0f0f0'
                      }}>
                        <span style={{ fontWeight: '500', color: '#1f2937' }}>{item.type}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ color: '#6b7280', fontSize: '14px' }}>{item.count} 个</span>
                          <span style={{
                            color: '#1677ff',
                            fontWeight: '600',
                            fontSize: '16px'
                          }}>{item.percentage}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </Col>
            </Row>

            {/* 热门创作者表格 */}
            <Row style={{ padding: '0 24px 24px' }}>
              <Col span={24}>
                <Card
                  title="热门创作者"
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid #f0f0f0',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                  }}
                >
                  <Table
                    columns={creatorColumns}
                    dataSource={analytics?.top_creators || []}
                    rowKey="user_id"
                    pagination={{
                      pageSize: 10,
                      showSizeChanger: true,
                      showQuickJumper: true,
                      showTotal: (total) => `共 ${total} 位创作者`
                    }}
                    size="middle"
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

export default ContentAnalytics