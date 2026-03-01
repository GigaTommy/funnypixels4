import React, { useState, useEffect } from 'react';
import { logger } from '../../utils/logger';
import { SocialAPI, UserFollow } from '../../services/social';
import { AuthService } from '../../services/auth';
import FollowButton from './FollowButton';

interface FollowListProps {
  userId: string;
  type: 'following' | 'followers' | 'mutual';
  title: string;
}

export default function FollowList({ userId, type, title }: FollowListProps) {
  const [users, setUsers] = useState<UserFollow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const limit = 20;

  useEffect(() => {
    loadUsers(true);
  }, [userId, type]);

  const loadUsers = async (reset = false) => {
    const currentOffset = reset ? 0 : offset;
    
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      let response;
      switch (type) {
        case 'following':
          response = await SocialAPI.getFollowing(userId, limit, currentOffset);
          break;
        case 'followers':
          response = await SocialAPI.getFollowers(userId, limit, currentOffset);
          break;
        case 'mutual':
          response = await SocialAPI.getMutualFollows(userId, limit, currentOffset);
          break;
      }

      if (response && response.success) {
        if (reset) {
          setUsers(response.data);
        } else {
          setUsers(prev => [...prev, ...response.data]);
        }
        
        setHasMore(response.data.length === limit);
        setOffset(reset ? limit : currentOffset + limit);
      }
    } catch (error) {
      logger.error('加载用户列表失败:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      loadUsers(false);
    }
  };

  const handleFollowChange = (targetUserId: string, isFollowing: boolean) => {
    // 如果是关注列表且取消关注，从列表中移除
    if (type === 'following' && !isFollowing) {
      setUsers(prev => prev.filter(user => user.following_id !== targetUserId));
    }
  };

  if (!AuthService.isAuthenticated()) {
    return (
      <div className="flex items-center justify-center h-32 bg-gray-50 rounded-lg">
        <p className="text-gray-500">请先登录以查看用户列表</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-gray-800">{title}</h3>
      </div>

      <div className="divide-y">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            暂无用户
          </div>
        ) : (
          <>
            {users.map((user) => {
              const displayUserId = type === 'following' ? user.following_id : user.follower_id;
              
              return (
                <div key={user.id} className="p-4 flex items-center justify-between">
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
                    </div>
                  </div>

                  {/* 关注按钮 */}
                  <FollowButton
                    userId={displayUserId}
                    username={user.username}
                    onFollowChange={(isFollowing) => handleFollowChange(displayUserId, isFollowing)}
                  />
                </div>
              );
            })}

            {/* 加载更多 */}
            {hasMore && (
              <div className="p-4 text-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="px-4 py-2 text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
                >
                  {loadingMore ? '加载中...' : '加载更多'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
