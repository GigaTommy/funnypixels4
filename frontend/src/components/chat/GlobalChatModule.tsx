import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Globe,
  Users,
  MessageCircle,
  Smile,
  Paperclip,
  MoreVertical,
  Settings,
  UserPlus,
  Shield,
  Zap,
  Coffee
} from 'lucide-react';

import { replaceAlert } from '../../utils/toastHelper';
import { AuthService } from '../../services/auth';
import { ChatAPI } from '../../services/chat';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { useChatStore } from '../../stores/chat/chatStore';
import { chatWebSocket } from '../../services/websocket/chatWebSocket';
import MessageBubble from './core/MessageBubble';
import EmojiPicker from './ui/EmojiPicker';
import { logger } from '../../utils/logger';

interface GlobalMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar?: string;
  content: string;
  message_type: 'text' | 'image' | 'system' | 'announcement';
  metadata?: any;
  created_at: string;
  is_pinned?: boolean;
}

interface OnlineUser {
  id: string;
  username: string;
  avatar_url?: string;
  status: 'online' | 'away' | 'busy';
  join_time: string;
}

export default function GlobalChatModule() {
  // Zustand状态管理
  const {
    isConnected,
    getRoomMessages,
    addMessage,
    setCurrentRoom,
    joinRoom,
    isEmojiPickerVisible,
    toggleEmojiPicker,
    setCurrentUser: setChatCurrentUser,
    currentUserId,
    currentUsername,
    onlineUsers,
    setOnlineUsers
  } = useChatStore();

  // 本地状态
  const [onlineUsersList, setOnlineUsersList] = useState<OnlineUser[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [showUsersList, setShowUsersList] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // 全局聊天室ID
  const globalRoomId = 'global';
  const messages = getRoomMessages(globalRoomId);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    // 加入全局聊天室
    joinRoom(globalRoomId);
    setCurrentRoom(globalRoomId);

    // 建立WebSocket连接
    chatWebSocket.joinChatRoom({
      channelType: 'global'
    });

    return () => {
      chatWebSocket.leaveChatRoom({
        conversationId: globalRoomId
      });
    };
  }, [joinRoom, setCurrentRoom]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // WebSocket事件监听
  useEffect(() => {
    const handleNewMessage = (message: any) => {
      if (message.channelType === 'global') {
        addMessage(globalRoomId, message);
      }
    };

    const handleUserOnline = (data: any) => {
      setOnlineUsersList(prev => {
        const existing = prev.find(u => u.id === data.userId);
        if (existing) return prev;

        return [...prev, {
          id: data.userId,
          username: data.username,
          status: 'online',
          join_time: new Date().toISOString()
        }];
      });
    };

    const handleUserOffline = (data: any) => {
      setOnlineUsersList(prev => prev.filter(u => u.id !== data.userId));
    };

    chatWebSocket.on('new_message', handleNewMessage);
    chatWebSocket.on('user_online', handleUserOnline);
    chatWebSocket.on('user_offline', handleUserOffline);

    return () => {
      chatWebSocket.off('new_message', handleNewMessage);
      chatWebSocket.off('user_online', handleUserOnline);
      chatWebSocket.off('user_offline', handleUserOffline);
    };
  }, [addMessage]);

  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);

      // 获取当前用户
      let user = null;
      try {
        const userStr = localStorage.getItem('user');
        if (userStr) {
          user = JSON.parse(userStr);
        }

        if (!user && AuthService.isAuthenticated()) {
          try {
            user = await AuthService.getCurrentUser();
          } catch (error) {
            logger.debug('从AuthService获取用户信息失败');
          }
        }
      } catch (error) {
        logger.error('获取用户信息失败:', error);
      }

      setCurrentUser(user);

      // 设置Zustand store中的用户信息
      if (user) {
        setChatCurrentUser(user.id, user.username);
        chatWebSocket.setUserId(user.id);
      }

      // 加载历史消息
      await loadGlobalMessages();

    } catch (error) {
      logger.error('加载全局聊天数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, [setChatCurrentUser]);

  const loadGlobalMessages = useCallback(async () => {
    try {
      // 使用ChatAPI获取全局消息
      const response = await ChatAPI.getChannelMessages('global', 'global', 50, 0);
      if (response.success && response.data) {
        // 将消息添加到store中
        response.data.forEach((msg: any) => {
          addMessage(globalRoomId, {
            id: msg.id,
            sender_id: msg.sender_id,
            sender_name: msg.sender_name,
            sender_avatar: msg.sender_avatar,
            content: msg.content,
            channel_type: 'global',
            channel_id: 'global',
            message_type: msg.metadata?.message_type || 'text',
            metadata: msg.metadata,
            is_system_message: msg.metadata?.message_type === 'system',
            created_at: msg.created_at
          });
        });
      }
    } catch (error) {
      logger.error('加载全局消息失败:', error);
      // 添加一些模拟数据作为示例
      const welcomeMessage = {
        id: 'welcome-' + Date.now(),
        sender_id: 'system',
        sender_name: '系统',
        content: '欢迎来到FunnyPixels全局聊天室！在这里你可以与所有玩家交流。',
        channel_type: 'global' as const,
        channel_id: 'global',
        message_type: 'system' as const,
        is_system_message: true,
        created_at: new Date().toISOString()
      };
      addMessage(globalRoomId, welcomeMessage);
    }
  }, [addMessage]);

  const sendMessage = useCallback(async () => {
    if (!newMessage.trim()) return;

    const messageText = newMessage.trim();
    setNewMessage('');

    try {
      // 通过WebSocket发送消息
      chatWebSocket.sendMessage({
        channelType: 'global',
        channelId: 'global',
        messageType: 'text',
        content: messageText
      });

      // 也通过API发送作为备份
      const response = await ChatAPI.sendMessage({
        channelType: 'global',
        channelId: 'global',
        messageType: 'text',
        content: messageText
      });

      if (!response.success) {
        logger.warn('API发送失败:', response.message);
      }
    } catch (error) {
      logger.error('发送消息失败:', error);
      // 恢复消息内容
      setNewMessage(messageText);
      replaceAlert.error('发送失败，请重试');
    }
  }, [newMessage]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const formatTime = useCallback((timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } else {
      return date.toLocaleDateString('zh-CN', {
        month: '2-digit',
        day: '2-digit'
      });
    }
  }, []);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Globe className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">请先登录以使用全局聊天功能</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* 头部信息 */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Globe className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">全局聊天室</h2>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <div className="flex items-center">
                  {isConnected ? (
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                  ) : (
                    <div className="w-2 h-2 bg-red-500 rounded-full mr-1"></div>
                  )}
                  <span>{isConnected ? '已连接' : '连接中...'}</span>
                </div>
                <span>•</span>
                <span>{onlineUsersList.length} 人在线</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowUsersList(!showUsersList)}
              className="p-2 hover:bg-white/50 rounded-lg transition-colors"
            >
              <Users className="w-5 h-5 text-gray-600" />
            </button>
            <button className="p-2 hover:bg-white/50 rounded-lg transition-colors">
              <Settings className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* 消息区域 */}
        <div className="flex-1 flex flex-col">
          {/* 消息列表 */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                  <p className="text-gray-500 text-sm">加载中...</p>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 font-medium">开始全球对话</p>
                  <p className="text-gray-400 text-sm">与世界各地的像素艺术家交流</p>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isOwn={message.sender_id === currentUserId}
                    onReply={(msg) => {
                      // TODO: 实现回复功能
                      logger.debug('回复消息:', msg);
                    }}
                    onReact={(messageId, emoji) => {
                      // TODO: 实现消息反应功能
                      logger.debug('消息反应:', messageId, emoji);
                    }}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* 输入框 */}
          <div className="px-4 py-4 border-t border-gray-200 bg-white relative">
            {/* 表情选择器 */}
            {isEmojiPickerVisible && (
              <div className="absolute bottom-full right-4 mb-2 z-50">
                <EmojiPicker
                  onEmojiSelect={(emoji) => {
                    setNewMessage(prev => prev + emoji);
                    toggleEmojiPicker();
                  }}
                />
              </div>
            )}

            <div className="flex items-end space-x-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="向全世界说点什么..."
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl pr-20 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                />
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex space-x-1">
                  <button
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
                    onClick={toggleEmojiPicker}
                  >
                    <Smile className="w-4 h-4" />
                  </button>
                  <button
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
                    onClick={() => setShowMediaPicker(!showMediaPicker)}
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <Button
                onClick={sendMessage}
                disabled={!newMessage.trim() || !isConnected}
                className="w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 flex-shrink-0 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-md disabled:opacity-50"
              >
                <Send className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* 在线用户侧边栏 */}
        <AnimatePresence>
          {showUsersList && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-l border-gray-200 bg-gray-50 overflow-hidden"
            >
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">在线用户</h3>
                  <span className="text-sm text-gray-500">{onlineUsersList.length} 人</span>
                </div>

                <div className="space-y-2">
                  {onlineUsersList.map((user) => (
                    <div key={user.id} className="flex items-center space-x-3 p-2 hover:bg-white rounded-lg transition-colors">
                      <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center text-white font-medium text-sm">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{user.username}</p>
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-xs text-gray-500">在线</span>
                        </div>
                      </div>
                      <button className="text-gray-400 hover:text-gray-600">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}