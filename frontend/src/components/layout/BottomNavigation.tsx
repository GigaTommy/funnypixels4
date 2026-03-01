import React from 'react';
import { Map, ShoppingBag, TrendingUp, Flag, User, Settings } from 'lucide-react';
import { AuthService } from '../../services/auth';
import { replaceAlert } from '../../utils/toastHelper';
import { logger } from '../../utils/logger';
import { useBadge } from '../../hooks/useBadge';

interface BottomNavigationProps {
  currentPage: string;
  onPageChange: (page: string) => void;
  isAuthenticated: boolean;
  onLoginClick: () => void;
}

export default function BottomNavigation({
  currentPage,
  onPageChange,
  isAuthenticated,
  onLoginClick
}: BottomNavigationProps) {

  // 检查是否为管理员
  const [currentUser, setCurrentUser] = React.useState<any>(null);
  const [isAdmin, setIsAdmin] = React.useState(false);

  // Badge 数据
  const { badges } = useBadge(isAuthenticated);

  React.useEffect(() => {
    const checkAdminStatus = async () => {
      const user = await AuthService.getCurrentUser();
      setCurrentUser(user);

      // 调试信息：打印用户权限信息
      logger.debug('🔍 BottomNavigation 用户权限检查:', {
        userId: user?.id,
        username: user?.username,
        role: user?.role,
        is_admin: user?.is_admin,
        isAdminCheck: user?.role === 'admin' || user?.role === 'super_admin' || user?.is_admin || false
      });

      // 与AdminPage保持一致的权限检查逻辑
      const adminStatus = user?.role === 'admin' || user?.role === 'super_admin' || user?.is_admin || false;
      setIsAdmin(adminStatus);
    };
    checkAdminStatus();
  }, [isAuthenticated]); // 当认证状态改变时重新检查管理员权限

  // 添加额外的检查：每隔一段时间重新检查管理员状态（降低频率）
  React.useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(async () => {
      try {
        // 直接使用当前用户状态进行检查，避免复杂的缓存逻辑
        const user = await AuthService.refreshCurrentUser();
        if (user) {
          const newAdminStatus = user?.role === 'admin' || user?.role === 'super_admin' || user?.is_admin || false;

          if (newAdminStatus !== isAdmin) {
            logger.debug('🔄 管理员状态已更新');
            setIsAdmin(newAdminStatus);
            setCurrentUser(user);
          }
        }
      } catch (error) {
        logger.warn('检查管理员状态失败:', error);
      }
    }, 60000); // 每60秒检查一次，降低频率

    return () => clearInterval(interval);
  }, [isAuthenticated, isAdmin]);

  const navigationItems = [
    {
      id: 'profile',
      icon: User,
      label: isAuthenticated ? '我' : '登录',
      tooltip: isAuthenticated ? '个人资料和设置' : '登录或注册',
      requiresAuth: false
    },
    {
      id: 'store',
      icon: ShoppingBag,
      label: '商店',
      tooltip: '购买道具和装饰品',
      requiresAuth: true
    },
    {
      id: 'leaderboard',
      icon: TrendingUp,
      label: '排行榜',
      tooltip: '查看个人和联盟排行榜',
      requiresAuth: false
    },
    {
      id: 'alliance',
      icon: Flag,
      label: '联盟',
      tooltip: '创建和管理联盟',
      requiresAuth: true
    },
    {
      id: 'map',
      icon: Map,
      label: '地图',
      tooltip: '返回地图界面',
      requiresAuth: false
    }
  ];

  // 如果是管理员，添加管理员导航项
  if (isAdmin) {
    logger.debug('✅ 检测到管理员权限，添加管理按钮到导航栏');
    navigationItems.push({
      id: 'admin',
      icon: Settings,
      label: '管理',
      tooltip: '管理后台',
      requiresAuth: true
    });
  } else {
    logger.debug('❌ 用户不是管理员，不显示管理按钮');
  }

  // 为游客模式过滤导航项
  const isGuest = AuthService.isGuest();
  const filteredNavigationItems = isGuest
    ? navigationItems.filter(item => !item.requiresAuth || item.id === 'profile')
    : navigationItems;

  // 调试信息：打印最终的导航项
  logger.debug('📱 底部导航栏项目:', {
    isAuthenticated,
    isGuest,
    isAdmin,
    totalItems: navigationItems.length,
    filteredItems: filteredNavigationItems.length,
    itemIds: filteredNavigationItems.map(item => item.id)
  });

  // 开发模式下添加手动刷新管理员状态的快捷键
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const handleKeyPress = async (e: KeyboardEvent) => {
        // Ctrl+Shift+A 快捷键手动刷新管理员状态
        if (e.ctrlKey && e.shiftKey && e.key === 'A') {
          logger.debug('🔄 手动刷新管理员状态...');
          const user = await AuthService.getCurrentUser();
          const adminStatus = user?.role === 'admin' || user?.role === 'super_admin' || user?.is_admin || false;
          setIsAdmin(adminStatus);
          setCurrentUser(user);
          logger.debug('✅ 管理员状态已刷新:', { user, adminStatus });
        }
      };

      window.addEventListener('keydown', handleKeyPress);
      return () => window.removeEventListener('keydown', handleKeyPress);
    }
  }, []);

  // 获取导航项的 badge 信息
  const getBadgeInfo = (itemId: string): { count: number; dot: boolean } => {
    if (!badges) return { count: 0, dot: false };
    switch (itemId) {
      case 'map':
        return { count: 0, dot: badges.map.hasActivity };
      case 'alliance':
        return { count: badges.alliance.count, dot: false };
      case 'leaderboard':
        return { count: 0, dot: badges.leaderboard.rankChanged };
      case 'profile':
        return { count: badges.profile.count, dot: false };
      default:
        return { count: 0, dot: false };
    }
  };

  const handleItemClick = (item: typeof navigationItems[0]) => {
    if (item.requiresAuth && !isAuthenticated) {
      if (item.id === 'profile') {
        onLoginClick();
      } else {
        // 显示需要登录的提示
        replaceAlert.warning('请先登录以使用此功能');
      }
      return;
    }

    if (item.id === 'profile' && !isAuthenticated) {
      onLoginClick();
    } else {
      onPageChange(item.id);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '16px',
        left: '0',
        right: '0',
        zIndex: 320, // 🔥 优化：使用标准z-index规范，底部导航栏
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '0 16px'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 16px',
          borderRadius: '12px',
          backgroundColor: 'transparent',
          border: 'none',
          boxShadow: 'none',
          maxWidth: '100%',
          flexWrap: 'wrap',
          justifyContent: 'center'
        }}
      >
        {filteredNavigationItems.map((item) => {
          const IconComponent = item.icon;
          const isSelected = currentPage === item.id;
          const badge = getBadgeInfo(item.id);

          return (
            <button
              key={item.id}
              onClick={() => handleItemClick(item)}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '48px',
                height: '48px',
                padding: '0',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: isSelected ? '#4f46e5' : 'white',
                color: isSelected ? 'white' : '#6b7280',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                opacity: item.requiresAuth && !isAuthenticated ? 0.5 : 1,
                boxShadow: isSelected ? '0 4px 12px rgba(79,70,229,0.3)' : '0 2px 8px rgba(0,0,0,0.08)',
                fontSize: '12px',
                fontWeight: 600
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
                }
              }}
              title={item.tooltip}
            >
              <IconComponent
                size={20}
                style={{
                  flexShrink: 0
                }}
              />
              {badge.count > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-2px',
                    right: '-2px',
                    minWidth: '18px',
                    height: '18px',
                    padding: '0 4px',
                    borderRadius: '9px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    fontSize: '10px',
                    fontWeight: 700,
                    lineHeight: '18px',
                    textAlign: 'center',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    pointerEvents: 'none',
                  }}
                >
                  {badge.count > 99 ? '99+' : badge.count}
                </span>
              )}
              {badge.dot && badge.count === 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '2px',
                    right: '2px',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#ef4444',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                    pointerEvents: 'none',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
