import React, { useState, useRef } from 'react';
import {
    Button,
    Space,
    Tag,
    message,
    Modal,
    Form,
    Input,
    Select,
    Switch,
    Typography,
    Card,
    Row,
    Col,
    Statistic,
    DatePicker,
} from 'antd';
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    NotificationOutlined,
    PushpinOutlined,
    SoundOutlined,
    EyeOutlined,
} from '@ant-design/icons';
import { ProColumns, ActionType } from '@ant-design/pro-components';
import { announcementService } from '@/services';
import type { Announcement } from '@/services/announcement';
import SafeProTable from '@/components/SafeProTable';
import PageHeader from '@/components/PageHeader';
import dayjs from 'dayjs';

const { Text } = Typography;

const AnnouncementList: React.FC = () => {
    const [modalVisible, setModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState<Announcement | null>(null);
    const [loading, setLoading] = useState(false);
    const actionRef = useRef<ActionType>();
    const [form] = Form.useForm();

    const handleCreate = () => {
        setEditingItem(null);
        form.resetFields();
        form.setFieldsValue({
            type: 'global',
            display_style: 'none',
            is_active: true,
            is_pinned: false,
            priority: 0,
            publish_at: dayjs()
        });
        setModalVisible(true);
    };

    const handleEdit = (record: Announcement) => {
        setEditingItem(record);
        form.setFieldsValue({
            ...record,
            publish_at: dayjs(record.publish_at),
            expire_at: record.expire_at ? dayjs(record.expire_at) : null,
        });
        setModalVisible(true);
    };

    const handleDelete = (record: Announcement) => {
        Modal.confirm({
            title: '确认删除',
            content: '确定要删除这条公告吗？',
            okType: 'danger',
            onOk: async () => {
                try {
                    await announcementService.deleteAnnouncement(record.id);
                    message.success('删除成功');
                    actionRef.current?.reload();
                } catch (error) {
                    message.error('删除失败');
                }
            },
        });
    };

    const handleFinish = async (values: any) => {
        setLoading(true);
        try {
            const data = {
                ...values,
                publish_at: values.publish_at.toISOString(),
                expire_at: values.expire_at ? values.expire_at.toISOString() : null,
            };

            if (editingItem) {
                await announcementService.updateAnnouncement(editingItem.id, data);
                message.success('更新成功');
            } else {
                await announcementService.createAnnouncement(data);
                message.success('创建成功');
            }
            setModalVisible(false);
            actionRef.current?.reload();
        } catch (error) {
            message.error('操作失败');
        } finally {
            setLoading(false);
        }
    };

    const columns: ProColumns<Announcement>[] = [
        {
            title: '标题',
            dataIndex: 'title',
            ellipsis: true,
            render: (text, record) => (
                <Space>
                    {record.is_pinned && <PushpinOutlined style={{ color: '#ff4d4f' }} title="置顶" />}
                    <Text strong>{text}</Text>
                </Space>
            ),
        },
        {
            title: '类型',
            dataIndex: 'type',
            width: 100,
            valueEnum: {
                global: { text: '全域', status: 'Processing' },
                system: { text: '系统', status: 'Warning' },
                alliance: { text: '联盟', status: 'Success' },
            },
        },
        {
            title: '表现形式',
            dataIndex: 'display_style',
            width: 100,
            render: (style: any) => {
                const styles: any = {
                    none: <Tag>普通列表</Tag>,
                    marquee: <Tag color="orange" icon={<SoundOutlined />}>跑马灯</Tag>,
                    popup: <Tag color="blue" icon={<EyeOutlined />}>强力弹窗</Tag>,
                };
                return styles[style] || style;
            },
        },
        {
            title: '状态',
            dataIndex: 'is_active',
            width: 80,
            render: (active: any) => (
                <Tag color={active ? 'success' : 'default'}>{active ? '启用中' : '已归档'}</Tag>
            ),
        },
        {
            title: '发布者',
            dataIndex: 'author_name',
            width: 100,
        },
        {
            title: '发布时间',
            dataIndex: 'publish_at',
            valueType: 'dateTime',
            width: 160,
        },
        {
            title: '操作',
            valueType: 'option',
            width: 120,
            render: (_, record) => [
                <a key="edit" onClick={() => handleEdit(record)}><EditOutlined /> 编辑</a>,
                <a key="delete" style={{ color: '#ff4d4f' }} onClick={() => handleDelete(record)}><DeleteOutlined /> 删除</a>,
            ],
        },
    ];

    return (
        <div style={{ padding: '0px' }}>
            <PageHeader
                title="运营公告管理"
                description="管理游戏内全域、系统或联盟级别的通知公告，支持跑马灯与弹窗样式"
                icon={<NotificationOutlined />}
                extra={
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                        发布新公告
                    </Button>
                }
            />

            <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col span={6}>
                    <Card size="small">
                        <Statistic title="待生效/发布" value={2} valueStyle={{ color: '#1677ff' }} />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card size="small">
                        <Statistic title="进行中" value={5} valueStyle={{ color: '#52c41a' }} />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card size="small">
                        <Statistic title="跑马灯播放中" value={1} prefix={<SoundOutlined />} />
                    </Card>
                </Col>
            </Row>

            <SafeProTable
                columns={columns}
                actionRef={actionRef}
                request={async (params: any) => {
                    const res = await announcementService.getAnnouncements({
                        current: params.current,
                        pageSize: params.pageSize,
                        type: params.type || 'global'
                    });
                    return {
                        data: res.data.data?.list || [],
                        success: true,
                        total: res.data.data?.total || 0,
                    };
                }}
                rowKey="id"
                search={{
                    labelWidth: 'auto',
                }}
                pagination={{
                    pageSize: 10,
                }}
            />

            <Modal
                title={editingItem ? '编辑公告' : '发布新公告'}
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                onOk={() => form.submit()}
                confirmLoading={loading}
                width={720}
            >
                <Form form={form} layout="vertical" onFinish={handleFinish}>
                    <Row gutter={16}>
                        <Col span={16}>
                            <Form.Item name="title" label="标题" rules={[{ required: true }]}>
                                <Input placeholder="输入公告标题" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="type" label="类型" rules={[{ required: true }]}>
                                <Select>
                                    <Select.Option value="global">全域公告 (所有用户)</Select.Option>
                                    <Select.Option value="system">系统公告 (功能相关)</Select.Option>
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item name="content" label="正文内容" rules={[{ required: true }]}>
                        <Input.TextArea rows={6} placeholder="支持简单的文本内容描述..." />
                    </Form.Item>

                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item name="display_style" label="展示样式" tooltip="跑马灯会在顶端滚动，弹窗会在用户登录时强制弹出">
                                <Select>
                                    <Select.Option value="none">普通列表显示</Select.Option>
                                    <Select.Option value="marquee">顶部跑马灯</Select.Option>
                                    <Select.Option value="popup">登录强制弹窗</Select.Option>
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="priority" label="优先级 (值越大越靠前)">
                                <Input type="number" />
                            </Form.Item>
                        </Col>
                        <Col span={4}>
                            <Form.Item name="is_pinned" label="置顶" valuePropName="checked">
                                <Switch />
                            </Form.Item>
                        </Col>
                        <Col span={4}>
                            <Form.Item name="is_active" label="处于启用状态" valuePropName="checked">
                                <Switch />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="publish_at" label="发布时间" rules={[{ required: true }]}>
                                <DatePicker showTime style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="expire_at" label="过期时间">
                                <DatePicker showTime style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                    </Row>
                </Form>
            </Modal>
        </div>
    );
};

export default AnnouncementList;
