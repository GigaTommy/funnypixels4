import React, { useState, useEffect, useRef, useCallback } from 'react';
import MapCanvas from './components/map/MapCanvas';
// import AmapCanvas from './components/map/AmapCanvas'; // 暂时移除高德地图
import AuthPageEnhanced from './pages/AuthPageEnhanced';
import CleanAuthPage from './pages/CleanAuthPage';
import SocialPage from './pages/SocialPage';
import StorePage from './pages/StorePage';
import ProfilePage from './pages/ProfilePage';
import AlliancePage from './pages/AlliancePage';
import ChatPage from './pages/ChatPage';
import LeaderboardPage from './pages/LeaderboardPage';
import PaymentPage from './pages/PaymentPage';
import AdminPage from './pages/AdminPage';
import AchievementPage from './pages/AchievementPage';
// Test pages - files do not exist, commented out
// import PatternTestPage from './pages/PatternTestPage';
// import MapLibreTestPage from './pages/MapLibreTestPage';
// import OSMTestPage from './pages/OSMTestPage';
// import PointSDFTestPage from './pages/PointSDFTestPage';

import MapControls from './components/layout/MapControls';
import BottomNavigation from './components/layout/BottomNavigation';
import LoginButton from './components/auth/LoginButton';
import DrawingStatusPanel from './components/drawing/DrawingStatusPanel';
import { AuthService } from './services/auth';
import { AuthUser } from './services/auth';
import { tokenManager, TokenEventType } from './services/tokenManager';
import { patternCache } from './patterns/patternCache';
import MapMoveManager from './utils/mapMoveManager';
import { ToastContainer } from './components/ui/Toast';
import { toast } from './services/toast';

// 浏览器环境工具
import {
  safeGetWindow,
  safeGetWindowProperty,
  safeSetWindowProperty,
  isBrowser,
  safeAddEventListener
} from './utils/browserEnvironment';
import NetworkStatus from './components/NetworkStatus';
import NetworkErrorPage from './components/NetworkErrorPage';
import useNetworkDetection from './hooks/useNetworkDetection';
import { hotspotService } from './services/hotspotService';
import { getDeviceInfo, getMobileOptimizedConfig, isLowPerformanceDevice } from './utils/mobileOptimization';
import GlobalDialogs from './components/ui/GlobalDialogs';
import { logger } from './utils/logger';
import QuickStartOverlay from './components/onboarding/QuickStartOverlay';
import { t } from './i18n';
// 🆕 导入统一绘制管理系统
import { DrawingProvider, useDrawing } from './contexts/DrawingContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { unifiedSessionManager } from './services/unifiedSessionManager';
import { unifiedDrawService } from './services/unifiedDrawService';
import ShareModal from './components/ShareModal';
import { sessionHistoryService, type SessionHistoryItem } from './services/sessionHistoryService';
import PixelInfoCard from './components/map/PixelInfoCard';
import { PixelInfo } from './types/pixel';
// 🎨 导入像素数据管理 - 使用原始版
import { usePixels } from './hooks/usePixels';
// import './utils/debugAuth'; // 加载认证调试工具 - 已移除，避免在生产环境加载测试代码

// 🆕 导入 Point + SDF 架构的模拟数据生成器
import { initMockPixels } from './mockPixelGenerator';

type PageType = 'map' | 'social' | 'store' | 'profile' | 'alliance' | 'chat' | 'leaderboard' | 'payment' | 'admin' | 'achievements' | 'pattern-test' | 'maplibre-test' | 'osm-test' | 'point-sdf-test';

// 简单的防抖实现
function debounce<T extends (...args: any[]) => void>(
  func: T,
  delay: number,
  options?: { leading?: boolean; trailing?: boolean }
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastCallTime = 0;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    const shouldCallLeading = options?.leading && now - lastCallTime > delay;

    if (shouldCallLeading) {
      func(...args);
      lastCallTime = now;
      return;
    }

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (options?.trailing !== false) {
      timeoutId = setTimeout(() => {
        func(...args);
        lastCallTime = Date.now();
        timeoutId = null;
      }, delay);
    }
  };
}

