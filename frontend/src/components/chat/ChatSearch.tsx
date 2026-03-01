import React, { useState } from 'react';
import { logger } from '../../utils/logger';
import { ChatAPI, ChatMessage } from '../../services/chat';
import { AuthService } from '../../services/auth';

export default function ChatSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [channelType, setChannelType] = useState<string>('');

  const handleSearch = async () => {
    if (!query.trim() || !AuthService.isAuthenticated()) return;

    setLoading(true);
    try {
      const response = await ChatAPI.searchMessages(
        query.trim(),
        channelType || undefined
      );
      
      if (response.success) {
        setResults(response.data);
      }
    } catch (error) {
      logger.error('搜索消息失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN');
  };

  const getChannelTypeText = (type: string) => {
    switch (type) {
      case 'global': return '全局';
      case 'alliance': return '联盟';
      case 'private': return '私聊';
      default: return type;
    }
  };

  if (!AuthService.isAuthenticated()) {
    return (
      <div className="flex items-center justify-center h-32 bg-gray-50 rounded-lg">
        <p className="text-gray-500">请先登录以使用搜索功能</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">搜索消息</h3>
      
      {/* 搜索输入 */}
      <div className="space-y-4 mb-6">
        <div className="flex space-x-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="输入搜索关键词..."
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={handleSearch}
            disabled={!query.trim() || loading}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '搜索中...' : '搜索'}
          </button>
        </div>

        {/* 频道类型过滤 */}
        <div className="flex space-x-4">
          <label className="text-sm text-gray-700">搜索范围:</label>
          <select
            value={channelType}
            onChange={(e) => setChannelType(e.target.value)}
            className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部</option>
            <option value="global">全局消息</option>
            <option value="alliance">联盟消息</option>
            <option value="private">私聊消息</option>
          </select>
        </div>
      </div>

      {/* 搜索结果 */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : results.length === 0 ? (
          query && (
            <div className="text-center text-gray-500 py-8">
              未找到相关消息
            </div>
          )
        ) : (
          results.map((message) => (
            <div key={message.id} className="border rounded-lg p-4 hover:bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-gray-900">
                    {message.sender_name}
                  </span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                    {getChannelTypeText(message.channel_type)}
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  {formatTime(message.created_at)}
                </span>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {message.content}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
