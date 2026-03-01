import React, { useState, useEffect } from 'react';
import { logger } from '../../utils/logger';
import { SocialAPI, LeaderboardEntry } from '../../services/social';

interface LeaderboardHistoryProps {
  type: 'user' | 'alliance';
  title: string;
}

interface HistoryData {
  date: string;
  rankings: LeaderboardEntry[];
}

export default function LeaderboardHistory({ type, title }: LeaderboardHistoryProps) {
  const [history, setHistory] = useState<HistoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [selectedDate, setSelectedDate] = useState<string>('');

  useEffect(() => {
    loadHistory();
  }, [type, period]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const response = await SocialAPI.getLeaderboardHistory(type, period, 7);
      if (response.success) {
        setHistory(response.data);
        if (response.data.length > 0) {
          setSelectedDate(response.data[0].date);
        }
      }
    } catch (error) {
      logger.error('加载排行榜历史失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPeriodText = (p: string) => {
    switch (p) {
      case 'daily': return '日榜';
      case 'weekly': return '周榜';
      case 'monthly': return '月榜';
      default: return p;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN');
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const selectedHistory = history.find(h => h.date === selectedDate);

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* 标题和控制 */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">{title} - 历史记录</h3>
          <div className="flex items-center space-x-2">
            {/* 周期选择 */}
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as any)}
              className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="daily">日榜</option>
              <option value="weekly">周榜</option>
              <option value="monthly">月榜</option>
            </select>
            
            <button
              onClick={loadHistory}
              disabled={loading}
              className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
            >
              {loading ? '刷新中...' : '刷新'}
            </button>
          </div>
        </div>

        {/* 日期选择 */}
        {history.length > 0 && (
          <div className="mt-3">
            <div className="flex flex-wrap gap-2">
              {history.map((item) => (
                <button
                  key={item.date}
                  onClick={() => setSelectedDate(item.date)}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    selectedDate === item.date
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {formatDate(item.date)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 历史排行榜 */}
      <div className="divide-y">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : !selectedHistory ? (
          <div className="text-center text-gray-500 py-8">
            暂无历史数据
          </div>
        ) : selectedHistory.rankings.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            该日期暂无排行数据
          </div>
        ) : (
          <>
            {/* 选中日期标题 */}
            <div className="p-3 bg-gray-50 text-center text-sm text-gray-600">
              {formatDate(selectedHistory.date)} {getPeriodText(period)}前十名
            </div>
            
            {selectedHistory.rankings.map((entry, index) => {
              const rank = index + 1;
              
              return (
                <div key={entry.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {/* 排名 */}
                    <div className="text-lg font-bold w-12 text-center">
                      {getRankIcon(rank)}
                    </div>

                    {/* 头像/图标 */}
                    <div className="flex-shrink-0">
                      {type === 'user' ? (
                        entry.avatar_url ? (
                          <img
                            src={entry.avatar_url}
                            alt={entry.username}
                            className="w-8 h-8 rounded-full"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                            <span className="text-xs font-semibold text-gray-600">
                              {entry.username?.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )
                      ) : (
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs"
                          style={{ backgroundColor: entry.color || '#6B7280' }}
                        >
                          {entry.name?.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* 名称和信息 */}
                    <div>
                      <h4 className="font-medium text-gray-900 text-sm">
                        {type === 'user' ? entry.username : entry.name}
                      </h4>
                      <div className="text-xs text-gray-500 space-x-2">
                        <span>{getPeriodText(period)}: {formatNumber(entry.period_pixels)}</span>
                        <span>累计: {formatNumber(entry.total_pixels)}</span>
                      </div>
                    </div>
                  </div>

                  {/* 分数显示 */}
                  <div className="text-right">
                    <div className="text-base font-bold text-blue-600">
                      {formatNumber(entry.period_pixels)}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
