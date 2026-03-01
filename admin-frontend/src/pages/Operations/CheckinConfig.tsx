import React, { useState, useEffect, useCallback } from 'react';
import {
    Card,
    Table,
    Button,
    Modal,
    Form,
    Input,
    InputNumber,
    Switch,
    Row,
    Col,
    Statistic,
    Tabs,
    Tag,
    Space,
    message,
    Spin,
} from 'antd';
import {
    CalendarOutlined,
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    ReloadOutlined,
} from '@ant-design/icons';
import { checkinService, type CheckinRewardConfig, type CheckinStats, type RewardPreview } from '@/services/checkin';
import PageHeader from '@/components/PageHeader';

type ConfigType = 'base' | 'milestone' | 'streak_bonus';

const CheckinConfig: React.FC = () => {
    const [stats, setStats] = useState<CheckinStats | null>(null);
    const [statsLoading, setStatsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<ConfigType>('base');
    const [configs, setConfigs] = useState<CheckinRewardConfig[]>([]);
    const [tableLoading, setTableLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState<CheckinRewardConfig | null>(null);
    const [modalLoading, setModalLoading] = useState(false);
    const [previewData, setPreviewData] = useState<RewardPreview[]>([]);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [form] = Form.useForm();

    // --- Data fetching ---

    const fetchStats = useCallback(async () => {
        setStatsLoading(true);
        try {
            const data = await checkinService.getStats();
            setStats(data);
        } catch {
            message.error('获取统计数据失败');
        } finally {
            setStatsLoading(false);
        }
    }, []);

    const fetchConfigs = useCallback(async (configType: ConfigType) => {
        setTableLoading(true);
        try {
            const data = await checkinService.getConfigs({ config_type: configType });
            setConfigs(Array.isArray(data) ? data : data?.list ?? []);
        } catch {
            message.error('获取配置列表失败');
        } finally {
            setTableLoading(false);
        }
    }, []);

    const fetchPreview = useCallback(async () => {
        setPreviewLoading(true);
        try {
            const data = await checkinService.previewReward(30);
            setPreviewData(data);
        } catch {
            message.error('获取奖励预览失败');
        } finally {
            setPreviewLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStats();
        fetchPreview();
    }, [fetchStats, fetchPreview]);

    useEffect(() => {
        fetchConfigs(activeTab);
    }, [activeTab, fetchConfigs]);

    // --- CRUD handlers ---

    const handleCreate = () => {
        setEditingItem(null);
        form.resetFields();
        form.setFieldsValue({
            config_type: activeTab,
            reward_points: 0,
            multiplier: 1,
            bonus_points: 0,
            reward_items: '',
            is_active: true,
            priority: 0,
        });
        setModalVisible(true);
    };

    const handleEdit = (record: CheckinRewardConfig) => {
        setEditingItem(record);
        form.setFieldsValue({
            ...record,
            reward_items: record.reward_items ? JSON.stringify(record.reward_items) : '',
        });
        setModalVisible(true);
    };

    const handleDelete = (record: CheckinRewardConfig) => {
        Modal.confirm({
            title: '确认删除',
            content: '确定要删除这条配置吗？删除后不可恢复。',
            okType: 'danger',
            onOk: async () => {
                try {
                    await checkinService.deleteConfig(record.id);
                    message.success('删除成功');
                    fetchConfigs(activeTab);
                    fetchPreview();
                } catch {
                    message.error('删除失败');
                }
            },
        });
    };

    const handleFinish = async (values: any) => {
        setModalLoading(true);
        try {
            let rewardItems: any[] = [];
            if (values.reward_items) {
                try {
                    rewardItems = JSON.parse(values.reward_items);
                } catch {
                    message.error('奖励物品 JSON 格式不正确');
                    setModalLoading(false);
                    return;
                }
            }

            const payload = {
                ...values,
                reward_items: rewardItems,
            };

            if (editingItem) {
                await checkinService.updateConfig(editingItem.id, payload);
                message.success('更新成功');
            } else {
                await checkinService.createConfig(payload);
                message.success('创建成功');
            }

            setModalVisible(false);
            fetchConfigs(activeTab);
            fetchStats();
            fetchPreview();
        } catch {
            message.error('操作失败');
        } finally {
            setModalLoading(false);
        }
    };

    const handleRefresh = () => {
        fetchConfigs(activeTab);
        fetchStats();
        fetchPreview();
    };

    // --- Table columns ---

    const baseColumns = [
        {
            title: '奖励积分',
            dataIndex: 'reward_points',
            width: 120,
        },
        {
            title: '描述',
            dataIndex: 'description',
            ellipsis: true,
        },
        {
            title: '状态',
            dataIndex: 'is_active',
            width: 100,
            render: (active: boolean) => (
                <Tag color={active ? 'success' : 'default'}>{active ? '启用' : '禁用'}</Tag>
            ),
        },
        {
            title: '操作',
            key: 'action',
            width: 140,
            render: (_: any, record: CheckinRewardConfig) => (
                <Space>
                    <a onClick={() => handleEdit(record)}><EditOutlined /> 编辑</a>
                    <a style={{ color: '#ff4d4f' }} onClick={() => handleDelete(record)}><DeleteOutlined /> 删除</a>
                </Space>
            ),
        },
    ];

    const milestoneColumns = [
        {
            title: '天数',
            dataIndex: 'day_number',
            width: 80,
            sorter: (a: CheckinRewardConfig, b: CheckinRewardConfig) => (a.day_number ?? 0) - (b.day_number ?? 0),
        },
        {
            title: '倍率',
            dataIndex: 'multiplier',
            width: 100,
            render: (val: number) => <Tag color="blue">{val}x</Tag>,
        },
        {
            title: '奖励物品',
            dataIndex: 'reward_items',
            width: 200,
            render: (items: any[]) =>
                items && items.length > 0
                    ? items.map((item: any, idx: number) => (
                          <Tag key={idx} color="gold">{typeof item === 'string' ? item : JSON.stringify(item)}</Tag>
                      ))
                    : '-',
        },
        {
            title: '描述',
            dataIndex: 'description',
            ellipsis: true,
        },
        {
            title: '状态',
            dataIndex: 'is_active',
            width: 100,
            render: (active: boolean) => (
                <Tag color={active ? 'success' : 'default'}>{active ? '启用' : '禁用'}</Tag>
            ),
        },
        {
            title: '操作',
            key: 'action',
            width: 140,
            render: (_: any, record: CheckinRewardConfig) => (
                <Space>
                    <a onClick={() => handleEdit(record)}><EditOutlined /> 编辑</a>
                    <a style={{ color: '#ff4d4f' }} onClick={() => handleDelete(record)}><DeleteOutlined /> 删除</a>
                </Space>
            ),
        },
    ];

    const streakBonusColumns = [
        {
            title: '最小天数',
            dataIndex: 'min_day',
            width: 100,
            sorter: (a: CheckinRewardConfig, b: CheckinRewardConfig) => (a.min_day ?? 0) - (b.min_day ?? 0),
        },
        {
            title: '额外积分',
            dataIndex: 'bonus_points',
            width: 120,
            render: (val: number) => <Tag color="green">+{val}</Tag>,
        },
        {
            title: '描述',
            dataIndex: 'description',
            ellipsis: true,
        },
        {
            title: '状态',
            dataIndex: 'is_active',
            width: 100,
            render: (active: boolean) => (
                <Tag color={active ? 'success' : 'default'}>{active ? '启用' : '禁用'}</Tag>
            ),
        },
        {
            title: '操作',
            key: 'action',
            width: 140,
            render: (_: any, record: CheckinRewardConfig) => (
                <Space>
                    <a onClick={() => handleEdit(record)}><EditOutlined /> 编辑</a>
                    <a style={{ color: '#ff4d4f' }} onClick={() => handleDelete(record)}><DeleteOutlined /> 删除</a>
                </Space>
            ),
        },
    ];

    const getColumns = () => {
        switch (activeTab) {
            case 'milestone':
                return milestoneColumns;
            case 'streak_bonus':
                return streakBonusColumns;
            default:
                return baseColumns;
        }
    };

    const getTabLabel = (type: ConfigType) => {
        switch (type) {
            case 'base':
                return '基础配置';
            case 'milestone':
                return '里程碑奖励';
            case 'streak_bonus':
                return '连续签到加成';
        }
    };

    // --- Current config type from form for conditional fields ---
    const currentConfigType: ConfigType = activeTab;

    return (
        <div style={{ padding: '0px' }}>
            <PageHeader
                title="签到配置"
                description="管理每日签到奖励规则"
                icon={<CalendarOutlined style={{ color: 'white', fontSize: 20 }} />}
                extra={
                    <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
                        刷新数据
                    </Button>
                }
            />

            {/* Stats cards */}
            <Spin spinning={statsLoading}>
                <Row gutter={16} style={{ marginBottom: 24 }}>
                    <Col span={6}>
                        <Card size="small">
                            <Statistic
                                title="今日签到人数"
                                value={stats?.today_checkins ?? '-'}
                                valueStyle={{ color: '#1677ff' }}
                            />
                        </Card>
                    </Col>
                    <Col span={6}>
                        <Card size="small">
                            <Statistic
                                title="最长连续签到"
                                value={stats?.max_streak ?? '-'}
                                suffix="天"
                                valueStyle={{ color: '#ff4d4f' }}
                            />
                        </Card>
                    </Col>
                    <Col span={6}>
                        <Card size="small">
                            <Statistic
                                title="平均连续天数"
                                value={stats?.avg_streak ?? '-'}
                                suffix="天"
                                valueStyle={{ color: '#faad14' }}
                            />
                        </Card>
                    </Col>
                    <Col span={6}>
                        <Card size="small">
                            <Statistic
                                title="活跃配置数"
                                value={stats?.active_configs ?? '-'}
                                valueStyle={{ color: '#52c41a' }}
                            />
                        </Card>
                    </Col>
                </Row>
            </Spin>

            {/* Tabs with tables */}
            <Card>
                <Tabs
                    activeKey={activeTab}
                    onChange={(key) => setActiveTab(key as ConfigType)}
                    tabBarExtraContent={
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                            添加{getTabLabel(activeTab)}
                        </Button>
                    }
                    items={[
                        {
                            key: 'base',
                            label: '基础配置',
                            children: (
                                <Table
                                    rowKey="id"
                                    columns={baseColumns}
                                    dataSource={activeTab === 'base' ? configs : []}
                                    loading={activeTab === 'base' && tableLoading}
                                    pagination={{ pageSize: 10 }}
                                />
                            ),
                        },
                        {
                            key: 'milestone',
                            label: '里程碑奖励',
                            children: (
                                <Table
                                    rowKey="id"
                                    columns={milestoneColumns}
                                    dataSource={activeTab === 'milestone' ? configs : []}
                                    loading={activeTab === 'milestone' && tableLoading}
                                    pagination={{ pageSize: 10 }}
                                />
                            ),
                        },
                        {
                            key: 'streak_bonus',
                            label: '连续签到加成',
                            children: (
                                <Table
                                    rowKey="id"
                                    columns={streakBonusColumns}
                                    dataSource={activeTab === 'streak_bonus' ? configs : []}
                                    loading={activeTab === 'streak_bonus' && tableLoading}
                                    pagination={{ pageSize: 10 }}
                                />
                            ),
                        },
                    ]}
                />
            </Card>

            {/* Reward Preview */}
            <Card title="奖励预览（第1-30天）" style={{ marginTop: 24 }}>
                <Spin spinning={previewLoading}>
                    {previewData.length > 0 ? (
                        <Row gutter={[12, 12]}>
                            {previewData.map((item) => (
                                <Col key={item.day} xs={12} sm={8} md={6} lg={4} xl={3}>
                                    <Card
                                        size="small"
                                        hoverable
                                        style={{
                                            textAlign: 'center',
                                            borderColor: item.multiplier > 1 ? '#1677ff' : undefined,
                                            background: item.multiplier > 1 ? '#f0f5ff' : undefined,
                                        }}
                                    >
                                        <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>
                                            第 {item.day} 天
                                        </div>
                                        <div style={{ fontSize: 20, fontWeight: 700, color: '#1f2937' }}>
                                            {item.rewardPoints}
                                        </div>
                                        <div style={{ fontSize: 11, color: '#8c8c8c' }}>积分</div>
                                        {item.multiplier > 1 && (
                                            <Tag color="blue" style={{ marginTop: 4 }}>{item.multiplier}x</Tag>
                                        )}
                                        {item.bonusReward > 0 && (
                                            <Tag color="green" style={{ marginTop: 4 }}>+{item.bonusReward}</Tag>
                                        )}
                                    </Card>
                                </Col>
                            ))}
                        </Row>
                    ) : (
                        <div style={{ textAlign: 'center', padding: 32, color: '#8c8c8c' }}>
                            暂无预览数据，请先添加基础配置
                        </div>
                    )}
                </Spin>
            </Card>

            {/* Create/Edit Modal */}
            <Modal
                title={editingItem ? '编辑配置' : '新增配置'}
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                onOk={() => form.submit()}
                confirmLoading={modalLoading}
                width={640}
                destroyOnClose
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleFinish}
                    preserve={false}
                >
                    <Form.Item name="config_type" label="配置类型">
                        <Input disabled />
                    </Form.Item>

                    {currentConfigType === 'milestone' && (
                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item
                                    name="day_number"
                                    label="天数"
                                    rules={[{ required: true, message: '请输入天数' }]}
                                >
                                    <InputNumber min={1} style={{ width: '100%' }} placeholder="例如: 7" />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item
                                    name="multiplier"
                                    label="倍率"
                                    rules={[{ required: true, message: '请输入倍率' }]}
                                >
                                    <InputNumber min={0.1} step={0.1} style={{ width: '100%' }} placeholder="例如: 2.0" />
                                </Form.Item>
                            </Col>
                        </Row>
                    )}

                    {currentConfigType === 'streak_bonus' && (
                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item
                                    name="min_day"
                                    label="最小连续天数"
                                    rules={[{ required: true, message: '请输入最小天数' }]}
                                >
                                    <InputNumber min={1} style={{ width: '100%' }} placeholder="例如: 3" />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="max_day" label="最大连续天数">
                                    <InputNumber min={1} style={{ width: '100%' }} placeholder="不填则无上限" />
                                </Form.Item>
                            </Col>
                        </Row>
                    )}

                    <Row gutter={16}>
                        <Col span={currentConfigType === 'streak_bonus' ? 12 : 24}>
                            <Form.Item
                                name="reward_points"
                                label="奖励积分"
                                rules={[{ required: true, message: '请输入奖励积分' }]}
                            >
                                <InputNumber min={0} style={{ width: '100%' }} placeholder="基础奖励积分" />
                            </Form.Item>
                        </Col>
                        {currentConfigType === 'streak_bonus' && (
                            <Col span={12}>
                                <Form.Item
                                    name="bonus_points"
                                    label="额外积分"
                                    rules={[{ required: true, message: '请输入额外积分' }]}
                                >
                                    <InputNumber min={0} style={{ width: '100%' }} placeholder="连续签到额外积分" />
                                </Form.Item>
                            </Col>
                        )}
                    </Row>

                    <Form.Item
                        name="reward_items"
                        label="奖励物品 (JSON 数组)"
                        tooltip='请输入 JSON 数组格式，例如: [{"type":"coin","amount":100}]'
                    >
                        <Input.TextArea rows={3} placeholder='例如: [{"type":"coin","amount":100}]' />
                    </Form.Item>

                    <Form.Item name="description" label="描述">
                        <Input.TextArea rows={2} placeholder="输入配置描述" />
                    </Form.Item>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="is_active" label="启用状态" valuePropName="checked">
                                <Switch checkedChildren="启用" unCheckedChildren="禁用" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="priority" label="优先级" tooltip="值越大优先级越高">
                                <InputNumber min={0} style={{ width: '100%' }} placeholder="默认为 0" />
                            </Form.Item>
                        </Col>
                    </Row>
                </Form>
            </Modal>
        </div>
    );
};

export default CheckinConfig;
