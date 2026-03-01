import React, { useState } from 'react';
import {
    Card,
    Form,
    Input,
    Select,
    Button,
    message,
    Typography,
    Divider,
    Row,
    Col,
    Space,
    Table,
    Tag,
    Modal,
    Badge,
    InputNumber,
    Descriptions,
} from 'antd';
import {
    MailOutlined,
    SendOutlined,
    HistoryOutlined,
    DollarOutlined,
    PlusOutlined,
    DeleteOutlined,
    UserOutlined,
    GlobalOutlined,
} from '@ant-design/icons';
import { messageService } from '@/services';
import type { SystemMessage } from '@/services/message';
import PageHeader from '@/components/PageHeader';
import SafeProTable from '@/components/SafeProTable';

const { Title, Text, Paragraph } = Typography;

const SystemMailPage: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [form] = Form.useForm();
    const [activeTab, setActiveTab] = useState('send');

    const onFinish = async (values: any) => {
        setLoading(true);
        try {
            const attachments: any = {};
            if (values.points) attachments.points = values.points;
            if (values.coins) attachments.coins = values.coins;

            await messageService.sendMail({
                title: values.title,
                content: values.content,
                receiver_id: values.targetType === 'all' ? 'all' : values.receiver_id,
                type: values.type,
                attachments: Object.keys(attachments).length > 0 ? attachments : null,
            });
            message.success('邮件发送成功');
            form.resetFields();
        } catch (error) {
            console.error('发送失败:', error);
            message.error('发送失败，请检查用户ID是否正确');
        } finally {
            setLoading(false);
        }
    };

    const columns: any[] = [
        {
            title: '标题',
            dataIndex: 'title',
            width: 200,
        },
        {
            title: '接收者',
            dataIndex: 'receiver_id',
            render: (id: string, record: any) => (
                id ? <Tag icon={<UserOutlined />}>{record.receiver_name || id}</Tag> : <Tag color="blue" icon={<GlobalOutlined />}>全服广播</Tag>
            ),
        },
        {
            title: '类型',
            dataIndex: 'type',
            width: 100,
            render: (type: string) => {
                const configs: any = {
                    notification: <Tag>通知</Tag>,
                    reward: <Tag color="gold">奖励</Tag>,
                    activity: <Tag color="green">活动</Tag>,
                };
                return configs[type] || type;
            },
        },
        {
            title: '附件',
            dataIndex: 'attachments',
            render: (att: any) => {
                if (!att) return '-';
                const items = [];
                if (att.points) items.push(`${att.points} 积分`);
                if (att.coins) items.push(`${att.coins} 金币`);
                return items.join(', ');
            }
        },
        {
            title: '发送时间',
            dataIndex: 'created_at',
            width: 160,
            render: (text: any) => <Text type="secondary">{new Date(text).toLocaleString()}</Text>
        },
    ];

    return (
        <div style={{ padding: '0px' }}>
            <PageHeader
                title="系统信箱"
                description="向特定用户或全服玩家发送站内信，支持附件（如积分、金币奖励）发放"
                icon={<MailOutlined />}
            />

            <Card
                tabList={[
                    { key: 'send', tab: <span><SendOutlined /> 发送邮件</span> },
                    { key: 'history', tab: <span><HistoryOutlined /> 发送记录</span> },
                ]}
                activeTabKey={activeTab}
                onTabChange={(key) => setActiveTab(key)}
            >
                {activeTab === 'send' ? (
                    <div style={{ maxWidth: 800, margin: '24px auto' }}>
                        <Form
                            form={form}
                            layout="vertical"
                            onFinish={onFinish}
                            initialValues={{ targetType: 'single', type: 'notification' }}
                        >
                            <Row gutter={24}>
                                <Col span={12}>
                                    <Form.Item name="targetType" label="目标范围" rules={[{ required: true }]}>
                                        <Select>
                                            <Select.Option value="single">单个用户</Select.Option>
                                            <Select.Option value="all">全服广播 (慎用)</Select.Option>
                                        </Select>
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item
                                        noStyle
                                        shouldUpdate={(prev, curr) => prev.targetType !== curr.targetType}
                                    >
                                        {({ getFieldValue }) =>
                                            getFieldValue('targetType') === 'single' ? (
                                                <Form.Item name="receiver_id" label="目标用户 ID" rules={[{ required: true, message: '请输入接收者ID' }]}>
                                                    <Input placeholder="输入 UUID" />
                                                </Form.Item>
                                            ) : null
                                        }
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Row gutter={24}>
                                <Col span={16}>
                                    <Form.Item name="title" label="邮件标题" rules={[{ required: true, max: 50 }]}>
                                        <Input placeholder="输入邮件显示标题" />
                                    </Form.Item>
                                </Col>
                                <Col span={8}>
                                    <Form.Item name="type" label="邮件类型" rules={[{ required: true }]}>
                                        <Select>
                                            <Select.Option value="notification">普通通知</Select.Option>
                                            <Select.Option value="reward">奖励发放</Select.Option>
                                            <Select.Option value="activity">活动引导</Select.Option>
                                        </Select>
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Form.Item name="content" label="正文内容" rules={[{ required: true }]}>
                                <Input.TextArea rows={5} placeholder="输入正文详细内容..." />
                            </Form.Item>

                            <Title level={5} style={{ marginTop: 24, marginBottom: 16 }}>
                                <DollarOutlined /> 附件奖励 (可选)
                            </Title>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name="points" label="发放积分">
                                        <InputNumber style={{ width: '100%' }} min={0} placeholder="输入要发放的积分数量" />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="coins" label="发放金币">
                                        <InputNumber style={{ width: '100%' }} min={0} placeholder="输入要发放的金币数量" />
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Divider />

                            <div style={{ textAlign: 'center', marginTop: 32 }}>
                                <Button
                                    type="primary"
                                    size="large"
                                    htmlType="submit"
                                    icon={<SendOutlined />}
                                    loading={loading}
                                    style={{ width: 200 }}
                                >
                                    立即发送
                                </Button>
                                <Paragraph type="secondary" style={{ marginTop: 16 }}>
                                    提示：发送完成后无法撤回，涉及奖励发放请务必仔细核对目标用户。
                                </Paragraph>
                            </div>
                        </Form>
                    </div>
                ) : (
                    <SafeProTable
                        columns={columns}
                        request={async (params: any) => {
                            const res = await messageService.getSentMails({
                                current: params.current,
                                pageSize: params.pageSize,
                            });
                            return {
                                data: res.data.data?.list || [],
                                success: true,
                                total: res.data.data?.total || 0,
                            };
                        }}
                        rowKey="id"
                        search={false}
                        pagination={{ pageSize: 10 }}
                    />
                )}
            </Card>
        </div>
    );
};

export default SystemMailPage;
