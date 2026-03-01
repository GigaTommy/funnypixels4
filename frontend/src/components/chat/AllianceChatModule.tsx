import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { replaceAlert } from '../../utils/toastHelper';
import {
  Send,
  Search,
  Crown,
  Users,
  MessageCircle,
  Smile,
  Image,
  MapPin,
  Paperclip,
  MoreVertical,
  FileText,
  Vote,
  Calendar,
  Settings,
  Shield,
  Flag
} from 'lucide-react';
import { AuthService } from '../../services/auth';
import { AllianceAPI } from '../../services/alliance';
import { ChatAPI } from '../../services/chat';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/Tabs';
import { useChatStore } from '../../stores/chat/chatStore';
import { chatWebSocket } from '../../services/websocket/chatWebSocket';
import MessageBubble from './core/MessageBubble';
import EmojiPicker from './ui/EmojiPicker';
import { logger } from '../../utils/logger';

interface AllianceMember {
  id: string;
  username: string;
  avatar_url?: string;
  role: 'leader' | 'admin' | 'member';
  join_date: string;
  is_online?: boolean;
  contribution_points: number;
}

interface AllianceMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar?: string;
  content: string;
  message_type: 'text' | 'image' | 'file' | 'announcement' | 'vote';
  metadata?: any;
  created_at: string;
  is_pinned?: boolean;
}

interface AllianceVote {
  id: string;
  title: string;
  description: string;
  options: string[];
  votes: Record<string, string>; // userId -> option
  created_by: string;
  created_at: string;
  expires_at: string;
  is_active: boolean;
}

interface AllianceEvent {
  id: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  location?: string;
  created_by: string;
  participants: string[];
  max_participants?: number;
}

