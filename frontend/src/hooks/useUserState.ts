import { useState, useEffect, useCallback } from 'react';
import { logger } from '../utils/logger';
import { UserService, UserPixelState, PixelConfig } from '../services/api';

interface UseUserStateReturn {
  userState: UserPixelState | null;
  config: PixelConfig | null;
  canDraw: boolean;
  isLoading: boolean;
  error: string | null;
  refreshUserState: () => Promise<void>;
  resetUserState: () => Promise<void>;
}

export function useUserState(): UseUserStateReturn {
  const [userState, setUserState] = useState<UserPixelState | null>(null);
  const [config, setConfig] = useState<PixelConfig | null>(null);
  const [canDraw, setCanDraw] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 初始化用户
  const initializeUser = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await UserService.initializeUser();
      setUserState(result.state);
      setConfig(result.config);
      setCanDraw(result.state.pixel_points > 0 && result.state.freeze_until === '0');
      
      logger.info('用户初始化成功:', result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '用户初始化失败';
      setError(errorMessage);
      logger.error('用户初始化失败:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 刷新用户状态
  const refreshUserState = useCallback(async () => {
    try {
      setError(null);
      
      const result = await UserService.getUserStatus();
      setUserState(result.state);
      setCanDraw(result.canDraw);
      
      logger.info('用户状态刷新成功:', result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取用户状态失败';
      setError(errorMessage);
      logger.error('获取用户状态失败:', err);
    }
  }, []);

  // 重置用户状态
  const resetUserState = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await UserService.resetUserStatus();
      setUserState(result.state);
      setCanDraw(result.state.pixel_points > 0 && result.state.freeze_until === '0');
      
      logger.info('用户状态重置成功:', result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '重置用户状态失败';
      setError(errorMessage);
      logger.error('重置用户状态失败:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 定期刷新用户状态（降低频率）
  useEffect(() => {
    if (!userState) {
      initializeUser();
      return;
    }

    // 每30秒刷新一次用户状态（降低频率）
    const interval = setInterval(() => {
      refreshUserState();
    }, 30000);

    return () => clearInterval(interval);
  }, [userState, initializeUser, refreshUserState]);

  return {
    userState,
    config,
    canDraw,
    isLoading,
    error,
    refreshUserState,
    resetUserState,
  };
}
