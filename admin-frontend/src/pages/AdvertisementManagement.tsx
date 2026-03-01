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
  Descriptions,
  Form,
  Input as TextAreaInput,
  Popconfirm,
  Row,
  Col,
  Statistic
} from 'antd';
import {
  SearchOutlined,
  EyeOutlined,
  CheckOutlined,
  CloseOutlined,
  ReloadOutlined,
  PictureOutlined,
  UserOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  DollarOutlined,
  PushpinOutlined
} from '@ant-design/icons';
import { advertisementService, type Advertisement, type ApproveAdRequest } from '@/services/advertisement';
import { useAuth } from '@/contexts/AuthContext';
import type { ColumnsType } from 'antd/es/table';

const { Option } = Select;
const { TextArea } = TextAreaInput;

const AdvertisementManagement: React.FC = () => {
  const { user } = useAuth();
  const [advertisements, setAdvertisements] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [current, setCurrent] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchTitle, setSearchTitle] = useState('');
  const [filterStatus, setFilterStatus] = useState<'pending' | 'approved' | 'rejected' | 'expired' | ''>('');
  const [filterUserId, setFilterUserId] = useState('');
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedAd, setSelectedAd] = useState<Advertisement | null>(null);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectForm] = Form.useForm();
  const [takedownModalVisible, setTakedownModalVisible] = useState(false);
  const [takedownForm] = Form.useForm();
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    expired: 0
  });

  // 加载广告列表
  const loadAdvertisements = async () => {
    setLoading(true);
    try {
      const response = await advertisementService.getAllAds({
        current,
        pageSize,
        title: searchTitle || undefined,
        status: filterStatus || undefined,
        user_id: filterUserId || undefined
      });
      setAdvertisements(response.list);
      setTotal(response.total);

      // 更新统计数据
      setStats({
        total: response.total,
        pending: response.list.filter(ad => ad.status === 'pending').length,
        approved: response.list.filter(ad => ad.status === 'approved').length,
        rejected: response.list.filter(ad => ad.status === 'rejected').length,
        expired: response.list.filter(ad => ad.status === 'expired').length
      });
    } catch (error) {
      message.error('加载广告列表失败');
      console.error('加载广告列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 查看广告详情
  const viewAdDetail = (ad: Advertisement) => {
    setSelectedAd(ad);
    setDetailModalVisible(true);
  };

  // 审批广告
  const handleApproveAd = async (ad: Advertisement) => {
    try {
      await advertisementService.approveAd({
        id: ad.id,
        status: 'approved',
        notes: '管理员审批通过'
      });
      message.success('广告审批成功');
      loadAdvertisements();
    } catch (error) {
      message.error('广告审批失败');
      console.error('广告审批失败:', error);
    }
  };

  // 显示拒绝对话框
  const showRejectModal = (ad: Advertisement) => {
    setSelectedAd(ad);
    setRejectModalVisible(true);
    rejectForm.resetFields();
  };

  // 拒绝广告
  const handleRejectAd = async (values: { reason: string }) => {
    if (!selectedAd) return;

    try {
      await advertisementService.approveAd({
        id: selectedAd.id,
        status: 'rejected',
        rejectReason: values.reason
      });
      message.success('广告拒绝成功');
      setRejectModalVisible(false);
      setSelectedAd(null);
      loadAdvertisements();
    } catch (error) {
      message.error('广告拒绝失败');
      console.error('广告拒绝失败:', error);
    }
  };

  // 强制下架广告
  const showTakedownModal = (ad: Advertisement) => {
    setSelectedAd(ad);
    setTakedownModalVisible(true);
    takedownForm.resetFields();
  };

  const handleTakedown = async (values: { reason: string }) => {
    if (!selectedAd) return;
    try {
      await advertisementService.takedownAd(selectedAd.id, values.reason);
      message.success('广告已强制下架');
      setTakedownModalVisible(false);
      setSelectedAd(null);
      loadAdvertisements();
    } catch (error) {
      message.error('下架失败');
      console.error('下架失败:', error);
    }
  };

  // 处理搜索
  const handleSearch = () => {
    setCurrent(1);
    loadAdvertisements();
  };

  // 处理重置
  const handleReset = () => {
    setSearchTitle('');
    setFilterStatus('');
    setFilterUserId('');
    setCurrent(1);
    loadAdvertisements();
  };

  // 处理分页变化
  const handleTableChange = (pagination: any) => {
    setCurrent(pagination.current);
    setPageSize(pagination.pageSize);
  };

  // 获取状态标签
  const getStatusTag = (status: string) => {
    const statusConfig = {
      pending: { color: '#f59e0b', text: '待审批', icon: <ClockCircleOutlined /> },
      approved: { color: '#10b981', text: '已通过', icon: <CheckOutlined /> },
      rejected: { color: '#ef4444', text: '已拒绝', icon: <ExclamationCircleOutlined /> },
      expired: { color: '#6b7280', text: '已过期', icon: <PushpinOutlined /> }
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

  // 格式化时间
  const formatTime = (time: string) => {
    return new Date(time).toLocaleString('zh-CN');
  };

  // 格式化坐标
  const formatCoords = (lat: number | undefined, lng: number | undefined) => {
    if (lat == null || lng == null) return '未指定';
    return `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`;
  };

  // 广告表格列定义
  const advertisementColumns: ColumnsType<Advertisement> = [
    {
      title: '预览',
      key: 'preview',
      width: 100,
      render: (_, record) => (
        <Avatar
          size={56}
          src={record.image_url}
          shape="square"
          style={{
            border: '2px solid #e5e7eb',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            cursor: 'pointer'
          }}
          onClick={() => viewAdDetail(record)}
        />
      )
    },
    {
      title: '广告信息',
      key: 'info',
      width: 250,
      render: (_, record) => (
        <div>
          <div style={{
            fontWeight: '600',
            color: '#1f2937',
            fontSize: '15px',
            marginBottom: '4px'
          }}>
            {record.title}
          </div>
          <div style={{
            color: '#6b7280',
            fontSize: '12px',
            marginBottom: '2px'
          }}>
            ID: {record.id}
          </div>
          <div style={{
            color: '#6b7280',
            fontSize: '12px'
          }}>
            {record.type === 'banner' ? '🏷️ 横幅广告' : record.type === 'video' ? '🎬 视频广告' : '📱 插屏广告'}
          </div>
        </div>
      )
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 200,
      ellipsis: {
        showTitle: false,
      },
      render: (description) => (
        <Tooltip placement="topLeft" title={description || '暂无描述'}>
          <span style={{
            color: '#6b7280',
            fontSize: '13px'
          }}>
            {description || '暂无描述'}
          </span>
        </Tooltip>
      )
    },
    {
      title: '申请人',
      key: 'applicant',
      width: 150,
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Avatar size={24} icon={<UserOutlined />} />
          <span style={{
            fontSize: '13px',
            color: '#6b7280'
          }}>
            {record.nickname || record.username || '未知用户'}
          </span>
        </div>
      )
    },
    {
      title: '位置',
      key: 'location',
      width: 150,
      render: (_, record) => {
        const loc = (record as any).targetLocation;
        let lat = record.lat;
        let lng = record.lng;
        if (lat == null && loc) {
          const parsed = typeof loc === 'string' ? (() => { try { return JSON.parse(loc); } catch { return null; } })() : loc;
          lat = parsed?.lat;
          lng = parsed?.lng;
        }
        return (
          <div>
            <div style={{
              fontSize: '12px',
              color: '#6b7280',
              marginBottom: '2px'
            }}>
              📍 {formatCoords(lat, lng)}
            </div>
            {record.grid_id && (
              <div style={{
                fontSize: '12px',
                color: '#6b7280'
              }}>
                网格: {record.grid_id}
              </div>
            )}
          </div>
        );
      }
    },
    {
      title: '预算',
      key: 'budget',
      width: 120,
      render: (_, record) => (
        <div style={{
          color: '#10b981',
          fontSize: '14px',
          fontWeight: '500'
        }}>
          ¥{record.budget?.toLocaleString() || '0'}
        </div>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => getStatusTag(status)
    },
    {
      title: '时间信息',
      key: 'time_info',
      width: 180,
      render: (_, record) => (
        <div>
          <div style={{
            fontSize: '11px',
            color: '#6b7280',
            marginBottom: '2px'
          }}>
            📅 开始: {formatTime(record.start_time)}
          </div>
          <div style={{
            fontSize: '11px',
            color: '#6b7280',
            marginBottom: '2px'
          }}>
            🏁 结束: {formatTime(record.end_time)}
          </div>
          <div style={{
            fontSize: '11px',
            color: '#6b7280'
          }}>
            ⏰ 创建: {formatTime(record.created_at)}
          </div>
        </div>
      )
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => viewAdDetail(record)}
            style={{ color: '#1677ff' }}
          >
            查看详情
          </Button>
          {record.status === 'pending' && (
            <>
              <Button
                type="link"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => handleApproveAd(record)}
                style={{ color: '#10b981' }}
              >
                通过
              </Button>
              <Button
                type="link"
                size="small"
                icon={<CloseOutlined />}
                onClick={() => showRejectModal(record)}
                style={{ color: '#ef4444' }}
              >
                拒绝
              </Button>
            </>
          )}
          {record.status === 'approved' && (
            <Button
              type="link"
              size="small"
              danger
              icon={<CloseOutlined />}
              onClick={() => showTakedownModal(record)}
            >
              强制下架
            </Button>
          )}
        </Space>
      )
    }
  ];

  // 初始加载
  useEffect(() => {
    loadAdvertisements();
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
            <span style={{
              color: 'white',
              fontSize: '20px'
            }}>📺</span>
          </div>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: '28px',
              fontWeight: '700',
              color: '#1f2937',
              lineHeight: '1.2'
            }}>
              广告管理
            </h1>
            <p style={{
              margin: '4px 0 0 0',
              fontSize: '14px',
              color: '#6b7280',
              lineHeight: '1.4'
            }}>
              管理平台广告内容，控制广告投放
            </p>
          </div>
        </div>
        <div style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center'
        }}>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleReset}
            style={{
              borderRadius: '8px',
              fontWeight: '500'
            }}
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
              title="总广告数"
              value={stats.total}
              prefix={<PictureOutlined style={{ color: '#1677ff' }} />}
              valueStyle={{ color: '#1677ff' }}
            />
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>平台广告总数</p>
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
              title="待审批"
              value={stats.pending}
              prefix={<ClockCircleOutlined style={{ color: '#f59e0b' }} />}
              valueStyle={{ color: '#f59e0b' }}
            />
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>等待审批的广告</p>
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(8px)',
            borderRadius: '16px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <Statistic
              title="已通过"
              value={stats.approved}
              prefix={<CheckOutlined style={{ color: '#10b981' }} />}
              valueStyle={{ color: '#10b981' }}
            />
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>已通过审批的广告</p>
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(8px)',
            borderRadius: '16px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <Statistic
              title="已拒绝"
              value={stats.rejected}
              prefix={<ExclamationCircleOutlined style={{ color: '#ef4444' }} />}
              valueStyle={{ color: '#ef4444' }}
            />
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>被拒绝的广告</p>
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
            placeholder="搜索广告标题"
            value={searchTitle}
            onChange={(e) => setSearchTitle(e.target.value)}
            style={{
              width: 280,
              borderRadius: '8px'
            }}
            prefix={<SearchOutlined />}
          />
          <Input
            placeholder="申请人ID"
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
            style={{
              width: 160,
              borderRadius: '8px'
            }}
          />
          <Select
            placeholder="选择状态"
            value={filterStatus}
            onChange={setFilterStatus}
            style={{
              width: 140,
              borderRadius: '8px'
            }}
            allowClear
          >
            <Option value="pending">⏰ 待审批</Option>
            <Option value="approved">✅ 已通过</Option>
            <Option value="rejected">❌ 已拒绝</Option>
            <Option value="expired">⏰ 已过期</Option>
          </Select>
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={handleSearch}
            style={{
              borderRadius: '6px',
              fontWeight: '500'
            }}
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
          columns={advertisementColumns}
          dataSource={advertisements}
          rowKey="id"
          loading={loading}
          pagination={{
            current,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 个广告`,
            pageSizeOptions: ['10', '20', '50', '100'],
            onChange: (page, size) => {
              setCurrent(page);
              setPageSize(size);
            }
          }}
          onChange={handleTableChange}
          style={{
            borderRadius: '12px'
          }}
        />
      </div>

      {/* 广告详情模态框 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PictureOutlined />
            <span>广告详情 - {selectedAd?.title}</span>
          </div>
        }
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={900}
        style={{
          borderRadius: '16px'
        }}
      >
        {selectedAd && (
          <div>
            <div style={{ marginBottom: '20px', textAlign: 'center' }}>
              {selectedAd.image_url && (
                <Image
                  width={400}
                  src={selectedAd.image_url}
                  alt={selectedAd.title}
                  style={{
                    borderRadius: '12px',
                    border: '2px solid #e5e7eb'
                  }}
                />
              )}
            </div>

            <Descriptions
              column={2}
              bordered
              size="small"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                borderRadius: '12px'
              }}
            >
              <Descriptions.Item label="广告标题" span={2}>
                <span style={{
                  fontWeight: '600',
                  color: '#1f2937',
                  fontSize: '15px'
                }}>
                  {selectedAd.title}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="广告ID" span={2}>
                <span style={{
                  color: '#6b7280',
                  fontSize: '13px'
                }}>
                  {selectedAd.id}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="广告类型" span={1}>
                <Tag
                  color="#1677ff"
                  style={{
                    borderRadius: '12px',
                    fontWeight: '500'
                  }}
                >
                  {selectedAd.type === 'banner' ? '🏷️ 横幅广告' : selectedAd.type === 'video' ? '🎬 视频广告' : '📱 插屏广告'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态" span={1}>
                {getStatusTag(selectedAd.status)}
              </Descriptions.Item>
              <Descriptions.Item label="申请人" span={2}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Avatar size={24} icon={<UserOutlined />} />
                  <span style={{
                    fontSize: '13px',
                    color: '#6b7280'
                  }}>
                    {selectedAd.nickname || selectedAd.username || '未知用户'}
                  </span>
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>
                <span style={{
                  color: '#6b7280',
                  fontSize: '13px'
                }}>
                  {selectedAd.description || '暂无描述'}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="位置坐标" span={1}>
                <span style={{
                  color: '#6b7280',
                  fontSize: '13px'
                }}>
                  📍 {(() => {
                    let lat = selectedAd.lat;
                    let lng = selectedAd.lng;
                    if (lat == null) {
                      const loc = (selectedAd as any).targetLocation;
                      if (loc) {
                        const parsed = typeof loc === 'string' ? (() => { try { return JSON.parse(loc); } catch { return null; } })() : loc;
                        lat = parsed?.lat;
                        lng = parsed?.lng;
                      }
                    }
                    return formatCoords(lat, lng);
                  })()}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="网格ID" span={1}>
                <span style={{
                  color: '#6b7280',
                  fontSize: '13px'
                }}>
                  {selectedAd.grid_id || '-'}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="广告预算" span={1}>
                <span style={{
                  color: '#10b981',
                  fontSize: '16px',
                  fontWeight: '600'
                }}>
                  ¥{selectedAd.budget?.toLocaleString() || '0'}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="重复次数" span={1}>
                <span style={{
                  color: '#6b7280',
                  fontSize: '13px'
                }}>
                  {selectedAd.repeat_count || 1}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="开始时间" span={1}>
                <span style={{
                  color: '#6b7280',
                  fontSize: '13px'
                }}>
                  {formatTime(selectedAd.start_time)}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="结束时间" span={1}>
                <span style={{
                  color: '#6b7280',
                  fontSize: '13px'
                }}>
                  {formatTime(selectedAd.end_time)}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="创建时间" span={1}>
                <span style={{
                  color: '#6b7280',
                  fontSize: '13px'
                }}>
                  {formatTime(selectedAd.created_at)}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="更新时间" span={1}>
                <span style={{
                  color: '#6b7280',
                  fontSize: '13px'
                }}>
                  {formatTime(selectedAd.updated_at)}
                </span>
              </Descriptions.Item>
            </Descriptions>

            {selectedAd.status === 'pending' && (
              <div style={{ marginTop: '20px', textAlign: 'right' }}>
                <Space>
                  <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    onClick={() => {
                      setDetailModalVisible(false);
                      handleApproveAd(selectedAd);
                    }}
                    style={{
                      backgroundColor: '#10b981',
                      borderColor: '#10b981',
                      borderRadius: '8px',
                      fontWeight: '500'
                    }}
                  >
                    通过审批
                  </Button>
                  <Button
                    danger
                    icon={<CloseOutlined />}
                    onClick={() => {
                      setDetailModalVisible(false);
                      showRejectModal(selectedAd);
                    }}
                    style={{
                      borderRadius: '8px',
                      fontWeight: '500'
                    }}
                  >
                    拒绝审批
                  </Button>
                </Space>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* 拒绝广告模态框 */}
      <Modal
        title="拒绝广告"
        open={rejectModalVisible}
        onCancel={() => setRejectModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setRejectModalVisible(false)}>
            取消
          </Button>,
          <Button
            key="submit"
            type="primary"
            danger
            onClick={() => {
              rejectForm.validateFields().then((values) => {
                handleRejectAd(values);
              });
            }}
          >
            确认拒绝
          </Button>
        ]}
        style={{
          borderRadius: '16px'
        }}
      >
        <Form form={rejectForm} layout="vertical">
          <Form.Item
            name="reason"
            label="拒绝原因"
            rules={[{ required: true, message: '请输入拒绝原因' }]}
          >
            <TextArea
              rows={4}
              placeholder="请输入拒绝该广告的具体原因..."
              maxLength={500}
              showCount
              style={{
                borderRadius: '8px'
              }}
            />
          </Form.Item>
        </Form>
      </Modal>
      {/* 强制下架模态框 */}
      <Modal
        title="强制下架广告"
        open={takedownModalVisible}
        onCancel={() => setTakedownModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setTakedownModalVisible(false)}>
            取消
          </Button>,
          <Button
            key="submit"
            type="primary"
            danger
            onClick={() => {
              takedownForm.validateFields().then((values) => {
                handleTakedown(values);
              });
            }}
          >
            确认下架
          </Button>
        ]}
      >
        <Form form={takedownForm} layout="vertical">
          <Form.Item
            name="reason"
            label="下架原因"
            rules={[{ required: true, message: '请输入下架原因' }]}
          >
            <TextArea
              rows={4}
              placeholder="请输入强制下架该广告的原因（如违规内容、用户投诉等）..."
              maxLength={500}
              showCount
              style={{ borderRadius: '8px' }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AdvertisementManagement;