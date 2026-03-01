import React, { useState, useEffect } from 'react';
import { logger } from '../../utils/logger';
import { SocialAPI, LeaderboardEntry } from '../../services/social';
import { AuthService, AuthUser } from '../../services/auth';

interface LeaderboardProps {
  type: 'user' | 'alliance';
  title: string;
}

export default function Leaderboard({ type, title }: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [userRank, setUserRank] = useState<number | null>(null);

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const loadCurrentUser = async () => {
      const user = await AuthService.getCurrentUser();
      setCurrentUser(user);
    };
    loadCurrentUser();
  }, []);

  useEffect(() => {
    loadLeaderboard();
    if (currentUser && type === 'user') {
      loadUserRank();
    }
  }, [type, period, currentUser]);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const response = await SocialAPI.getLeaderboard(type, period);
      if (response.success) {
        setEntries(response.data);
      }
    } catch (error) {
      logger.error('加载排行榜失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserRank = async () => {
    if (!currentUser) return;

    try {
      const response = await SocialAPI.getUserRank(currentUser.id, type, period);
      if (response.success && response.data) {
        setUserRank(response.data.rank);
      } else {
        setUserRank(null);
      }
    } catch (error) {
      logger.error('加载用户排名失败:', error);
      setUserRank(null);
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

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* 标题和控制 */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">{title}</h3>
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
              onClick={loadLeaderboard}
              disabled={loading}
              className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
            >
              {loading ? '刷新中...' : '刷新'}
            </button>
          </div>
        </div>

        {/* 当前用户排名 */}
        {currentUser && type === 'user' && userRank && (
          <div className="mt-2 text-sm text-gray-600">
            您当前排名: #{userRank}
          </div>
        )}
      </div>

      {/* 排行榜列表 */}
      <div className="divide-y">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            暂无排行数据
          </div>
        ) : (
          entries.map((entry, index) => {
            const rank = index + 1;
            const isCurrentUser = currentUser && entry.id === currentUser.id;
            
            return (
              <div
                key={entry.id}
                className={`p-4 flex items-center justify-between ${
                  isCurrentUser ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                }`}
              >
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
                          className="w-10 h-10 rounded-full"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                          <span className="text-sm font-semibold text-gray-600">
                            {entry.username?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )
                    ) : (
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: entry.color || '#6B7280' }}
                      >
                        {entry.name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* 名称和信息 */}
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {type === 'user' ? entry.username : entry.name}
                      {isCurrentUser && (
                        <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          我
                        </span>
                      )}
                    </h4>
                    <div className="text-sm text-gray-500 space-x-4">
                      <span>{getPeriodText(period)}像素: {formatNumber(entry.period_pixels)}</span>
                      <span>累计: {formatNumber(entry.total_pixels)}</span>
                      <span>当前: {formatNumber(entry.current_pixels)}</span>
                      {type === 'alliance' && entry.member_count && (
                        <span>成员: {entry.member_count}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 分数显示 */}
                <div className="text-right">
                  <div className="text-lg font-bold text-blue-600">
                    {formatNumber(entry.period_pixels)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {getPeriodText(period)}像素
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
