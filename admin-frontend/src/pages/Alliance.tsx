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
  Badge,
  Row,
  Col,
  Statistic,
  Drawer,
  Form,
  InputNumber,
  Switch,
  Popconfirm,
  Timeline,
  Descriptions,
} from 'antd';
import {
  SearchOutlined,
  TeamOutlined,
  UserOutlined,
  EyeOutlined,
  ReloadOutlined,
  CrownOutlined,
  TrophyOutlined,
  UsergroupAddOutlined,
  GlobalOutlined,
  EditOutlined,
  WarningOutlined,
  StopOutlined,
  CloseCircleOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import { allianceService, type Alliance, type AllianceMember, type AllianceModerationLog } from '@/services/alliance';
import { useAuth } from '@/contexts/AuthContext';
import type { ColumnsType } from 'antd/es/table';

const { Option } = Select;
const { TextArea } = Input;

const AlliancePage: React.FC = () => {
  const { user } = useAuth();
  const [alliances, setAlliances] = useState<Alliance[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [current, setCurrent] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchName, setSearchName] = useState('');
  const [filterStatus, setFilterStatus] = useState<'active' | 'inactive' | 'disbanded' | ''>('');

  // Members modal
  const [membersModalVisible, setMembersModalVisible] = useState(false);
  const [selectedAlliance, setSelectedAlliance] = useState<Alliance | null>(null);
  const [members, setMembers] = useState<AllianceMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // Edit drawer
  const [editDrawerVisible, setEditDrawerVisible] = useState(false);
  const [editForm] = Form.useForm();
  const [editLoading, setEditLoading] = useState(false);

  // Moderation modal (warn/suspend/ban/disband)
  const [moderationModalVisible, setModerationModalVisible] = useState(false);
  const [moderationAction, setModerationAction] = useState<string>('');
  const [moderationReason, setModerationReason] = useState('');
  const [moderationLoading, setModerationLoading] = useState(false);

  // Moderation logs drawer
  const [logsDrawerVisible, setLogsDrawerVisible] = useState(false);
  const [moderationLogs, setModerationLogs] = useState<AllianceModerationLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const [allianceStats, setAllianceStats] = useState({
    total: 0,
    active: 0,
    totalMembers: 0,
    publicAlliances: 0
  });

  const updateAllianceStats = (allianceList: Alliance[]) => {
    setAllianceStats({
      total: allianceList.length,
      active: allianceList.filter(a => a.status === 'active').length,
      totalMembers: allianceList.reduce((sum, a) => sum + (a.member_count || 0), 0),
      publicAlliances: allianceList.filter(a => a.status === 'active').length
    });
  };

  const loadAlliances = async () => {
    setLoading(true);
    try {
      const response = await allianceService.getAlliances({
        current, pageSize,
        name: searchName || undefined,
        status: filterStatus || undefined
      });
      setAlliances(response.list);
      setTotal(response.total);
      updateAllianceStats(response.list);
    } catch (error) {
      message.error('加载联盟列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadAllianceMembers = async (alliance: Alliance) => {
    setMembersLoading(true);
    try {
      const response = await allianceService.getAllianceMembers(alliance.id, { current: 1, pageSize: 100 });
      setMembers(response.list);
      setSelectedAlliance(alliance);
      setMembersModalVisible(true);
    } catch (error) {
      message.error('加载联盟成员失败');
    } finally {
      setMembersLoading(false);
    }
  };

  const handleSearch = () => { setCurrent(1); loadAlliances(); };
  const handleReset = () => { setSearchName(''); setFilterStatus(''); setCurrent(1); loadAlliances(); };
  const handleTableChange = (pagination: any) => { setCurrent(pagination.current); setPageSize(pagination.pageSize); };

  // Edit alliance
  const handleEditAlliance = (record: Alliance) => {
    setSelectedAlliance(record);
    editForm.setFieldsValue({
      name: record.name,
      description: record.description,
      notice: (record as any).notice,
      max_members: record.max_members,
      is_public: (record as any).is_public,
    });
    setEditDrawerVisible(true);
  };

  const handleEditSubmit = async () => {
    if (!selectedAlliance) return;
    setEditLoading(true);
    try {
      const values = await editForm.validateFields();
      await allianceService.adminEdit(selectedAlliance.id, values);
      message.success('联盟信息已更新');
      setEditDrawerVisible(false);
      loadAlliances();
    } catch (error) {
      message.error('更新失败');
    } finally {
      setEditLoading(false);
    }
  };

  // Moderation actions
  const openModerationModal = (alliance: Alliance, action: string) => {
    setSelectedAlliance(alliance);
    setModerationAction(action);
    setModerationReason('');
    setModerationModalVisible(true);
  };

  const handleModeration = async () => {
    if (!selectedAlliance) return;
    setModerationLoading(true);
    try {
      const id = selectedAlliance.id;
      switch (moderationAction) {
        case 'warn':
          await allianceService.adminWarn(id, moderationReason);
          message.success('已发出警告');
          break;
        case 'suspend':
          await allianceService.adminSuspend(id, moderationReason);
          message.success('联盟已暂停');
          break;
        case 'ban':
          await allianceService.adminBan(id, moderationReason);
          message.success('联盟已封禁');
          break;
        case 'disband':
          await allianceService.adminDisband(id, moderationReason);
          message.success('联盟已解散');
          break;
      }
      setModerationModalVisible(false);
      loadAlliances();
    } catch (error) {
      message.error('操作失败');
    } finally {
      setModerationLoading(false);
    }
  };

  const handleUnban = async (alliance: Alliance) => {
    try {
      await allianceService.adminUnban(alliance.id);
      message.success('联盟已解封');
      loadAlliances();
    } catch (error) {
      message.error('解封失败');
    }
  };

  // Kick member
  const handleKickMember = async (memberId: string) => {
    if (!selectedAlliance) return;
    try {
      await allianceService.adminKick(selectedAlliance.id, memberId, '管理员踢出');
      message.success('成员已被踢出');
      loadAllianceMembers(selectedAlliance);
    } catch (error) {
      message.error('踢出失败');
    }
  };

  // Load moderation logs
  const loadModerationLogs = async (alliance: Alliance) => {
    setSelectedAlliance(alliance);
    setLogsLoading(true);
    setLogsDrawerVisible(true);
    try {
      const result = await allianceService.getModerationLogs(alliance.id, { current: 1, pageSize: 50 });
      setModerationLogs(result.list);
    } catch (error) {
      message.error('加载日志失败');
    } finally {
      setLogsLoading(false);
    }
  };

  // Ban status tag
  const getBanStatusTag = (banStatus: string | null) => {
    if (!banStatus) return null;
    const config: Record<string, { color: string; text: string }> = {
      warned: { color: 'orange', text: '已警告' },
      suspended: { color: 'red', text: '已暂停' },
      banned: { color: '#f5222d', text: '已封禁' },
    };
    const c = config[banStatus] || { color: 'default', text: banStatus };
    return <Tag color={c.color}>{c.text}</Tag>;
  };

  const getStatusTag = (status: string) => {
    const statusConfig: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
      active: { color: '#10b981', text: '活跃', icon: <TrophyOutlined /> },
      inactive: { color: '#f59e0b', text: '非活跃', icon: <UserOutlined /> },
      disbanded: { color: '#ef4444', text: '已解散', icon: <UserOutlined /> }
    };
    const config = statusConfig[status] || { color: '#6b7280', text: status, icon: null };
    return (
      <Tag color={config.color} style={{ borderRadius: '12px', fontWeight: '500', padding: '4px 12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        {config.icon} {config.text}
      </Tag>
    );
  };

  const getRoleTag = (role: string) => {
    const roleConfig: Record<string, { color: string; text: string }> = {
      leader: { color: 'gold', text: '盟主' },
      officer: { color: 'blue', text: '官员' },
      member: { color: 'default', text: '成员' }
    };
    const config = roleConfig[role] || { color: 'default', text: role };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const getModerationActionTag = (action: string) => {
    const config: Record<string, { color: string; text: string }> = {
      warn: { color: 'orange', text: '警告' },
      suspend: { color: 'red', text: '暂停' },
      ban: { color: '#f5222d', text: '封禁' },
      unban: { color: 'green', text: '解封' },
      disband: { color: '#f5222d', text: '解散' },
      kick_member: { color: 'volcano', text: '踢出成员' },
      edit: { color: 'blue', text: '编辑' },
    };
    const c = config[action] || { color: 'default', text: action };
    return <Tag color={c.color}>{c.text}</Tag>;
  };

  const allianceColumns: ColumnsType<Alliance> = [
    {
      title: '联盟信息', key: 'info',
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Avatar size={48} src={record.badge} style={{ backgroundColor: '#1677ff', fontSize: '16px', fontWeight: 'bold', border: '2px solid #f0f0f0' }}>
            {record.name.charAt(0)}
          </Avatar>
          <div>
            <div style={{ fontWeight: '600', color: '#1f2937', fontSize: '14px', marginBottom: '2px' }}>{record.name}</div>
            <div style={{ color: '#6b7280', fontSize: '12px' }}>ID: {record.id}</div>
          </div>
        </div>
      )
    },
    {
      title: '成员', key: 'memberCount', width: 80,
      render: (_, record) => <Badge count={record.member_count || 0} showZero style={{ backgroundColor: '#1677ff' }} />,
      sorter: (a, b) => (a.member_count || 0) - (b.member_count || 0)
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (status) => getStatusTag(status),
    },
    {
      title: '管控状态', key: 'ban_status', width: 100,
      render: (_, record) => {
        const banStatus = (record as any).ban_status;
        const warnCount = (record as any).warn_count || 0;
        return (
          <Space direction="vertical" size={0}>
            {banStatus ? getBanStatusTag(banStatus) : <Tag color="green">正常</Tag>}
            {warnCount > 0 && <span style={{ fontSize: '11px', color: '#f59e0b' }}>警告 {warnCount} 次</span>}
          </Space>
        );
      }
    },
    {
      title: '公开性', dataIndex: 'is_public', key: 'is_public', width: 80,
      render: (isPublic) => <Tag color={isPublic ? '#10b981' : '#f59e0b'} style={{ borderRadius: '12px' }}>{isPublic ? '公开' : '私密'}</Tag>
    },
    {
      title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 160,
      render: (date) => <span style={{ color: '#6b7280', fontSize: '13px' }}>{new Date(date).toLocaleString('zh-CN')}</span>,
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    },
    {
      title: '操作', key: 'actions', width: 320, fixed: 'right',
      render: (_, record) => {
        const banStatus = (record as any).ban_status;
        return (
          <Space wrap size={[4, 4]}>
            <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => loadAllianceMembers(record)} style={{ color: '#1677ff' }}>成员</Button>
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEditAlliance(record)} style={{ color: '#1677ff' }}>编辑</Button>
            <Button type="text" size="small" icon={<HistoryOutlined />} onClick={() => loadModerationLogs(record)} style={{ color: '#8b5cf6' }}>日志</Button>
            {record.status === 'active' && (
              <>
                <Button type="text" size="small" icon={<WarningOutlined />} onClick={() => openModerationModal(record, 'warn')} style={{ color: '#f59e0b' }}>警告</Button>
                {banStatus !== 'suspended' && (
                  <Button type="text" size="small" icon={<StopOutlined />} onClick={() => openModerationModal(record, 'suspend')} style={{ color: '#ef4444' }}>暂停</Button>
                )}
                {banStatus !== 'banned' && (
                  <Button type="text" size="small" icon={<CloseCircleOutlined />} onClick={() => openModerationModal(record, 'ban')} style={{ color: '#ef4444' }}>封禁</Button>
                )}
              </>
            )}
            {banStatus && (
              <Popconfirm title="确认解封该联盟？" onConfirm={() => handleUnban(record)} okText="确认" cancelText="取消">
                <Button type="text" size="small" icon={<CheckCircleOutlined />} style={{ color: '#10b981' }}>解封</Button>
              </Popconfirm>
            )}
            <Button type="text" size="small" icon={<DeleteOutlined />} onClick={() => openModerationModal(record, 'disband')} style={{ color: '#ef4444' }}>解散</Button>
          </Space>
        );
      }
    }
  ];

  const memberColumns: ColumnsType<AllianceMember> = [
    {
      title: '用户信息', key: 'userInfo',
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Avatar size={32} src={record.avatar_url} icon={<UserOutlined />} />
          <div>
            <div style={{ fontWeight: 500 }}>{record.nickname}</div>
            <div style={{ color: '#666', fontSize: '12px' }}>@{record.username}</div>
          </div>
        </div>
      )
    },
    { title: '角色', dataIndex: 'role', key: 'role', render: (role) => getRoleTag(role) },
    { title: '用户权限', dataIndex: 'user_role', key: 'user_role', render: (userRole) => <Tag color="processing">{userRole}</Tag> },
    {
      title: '加入时间', dataIndex: 'joined_at', key: 'joined_at',
      render: (date) => new Date(date).toLocaleString('zh-CN'),
      sorter: (a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
    },
    {
      title: '操作', key: 'action', width: 80,
      render: (_, record) => (
        record.role !== 'leader' ? (
          <Popconfirm title={`确认踢出 ${record.nickname}？`} onConfirm={() => handleKickMember(record.user_id)} okText="确认" cancelText="取消">
            <Button type="text" size="small" danger icon={<DeleteOutlined />}>踢出</Button>
          </Popconfirm>
        ) : null
      )
    }
  ];

  useEffect(() => { loadAlliances(); }, [current, pageSize]);

  const getModerationActionTitle = () => {
    const titles: Record<string, string> = { warn: '警告联盟', suspend: '暂停联盟', ban: '封禁联盟', disband: '解散联盟' };
    return titles[moderationAction] || '管控操作';
  };

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      {/* 页面标题 */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', padding: '24px', marginBottom: '24px', border: '1px solid #f0f0f0', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ width: '40px', height: '40px', backgroundColor: '#1677ff', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '16px' }}>
            <TeamOutlined style={{ color: 'white', fontSize: '20px' }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '700', color: '#1f2937', lineHeight: '1.2' }}>联盟管理</h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#6b7280', lineHeight: '1.4' }}>管理平台联盟，维护社群生态</p>
          </div>
        </div>
        <Button icon={<ReloadOutlined />} onClick={handleReset} style={{ borderRadius: '8px', fontWeight: '500' }}>重置</Button>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        {[
          { title: '总联盟数', value: allianceStats.total, icon: <TeamOutlined style={{ color: '#1677ff' }} />, color: '#1677ff', desc: '平台联盟总量' },
          { title: '活跃联盟', value: allianceStats.active, icon: <CrownOutlined style={{ color: '#10b981' }} />, color: '#10b981', desc: '当前活跃状态联盟' },
          { title: '总成员数', value: allianceStats.totalMembers, icon: <UsergroupAddOutlined style={{ color: '#1677ff' }} />, color: '#1677ff', desc: '所有联盟成员总数' },
          { title: '公开联盟', value: allianceStats.publicAlliances, icon: <GlobalOutlined style={{ color: '#f59e0b' }} />, color: '#f59e0b', desc: '公开可加入的联盟' },
        ].map((stat, i) => (
          <Col span={6} key={i}>
            <Card style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #f0f0f0', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <Statistic title={stat.title} value={stat.value} prefix={stat.icon} valueStyle={{ color: stat.color }} />
              <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{stat.desc}</p>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 搜索 */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', padding: '20px', marginBottom: '24px', border: '1px solid #f0f0f0', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Input placeholder="搜索联盟名称" value={searchName} onChange={(e) => setSearchName(e.target.value)} style={{ width: 240 }} prefix={<SearchOutlined />} />
          <Select placeholder="选择状态" value={filterStatus} onChange={setFilterStatus} style={{ width: 160 }} allowClear>
            <Option value="active">活跃</Option>
            <Option value="inactive">非活跃</Option>
            <Option value="disbanded">已解散</Option>
          </Select>
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>搜索</Button>
        </div>
      </div>

      {/* 表格 */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #f0f0f0', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', padding: '24px' }}>
        <Table
          columns={allianceColumns}
          dataSource={alliances}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{ current, pageSize, total, showSizeChanger: true, showQuickJumper: true, showTotal: (t) => `共 ${t} 个联盟` }}
          onChange={handleTableChange}
        />
      </div>

      {/* 成员模态框 */}
      <Modal
        title={<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><TeamOutlined /><span>{selectedAlliance?.name} - 成员列表</span><Badge count={members.length} style={{ backgroundColor: '#1677ff' }} /></div>}
        open={membersModalVisible}
        onCancel={() => setMembersModalVisible(false)}
        footer={null}
        width={900}
      >
        <Table columns={memberColumns} dataSource={members} rowKey="id" loading={membersLoading} pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 名成员` }} size="small" />
      </Modal>

      {/* 编辑抽屉 */}
      <Drawer
        title={`编辑联盟: ${selectedAlliance?.name}`}
        open={editDrawerVisible}
        onClose={() => setEditDrawerVisible(false)}
        width={480}
        extra={<Button type="primary" onClick={handleEditSubmit} loading={editLoading}>保存</Button>}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item label="联盟名称" name="name" rules={[{ required: true, message: '请输入联盟名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item label="公告" name="notice">
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item label="最大成员数" name="max_members">
            <InputNumber min={1} max={1000} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="公开联盟" name="is_public" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Drawer>

      {/* 管控操作模态框 */}
      <Modal
        title={getModerationActionTitle()}
        open={moderationModalVisible}
        onCancel={() => setModerationModalVisible(false)}
        onOk={handleModeration}
        confirmLoading={moderationLoading}
        okText="确认执行"
        okButtonProps={{ danger: true }}
      >
        <Descriptions column={1} style={{ marginBottom: 16 }}>
          <Descriptions.Item label="联盟">{selectedAlliance?.name}</Descriptions.Item>
          <Descriptions.Item label="操作">{getModerationActionTitle()}</Descriptions.Item>
        </Descriptions>
        <div style={{ marginBottom: 8, fontWeight: 500 }}>操作原因</div>
        <TextArea
          rows={4}
          value={moderationReason}
          onChange={(e) => setModerationReason(e.target.value)}
          placeholder="请输入操作原因..."
        />
      </Modal>

      {/* 管控日志抽屉 */}
      <Drawer
        title={`管控日志: ${selectedAlliance?.name}`}
        open={logsDrawerVisible}
        onClose={() => setLogsDrawerVisible(false)}
        width={500}
      >
        {logsLoading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>加载中...</div>
        ) : moderationLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>暂无管控记录</div>
        ) : (
          <Timeline
            items={moderationLogs.map(log => ({
              color: log.action === 'ban' || log.action === 'disband' ? 'red' : log.action === 'warn' ? 'orange' : log.action === 'unban' ? 'green' : 'blue',
              children: (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    {getModerationActionTag(log.action)}
                    <span style={{ fontSize: '12px', color: '#999' }}>{new Date(log.created_at).toLocaleString('zh-CN')}</span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#333' }}>操作人: {log.admin_name}</div>
                  {log.reason && <div style={{ fontSize: '13px', color: '#666', marginTop: 2 }}>原因: {log.reason}</div>}
                </div>
              )
            }))}
          />
        )}
      </Drawer>
    </div>
  );
};

export default AlliancePage;
