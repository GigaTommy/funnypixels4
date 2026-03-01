import React, { useState, useRef, useEffect } from 'react'
import { Card, Row, Col, Statistic, Select, DatePicker, Spin, Button, message } from 'antd'
import {
  UserOutlined,
  TeamOutlined,
  UserAddOutlined,
  RiseOutlined,
  FallOutlined,
  DownloadOutlined
} from '@ant-design/icons'
import { analyticsService } from '@/services'
import SafeProTable from '@/components/SafeProTable'
import type { UserAnalytics } from '@/types'
import { Line, Pie } from '@ant-design/charts'
import type { RangePickerProps } from 'antd/es/date-picker'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker

const UserAnalytics: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null)
  const [dateRange, setDateRange] = useState<[string, string] | null>(null)

  // 获取分析数据
  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const response = await analyticsService.userAnalytics.getUserAnalytics({
        start_date: dateRange?.[0] || '',
        end_date: dateRange?.[1] || ''
      })
      setAnalytics(response)
    } catch (error) {
      console.error('Get user analytics failed:', error)
      message.error('获取用户分析数据失败')
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

  // 用户增长趋势图表数据
  const growthData = analytics?.daily_active_users ? analytics.daily_active_users.map((item: any) => ({
    date: item.date,
    value: item.count,
  })) : []

  // 用户角色分布图表数据
  const roleData = analytics?.user_role_distribution ? analytics.user_role_distribution.map((item: any) => ({
    name: item.role,
    value: item.count,
    percentage: item.percentage,
  })) : []

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
            }}>👥</span>
          </div>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: '28px',
              fontWeight: '700',
              color: '#1f2937',
              lineHeight: '1.2'
            }}>
              用户分析
            </h1>
            <p style={{
              margin: '4px 0 0 0',
              fontSize: '14px',
              color: '#6b7280',
              lineHeight: '1.4'
            }}>
              深入了解用户行为模式，优化产品体验
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
            type="primary"
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
            <Row gutter={16} style={{ marginBottom: '24px' }}>
              <Col span={6}>
                <Card style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '8px',
                  border: '1px solid #f0f0f0',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                }}>
                  <Statistic
                    title="总用户数"
                    value={analytics?.total_users || 0}
                    prefix={<UserOutlined style={{ color: '#1677ff' }} />}
                    valueStyle={{ color: '#1677ff' }}
                  />
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>当前注册用户总量</p>
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
                    title="活跃用户"
                    value={analytics?.active_users || 0}
                    prefix={<TeamOutlined style={{ color: '#10b981' }} />}
                    valueStyle={{ color: '#10b981' }}
                  />
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>日活跃用户数量</p>
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
                    value={analytics?.new_users_today || 0}
                    prefix={<UserAddOutlined style={{ color: '#10b981' }} />}
                    valueStyle={{ color: '#10b981' }}
                  />
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>今日新增注册用户</p>
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
                    title="本周新增"
                    value={analytics?.new_users_week || 0}
                    prefix={<UserAddOutlined style={{ color: '#10b981' }} />}
                    valueStyle={{ color: '#10b981' }}
                  />
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>本周新增注册用户</p>
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
                    title="用户增长率"
                    value={analytics?.user_growth_rate || 0}
                    prefix={analytics?.user_growth_rate > 0 ? <RiseOutlined style={{ color: '#10b981' }} /> : <FallOutlined style={{ color: '#ef4444' }} />}
                    valueStyle={{
                      color: analytics?.user_growth_rate > 0 ? '#10b981' : '#ef4444'
                    }}
                    suffix="%"
                  />
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>相比上月</p>
                </Card>
              </Col>
            </Row>

            {/* 图表区域 */}
            <Row gutter={16} style={{ marginBottom: '24px' }}>
              <Col span={12}>
                <Card
                  title="用户增长趋势"
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid #f0f0f0',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                    height: '300px'
                  }}
                >
                  <Line
                    data={growthData}
                    xField="date"
                    yField="value"
                    smooth={true}
                    style={{
                      stroke: '#1677ff',
                      fill: 'rgba(22, 119, 255, 0.1)',
                      strokeWidth: 2
                    }}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card
                  title="用户角色分布"
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid #f0f0f0',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                    height: '300px'
                  }}
                >
                  <Pie
                    data={roleData}
                    angleField="value"
                    colorField="name"
                    radius={0.8}
                    label={{
                      type: 'outer',
                      content: (item) => `${item.name} ${item.percentage}%`,
                    }}
                    interactions={[
                      { type: 'element-active' },
                    ]}
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

export default UserAnalytics