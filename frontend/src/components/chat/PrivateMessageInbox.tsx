import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle,
  Send,
  Heart,
  UserPlus,
  UserMinus,
  Shield,
  MoreHorizontal,
  X,
  Search,
  Smile,
  Paperclip,
  ArrowLeft,
  Eye,
  EyeOff,
  Flag
} from 'lucide-react';
import { AuthService, type AuthUser } from '../../services/auth';
import { ChatAPI, type ChatMessage, type Conversation } from '../../services/chat';
import { SocialAPI } from '../../services/social';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { logger } from '../../utils/logger';

// 消息预览界面 - 类似手机短信的折叠显示
interface MessagePreview {
  id: string;
  sender: {
    id: string;
    username: string;
    avatar?: string;
    display_name?: string;
  };
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  isOnline: boolean;
  conversationId: string;
}

interface UserAction {
  type: 'follow' | 'unfollow' | 'block' | 'unblock' | 'report';
  label: string;
  icon: React.ReactNode;
  dangerous?: boolean;
}

// 消息预览项组件 - 使用React.memo优化性能
const MessagePreviewItem = React.memo<{
  preview: MessagePreview;
  relation: any;
  onSelect: (conversationId: string) => void;
  onShowActions: (userId: string) => void;
  showActions: boolean;
  getUserActions: (userId: string) => UserAction[];
  handleUserAction: (userId: string, action: UserAction['type']) => void;
  formatTime: (timestamp: string) => string;
}>(({
  preview,
  relation,
  onSelect,
  onShowActions,
  showActions,
  getUserActions,
  handleUserAction,
  formatTime
}) => (
  <motion.div
    whileHover={{ backgroundColor: '#f9fafb' }}
    whileTap={{ backgroundColor: '#f3f4f6' }}
    onClick={() => onSelect(preview.conversationId)}
    style={{
      padding: '16px',
      borderBottom: '1px solid #f3f4f6',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '12px'
    }}
  >
    {/* 头像 */}
    <div style={{ position: 'relative' }}>
      <img
        src={preview.sender.avatar || '/default-avatar.png'}
        alt={preview.sender.display_name || preview.sender.username}
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          objectFit: 'cover'
        }}
        onError={(e) => {
          (e.target as HTMLImageElement).src = '/default-avatar.png';
        }}
      />
      {preview.isOnline && (
        <div style={{
          position: 'absolute',
          bottom: '2px',
          right: '2px',
          width: '12px',
          height: '12px',
          backgroundColor: '#10b981',
          border: '2px solid white',
          borderRadius: '50%'
        }} />
      )}
    </div>

    {/* 消息内容 */}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '4px'
      }}>
        <div style={{
          fontSize: '16px',
          fontWeight: '600',
          color: '#111827'
        }}>
          {preview.sender.display_name || preview.sender.username}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {relation?.isMutual && (
            <Heart style={{
              width: '14px',
              height: '14px',
              color: '#ef4444',
              fill: 'currentColor'
            }} />
          )}
          <span style={{
            fontSize: '12px',
            color: '#6b7280'
          }}>
            {formatTime(preview.timestamp)}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onShowActions(preview.sender.id);
            }}
            style={{
              padding: '4px',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              color: '#6b7280'
            }}
          >
            <MoreHorizontal style={{ width: '16px', height: '16px' }} />
          </button>
        </div>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <p style={{
          fontSize: '14px',
          color: '#6b7280',
          margin: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1
        }}>
          {preview.lastMessage}
        </p>
        {preview.unreadCount > 0 && (
          <div style={{
            backgroundColor: '#ef4444',
            color: 'white',
            fontSize: '12px',
            fontWeight: '600',
            padding: '2px 8px',
            borderRadius: '12px',
            minWidth: '20px',
            textAlign: 'center'
          }}>
            {preview.unreadCount > 99 ? '99+' : preview.unreadCount}
          </div>
        )}
      </div>

      {/* 用户操作菜单 */}
      <AnimatePresence>
        {showActions && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{
              position: 'absolute',
              right: '16px',
              top: '60px',
              backgroundColor: 'white',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              borderRadius: '8px',
              padding: '8px 0',
              zIndex: 50,
              minWidth: '120px'
            }}
          >
            {getUserActions(preview.sender.id).map((action) => (
              <button
                key={action.type}
                onClick={(e) => {
                  e.stopPropagation();
                  handleUserAction(preview.sender.id, action.type);
                }}
                style={{
                  width: '100%',
                  padding: '8px 16px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  fontSize: '14px',
                  color: action.dangerous ? '#ef4444' : '#374151',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {action.icon}
                {action.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  </motion.div>
));

MessagePreviewItem.displayName = 'MessagePreviewItem';

const PrivateMessageInbox: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [messagePreviews, setMessagePreviews] = useState<MessagePreview[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserActions, setShowUserActions] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 用户关系状态
  const [userRelations, setUserRelations] = useState<Map<string, {
    isFollowing: boolean;
    isFollowedBy: boolean;
    isBlocked: boolean;
    isMutual: boolean;
  }>>(new Map());

  // 加载当前用户
  const loadCurrentUser = useCallback(async () => {
    if (!AuthService.isAuthenticated()) {
      setCurrentUser(null);
      return;
    }

    try {
      const user = await AuthService.getCurrentUser();
      setCurrentUser(user);
    } catch (error) {
      logger.error('获取用户信息失败:', error);
      // 尝试从本地存储获取
      const stored = localStorage.getItem('user') || localStorage.getItem('funnypixels_user');
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as AuthUser;
          setCurrentUser(parsed);
        } catch (e) {
          logger.error('解析本地用户信息失败:', e);
        }
      }
    }
  }, []);

  // 加载用户关系状态
  const loadUserRelations = useCallback(async (userIds: string[]) => {
    if (userIds.length === 0) return;

    const relations = new Map();

    for (const userId of userIds) {
      try {
        const response = await SocialAPI.checkFollowStatus(userId);
        if (response.success) {
          relations.set(userId, response.data);
        }
      } catch (error) {
        logger.error(`加载用户${userId}关系状态失败:`, error);
      }
    }

    setUserRelations(relations);
  }, []);

  // 加载消息预览列表
  const loadMessagePreviews = useCallback(async () => {
    if (!AuthService.isAuthenticated()) return;

    try {
      setLoading(true);
      const response = await ChatAPI.getConversations(50, 0);

      if (response.success) {
        const privateConversations = response.data.filter(conv => conv.type === 'private');

        const previews: MessagePreview[] = privateConversations.map(conv => ({
          id: conv.id,
          sender: {
            id: conv.other_user?.id || '',
            username: conv.other_user?.username || 'Unknown',
            avatar: conv.other_user?.avatar_url,
            display_name: conv.other_user?.display_name
          },
          lastMessage: conv.last_message?.content || '开始新的对话',
          timestamp: conv.last_message?.created_at || conv.created_at,
          unreadCount: conv.unread_count || 0,
          isOnline: false, // TODO: 从在线状态API获取
          conversationId: conv.id
        }));

        // 使用函数式更新避免闪烁
        setMessagePreviews(prev => {
          // 检查是否有实际变化
          if (JSON.stringify(prev) === JSON.stringify(previews)) {
            return prev; // 没有变化，返回原数组避免重新渲染
          }
          return previews;
        });

        // 加载用户关系状态
        const userIds = previews.map(p => p.sender.id).filter(Boolean);
        if (userIds.length > 0) {
          await loadUserRelations(userIds);
        }
      }
    } catch (error) {
      logger.error('加载消息预览失败:', error);
    } finally {
      setLoading(false);
    }
  }, [loadUserRelations]);

  // 加载对话消息
  const loadConversationMessages = useCallback(async (conversationId: string) => {
    try {
      const response = await ChatAPI.getConversationMessages(conversationId, 100, 0);
      if (response.success) {
        setMessages(response.data);

        // 标记为已读 - 添加容错处理
        if (response.data.length > 0) {
          const lastMessage = response.data[response.data.length - 1];
          try {
            await ChatAPI.markConversationAsRead(conversationId, lastMessage.id);
            logger.debug('✅ 对话已标记为已读:', conversationId);

            // 更新未读计数
            setMessagePreviews(prev =>
              prev.map(preview =>
                preview.conversationId === conversationId
                  ? { ...preview, unreadCount: 0 }
                  : preview
              )
            );
          } catch (markReadError) {
            logger.warn('⚠️ 标记已读失败，但不影响消息显示:', markReadError);
            // 即使标记已读失败，仍然清除前端未读计数
            setMessagePreviews(prev =>
              prev.map(preview =>
                preview.conversationId === conversationId
                  ? { ...preview, unreadCount: 0 }
                  : preview
              )
            );
          }
        }
      } else {
        logger.warn('获取对话消息失败:', response.message);
        setMessages([]);
      }
    } catch (error) {
      logger.error('加载对话消息失败:', error);
      setMessages([]);
    }
  }, []);

  // 发送消息
  const sendMessage = useCallback(async () => {
    if (!selectedConversation || !newMessage.trim()) return;

    const messageContent = newMessage.trim();
    try {
      setSending(true);
      setNewMessage(''); // 立即清空输入框，提升用户体验

      const response = await ChatAPI.sendMessage({
        conversationId: selectedConversation,
        messageType: 'text',
        content: messageContent
      });

      if (response.success) {
        // 添加消息到当前对话（避免重复）
        setMessages(prev => {
          if (prev.some(msg => msg.id === response.data.id)) {
            return prev; // 已存在，避免重复
          }
          return [...prev, response.data];
        });

        // 更新预览列表中的最后一条消息（避免频繁更新）
        setMessagePreviews(prev => {
          return prev.map(preview => {
            if (preview.conversationId === selectedConversation) {
              // 只有内容真正变化时才更新
              if (preview.lastMessage !== messageContent) {
                return {
                  ...preview,
                  lastMessage: messageContent,
                  timestamp: response.data.created_at
                };
              }
            }
            return preview;
          });
        });
      }
    } catch (error) {
      logger.error('发送消息失败:', error);
      // 发送失败时恢复输入内容
      setNewMessage(messageContent);
    } finally {
      setSending(false);
    }
  }, [selectedConversation, newMessage]);

  // 用户操作
  const handleUserAction = useCallback(async (userId: string, action: UserAction['type']) => {
    try {
      switch (action) {
        case 'follow':
          await SocialAPI.followUser(userId);
          break;
        case 'unfollow':
          await SocialAPI.unfollowUser(userId);
          break;
        case 'block':
          // TODO: 实现屏蔽用户API
          logger.debug('屏蔽用户:', userId);
          break;
        case 'unblock':
          // TODO: 实现取消屏蔽用户API
          logger.debug('取消屏蔽用户:', userId);
          break;
        case 'report':
          // TODO: 实现举报用户API
          logger.debug('举报用户:', userId);
          break;
      }

      // 重新加载用户关系状态
      await loadUserRelations([userId]);
      setShowUserActions(null);
    } catch (error) {
      logger.error('用户操作失败:', error);
    }
  }, [loadUserRelations]);

  useEffect(() => {
    loadCurrentUser();
  }, [loadCurrentUser]);

  useEffect(() => {
    if (currentUser) {
      loadMessagePreviews();
    }
  }, [currentUser, loadMessagePreviews]);

  // WebSocket事件监听 - 避免频繁重新监听
  useEffect(() => {
    if (!AuthService.isAuthenticated()) return;

    // 处理新消息
    const handleNewMessage = (data: any) => {
      logger.debug('📨 收到新私信:', data);

      // 更新消息预览列表
      setMessagePreviews(prev => {
        const updated = prev.map(preview => {
          if (preview.conversationId === data.conversation_id) {
            return {
              ...preview,
              lastMessage: data.content,
              timestamp: data.created_at,
              unreadCount: selectedConversation === data.conversation_id ? 0 : preview.unreadCount + 1
            };
          }
          return preview;
        });

        // 如果是新会话，添加到列表顶部
        const existingConversation = prev.find(p => p.conversationId === data.conversation_id);
        if (!existingConversation && data.sender_id !== currentUser?.id) {
          const newPreview: MessagePreview = {
            id: data.conversation_id,
            sender: {
              id: data.sender_id,
              username: data.sender_name || 'Unknown',
              avatar: data.sender_avatar,
              display_name: data.sender_display_name
            },
            lastMessage: data.content,
            timestamp: data.created_at,
            unreadCount: 1,
            isOnline: false,
            conversationId: data.conversation_id
          };
          return [newPreview, ...updated];
        }

        return updated;
      });

      // 如果是当前选中的对话，更新消息列表
      if (selectedConversation === data.conversation_id) {
        setMessages(prev => {
          // 避免重复添加相同消息
          if (prev.some(msg => msg.id === data.id)) {
            return prev;
          }
          return [...prev, data];
        });
      }
    };

    // 注册事件监听器
    const socketListeners = [
      { event: 'chat_message_batch', handler: (batch: any) => {
        if (batch?.messages) {
          batch.messages.forEach(handleNewMessage);
        }
      }},
      { event: 'new_message', handler: handleNewMessage },
      { event: 'chat:new_message', handler: handleNewMessage }
    ];

    // 假设有一个全局的socket对象
    if (typeof window !== 'undefined' && (window as any).chatSocket) {
      const socket = (window as any).chatSocket;
      socketListeners.forEach(({ event, handler }) => {
        socket.on(event, handler);
      });

      return () => {
        socketListeners.forEach(({ event, handler }) => {
          socket.off(event, handler);
        });
      };
    }

    // 如果没有全局socket，使用定时刷新作为备选方案
    const interval = setInterval(() => {
      if (currentUser && !selectedConversation) {
        // 只在收件箱视图时刷新，避免对话中频繁刷新
        loadMessagePreviews();
      }
    }, 30000); // 30秒刷新一次

    return () => clearInterval(interval);
  }, [currentUser, selectedConversation, loadMessagePreviews]);

  useEffect(() => {
    if (selectedConversation) {
      loadConversationMessages(selectedConversation);
    }
  }, [selectedConversation, loadConversationMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 格式化时间
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays === 0) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return '昨天';
    } else if (diffDays < 7) {
      return `${diffDays}天前`;
    } else {
      return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
    }
  };

  // 过滤搜索结果 - 使用useMemo优化性能
  const filteredPreviews = React.useMemo(() => {
    if (!searchQuery.trim()) return messagePreviews;

    const query = searchQuery.toLowerCase();
    return messagePreviews.filter(preview =>
      preview.sender.username.toLowerCase().includes(query) ||
      preview.sender.display_name?.toLowerCase().includes(query) ||
      preview.lastMessage.toLowerCase().includes(query)
    );
  }, [messagePreviews, searchQuery]);

  const getUserActions = (userId: string): UserAction[] => {
    const relation = userRelations.get(userId);
    const actions: UserAction[] = [];

    if (relation?.isFollowing) {
      actions.push({
        type: 'unfollow',
        label: '取消关注',
        icon: <UserMinus style={{ width: '16px', height: '16px' }} />
      });
    } else {
      actions.push({
        type: 'follow',
        label: '关注',
        icon: <UserPlus style={{ width: '16px', height: '16px' }} />
      });
    }

    if (relation?.isBlocked) {
      actions.push({
        type: 'unblock',
        label: '取消屏蔽',
        icon: <Eye style={{ width: '16px', height: '16px' }} />
      });
    } else {
      actions.push({
        type: 'block',
        label: '屏蔽用户',
        icon: <EyeOff style={{ width: '16px', height: '16px' }} />,
        dangerous: true
      });
    }

    actions.push({
      type: 'report',
      label: '举报',
      icon: <Flag style={{ width: '16px', height: '16px' }} />,
      dangerous: true
    });

    return actions;
  };

  if (!AuthService.isAuthenticated()) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff'
      }}>
        <div style={{ textAlign: 'center', padding: '32px' }}>
          <MessageCircle style={{
            width: '64px',
            height: '64px',
            color: '#d1d5db',
            margin: '0 auto 16px auto'
          }} />
          <h3 style={{ fontSize: '18px', fontWeight: '600', margin: '0 0 8px 0', color: '#374151' }}>
            请先登录
          </h3>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 24px 0' }}>
            登录后即可查看和发送私信
          </p>
          <Button
            onClick={() => { window.location.href = '/login'; }}
            style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              padding: '8px 24px',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            前往登录
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#ffffff',
      maxHeight: 'calc(100vh - 60px)'
    }}>
      {/* 收件箱视图 */}
      <AnimatePresence mode="wait">
        {!selectedConversation ? (
          <motion.div
            key="inbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
          >
            {/* 顶部搜索栏 */}
            <div style={{
              padding: '16px',
              borderBottom: '1px solid #e5e7eb',
              backgroundColor: '#f9fafb'
            }}>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 12px 0' }}>
                私信收件箱
              </h2>
              <div style={{ position: 'relative' }}>
                <Search style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '16px',
                  height: '16px',
                  color: '#9ca3af'
                }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索用户或消息..."
                  style={{
                    width: '100%',
                    paddingLeft: '40px',
                    paddingRight: '16px',
                    paddingTop: '12px',
                    paddingBottom: '12px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #d1d5db',
                    borderRadius: '12px',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* 消息预览列表 */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loading ? (
                <div style={{
                  padding: '32px',
                  textAlign: 'center',
                  color: '#6b7280'
                }}>
                  加载中...
                </div>
              ) : filteredPreviews.length === 0 ? (
                <div style={{
                  padding: '32px',
                  textAlign: 'center',
                  color: '#6b7280'
                }}>
                  {searchQuery ? '未找到匹配的消息' : '暂无私信消息'}
                </div>
              ) : (
                <div>
                  {filteredPreviews.map((preview) => (
                    <MessagePreviewItem
                      key={preview.id}
                      preview={preview}
                      relation={userRelations.get(preview.sender.id)}
                      onSelect={setSelectedConversation}
                      onShowActions={(userId) => {
                        setShowUserActions(showUserActions === userId ? null : userId);
                      }}
                      showActions={showUserActions === preview.sender.id}
                      getUserActions={getUserActions}
                      handleUserAction={handleUserAction}
                      formatTime={formatTime}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          /* 对话视图 */
          <motion.div
            key="conversation"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
          >
            {/* 对话头部 */}
            <div style={{
              padding: '16px',
              borderBottom: '1px solid #e5e7eb',
              backgroundColor: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <button
                onClick={() => setSelectedConversation(null)}
                style={{
                  padding: '8px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  color: '#6b7280'
                }}
              >
                <ArrowLeft style={{ width: '20px', height: '20px' }} />
              </button>

              {(() => {
                const preview = messagePreviews.find(p => p.conversationId === selectedConversation);
                const relation = preview ? userRelations.get(preview.sender.id) : null;

                return preview ? (
                  <>
                    <img
                      src={preview.sender.avatar || '/default-avatar.png'}
                      alt={preview.sender.display_name || preview.sender.username}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        objectFit: 'cover'
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <h3 style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        margin: '0',
                        color: '#111827'
                      }}>
                        {preview.sender.display_name || preview.sender.username}
                      </h3>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginTop: '2px'
                      }}>
                        {relation?.isMutual && (
                          <span style={{
                            fontSize: '12px',
                            color: '#ef4444',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px'
                          }}>
                            <Heart style={{ width: '12px', height: '12px', fill: 'currentColor' }} />
                            互相关注
                          </span>
                        )}
                        {preview.isOnline && (
                          <span style={{
                            fontSize: '12px',
                            color: '#10b981'
                          }}>
                            在线
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                ) : null;
              })()}
            </div>

            {/* 消息列表 */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
              backgroundColor: '#f9fafb'
            }}>
              {messages.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '32px',
                  color: '#6b7280'
                }}>
                  开始新的对话吧！
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {messages.map((message) => {
                    const isOwn = message.sender_id === currentUser?.id;
                    return (
                      <div
                        key={message.id}
                        style={{
                          display: 'flex',
                          justifyContent: isOwn ? 'flex-end' : 'flex-start'
                        }}
                      >
                        <div
                          style={{
                            maxWidth: '70%',
                            padding: '12px 16px',
                            borderRadius: isOwn ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                            backgroundColor: isOwn ? '#3b82f6' : '#ffffff',
                            color: isOwn ? '#ffffff' : '#111827',
                            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
                          }}
                        >
                          <p style={{
                            margin: '0',
                            fontSize: '14px',
                            lineHeight: '1.5'
                          }}>
                            {message.content}
                          </p>
                          <div style={{
                            marginTop: '4px',
                            fontSize: '11px',
                            opacity: 0.7
                          }}>
                            {formatTime(message.created_at)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* 输入框 */}
            <div style={{
              padding: '16px',
              backgroundColor: '#ffffff',
              borderTop: '1px solid #e5e7eb'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="输入消息..."
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    backgroundColor: '#f9fafb',
                    border: '1px solid #d1d5db',
                    borderRadius: '24px',
                    outline: 'none',
                    fontSize: '14px'
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || sending}
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    border: 'none',
                    backgroundColor: newMessage.trim() && !sending ? '#3b82f6' : '#d1d5db',
                    color: 'white',
                    cursor: newMessage.trim() && !sending ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Send style={{ width: '18px', height: '18px' }} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 点击外部关闭菜单 */}
      {showUserActions && (
        <div
          onClick={() => setShowUserActions(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'transparent',
            zIndex: 40
          }}
        />
      )}
    </div>
  );
};

export default PrivateMessageInbox;