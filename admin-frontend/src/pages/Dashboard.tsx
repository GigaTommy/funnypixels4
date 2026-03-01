import React, { useState, useEffect } from 'react'
import { Card, Row, Col, Statistic, Typography, Space, Divider, List, Tag, Spin } from 'antd'
import {
  UserOutlined,
  TeamOutlined,
  FileSearchOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  HistoryOutlined,
  BellOutlined,
} from '@ant-design/icons'
import { useAuth } from '@/contexts/AuthContext'
import { dashboardService } from '@/services'
import TodoModule from '@/components/TodoModule'
import type { DashboardStats, RecentActivity } from '@/types'

const { Title, Paragraph } = Typography

const Dashboard: React.FC = () => {
  const { user } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [todoModuleCollapsed, setTodoModuleCollapsed] = useState(false)

  // 获取Dashboard数据
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [statsData, activitiesData] = await Promise.all([
          dashboardService.getStats(),
          dashboardService.getRecentActivities()
        ])
        setStats(statsData)
        setRecentActivities(activitiesData.list)
      } catch (error) {
        console.error('获取Dashboard数据失败:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // 统计数据配置
  const statsConfig = [
    {
      title: '总用户数',
      value: stats?.totalUsers || 0,
      icon: <UserOutlined style={{ color: '#1890ff' }} />,
      suffix: '人',
    },
    {
      title: '总像素数',
      value: stats?.totalPixels || 0,
      icon: <TeamOutlined style={{ color: '#52c41a' }} />,
      suffix: '个',
    },
    {
      title: '今日注册',
      value: stats?.todayUsers || 0,
      icon: <CheckCircleOutlined style={{ color: '#faad14' }} />,
      suffix: '人',
    },
    {
      title: '活跃用户',
      value: stats?.activeUsers || 0,
      icon: <HistoryOutlined style={{ color: '#722ed1' }} />,
      suffix: '人',
    },
  ]

  // 活动类型映射
  const getActivityType = (type: string) => {
    const typeMap: Record<string, { color: string; text: string }> = {
      user_created: { color: 'blue', text: '用户注册' },
      ad_approved: { color: 'green', text: '广告通过' },
      ad_rejected: { color: 'red', text: '广告拒绝' },
    }
    return typeMap[type] || { color: 'default', text: type }
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* 欢迎信息 */}
      <Card style={{ marginBottom: '24px' }}>
        <Space size="large" align="center">
          <div>
            <Title level={2} style={{ margin: 0 }}>
              欢迎回来，{user?.nickname || user?.username}
            </Title>
            <Paragraph type="secondary" style={{ margin: '8px 0 0 0' }}>
              今天是个好日子，让我们开始工作吧！
            </Paragraph>
          </div>
        </Space>
      </Card>

      {/* 统计数据卡片 */}
      <Row gutter={[16, 16]}>
        {statsConfig.map((stat, index) => (
          <Col xs={24} sm={12} lg={6} key={index}>
            <Card>
              <Spin spinning={loading}>
                <Statistic
                  title={stat.title}
                  value={stat.value}
                  suffix={stat.suffix}
                  prefix={stat.icon}
                  valueStyle={{ fontSize: '28px', fontWeight: 'bold' }}
                />
              </Spin>
            </Card>
          </Col>
        ))}
      </Row>

      <Divider />

      {/* 统一待办模块 */}
      <TodoModule
        collapsed={todoModuleCollapsed}
        onToggleCollapse={() => setTodoModuleCollapsed(!todoModuleCollapsed)}
      />

      <Divider />

      {/* 最近活动 */}
      <Card title="最近活动" extra={<a href="/ad/approval">查看全部</a>}>
        <Spin spinning={loading}>
          {recentActivities.length > 0 ? (
            <List
              dataSource={recentActivities}
              renderItem={(activity) => {
                const activityType = getActivityType(activity.type)
                return (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <Space>
                          <Tag color={activityType.color}>
                            {activityType.text}
                          </Tag>
                          <span>{activity.description}</span>
                        </Space>
                      }
                      description={
                        <Space>
                          <span>操作者：{activity.user}</span>
                          <span>•</span>
                          <span>{new Date(activity.timestamp).toLocaleString()}</span>
                        </Space>
                      }
                    />
                  </List.Item>
                )
              }}
            />
          ) : (
            <div style={{ textAlign: 'center', color: '#999', padding: '40px 0' }}>
              暂无最近活动记录
            </div>
          )}
        </Spin>
      </Card>

    </div>
  )
}

export default Dashboard