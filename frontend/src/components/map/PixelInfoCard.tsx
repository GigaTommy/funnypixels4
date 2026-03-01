import React, { useState, useEffect, useCallback } from 'react';
import { logger } from '../../utils/logger';
import { motion, AnimatePresence } from 'framer-motion';
import { SocialAPI } from '../../services/social';
import { AuthService } from '../../services/auth';
import { PixelService } from '../../services/pixel';
import { ShareService } from '../../services/share';
import { CosmeticAPI } from '../../services/cosmetic';
import { ReportAPI } from '../../services/report';
import { dialogService } from '../../services/dialogService';
import { PixelInfo, REPORT_REASONS, ReportReason } from '../../types/pixel';
import { useAuth } from '../../contexts/AuthContext';
import { FlagIcon } from '../ui/FlagIcon';
import { ModernFlagIcon } from '../ui/ModernFlagIcon';
import { 
  PixelTargetIcon, 
  PixelCloseIcon, 
  PixelReportFlagIcon, 
  PixelHeartIcon, 
  PixelShareIcon, 
  PixelUserPlusIcon, 
  PixelUserCheckIcon,
  PixelAvatar 
} from '../ui/PixelIcons';
import { MdFlagCircle } from "react-icons/md";
import { LuSmilePlus } from "react-icons/lu";
import {
  dialogBackdropStyle,
  dialogSmallStyle,
  dialogHeaderStyle,
  dialogTitleStyle,
  dialogSubtitleStyle,
  closeButtonStyle,
  infoPanelBlueStyle,
  labelStyle,
  labelRequiredStyle,
  errorPanelStyle,
  warningPanelStyle,
  cancelButtonStyle,
  primaryButtonBlueStyle,
  headerIconBgBlueStyle,
  COLORS,
  spacingYStyle,
  spinnerStyle
} from '../../styles/dialogStyles';

interface PixelInfoCardProps {
  pixel: PixelInfo | null;
  isVisible: boolean;
  onClose: () => void;
  position: { x: number; y: number };
  isDrawingMode?: boolean; // 新增：绘制模式状态
}

