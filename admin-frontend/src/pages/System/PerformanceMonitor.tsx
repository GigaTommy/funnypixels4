import React, { useState } from 'react'
import {
  Card,
  Tabs,
  Alert,
  Space,
  Button,
  Switch,
  Select,
  Tag
} from 'antd'
import {
  DashboardOutlined,
  LineChartOutlined,
  AlertOutlined,
  DatabaseOutlined,
  ApiOutlined,
  TeamOutlined,
  FullscreenOutlined,
  ReloadOutlined
} from '@ant-design/icons'

const { Option } = Select

// Grafana Dashboard UIDs（需要在 Grafana 中预先创建）
const GRAFANA_DASHBOARDS = {
  overview: 'system-overview',        // 系统总览
  api: 'api-performance',             // API 性能
  database: 'database-metrics',       // 数据库监控
  users: 'user-activity',             // 用户活跃度
  alerts: 'alerting'                  // 告警面板
}

// Grafana 嵌入组件
interface GrafanaEmbedProps {
  dashboardUid: string
  title: string
  height?: number
  refresh?: string
}

const GrafanaEmbed: React.FC<GrafanaEmbedProps> = ({
  dashboardUid,
  title,
  height = 800,
  refresh = '30s'
}) => {
  // Grafana 地址：生产环境通过 Nginx 子路径访问，开发环境直连 3000 端口
  const GRAFANA_BASE = import.meta.env.VITE_GRAFANA_URL
    || (window.location.hostname === 'localhost'
      ? 'http://localhost:3000'
      : `http://${window.location.hostname}:3000`)

  // Grafana URL 参数
  const params = new URLSearchParams({
    kiosk: 'tv',           // 隐藏 Grafana 顶部导航（TV模式）
    theme: 'light',        // 使用浅色主题
    refresh: refresh,      // 自动刷新间隔
  })

  const embedUrl = `${GRAFANA_BASE}/d/${dashboardUid}?${params.toString()}`

  return (
    <div style={{
      width: '100%',
      height: `${height}px`,
      position: 'relative',
      borderRadius: '8px',
      overflow: 'hidden',
      border: '1px solid #f0f0f0'
    }}>
      <iframe
        src={embedUrl}
        width="100%"
        height="100%"
        frameBorder="0"
        title={title}
        style={{
          border: 'none',
          display: 'block'
        }}
      />
    </div>
  )
}

const PerformanceMonitor: React.FC = () => {
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState('30s')

  // Tab 配置
  const tabs = [
    {
      key: 'overview',
      label: (
        <span>
          <DashboardOutlined />
          系统总览
        </span>
      ),
      children: (
        <GrafanaEmbed
          dashboardUid={GRAFANA_DASHBOARDS.overview}
          title="系统总览"
          refresh={autoRefresh ? refreshInterval : ''}
        />
      )
    },
    {
      key: 'api',
      label: (
        <span>
          <ApiOutlined />
          API 性能
        </span>
      ),
      children: (
        <GrafanaEmbed
          dashboardUid={GRAFANA_DASHBOARDS.api}
          title="API 性能监控"
          refresh={autoRefresh ? refreshInterval : ''}
        />
      )
    },
    {
      key: 'database',
      label: (
        <span>
          <DatabaseOutlined />
          数据库
        </span>
      ),
      children: (
        <GrafanaEmbed
          dashboardUid={GRAFANA_DASHBOARDS.database}
          title="数据库监控"
          refresh={autoRefresh ? refreshInterval : ''}
        />
      )
    },
    {
      key: 'users',
      label: (
        <span>
          <TeamOutlined />
          用户活跃度
        </span>
      ),
      children: (
        <GrafanaEmbed
          dashboardUid={GRAFANA_DASHBOARDS.users}
          title="用户活跃度分析"
          refresh={autoRefresh ? refreshInterval : ''}
        />
      )
    },
    {
      key: 'alerts',
      label: (
        <span>
          <AlertOutlined />
          告警
        </span>
      ),
      children: (
        <GrafanaEmbed
          dashboardUid={GRAFANA_DASHBOARDS.alerts}
          title="告警面板"
          refresh={autoRefresh ? refreshInterval : ''}
        />
      )
    }
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
            <LineChartOutlined style={{
              color: 'white',
              fontSize: '20px'
            }} />
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{
              margin: 0,
              fontSize: '28px',
              fontWeight: '700',
              color: '#1f2937',
              lineHeight: '1.2'
            }}>
              性能监控
            </h1>
            <p style={{
              margin: '4px 0 0 0',
              fontSize: '14px',
              color: '#6b7280',
              lineHeight: '1.4'
            }}>
              实时监控系统性能，确保稳定运行
            </p>
          </div>
          <Space>
            <Button
              type="link"
              icon={<FullscreenOutlined />}
              onClick={() => window.open('/grafana/', '_blank')}
              style={{ color: '#6b7280' }}
            >
              在新窗口打开
            </Button>
          </Space>
        </div>

        {/* 控制栏 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px',
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          border: '1px solid #e5e7eb'
        }}>
          <Space size="large">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#6b7280', fontSize: '14px', fontWeight: '500' }}>
                自动刷新:
              </span>
              <Switch
                checked={autoRefresh}
                onChange={setAutoRefresh}
                checkedChildren="开启"
                unCheckedChildren="关闭"
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#6b7280', fontSize: '14px', fontWeight: '500' }}>
                刷新间隔:
              </span>
              <Select
                value={refreshInterval}
                onChange={setRefreshInterval}
                style={{ width: 100 }}
                disabled={!autoRefresh}
                size="small"
              >
                <Option value="5s">5秒</Option>
                <Option value="10s">10秒</Option>
                <Option value="30s">30秒</Option>
                <Option value="1m">1分钟</Option>
                <Option value="5m">5分钟</Option>
              </Select>
            </div>
          </Space>

          <Tag color="success" style={{ margin: 0 }}>
            <ReloadOutlined spin={autoRefresh} />
            {autoRefresh ? `每${refreshInterval}自动刷新` : '已暂停刷新'}
          </Tag>
        </div>
      </div>

      {/* Grafana 面板区域 */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        border: '1px solid #f0f0f0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        padding: '24px',
        minHeight: '800px'
      }}>
        <Alert
          message="提示"
          description={
            <div>
              <p style={{ margin: '0 0 8px 0' }}>
                • 监控数据每 {refreshInterval} 自动刷新，点击图表可查看详细信息
              </p>
              <p style={{ margin: '0 0 8px 0' }}>
                • 使用时间选择器可以查看历史数据
              </p>
              <p style={{ margin: 0 }}>
                • 如需完整功能，点击右上角"在新窗口打开"
              </p>
            </div>
          }
          type="info"
          showIcon
          closable
          style={{ marginBottom: 24, borderRadius: '8px' }}
        />

        <Tabs
          items={tabs}
          defaultActiveKey="overview"
          size="large"
          tabBarStyle={{
            marginBottom: '24px'
          }}
        />
      </div>
    </div>
  )
}

export default PerformanceMonitor
