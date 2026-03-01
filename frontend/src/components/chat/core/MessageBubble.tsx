import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  MoreVertical,
  Reply,
  Copy,
  Edit,
  Trash2,
  Flag,
  Heart,
  Smile,
  Download,
  ExternalLink,
  MapPin
} from 'lucide-react';
import { ChatMessage } from '../../../services/chat';
import { formatTime } from '../../../utils/chat/timeUtils';

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  showAvatar?: boolean;
  showTimestamp?: boolean;
  onReply?: (message: ChatMessage) => void;
  onEdit?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onReact?: (messageId: string, emoji: string) => void;
  className?: string;
}

export default function MessageBubble({
  message,
  isOwn,
  showAvatar = true,
  showTimestamp = true,
  onReply,
  onEdit,
  onDelete,
  onReact,
  className = ''
}: MessageBubbleProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showReactions, setShowReactions] = useState(false);

  const formatTimestamp = useCallback((timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return '刚刚';
    } else if (diffInHours < 24) {
      return date.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } else {
      return date.toLocaleDateString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  }, []);

  const getMessageContent = useCallback(() => {
    switch (message.message_type) {
      case 'text':
        return (
          <div className="text-sm whitespace-pre-wrap break-words">
            {message.content}
          </div>
        );

      case 'image':
        return (
          <div className="rounded-lg overflow-hidden max-w-xs">
            <img
              src={message.metadata?.image_url || message.content}
              alt="图片消息"
              className="w-full h-auto"
              loading="lazy"
            />
            {message.content && message.content !== message.metadata?.image_url && (
              <div className="p-2 text-sm">{message.content}</div>
            )}
          </div>
        );

      case 'location':
        return (
          <div className="flex items-center space-x-2 p-2 bg-blue-50 rounded-lg">
            <MapPin className="w-4 h-4 text-blue-600" />
            <div className="text-sm">
              <div className="font-medium text-blue-900">位置分享</div>
              <div className="text-blue-700">{message.content}</div>
            </div>
          </div>
        );

      case 'system':
        return (
          <div className="text-sm text-gray-600 italic">
            {message.content}
          </div>
        );

      case 'announcement':
        return (
          <div className="text-sm">
            <div className="flex items-center space-x-1 mb-1">
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              <span className="text-xs font-medium text-yellow-700">公告</span>
            </div>
            {message.content}
          </div>
        );

      default:
        return (
          <div className="text-sm">{message.content}</div>
        );
    }
  }, [message]);

  const getMessageStyle = useCallback(() => {
    if (message.message_type === 'system') {
      return 'bg-gray-100 text-gray-800 border-l-4 border-blue-500';
    }

    if (message.message_type === 'announcement') {
      return 'bg-yellow-50 text-yellow-900 border border-yellow-200';
    }

    if (isOwn) {
      return 'bg-gradient-to-r from-blue-500 to-purple-600 text-white';
    }

    return 'bg-gray-100 text-gray-900';
  }, [message.message_type, isOwn]);

  const handleQuickReaction = useCallback((emoji: string) => {
    onReact?.(message.id, emoji);
    setShowReactions(false);
  }, [message.id, onReact]);

  const handleCopyMessage = useCallback(() => {
    navigator.clipboard.writeText(message.content);
    setShowMenu(false);
  }, [message.content]);

  // 系统消息特殊布局
  if (message.message_type === 'system') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex justify-center mb-3 ${className}`}
      >
        <div className="max-w-xs px-4 py-2 rounded-2xl bg-gray-100 text-gray-700 text-sm text-center">
          {message.content}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3 group ${className}`}
    >
      <div className={`flex ${isOwn ? 'flex-row-reverse' : 'flex-row'} items-end space-x-2 max-w-[70%]`}>
        {/* 头像 */}
        {showAvatar && !isOwn && (
          <div className="w-8 h-8 flex-shrink-0">
            {message.sender_avatar ? (
              <img
                src={message.sender_avatar}
                alt={message.sender_name}
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium text-sm">
                {message.sender_name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        )}

        {/* 消息内容 */}
        <div className="flex flex-col">
          {/* 发送者名字 */}
          {!isOwn && showTimestamp && (
            <div className="flex items-center space-x-2 mb-1 px-1">
              <span className="text-xs font-medium text-gray-600">{message.sender_name}</span>
              <span className="text-xs text-gray-400">{formatTimestamp(message.created_at)}</span>
            </div>
          )}

          {/* 消息气泡 */}
          <div className="relative">
            <div
              className={`px-4 py-2 rounded-2xl ${getMessageStyle()} ${
                isOwn ? 'rounded-br-sm' : 'rounded-bl-sm'
              } relative`}
              onMouseEnter={() => setShowReactions(true)}
              onMouseLeave={() => setShowReactions(false)}
            >
              {getMessageContent()}

              {/* 消息状态指示器（仅自己的消息） */}
              {isOwn && (
                <div className="absolute -bottom-1 -right-1 text-xs text-gray-400">
                  {message.metadata?.status === 'sending' && '⏳'}
                  {message.metadata?.status === 'sent' && '✓'}
                  {message.metadata?.status === 'delivered' && '✓✓'}
                  {message.metadata?.status === 'read' && '✓✓'}
                </div>
              )}
            </div>

            {/* 快速反应按钮 */}
            {showReactions && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`absolute ${isOwn ? 'left-0' : 'right-0'} -top-8 bg-white rounded-full shadow-lg border border-gray-200 px-1 py-1 flex space-x-1 z-10`}
              >
                {['❤️', '👍', '😂', '😮', '😢', '😡'].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleQuickReaction(emoji)}
                    className="w-6 h-6 text-sm hover:scale-125 transition-transform"
                  >
                    {emoji}
                  </button>
                ))}
              </motion.div>
            )}

            {/* 消息菜单 */}
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`absolute ${isOwn ? 'left-0' : 'right-0'} top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-200 py-2 min-w-[160px] z-20`}
              >
                {onReply && (
                  <button
                    onClick={() => {
                      onReply(message);
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                  >
                    <Reply className="w-4 h-4" />
                    <span>回复</span>
                  </button>
                )}

                <button
                  onClick={handleCopyMessage}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                >
                  <Copy className="w-4 h-4" />
                  <span>复制</span>
                </button>

                {isOwn && onEdit && (
                  <button
                    onClick={() => {
                      onEdit(message.id);
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                  >
                    <Edit className="w-4 h-4" />
                    <span>编辑</span>
                  </button>
                )}

                {isOwn && onDelete && (
                  <button
                    onClick={() => {
                      onDelete(message.id);
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 text-red-600 flex items-center space-x-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>删除</span>
                  </button>
                )}

                {!isOwn && (
                  <button
                    onClick={() => setShowMenu(false)}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 text-red-600 flex items-center space-x-2"
                  >
                    <Flag className="w-4 h-4" />
                    <span>举报</span>
                  </button>
                )}
              </motion.div>
            )}
          </div>

          {/* 时间戳（自己的消息） */}
          {isOwn && showTimestamp && (
            <div className="text-xs text-gray-400 text-right mt-1 px-1">
              {formatTimestamp(message.created_at)}
            </div>
          )}

          {/* 消息反应 */}
          {message.metadata?.reactions && Object.keys(message.metadata.reactions).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {Object.entries(message.metadata.reactions).map(([emoji, users]) => (
                <button
                  key={emoji}
                  onClick={() => handleQuickReaction(emoji)}
                  className="flex items-center space-x-1 px-2 py-1 bg-gray-100 rounded-full text-xs hover:bg-gray-200 transition-colors"
                >
                  <span>{emoji}</span>
                  <span className="text-gray-600">{(users as string[]).length}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 消息选项按钮 */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <MoreVertical className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}