export default function AllianceChatModule() {
  // Zustand状态管理
  const {
    isConnected,
    currentRoomId,
    messages: storeMessages,
    getRoomMessages,
    addMessage,
    setMessages,
    setCurrentRoom,
    joinRoom,
    isEmojiPickerVisible,
    toggleEmojiPicker,
    setCurrentUser: setChatCurrentUser,
    currentUserId,
    currentUsername,
    setOnlineUsers,
    setConnectionStatus
  } = useChatStore();

  // 本地状态 - 确保默认显示聊天标签
  const [activeTab, setActiveTab] = useState<'chat' | 'members' | 'activities' | 'files' | 'settings'>('chat');
  const [alliance, setAlliance] = useState<any>(null);
  const [members, setMembers] = useState<AllianceMember[]>([]);
  const [votes, setVotes] = useState<AllianceVote[]>([]);
  const [events, setEvents] = useState<AllianceEvent[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [showVoteCreator, setShowVoteCreator] = useState(false);
  const [showEventCreator, setShowEventCreator] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<'leader' | 'admin' | 'member' | null>(null);

  // 从Zustand store获取当前房间消息
  const roomId = alliance?.id ? `alliance:${alliance.id}` : null;
  const messages = roomId ? getRoomMessages(roomId) : [];

  // 调试信息
  logger.debug('🔍 AllianceChatModule 渲染状态:', {
    alliance: alliance?.name || 'null',
    roomId,
    messagesCount: messages.length,
    loading,
    activeTab,
    currentUserId,
    storeMessages: storeMessages
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (alliance) {
      loadMembers();
      loadVotes();
      loadEvents();

      // 加入联盟聊天室
      const allianceRoomId = `alliance:${alliance.id}`;
      joinRoom(allianceRoomId);
      setCurrentRoom(allianceRoomId);

      // 建立WebSocket连接
      logger.debug('建立WebSocket连接到联盟:', alliance.id, '连接状态:', chatWebSocket.isConnected());
      chatWebSocket.joinChatRoom({
        channelType: 'alliance',
        channelId: alliance.id
      });
    }
  }, [alliance, joinRoom, setCurrentRoom]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // WebSocket事件监听
  useEffect(() => {
    const handleNewMessage = (message: any) => {
      if (roomId && message.channelType === 'alliance' && message.channelId === alliance?.id) {
        addMessage(roomId, message);
      }
    };

    // 监听WebSocket连接状态变化
    const updateConnectionStatus = () => {
      const connected = chatWebSocket.isConnected();
      logger.debug('🔄 WebSocket连接状态更新:', connected);
      setConnectionStatus({
        isConnected: connected,
        isConnecting: false
      });
    };

    // 监听连接事件
    chatWebSocket.on('connect', updateConnectionStatus);
    chatWebSocket.on('disconnect', updateConnectionStatus);
    chatWebSocket.on('new_message', handleNewMessage);

    // 初始状态更新
    updateConnectionStatus();

    return () => {
      chatWebSocket.off('connect', updateConnectionStatus);
      chatWebSocket.off('disconnect', updateConnectionStatus);
      chatWebSocket.off('new_message', handleNewMessage);
    };
  }, [roomId, alliance, addMessage, setConnectionStatus]);

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

        // 获取用户联盟信息
        try {
          const allianceResponse = await AllianceAPI.getUserAlliance();
          if (allianceResponse.alliance) {
            setAlliance(allianceResponse.alliance);
            // 获取用户在联盟中的角色
                         // 暂时注释掉，因为AllianceAPI没有getMemberInfo方法
             // const memberInfo = await AllianceAPI.getMemberInfo(allianceResponse.alliance.id);
             // setUserRole(memberInfo.role);
             setUserRole('member'); // 暂时设置为普通成员

            // 加载联盟聊天历史消息
            try {
              const allianceRoomId = `alliance:${allianceResponse.alliance.id}`;
              logger.debug('正在加载联盟历史消息，房间ID:', allianceRoomId);

              const messagesResponse = await ChatAPI.getChannelMessages('alliance', allianceResponse.alliance.id);
              logger.debug('联盟消息响应:', messagesResponse);

              if (messagesResponse.success && messagesResponse.data) {
                logger.debug('成功获取', messagesResponse.data.length, '条联盟历史消息');
                logger.debug('📤 存储消息到房间:', allianceRoomId);
                logger.debug('📤 消息数据:', messagesResponse.data);
                setMessages(allianceRoomId, messagesResponse.data);

                // 验证存储是否成功
                setTimeout(() => {
                  const stored = getRoomMessages(allianceRoomId);
                  logger.debug('📥 验证存储结果:', stored.length, '条消息');
                }, 100);
              } else {
                logger.debug('联盟暂无历史消息');
                setMessages(allianceRoomId, []); // 确保房间存在，即使没有消息
              }
            } catch (messageError) {
              logger.error('加载联盟历史消息失败:', messageError);
              // 即使加载失败，也要确保房间存在
              const allianceRoomId = `alliance:${allianceResponse.alliance.id}`;
              setMessages(allianceRoomId, []);
            }
          }
        } catch (error) {
          logger.debug('用户未加入联盟');
        }
      }
    } catch (error) {
      logger.error('加载联盟数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);


  const loadMembers = useCallback(async () => {
    if (!alliance?.id) return;

    try {
      logger.debug('正在加载联盟成员，联盟ID:', alliance.id);

      // 调用真实的联盟成员API
      const response = await AllianceAPI.getAllianceMembers(alliance.id);
      logger.debug('联盟成员API响应:', response);

      if (response.success && response.members) {
        logger.debug('成功获取', response.members.length, '名联盟成员');

        // 转换API返回的数据格式以匹配组件期望的格式
        const transformedMembers: AllianceMember[] = response.members.map((member: any) => ({
          id: member.id,
          username: member.username,
          avatar_url: member.avatar_url,
          role: member.role,
          join_date: member.joined_at,
          is_online: member.last_active_at ?
            (new Date().getTime() - new Date(member.last_active_at).getTime()) < 5 * 60 * 1000 : // 5分钟内活跃算在线
            false,
          contribution_points: 0 // 暂时设为0，后续可以添加贡献点数统计
        }));

        setMembers(transformedMembers);

        // 设置在线用户
        const onlineUserIds = transformedMembers
          .filter(member => member.is_online)
          .map(member => member.id);
        if (roomId) {
          setOnlineUsers(roomId, onlineUserIds);
        }

        logger.debug('已设置', transformedMembers.length, '名联盟成员，其中', onlineUserIds.length, '名在线');
      } else {
        logger.debug('联盟成员API返回空数据或失败');
        setMembers([]);
      }
    } catch (error) {
      logger.error('加载联盟成员失败:', error);
      setMembers([]);
    }
  }, [alliance, roomId, setOnlineUsers]);

  const loadVotes = useCallback(async () => {
    try {
      // 这里应该调用联盟投票API
      // 暂时使用模拟数据
      const mockVotes: AllianceVote[] = [
        {
          id: '1',
          title: '联盟旗帜设计',
          description: '选择新的联盟旗帜设计',
          options: ['设计A', '设计B', '设计C'],
          votes: {},
          created_by: 'leader',
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 86400000).toISOString(),
          is_active: true
        }
      ];
      setVotes(mockVotes);
    } catch (error) {
      logger.error('加载投票失败:', error);
    }
  }, []);

  const loadEvents = useCallback(async () => {
    try {
      // 这里应该调用联盟活动API
      // 暂时使用模拟数据
      const mockEvents: AllianceEvent[] = [
        {
          id: '1',
          title: '像素艺术比赛',
          description: '联盟内部像素艺术创作比赛',
          start_time: new Date(Date.now() + 86400000).toISOString(),
          end_time: new Date(Date.now() + 172800000).toISOString(),
          created_by: 'leader',
          participants: ['member1', 'member2'],
          max_participants: 20
        }
      ];
      setEvents(mockEvents);
    } catch (error) {
      logger.error('加载活动失败:', error);
    }
  }, []);

  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !alliance || !roomId) return;

    const messageText = newMessage.trim();
    setNewMessage('');

    try {
      // 通过WebSocket发送消息
      chatWebSocket.sendMessage({
        channelType: 'alliance',
        channelId: alliance.id,
        messageType: 'text',
        content: messageText
      });

      // 也通过API发送作为备份
      const response = await ChatAPI.sendMessage({
        channelType: 'alliance',
        channelId: alliance.id,
        messageType: 'text',
        content: messageText
      });

      if (!response.success) {
        logger.warn('API发送失败:', response.message);
      }
    } catch (error) {
      logger.error('发送消息失败:', error);
      replaceAlert.error('发送失败，请重试');
    }
  }, [newMessage, alliance, roomId]);

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

  const handleVote = useCallback(async (voteId: string, option: string) => {
    try {
      // 这里应该调用投票API
      logger.debug('投票:', voteId, option);
      // 更新本地状态
      setVotes(prev => 
        prev.map(vote => 
          vote.id === voteId 
            ? { ...vote, votes: { ...vote.votes, [currentUser?.id || 'current']: option } }
            : vote
        )
      );
    } catch (error) {
      logger.error('投票失败:', error);
    }
  }, [currentUser]);

  const joinEvent = useCallback(async (eventId: string) => {
    try {
      // 这里应该调用加入活动API
      logger.debug('加入活动:', eventId);
      // 更新本地状态
      setEvents(prev => 
        prev.map(event => 
          event.id === eventId 
            ? { ...event, participants: [...event.participants, currentUser?.id || 'current'] }
            : event
        )
      );
    } catch (error) {
      logger.error('加入活动失败:', error);
    }
  }, [currentUser]);

  // 显示加载状态而不是空白页面
  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Crown className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">请先登录以使用联盟功能</p>
        </div>
      </div>
    );
  }

  if (!alliance) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Crown className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">您还没有加入联盟</p>
          <p className="text-gray-400 text-sm mb-4">加入联盟后即可使用群聊功能</p>
          <Button className="bg-blue-500 hover:bg-blue-600">
            查找联盟
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
      maxHeight: 'calc(100vh - 60px)', // 减去底部菜单栏高度
      overflow: 'hidden'
    }}>
      {/* 简化版本 - 直接显示聊天内容 */}

      {/* 联盟信息头部 */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #e5e7eb',
        backgroundColor: '#f9fafb',
        flexShrink: 0
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0' }}>
          {alliance ? `${alliance.name} 联盟群聊` : '联盟群聊'}
        </h2>
        <p style={{ fontSize: '14px', color: '#666', margin: '4px 0 0 0' }}>
          {members.length} 名成员 | 房间ID: {roomId}
        </p>
      </div>

      {/* 消息列表 */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        backgroundColor: '#f8f9fa',
        minHeight: 0 // 允许flex收缩
      }}>

        {loading ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '200px'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '32px',
                height: '32px',
                border: '2px solid #3b82f6',
                borderTop: '2px solid transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 12px auto'
              }}></div>
              <p style={{ color: '#666', fontSize: '14px', margin: '0' }}>加载中...</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '200px'
          }}>
            <div style={{ textAlign: 'center' }}>
              <MessageCircle style={{ width: '64px', height: '64px', color: '#d1d5db', margin: '0 auto 16px auto' }} />
              <p style={{ color: '#666', fontSize: '16px', fontWeight: '500', margin: '0' }}>开始联盟对话</p>
              <p style={{ color: '#9ca3af', fontSize: '14px', margin: '4px 0 0 0' }}>房间ID: {roomId}</p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {messages.map((message, index) => (
              <div
                key={message.id || index}
                style={{
                  padding: '12px 16px',
                  backgroundColor: message.sender_id === currentUserId ? '#e3f2fd' : '#ffffff',
                  borderRadius: '12px',
                  border: '1px solid #e0e0e0',
                  maxWidth: '80%',
                  alignSelf: message.sender_id === currentUserId ? 'flex-end' : 'flex-start'
                }}
              >
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                  {message.sender_name || message.sender_id} • {new Date(message.created_at).toLocaleTimeString()}
                </div>
                <div style={{ fontSize: '14px', lineHeight: '1.4' }}>
                  {message.content}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 输入框 - 固定在底部 */}
      <div
        style={{
          padding: '16px',
          borderTop: '1px solid #e5e7eb',
          backgroundColor: '#ffffff',
          flexShrink: 0,
          marginTop: 'auto' // 推到底部
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
            placeholder="输入消息..."
            style={{
              flex: 1,
              padding: '12px 16px',
              backgroundColor: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '24px',
              outline: 'none',
              fontSize: '14px'
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim() || !isConnected}
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              border: 'none',
              background: !newMessage.trim() || !isConnected
                ? '#d1d5db'
                : 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              color: 'white',
              cursor: !newMessage.trim() || !isConnected ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Send style={{ width: '20px', height: '20px' }} />
          </button>
        </div>
      </div>
    </div>
  );
}