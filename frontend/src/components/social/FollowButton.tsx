import React, { useState, useEffect } from 'react';
import { logger } from '../../utils/logger';
import { SocialAPI } from '../../services/social';
import { AuthService, AuthUser } from '../../services/auth';
import { useToast } from '../ui/Toast';

interface FollowButtonProps {
  userId: string;
  username: string;
  initialFollowState?: boolean;
  onFollowChange?: (isFollowing: boolean) => void;
}

export default function FollowButton({
  userId,
  username,
  initialFollowState,
  onFollowChange
}: FollowButtonProps) {
  const toast = useToast();
  const [isFollowing, setIsFollowing] = useState(initialFollowState ?? false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(initialFollowState === undefined);

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const loadCurrentUser = async () => {
      const user = await AuthService.getCurrentUser();
      setCurrentUser(user);
    };
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (initialFollowState === undefined && currentUser && userId !== currentUser.id) {
      checkFollowStatus();
    }
  }, [userId, currentUser]);

  const checkFollowStatus = async () => {
    setChecking(true);
    try {
      const response = await SocialAPI.checkFollowStatus(userId);
      if (response.success) {
        setIsFollowing(response.data.isFollowing);
      }
    } catch (error) {
      logger.error('检查关注状态失败:', error);
    } finally {
      setChecking(false);
    }
  };

  const handleToggleFollow = async () => {
    if (loading || !currentUser) return;

    setLoading(true);
    try {
      if (isFollowing) {
        const response = await SocialAPI.unfollowUser(userId);
        if (response.success) {
          setIsFollowing(false);
          onFollowChange?.(false);
        }
      } else {
        const response = await SocialAPI.followUser(userId);
        if (response.success) {
          setIsFollowing(true);
          onFollowChange?.(true);
        }
      }
    } catch (error) {
      logger.error('操作失败:', error);
      toast.error('操作失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 不显示关注自己的按钮
  if (!currentUser || userId === currentUser.id) {
    return null;
  }

  if (checking) {
    return (
      <button
        disabled
        className="px-3 py-1 text-sm border border-gray-300 rounded-md text-gray-500 cursor-not-allowed"
      >
        检查中...
      </button>
    );
  }

  return (
    <button
      onClick={handleToggleFollow}
      disabled={loading}
      className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
        isFollowing
          ? 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
          : 'bg-blue-600 text-white hover:bg-blue-700'
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {loading ? '处理中...' : isFollowing ? '已关注' : '关注'}
    </button>
  );
}
