import React, { useState, useEffect } from 'react';
import { logger } from '../utils/logger';
import { RiLoader4Line } from 'react-icons/ri';
import CleanLogin from '../components/auth/CleanLogin';
import { AuthService } from '../services/auth';

interface CleanAuthPageProps {
  onAuthSuccess: () => void;
}

export default function CleanAuthPage({ onAuthSuccess }: CleanAuthPageProps) {
  const [isLoading, setIsLoading] = useState(true);

  // 检查是否已经登录
  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (AuthService.isAuthenticated()) {
          const user = await AuthService.getCurrentUser();
          if (user) {
            logger.info('✅ 用户已登录:', user.username);
            onAuthSuccess();
            return;
          }
        }
      } catch (error) {
        logger.warn('❌ 认证检查失败，需要重新登录');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [onAuthSuccess]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RiLoader4Line className="animate-spin text-4xl text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <CleanLogin onLoginSuccess={onAuthSuccess} />
  );
}