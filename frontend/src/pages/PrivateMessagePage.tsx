import React, { useState, useEffect, useCallback, useRef } from 'react';
import { logger } from '../utils/logger';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  ArrowLeft, 
  Search, 
  MoreVertical,
  User,
  MessageCircle,
  Clock,
  Check,
  CheckCheck
} from 'lucide-react';
import { AuthService } from '../services/auth';
import { tokenManager } from '../services/tokenManager';
import { config } from '../config/env';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
  reply_to_message_id?: string;
}

interface Conversation {
  other_user: {
    id: string;
    username: string;
    avatar_url?: string;
  };
  last_message: Message;
  unread_count: number;
}

interface PrivateMessagePageProps {
  onBack: () => void;
}

export default function PrivateMessagePage({ onBack }: PrivateMessagePageProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // 获取用户信息
  useEffect(() => {
    const loadUser = async () => {
      try {
        if (AuthService.getCurrentUser) {
          const user = await AuthService.getCurrentUser();
          setCurrentUser(user);
        } else {
          // 从localStorage直接获取
          const userStr = localStorage.getItem('user');
          if (userStr) {
            const user = JSON.parse(userStr);
            setCurrentUser(user);
          }
        }
      } catch (error) {
        logger.error('获取用户信息失败:', error);
      }
    };
    
    loadUser();
  }, []);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.other_user.id);
    }
  }, [selectedConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${config.API_BASE_URL}/api/private-messages/conversations`, {
        headers: {
          'Authorization': `Bearer ${tokenManager.getToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      }
    } catch (error) {
      logger.error('加载对话列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (otherUserId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`${config.API_BASE_URL}/api/private-messages/conversations/${otherUserId}`, {
        headers: {
          'Authorization': `Bearer ${tokenManager.getToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
        
        // 标记对话为已读
        await markConversationAsRead(otherUserId);
      }
    } catch (error) {
      logger.error('加载消息失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const markConversationAsRead = useCallback(async (otherUserId: string) => {
    try {
      await fetch(`${config.API_BASE_URL}/api/private-messages/conversations/${otherUserId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${tokenManager.getToken()}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      logger.error('标记已读失败:', error);
    }
  }, []);

  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      const response = await fetch(`${config.API_BASE_URL}/api/private-messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenManager.getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          receiver_id: selectedConversation.other_user.id,
          content: newMessage.trim()
        })
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(prev => [...prev, data.message]);
        setNewMessage('');
        
        // 更新对话列表中的最后消息
        setConversations(prev => prev.map(conv => 
          conv.other_user.id === selectedConversation.other_user.id
            ? { ...conv, last_message: data.message, unread_count: 0 }
            : conv
        ));
      }
    } catch (error) {
      logger.error('发送消息失败:', error);
    }
  }, [newMessage, selectedConversation]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 48) {
      return '昨天';
    } else {
      return date.toLocaleDateString('zh-CN');
    }
  };

  const filteredConversations = conversations.filter(conv =>
    conv.other_user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!selectedConversation) {
    return (
      <div className="w-full h-full bg-gray-50">
        <div className="flex items-center justify-between p-4 bg-white border-b">
          <div className="flex items-center space-x-3">
            <Button variant="ghost" onClick={onBack} className="p-2">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-semibold">私信</h1>
          </div>
        </div>

        <div className="p-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="搜索用户..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-2">
            {loading ? (
              <div className="text-center py-8">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-gray-500 text-sm mt-2">加载中...</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <Card className="p-8 text-center">
                <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 font-medium mb-2">暂无私信对话</p>
                <p className="text-gray-400 text-sm">开始与其他用户私信交流吧！</p>
              </Card>
            ) : (
              filteredConversations.map((conversation) => (
                <Card
                  key={conversation.other_user.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedConversation(conversation)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                        {conversation.other_user.avatar_url ? (
                          <img 
                            src={conversation.other_user.avatar_url} 
                            alt={conversation.other_user.username}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          conversation.other_user.username.charAt(0).toUpperCase()
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-semibold text-gray-900 truncate">
                            {conversation.other_user.username}
                          </h3>
                          <span className="text-xs text-gray-500">
                            {formatTime(conversation.last_message.created_at)}
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-gray-600 truncate flex-1">
                            {conversation.last_message.content}
                          </p>
                          {conversation.unread_count > 0 && (
                            <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                              {conversation.unread_count}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-gray-50">
      {/* 聊天头部 */}
      <div className="flex items-center justify-between p-4 bg-white border-b">
        <div className="flex items-center space-x-3">
          <Button variant="ghost" onClick={() => setSelectedConversation(null)} className="p-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
            {selectedConversation.other_user.avatar_url ? (
              <img 
                src={selectedConversation.other_user.avatar_url} 
                alt={selectedConversation.other_user.username}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              selectedConversation.other_user.username.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">{selectedConversation.other_user.username}</h2>
            <p className="text-xs text-gray-500">在线</p>
          </div>
        </div>
        
        <Button variant="ghost" className="p-2">
          <MoreVertical className="w-5 h-5" />
        </Button>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="text-center py-8">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-gray-500 text-sm mt-2">加载消息中...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8">
            <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 font-medium mb-2">暂无消息</p>
            <p className="text-gray-400 text-sm">发送第一条消息开始对话吧！</p>
          </div>
        ) : (
          messages.map((message) => {
            const isOwnMessage = message.sender_id === currentUser?.id;
            
            return (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-xs lg:max-w-md ${isOwnMessage ? 'order-2' : 'order-1'}`}>
                  <div className={`rounded-2xl px-4 py-2 ${
                    isOwnMessage 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-white text-gray-900 border'
                  }`}>
                    <p className="text-sm">{message.content}</p>
                  </div>
                  
                  <div className={`flex items-center space-x-1 mt-1 text-xs ${
                    isOwnMessage ? 'justify-end' : 'justify-start'
                  }`}>
                    <span className="text-gray-500">
                      {formatTime(message.created_at)}
                    </span>
                    {isOwnMessage && (
                      <span className="text-gray-500">
                        {message.is_read ? <CheckCheck className="w-3 h-3 text-blue-500" /> : <Check className="w-3 h-3" />}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 发送消息区域 */}
      <div className="p-4 bg-white border-t">
        <div className="flex items-center space-x-2">
          <input
            type="text"
            placeholder="输入消息..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Button 
            onClick={sendMessage}
            disabled={!newMessage.trim()}
            className="p-2"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}