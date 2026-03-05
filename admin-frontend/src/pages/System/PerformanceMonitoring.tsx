/**
 * Performance Monitoring Dashboard
 * Displays client performance metrics from iOS/Android apps
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Statistic,
  Row,
  Col,
  Select,
  DatePicker,
  Spin,
  message,
  Tabs,
  Tag
} from 'antd';
import {
  RocketOutlined,
  MobileOutlined,
  ClockCircleOutlined,
  DashboardOutlined
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { TabPane } = Tabs;
const { Option } = Select;

interface PerformanceStats {
  by_type: Array<{ report_type: string; count: string }>;
  by_device: Array<{ device_model: string; count: string }>;
  by_version: Array<{ app_version: string; count: string }>;
  daily_trend: Array<{ date: string; count: string }>;
  period_days: number;
}

interface StartupStats {
  count: number;
  avg: number;
  min: number;
  max: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
}

const PerformanceMonitoring: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<PerformanceStats | null>(null);
  const [startupStats, setStartupStats] = useState<StartupStats | null>(null);
  const [days, setDays] = useState(7);

  useEffect(() => {
    fetchData();
  }, [days]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch overall stats
      const statsRes = await axios.get(`/api/performance/client/stats?days=${days}`);
      setStats(statsRes.data.data);

      // Fetch startup metrics
      const startupRes = await axios.get(`/api/performance/client/startup?days=${days}`);
      if (startupRes.data.data.stats) {
        setStartupStats(startupRes.data.data.stats);
      }
    } catch (error) {
      message.error('Failed to fetch performance data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const deviceColumns = [
    {
      title: 'Device Model',
      dataIndex: 'device_model',
      key: 'device_model',
      render: (text: string) => {
        // Map device identifiers to user-friendly names
        const deviceMap: { [key: string]: string } = {
          'iPhone14,2': 'iPhone 13 Pro',
          'iPhone14,3': 'iPhone 13 Pro Max',
          'iPhone14,4': 'iPhone 13 mini',
          'iPhone14,5': 'iPhone 13',
          'iPhone15,2': 'iPhone 14 Pro',
          'iPhone15,3': 'iPhone 14 Pro Max',
          'iPhone16,1': 'iPhone 15 Pro',
          'iPhone16,2': 'iPhone 15 Pro Max',
        };
        return (
          <div>
            <div>{deviceMap[text] || text}</div>
            <div style={{ fontSize: 12, color: '#999' }}>{text}</div>
          </div>
        );
      }
    },
    {
      title: 'Reports',
      dataIndex: 'count',
      key: 'count',
      sorter: (a: any, b: any) => parseInt(a.count) - parseInt(b.count)
    }
  ];

  const versionColumns = [
    {
      title: 'App Version',
      dataIndex: 'app_version',
      key: 'app_version',
      render: (text: string) => <Tag color="blue">{text}</Tag>
    },
    {
      title: 'Reports',
      dataIndex: 'count',
      key: 'count',
      sorter: (a: any, b: any) => parseInt(a.count) - parseInt(b.count)
    }
  ];

  const typeColumns = [
    {
      title: 'Report Type',
      dataIndex: 'report_type',
      key: 'report_type',
      render: (text: string) => {
        const colorMap: { [key: string]: string } = {
          startup: 'green',
          diagnostic: 'red',
          metric: 'blue',
          network: 'orange'
        };
        return <Tag color={colorMap[text] || 'default'}>{text}</Tag>;
      }
    },
    {
      title: 'Count',
      dataIndex: 'count',
      key: 'count',
      sorter: (a: any, b: any) => parseInt(a.count) - parseInt(b.count)
    }
  ];

  const formatDuration = (seconds: number) => {
    return `${(seconds * 1000).toFixed(0)}ms`;
  };

  return (
    <div>
      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
          <Col>
            <h2>
              <DashboardOutlined /> Client Performance Monitoring
            </h2>
          </Col>
          <Col>
            <Select value={days} onChange={setDays} style={{ width: 150 }}>
              <Option value={1}>Last 24 hours</Option>
              <Option value={7}>Last 7 days</Option>
              <Option value={30}>Last 30 days</Option>
              <Option value={90}>Last 90 days</Option>
            </Select>
          </Col>
        </Row>

        <Spin spinning={loading}>
          {/* Startup Performance Overview */}
          {startupStats && (
            <Card title="⚡ Startup Performance" style={{ marginBottom: 24 }}>
              <Row gutter={16}>
                <Col span={6}>
                  <Statistic
                    title="Average Startup Time"
                    value={formatDuration(startupStats.avg)}
                    prefix={<RocketOutlined />}
                    valueStyle={{ color: startupStats.avg < 1 ? '#3f8600' : '#cf1322' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="P50 (Median)"
                    value={formatDuration(startupStats.p50)}
                    prefix={<ClockCircleOutlined />}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="P90"
                    value={formatDuration(startupStats.p90)}
                    prefix={<ClockCircleOutlined />}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="P99"
                    value={formatDuration(startupStats.p99)}
                    prefix={<ClockCircleOutlined />}
                  />
                </Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 16 }}>
                <Col span={6}>
                  <Statistic title="Min" value={formatDuration(startupStats.min)} />
                </Col>
                <Col span={6}>
                  <Statistic title="Max" value={formatDuration(startupStats.max)} />
                </Col>
                <Col span={6}>
                  <Statistic title="Samples" value={startupStats.count} />
                </Col>
              </Row>
            </Card>
          )}

          {/* Statistics Tables */}
          {stats && (
            <Tabs defaultActiveKey="types">
              <TabPane tab="Report Types" key="types">
                <Table
                  dataSource={stats.by_type}
                  columns={typeColumns}
                  rowKey="report_type"
                  pagination={false}
                />
              </TabPane>

              <TabPane tab={`Devices (${stats.by_device.length})`} key="devices">
                <Table
                  dataSource={stats.by_device}
                  columns={deviceColumns}
                  rowKey="device_model"
                  pagination={{ pageSize: 20 }}
                />
              </TabPane>

              <TabPane tab={`App Versions (${stats.by_version.length})`} key="versions">
                <Table
                  dataSource={stats.by_version}
                  columns={versionColumns}
                  rowKey="app_version"
                  pagination={false}
                />
              </TabPane>

              <TabPane tab="Daily Trend" key="trend">
                <Table
                  dataSource={stats.daily_trend}
                  columns={[
                    { title: 'Date', dataIndex: 'date', key: 'date' },
                    { title: 'Reports', dataIndex: 'count', key: 'count' }
                  ]}
                  rowKey="date"
                  pagination={false}
                />
              </TabPane>
            </Tabs>
          )}

          {!stats && !loading && (
            <div style={{ textAlign: 'center', padding: 48, color: '#999' }}>
              <MobileOutlined style={{ fontSize: 48, marginBottom: 16 }} />
              <div>No performance data available yet.</div>
              <div style={{ fontSize: 12, marginTop: 8 }}>
                Data will appear here once users start reporting performance metrics from the iOS app.
              </div>
            </div>
          )}
        </Spin>
      </Card>
    </div>
  );
};

export default PerformanceMonitoring;
