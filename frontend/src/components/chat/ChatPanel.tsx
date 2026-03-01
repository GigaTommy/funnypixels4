import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChatAPI, ChatMessage, SendMessageData } from '../../services/chat';
import { AuthService, type AuthUser } from '../../services/auth';
import socket from '../../services/socket';
import { logger } from '../../utils/logger';
import { replaceAlert } from '../../utils/toastHelper';

interface ChatPanelProps {
  channelType: 'global' | 'alliance' | 'private';
  channelId?: string;
  title: string;
}

const PAGE_SIZE = 50;

function debounce<T extends (...args: any[]) => void>(func: T, wait: number) {
  let timeout: NodeJS.Timeout | undefined;
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), wait);
  };
}

const ChatPanel: React.FC<ChatPanelProps> = ({ channelType, channelId, title }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadedCount, setLoadedCount] = useState(0);
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [initialLoadCompleted, setInitialLoadCompleted] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const isMountedRef = useRef(true);
  const messageIdsRef = useRef<Set<string>>(new Set());

  const resolvedChannelId = useMemo(() => {
    if (channelType === 'global') {
      return null;
    }
    return channelId ?? '';
  }, [channelType, channelId]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    socket.emit('authenticate', {
      userId: currentUser.id,
      username: currentUser.display_name || currentUser.username || currentUser.id
    });
  }, [currentUser]);

  const loadCurrentUser = useCallback(async () => {
    try {
      if (!AuthService.isAuthenticated()) {
        return null;
      }

      const user = await AuthService.getCurrentUser();
      if (user?.id) {
        return user;
      }

      const stored = localStorage.getItem('funnypixels_user') || localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.id) {
          return parsed as AuthUser;
        }
      }
    } catch (error) {
      logger.error('获取用户信息失败:', error);
    }
    return null;
  }, []);

  useEffect(() => {
    let active = true;
    loadCurrentUser().then(user => {
      if (active) {
        setCurrentUser(user);
      }
    });
    return () => {
      active = false;
    };
  }, [loadCurrentUser]);

  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [messages]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) {
      return;
    }
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const atBottom = scrollTop + clientHeight >= scrollHeight - 10;
    setIsScrolledToBottom(atBottom);
  }, []);

  const fetchMessages = useCallback(async (offset: number) => {
    try {
      if (channelType === 'private') {
        if (!resolvedChannelId) {
          return { messages: [], conversationId: null };
        }
        const response = await ChatAPI.getPrivateMessages(resolvedChannelId, PAGE_SIZE, offset);
        return response.success
          ? {
              messages: response.data,
              conversationId: response.meta?.conversationId ?? null
            }
          : { messages: [], conversationId: null };
      }

      const targetChannel = resolvedChannelId || 'global';
      const response = await ChatAPI.getChannelMessages(channelType, targetChannel, PAGE_SIZE, offset);
      return response.success
        ? {
            messages: response.data,
            conversationId: response.meta?.conversationId ?? null
          }
        : { messages: [], conversationId: null };
    } catch (error) {
      logger.error('加载消息失败:', error);
      return { messages: [], conversationId: null };
    }
  }, [channelType, resolvedChannelId]);

  const loadMessages = useCallback(async (reset = false) => {
    if (!AuthService.isAuthenticated()) {
      return;
    }

    if (reset) {
      setMessages([]);
      setLoadedCount(0);
      setHasMore(true);
      setInitialLoadCompleted(false);
      messageIdsRef.current = new Set();
      setConversationId(null);
    }

    setLoading(true);
    try {
      const { messages: fetchedMessages, conversationId: fetchedConversationId } = await fetchMessages(0);
      if (!isMountedRef.current) {
        return;
      }
      setMessages(fetchedMessages);
      setConversationId(fetchedConversationId ?? null);
      setLoadedCount(fetchedMessages.length);
      setHasMore(fetchedMessages.length === PAGE_SIZE);
      setInitialLoadCompleted(true);
      messageIdsRef.current = new Set(fetchedMessages.map(message => message.id));
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [fetchMessages, scrollToBottom]);

  const loadMoreMessages = useCallback(async () => {
    if (!initialLoadCompleted || loadingMore || !hasMore) {
      return;
    }

    setLoadingMore(true);
    try {
      const { messages: fetchedMessages } = await fetchMessages(loadedCount);
      if (!isMountedRef.current) {
        return;
      }

      if (fetchedMessages.length > 0) {
        let added = 0;
        setMessages(prev => {
          const seen = new Set(messageIdsRef.current);
          const unique = fetchedMessages.filter(message => {
            if (!message?.id || seen.has(message.id)) {
              return false;
            }
            seen.add(message.id);
            added += 1;
            return true;
          });
          messageIdsRef.current = seen;
          if (unique.length === 0) {
            return prev;
          }
          return [...unique, ...prev];
        });
        if (added > 0) {
          setLoadedCount(prev => prev + added);
        }
        if (fetchedMessages.length < PAGE_SIZE) {
          setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    } finally {
      if (isMountedRef.current) {
        setLoadingMore(false);
      }
    }
  }, [fetchMessages, hasMore, initialLoadCompleted, loadedCount, loadingMore]);

  useEffect(() => {
    loadMessages(true);
  }, [loadMessages]);

  useEffect(() => {
    if (!AuthService.isAuthenticated()) {
      return () => undefined;
    }

    const channelKey = channelType === 'global' ? 'global' : resolvedChannelId;
    if (channelType !== 'global' && !channelKey) {
      return () => undefined;
    }

    const joinPayload: Record<string, string> = {
      channelType,
      channelId: channelKey || 'global'
    };

    if (conversationId) {
      joinPayload.conversationId = conversationId;
    }

    socket.emit('join_chat_room', joinPayload);
    const roomId = `chat:${channelType}:${channelKey || 'global'}`;

    const handleBatch = (batch: any) => {
      if (!batch) {
        return;
      }

      if (batch.roomId && batch.roomId !== roomId) {
        return;
      }

      const normalizedChannelId = channelType === 'global' ? null : (resolvedChannelId || null);
      const incoming = (Array.isArray(batch.messages) ? batch.messages : []).filter((raw: any) => {
        const message = raw as ChatMessage;
        if (!message) {
          return false;
        }
        if (conversationId && message.conversation_id && message.conversation_id !== conversationId) {
          return false;
        }
        if (message.channel_type !== channelType) {
          return false;
        }
        if (channelType === 'global') {
          return !message.channel_id;
        }
        return (message.channel_id ?? null) === normalizedChannelId;
      });

      if (incoming.length === 0) {
        return;
      }

      let added = 0;
      setMessages(prev => {
        const seen = new Set(messageIdsRef.current);
        const next = [...prev];

        incoming.forEach((rawMessage: any) => {
          const message = rawMessage as ChatMessage;
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
        setLoadedCount(prev => prev + added);
        if (isScrolledToBottom) {
          setTimeout(() => scrollToBottom(), 50);
        }
      }
    };

    socket.on('chat_message_batch', handleBatch);

    return () => {
      socket.off('chat_message_batch', handleBatch);
      socket.emit('leave_chat_room', {});
    };
  }, [channelType, conversationId, resolvedChannelId, isScrolledToBottom, scrollToBottom]);

  useEffect(() => {
    if (!loadingRef.current) {
      return () => undefined;
    }

    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        loadMoreMessages();
      }
    }, { threshold: 0.1 });

    observer.observe(loadingRef.current);
    observerRef.current = observer;

    return () => {
      observer.disconnect();
    };
  }, [hasMore, loadMoreMessages, loadingMore]);

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (isScrolledToBottom) {
      scrollToBottom();
    }
  }, [sortedMessages, isScrolledToBottom, scrollToBottom]);

  const sendMessage = useCallback(async (messageText: string) => {
    const trimmed = messageText.trim();
    if (!trimmed || !AuthService.isAuthenticated()) {
      return;
    }

    setSending(true);
    try {
      const messageData: SendMessageData = {
        channelType,
        channelId: resolvedChannelId || undefined,
        messageType: 'text',
        content: trimmed
      };

      const response = await ChatAPI.sendMessage(messageData);
      if (response.success && response.data) {
        setConversationId(prev => prev ?? (response.meta?.conversationId ?? null));
        let added = false;
        setMessages(prev => {
          const message = response.data;
          if (!message?.id || messageIdsRef.current.has(message.id)) {
            return prev;
          }
          messageIdsRef.current.add(message.id);
          added = true;
          return [...prev, message];
        });
        if (added) {
          setLoadedCount(prev => prev + 1);
          if (isScrolledToBottom) {
            setTimeout(() => scrollToBottom(), 50);
          }
        }
        setNewMessage('');
      }
    } catch (error) {
      logger.error('发送消息失败:', error);
      replaceAlert.error('发送消息失败，请稍后重试');
    } finally {
      if (isMountedRef.current) {
        setSending(false);
      }
    }
  }, [channelType, resolvedChannelId, isScrolledToBottom, scrollToBottom]);

  const debouncedSendMessage = useMemo(() => debounce(sendMessage, 300), [sendMessage]);

  const handleKeyPress = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      debouncedSendMessage(newMessage);
    }
  }, [debouncedSendMessage, newMessage]);

  const formatTime = useCallback((timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }
    if (diffInHours < 24) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
  }, []);

  const renderMessageContent = useCallback((message: ChatMessage) => {
    if (message.is_system_message) {
      return <span className="text-xs text-gray-500">{message.content}</span>;
    }

    switch (message.message_type) {
      case 'emoji':
        return (
          <span className="text-2xl leading-none">
            {message.content}
          </span>
        );
      case 'image': {
        const metadata = message.metadata || {};
        const imageUrl: string | undefined = metadata.image_url || metadata.imageUrl;
        const thumbnailUrl: string | undefined = metadata.thumbnail_url || metadata.thumbnailUrl || imageUrl;
        return (
          <div className="space-y-2">
            {imageUrl && (
              <a
                href={imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <img
                  src={thumbnailUrl || imageUrl}
                  alt={message.content || '聊天图片'}
                  className="max-w-full rounded-md border border-gray-200"
                />
              </a>
            )}
            {message.content && (
              <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
            )}
          </div>
        );
      }
      case 'location': {
        const metadata = message.metadata || {};
        const lat = typeof metadata.lat === 'number' ? metadata.lat : Number(metadata.lat);
        const lng = typeof metadata.lng === 'number' ? metadata.lng : Number(metadata.lng);
        const preview = metadata.previewUrl || metadata.preview_url;
        const label = metadata.label as string | undefined;
        const addressSnippet = metadata.addressSnippet as string | undefined;
        const linkUrl = metadata.linkUrl || metadata.link_url;

        const openLocation = () => {
          if (linkUrl && typeof linkUrl === 'string') {
            window.open(linkUrl, '_blank', 'noopener,noreferrer');
            return;
          }
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            window.dispatchEvent(
              new CustomEvent('chat:location-open', {
                detail: { lat, lng, message }
              })
            );
          }
        };

        return (
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-800">{label || '位置消息'}</div>
            {Number.isFinite(lat) && Number.isFinite(lng) && (
              <div className="text-xs text-gray-500">
                {lat.toFixed(4)}, {lng.toFixed(4)}
              </div>
            )}
            {addressSnippet && (
              <div className="text-xs text-gray-500 whitespace-pre-wrap break-words">{addressSnippet}</div>
            )}
            {preview && (
              <img
                src={preview}
                alt={label || '位置预览'}
                className="w-full max-w-xs rounded-md border border-gray-200"
              />
            )}
            <button
              type="button"
              onClick={openLocation}
              className="inline-flex items-center text-xs font-medium text-blue-600 hover:text-blue-800"
            >
              查看地图
            </button>
          </div>
        );
      }
      default:
        return (
          <p className="text-sm whitespace-pre-wrap break-words">
            {message.content}
          </p>
        );
    }
  }, []);

  if (!AuthService.isAuthenticated()) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-500">请先登录以使用聊天功能</p>
      </div>
    );
  }

  if (channelType !== 'global' && !channelId) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg text-sm text-gray-500">
        请选择一个有效的{channelType === 'alliance' ? '联盟聊天室' : '私信对象'}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-96 bg-white rounded-lg shadow-sm border">
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <h3 className="font-semibold text-gray-800">{title}</h3>
        <button
          onClick={() => loadMessages(true)}
          className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? '刷新中...' : '刷新'}
        </button>
      </div>

      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth"
        onScroll={handleScroll}
      >
        {hasMore && (
          <div ref={loadingRef} className="text-center py-2 text-xs text-gray-500">
            {loadingMore ? '加载中...' : '上滑加载更多消息'}
          </div>
        )}

        {loading && messages.length === 0 && (
          <div className="flex justify-center py-6 text-sm text-gray-500">
            加载中...
          </div>
        )}

        {sortedMessages.map(message => {
          if (message.is_system_message) {
            return (
              <div key={message.id} className="flex justify-center">
                <div className="px-3 py-1 text-xs text-gray-500 bg-gray-100 rounded-full">
                  {message.content}
                </div>
              </div>
            );
          }

          const isOwnMessage = currentUser?.id ? message.sender_id === currentUser.id : false;
          const avatarSrc = message.sender_avatar || '/default-avatar.png';

          return (
            <div
              key={message.id}
              className={`flex items-start space-x-3 ${isOwnMessage ? 'flex-row-reverse space-x-reverse' : ''}`}
            >
              <div className="flex-shrink-0">
                <img
                  src={avatarSrc}
                  alt={message.sender_name}
                  className="w-8 h-8 rounded-full object-cover"
                  onError={event => {
                    const target = event.target as HTMLImageElement;
                    target.src = '/default-avatar.png';
                  }}
                />
              </div>

              <div className={`flex-1 max-w-xs ${isOwnMessage ? 'text-right' : 'text-left'}`}>
                <div
                  className={`inline-block px-3 py-2 rounded-lg shadow-sm ${
                    isOwnMessage
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {renderMessageContent(message)}
                  <div
                    className={`text-xs mt-2 ${
                      isOwnMessage ? 'text-blue-100' : 'text-gray-500'
                    }`}
                  >
                    {formatTime(message.created_at)}
                  </div>
                </div>
                {!isOwnMessage && (
                  <div className="text-xs text-gray-500 mt-1">
                    {message.sender_name}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t bg-gray-50">
        <div className="flex space-x-2">
          <textarea
            value={newMessage}
            onChange={event => setNewMessage(event.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="输入消息..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={2}
            disabled={sending}
          />
          <button
            onClick={() => debouncedSendMessage(newMessage)}
            disabled={!newMessage.trim() || sending}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? '发送中...' : '发送'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