// 🆕 内部应用组件，使用统一绘制系统
function AppContent() {
  // 🔌 使用统一绘制系统
  const drawing = useDrawing();
  const { state: drawingState, actions: drawingActions, getters: drawingGetters } = drawing;

  // 🎨 像素数据管理由 mapLibreTileLayerManager 统一处理
  // 移除 usePixels，避免与 mapLibreTileLayerManager 重复加载

  // 提供空实现，保持兼容性
  const pixels = {};
  const createPixel = async () => false;
  const loadPixelsInBounds = async () => {};

  // 🔌 网络检测
  const networkDetection = useNetworkDetection({
    autoRetry: true,
    retryInterval: 10000,
    maxRetries: 10,
    enableHealthCheck: true,
    healthCheckUrl: `${import.meta.env.VITE_API_BASE_URL}/api/health`
  });

  // 🔐 使用AuthContext获取认证状态
  const { currentUser: contextCurrentUser, isAuthenticated: contextIsAuthenticated, isGuest: contextIsGuest, setCurrentUser: contextSetCurrentUser, setIsAuthenticated: contextSetIsAuthenticated, setAuthState: contextSetAuthState } = useAuth();

  const [showNetworkErrorPage, setShowNetworkErrorPage] = useState(false);
  const [useCleanStyle, setUseCleanStyle] = useState(true); // 控制使用简洁风格的登录界面
  // 使用Context中的认证状态，移除本地状态
  const isAuthenticated = contextIsAuthenticated;
  const currentUser = contextCurrentUser;
  const setCurrentUser = contextSetCurrentUser;
  const setIsAuthenticated = contextSetIsAuthenticated;
    const [loadingError, setLoadingError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<any>(null);
  const [mobileConfig, setMobileConfig] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<PageType>('map');
  const [isLocating, setIsLocating] = useState(false);
  const [isRoaming, setIsRoaming] = useState(false);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const mapInstanceRef = useRef<any>(null); // 用于避免重复设置
  const [mapMoveManager, setMapMoveManager] = useState<MapMoveManager | null>(null);
  const [isLocatingDisabled, setIsLocatingDisabled] = useState(false);
  const [isRoamingDisabled, setIsRoamingDisabled] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(0); // 强制重新渲染
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [targetLocation, setTargetLocation] = useState<{ lat: number; lng: number } | null>(null); // 分享链接目标位置
  const [showQuickStart, setShowQuickStart] = useState(false);
  const [hasQuickStartPrompt, setHasQuickStartPrompt] = useState(false);

  // 🎨 分享弹窗状态
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedShareSession, setSelectedShareSession] = useState<SessionHistoryItem | null>(null);

  // 🎯 像素信息卡片状态
  const [selectedPixel, setSelectedPixel] = useState<PixelInfo | null>(null);
  const [showPixelCard, setShowPixelCard] = useState(false);
  const [pixelCardPosition, setPixelCardPosition] = useState({ x: 0, y: 0 });

  // 🔐 游客模式状态 - 声明在使用之前，避免 temporal dead zone 错误
  const isGuest = AuthService.isGuest();

  const QUICK_START_KEY = 'funnypixels_quick_start_v1';
  const QUICK_START_SNOOZE_KEY = 'funnypixels_quick_start_snooze';

  // 新手快速上手弹窗（仅登录用户）
  useEffect(() => {
    if (!isAuthenticated || isGuest || currentPage !== 'map') {
      setShowQuickStart(false);
      return;
    }

    const hasCompleted = localStorage.getItem(QUICK_START_KEY) === 'done';
    const hasSnoozed = sessionStorage.getItem(QUICK_START_SNOOZE_KEY) === '1';

    if (!hasCompleted && !hasSnoozed) {
      setShowQuickStart(true);
      setHasQuickStartPrompt(true);
    }
  }, [isAuthenticated, isGuest, currentPage]);

  const handleQuickStartClose = () => {
    setShowQuickStart(false);
    sessionStorage.setItem(QUICK_START_SNOOZE_KEY, '1');
  };

  const handleQuickStartComplete = () => {
    localStorage.setItem(QUICK_START_KEY, 'done');
    setShowQuickStart(false);
    setHasQuickStartPrompt(false);
  };

  const handleQuickStartAuto = () => {
    if (!drawingGetters.isGpsMode) {
      handleToggleAuto();
    }
  };


  // 🔌 网络状态监控 - 决定是否显示网络错误页面
  useEffect(() => {
    // 修复：当网络断开时立即显示错误页面，不需要等待重试
    const shouldShowErrorPage = !networkDetection.network.isOnline &&
                                !networkDetection.isRetrying;

    logger.info('网络状态检查:', {
      isOnline: networkDetection.network.isOnline,
      retryCount: networkDetection.retryCount,
      isRetrying: networkDetection.isRetrying,
      shouldShowErrorPage
    });

    setShowNetworkErrorPage(shouldShowErrorPage);
  }, [networkDetection.network.isOnline, networkDetection.retryCount, networkDetection.isRetrying]);

  // 🚀 应用已就绪，直接跳过资源加载检查
  useEffect(() => {
    logger.info('✅ 应用已就绪，跳过资源加载检查');
  }, []);

  // 🆕 初始化模拟像素数据（仅开发模式）
  useEffect(() => {
    // Check if in development mode and MVT tiles not configured
    const isDev = import.meta.env.DEV;
    const hasMvtUrl = import.meta.env.VITE_MVT_TILE_URL;

    if (isDev && !hasMvtUrl) {
      logger.info('🎨 开发模式：初始化模拟像素数据...');

      // Generate mock pixels for Hangzhou (default location in this app)
      // This populates window.__MOCK_PIXELS__ for debugging
      try {
        initMockPixels('hangzhou', 5000);
        logger.info('✅ 模拟像素数据已生成，可通过 window.__MOCK_PIXELS__ 访问');
      } catch (error) {
        logger.error('❌ 模拟像素数据生成失败:', error);
      }
    } else if (hasMvtUrl) {
      logger.info('📡 生产模式：使用 MVT 瓦片服务');
    }
  }, []);

  // 设备检测和移动端优化配置
  useEffect(() => {
    const info = getDeviceInfo();
    const config = getMobileOptimizedConfig(info);
    
    setDeviceInfo(info);
    setMobileConfig(config);
    setIsMobile(info.isMobile);
    
    logger.info('设备检测结果:', {
      isMobile: info.isMobile,
      isTablet: info.isTablet,
      isDesktop: info.isDesktop,
      connectionType: info.connectionType,
      screenSize: `${info.screenWidth}x${info.screenHeight}`,
      isLowPerformance: isLowPerformanceDevice(info),
      config: config
    });
  }, []);

  // 检查认证状态
  useEffect(() => {
    const checkAuth = async () => {
      try {
        setLoadingError(null);

        // 🚀 优化：大幅减少超时时间，提升首屏加载速度
        const timeoutDuration = mobileConfig?.requestTimeout || (isMobile ? 3000 : 2000);
        logger.info(`⚡ 优化后超时时间: ${timeoutDuration}ms (${isMobile ? '移动端' : '桌面端'})`, {
          deviceInfo,
          mobileConfig
        });
        
        // 设置超时机制，避免无限等待
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('认证检查超时')), timeoutDuration);
        });
        
        const authPromise = (async () => {
          // 应用启动时检查并清理无效缓存
          const token = AuthService.getToken();
          if (!token) {
            logger.info('未找到有效token，清理可能存在的无效缓存');
            AuthService.clearTokens();
          }
          
          // 首先检查本地是否有有效的token
          if (AuthService.isAuthenticated()) {
            logger.info('检测到本地token，验证用户身份...');
            const user = await AuthService.getCurrentUser();
            if (user) {
              logger.info('用户身份验证成功:', user.username);
              logger.info('🔍 用户对象调试:', JSON.stringify(user, null, 2));
              logger.info('🔍 用户ID调试:', user.id);

              setCurrentUser(user);
              setIsAuthenticated(true);

              // 🆕 初始化统一绘制系统
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
              logger.info('用户身份验证失败，清除认证状态');
              // 如果获取用户信息失败，清除认证状态
              await AuthService.logout();
              setIsAuthenticated(false);
              setCurrentUser(null);
            }
          } else {
            logger.info('用户未认证，检查是否为游客模式');
            // 检查是否为游客模式
            if (AuthService.isGuest()) {
              logger.info('游客模式已启用');
              setIsAuthenticated(false);
              setCurrentUser(null);
            } else {
              logger.info('用户未认证且不是游客，生成游客ID');
              // 确保游客ID存在
              AuthService.ensureGuestId();
              setIsAuthenticated(false);
              setCurrentUser(null);
            }
          }
        })();
        
        // 🚀 优化：使用Promise.race实现超时控制，超时后允许继续
        await Promise.race([authPromise, timeoutPromise]).catch((error) => {
          if (error instanceof Error && error.message.includes('超时')) {
            logger.warn('⚡ 认证检查超时，以游客模式继续加载，认证将在后台完成');
            // 超时不抛出错误，允许继续
          } else {
            throw error; // 其他错误继续抛出
          }
        });

      } catch (error) {
        logger.error('认证检查失败:', error);

        // 🚀 优化：认证失败不显示错误页面，直接以游客模式继续
        if (error instanceof Error) {
          if (error.message.includes('超时')) {
            logger.info('⚡ 认证超时，以游客模式继续，用户体验优先');
          } else if (error.message.includes('Network Error')) {
            logger.info('⚡ 网络错误，以游客模式继续，用户体验优先');
          } else {
            logger.info('⚡ 认证错误，以游客模式继续:', error.message);
          }
        }

        // 移动端特殊处理
        if (isMobile) {
          logger.info('📱 移动端错误处理: 以游客模式继续', {
            error: error instanceof Error ? error.message : String(error),
            retryCount
          });
        }

        // 🚀 优化：不设置错误信息，直接以游客模式继续
        // setLoadingError(errorMessage); // 移除错误提示

        // 认证失败时清除状态，但不阻止应用启动
        try {
          await AuthService.logout();
        } catch (logoutError) {
          logger.warn('清除认证状态失败:', logoutError);
        }
        setIsAuthenticated(false);
        setCurrentUser(null);

        // 确保游客ID存在，让用户至少可以以游客身份使用
        try {
          AuthService.ensureGuestId();
        } catch (guestError) {
          logger.warn('生成游客ID失败:', guestError);
        }
      } finally {
        // 🚀 优化：移除 setIsLoading(false)，不再使用 isLoading 状态
        // setIsLoading(false);
      }
    };

    checkAuth();
  }, [retryCount, isMobile, mobileConfig]);

  // 监听令牌状态事件
  useEffect(() => {
    const handleTokenEvent = (event: TokenEventType, data?: any) => {
      logger.info('收到令牌事件:', event, data);
      
      switch (event) {
        case 'token_refreshed':
          logger.info('✅ 令牌已自动续期');
          // 令牌续期成功，无需额外操作
          break;
          
        case 'token_expired':
          logger.info('❌ 令牌已过期');
          // 令牌过期，清除认证状态
          setIsAuthenticated(false);
          setCurrentUser(null);
          break;
          
        case 'login_required':
          logger.info('🔐 需要重新登录');
          // 需要重新登录，清除认证状态并跳转到登录页
          setIsAuthenticated(false);
          setCurrentUser(null);
          setCurrentPage('map'); // 回到地图页面，显示登录按钮
          break;
      }
    };

    // 添加令牌事件监听器
    tokenManager.addEventListener(handleTokenEvent);

    return () => {
      // 清理监听器
      tokenManager.removeEventListener(handleTokenEvent);
    };
  }, []);

  // 监听URL变化，处理支付页面跳转
  useEffect(() => {
    const handleUrlChange = () => {
      if (!isBrowser) return;

      const pathname = safeGetWindowProperty('location.pathname') || '/';
      const search = safeGetWindowProperty('location.search') || '';

      // 检测是否为像素分享链接 /pixel/:lat/:lng
      const pixelMatch = pathname.match(/^\/pixel\/(-?\d+\.?\d*)\/(-?\d+\.?\d*)$/);
      if (pixelMatch) {
        const lat = parseFloat(pixelMatch[1]);
        const lng = parseFloat(pixelMatch[2]);

        // 验证坐标有效性（防止恶意输入）
        if (!isNaN(lat) && !isNaN(lng) &&
            lat >= -90 && lat <= 90 &&
            lng >= -180 && lng <= 180) {
          logger.info('🔗 检测到像素分享链接，跳转到地图页面:', { lat, lng });
          setTargetLocation({ lat, lng });
          setCurrentPage('map');
          return;
        } else {
          logger.warn('⚠️ 无效的像素坐标:', { lat, lng });
        }
      }

      // 检测是否为RLE测试页面
      if (pathname === '/pattern-test') {
        logger.info('🧪 检测到RLE测试页面URL，切换到测试页面');
        setCurrentPage('pattern-test');
        return;
      }

      // 检测是否为Point SDF测试页面
      if (pathname === '/point-sdf-test') {
        logger.info('🎨 检测到Point SDF测试页面URL，切换到测试页面');
        setCurrentPage('point-sdf-test');
        return;
      }

      // 检测是否为支付页面
      if (pathname === '/payment' && search.includes('data=')) {
        logger.info('💰 检测到支付页面URL，切换到支付页面');
        setCurrentPage('payment');
        return;
      }

      // 检测是否为商店页面且包含支付成功参数
      if (pathname === '/store' && search.includes('payment=success')) {
        logger.info('✅ 检测到支付成功参数，切换到商店页面');
        setCurrentPage('store');
        return;
      }

      // 其他URL变化，保持当前页面状态
      logger.info('📄 URL变化，保持当前页面状态');
    };

    // 初始检查URL
    handleUrlChange();

    // 监听popstate事件（浏览器前进后退）
    if (isBrowser) {
      window.addEventListener('popstate', handleUrlChange);
      // 监听hashchange事件（如果使用hash路由）
      window.addEventListener('hashchange', handleUrlChange);

      return () => {
        window.removeEventListener('popstate', handleUrlChange);
        window.removeEventListener('hashchange', handleUrlChange);
      };
    }
    return () => {};
  }, []);

  // 监听会话过期事件
  useEffect(() => {
    const handleSessionExpired = (event: CustomEvent) => {
      logger.info('收到会话过期事件:', event.detail.message);
      setIsAuthenticated(false);
      setCurrentUser(null);
    };

    window.addEventListener('auth:session-expired', handleSessionExpired as EventListener);

    return () => {
      window.removeEventListener('auth:session-expired', handleSessionExpired as EventListener);
    };
  }, []);

  // 🔥 监听MapLibre地图就绪事件
  useEffect(() => {
    const handleMapReadyEvent = (event: CustomEvent) => {
      const { map } = event.detail;
      logger.info('📍 收到MapLibre地图就绪事件');
      handleMapReady(map);
    };

    window.addEventListener('mapReady', handleMapReadyEvent as EventListener);

    return () => {
      window.removeEventListener('mapReady', handleMapReadyEvent as EventListener);
    };
  }, []);

  // 🎨 基于瓦片的渲染系统会自动处理像素数据加载
  // 无需手动监听 pixels 状态变化
  // 瓦片系统会根据地图移动/缩放自动加载和卸载像素数据

  // 监听页面跳转事件（从ProfilePage触发）
  useEffect(() => {
    const handlePageChange = (event: CustomEvent) => {
      const { page } = event.detail;
      logger.info('收到页面跳转事件:', page);
      if (page && typeof page === 'string') {
        setCurrentPage(page as PageType);
      }
    };

    window.addEventListener('pageChange', handlePageChange as EventListener);

    return () => {
      window.removeEventListener('pageChange', handlePageChange as EventListener);
    };
  }, []);

  // 🎨 监听绘制会话结束事件，自动弹出分享界面
  useEffect(() => {
    const handleSessionEnd = async (event: CustomEvent) => {
      const { sessionId } = event.detail || {};
      if (!sessionId) {
        logger.warn('⚠️ 会话结束事件缺少 sessionId');
        return;
      }

      logger.info('🎉 收到会话结束事件，准备显示分享界面:', sessionId);

      try {
        // 等待一小段时间，让后端完成统计数据计算
        await new Promise(resolve => setTimeout(resolve, 800));

        // 从后端获取完整的会话数据
        const response = await sessionHistoryService.getSessionDetails(sessionId);

        logger.info('🔍 获取到的会话响应:', response);

        if (response.success && response.data) {
          logger.info('✅ 获取会话详情成功');
          logger.info('📊 会话基本信息:', {
            id: response.data.id,
            session_name: response.data.session_name,
            drawing_type: response.data.drawing_type,
            status: response.data.status
          });
          logger.info('📊 会话统计数据:', response.data.metadata?.statistics);

          // 检查统计数据是否存在且完整
          const hasValidStats = response.data.metadata?.statistics &&
                                response.data.metadata.statistics.pixelCount > 0;

          if (!hasValidStats) {
            logger.warn('⚠️ 会话统计数据不完整，尝试单独获取统计信息...');

            // 尝试获取单独的统计数据
            const statsResponse = await sessionHistoryService.getSessionStatistics(sessionId);
            logger.info('📊 单独获取的统计数据:', statsResponse);

            if (statsResponse.success && statsResponse.data) {
              // 合并统计数据到会话数据中
              if (!response.data.metadata) {
                response.data.metadata = {};
              }
              response.data.metadata.statistics = {
                pixelCount: statsResponse.data.pixelCount || 0,
                distance: statsResponse.data.distance || 0,
                duration: statsResponse.data.duration || 0,
                avgSpeed: statsResponse.data.avgSpeed,
                efficiency: statsResponse.data.efficiency,
                boundaries: statsResponse.data.boundaries
              };
              logger.info('✅ 统计数据已合并:', response.data.metadata.statistics);
            }
          }

          setSelectedShareSession(response.data);
          setShowShareModal(true);
        } else {
          logger.error('❌ 获取会话详情失败:', response.error);
          toast.error('无法加载会话详情');
        }
      } catch (error) {
        logger.error('❌ 获取会话详情时出错:', error);
        toast.error('加载会话详情失败');
      }
    };

    window.addEventListener('session:ended', handleSessionEnd as EventListener);

    return () => {
      window.removeEventListener('session:ended', handleSessionEnd as EventListener);
    };
  }, []);

  // GPS状态通过props自动传递给AmapCanvas组件，无需额外的状态同步逻辑

  const handleAuthSuccess = () => {
    logger.info('🎉 登录成功，重新检查认证状态');
    // 重新检查认证状态
    const checkAuthAfterLogin = async () => {
      try {
        if (AuthService.isAuthenticated()) {
          logger.info('✅ 登录后认证检查成功');
          const user = await AuthService.getCurrentUser();
          if (user) {
            logger.info('✅ 用户信息获取成功:', user.username);
            logger.info('🔍 登录后用户对象调试:', JSON.stringify(user, null, 2));
            logger.info('🔍 登录后用户ID调试:', user.id);

            setCurrentUser(user);
            setIsAuthenticated(true);

            // 🆕 登录成功后初始化统一绘制系统
            try {
              if (!user.id) {
                logger.error('❌ 登录后用户ID为空，无法初始化统一绘制系统');
              } else {
                unifiedSessionManager.setUserId(user.id);
                unifiedDrawService.initialize(user.id);
                logger.info('✅ 登录后统一绘制系统已初始化，用户ID:', user.id);
              }
            } catch (error) {
              logger.warn('登录后统一绘制系统初始化失败:', error);
            }
          } else {
            logger.info('❌ 登录后获取用户信息失败');
            setIsAuthenticated(false);
            setCurrentUser(null);
          }
        } else {
          logger.info('❌ 登录后认证检查失败');
          setIsAuthenticated(false);
          setCurrentUser(null);
        }
      } catch (error) {
        logger.error('❌ 登录后认证检查异常:', error);
        setIsAuthenticated(false);
        setCurrentUser(null);
      }
    };

    checkAuthAfterLogin();
  };

  // 地图准备就绪处理
  const handleMapReady = (map: any) => {

    // 验证地图对象的有效性
    if (map && typeof map.getCenter === 'function' && typeof map.getZoom === 'function') {
      // 避免重复设置
      if (!mapInstanceRef.current) {
        mapInstanceRef.current = map;
        setMapInstance(map);
      }

      // 创建地图移动管理器
      try {
        const moveManager = new MapMoveManager(map);
        setMapMoveManager(moveManager);
        logger.info('✅ 地图移动管理器已创建');
      } catch (error) {
        logger.error('❌ 地图移动管理器创建失败:', error);
      }

      // 🎨 初始化像素数据加载
      try {
        // 获取地图中心点和视野范围
        const center = map.getCenter();
        const zoom = map.getZoom();

        // 计算当前视野的边界 (大约的边界，用于初始加载)
        const latOffset = 0.05; // 约5km范围
        const lngOffset = 0.05;

        const minLat = center.lat - latOffset;
        const maxLat = center.lat + latOffset;
        const minLng = center.lng - lngOffset;
        const maxLng = center.lng + lngOffset;

        logger.info('🎯 使用基于瓦片的渲染系统，像素数据将自动加载');
        // 🎯 基于瓦片的渲染系统会自动监听地图移动/缩放
        // 自动计算可见瓦片并加载对应的像素数据
        // 不需要手动调用 loadPixelsInBounds

      } catch (error) {
        logger.error('❌ 像素数据初始化失败:', error);
      }

      logger.info('✅ 地图实例已设置，状态更新完成');
    } else {
      logger.error('❌ 地图对象无效，无法设置地图实例');
      logger.error('❌ 地图对象:', map);
    }
  };

  // GPS状态变化处理 - 现在使用统一绘制系统，这个函数已不需要
  // const handleGpsToggle = (enabled: boolean) => {
  //   setIsAutoMode(enabled);
  // };


  // 🆕 新增：初始定位处理函数
  const handleInitialLocation = async () => {
    logger.info('🌍 开始初始定位...');
    
    // 检查是否已经进行过初始定位
    const hasInitialized = sessionStorage.getItem('map_initialized');
    if (hasInitialized) {
      logger.info('📍 地图已初始化过，跳过自动定位');
      logger.info('📍 当前显示位置:', currentLocation);
      return;
    }
    
    // 🆕 新增：等待地图实例准备就绪
    let retryCount = 0;
    const maxRetries = 10;
    while (!mapInstance && retryCount < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 200));
      retryCount++;
    }
    
    if (!mapInstance) {
      logger.error('❌ 地图实例超时未准备就绪，跳过初始定位');
      return;
    }


    // NOTE: Enhanced location service (locationTest) is not available
    // Using default location instead
    try {
      logger.info('📍 使用默认位置进行初始化');
      moveToDefaultLocation();
    } catch (error) {
      logger.error('❌ 初始定位异常:', error);
      moveToDefaultLocation();
    }
  };

  // 🆕 新增：移动到默认位置（杭州西湖）
  const moveToDefaultLocation = async () => {
    logger.info('🏞️ 移动到默认位置：杭州西湖');
    
    // 检查地图移动管理器，如果没有则尝试直接使用地图API
    if (!mapMoveManager) {
      logger.warn('⚠️ 地图移动管理器未初始化，尝试直接使用地图API');
      
      // 直接使用地图API移动
      if (mapInstance && typeof mapInstance.setCenter === 'function') {
        try {
          const defaultLat = 30.2741;
          const defaultLng = 120.1551;
          
          // 更新当前位置状态
          setCurrentLocation({ lat: defaultLat, lng: defaultLng });
          
          // 直接设置地图中心点和缩放级别
          mapInstance.setCenter([defaultLng, defaultLat]);
          mapInstance.setZoom(15);
          
          logger.info(`🎯 直接设置默认地图位置: (${defaultLat}, ${defaultLng})`);
          logger.info(`✅ 已移动到默认位置：杭州西湖 (${defaultLat}, ${defaultLng})`);
          
          // 标记已初始化
          sessionStorage.setItem('map_initialized', 'true');
          return;
        } catch (directMapError) {
          logger.error('❌ 直接地图API移动失败:', directMapError);
          return;
        }
      } else {
        logger.error('❌ 地图实例无效，无法移动到默认位置');
        return;
      }
    }
    
    try {
      const defaultLat = 30.2741;
      const defaultLng = 120.1551;
      
      // 更新当前位置状态
      setCurrentLocation({ lat: defaultLat, lng: defaultLng });
      
      // 立即设置地图中心点，避免显示空白地图
      if (mapInstance && typeof mapInstance.setCenter === 'function') {
        mapInstance.setCenter([defaultLng, defaultLat]);
        logger.info(`🎯 立即设置默认地图中心点: (${defaultLat}, ${defaultLng})`);
      }
      
      await mapMoveManager.moveTo(defaultLng, defaultLat, {
        zoom: 15,
        animate: true,
        duration: 1500,
        callback: () => {
          logger.info(`✅ 已移动到默认位置：杭州西湖 (${defaultLat}, ${defaultLng})`);
          // 标记已初始化
          sessionStorage.setItem('map_initialized', 'true');
        }
      });
    } catch (error) {
      logger.error('❌ 移动到默认位置失败:', error);
    }
  };


  // 🆕 新增：监听地图实例状态变化，自动触发定位（优化版）
  useEffect(() => {
    if (mapInstance && !sessionStorage.getItem('map_initialized')) {
      // 直接执行定位
      const timer = setTimeout(() => {
        handleInitialLocation();
      }, 1000); // 延迟到1秒，避免和地图初始化冲突

      return () => clearTimeout(timer);
    }
  }, [mapInstance]);

  // 🔧 新增：统一的错误提示函数（使用useCallback避免依赖问题）
  const showErrorToast = useCallback((message: string, type: 'error' | 'warning' | 'info' = 'error') => {
    logger.warn(`[${type.toUpperCase()}] ${message}`);

    // 使用用户友好的Toast系统
    toast.showUserFriendlyMessage(type, message);
  }, []);

  // 🎯 处理像素点击事件（带防抖和错误处理）
  const handlePixelClickInternal = useCallback(async (pixelData: any, position: { x: number; y: number }) => {
    try {
      logger.info('🎯 处理像素点击:', {
        grid_id: pixelData.properties?.grid_id || pixelData.properties?.id,
        position,
        isAuthenticated,
        isGuest
      });

      // 🔐 验证用户权限 - 仅限登录用户（非游客）
      if (!isAuthenticated || isGuest) {
        logger.warn('🚫 未登录用户或游客尝试查看像素信息，已阻止', {
          isAuthenticated,
          isGuest,
          grid_id: pixelData.properties?.grid_id || pixelData.properties?.id
        });
        // 显示提示信息
        showErrorToast('请先登录后查看像素信息', 'warning');
        return;
      }

      // 🔥 新增：验证currentUser已就绪（避免Context异步延迟导致卡片显示异常）
      if (!contextCurrentUser) {
        logger.warn('🚫 currentUser尚未就绪，等待Context更新...', {
          isAuthenticated,
          isGuest,
          hasContextCurrentUser: !!contextCurrentUser
        });
        showErrorToast('正在加载用户信息，请稍候...', 'warning');
        return;
      }

      // 验证必要的数据
      if (!pixelData || !pixelData.geometry || !pixelData.geometry.coordinates) {
        logger.error('❌ 无效的像素数据:', pixelData);
        return;
      }

      // 🔥 检查接收到的数据
      logger.info('📥 [RECEIVE] handlePixelClickInternal 接收到的数据:', {
        hasProperties: !!pixelData.properties,
        user_id: pixelData.properties?.user_id,
        username: pixelData.properties?.username,
        alliance_name: pixelData.properties?.alliance_name,
        grid_id: pixelData.properties?.grid_id,
        id: pixelData.properties?.id,
        allKeys: Object.keys(pixelData.properties || {}),
        allProperties: pixelData.properties
      });

      // 转换MapLibre Feature为PixelInfo格式
      const pixelInfo: PixelInfo = {
        grid_id: pixelData.properties?.grid_id || pixelData.properties?.id || 'unknown',
        lat: Number(pixelData.geometry.coordinates[1]) || 0,
        lng: Number(pixelData.geometry.coordinates[0]) || 0,
        color: pixelData.properties?.color || '#4ECDC4',  // fallback 为默认绿色
        user_id: pixelData.properties?.user_id || 'guest',
        username: pixelData.properties?.username || '游客',
        avatar: pixelData.properties?.avatar || undefined,
        avatar_url: pixelData.properties?.avatar_url || undefined,
        alliance_id: pixelData.properties?.alliance_id || undefined,
        alliance_name: pixelData.properties?.alliance_name || undefined,
        alliance_flag: pixelData.properties?.alliance_flag || undefined,
        country: pixelData.properties?.country || 'cn',
        city: pixelData.properties?.city || undefined,
        province: pixelData.properties?.province || undefined,
        likes_count: Number(pixelData.properties?.likes_count) || 0,
        is_liked: Boolean(pixelData.properties?.is_liked) || false,
        created_at: pixelData.properties?.createdAt || pixelData.properties?.created_at || new Date().toISOString(),
        updated_at: pixelData.properties?.updatedAt || pixelData.properties?.updated_at || new Date().toISOString(),
        // 添加PixelInfo接口要求的其他字段
        display_name: pixelData.properties?.display_name || undefined,
        pattern_id: pixelData.properties?.pattern_id || undefined,
        pattern_anchor_x: pixelData.properties?.pattern_anchor_x || undefined,
        pattern_anchor_y: pixelData.properties?.pattern_anchor_y || undefined,
        pattern_rotation: pixelData.properties?.pattern_rotation || undefined,
        pattern_mirror: pixelData.properties?.pattern_mirror || undefined,
        timestamp: pixelData.properties?.timestamp || Date.now()
      };

      // 🔥 检查转换后的 pixelInfo 数据
      logger.info('📝 [CONVERT] pixelInfo 对象创建完成:', {
        grid_id: pixelInfo.grid_id,
        user_id: pixelInfo.user_id,
        username: pixelInfo.username,
        alliance_name: pixelInfo.alliance_name,
        city: pixelInfo.city,
        color: pixelInfo.color
      });

      // 验证坐标有效性
      if (isNaN(pixelInfo.lat) || isNaN(pixelInfo.lng) ||
          pixelInfo.lat < -90 || pixelInfo.lat > 90 ||
          pixelInfo.lng < -180 || pixelInfo.lng > 180) {
        logger.error('❌ 无效的坐标:', { lat: pixelInfo.lat, lng: pixelInfo.lng });
        return;
      }

      // 🔥 方案C-1: MVT tiles already contain complete user data
      // Hidden circle layers in MapCanvas force MapLibre GL to load all properties
      // No API call needed - use data directly from MVT

      logger.info('🔄 准备显示像素卡片:', {
        grid_id: pixelInfo.grid_id,
        username: pixelInfo.username,
        lat: pixelInfo.lat,
        lng: pixelInfo.lng,
        city: pixelInfo.city,
        alliance: pixelInfo.alliance_name,
        position
      });

      // 🔥 最终验证：确保关键数据字段有效（放宽验证条件）
      // 只验证核心字段：坐标有效、有ID、有颜色
      const isValidPixelData =
        !isNaN(pixelInfo.lat) && !isNaN(pixelInfo.lng) &&
        pixelInfo.lat >= -90 && pixelInfo.lat <= 90 &&
        pixelInfo.lng >= -180 && pixelInfo.lng <= 180 &&
        pixelInfo.grid_id && pixelInfo.color;

      if (!isValidPixelData) {
        logger.warn('⚠️ 像素数据不完整，无法显示卡片:', {
          grid_id: pixelInfo.grid_id,
          username: pixelInfo.username,
          lat: pixelInfo.lat,
          lng: pixelInfo.lng,
          color: pixelInfo.color
        });
        showErrorToast('像素数据不完整，请稍后重试');
        return;
      }

      // 🔥 使用startTransition确保状态更新不会阻塞UI
      setSelectedPixel(pixelInfo);
      setPixelCardPosition(position);
      setShowPixelCard(true);

      logger.info('✅ 像素卡片状态已设置:', {
        selectedPixel: pixelInfo,
        position,
        showPixelCard: true
      });
    } catch (error) {
      logger.error('❌ 处理像素点击时出错:', error);
      showErrorToast('无法显示像素信息，请稍后重试');
    }
  }, [isAuthenticated, isGuest, showErrorToast]);

  // 防抖版本的像素点击处理
  const debouncedPixelClick = useRef(
    debounce(handlePixelClickInternal, 200, { leading: false, trailing: true })
  );

  // 当认证状态改变时，更新防抖函数
  useEffect(() => {
    debouncedPixelClick.current = debounce(handlePixelClickInternal, 200, { leading: false, trailing: true });
  }, [handlePixelClickInternal]);

  // 暴露给MapCanvas的回调函数
  const handlePixelClick = useCallback((pixelData: any, position: { x: number; y: number }) => {
    debouncedPixelClick.current(pixelData, position);
  }, []);

  // 关闭像素信息卡片
  const handlePixelCardClose = () => {
    setShowPixelCard(false);
    setSelectedPixel(null);
  };

  const handleLogout = async () => {
    try {
      await AuthService.logout();
      setIsAuthenticated(false);
      setCurrentUser(null);
    } catch (error) {
      logger.error('登出失败:', error);
    }
  };

  // 🔧 新增：防重复提示的状态
  const lastToastRef = useRef<{ message: string; timestamp: number } | null>(null);
  const TOAST_COOLDOWN = 3000; // 3秒冷却时间

  // 🔧 新增：统一的成功提示函数（防重复）
  const showSuccessToast = (message: string) => {
    const now = Date.now();

    // 检查是否在冷却时间内显示相同消息
    if (lastToastRef.current &&
        lastToastRef.current.message === message &&
        now - lastToastRef.current.timestamp < TOAST_COOLDOWN) {
      logger.info(`[SUCCESS] 跳过重复提示: ${message}`);
      return;
    }
    
    // 记录提示信息
    lastToastRef.current = { message, timestamp: now };
    
    logger.info(`[SUCCESS] ${message}`);
    
    // 使用用户友好的Toast系统
    toast.showUserFriendlyMessage('success', message);
  };

  // 🔧 新增：统一的地图状态检查函数
  const checkMapStatus = (operation: string): boolean => {
    if (!mapInstance) {
      const message = `地图实例未准备就绪，请稍后再试`;
      logger.warn(`❌ ${operation}失败: ${message}`);
      showErrorToast(message, 'warning');
      return false;
    }
    
    try {
      // 检查地图方法是否可用
      if (typeof mapInstance.getCenter !== 'function' || typeof mapInstance.getZoom !== 'function') {
        const message = `地图功能不可用，请刷新页面重试`;
        logger.warn(`❌ ${operation}失败: ${message}`);
        showErrorToast(message, 'error');
        return false;
      }
      
      const center = mapInstance.getCenter();
      const zoom = mapInstance.getZoom();
      
      // 检查中心点是否有效
      if (!center || typeof center.lat !== 'number' || typeof center.lng !== 'number' || 
          isNaN(center.lat) || isNaN(center.lng) || 
          center.lat < -90 || center.lat > 90 || 
          center.lng < -180 || center.lng > 180) {
        const message = `地图状态异常，请稍后再试`;
        logger.warn(`❌ ${operation}失败: ${message}`, center);
        showErrorToast(message, 'warning');
        return false;
      }
      
      // 检查缩放级别是否有效
      if (typeof zoom !== 'number' || isNaN(zoom) || zoom < 8 || zoom > 20) {
        const message = `地图缩放级别异常，请稍后再试`;
        logger.warn(`❌ ${operation}失败: ${message}`, zoom);
        showErrorToast(message, 'warning');
        return false;
      }
      
      logger.info(`✅ ${operation}地图状态检查通过: 中心点(${center.lat}, ${center.lng}), 缩放级别(${zoom})`);
      return true;
    } catch (error) {
      const message = `地图状态检查失败，请刷新页面重试`;
      logger.warn(`❌ ${operation}失败: ${message}`, error);
      showErrorToast(message, 'error');
      return false;
    }
  };

  // 🚀 优化版地图控制功能 - 使用预加载的定位服务
  const handleLocate = async () => {
    // 🚀 优化1：快速状态检查
    if (isLocating || isLocatingDisabled) {
      logger.info('定位功能正在执行中，请稍候...');
      return;
    }

    if (!checkMapStatus('定位')) {
      return;
    }

    setIsLocating(true);
    setIsLocatingDisabled(true);

    try {
      // NOTE: Enhanced location service (locationTest) is not available
      // Using native browser geolocation API instead
      if (!navigator.geolocation) {
        showErrorToast('您的浏览器不支持定位功能', 'error');
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          logger.info(`📍 定位成功: (${latitude}, ${longitude})`);

          if (!isValidCoordinate(latitude, longitude)) {
            logger.error('❌ 定位坐标无效:', { lat: latitude, lng: longitude });
            showErrorToast('定位坐标无效，请重试', 'error');
            setIsLocating(false);
            setIsLocatingDisabled(false);
            return;
          }

          if (!mapMoveManager || !mapInstance) {
            logger.error('❌ 地图组件未准备就绪');
            showErrorToast('地图未准备就绪，请稍后重试', 'error');
            setIsLocating(false);
            setIsLocatingDisabled(false);
            return;
          }

          // Use map move manager to navigate to user location
          mapMoveManager.moveTo(longitude, latitude, {
            zoom: 16,
            animate: true,
            duration: 800,
            callback: () => {
              logger.info(`✅ 定位移动完成: (${latitude}, ${longitude})`);
              showSuccessToast('定位成功！');
            }
          });

          setCurrentLocation({ lat: latitude, lng: longitude });
          setIsLocating(false);
          setIsLocatingDisabled(false);
        },
        (error) => {
          logger.error('❌ 定位失败:', error);
          const errorMessage = error.code === 1
            ? '请允许定位权限'
            : error.code === 2
            ? '定位服务不可用'
            : error.code === 3
            ? '定位超时，请重试'
            : '定位失败，请稍后重试';
          showErrorToast(errorMessage, 'error');
          setIsLocating(false);
          setIsLocatingDisabled(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    } catch (error) {
      logger.error('❌ 定位功能异常:', error);
      showErrorToast('定位失败，请稍后重试', 'error');
      setIsLocating(false);
      setIsLocatingDisabled(false);
    }
  };

  // 🚀 优化：坐标验证函数（内联优化）
  const isValidCoordinate = (lat: any, lng: any): boolean => {
    return typeof lat === 'number' && typeof lng === 'number' &&
           !isNaN(lat) && !isNaN(lng) &&
           lat >= -90 && lat <= 90 &&
           lng >= -180 && lng <= 180;
  };

  const handleZoomIn = () => {
    if (!mapInstance) {
      logger.warn('地图实例未准备就绪');
      return;
    }

    try {
      const currentZoom = mapInstance.getZoom();
      const newZoom = Math.min(currentZoom + 1, 22); // MapLibre GL最大缩放级别22

      // 🔥 MapLibre GL适配：使用easeTo实现平滑缩放
      if (typeof mapInstance.easeTo === 'function') {
        mapInstance.easeTo({
          zoom: newZoom,
          duration: 300
        });
      } else {
        // 降级方案：直接设置缩放
        mapInstance.setZoom(newZoom);
      }
      logger.info(`地图放大: ${currentZoom.toFixed(2)} -> ${newZoom}`);
    } catch (error) {
      logger.error('地图放大失败:', error);
    }
  };

  const handleZoomOut = () => {
    if (!mapInstance) {
      logger.warn('地图实例未准备就绪');
      return;
    }

    try {
      const currentZoom = mapInstance.getZoom();
      const newZoom = Math.max(currentZoom - 1, 0); // MapLibre GL最小缩放级别0

      // 🔥 MapLibre GL适配：使用easeTo实现平滑缩放
      if (typeof mapInstance.easeTo === 'function') {
        mapInstance.easeTo({
          zoom: newZoom,
          duration: 300
        });
      } else {
        // 降级方案：直接设置缩放
        mapInstance.setZoom(newZoom);
      }
      logger.info(`地图缩小: ${currentZoom.toFixed(2)} -> ${newZoom}`);
    } catch (error) {
      logger.error('地图缩小失败:', error);
    }
  };

  // 🚀 优化版漫游到热度最高的区域
  const handleRoam = async () => {
    if (!checkMapStatus('漫游')) {
      return;
    }

    // 防抖：避免重复点击
    if (isRoaming || isRoamingDisabled) {
      logger.info('漫游功能正在执行中，请稍候...');
      return;
    }

    setIsRoaming(true);
    setIsRoamingDisabled(true);

    try {
      // 🚀 优化1：使用缓存的热点数据
      const hotSpots = await hotspotService.getAllHotspots('monthly', 10);
      logger.info(`🎯 漫游热点总数: ${hotSpots.length}`);

      // 随机选择一个热点区域
      const randomSpot = hotSpots[Math.floor(Math.random() * hotSpots.length)];

      logger.info(`开始漫游到热点区域: ${randomSpot.name} (${randomSpot.lat}, ${randomSpot.lng})`);

      // 🔧 修复：更严格的目标坐标验证
      if (typeof randomSpot.lat !== 'number' || typeof randomSpot.lng !== 'number' ||
          isNaN(randomSpot.lat) || isNaN(randomSpot.lng) ||
          randomSpot.lat < -90 || randomSpot.lat > 90 ||
          randomSpot.lng < -180 || randomSpot.lng > 180) {
        logger.error('❌ 漫游目标坐标无效，跳过操作:', { lat: randomSpot.lat, lng: randomSpot.lng, latType: typeof randomSpot.lat, lngType: typeof randomSpot.lng });
        setIsRoaming(false);
        setIsRoamingDisabled(false); // 🚀 优化2：立即重置状态
        return;
      }

      // 🔧 修复：确保地图移动管理器有效
      if (!mapMoveManager) {
        logger.error('❌ 地图移动管理器未初始化');
        setIsRoaming(false);
        setIsRoamingDisabled(false); // 🚀 优化2：立即重置状态
        return;
      }

      // 🚀 优化3：使用Number()确保坐标是数字类型
      const validLng = Number(randomSpot.lng);
      const validLat = Number(randomSpot.lat);

      logger.info(`🗺️ 漫游到目标位置: (${validLat}, ${validLng})`);

      // 🚀 优化4：减少动画时间，提升响应速度
      await mapMoveManager.moveTo(validLng, validLat, {
        zoom: 14,
        animate: true,
        duration: 800, // 从2000ms减少到800ms，提升60%响应速度！
        callback: () => {
          logger.info(`✅ 漫游移动完成: 已移动到 ${randomSpot.name} (${validLat}, ${validLng})`);
          setIsRoaming(false);
          setIsRoamingDisabled(false); // 🚀 优化2：立即重置状态，无需延迟
          logger.info(`漫游完成: ${randomSpot.name}`);
        }
      });

    } catch (error) {
      logger.error('❌ 漫游功能失败:', error);
    } finally {
      // 🚀 优化5：统一的状态重置
      setIsRoaming(false);
      setIsRoamingDisabled(false);
    }
  };

  // 🆕 使用统一绘制系统的GPS模式切换
  const handleToggleAuto = async () => {
    const isGpsMode = drawingGetters.isGpsMode;

    try {
      if (!isGpsMode) {
        // 开启GPS自动模式
        logger.info('🚗 开启GPS自动模式...');

        const success = await drawingActions.switchToGpsMode();
        if (success) {
          logger.info(`✅ GPS自动模式已开启: ${drawingState.session?.id?.slice(0, 8)}`);
          toast.success(t('gps_on'));
          const gpsHintKey = 'funnypixels_gps_hint_v1';
          if (!localStorage.getItem(gpsHintKey)) {
            toast.info(t('gps_hint'));
            localStorage.setItem(gpsHintKey, 'shown');
          }
        } else {
          toast.error(`${t('gps_on_failed')}: ${drawingState.error || 'unknown'}`);
        }
      } else {
        // 关闭GPS自动模式
        logger.info('🚗 关闭GPS自动模式...');

        const success = await drawingActions.switchToIdleMode();
        if (success) {
          logger.info('✅ GPS自动模式已关闭');
          toast.success(t('gps_off'));
        } else {
          toast.error(`${t('gps_off_failed')}: ${drawingState.error || 'unknown'}`);
        }
      }
    } catch (error) {
      logger.error('❌ 切换GPS自动模式失败:', error);
      toast.error(t('operation_failed'));
    }
  };

  // 🆕 使用统一绘制系统的手动模式切换
  const handleToggleManual = async () => {
    const isManualMode = drawingGetters.isManualMode;

    try {
      if (!isManualMode) {
        // 开启手动绘制模式
        logger.info('🎨 开启手动绘制模式...');

        const success = await drawingActions.switchToManualMode();
        if (success) {
          logger.info(`✅ 手动绘制模式已开启: ${drawingState.session?.id?.slice(0, 8)}`);
          toast.success(t('manual_on'));
          const manualHintKey = 'funnypixels_manual_hint_v1';
          if (!localStorage.getItem(manualHintKey)) {
            toast.info(t('manual_hint'));
            localStorage.setItem(manualHintKey, 'shown');
          }
        } else {
          toast.error(`${t('manual_on_failed')}: ${drawingState.error || 'unknown'}`);
        }
      } else {
        // 关闭手动绘制模式
        logger.info('🎨 关闭手动绘制模式...');

        const success = await drawingActions.switchToIdleMode();
        if (success) {
          logger.info('✅ 手动绘制模式已关闭');
          toast.success(t('manual_off'));
        } else {
          toast.error(`${t('manual_off_failed')}: ${drawingState.error || 'unknown'}`);
        }
      }
    } catch (error) {
      logger.error('❌ 切换手动绘制模式失败:', error);
      toast.error(t('operation_failed'));
    }
  };

  const handlePageChange = async (page: string) => {
    setCurrentPage(page as PageType);

    // 🆕 如果离开地图页面，自动停止绘制模式
    if (page !== 'map') {
      if (drawingGetters.isGpsMode || drawingGetters.isManualMode) {
        logger.info('🛑 离开地图页面，自动停止绘制模式');
        await drawingActions.switchToIdleMode();
      }
    }

    // 同步URL（除了支付页面，因为支付页面有特殊的URL）
    if (page !== 'payment') {
      const newUrl = `/${page}`;
      if (window.location.pathname !== newUrl) {
        window.history.pushState({}, '', newUrl);
        logger.info('📝 URL已同步:', newUrl);
      }
    }
  };

  const handleLoginClick = async () => {
    logger.info('🔐 登录按钮被点击，准备进入登录页面');
    try {
      // 清除游客ID，强制显示登录页面
      await AuthService.logout();
      setIsAuthenticated(false);
      setCurrentUser(null);
      
      // 强制清除localStorage中的游客ID
      localStorage.removeItem('pixelwar_guest_id');
      
      // 强制重新渲染
      setForceUpdate(prev => prev + 1);
      
      logger.info('✅ 状态已重置，应该显示登录页面');
    } catch (error) {
      logger.error('❌ 清除游客状态失败:', error);
      // 即使失败也要重置状态
      setIsAuthenticated(false);
      setCurrentUser(null);
      localStorage.removeItem('pixelwar_guest_id');
    }
  };

  // 重试函数
  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    // 🚀 优化：移除 setIsLoading(true)
    // setIsLoading(true);
    setLoadingError(null);
  };

  // 🔌 网络错误页面处理函数
  const handleNetworkRetry = async () => {
    logger.info('用户手动触发网络重试');
    const success = await networkDetection.retry();
    if (success) {
      setShowNetworkErrorPage(false);
      logger.info('网络恢复，关闭错误页面');
    }
  };

  const handleOfflineMode = () => {
    logger.info('用户选择进入离线模式');
    setShowNetworkErrorPage(false);
    // 可以在这里添加离线模式的特殊处理
    // 比如显示离线提示、启用离线功能等
  };

  
  // 🔌 显示网络错误页面
  if (showNetworkErrorPage) {
    return (
      <NetworkErrorPage
        onRetry={handleNetworkRetry}
        onOfflineMode={handleOfflineMode}
        initialRetryCount={networkDetection.retryCount}
      />
    );
  }

  // 显示错误界面
  if (loadingError) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)',
        padding: '20px'
      }}>
        <div style={{
          textAlign: 'center',
          color: 'white',
          maxWidth: '400px'
        }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '20px'
          }}>
            ⚠️
          </div>
          <div style={{
            fontSize: '20px',
            marginBottom: '16px',
            fontWeight: 'bold'
          }}>
            加载失败
          </div>
          <div style={{
            fontSize: '16px',
            marginBottom: '24px',
            opacity: 0.9,
            lineHeight: '1.5'
          }}>
            {loadingError}
          </div>
          <button
            onClick={handleRetry}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: '2px solid white',
              color: 'white',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '16px',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.3)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
            }}
          >
            🔄 重试
          </button>
          <div style={{
            fontSize: '14px',
            marginTop: '16px',
            opacity: 0.7
          }}>
            如果问题持续存在，请检查网络连接或稍后重试
          </div>
        </div>
      </div>
    );
  }

  // 如果既未认证也不是游客，显示登录页面
  if (!isAuthenticated && !isGuest) {
    if (useCleanStyle) {
      logger.info('📱 显示简洁风格登录页面');
      return <CleanAuthPage onAuthSuccess={handleAuthSuccess} />;
    } else {
      logger.info('📱 显示增强登录页面');
      return <AuthPageEnhanced onAuthSuccess={handleAuthSuccess} />;
    }
  }

  return (
    <>
      {/* 主应用层 */}
      <div style={{
        height: '100vh',
        position: 'relative',
        '--bottom-nav-height': '88px', // CSS变量，便于维护
        '--bottom-nav-margin': '16px', // 底部导航栏的margin
        '--total-bottom-space': 'calc(var(--bottom-nav-height) + var(--bottom-nav-margin) + 16px)' // 总底部空间
      } as React.CSSProperties}>
      {/* 网络状态检测 */}
      <NetworkStatus />
      {/* 游客模式登录按钮 */}
      <LoginButton onLoginClick={handleLoginClick} />

      {/* 绘制状态面板 - 只在非游客模式且在地图页面时显示 */}
      {!isGuest && currentPage === 'map' && (
        <DrawingStatusPanel
          isVisible={true}
          // 🆕 使用统一绘制系统的状态
          isDrawing={drawingGetters.isGpsMode || drawingGetters.isManualMode}
          session={drawingState.session}
          mode={drawingState.mode}
          pixelCount={drawingState.pixelCount}
          canDraw={drawingGetters.hasActiveSession}
        />
      )}




      {/* 地图控制按钮 - 只在非游客模式且在地图页面时显示 */}
      {(() => {
        logger.info('🔧 地图工具栏状态检查:', {
          isGuest,
          currentPage,
          showControls: !isGuest && currentPage === 'map',
          isAuthenticated
        });
        return null;
      })()}
      {!isGuest && currentPage === 'map' && (
        <MapControls
          onLocate={handleLocate}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onRoam={handleRoam}
          onOpenQuickStart={() => setShowQuickStart(true)}
          onToggleAuto={handleToggleAuto}
          onToggleManual={handleToggleManual}
          // 🆕 使用统一绘制系统的状态
          isAutoMode={drawingGetters.isGpsMode}
          isManualMode={drawingGetters.isManualMode}
          isLoading={drawingState.isLoading}
          currentSession={drawingState.session}
          canDraw={drawingGetters.hasActiveSession}
          isLocating={isLocating}
          isRoaming={isRoaming}
          showQuickStartHint={hasQuickStartPrompt}
        />
      )}

      {/* 底部导航栏 - 只在非游客模式下显示 */}
      {!isGuest && (
        <BottomNavigation
          currentPage={currentPage}
          onPageChange={handlePageChange}
          isAuthenticated={isAuthenticated}
          onLoginClick={handleLoginClick}
        />
      )}

      {/* 页面内容 */}
      <div style={{
        paddingBottom: isGuest ? '0px' : '0px', // 移除额外的padding，因为高度已经正确计算
        position: currentPage === 'map' ? 'fixed' : 'fixed', // 🔥 修复：地图页面使用fixed定位
        top: 0, // 🔥 修复：从顶部开始
        left: 0, // 🔥 修复：从左侧开始
        right: 0, // 🔥 修复：到右侧结束
        bottom: 0, // 🔥 修复：到底部结束
        width: '100%', // 🔥 修复：占满整个宽度
        height: currentPage === 'map' ? '100vh' : 'calc(100vh - var(--total-bottom-space))', // 🔥 修复：地图占满整个视口
        backgroundColor: currentPage === 'map' ? 'transparent' : 'white',
        overflowY: currentPage === 'map' ? 'hidden' : 'auto', // 🔥 修复：地图页面隐藏溢出
        display: currentPage === 'map' ? 'block' : 'block', // 🔥 修复：确保显示
        zIndex: currentPage === 'map' ? 1 : 2 // 🔥 修复：地图容器作为基础层，确保地图可见
      }}>
        {currentPage === 'map' && (
          <>
            {(() => {
              logger.debug('🗺️ 渲染地图页面，currentTab:', currentPage);
              return null;
            })()}
            <MapCanvas
              initialCenter={[113.324520, 23.109722]} // 广州塔
              initialZoom={14}
              enableDrawing={true}
              onPixelClick={handlePixelClick}
              onMapReady={(map) => {
                // 设置全局map实例
                safeSetWindowProperty('mapInstance', map);
                safeSetWindowProperty('mapLibreMap', map);
                if (!mapInstanceRef.current) {
                  setMapInstance(map);
                }

                // 设置当前用户信息供绘制系统使用
                if (currentUser) {
                  safeSetWindowProperty('currentUser', currentUser);
                }
              }}
            />
          </>
        )}
        {currentPage === 'social' && <SocialPage />}
        {currentPage === 'store' && <StorePage />}
        {currentPage === 'profile' && <ProfilePage />}
        {currentPage === 'alliance' && <AlliancePage />}
        {currentPage === 'chat' && <ChatPage />}
        {currentPage === 'leaderboard' && <LeaderboardPage />}
        {currentPage === 'payment' && <PaymentPage />}
        {currentPage === 'admin' && <AdminPage />}
        {currentPage === 'achievements' && <AchievementPage />}
        {/* Test pages removed - files do not exist */}
        {/* {currentPage === 'pattern-test' && <PatternTestPage />} */}
        {/* {currentPage === 'maplibre-test' && <MapLibreTestPage />} */}
        {/* {currentPage === 'osm-test' && <OSMTestPage />} */}
        {/* {currentPage === 'point-sdf-test' && <PointSDFTestPage />} */}

      </div>

      {/* Toast通知系统 */}
      <ToastContainer />

      {/* 全局弹窗系统 */}
      <GlobalDialogs />

      {/* 🎨 分享弹窗 - 绘制完成后自动弹出 */}
      {selectedShareSession && (
        <ShareModal
          isOpen={showShareModal}
          onClose={() => {
            setShowShareModal(false);
            setSelectedShareSession(null);
          }}
          sessionId={selectedShareSession.id}
          sessionData={selectedShareSession}
        />
      )}

      {/* 🎯 像素信息卡片 - 仅限登录用户（非游客） */}
      {selectedPixel && isAuthenticated && !isGuest && (
        <PixelInfoCard
          pixel={selectedPixel}
          isVisible={showPixelCard}
          onClose={handlePixelCardClose}
          position={pixelCardPosition}
          isDrawingMode={drawingGetters.isManualMode && drawingGetters.hasActiveSession}
        />
      )}
      <QuickStartOverlay
        isOpen={showQuickStart}
        onClose={handleQuickStartClose}
        onComplete={handleQuickStartComplete}
        onStartAuto={handleQuickStartAuto}
        onLocate={handleLocate}
        onRoam={handleRoam}
      />
      </div>
    </>
  );
}

// 🆕 主App组件，包装DrawingProvider和AuthProvider
function App() {
  return (
    <AuthProvider>
      <DrawingProvider>
        <AppContent />
      </DrawingProvider>
    </AuthProvider>
  );
}

export default App;
