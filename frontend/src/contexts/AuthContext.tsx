import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthService, AuthUser } from '../services/auth';
import { unifiedSessionManager } from '../services/unifiedSessionManager';
import { unifiedDrawService } from '../services/unifiedDrawService';
import { logger } from '../utils/logger';

interface AuthContextType {
  currentUser: AuthUser | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  setCurrentUser: (user: AuthUser | null) => void;
  setIsAuthenticated: (authenticated: boolean) => void;
  // 🔥 添加一个方法来同步更新所有认证状态
  setAuthState: (user: AuthUser | null, authenticated: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // 🔥 修复：isGuest应该从currentUser推导出来，而不是直接从AuthService读取
  // 这样确保isGuest和currentUser始终同步
  // 只有当AuthService.isGuest()为true，或者currentUser为null且没有token时，才认为是guest
  const isGuest = AuthService.isGuest() || (!currentUser && !AuthService.getToken());

  // 组件挂载时检查认证状态（与App.tsx中的逻辑同步）
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // 应用启动时检查并清理无效缓存
        const token = AuthService.getToken();
        if (!token) {
          logger.info('AuthContext: 未找到有效token，清理可能存在的无效缓存');
          AuthService.clearTokens();
        }

        // 首先检查本地是否有有效的token
        if (AuthService.isAuthenticated()) {
          logger.info('AuthContext: 检测到本地token，验证用户身份...');
          const user = await AuthService.getCurrentUser();
          if (user) {
            logger.info('AuthContext: 用户身份验证成功:', user.username);
            logger.info('AuthContext: 用户对象调试:', JSON.stringify(user, null, 2));
            logger.info('AuthContext: 用户ID调试:', user.id);

            setCurrentUser(user);
            setIsAuthenticated(true);

            // 🆕 初始化统一绘制系统（与App.tsx逻辑同步）
            try {
              if (!user.id) {
                logger.error('❌ 用户ID为空，无法初始化统一绘制系统');
              } else {
                unifiedSessionManager.setUserId(user.id);
                unifiedDrawService.initialize(user.id);
                logger.info('✅ 统一绘制系统已初始化，用户ID:', user.id);
              }
            } catch (error) {
              logger.warn('统一绘制系统初始化失败:', error);
            }

            // 登录成功后初始化图案缓存（完全非阻塞，延迟执行）
            try {
              logger.info('🚀 用户登录成功，准备初始化图案缓存...');
              // 延迟执行图案缓存初始化，避免阻塞界面
              setTimeout(() => {
                // patternCache.initialize().catch((error: any) => {
                //   logger.warn('图案缓存初始化失败，但不影响用户使用:', error);
                // });
              }, 2000); // 延迟2秒执行
            } catch (error) {
              logger.warn('图案缓存初始化失败，但不影响用户使用:', error);
            }
          } else {
            logger.info('AuthContext: 用户身份验证失败，清除认证状态');
            // 如果获取用户信息失败，清除认证状态
            await AuthService.logout();
            setIsAuthenticated(false);
          }
        }
      } catch (error) {
        logger.error('AuthContext: 检查认证状态时出错:', error);
        setIsAuthenticated(false);
      }
    };

    checkAuth();
  }, []);

  // 🔥 同步更新所有认证状态的方法
  const setAuthState = (user: AuthUser | null, authenticated: boolean) => {
    setCurrentUser(user);
    setIsAuthenticated(authenticated);
  };

  const value: AuthContextType = {
    currentUser,
    isAuthenticated,
    isGuest,
    setCurrentUser,
    setIsAuthenticated,
    setAuthState
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;