export const PixelInfoCard: React.FC<PixelInfoCardProps> = ({
  pixel,
  isVisible,
  onClose,
  position,
  isDrawingMode = false // 默认非绘制模式
}) => {
  // 🔐 使用AuthContext获取currentUser（移除本地状态管理）
  const { currentUser } = useAuth();

  // 临时注释：允许在绘制模式下也显示像素信息卡片
  // if (isDrawingMode) {
  //   logger.info('🎨 绘制模式已启动，不显示像素信息卡片', {
  //     isDrawingMode,
  //     pixel: pixel?.grid_id,
  //     isVisible
  //   });
  //   return null;
  // }
  // 添加CSS动画样式
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const [isHovered, setIsHovered] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const [selectedReportReason, setSelectedReportReason] = useState<string>('');
  const [reportContext, setReportContext] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [isLoadingFollow, setIsLoadingFollow] = useState(false);
  const [isLoadingLike, setIsLoadingLike] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [toastMessage, setToastMessage] = useState<string>('');
  const [showToast, setShowToast] = useState(false);

  // ✅ 移除本地currentUser状态管理，使用Context中的currentUser
  // const [currentUser, setCurrentUser] = useState<any>(null);
  const [latestCosmetic, setLatestCosmetic] = useState<any>(null);
  const [pixelOwnerPrivacy, setPixelOwnerPrivacy] = useState<any>(null);
  const [isLoadingPrivacy, setIsLoadingPrivacy] = useState(false);
  const [pixelAvatarUrl, setPixelAvatarUrl] = useState<string | null>(null);
  const [isLoadingAvatar, setIsLoadingAvatar] = useState(false);

  // 加载最新装饰品 - 只在卡片可见时加载（无论是否认证）
  useEffect(() => {
    if (!isVisible) {
      return;
    }

    const loadLatestCosmetic = async () => {
      try {
        // 检查用户是否已认证，如果未认证则跳过API调用
        if (!AuthService.isAuthenticated()) {
          return;
        }

        const response = await CosmeticAPI.getLatestUsedCosmetic();
        if (response.success && response.cosmetic) {
          setLatestCosmetic(response.cosmetic);
        }
      } catch (error) {
        logger.error('加载最新装饰品失败:', error);
      }
    };
    loadLatestCosmetic();
  }, [isVisible]);

  // 监听窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

    // 加载像素所有者的隐私设置
  const loadPixelOwnerPrivacy = useCallback(async () => {
    if (!pixel?.user_id || pixel.user_id === 'guest') return;

    setIsLoadingPrivacy(true);
    try {
      const response = await fetch(`/api/privacy/user/${pixel.user_id}/settings`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setPixelOwnerPrivacy(data.data.settings);
        }
      }
    } catch (error) {
      logger.error('获取像素所有者隐私设置失败:', error);
    } finally {
      setIsLoadingPrivacy(false);
    }
  }, [pixel?.user_id]);

  // 🔥 方案C-1: 直接使用 MVT 中的 avatar_url，无需 API 调用
  // 加载像素头像 - 优先使用 avatar_url，无需调用后端生成
  const loadPixelAvatar = useCallback(() => {
    if (!pixel?.user_id || pixel.user_id === 'guest') {
      setPixelAvatarUrl(null);
      return;
    }

    // 直接使用 MVT 中的 avatar_url（如果存在）
    // avatar_url 格式: /uploads/materials/avatars/xx/yy/filename.png
    if (pixel.avatar_url) {
      // 处理 URL 路径，确保在开发和生产环境都能正确访问
      let avatarUrl = pixel.avatar_url;

      // 如果是相对路径，添加 API base URL
      if (avatarUrl.startsWith('/uploads/')) {
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
        // 确保 base URL 结尾没有斜杠，path 开头有斜杠
        const baseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
        avatarUrl = `${baseUrl}${avatarUrl}`;
      }

      setPixelAvatarUrl(avatarUrl);
      logger.info('✅ 头像URL已获取 (从MVT):', { userId: pixel.user_id, url: avatarUrl });
    } else {
      setPixelAvatarUrl(null);
    }

    setIsLoadingAvatar(false);
  }, [pixel?.user_id, pixel?.avatar_url]);

  // 检查关注状态
  const checkFollowStatus = useCallback(async () => {
    if (!pixel?.user_id || !currentUser || pixel.user_id === currentUser.id) return;

    // 游客用户不能被关注，跳过关注状态检查
    if (pixel.user_id === 'guest' || pixel.username === '游客') {
      return;
    }

    try {
      const response = await SocialAPI.checkFollowStatus(pixel.user_id);
      if (response.success) {
        setIsFollowing(response.data.isFollowing);
      }
    } catch (error) {
      logger.error('检查关注状态失败:', error);
    }
  }, [pixel?.user_id, pixel.username, currentUser]);

  useEffect(() => {
    if (pixel) {
      setIsLiked(pixel.is_liked || false);
      setLikesCount(pixel.likes_count || 0);
      if (currentUser) {
        checkFollowStatus();
      }

      // 获取像素所有者隐私设置
      loadPixelOwnerPrivacy();

      // 加载像素头像
      loadPixelAvatar();
    }
  }, [pixel, currentUser, checkFollowStatus, loadPixelOwnerPrivacy, loadPixelAvatar]);

  // 格式化坐标
  const formatCoordinate = (coord: number) => {
    return coord.toFixed(2);
  };

  // 格式化经纬度为带方向标识的格式
  const formatCoordinateWithDirection = (lat: number, lng: number) => {
    const latAbs = Math.abs(lat);
    const lngAbs = Math.abs(lng);
    const latDir = lat >= 0 ? 'N' : 'S';
    const lngDir = lng >= 0 ? 'E' : 'W';
    return `(${latAbs.toFixed(2)}${latDir}, ${lngAbs.toFixed(2)}${lngDir})`;
  };

  // 渲染装饰品
  const renderCosmetic = (cosmetic: any) => {
    if (!cosmetic) return null;

    switch (cosmetic.type) {
      case 'avatar_frame':
        return (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            backgroundColor: '#fef3c7',
            paddingLeft: '8px',
            paddingRight: '8px',
            paddingTop: '4px',
            paddingBottom: '4px',
            borderRadius: '9999px',
            fontSize: '12px'
          }}>
            <span style={{ color: '#d97706' }}>👑</span>
            <span style={{ color: '#92400e', fontWeight: 500 }}>金色头像框</span>
          </div>
        );
      case 'chat_bubble':
        return (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            backgroundColor: '#dbeafe',
            paddingLeft: '8px',
            paddingRight: '8px',
            paddingTop: '4px',
            paddingBottom: '4px',
            borderRadius: '9999px',
            fontSize: '12px'
          }}>
            <span style={{ color: '#2563eb' }}>💬</span>
            <span style={{ color: '#1e40af', fontWeight: 500 }}>彩虹聊天气泡</span>
          </div>
        );
      case 'badge':
        return (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            backgroundColor: '#dcfce7',
            paddingLeft: '8px',
            paddingRight: '8px',
            paddingTop: '4px',
            paddingBottom: '4px',
            borderRadius: '9999px',
            fontSize: '12px'
          }}>
            <span style={{ color: '#16a34a' }}>🏆</span>
            <span style={{ color: '#15803d', fontWeight: 500 }}>像素大师徽章</span>
          </div>
        );
      default:
        return null;
    }
  };

  // 处理关注/取消关注
  const handleFollowToggle = async () => {
    if (!pixel?.user_id || isLoadingFollow) return;

    // 如果用户未登录，提示登录
    if (!currentUser) {
      return;
    }

    // 如果查看的是自己的像素，不执行关注操作
    if (pixel.user_id === currentUser.id) {
      return;
    }

    // 游客用户不能被关注
    if (pixel.user_id === 'guest' || pixel.username === '游客') {
      return;
    }

    setIsLoadingFollow(true);
    try {
      if (isFollowing) {
        const response = await SocialAPI.unfollowUser(pixel.user_id);
        if (response.success) {
          setIsFollowing(false);
        }
      } else {
        const response = await SocialAPI.followUser(pixel.user_id);
        if (response.success) {
          setIsFollowing(true);
        }
      }
    } catch (error) {
      logger.error('关注操作失败:', error);
    } finally {
      setIsLoadingFollow(false);
    }
  };

  // 处理点赞
  const handleLikeToggle = async () => {
    if (!pixel || !currentUser || isLoadingLike) return;
    
    setIsLoadingLike(true);
    try {
      if (isLiked) {
        const response = await PixelService.unlikePixel(pixel.lat, pixel.lng);
        if (response.success) {
          setIsLiked(false);
          setLikesCount(prev => Math.max(0, prev - 1));
        }
      } else {
        const response = await PixelService.likePixel(pixel.lat, pixel.lng);
        if (response.success) {
          setIsLiked(true);
          setLikesCount(prev => prev + 1);
        }
      }
    } catch (error) {
      logger.error('点赞操作失败:', error);
    } finally {
      setIsLoadingLike(false);
    }
  };

  // 显示Toast提示
  const showToastMessage = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    // 3秒后自动隐藏
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };

  // 复制分享链接
  const handleCopyShareLink = async () => {
    if (!pixel) return;

    try {
      const result = await ShareService.copyShareLink(pixel);
      if (result.success) {
        showToastMessage('✅ 链接已复制到剪贴板');
      } else {
        showToastMessage('❌ 复制失败，请重试');
      }
    } catch (error) {
      logger.error('复制分享链接失败:', error);
      showToastMessage('❌ 复制失败，请重试');
    }
  };

  // 提交举报
  const submitReport = async () => {
    if (!selectedReportReason || !reportContext.trim() || !pixel) return;

    setIsSubmittingReport(true);
    try {
      // 构建像素坐标ID
      const pixelId = `${pixel.lat.toFixed(6)}_${pixel.lng.toFixed(6)}`;

      // 获取metadata，包含像素的详细信息
      const metadata = {
        pixel_id: pixel.grid_id,
        user_id: pixel.user_id,
        username: pixel.username,
        lat: pixel.lat,
        lng: pixel.lng,
        color: pixel.color,
        alliance_id: pixel.alliance_id,
        alliance_name: pixel.alliance_name
      };

      const response = await ReportAPI.createReport({
        targetType: 'pixel',
        targetId: pixelId,
        reason: selectedReportReason as any,
        description: reportContext,
        metadata: metadata
      });

      if (response.success) {
        setShowReportModal(false);
        setSelectedReportReason('');
        setReportContext('');

        // 显示成功提示
        await dialogService.alert(`举报提交成功！举报ID: ${response.data.reportId}。管理员会尽快处理您的举报。`, {
          type: 'success',
          title: '举报成功'
        });

        // 可以在这里添加更多成功后的逻辑
        // 比如记录到本地存储、更新用户举报历史等
      } else {
        await dialogService.alert(response.message || '举报提交失败，请稍后重试', {
          type: 'error',
          title: '举报失败'
        });
      }
    } catch (error: any) {
      logger.error('提交举报失败:', error);
      const errorMessage = error.response?.data?.message || error.message || '举报提交失败，请检查网络连接后重试';
      await dialogService.alert(errorMessage, {
        type: 'error',
        title: '举报失败'
      });
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // 点击外部区域关闭卡片
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      // 如果举报模态框打开，不处理外部点击
      if (showReportModal) {
        return;
      }
      if (isVisible && !target.closest('[data-testid="pixel-info-card"]')) {
        onClose();
      }
    };

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isVisible, onClose, showReportModal]);

  // 🔐 验证用户状态 - 仅限登录用户
  if (!currentUser) {
    return null;
  }

  // 如果处于绘制模式，不显示信息卡片
  if (isDrawingMode) {
    return null;
  }

  if (!pixel || !isVisible) {
    return null;
  }

  // 检查是否为占位符数据（像素不存在的情况）
  const isPlaceholder = (pixel as any).isPlaceholder;

  return (
    <>
      {/* 像素信息卡片 */}
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed"
          data-testid="pixel-info-card"
          style={{
            left: (() => {
              const cardWidth = windowSize.width < 480 ? 280 : 300;
              const margin = 20;
              const rightEdge = position.x + cardWidth + margin;

              if (rightEdge > windowSize.width) {
                return Math.max(position.x - cardWidth - margin, margin);
              }
              return position.x + margin;
            })(),
            top: (() => {
              const cardHeight = windowSize.width < 480 ? 130 : 140;
              const margin = 20;
              const topEdge = position.y - cardHeight - margin;

              if (topEdge >= margin) {
                return topEdge;
              }

              const bottomEdge = position.y + cardHeight + margin;
              if (bottomEdge <= windowSize.height) {
                return position.y + margin;
              }

              return Math.max(windowSize.height / 2 - cardHeight / 2, margin);
            })(),
            maxWidth: windowSize.width < 480 ? '17.5rem' : '18.75rem',
            width: '100%',
            zIndex: 9999,
            pointerEvents: 'auto',
            position: 'fixed'
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* 卡片主体 - 现代设计风格 */}
          <div
            className="w-full max-w-md"
            style={{
              fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '16px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
              padding: windowSize.width < 480 ? '10px' : '12px',
              maxWidth: windowSize.width < 480 ? '280px' : '300px',
              minWidth: '260px'
            }}
          >
            {/* Top Bar */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                whiteSpace: 'nowrap'
              }}>
                <div style={{ color: '#6b7280' }}>
                  <PixelTargetIcon />
                </div>
                <span style={{ color: '#374151' }}>
                  {formatCoordinateWithDirection(pixel.lat, pixel.lng)}
                </span>
                {/* 地区信息 */}
                {pixel.city && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                    marginLeft: '4px',
                    paddingLeft: '5px',
                    paddingRight: '5px',
                    paddingTop: '2px',
                    paddingBottom: '2px',
                    backgroundColor: '#eff6ff',
                    borderRadius: '10px',
                    border: '1px solid #dbeafe'
                  }}>
                    <span style={{ color: '#1e40af', fontSize: '12px' }}>
                      {pixel.city}
                    </span>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* 国家/地区旗帜 */}
                <div>
                  <ModernFlagIcon
                    country={pixel.country || 'cn'}
                    size="sm"
                  />
                </div>
                <button
                  style={{
                    marginLeft: '4px',
                    border: '1px solid #e5e7eb',
                    backgroundColor: '#f9fafb',
                    padding: '4px',
                    cursor: 'pointer',
                    borderRadius: '6px',
                    transition: 'all 0.2s ease'
                  }}
                  onClick={onClose}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f3f4f6';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f9fafb';
                  }}
                >
                  <PixelCloseIcon />
                </button>
              </div>
            </div>

            {/* Main Info */}
            {isPlaceholder ? (
              // 占位符显示 - 像素不存在的情况
              <div style={{
                textAlign: 'center',
                paddingTop: '10px',
                paddingBottom: '10px'
              }}>
                <div style={{
                  width: '52px',
                  height: '52px',
                  marginLeft: 'auto',
                  marginRight: 'auto',
                  marginBottom: '8px',
                  backgroundColor: '#f3f4f6',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <span style={{ fontSize: '20px' }}>📍</span>
                </div>
                <h3 style={{ color: '#111827', fontWeight: 600, fontSize: '16px', marginBottom: '6px' }}>此区域暂无像素</h3>
                <p style={{ color: '#6b7280', fontSize: '12px' }}>
                  点击地图上的其他像素查看详细信息
                </p>
              </div>
            ) : (
              // 正常像素信息显示
              <div style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '12px',
                gap: '12px'
              }}>
                <div style={{ flexShrink: 0 }}>
                  <PixelAvatar
                    src={!pixelOwnerPrivacy?.hide_nickname ? (pixelAvatarUrl || pixel.avatar_url) : undefined}
                    alt={`${pixelOwnerPrivacy?.hide_nickname ? '匿名用户' : (pixel.username || '用户')}头像`}
                    fallback={pixelOwnerPrivacy?.hide_nickname ? '匿' : (pixel.username?.charAt(0).toUpperCase() || '游')}
                    size="sm"
                    isLoading={isLoadingAvatar}
                  />
                </div>
                <div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '16px'
                  }}>
                    <h1 style={{ color: '#111827', fontWeight: 600, margin: 0, fontSize: '16px' }}>
                      @{pixelOwnerPrivacy?.hide_nickname ? '匿名用户' : (pixel.username || '游客')}
                    </h1>
                    {pixel.alliance_name && !pixelOwnerPrivacy?.hide_alliance && (
                      <span
                        style={{
                          fontSize: '14px',
                          fontWeight: 400,
                          borderRadius: '9999px',
                          backgroundColor: '#eff6ff',
                          color: '#1e40af',
                          border: '1px solid #dbeafe',
                          padding: '6px 12px'
                        }}
                      >
                        {pixel.alliance_name}
                      </span>
                    )}
                    {/* 显示最新装饰品 */}
                    {latestCosmetic && renderCosmetic(latestCosmetic)}
                  </div>
                  {/*<p className="text-xs text-gray-600 mt-1">@{pixel.user_id || 'unknown'}</p>*/}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {!isPlaceholder && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: windowSize.width < 480 ? '6px' : '8px'
              }}>
                {/* 关注按钮 - 游客用户不显示 */}
                {pixel.user_id !== 'guest' && pixel.username !== '游客' && (
                  <button
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    padding: windowSize.width < 480 ? '6px 8px' : '7px 10px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: 600,
                    border: isFollowing ? '1px solid #16a34a' : '1px solid #d1d5db',
                    cursor: isLoadingFollow || !currentUser ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    backgroundColor: isFollowing ? '#f0fdf4' : '#f9fafb',
                    color: isFollowing ? '#166534' : '#374151',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    opacity: isLoadingFollow || !currentUser ? 0.6 : 1,
                    minHeight: windowSize.width < 480 ? '26px' : '28px'
                  }}
                  onClick={handleFollowToggle}
                  disabled={isLoadingFollow || !currentUser}
                  title={isLoadingFollow ? '加载中...' : !currentUser ? '请先登录' : isFollowing ? '已关注' : '关注'}
                  onMouseEnter={(e) => {
                    if (!isLoadingFollow && currentUser) {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = isFollowing ? '#dcfce7' : '#f3f4f6';
                      (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 6px rgba(0,0,0,0.1)';
                      (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.02)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = isFollowing ? '#f0fdf4' : '#f9fafb';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                    (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                  }}
                >
                  <LuSmilePlus size={14} />
                </button>
                )}

                {/* 点赞按钮 */}
                <button
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    padding: windowSize.width < 480 ? '6px 8px' : '7px 10px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: 600,
                    border: isLiked ? '1px solid #dc2626' : '1px solid #d1d5db',
                    cursor: isLoadingLike || !currentUser ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    backgroundColor: isLiked ? '#fef2f2' : '#f9fafb',
                    color: isLiked ? '#dc2626' : '#374151',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    opacity: isLoadingLike || !currentUser ? 0.6 : 1,
                    minHeight: windowSize.width < 480 ? '26px' : '28px'
                  }}
                  onClick={handleLikeToggle}
                  disabled={isLoadingLike || !currentUser}
                  title={isLoadingLike ? '处理中...' : !currentUser ? '请先登录' : `点赞 ${likesCount > 0 ? `(${likesCount})` : ''}`}
                  onMouseEnter={(e) => {
                    if (!isLoadingLike && currentUser) {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = isLiked ? '#fee2e2' : '#f3f4f6';
                      (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 6px rgba(0,0,0,0.1)';
                      (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.02)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = isLiked ? '#fef2f2' : '#f9fafb';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                    (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                  }}
                >
                  <PixelHeartIcon />
                  {likesCount > 0 && <span style={{ fontSize: '12px' }}>({likesCount})</span>}
                </button>

                {/* 复制链接按钮 */}
                <button
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    padding: windowSize.width < 480 ? '6px 8px' : '7px 10px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: 600,
                    border: '1px solid #d1d5db',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    backgroundColor: '#f9fafb',
                    color: '#374151',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    minHeight: windowSize.width < 480 ? '26px' : '28px'
                  }}
                  onClick={handleCopyShareLink}
                  title="复制分享链接"
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f3f4f6';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 6px rgba(0,0,0,0.1)';
                    (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.02)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f9fafb';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                    (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                  }}
                >
                  <PixelShareIcon />
                </button>

                {/* 举报按钮 */}
                <button
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    padding: windowSize.width < 480 ? '6px 8px' : '7px 10px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: 600,
                    border: '1px solid #fca5a5',
                    cursor: !currentUser ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    backgroundColor: '#fef2f2',
                    color: '#dc2626',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    opacity: !currentUser ? 0.6 : 1,
                    minHeight: windowSize.width < 480 ? '26px' : '28px'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowReportModal(true);
                  }}
                  disabled={!currentUser}
                  title={!currentUser ? '请先登录' : '举报'}
                  onMouseEnter={(e) => {
                    if (currentUser) {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#fee2e2';
                      (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 6px rgba(0,0,0,0.1)';
                      (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.02)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#fef2f2';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                    (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                  }}
                >
                  <MdFlagCircle size={14} />
                </button>
              </div>
            )}

          </div>
        </motion.div>
      </AnimatePresence>

      {/* Toast 提示 */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            transition={{ duration: 0.3 }}
            style={{
              position: 'fixed',
              bottom: '100px',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: 'rgba(0, 0, 0, 0.85)',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 500,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
              zIndex: 1110, // 🔥 优化：使用标准z-index规范，toast通知
              whiteSpace: 'nowrap',
              pointerEvents: 'none'
            }}
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 举报模态框 */}
      <AnimatePresence>
        {showReportModal && (
          <>
            {/* 添加旋转动画样式 */}
            <style>
              {`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}
            </style>
            <div
              style={{
                ...dialogBackdropStyle,
                zIndex: 5010, // 🔥 优化：使用标准z-index规范，基础弹窗背景
                // 避免被底部菜单栏遮挡，增加底部间距
                paddingBottom: '80px'
              }}
              onClick={(e) => {
                // 只有当点击背景时才关闭模态框，不阻止冒泡
                if (e.target === e.currentTarget) {
                  setShowReportModal(false);
                }
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                style={{
                  ...dialogSmallStyle,
                  maxHeight: '80vh', // 适当增加可用高度
                  marginBottom: '20px', // 减少底部边距
                  padding: '16px' // 减少整体内边距
                }}
                onClick={(e) => {
                  // 阻止点击模态框内容时冒泡到背景层
                  e.stopPropagation();
                }}
              >
              {/* 头部 */}
              <div style={{
                ...dialogHeaderStyle,
                marginBottom: '12px' // 减少头部底部间距
              }}>
                <div style={headerIconBgBlueStyle}>
                  <PixelReportFlagIcon />
                </div>
                <div>
                  <h3 style={dialogTitleStyle}>举报用户</h3>
                  <p style={dialogSubtitleStyle}>
                    {pixel.username} #{pixel.user_id}
                  </p>
                </div>
                <button
                  onClick={() => setShowReportModal(false)}
                  style={closeButtonStyle}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#e5e7eb';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f3f4f6';
                  }}
                >
                  <PixelCloseIcon />
                </button>
              </div>

              {/* 举报原因选择 */}
              <div style={{ padding: '0 0 16px 0' }}>
                <div style={{ ...spacingYStyle(12) }}>
                  <div>
                    <span style={{
                      ...labelStyle,
                      marginBottom: '6px' // 减少标签底部间距
                    }}>
                      选择举报原因<span style={labelRequiredStyle}> *</span>
                    </span>
                  </div>
                  <div style={{
                    maxHeight: '180px', // 减少最大高度
                    overflowY: 'auto'
                  }}>
                    {REPORT_REASONS.map((reason) => (
                      <label
                        key={reason.id}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '10px', // 减少图标和文字间距
                          cursor: 'pointer',
                          padding: '12px', // 减少内边距
                          borderRadius: '8px', // 稍微减少圆角
                          transition: 'all 0.2s ease',
                          backgroundColor: selectedReportReason === reason.id ? '#eff6ff' : '#f9fafb',
                          border: selectedReportReason === reason.id ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                          marginBottom: '8px' // 减少选项间距
                        }}
                        onMouseEnter={(e) => {
                          if (selectedReportReason !== reason.id) {
                            (e.currentTarget as HTMLLabelElement).style.backgroundColor = '#f3f4f6';
                            (e.currentTarget as HTMLLabelElement).style.borderColor = '#d1d5db';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (selectedReportReason !== reason.id) {
                            (e.currentTarget as HTMLLabelElement).style.backgroundColor = '#f9fafb';
                            (e.currentTarget as HTMLLabelElement).style.borderColor = '#e5e7eb';
                          }
                        }}
                      >
                        <input
                          type="radio"
                          name="reportReason"
                          value={reason.id}
                          checked={selectedReportReason === reason.id}
                          onChange={(e) => {
                            setSelectedReportReason(e.target.value);
                          }}
                          style={{
                            marginTop: '1px',
                            width: '16px', // 稍微减小尺寸
                            height: '16px',
                            color: COLORS.blue,
                            border: '2px solid #d1d5db',
                            cursor: 'pointer',
                            accentColor: COLORS.blue
                          }}
                        />
                        <div style={{ flex: 1 }}>
                          <p style={{
                            fontWeight: 600,
                            color: '#1f2937',
                            margin: '0 0 2px 0', // 减少标题底部间距
                            fontSize: '14px' // 稍微减小字体
                          }}>{reason.title}</p>
                          <p style={{
                            fontSize: '13px', // 稍微减小描述字体
                            color: '#6b7280',
                            margin: 0,
                            lineHeight: '1.3' // 稍微紧凑的行高
                          }}>{reason.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 详细说明 */}
                <div style={{ ...spacingYStyle(12) }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '6px'
                  }}>
                    <span style={{
                      ...labelStyle,
                      marginBottom: '0' // 移除额外边距
                    }}>
                      详细说明<span style={labelRequiredStyle}> *</span>
                    </span>
                    <span style={{
                      fontSize: '11px', // 稍微减小字体
                      color: '#6b7280',
                      fontFamily: 'monospace'
                    }}>
                      {reportContext.length}/500
                    </span>
                  </div>
                  <textarea
                    value={reportContext}
                    onChange={(e) => {
                      if (e.target.value.length <= 500) {
                        setReportContext(e.target.value);
                      }
                    }}
                    placeholder="请详细描述您遇到的情况，包括具体的时间、内容等..."
                    style={{
                      width: '100%',
                      padding: '10px', // 减少内边距
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px', // 稍微减小圆角
                      fontSize: '14px',
                      fontFamily: 'inherit',
                      resize: 'none',
                      transition: 'all 0.2s ease',
                      outline: 'none',
                      minHeight: '80px', // 减少最小高度
                      backgroundColor: '#fafafa'
                    }}
                    onFocus={(e) => {
                      (e.currentTarget as HTMLTextAreaElement).style.borderColor = COLORS.blue;
                      (e.currentTarget as HTMLTextAreaElement).style.backgroundColor = 'white';
                      (e.currentTarget as HTMLTextAreaElement).style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }}
                    onBlur={(e) => {
                      (e.currentTarget as HTMLTextAreaElement).style.borderColor = '#e5e7eb';
                      (e.currentTarget as HTMLTextAreaElement).style.backgroundColor = '#fafafa';
                      (e.currentTarget as HTMLTextAreaElement).style.boxShadow = 'none';
                    }}
                    rows={3} // 减少默认行数
                    maxLength={500}
                  />
                  <div style={{
                    ...warningPanelStyle,
                    marginTop: '8px', // 减少顶部间距
                    padding: '8px' // 减少内边距
                  }}>
                    <p style={{
                      fontSize: '12px', // 稍微减小字体
                      color: '#92400e',
                      margin: 0,
                      lineHeight: '1.3'
                    }}>
                      💡 请提供详细信息，帮助管理员理解问题。
                    </p>
                  </div>
                </div>
              </div>

              {/* 底部按钮 */}
              <div style={{
                display: 'flex',
                gap: '10px', // 稍微减少按钮间距
                padding: '16px', // 减少内边距
                borderTop: '1px solid #f3f4f6',
                backgroundColor: '#fafafa',
                margin: '0 -16px -16px -16px', // 调整负边距匹配新的padding
                borderRadius: '0 0 16px 16px'
              }}>
                <button
                  onClick={() => setShowReportModal(false)}
                  style={{
                    ...cancelButtonStyle,
                    padding: '10px 16px', // 减少按钮内边距
                    opacity: isSubmittingReport ? 0.6 : 1,
                    cursor: isSubmittingReport ? 'not-allowed' : 'pointer'
                  }}
                  disabled={isSubmittingReport}
                  onMouseEnter={(e) => {
                    if (!isSubmittingReport) {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f9fafb';
                      (e.currentTarget as HTMLButtonElement).style.borderColor = '#d1d5db';
                    }
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'white';
                  }}
                >
                  取消
                </button>
                <button
                  onClick={submitReport}
                  disabled={!selectedReportReason || !reportContext.trim() || isSubmittingReport}
                  style={{
                    ...primaryButtonBlueStyle,
                    padding: '10px 16px', // 减少按钮内边距
                    opacity: (!selectedReportReason || !reportContext.trim() || isSubmittingReport) ? 0.6 : 1,
                    cursor: (!selectedReportReason || !reportContext.trim() || isSubmittingReport) ? 'not-allowed' : 'pointer',
                    backgroundColor: (!selectedReportReason || !reportContext.trim() || isSubmittingReport) ? '#9ca3af' : COLORS.blue,
                  }}
                  onMouseEnter={(e) => {
                    if (!(!selectedReportReason || !reportContext.trim() || isSubmittingReport)) {
                      (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.02)';
                      (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 16px rgba(79, 70, 229, 0.3)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!(!selectedReportReason || !reportContext.trim() || isSubmittingReport)) {
                      (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                      (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(79, 70, 229, 0.2)';
                    }
                  }}
                >
                  {isSubmittingReport ? (
                    <div style={spinnerStyle}>
                      <div style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid transparent',
                        borderTop: '2px solid white',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }} />
                      提交中...
                    </div>
                  ) : (
                    <div style={spinnerStyle}>
                      <PixelReportFlagIcon />
                      提交举报
                    </div>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        </>
        )}
      </AnimatePresence>
    </>
  );
};

export default PixelInfoCard;
