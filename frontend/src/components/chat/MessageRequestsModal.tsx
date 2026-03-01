import React, { useState, useEffect } from 'react';
import { X, Check, XIcon, Clock, Shield, User } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';

import { replaceAlert } from '../../utils/toastHelper';
import { logger } from '../../utils/logger';

interface MessageRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  first_message_content: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  sender_username: string;
  sender_avatar: string;
  sender_verified: boolean;
}

interface MessageRequestsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshConversations?: () => void;
}

export const MessageRequestsModal: React.FC<MessageRequestsModalProps> = ({
  isOpen,
  onClose,
  onRefreshConversations
}) => {
  const [requests, setRequests] = useState<MessageRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadMessageRequests();
    }
  }, [isOpen]);

  const loadMessageRequests = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/privacy/message-requests`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('funnypixels_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setRequests(data.data.requests || []);
      }
    } catch (error) {
      logger.error('加载消息请求失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequest = async (requestId: string, action: 'accept' | 'decline') => {
    try {
      setProcessing(requestId);
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/privacy/message-requests/${requestId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('funnypixels_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action })
      });

      if (response.ok) {
        // 移除已处理的请求
        setRequests(prev => prev.filter(req => req.id !== requestId));

        // 如果接受了请求，刷新对话列表
        if (action === 'accept' && onRefreshConversations) {
          onRefreshConversations();
        }
      } else {
        const errorData = await response.json();
        alert(errorData.message || '操作失败');
      }
    } catch (error) {
      logger.error('处理请求失败:', error);
      replaceAlert.error('操作失败，请重试');
    } finally {
      setProcessing(null);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return '刚刚';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}小时前`;
    } else if (diffInHours < 48) {
      return '昨天';
    } else {
      return date.toLocaleDateString('zh-CN');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Shield className="w-6 h-6 text-blue-500" />
            <h2 className="text-xl font-semibold text-gray-900">消息请求</h2>
            {requests.length > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1">
                {requests.length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-gray-500 text-sm mt-2">加载中...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">暂无消息请求</h3>
            <p className="text-gray-500">当有新的消息请求时会显示在这里</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <Card key={request.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start space-x-4">
                    {/* 用户头像 */}
                    <div className="relative">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                        {request.sender_avatar ? (
                          <img
                            src={request.sender_avatar}
                            alt={request.sender_username}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          request.sender_username.charAt(0).toUpperCase()
                        )}
                      </div>
                      {request.sender_verified && (
                        <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white rounded-full p-1">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                    </div>

                    {/* 请求内容 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-semibold text-gray-900">
                            {request.sender_username}
                          </h3>
                          {request.sender_verified && (
                            <div className="text-blue-500" title="认证用户">
                              <Check className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">
                          {formatTime(request.created_at)}
                        </span>
                      </div>

                      <p className="text-gray-700 text-sm mb-4 bg-gray-50 p-3 rounded-lg">
                        {request.first_message_content}
                      </p>

                      {/* 操作按钮 */}
                      <div className="flex space-x-3">
                        <Button
                          onClick={() => handleRequest(request.id, 'accept')}
                          disabled={processing === request.id}
                          className="bg-green-500 hover:bg-green-600 text-white flex-1"
                          size="sm"
                        >
                          {processing === request.id ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <>
                              <Check className="w-4 h-4 mr-1" />
                              接受
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={() => handleRequest(request.id, 'decline')}
                          disabled={processing === request.id}
                          variant="outline"
                          className="border-red-300 text-red-600 hover:bg-red-50 flex-1"
                          size="sm"
                        >
                          {processing === request.id ? (
                            <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <>
                              <XIcon className="w-4 h-4 mr-1" />
                              拒绝
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">💡 提示</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• 接受请求后，对方可以与你正常聊天</li>
            <li>• 拒绝的请求不会再次出现</li>
            <li>• 你可以在隐私设置中调整谁可以发送消息请求</li>
          </ul>
        </div>
      </div>
    </div>
  );
};