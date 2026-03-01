import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AuthService, type AuthUser } from '../../services/auth';
import { ChatAPI, type GroupChat, type GroupMessage, type GroupMember, type CreateGroupData, type SendGroupMessageData } from '../../services/chat';
import socket from '../../services/socket';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Users, Plus, Search, Settings, Crown, Shield, User, LogOut, X, Send, MoreHorizontal } from 'lucide-react';
import { logger } from '../../utils/logger';
import { dialogService } from '../../services/dialogService';

const formatTimestamp = (timestamp: string) => {
  try {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    logger.error('格式化时间失败:', error);
    return '';
  }
};

const getGroupAvatar = (group: GroupChat) => {
  return group.avatar_url || '/default-group-avatar.png';
};

const getRoleIcon = (role: 'creator' | 'admin' | 'member') => {
  switch (role) {
    case 'creator':
      return <Crown className="w-4 h-4 text-yellow-500" />;
    case 'admin':
      return <Shield className="w-4 h-4 text-blue-500" />;
    default:
      return <User className="w-4 h-4 text-gray-500" />;
  }
};

const GroupChatModule: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [groups, setGroups] = useState<GroupChat[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<GroupChat | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 创建群聊相关状态
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [createGroupData, setCreateGroupData] = useState<CreateGroupData>({
    name: '',
    description: '',
    is_private: false,
    max_members: 256
  });

  // 加入群聊相关状态
  const [showJoinGroup, setShowJoinGroup] = useState(false);
  const [inviteCode, setInviteCode] = useState('');

  // 群聊详情相关状态
  const [showGroupDetails, setShowGroupDetails] = useState(false);
  const [groupStats, setGroupStats] = useState<any>(null);

  const loadCurrentUser = useCallback(async () => {
    if (!AuthService.isAuthenticated()) {
      setCurrentUser(null);
      return;
    }

    const user = await AuthService.getCurrentUser();
    if (user) {
      setCurrentUser(user);
      return;
    }

    const stored = localStorage.getItem('funnypixels_user') || localStorage.getItem('user');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as AuthUser;
        if (parsed?.id) {
          setCurrentUser(parsed);
        }
      } catch (error) {
        logger.error('解析本地用户信息失败:', error);
      }
    }
  }, []);

  const loadUserGroups = useCallback(async () => {
    if (!AuthService.isAuthenticated()) {
      setGroups([]);
      setSelectedGroup(null);
      return;
    }

    setLoadingGroups(true);
    try {
      const response = await ChatAPI.getUserGroups(50, 0);
      if (response.success) {
        setGroups(response.data);
        if (response.data.length > 0 && !selectedGroup) {
          setSelectedGroup(response.data[0]);
        }
      }
    } catch (error) {
      logger.error('加载群聊列表失败:', error);
      setGroups([]);
    } finally {
      setLoadingGroups(false);
    }
  }, [selectedGroup]);

  const loadGroupMessages = useCallback(async (group: GroupChat) => {
    setLoadingMessages(true);
    try {
      const response = await ChatAPI.getGroupMessages(group.id, 50, 0);
      if (response.success) {
        setMessages(response.data);
      } else {
        setMessages([]);
      }
    } catch (error) {
      logger.error('加载群聊消息失败:', error);
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const loadGroupMembers = useCallback(async (group: GroupChat) => {
    try {
      const response = await ChatAPI.getGroupMembers(group.id, 100, 0);
      if (response.success) {
        setMembers(response.data);
      }
    } catch (error) {
      logger.error('加载群聊成员失败:', error);
      setMembers([]);
    }
  }, []);

  const loadGroupDetails = useCallback(async (group: GroupChat) => {
    try {
      const response = await ChatAPI.getGroupDetails(group.id);
      if (response.success) {
        setGroupStats(response.data.stats);
        // 更新群聊信息，包括用户角色
        setSelectedGroup({
          ...group,
          user_role: response.data.user_role
        });
      }
    } catch (error) {
      logger.error('加载群聊详情失败:', error);
    }
  }, []);

  useEffect(() => {
    loadCurrentUser();
  }, [loadCurrentUser]);

  useEffect(() => {
    if (AuthService.isAuthenticated()) {
      loadUserGroups();
    }
  }, [loadUserGroups]);

  useEffect(() => {
    if (selectedGroup) {
      loadGroupMessages(selectedGroup);
      loadGroupMembers(selectedGroup);
      loadGroupDetails(selectedGroup);
    } else {
      setMessages([]);
      setMembers([]);
      setGroupStats(null);
    }
  }, [selectedGroup, loadGroupMessages, loadGroupMembers, loadGroupDetails]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Socket.io 连接处理
  useEffect(() => {
    if (!selectedGroup || !currentUser) {
      return;
    }

    socket.emit('join_chat_room', {
      channelType: 'group',
      channelId: selectedGroup.id,
      conversationId: selectedGroup.id
    });

    return () => {
      socket.emit('leave_chat_room', {});
    };
  }, [selectedGroup, currentUser]);

  const handleSendMessage = useCallback(async () => {
    if (!selectedGroup || !newMessage.trim()) {
      return;
    }

    const trimmed = newMessage.trim();
    const messageData: SendGroupMessageData = {
      content: trimmed,
      message_type: 'text'
    };

    setSending(true);
    try {
      const response = await ChatAPI.sendGroupMessage(selectedGroup.id, messageData);
      if (response.success && response.data) {
        setMessages(prev => [...prev, response.data]);
        setNewMessage('');
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 50);
      }
    } catch (error) {
      logger.error('发送群聊消息失败:', error);
    } finally {
      setSending(false);
    }
  }, [newMessage, selectedGroup]);

  const handleCreateGroup = useCallback(async () => {
    if (!createGroupData.name.trim()) {
      return;
    }

    try {
      const response = await ChatAPI.createGroup(createGroupData);
      if (response.success) {
        setShowCreateGroup(false);
        setCreateGroupData({
          name: '',
          description: '',
          is_private: false,
          max_members: 256
        });
        await loadUserGroups();
      }
    } catch (error) {
      logger.error('创建群聊失败:', error);
    }
  }, [createGroupData, loadUserGroups]);

  const handleJoinGroup = useCallback(async () => {
    if (!inviteCode.trim()) {
      return;
    }

    try {
      const response = await ChatAPI.joinGroupByInvite(inviteCode.trim());
      if (response.success) {
        setShowJoinGroup(false);
        setInviteCode('');
        await loadUserGroups();
      }
    } catch (error) {
      logger.error('加入群聊失败:', error);
    }
  }, [inviteCode, loadUserGroups]);

  const handleLeaveGroup = useCallback(async (group: GroupChat) => {
    const confirmed = await dialogService.confirm(`确定要退出群聊"${group.name}"吗？`, {
      title: '退出群聊',
      type: 'warning'
    });
    if (!confirmed) {
      return;
    }

    try {
      await ChatAPI.leaveGroup(group.id);
      await loadUserGroups();
      if (selectedGroup?.id === group.id) {
        setSelectedGroup(null);
      }
    } catch (error) {
      logger.error('退出群聊失败:', error);
    }
  }, [loadUserGroups, selectedGroup]);

  if (!AuthService.isAuthenticated()) {
    return (
      <Card className="h-full">
        <CardContent className="h-full flex items-center justify-center">
          <div className="text-center space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">请先登录以使用群聊功能</h3>
            <Button onClick={() => { window.location.href = '/login'; }}>前往登录</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full min-h-0 pb-24 md:pb-4 max-h-screen">
      {/* 群聊列表 */}
      <Card className="lg:col-span-1 flex flex-col min-h-0">
        <CardContent className="flex-1 overflow-hidden p-0 min-h-0">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-gray-800">我的群聊</h2>
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowJoinGroup(true)}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                  title="加入群聊"
                >
                  <Search className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowCreateGroup(true)}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                  title="创建群聊"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            <p className="text-sm text-gray-500">与更多玩家一起交流</p>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            {loadingGroups ? (
              <div className="p-4 text-sm text-gray-500">加载中...</div>
            ) : groups.length === 0 ? (
              <div className="p-4 text-sm text-gray-500 text-center">
                <p>暂无群聊</p>
                <p className="text-xs mt-1">创建或加入群聊开始聊天</p>
              </div>
            ) : (
              <ul className="divide-y">
                {groups.map(group => {
                  const isActive = selectedGroup?.id === group.id;
                  return (
                    <li
                      key={group.id}
                      className={`relative group transition ${
                        isActive ? 'bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div
                        className="flex items-center space-x-3 p-4 cursor-pointer"
                        onClick={() => setSelectedGroup(group)}
                      >
                        <img
                          src={getGroupAvatar(group)}
                          alt={group.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-800 truncate">
                              {group.name}
                            </span>
                            <div className="flex items-center space-x-1">
                              {getRoleIcon(group.user_role || 'member')}
                              <span className="text-xs text-gray-400">
                                {group.member_count}
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 truncate mt-1">
                            {group.description || '暂无描述'}
                          </p>
                        </div>
                      </div>

                      {/* 操作按钮 */}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLeaveGroup(group);
                          }}
                          className="p-1 rounded-full hover:bg-gray-200 text-red-500 hover:text-red-600"
                          title="退出群聊"
                        >
                          <LogOut className="w-3 h-3" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 群聊消息区域 */}
      <Card className="lg:col-span-2 flex flex-col min-h-0">
        {selectedGroup ? (
          <>
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <img
                    src={getGroupAvatar(selectedGroup)}
                    alt={selectedGroup.name}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">
                      {selectedGroup.name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {selectedGroup.member_count} 名成员
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowGroupDetails(true)}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full"
                    title="群聊详情"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <CardContent className="flex-1 overflow-hidden p-0 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 min-h-0">
                {loadingMessages ? (
                  <div className="text-sm text-gray-500">消息加载中...</div>
                ) : messages.length === 0 ? (
                  <div className="text-sm text-gray-500">目前还没有消息，发送第一条吧！</div>
                ) : (
                  messages.map(message => {
                    const isOwn = message.sender_id === currentUser?.id;
                    const isSystem = message.message_type === 'system';

                    if (isSystem) {
                      return (
                        <div key={message.id} className="text-center">
                          <span className="text-xs text-gray-500 bg-gray-200 px-3 py-1 rounded-full">
                            {message.content}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={message.id}
                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-xl ${isOwn ? 'order-2' : 'order-1'}`}>
                          {!isOwn && (
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="text-xs font-medium text-gray-600">
                                {message.sender_display_name || message.sender_username}
                              </span>
                            </div>
                          )}
                          <div
                            className={`rounded-lg px-4 py-2 shadow-sm ${
                              isOwn ? 'bg-blue-500 text-white' : 'bg-white text-gray-800'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap break-words">
                              {message.content}
                            </p>
                            <div className={`text-xs mt-1 ${isOwn ? 'text-blue-100' : 'text-gray-400'}`}>
                              {formatTimestamp(message.created_at)}
                              {message.is_edited && (
                                <span className="ml-1 opacity-75">已编辑</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t p-4 bg-white shrink-0 relative z-10">
                <div className="flex space-x-3">
                  <Input
                    value={newMessage}
                    onChange={(value: string) => setNewMessage(value)}
                    placeholder="输入消息..."
                    disabled={sending}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={sending || !newMessage.trim()}
                    className="bg-blue-500 hover:bg-blue-600 text-white"
                  >
                    {sending ? '发送中...' : <Send className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </CardContent>
          </>
        ) : (
          <CardContent className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4">
              <Users className="w-16 h-16 text-gray-300 mx-auto" />
              <h3 className="text-lg font-semibold text-gray-800">选择一个群聊开始聊天</h3>
              <p className="text-sm text-gray-500">在左侧选择或创建一个新的群聊</p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* 创建群聊弹窗 */}
      {showCreateGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">创建群聊</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  群聊名称 *
                </label>
                <Input
                  value={createGroupData.name}
                  onChange={(value: string) => setCreateGroupData(prev => ({ ...prev, name: value }))}
                  placeholder="输入群聊名称..."
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  群聊描述
                </label>
                <textarea
                  value={createGroupData.description}
                  onChange={(e) => setCreateGroupData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="输入群聊描述..."
                  className="w-full p-3 border border-gray-300 rounded-lg text-sm resize-none"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  最大成员数量
                </label>
                <select
                  value={createGroupData.max_members}
                  onChange={(e) => setCreateGroupData(prev => ({ ...prev, max_members: parseInt(e.target.value) }))}
                  className="w-full p-3 border border-gray-300 rounded-lg text-sm"
                >
                  <option value={32}>32人</option>
                  <option value={64}>64人</option>
                  <option value={128}>128人</option>
                  <option value={256}>256人</option>
                </select>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_private"
                  checked={createGroupData.is_private}
                  onChange={(e) => setCreateGroupData(prev => ({ ...prev, is_private: e.target.checked }))}
                  className="mr-2"
                />
                <label htmlFor="is_private" className="text-sm text-gray-700">
                  私有群聊（仅通过邀请加入）
                </label>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <Button
                onClick={() => setShowCreateGroup(false)}
                variant="outline"
              >
                取消
              </Button>
              <Button
                onClick={handleCreateGroup}
                disabled={!createGroupData.name.trim()}
                className="bg-blue-500 hover:bg-blue-600 text-white"
              >
                创建群聊
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 加入群聊弹窗 */}
      {showJoinGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">加入群聊</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  邀请码
                </label>
                <Input
                  value={inviteCode}
                  onChange={(value: string) => setInviteCode(value)}
                  placeholder="输入8位邀请码..."
                  className="w-full"
                  maxLength={8}
                />
              </div>
              <div className="text-sm text-gray-600">
                <p>💡 提示：</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>邀请码由群主或管理员提供</li>
                  <li>邀请码为8位字母数字组合</li>
                  <li>加入成功后即可开始聊天</li>
                </ul>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <Button
                onClick={() => {
                  setShowJoinGroup(false);
                  setInviteCode('');
                }}
                variant="outline"
              >
                取消
              </Button>
              <Button
                onClick={handleJoinGroup}
                disabled={!inviteCode.trim()}
                className="bg-blue-500 hover:bg-blue-600 text-white"
              >
                加入群聊
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupChatModule;