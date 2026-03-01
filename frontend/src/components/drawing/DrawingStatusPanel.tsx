import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { logger } from '../../utils/logger';
import { TbGps } from "react-icons/tb";
import { GrInProgress } from "react-icons/gr";
import { PiClockUser } from "react-icons/pi";
import { Info, Lock } from "lucide-react";
import { useDrawingState } from '../../hooks/useDrawingState';
import { AuthService } from '../../services/auth';

interface DrawingStatusPanelProps {
  isVisible: boolean;
  isDrawing: boolean;
  session?: any; // 🆕 统一会话信息
  mode?: any; // 🆕 绘制模式
  pixelCount?: number; // 🆕 像素数量
  canDraw?: boolean; // 🆕 是否可以绘制
}

export default function DrawingStatusPanel({ isVisible, isDrawing }: DrawingStatusPanelProps) {
  const [showInfo, setShowInfo] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [freezeProgress, setFreezeProgress] = useState(100); // 冻结期进度条

  // 将压缩的像素数据转换为图片URL用于显示
  const convertPixelDataToImage = useCallback((pixelData: string) => {
    if (!pixelData || !pixelData.includes(",")) {
      return pixelData; // 如果不是压缩数据，直接返回
    }

    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return pixelData;

      const AVATAR_SIZE = 32;
      canvas.width = AVATAR_SIZE;
      canvas.height = AVATAR_SIZE;

      // 填充白色背景
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);

      // 解析像素数据并绘制
      const colorArray = pixelData.split(",");
      for (let y = 0; y < AVATAR_SIZE; y++) {
        for (let x = 0; x < AVATAR_SIZE; x++) {
          const index = y * AVATAR_SIZE + x;
          const color = colorArray[index] || "#FFFFFF";
          ctx.fillStyle = color;
          ctx.fillRect(x, y, 1, 1);
        }
      }

      return canvas.toDataURL("image/png");
    } catch (error) {
      logger.warn("⚠️ 像素数据转换失败:", error);
      return pixelData;
    }
  }, []);

  const {
    drawablePixels,
    isFrozen,
    freezeTimeLeft,
    totalPixels,
    isSyncing,
    lastSyncTime,
    startDrawing,
    stopDrawing,
    triggerSync,
    MAX_PIXELS
  } = useDrawingState();

  // 获取当前用户信息（强制刷新以获取最新的 total_pixels）
  const refreshUserInfo = useCallback(async () => {
    try {
      // 🔧 修复：使用 refreshCurrentUser() 强制从服务器获取最新数据
      const user = await AuthService.refreshCurrentUser();
      setCurrentUser(user);
      logger.debug('✅ 用户信息已刷新:', {
        userId: user?.id,
        total_pixels: user?.total_pixels
      });
    } catch (error) {
      logger.info('获取用户信息失败，可能是游客模式');
      setCurrentUser(null);
    }
  }, []);

  // 初始加载用户信息
  React.useEffect(() => {
    refreshUserInfo();
  }, [refreshUserInfo]);

  // 当信息面板显示时，立即同步一次状态并刷新用户信息
  useEffect(() => {
    if (showInfo && !isSyncing) {
      // 使用setTimeout避免在useEffect中直接调用
      const timer = setTimeout(() => {
        triggerSync();
        refreshUserInfo(); // 🔧 修复：刷新用户信息以获取最新 total_pixels
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [showInfo, isSyncing]); // 移除refreshUserInfo依赖，避免无限循环

  // 定期刷新用户信息（降低频率）
  useEffect(() => {
    if (showInfo && currentUser) {
      refreshUserInfo(); // 初始刷新

      const interval = setInterval(() => {
        refreshUserInfo(); // 定期刷新用户信息
      }, 120000); // 改为2分钟刷新一次，降低频率

      return () => clearInterval(interval);
    }
  }, [showInfo, currentUser]); // 移除refreshUserInfo依赖，避免无限循环

  // 冻结期进度条动画
  useEffect(() => {
    if (isFrozen && freezeTimeLeft > 0) {
      const interval = setInterval(() => {
        setFreezeProgress((freezeTimeLeft / 10) * 100); // 10秒冻结期
      }, 100);
      return () => clearInterval(interval);
    } else {
      setFreezeProgress(100);
    }
  }, [isFrozen, freezeTimeLeft]);

  // 同步绘制状态 - 使用useCallback优化性能
  const syncDrawingState = useCallback(() => {
    if (isDrawing) {
      startDrawing();
    } else {
      stopDrawing();
    }
  }, [isDrawing, startDrawing, stopDrawing]);

  React.useEffect(() => {
    syncDrawingState();
  }, [syncDrawingState]);

  // 切换信息显示状态
  const toggleInfo = useCallback(() => {
    setShowInfo(prev => !prev);
  }, []);

  // 格式化时间显示
  const formatTime = useCallback((seconds: number) => {
    return `${seconds}s`;
  }, []);

  // 计算进度条宽度 - 使用useMemo优化性能
  const progressWidth = useMemo(() => {
    const percentage = isFrozen ? 0 : Math.max(0, Math.min(100, (drawablePixels / MAX_PIXELS) * 100));
    return `${percentage}%`;
  }, [isFrozen, drawablePixels, MAX_PIXELS]);

  // 计算状态文本 - 使用useMemo优化性能
  const statusText = useMemo(() => {
    if (isFrozen) {
      return '冻结期';
    }
    // 根据实际绘制状态显示
    return isDrawing ? '绘制中' : '停止绘制';
  }, [isFrozen, isDrawing]);

  // 生成冻结期进度条
  const generateFreezeProgressBar = useCallback(() => {
    const totalBlocks = 10;
    const filledBlocks = Math.ceil((freezeProgress / 100) * totalBlocks);

    return Array.from({ length: totalBlocks }, (_, index) => (
      <div
        key={index}
        style={{
          height: '8px',
          borderRadius: '2px',
          transition: 'all 0.2s ease',
          width: '8px',
          marginRight: '2px',
          backgroundColor: index < filledBlocks ? '#EF4444' : '#D1D5DB'
        }}
      />
    ));
  }, [freezeProgress]);

  // 检查是否为游客用户
  const isGuest = !currentUser || AuthService.isGuest();

  if (!isVisible || isGuest) {
    return null;
  }

  return (
    <>
      {/* 左上角信息按钮 */}
      <div
        style={{
          position: 'fixed',
          top: '16px',
          left: '16px',
          zIndex: 1001
        }}
      >
        <button
          onClick={toggleInfo}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            border: 'none',
            outline: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            backgroundColor: showInfo ? '#4f46e5' : 'white',
            color: showInfo ? 'white' : '#6b7280',
            boxShadow: showInfo ? '0 8px 20px rgba(79,70,229,0.3)' : '0 4px 12px rgba(0,0,0,0.1)',
            padding: 0
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = showInfo
              ? '0 10px 25px rgba(79,70,229,0.4)'
              : '0 6px 16px rgba(0,0,0,0.15)';
            e.currentTarget.style.transform = 'scale(1.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = showInfo
              ? '0 8px 20px rgba(79,70,229,0.3)'
              : '0 4px 12px rgba(0,0,0,0.1)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <Info size={24} />
        </button>
      </div>

      {/* 绘制状态信息面板 */}
      {showInfo && (
        <div
          style={{
            position: 'fixed',
            top: '72px',
            left: '16px',
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
            border: '1px solid #e5e7eb',
            zIndex: 1001,
            minWidth: '180px',
            maxWidth: '300px',
            padding: '16px'
          }}
        >
          {/* 同步状态指示器 */}
          {isSyncing && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '12px',
                fontSize: '12px',
                color: '#4f46e5'
              }}
            >
              <div
                style={{
                  animation: 'spin 1s linear infinite',
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  borderWidth: '2px',
                  borderStyle: 'solid',
                  borderColor: '#4f46e5 transparent #4f46e5 transparent',
                  marginRight: '8px'
                }}
              ></div>
              同步中...
            </div>
          )}
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            @keyframes flipHourglass {
              0% { transform: scaleY(1); }
              35% { transform: scaleY(1); }
              50% { transform: scaleY(-1); }
              65% { transform: scaleY(-1); }
              100% { transform: scaleY(1); }
            }
          `}</style>

          {/* 用户名 - 显示头像 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px'
            }}
          >
            {/* 用户头像 */}
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'linear-gradient(to bottom right, #3b82f6, #a855f7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '14px',
                fontWeight: 'bold',
                overflow: 'hidden',
                flexShrink: 0,
                boxShadow: '0 2px 4px rgba(59,130,246,0.2)'
              }}
            >
              {currentUser?.avatar ? (
                <img
                  src={convertPixelDataToImage(currentUser.avatar)}
                  alt="头像"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: '50%'
                  }}
                  onError={(e) => {
                    // 如果图片加载失败，隐藏图片显示首字母
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : null}
              {!currentUser?.avatar && currentUser?.username?.charAt(0).toUpperCase()}
            </div>
            <span
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: '#111827'
              }}
            >
              {currentUser?.username || '用户'}
            </span>
          </div>

          {/* 绘制状态 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px'
            }}
          >
            {isFrozen ? (
              <>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    background: 'linear-gradient(to bottom right, #EF4444, #DC2626)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    flexShrink: 0
                  }}
                >
                  <PiClockUser size={14} style={{ color: 'white' }} />
                </div>
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#111827'
                  }}
                >
                  状态：冻结期
                </span>
              </>
            ) : (
              <>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    background: isDrawing
                      ? 'linear-gradient(to bottom right, #16a34a, #15803d)'
                      : 'linear-gradient(to bottom right, #d1d5db, #9ca3af)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    flexShrink: 0
                  }}
                >
                  <TbGps size={14} style={{ color: 'white' }} />
                </div>
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#111827'
                  }}
                >
                  状态：{statusText}
                </span>
              </>
            )}
          </div>
          
          {/* 当前进度 */}
          <div
            style={{
              marginBottom: '12px'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#111827'
                }}
              >
                <GrInProgress
                  size={14}
                  style={{
                    color: isDrawing ? '#16a34a' : '#6b7280',
                    animation: isDrawing ? 'flipHourglass 2.4s ease-in-out infinite' : 'none',
                    transition: 'color 0.3s ease'
                  }}
                />
                当前进度：
              </div>
              <span
                style={{
                  fontSize: '16px',
                  fontWeight: 700,
                  color: isFrozen ? '#DC2626' : '#4f46e5'
                }}
              >
                {isFrozen ? `0 / ${MAX_PIXELS}` : `${Math.max(0, drawablePixels)} / ${MAX_PIXELS}`}
              </span>
            </div>

            {/* 进度条 */}
            <div
              style={{
                width: '100%',
                backgroundColor: '#e5e7eb',
                borderRadius: '12px',
                height: '12px',
                overflow: 'hidden',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)'
              }}
            >
              <div
                style={{
                  height: '100%',
                  borderRadius: '12px',
                  transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                  width: progressWidth,
                  background: isFrozen
                    ? 'linear-gradient(to right, #EF4444, #DC2626)'
                    : 'linear-gradient(to right, #4f46e5, #7c3aed)'
                }}
              ></div>
            </div>
          </div>

          {/* 冻结期倒计时 */}
          {isFrozen && (
            <div
              style={{
                marginBottom: '12px',
                padding: '12px',
                background: 'linear-gradient(to right, #FEE2E2, #FECACA)',
                borderRadius: '12px',
                border: '1px solid #FCA5A5'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '8px'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#991B1B'
                  }}
                >
                  <Lock size={14} />
                  冻结期：
                </div>
                <span
                  style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    color: '#DC2626'
                  }}
                >
                  {formatTime(freezeTimeLeft)}
                </span>
              </div>

              {/* 冻结期进度条 */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px'
                }}
              >
                {generateFreezeProgressBar()}
              </div>
            </div>
          )}
          
          {/* 总绘制统计 - 从用户 total_pixels 字段获取 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '12px',
              borderTop: '1px solid #e5e7eb'
            }}
          >
            <span
              style={{
                fontSize: '13px',
                fontWeight: 500,
                color: '#6b7280'
              }}
            >
              总绘制像素
            </span>
            <span
              style={{
                fontSize: '16px',
                fontWeight: 700,
                color: '#111827'
              }}
            >
              {Math.max(0, currentUser?.total_pixels || 0)}
            </span>
          </div>

          {/* 最后同步时间 */}
          <div
            style={{
              fontSize: '12px',
              color: '#9ca3af',
              marginTop: '8px',
              textAlign: 'center'
            }}
          >
            最后同步: {new Date(lastSyncTime).toLocaleTimeString()}
          </div>

          {/* 调试信息 - 开发环境显示 */}
          {process.env.NODE_ENV === 'development' && (
            <div
              style={{
                fontSize: '12px',
                color: '#d1d5db',
                marginTop: '8px',
                textAlign: 'center',
                borderTop: '1px solid #e5e7eb',
                paddingTop: '8px'
              }}
            >
              <div>调试: drawablePixels={drawablePixels}</div>
              <div>调试: totalPixels={totalPixels}</div>
              <div>调试: isDrawing={isDrawing.toString()}</div>
              <div>调试: isFrozen={isFrozen.toString()}</div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
