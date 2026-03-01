import React, { useState, useEffect } from 'react';
import { logger } from '../../utils/logger';
import { SocialAPI, UserFollow } from '../../services/social';
import { AuthService } from '../../services/auth';
import FollowButton from './FollowButton';

export default function RecommendedFollows() {
  const [users, setUsers] = useState<UserFollow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecommendedUsers();
  }, []);

  const loadRecommendedUsers = async () => {
    if (!AuthService.isAuthenticated()) return;

    setLoading(true);
    try {
      const response = await SocialAPI.getRecommendedFollows(10);
      if (response.success) {
        setUsers(response.data);
      }
    } catch (error) {
      logger.error('加载推荐用户失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollowChange = (userId: string, isFollowing: boolean) => {
    if (isFollowing) {
      // 关注后从推荐列表中移除
      setUsers(prev => prev.filter(user => user.following_id !== userId));
    }
  };

  if (!AuthService.isAuthenticated()) {
    return (
      <div className="flex items-center justify-center h-32 bg-gray-50 rounded-lg">
        <p className="text-gray-500">请先登录以查看推荐关注</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">推荐关注</h3>
        <button
          onClick={loadRecommendedUsers}
          disabled={loading}
          className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
        >
          {loading ? '刷新中...' : '刷新'}
        </button>
      </div>

      <div className="divide-y">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            暂无推荐用户
          </div>
        ) : (
          users.map((user) => (
            <div key={user.following_id} className="p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {/* 头像 */}
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.username}
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                    <span className="text-sm font-semibold text-gray-600">
                      {user.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}

                {/* 用户信息 */}
                <div>
                  <h4 className="font-medium text-gray-900">{user.username}</h4>
                  <p className="text-sm text-gray-500">
                    累计像素: {user.total_pixels} | 当前占领: {user.current_pixels}
                  </p>
                  {/* 显示共同关注数 */}
                  {(user as any).mutual_count && (
                    <p className="text-xs text-blue-600">
                      {(user as any).mutual_count} 个共同关注
                    </p>
                  )}
                </div>
              </div>

              {/* 关注按钮 */}
              <FollowButton
                userId={user.following_id}
                username={user.username}
                initialFollowState={false}
                onFollowChange={(isFollowing) => handleFollowChange(user.following_id, isFollowing)}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
