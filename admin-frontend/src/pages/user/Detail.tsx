import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Card,
    Row,
    Col,
    Descriptions,
    Badge,
    Tabs,
    Table,
    Tag,
    Button,
    Avatar,
    Statistic,
    Space,
    Empty,
    Typography,
    Breadcrumb,
    Modal,
    Form,
    Select,
    Input,
    message,
    Divider,
} from 'antd';
import {
    UserOutlined,
    WalletOutlined,
    HistoryOutlined,
    TeamOutlined,
    ArrowLeftOutlined,
    StopOutlined,
    CheckCircleOutlined,
    DollarOutlined,
    InfoCircleOutlined,
} from '@ant-design/icons';
import { userService } from '@/services';
import type { User, UserDetail, WalletLedger } from '@/types';
import PageHeader from '@/components/PageHeader';

const { Title, Text } = Typography;

const UserDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [detail, setDetail] = useState<UserDetail | null>(null);
    const [banModalVisible, setBanModalVisible] = useState(false);
    const [form] = Form.useForm();

    const fetchDetails = async () => {
        if (!id) return;
        try {
            setLoading(true);
            const data = await userService.getUserDetails(id);
            setDetail(data);
        } catch (error) {
            console.error('获取用户详情失败:', error);
            message.error('获取用户详情失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDetails();
    }, [id]);

    const handleBan = async (values: any) => {
        if (!id) return;
        try {
            await userService.banUser(id, {
                banType: values.banType,
                banReason: values.banReason,
                banDuration: values.banDuration,
            });
            message.success('封禁操作成功');
            setBanModalVisible(false);
            fetchDetails();
        } catch (error) {
            message.error('封禁操作失败');
        }
    };

    if (!detail && !loading) {
        return (
            <Card>
                <Empty description="找不到该用户" />
            </Card>
        );
    }

    const { user, wallet, alliance } = detail || {};

    const ledgerColumns = [
        {
            title: '发生时间',
            dataIndex: 'created_at',
            key: 'created_at',
            render: (text: string) => new Date(text).toLocaleString(),
        },
        {
            title: '变动积分',
            dataIndex: 'delta_points',
            key: 'delta_points',
            render: (val: number) => (
                <Text type={val > 0 ? 'success' : 'danger'}>
                    {val > 0 ? `+${val}` : val}
                </Text>
            ),
        },
        {
            title: '原因',
            dataIndex: 'reason',
            key: 'reason',
        },
        {
            title: '关联引用',
            dataIndex: 'ref_id',
            key: 'ref_id',
            render: (refId: string) => <Text type="secondary">{refId || '-'}</Text>,
        },
    ];

    return (
        <div style={{ padding: '0px' }}>
            <PageHeader
                title={`用户详情: ${user?.nickname || user?.username || ''}`}
                breadcrumbs={[
                    { title: '用户中心', path: '/user/list' },
                    { title: '用户详情' }
                ]}
                extra={
                    <Space>
                        <Button
                            key="back"
                            icon={<ArrowLeftOutlined />}
                            onClick={() => navigate('/user/list')}
                        >
                            返回列表
                        </Button>
                        <Button
                            key="ban"
                            danger
                            icon={<StopOutlined />}
                            onClick={() => {
                                form.setFieldsValue({
                                    banType: user?.ban_type === 'none' ? 'login' : user?.ban_type,
                                    banReason: user?.ban_reason,
                                    banDuration: 'permanent'
                                });
                                setBanModalVisible(true);
                            }}
                        >
                            {user?.is_banned ? '修改封禁' : '封禁用户'}
                        </Button>
                        {user?.is_banned && (
                            <Button
                                key="unban"
                                type="primary"
                                onClick={() => handleBan({ banType: 'none', banReason: '管理员手动解封', banDuration: '0' })}
                            >
                                解封用户
                            </Button>
                        )}
                    </Space>
                }
            />

            <Row gutter={16} style={{ marginTop: 16 }}>
                <Col span={8}>
                    <Card loading={loading}>
                        <div style={{ textAlign: 'center', marginBottom: 24 }}>
                            <Avatar size={100} src={user?.avatar_url} icon={<UserOutlined />} />
                            <Title level={4} style={{ marginTop: 16, marginBottom: 4 }}>
                                {user?.nickname || user?.username}
                            </Title>
                            <Text type="secondary">{user?.role === 'admin' ? '管理员' : '普通用户'}</Text>
                            <div style={{ marginTop: 8 }}>
                                {user?.is_banned ? (
                                    <Tag color="error">已封禁 ({user.ban_type})</Tag>
                                ) : (
                                    <Tag color="success">正常</Tag>
                                )}
                            </div>
                        </div>

                        <Divider />

                        <Descriptions column={1} size="small">
                            <Descriptions.Item label="用户 ID">{user?.id}</Descriptions.Item>
                            <Descriptions.Item label="账号">{user?.username}</Descriptions.Item>
                            <Descriptions.Item label="手机">{user?.phone || '-'}</Descriptions.Item>
                            <Descriptions.Item label="邮箱">{user?.email || '-'}</Descriptions.Item>
                            <Descriptions.Item label="注册时间">
                                {user?.created_at ? new Date(user.created_at).toLocaleString() : '-'}
                            </Descriptions.Item>
                            <Descriptions.Item label="最后登录">
                                {user?.last_login ? new Date(user.last_login).toLocaleString() : '-'}
                            </Descriptions.Item>
                        </Descriptions>
                    </Card>

                    <Card title="等级与成就" style={{ marginTop: 16 }} loading={loading}>
                        <Row gutter={16}>
                            <Col span={12}>
                                <Statistic title="等级" value={user?.level} prefix="Lv." />
                            </Col>
                            <Col span={12}>
                                <Statistic title="绘制像素" value={user?.total_pixels} />
                            </Col>
                        </Row>
                    </Card>
                </Col>

                <Col span={16}>
                    <Row gutter={16}>
                        <Col span={8}>
                            <Card size="small">
                                <Statistic
                                    title="当前积分"
                                    value={wallet?.current_points}
                                    prefix={<DollarOutlined />}
                                    valueStyle={{ color: '#1890ff' }}
                                />
                            </Card>
                        </Col>
                        <Col span={8}>
                            <Card size="small">
                                <Statistic
                                    title="累计获得"
                                    value={wallet?.total_earned}
                                    valueStyle={{ color: '#52c41a' }}
                                />
                            </Card>
                        </Col>
                        <Col span={8}>
                            <Card size="small">
                                <Statistic
                                    title="累计消费"
                                    value={wallet?.total_spent}
                                    valueStyle={{ color: '#cf1322' }}
                                />
                            </Card>
                        </Col>
                    </Row>

                    <Card style={{ marginTop: 16 }} loading={loading}>
                        <Tabs defaultActiveKey="ledger">
                            <Tabs.TabPane
                                tab={<span><WalletOutlined />资产账本</span>}
                                key="ledger"
                            >
                                <Table
                                    dataSource={wallet?.recent_ledger}
                                    columns={ledgerColumns}
                                    rowKey="id"
                                    size="small"
                                    pagination={{ pageSize: 5 }}
                                />
                            </Tabs.TabPane>

                            <Tabs.TabPane
                                tab={<span><TeamOutlined />社交关系</span>}
                                key="social"
                            >
                                {alliance ? (
                                    <Descriptions title="所属联盟" bordered size="small">
                                        <Descriptions.Item label="联盟名称">{alliance.name}</Descriptions.Item>
                                        <Descriptions.Item label="联盟 ID">{alliance.id}</Descriptions.Item>
                                        <Descriptions.Item label="职位">{alliance.role}</Descriptions.Item>
                                        <Descriptions.Item label="加入时间">
                                            {new Date(alliance.joined_at).toLocaleString()}
                                        </Descriptions.Item>
                                    </Descriptions>
                                ) : (
                                    <Empty description="该用户未加入任何联盟" />
                                )}
                            </Tabs.TabPane>

                            <Tabs.TabPane
                                tab={<span><HistoryOutlined />登录日志</span>}
                                key="logs"
                            >
                                <Empty description="暂无登录日志 (待接入)" />
                            </Tabs.TabPane>

                            {user?.is_banned && (
                                <Tabs.TabPane
                                    tab={<span style={{ color: '#cf1322' }}><StopOutlined />封禁详情</span>}
                                    key="ban_info"
                                >
                                    <Descriptions bordered size="small">
                                        <Descriptions.Item label="封禁类型">
                                            <Tag color="red">{user.ban_type}</Tag>
                                        </Descriptions.Item>
                                        <Descriptions.Item label="过期时间">
                                            {user.ban_expires_at ? new Date(user.ban_expires_at).toLocaleString() : '永久'}
                                        </Descriptions.Item>
                                        <Descriptions.Item label="封禁原因" span={2}>
                                            {user.ban_reason || '无理由'}
                                        </Descriptions.Item>
                                    </Descriptions>
                                </Tabs.TabPane>
                            )}
                        </Tabs>
                    </Card>
                </Col>
            </Row>

            <Modal
                title="用户封禁设置"
                open={banModalVisible}
                onCancel={() => setBanModalVisible(false)}
                onOk={() => form.submit()}
            >
                <Form form={form} layout="vertical" onFinish={handleBan}>
                    <Form.Item name="banType" label="封禁类型" rules={[{ required: true }]}>
                        <Select>
                            <Select.Option value="login">禁止登录 (全功能封锁)</Select.Option>
                            <Select.Option value="draw">禁止绘图 (只读模式)</Select.Option>
                            <Select.Option value="chat">内禁言 (社交屏蔽)</Select.Option>
                        </Select>
                    </Form.Item>
                    <Form.Item name="banDuration" label="封禁时长" rules={[{ required: true }]}>
                        <Select>
                            <Select.Option value="1440">1 天</Select.Option>
                            <Select.Option value="4320">3 天</Select.Option>
                            <Select.Option value="10080">7 天</Select.Option>
                            <Select.Option value="43200">30 天</Select.Option>
                            <Select.Option value="permanent">永久</Select.Option>
                        </Select>
                    </Form.Item>
                    <Form.Item name="banReason" label="封禁原因" rules={[{ required: true, message: '请填写封禁理由以便备查' }]}>
                        <Input.TextArea rows={4} placeholder="例如：发表恶意政治言论 / 批量脚本刷币" />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default UserDetailPage;
