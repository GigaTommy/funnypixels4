import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AuthService, type AuthUser } from '../../services/auth';
import { ChatAPI, type ChatMessage, type Conversation, type SendMessageData, type PrivateMessageLimits } from '../../services/chat';
import { SocialAPI } from '../../services/social';
import socket from '../../services/socket';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { PrivacySettingsModal } from './PrivacySettingsModal';
import { MessageRequestsModal } from './MessageRequestsModal';
import { Heart, UserPlus, AlertCircle, Clock, X, Edit3, MoreHorizontal, Check, XIcon, Pin, PinOff, Volume2, VolumeX, Settings, Shield, Mail } from 'lucide-react';
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

const getConversationTitle = (conversation: Conversation) => {
  if (conversation.other_user) {
    return conversation.other_user.display_name || conversation.other_user.username || '私信会话';
  }
  return conversation.title || '私信会话';
};

const getConversationAvatar = (conversation: Conversation) => {
  return conversation.other_user?.avatar_url || conversation.avatar || '/default-avatar.png';
};

const PrivateMessageModule: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageIdsRef = useRef<Set<string>>(new Set());
  const selectedConversationRef = useRef<Conversation | null>(null);

  // 新增状态
  const [messageLimits, setMessageLimits] = useState<PrivateMessageLimits | null>(null);
  const [followStatus, setFollowStatus] = useState<{
    isFollowing: boolean;
    isFollowedBy: boolean;
    isMutual: boolean;
  } | null>(null);
  const [showCreateConversation, setShowCreateConversation] = useState(false);
  const [searchUsername, setSearchUsername] = useState('');
  const [limitError, setLimitError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);

  // 消息编辑相关状态
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [showMessageOptions, setShowMessageOptions] = useState<string | null>(null);

  // 静音相关状态
  const [showMuteOptions, setShowMuteOptions] = useState<string | null>(null);
  const [muteOptions] = useState([
    { value: '1h', label: '1小时' },
    { value: '8h', label: '8小时' },
    { value: '1w', label: '1周' },
    { value: 'forever', label: '永久' }
  ]);

  // 隐私和消息请求相关状态
  const [showPrivacySettings, setShowPrivacySettings] = useState(false);
  const [showMessageRequests, setShowMessageRequests] = useState(false);
  const [messageRequestCount, setMessageRequestCount] = useState(0);

  // 每日限制相关状态
  const [dailyLimits, setDailyLimits] = useState<any>(null);

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

  const refreshConversations = useCallback(async (preserveSelection = false) => {
    if (!AuthService.isAuthenticated()) {
      setConversations([]);
      setSelectedConversation(null);
      return;
    }

    setLoadingConversations(true);
    setApiError(null);

    try {
      const response = await ChatAPI.getConversations(50, 0);
      if (!response.success) {
        logger.error('API返回失败状态:', response);
        setApiError('获取会话列表失败，请检查网络连接');
        setConversations([]);
        setSelectedConversation(null);
        return;
      }

      const privateConversations = response.data.filter(conversation => conversation.type === 'private');
      setConversations(privateConversations);
      setApiError(null);

      if (privateConversations.length === 0) {
        setSelectedConversation(null);
        return;
      }

      if (preserveSelection) {
        // 使用函数更新以获取当前状态
        setSelectedConversation(current => {
          if (current) {
            const existing = privateConversations.find(conv => conv.id === current.id);
            if (existing) {
              return existing;
            }
          }
          return privateConversations[0];
        });
      } else {
        setSelectedConversation(privateConversations[0]);
      }
    } catch (error: any) {
      logger.error('加载私信会话失败:', error);

      // 网络或服务器错误时设置错误状态
      if (error.response?.status === 500) {
        setApiError('服务器内部错误，请稍后重试');
      } else if (error.code === 'NETWORK_ERROR') {
        setApiError('网络连接失败，请检查网络设置');
      } else {
        setApiError('加载失败，请重试');
      }

      setConversations([]);
      setSelectedConversation(null);
    } finally {
      setLoadingConversations(false);
    }
  }, []); // 空依赖数组，避免重复渲染

  const loadMessagesForConversation = useCallback(async (conversation: Conversation) => {
    setLoadingMessages(true);
    try {
      const response = await ChatAPI.getConversationMessages(conversation.id, 100, 0);
      if (response.success) {
        const conversationMessages = response.data;
        messageIdsRef.current = new Set(conversationMessages.map(message => message.id));
        setMessages(conversationMessages);

        if (conversationMessages.length > 0) {
          const lastMessageId = conversationMessages[conversationMessages.length - 1]?.id;
          if (lastMessageId) {
            try {
              await ChatAPI.markConversationAsRead(conversation.id, lastMessageId);
              logger.debug('✅ 对话已标记为已读:', conversation.id);
            } catch (markReadError) {
              logger.warn('⚠️ 标记已读失败，但不影响消息显示:', markReadError);
            }
          }
        }

        setConversations(prev => prev.map(conv => (
          conv.id === conversation.id ? { ...conv, unread_count: 0 } : conv
        )));
      } else {
        setMessages([]);
      }
    } catch (error) {
      logger.error('加载私信消息失败:', error);
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  // 加载私信限制信息
  const loadMessageLimits = useCallback(async () => {
    try {
      const response = await ChatAPI.getPrivateMessageLimits();
      if (response.success) {
        setMessageLimits(response.data);
      }
    } catch (error) {
      logger.error('加载私信限制信息失败:', error);
    }
  }, []);

  // 检查与当前会话用户的关注状态
  const loadFollowStatus = useCallback(async (userId: string) => {
    try {
      const response = await SocialAPI.checkFollowStatus(userId);
      if (response.success) {
        setFollowStatus(response.data);
      }
    } catch (error) {
      logger.error('加载关注状态失败:', error);
    }
  }, []);

  // 加载消息请求数量
  const loadMessageRequestCount = useCallback(async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/privacy/message-requests`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('funnypixels_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setMessageRequestCount(data.data.unread_count || 0);
      }
    } catch (error) {
      logger.error('加载消息请求数量失败:', error);
    }
  }, []);

  // 加载每日限制状态
  const loadDailyLimits = useCallback(async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/private-messages/daily-limits`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('funnypixels_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setDailyLimits(data.data);
      }
    } catch (error) {
      logger.error('加载每日限制状态失败:', error);
    }
  }, []);

  useEffect(() => {
    loadCurrentUser();
  }, [loadCurrentUser]);

  // 只在组件挂载或认证状态改变时加载
  useEffect(() => {
    if (AuthService.isAuthenticated()) {
      refreshConversations();
      loadMessageLimits();
      loadMessageRequestCount();
      loadDailyLimits();
    }
  }, []); // 空依赖数组，只在组件挂载时运行

  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
    if (selectedConversation) {
      loadMessagesForConversation(selectedConversation);
      // 加载与该用户的关注状态
      if (selectedConversation.other_user?.id) {
        loadFollowStatus(selectedConversation.other_user.id);
      }
    } else {
      setMessages([]);
      setFollowStatus(null);
    }
  }, [selectedConversation?.id]); // 只依赖ID，避免对象引用变化导致的重渲染

  useEffect(() => {
    if (!selectedConversation || selectedConversation.type !== 'private') {
      return;
    }

    const channelId = selectedConversation.other_user?.id;
    if (!channelId) {
      return;
    }

    socket.emit('join_chat_room', {
      channelType: 'private',
      channelId,
      conversationId: selectedConversation.id
    });

    return () => {
      socket.emit('leave_chat_room', {});
    };
  }, [selectedConversation?.id, selectedConversation?.other_user?.id]); // 只依赖具体的ID

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    socket.emit('authenticate', {
      userId: currentUser.id,
      username: currentUser.display_name || currentUser.username || currentUser.id
    });
  }, [currentUser]);

  useEffect(() => {
    if (!AuthService.isAuthenticated()) {
      return;
    }

    const handleBatch = (batch: any) => {
      if (!batch || !Array.isArray(batch.messages)) {
        return;
      }

      const incoming = batch.messages as ChatMessage[];
      if (incoming.length === 0) {
        return;
      }

      // 使用ref来获取当前选中的对话ID，避免闭包问题
      const activeConversationId = selectedConversationRef.current?.id || null;
      const conversationMap = new Map<string, ChatMessage[]>();

      incoming.forEach(message => {
        if (!message?.conversation_id) {
          return;
        }
        if (!conversationMap.has(message.conversation_id)) {
          conversationMap.set(message.conversation_id, []);
        }
        conversationMap.get(message.conversation_id)?.push(message);
      });

      if (conversationMap.size === 0) {
        return;
      }

      setConversations(prev => prev.map(conversation => {
        const updates = conversationMap.get(conversation.id);
        if (!updates || updates.length === 0) {
          return conversation;
        }

        const latest = updates[updates.length - 1];
        const isActive = conversation.id === activeConversationId;

        return {
          ...conversation,
          last_message: {
            content: latest.content,
            sender_name: latest.sender_name,
            created_at: latest.created_at,
            message_type: latest.message_type
          },
          unread_count: isActive ? 0 : (conversation.unread_count || 0) + updates.length
        };
      }));

      if (activeConversationId && conversationMap.has(activeConversationId)) {
        const relevantMessages = conversationMap.get(activeConversationId) ?? [];
        if (relevantMessages.length > 0) {
          let added = 0;
          setMessages(prev => {
            const next = [...prev];
            const seen = new Set(messageIdsRef.current);
            relevantMessages.forEach(message => {
              if (!message?.id || seen.has(message.id)) {
                return;
              }
              seen.add(message.id);
              next.push(message);
              added += 1;
            });
            if (added === 0) {
              return prev;
            }
            messageIdsRef.current = seen;
            return next;
          });

          if (added > 0) {
            const lastMessageId = relevantMessages[relevantMessages.length - 1]?.id;
            if (lastMessageId && activeConversationId) {
              ChatAPI.markConversationAsRead(activeConversationId, lastMessageId).catch(error => {
                logger.error('标记私信已读失败:', error);
              });
            }
            setTimeout(() => {
              messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 50);
          }
        }
      }
    };

    socket.on('chat_message_batch', handleBatch);

    return () => {
      socket.off('chat_message_batch', handleBatch);
    };
  }, []); // 空依赖数组，因为我们使用ref获取最新值

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = useCallback(async () => {
    if (!selectedConversation || !newMessage.trim()) {
      return;
    }

    // 检查发送限制
    if (messageLimits) {
      // 如果不是互相关注，检查限制
      if (!followStatus?.isMutual) {
        if (messageLimits.isMessageLimitReached) {
          setLimitError(`今日私信发送次数已达上限 (${messageLimits.dailyMessageLimit})`);
          return;
        }
        if (messageLimits.isTargetLimitReached) {
          setLimitError(`今日私信对象数量已达上限 (${messageLimits.dailyTargetLimit})`);
          return;
        }
        if (messageLimits.isRateLimitReached) {
          setLimitError('发送频率过快，请稍后再试');
          return;
        }
      }
    }

    const trimmed = newMessage.trim();
    const messageData: SendMessageData = {
      conversationId: selectedConversation.id,
      messageType: 'text',
      content: trimmed
    };

    setSending(true);
    setLimitError(null);
    try {
      const response = await ChatAPI.sendMessage(messageData);
      if (response.success && response.data) {
        const created = response.data;
        if (created.id && !messageIdsRef.current.has(created.id)) {
          messageIdsRef.current.add(created.id);
          setMessages(prev => [...prev, created]);
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 50);
        }
        setNewMessage('');
        // 只在必要时重新加载，避免频繁更新
        setTimeout(() => {
          refreshConversations(true);
          loadMessageLimits();
          loadDailyLimits();
        }, 100);
      }
    } catch (error) {
      logger.error('发送私信失败:', error);
      if (error instanceof Error) {
        setLimitError(error.message);
      }
    } finally {
      setSending(false);
    }
  }, [newMessage, selectedConversation, messageLimits, followStatus]);

  // 处理关注/取消关注
  const handleToggleFollow = useCallback(async () => {
    if (!selectedConversation?.other_user?.id) return;

    try {
      const userId = selectedConversation.other_user.id;
      if (followStatus?.isFollowing) {
        await SocialAPI.unfollowUser(userId);
      } else {
        await SocialAPI.followUser(userId);
      }
      // 重新加载关注状态
      await loadFollowStatus(userId);
    } catch (error) {
      logger.error('操作失败:', error);
    }
  }, [selectedConversation, followStatus, loadFollowStatus]);

  // 创建新会话
  const handleCreateConversation = useCallback(async () => {
    if (!searchUsername.trim()) return;

    try {
      // 这里应该先根据用户名查找用户，然后创建会话
      // 暂时使用模拟实现
      const response = await ChatAPI.createOrGetPrivateConversation(searchUsername);
      if (response.success) {
        setShowCreateConversation(false);
        setSearchUsername('');
        await refreshConversations();
      }
    } catch (error) {
      logger.error('创建会话失败:', error);
    }
  }, [searchUsername, refreshConversations]);

  // 编辑消息
  const handleEditMessage = useCallback(async (messageId: string, newContent: string) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/private-messages/messages/${messageId}/edit`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('funnypixels_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: newContent })
      });

      if (response.ok) {
        const data = await response.json();
        // 更新本地消息
        setMessages(prev => prev.map(msg =>
          msg.id === messageId
            ? { ...msg, content: newContent, is_edited: true, edit_count: data.data.edit_count }
            : msg
        ));
        setEditingMessageId(null);
        setEditingContent('');
        setShowMessageOptions(null);
      } else {
        const errorData = await response.json();
        await dialogService.alert(errorData.message || '编辑失败', {
          type: 'error',
          title: '编辑失败'
        });
      }
    } catch (error) {
      logger.error('编辑消息失败:', error);
      await dialogService.alert('编辑失败，请重试', {
        type: 'error',
        title: '编辑失败'
      });
    }
  }, []);

  // 开始编辑消息
  const startEditMessage = useCallback((message: ChatMessage) => {
    setEditingMessageId(message.id);
    setEditingContent(message.content);
    setShowMessageOptions(null);
  }, []);

  // 取消编辑
  const cancelEdit = useCallback(() => {
    setEditingMessageId(null);
    setEditingContent('');
  }, []);

  // 置顶/取消置顶对话
  const handleTogglePin = useCallback(async (conversation: Conversation) => {
    try {
      const otherUserId = conversation.other_user?.id;
      if (!otherUserId) return;

      const isCurrentlyPinned = conversation.is_pinned;
      const method = isCurrentlyPinned ? 'DELETE' : 'POST';
      const url = `${import.meta.env.VITE_API_BASE_URL}/api/private-messages/conversations/${otherUserId}/pin`;

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('funnypixels_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // 刷新对话列表
        await refreshConversations(true);
      } else {
        const errorData = await response.json();
        await dialogService.alert(errorData.message || (isCurrentlyPinned ? '取消置顶失败' : '置顶失败'), {
          type: 'error',
          title: '操作失败'
        });
      }
    } catch (error) {
      logger.error('置顶操作失败:', error);
      await dialogService.alert('操作失败，请重试', {
        type: 'error',
        title: '操作失败'
      });
    }
  }, [refreshConversations]);

  // 静音/取消静音对话
  const handleToggleMute = useCallback(async (conversation: Conversation, muteType?: string) => {
    try {
      const otherUserId = conversation.other_user?.id;
      if (!otherUserId) return;

      const isCurrentlyMuted = conversation.is_muted;

      if (isCurrentlyMuted) {
        // 取消静音
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/private-messages/conversations/${otherUserId}/mute`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('funnypixels_token')}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          await refreshConversations(true);
          setShowMuteOptions(null);
        } else {
          const errorData = await response.json();
          await dialogService.alert(errorData.message || '取消静音失败', {
            type: 'error',
            title: '操作失败'
          });
        }
      } else {
        // 静音
        if (!muteType) {
          // 显示静音选项
          setShowMuteOptions(conversation.id);
          return;
        }

        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/private-messages/conversations/${otherUserId}/mute`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('funnypixels_token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ mute_type: muteType })
        });

        if (response.ok) {
          await refreshConversations(true);
          setShowMuteOptions(null);
        } else {
          const errorData = await response.json();
          await dialogService.alert(errorData.message || '静音失败', {
            type: 'error',
            title: '操作失败'
          });
        }
      }
    } catch (error) {
      logger.error('静音操作失败:', error);
      await dialogService.alert('操作失败，请重试', {
        type: 'error',
        title: '操作失败'
      });
    }
  }, [refreshConversations]);

  // 格式化静音到期时间
  const formatMuteUntil = (muteUntil: string | null, muteType: string) => {
    if (muteType === 'forever') {
      return '永久静音';
    }
    if (muteUntil) {
      const date = new Date(muteUntil);
      return `静音至 ${date.toLocaleString('zh-CN')}`;
    }
    return '';
  };

  // 搜索会话和用户
  const filterConversations = useCallback(() => {
    if (!searchQuery.trim()) {
      setFilteredConversations(conversations);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = conversations.filter(conversation => {
      // 搜索用户名
      if (conversation.other_user?.username?.toLowerCase().includes(query)) {
        return true;
      }
      // 搜索显示名
      if (conversation.other_user?.display_name?.toLowerCase().includes(query)) {
        return true;
      }
      // 搜索会话标题
      if (conversation.title?.toLowerCase().includes(query)) {
        return true;
      }
      // 搜索最后一条消息内容
      if (conversation.last_message?.content?.toLowerCase().includes(query)) {
        return true;
      }
      return false;
    });

    setFilteredConversations(filtered);
  }, [conversations, searchQuery]);

  // 监听会话列表和搜索词变化
  useEffect(() => {
    filterConversations();
  }, [conversations, searchQuery, filterConversations]); // 添加函数依赖

  // 高亮搜索关键词
  const highlightSearchTerm = (text: string, searchTerm: string) => {
    if (!searchTerm.trim()) return text;

    const regex = new RegExp(`(${searchTerm})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) => {
      if (part.toLowerCase() === searchTerm.toLowerCase()) {
        return (
          <span key={index} className="bg-yellow-200 font-semibold">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const renderMessageContent = (message: ChatMessage) => {
    if (message.message_type === 'image') {
      const imageUrl = message.metadata?.image_url || message.metadata?.imageUrl || message.content;
      return (
        <div className="space-y-2">
          {imageUrl && (
            <a href={imageUrl} target="_blank" rel="noopener noreferrer">
              <img
                src={imageUrl}
                alt={message.content || '图片消息'}
                className="max-w-xs rounded-md border"
              />
            </a>
          )}
          {message.content && <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>}
        </div>
      );
    }

    if (message.message_type === 'location') {
      const metadata = message.metadata || {};
      const preview = metadata.previewUrl || metadata.preview_url;
      return (
        <div className="space-y-2">
          <div className="text-sm font-semibold">{metadata.label || '位置消息'}</div>
          {preview && (
            <img
              src={preview}
              alt="位置预览"
              className="max-w-xs rounded-md border"
            />
          )}
          <button
            type="button"
            className="text-xs text-blue-600 hover:text-blue-800"
            onClick={() => {
              if (metadata.linkUrl) {
                window.open(metadata.linkUrl, '_blank', 'noopener,noreferrer');
              }
            }}
          >
            查看地图
          </button>
        </div>
      );
    }

    return <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>;
  };

  if (!AuthService.isAuthenticated()) {
    return (
      <Card className="h-full">
        <CardContent className="h-full flex items-center justify-center">
          <div className="text-center space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">请先登录以使用私信功能</h3>
            <Button onClick={() => { window.location.href = '/login'; }}>前往登录</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full min-h-0 pb-24 md:pb-4 max-h-screen">
      <Card className="lg:col-span-1 flex flex-col min-h-0">
        <CardContent className="flex-1 overflow-hidden p-0 min-h-0">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-gray-800">我的私信</h2>
              <div className="flex space-x-2">
                {/* 消息请求按钮 */}
                <button
                  onClick={() => setShowMessageRequests(true)}
                  className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                  title="消息请求"
                >
                  <Mail className="w-4 h-4" />
                  {messageRequestCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                      {messageRequestCount}
                    </span>
                  )}
                </button>

                {/* 隐私设置按钮 */}
                <button
                  onClick={() => setShowPrivacySettings(true)}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                  title="隐私设置"
                >
                  <Shield className="w-4 h-4" />
                </button>
              </div>
            </div>
            <p className="text-sm text-gray-500">与关注的玩家保持联系</p>
          </div>

          <div className="p-4 border-b">
            <div className="flex space-x-2">
              <div className="flex-1 relative">
                <Input
                  value={searchQuery}
                  onChange={(value: string) => setSearchQuery(value)}
                  placeholder="搜索用户或会话"
                  className="w-full pr-8"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    title="清空搜索"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <Button
                onClick={() => setShowCreateConversation(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-3"
              >
                <UserPlus className="w-4 h-4" />
              </Button>
            </div>

            {/* 搜索结果提示 */}
            {searchQuery && (
              <div className="mt-2 text-xs text-gray-600">
                {filteredConversations.length > 0 ? (
                  <span>找到 {filteredConversations.length} 个会话</span>
                ) : (
                  <span>未找到匹配的会话</span>
                )}
              </div>
            )}

            {/* 每日限制信息 */}
            {dailyLimits && (
              <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm">
                <div className="flex items-center text-orange-700 mb-2">
                  <Clock className="w-4 h-4 mr-1" />
                  <span className="font-medium">每日限制状态</span>
                </div>
                <div className="space-y-1 text-orange-600">
                  <div className="flex justify-between">
                    <span>新对话:</span>
                    <span className={`font-medium ${
                      dailyLimits.new_conversations.remaining === 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {dailyLimits.new_conversations.current}/{dailyLimits.new_conversations.max}
                      {dailyLimits.new_conversations.remaining > 0 && (
                        ` (剩余${dailyLimits.new_conversations.remaining})`
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>消息数量:</span>
                    <span className={`font-medium ${
                      dailyLimits.messages.remaining === 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {dailyLimits.messages.current}/{dailyLimits.messages.max}
                      {dailyLimits.messages.remaining > 0 && (
                        ` (剩余${dailyLimits.messages.remaining})`
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>媒体消息:</span>
                    <span className={`font-medium ${
                      dailyLimits.media_messages.remaining === 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {dailyLimits.media_messages.current}/{dailyLimits.media_messages.max}
                      {dailyLimits.media_messages.remaining > 0 && (
                        ` (剩余${dailyLimits.media_messages.remaining})`
                      )}
                    </span>
                  </div>
                  {followStatus?.isMutual && (
                    <div className="text-green-600 font-medium flex items-center mt-2">
                      <Heart className="w-3 h-3 mr-1" />
                      ✓ 互相关注，不受陌生用户限制
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 私信限制信息 */}
            {messageLimits && !followStatus?.isMutual && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg text-sm">
                <div className="flex items-center text-blue-700 mb-2">
                  <Clock className="w-4 h-4 mr-1" />
                  <span className="font-medium">今日私信限制</span>
                </div>
                <div className="space-y-1 text-blue-600">
                  <div>发送消息: {messageLimits.dailyMessageCount}/{messageLimits.dailyMessageLimit}</div>
                  <div>私信对象: {messageLimits.dailyTargetCount}/{messageLimits.dailyTargetLimit}</div>
                  {followStatus?.isMutual && (
                    <div className="text-green-600 font-medium">✓ 互相关注，无限制</div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            {loadingConversations ? (
              <div className="p-4 text-sm text-gray-500">加载中...</div>
            ) : apiError ? (
              <div className="p-4 text-sm text-center">
                <div className="text-red-600 mb-2">{apiError}</div>
                <Button
                  onClick={() => refreshConversations()}
                  size="sm"
                  className="text-xs"
                >
                  重试
                </Button>
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-4 text-sm text-gray-500 text-center">
                <p>暂无私信会话</p>
                <p className="text-xs mt-1">开始与其他用户对话吧</p>
              </div>
            ) : filteredConversations.length === 0 && searchQuery ? (
              <div className="p-4 text-sm text-gray-500">
                <div className="text-center">
                  <p>未找到匹配的会话</p>
                  <p className="text-xs mt-1">搜索: "{searchQuery}"</p>
                </div>
              </div>
            ) : (
              <ul className="divide-y">
                {filteredConversations.map(conversation => {
                  const title = getConversationTitle(conversation);
                  const lastMessageText = conversation.last_message?.content || '开始新的对话';
                  const isActive = selectedConversation?.id === conversation.id;
                  return (
                    <li
                      key={conversation.id}
                      className={`relative group transition ${
                        isActive ? 'bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div
                        className="flex items-start space-x-3 p-4 cursor-pointer"
                        onClick={() => setSelectedConversation(conversation)}
                      >
                        {/* 置顶图标 */}
                        {conversation.is_pinned && (
                          <div className="absolute top-2 left-2 text-blue-500">
                            <Pin className="w-3 h-3" />
                          </div>
                        )}

                        {/* 静音图标 */}
                        {conversation.is_muted && (
                          <div className="absolute top-2 left-6 text-gray-500">
                            <VolumeX className="w-3 h-3" />
                          </div>
                        )}

                        <img
                          src={getConversationAvatar(conversation)}
                          alt={title}
                          className="w-10 h-10 rounded-full object-cover"
                          onError={event => {
                            (event.target as HTMLImageElement).src = '/default-avatar.png';
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className={`font-medium text-gray-800 truncate ${conversation.is_pinned || conversation.is_muted ? 'ml-6' : ''}`}>
                              {searchQuery ? highlightSearchTerm(title, searchQuery) : title}
                            </span>
                            {conversation.last_message?.created_at && (
                              <span className="text-xs text-gray-400">
                                {formatTimestamp(conversation.last_message.created_at)}
                              </span>
                            )}
                          </div>
                          <div className={`${conversation.is_pinned || conversation.is_muted ? 'ml-6' : ''}`}>
                            <p className="text-xs text-gray-500 truncate mt-1">
                              {searchQuery ? highlightSearchTerm(lastMessageText, searchQuery) : lastMessageText}
                            </p>
                            {conversation.is_muted && (
                              <p className="text-xs text-gray-400 mt-1">
                                {formatMuteUntil(conversation.mute_until || null, conversation.mute_type || '')}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* 未读数量 */}
                        {conversation.unread_count > 0 && (
                          <span className="ml-2 inline-flex items-center justify-center min-w-[1.5rem] px-2 py-1 text-xs font-semibold text-white bg-blue-500 rounded-full">
                            {conversation.unread_count}
                          </span>
                        )}
                      </div>

                      {/* 操作按钮组 */}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                        {/* 置顶按钮 */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTogglePin(conversation);
                          }}
                          className={`p-1 rounded-full hover:bg-gray-200 ${
                            conversation.is_pinned ? 'text-blue-500' : 'text-gray-400'
                          }`}
                          title={conversation.is_pinned ? '取消置顶' : '置顶对话'}
                        >
                          {conversation.is_pinned ? (
                            <PinOff className="w-3 h-3" />
                          ) : (
                            <Pin className="w-3 h-3" />
                          )}
                        </button>

                        {/* 静音按钮 */}
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleMute(conversation);
                            }}
                            className={`p-1 rounded-full hover:bg-gray-200 ${
                              conversation.is_muted ? 'text-red-500' : 'text-gray-400'
                            }`}
                            title={conversation.is_muted ? '取消静音' : '静音对话'}
                          >
                            {conversation.is_muted ? (
                              <VolumeX className="w-3 h-3" />
                            ) : (
                              <Volume2 className="w-3 h-3" />
                            )}
                          </button>

                          {/* 静音选项菜单 */}
                          {showMuteOptions === conversation.id && (
                            <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-20 min-w-[120px]">
                              <div className="p-2">
                                <p className="text-xs text-gray-600 mb-2">选择静音时长:</p>
                                {muteOptions.map((option) => (
                                  <button
                                    key={option.value}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleMute(conversation, option.value);
                                    }}
                                    className="w-full text-left px-2 py-1 text-sm hover:bg-gray-50 rounded text-gray-700"
                                  >
                                    {option.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2 flex flex-col min-h-0">
        {selectedConversation ? (
          <>
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">
                    {getConversationTitle(selectedConversation)}
                  </h3>
                  <div className="flex items-center space-x-2 mt-1">
                    <p className="text-sm text-gray-500">与好友即时沟通，分享创作灵感</p>
                    {followStatus && (
                      <div className="flex items-center space-x-1 text-xs">
                        {followStatus.isMutual && (
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full flex items-center">
                            <Heart className="w-3 h-3 mr-1 fill-current" />
                            互相关注
                          </span>
                        )}
                        {followStatus.isFollowing && !followStatus.isMutual && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                            已关注
                          </span>
                        )}
                        {followStatus.isFollowedBy && !followStatus.isMutual && (
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full">
                            关注了你
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {selectedConversation.other_user?.id && (
                  <Button
                    onClick={handleToggleFollow}
                    variant={followStatus?.isFollowing ? "outline" : "secondary"}
                    size="sm"
                    className={followStatus?.isFollowing ?
                      "text-red-600 border-red-600 hover:bg-red-50" :
                      "bg-blue-500 hover:bg-blue-600 text-white"
                    }
                  >
                    {followStatus?.isFollowing ? '取消关注' : '关注'}
                  </Button>
                )}
              </div>
            </div>

            <CardContent className="flex-1 overflow-hidden p-0 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 min-h-0">
                {loadingMessages ? (
                  <div className="text-sm text-gray-500">消息加载中...</div>
                ) : messages.length === 0 ? (
                  <div className="text-sm text-gray-500">目前还没有消息，发送第一条吧！</div>
                ) : (
                  messages
                    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                    .map(message => {
                      const isOwn = message.sender_id === currentUser?.id;
                      const isEditing = editingMessageId === message.id;

                      return (
                        <div
                          key={message.id}
                          className={`flex ${isOwn ? 'justify-end' : 'justify-start'} group`}
                        >
                          <div
                            className={`max-w-xl rounded-lg px-4 py-2 shadow-sm relative ${
                              isOwn ? 'bg-blue-500 text-white' : 'bg-white text-gray-800'
                            }`}
                          >
                            {/* 消息选项按钮 */}
                            {isOwn && !isEditing && (
                              <div className="absolute -right-8 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => setShowMessageOptions(showMessageOptions === message.id ? null : message.id)}
                                  className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                                >
                                  <MoreHorizontal className="w-4 h-4" />
                                </button>
                                {showMessageOptions === message.id && (
                                  <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-10 min-w-[120px]">
                                    <button
                                      onClick={() => startEditMessage(message)}
                                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center text-gray-700"
                                      disabled={(message.edit_count || 0) >= 5}
                                    >
                                      <Edit3 className="w-3 h-3 mr-2" />
                                      编辑 {(message.edit_count || 0) > 0 && `(${message.edit_count}/5)`}
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            {isEditing ? (
                              <div className="space-y-2">
                                <textarea
                                  value={editingContent}
                                  onChange={(e) => setEditingContent(e.target.value)}
                                  className="w-full p-2 border rounded text-gray-800 text-sm resize-none"
                                  rows={3}
                                  autoFocus
                                />
                                <div className="flex justify-end space-x-2">
                                  <button
                                    onClick={cancelEdit}
                                    className="px-3 py-1 text-xs bg-gray-200 text-gray-600 rounded hover:bg-gray-300"
                                  >
                                    <XIcon className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleEditMessage(message.id, editingContent)}
                                    disabled={!editingContent.trim() || editingContent === message.content}
                                    className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <Check className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {renderMessageContent(message)}
                                <div className={`flex items-center justify-between text-xs mt-2 ${isOwn ? 'text-blue-100' : 'text-gray-400'}`}>
                                  <span>
                                    {formatTimestamp(message.created_at)}
                                    {message.is_edited && (
                                      <span className="ml-1 opacity-75">已编辑</span>
                                    )}
                                  </span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t p-4 bg-white shrink-0 relative z-10">
                {/* 限制错误提示 */}
                {limitError && (
                  <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center text-red-700">
                      <AlertCircle className="w-4 h-4 mr-2" />
                      <span className="text-sm">{limitError}</span>
                    </div>
                  </div>
                )}

                <div className="flex space-x-3">
                  <Input
                    value={newMessage}
                    onChange={(value: string) => setNewMessage(value)}
                    placeholder={
                      followStatus?.isMutual
                        ? "输入消息...（互相关注，无限制）"
                        : "输入消息...（受每日发送限制）"
                    }
                    disabled={sending}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={
                      sending ||
                      !newMessage.trim() ||
                      (messageLimits?.isMessageLimitReached && !followStatus?.isMutual)
                    }
                  >
                    {sending ? '发送中...' : '发送'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </>
        ) : (
          <CardContent className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4">
              <h3 className="text-lg font-semibold text-gray-800">选择一个会话开始聊天</h3>
              <p className="text-sm text-gray-500">在左侧选择或创建一个新的私信会话</p>
              <Button onClick={() => refreshConversations()}>刷新列表</Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* 创建新会话弹窗 */}
      {showCreateConversation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">发起私信</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  用户名或用户ID
                </label>
                <Input
                  value={searchUsername}
                  onChange={(value: string) => setSearchUsername(value)}
                  placeholder="输入要私信的用户名..."
                  className="w-full"
                />
              </div>
              <div className="text-sm text-gray-600">
                <p>💡 提示：</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>每日私信对象数量有限制</li>
                  <li>互相关注的用户不受限制</li>
                  <li>建议先关注对方再发起私信</li>
                </ul>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <Button
                onClick={() => {
                  setShowCreateConversation(false);
                  setSearchUsername('');
                }}
                variant="outline"
              >
                取消
              </Button>
              <Button
                onClick={handleCreateConversation}
                disabled={!searchUsername.trim()}
                className="bg-blue-500 hover:bg-blue-600 text-white"
              >
                开始私信
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 隐私设置模态框 */}
      <PrivacySettingsModal
        isOpen={showPrivacySettings}
        onClose={() => setShowPrivacySettings(false)}
      />

      {/* 消息请求模态框 */}
      <MessageRequestsModal
        isOpen={showMessageRequests}
        onClose={() => {
          setShowMessageRequests(false);
          loadMessageRequestCount(); // 关闭时重新加载数量
        }}
        onRefreshConversations={() => {
          refreshConversations(true);
          loadMessageRequestCount();
        }}
      />
    </div>
  );
};

export default PrivateMessageModule;
