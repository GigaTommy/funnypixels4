import React, { useState, useEffect, useRef } from 'react';
import { logger } from '../../utils/logger';
import { GoZoomIn, GoZoomOut } from "react-icons/go";
import { FaFly } from "react-icons/fa";
import { GiPositionMarker } from "react-icons/gi";
import { GrRun } from "react-icons/gr";
import { BsPersonStanding } from "react-icons/bs";
import { MdHelpOutline } from "react-icons/md"; // 添加画笔图标
import { FaVial } from "react-icons/fa"; // GPS测试图标
import { FaBug } from "react-icons/fa"; // WebGL调试图标
import { BaggageClaim } from "lucide-react"; // 百宝箱图标
import { useDrawingState } from '../../hooks/useDrawingState';
import { AuthService } from '../../services/auth';
import { AllianceAPI } from '../../services/alliance';
import ShareService, { ShareSessionData } from '../../services/shareService';
import { enhancedGpsService } from '../../services/enhancedGpsService';
import { sessionDataManager, SessionData } from '../../services/sessionDataManager';
// 🆕 导入统一绘制管理系统
import { useDrawing } from '../../contexts/DrawingContext';
import { unifiedSessionManager } from '../../services/unifiedSessionManager';

import { replaceAlert } from '../../utils/toastHelper';
import { BackpackPanel } from '../map/BackpackPanel';
import { t } from '../../i18n';


interface MapControlsProps {
  onLocate: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRoam: () => void;
  onOpenQuickStart: () => void;
  onToggleAuto: () => void;
  onToggleManual: () => void; // 添加手动绘制切换回调
  isAutoMode: boolean;
  isManualMode: boolean; // 添加手动绘制模式状态
  isLoading?: boolean; // 🆕 统一绘制系统加载状态
  currentSession?: any; // 🆕 当前会话信息
  canDraw?: boolean; // 🆕 是否可以绘制
  isLocating: boolean;
  isRoaming: boolean;
  showQuickStartHint?: boolean;
}

export default function MapControls({
  onLocate,
  onZoomIn,
  onZoomOut,
  onRoam,
  onOpenQuickStart,
  onToggleAuto,
  isAutoMode,
  isLoading,
  currentSession,
  canDraw,
  isLocating,
  isRoaming,
  showQuickStartHint = false,
}: MapControlsProps) {

  // 🔌 使用统一绘制系统
  const drawing = useDrawing();
  const { actions: drawingActions, getters: drawingGetters } = drawing;

  // 分享相关状态
  const [showShareModal, setShowShareModal] = useState(false);
  const [sessionData, setSessionData] = useState<ShareSessionData | null>(null);
  const sessionStartTimeRef = useRef<number>(Date.now());
  const sessionStartUserTotalPixelsRef = useRef<number>(0); // 会话开始时用户历史总绘制像素数

  // 百宝箱相关状态
  const [showBackpack, setShowBackpack] = useState(false);
  const [newItemCount, setNewItemCount] = useState(0);

  
  // GPS测试相关状态（仅开发环境）
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [selectedTestRoute, setSelectedTestRoute] = useState('cityWalk');
  const [isTestRunning, setIsTestRunning] = useState(false);

  // WebGL调试相关状态（仅开发环境）
  
  // 自由测试相关状态
  const [showCustomTestPanel, setShowCustomTestPanel] = useState(false);
  const [isSelectingStartPoint, setIsSelectingStartPoint] = useState(false);
  const [isSelectingEndPoint, setIsSelectingEndPoint] = useState(false);
  const [customStartPoint, setCustomStartPoint] = useState<{lat: number, lng: number} | null>(null);
  const [customEndPoint, setCustomEndPoint] = useState<{lat: number, lng: number} | null>(null);
  const [customStartInput, setCustomStartInput] = useState('');
  const [customEndInput, setCustomEndInput] = useState('');



  // 绘制状态管理 - 仅用于会话统计
  const {
    totalPixels,
    startDrawing,
    stopDrawing
  } = useDrawingState();

  // 同步绘制状态 - 仅在isAutoMode变化时触发
  const prevIsAutoModeRef = useRef(isAutoMode);
  React.useEffect(() => {
    // 只有当auto mode真正改变时才执行
    if (prevIsAutoModeRef.current !== isAutoMode) {
      if (isAutoMode) {
        startDrawing();
        sessionStartTimeRef.current = Date.now();
        // 异步获取最新的用户历史总绘制像素数（强制刷新）
        const fetchAndUpdateStartPixels = async () => {
          try {
            // 🔧 修复：强制绕过缓存，直接从服务器获取最新数据
            const currentUser = await AuthService.forceRefreshCurrentUser();
            if (currentUser) {
              sessionStartUserTotalPixelsRef.current = currentUser.total_pixels || 0;
              logger.info('🎯 GPS绘图开始 - 获取用户历史总绘制像素数:', {
                userTotalPixels: currentUser.total_pixels,
                sessionStartUserTotalPixels: sessionStartUserTotalPixelsRef.current,
                currentDrawablePixels: totalPixels
              });
            }
          } catch (error) {
            logger.error('获取用户历史总绘制像素数失败:', error);
            sessionStartUserTotalPixelsRef.current = 0;
          }
        };
        fetchAndUpdateStartPixels();
      } else {
        stopDrawing();
      }
      prevIsAutoModeRef.current = isAutoMode;
    }
  }, [isAutoMode, startDrawing, stopDrawing]);

  // 处理GPS绘图切换，使用真实session数据进行分享
  const handleToggleAuto = async () => {
    if (isAutoMode) {
      // 停止GPS绘图时，基于真实session数据生成战果图
      try {
        const user = await AuthService.getCurrentUser();
        if (!user) {
          onToggleAuto();
          return;
        }

        // 获取或创建当前session
        let currentSession = sessionDataManager.getCurrentSession();

        if (!currentSession) {
          // 🔧 尝试获取最后结束的session数据
          const lastSession = sessionDataManager.getLastEndedSession();
          if (lastSession) {
            logger.info('ℹ️ 使用最后结束的session数据进行分享');
            currentSession = lastSession;
          } else {
            logger.info('ℹ️ GPS测试已结束，没有可用session，跳过分享功能');
            onToggleAuto();
            return;
          }
        }

        let finalSessionData: SessionData | null = null;

        if (sessionDataManager.getCurrentSession()) {
          // 🔧 对于活跃的session，先更新地图数据，然后结束session
          const map = (window as any).mapInstance;
          if (map) {
            const center = map.getCenter();
            const zoom = map.getZoom();
            const bounds = map.getBounds();
            const sw = bounds.getSouthWest();
            const ne = bounds.getNorthEast();

            // 先更新地图数据
            sessionDataManager.updateMapData({
              center: { lat: center.lat, lng: center.lng },
              zoom: zoom,
              bounds: {
                north: ne.lat,
                south: sw.lat,
                east: ne.lng,
                west: sw.lng
              }
            });

            logger.info('🗺️ GPS停止时地图数据已更新');
          } else {
            logger.warn('⚠️ 无法获取地图实例，地图数据未更新');
          }

          // 结束session并获取最终数据
          logger.info('🔄 开始结束GPS绘制session');
          finalSessionData = sessionDataManager.endSession();
        } else {
          // 🔧 使用已有的session数据（来自getLastEndedSession）
          logger.info('📋 使用已有的session数据进行分享');
          finalSessionData = currentSession;
        }

        if (!finalSessionData) {
          logger.error('❌ 无法获取最终session数据');
          onToggleAuto();
          return;
        }

        // 构建足迹分享数据 - 完全基于真实session数据
        const shareData: ShareSessionData = {
          userId: finalSessionData.userId,
          username: finalSessionData.username,
          displayName: finalSessionData.displayName,
          avatar: finalSessionData.avatar,
          alliance: finalSessionData.alliance,
          stats: {
            totalPixels: finalSessionData.stats.sessionEndPixels,  // 使用session结束时的真实总像素数
            sessionPixels: finalSessionData.stats.sessionPixels,    // 使用真实的session像素数
            drawTime: finalSessionData.stats.drawTime              // 使用真实的绘制时长
          },
          mapData: finalSessionData.mapData,
          // 使用真实的轨迹数据和绘制记录
          trackPoints: finalSessionData.trackPoints.length > 0 ? finalSessionData.trackPoints : undefined,
          drawRecords: finalSessionData.drawRecords.length > 0 ? finalSessionData.drawRecords : undefined,
          sessionId: finalSessionData.sessionId,
          timestamp: new Date(finalSessionData.createdAt).toISOString(),
          sessionStart: new Date(finalSessionData.stats.drawStartTime).toISOString(),
          sessionEnd: new Date(finalSessionData.stats.drawEndTime).toISOString()
        };

        logger.info('📦 基于真实session数据的shareData:', {
          sessionId: shareData.sessionId,
          sessionPixels: shareData.stats.sessionPixels,
          totalPixels: shareData.stats.totalPixels,
          drawTime: shareData.stats.drawTime,
          trackPointsCount: shareData.trackPoints?.length || 0,
          drawRecordsCount: shareData.drawRecords?.length || 0,
          hasRealData: shareData.stats.sessionPixels > 0
        });

        setSessionData(shareData);
        setShowShareModal(true);
      } catch (error) {
        logger.error('准备分享数据失败:', error);
      }
    }

    // 调用原有的切换逻辑
    onToggleAuto();
  };

  // 检查是否为游客
  const isGuest = AuthService.isGuest();

  // GPS测试路线信息
  const testRoutes = [
    { id: 'cityWalk', name: '城市漫游测试', duration: '1分40秒' },
    { id: 'gridBoundary', name: '网格边界测试', duration: '40秒' },
    { id: 'accuracyTest', name: '精度变化测试', duration: '1分30秒' },
    { id: 'longDistance', name: '长距离测试（广州→北京）', duration: '约20分钟（17万格子）' },
    { id: 'highSpeed', name: '高速移动测试', duration: '50秒' },
    { id: 'guangzhouMetro', name: '广州地铁5号线测试（大学城南站→海傍站）', duration: '约2-3分钟' },
    { id: 'customRoute', name: '🎯 自由测试（自定义路线）', duration: '自定义' }
  ];

  // 处理GPS测试开始
  const handleStartTest = async () => {
    try {
      // 如果是自由测试，需要验证起点和终点
      if (selectedTestRoute === 'customRoute') {
        if (!customStartPoint || !customEndPoint) {
          replaceAlert.error('请先设置起点和终点坐标！');
          return;
        }
        // 保存自定义路线坐标
        localStorage.setItem('gps_custom_start', JSON.stringify(customStartPoint));
        localStorage.setItem('gps_custom_end', JSON.stringify(customEndPoint));
        setShowCustomTestPanel(false);
      }

      // 🆕 使用统一会话管理器创建GPS测试会话
      logger.info('🎯 GPS测试开始，使用统一会话管理器...');
      const sessionName = `GPS测试-${testRoutes.find(r => r.id === selectedTestRoute)?.name}`;

      try {
        // 使用统一会话管理器启动GPS测试模式
        const sessionResult = await drawingActions.switchToTestMode();

        if (sessionResult) {
          logger.info('✅ GPS测试模式启动成功:', {
            sessionId: drawingGetters.hasActiveSession,
            sessionName: sessionName
          });
        } else {
          logger.warn('⚠️ GPS测试模式启动失败');
        }
      } catch (sessionError) {
        logger.error('❌ GPS测试模式启动异常:', sessionError);
        // 会话创建失败不阻止GPS测试
      }

      // 保存测试路线到localStorage
      localStorage.setItem('gps_test_route', selectedTestRoute);
      localStorage.setItem('gps_simulation_enabled', 'true');

      setIsTestRunning(true);

      // 如果未开启GPS绘图，自动开启
      if (!isAutoMode) {
        handleToggleAuto();
      }

      logger.info(`🧪 启动GPS测试: ${testRoutes.find(r => r.id === selectedTestRoute)?.name}`);

    } catch (error) {
      logger.error('❌ GPS测试启动失败:', error);
      replaceAlert.error('GPS测试启动失败，请重试');
    }
  };

  // 处理坐标输入解析
  const parseCoordinateInput = (input: string): {lat: number, lng: number} | null => {
    // 支持多种格式: "lat,lng" 或 "lat, lng" 或 "纬度 经度"
    const cleaned = input.trim().replace(/\s+/g, ',');
    const parts = cleaned.split(',');

    if (parts.length !== 2) {
      return null;
    }

    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);

    if (isNaN(lat) || isNaN(lng)) {
      return null;
    }

    // 验证坐标范围
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return null;
    }

    return { lat, lng };
  };

  // 处理起点输入
  const handleStartInputChange = (value: string) => {
    setCustomStartInput(value);
    const coords = parseCoordinateInput(value);
    if (coords) {
      setCustomStartPoint(coords);
    }
  };

  // 处理终点输入
  const handleEndInputChange = (value: string) => {
    setCustomEndInput(value);
    const coords = parseCoordinateInput(value);
    if (coords) {
      setCustomEndPoint(coords);
    }
  };

  // 处理地图点击选点
  useEffect(() => {
    if (!isSelectingStartPoint && !isSelectingEndPoint) {
      return;
    }

    const handleMapClick = (e: any) => {
      const lnglat = e.lnglat;
      const coords = { lat: lnglat.lat, lng: lnglat.lng };

      if (isSelectingStartPoint) {
        setCustomStartPoint(coords);
        setCustomStartInput(`${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`);
        setIsSelectingStartPoint(false);
        logger.info('已选择起点:', coords);
      } else if (isSelectingEndPoint) {
        setCustomEndPoint(coords);
        setCustomEndInput(`${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`);
        setIsSelectingEndPoint(false);
        logger.info('已选择终点:', coords);
      }
    };

    // 监听地图点击事件
    if (typeof window !== 'undefined' && (window as any).mapInstance) {
      const map = (window as any).mapInstance;
      map.on('click', handleMapClick);

      return () => {
        map.off('click', handleMapClick);
      };
    }
  }, [isSelectingStartPoint, isSelectingEndPoint]);

  // 处理GPS测试停止
  const handleStopTest = async () => {
    try {
      // 🆕 使用统一会话管理器结束绘制会话
      logger.info('🎯 GPS测试结束，使用统一会话管理器结束会话...');

      try {
        // 使用统一会话管理器切换到空闲模式
        const sessionResult = await drawingActions.switchToIdleMode();

        if (sessionResult) {
          logger.info('✅ GPS测试模式已成功结束');
        } else {
          logger.warn('⚠️ GPS测试模式结束失败');
        }
      } catch (sessionError) {
        logger.error('❌ GPS测试模式结束异常:', sessionError);
        // 会话结束失败不阻止GPS测试停止
      }

      // 清除localStorage标记
      localStorage.removeItem('gps_simulation_enabled');
      localStorage.removeItem('gps_test_route');
      localStorage.removeItem('gps_custom_start');
      localStorage.removeItem('gps_custom_end');

      // 显式停止GPS模拟器
      if (import.meta.env.DEV && typeof window !== 'undefined') {
        const gpsSimulator = (window as any).gpsSimulator;
        if (gpsSimulator && typeof gpsSimulator.stopSimulation === 'function') {
          gpsSimulator.stopSimulation();
          logger.info('🛑 GPS模拟器已显式停止');
        }
      }

      setIsTestRunning(false);

      // 停止GPS绘图
      if (isAutoMode) {
        handleToggleAuto();
      }

      logger.info('🛑 GPS测试已完全停止');

    } catch (error) {
      logger.error('❌ GPS测试停止失败:', error);
      // 即使失败也要更新UI状态
      setIsTestRunning(false);
    }
  };

  const controls = [
    // 调试按钮（仅开发环境）放在最顶部
    ...(import.meta.env.DEV ? [
      {
        id: 'gpsTest',
        icon: <FaVial size={20} />,
        onClick: () => setShowTestPanel(!showTestPanel),
        requiresAuth: false
      },
      ] : []),
    {
      id: 'backpack',
      icon: <BaggageClaim size={20} />,
      onClick: () => setShowBackpack(!showBackpack),
      badge: newItemCount > 0 ? newItemCount : undefined,
      requiresAuth: true
    },
    {
      id: 'help',
      icon: <MdHelpOutline size={22} />,
      onClick: onOpenQuickStart,
      requiresAuth: false,
      badge: showQuickStartHint ? 1 : undefined,
      title: t('controls_help')
    },
    {
      id: 'zoomIn',
      icon: <GoZoomIn size={20} />,
      onClick: onZoomIn,
      requiresAuth: false,
      title: t('controls_zoom_in')
    },
    {
      id: 'zoomOut',
      icon: <GoZoomOut size={20} />,
      onClick: onZoomOut,
      requiresAuth: false,
      title: t('controls_zoom_out')
    },
    {
      id: 'roam',
      icon: <FaFly size={20} />,
      onClick: onRoam,
      loading: isRoaming,
      requiresAuth: false,
      title: t('controls_roam')
    },
    {
      id: 'locate',
      icon: <GiPositionMarker size={20} />,
      onClick: onLocate,
      loading: isLocating,
      requiresAuth: false,
      title: t('controls_locate')
    },
    {
      id: 'auto',
      icon: isAutoMode ? <GrRun size={24} /> : <BsPersonStanding size={24} />,
      onClick: handleToggleAuto,
      requiresAuth: true,
      title: t('controls_gps')
    }
  ];

  // 为游客模式过滤控制项
  const filteredControls = isGuest 
    ? controls.filter(control => !control.requiresAuth)
    : controls;

  return (
    <>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {/* 右侧中间地图工具栏 */}
      <div
        style={{
          position: 'fixed',
          top: 'calc(50% - 100px)',
          right: '16px',
          zIndex: 310, // 🔥 优化：使用标准z-index规范，地图工具栏
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}
      >
        {filteredControls.map((control) => {
          // 确定按钮的颜色状态
          let backgroundColor = 'white';
          let color = '#6b7280';
          let boxShadow = '0 4px 12px rgba(0,0,0,0.1)';

          if (control.loading) {
            backgroundColor = '#f3f4f6';
            color = '#9ca3af';
          } else {
            // 自动模式按钮 - GPS绘制
            if (control.id === 'auto') {
              backgroundColor = isAutoMode ? '#EF4444' : '#16a34a';
              color = 'white';
              boxShadow = isAutoMode
                ? '0 6px 16px rgba(239,68,68,0.25)'
                : '0 4px 12px rgba(22,163,74,0.1)';
            }
            // 手动模式按钮
            else if (control.id === 'manual') {
              backgroundColor = isManualMode ? '#4f46e5' : '#6b7280';
              color = 'white';
              boxShadow = isManualMode
                ? '0 6px 16px rgba(79,70,229,0.25)'
                : '0 4px 12px rgba(0,0,0,0.1)';
            }
            // 其他按钮
            else {
              backgroundColor = 'white';
              color = '#6b7280';
            }
          }

          return (
            <div key={control.id} style={{ position: 'relative' }}>
              <button
                onClick={control.onClick}
                disabled={control.loading}
                title={(control as any).title}
                aria-label={(control as any).title || control.id}
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  border: 'none',
                  outline: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: control.loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  backgroundColor: backgroundColor,
                  color: color,
                  boxShadow: boxShadow,
                  padding: 0
                }}
                onMouseEnter={(e) => {
                  if (!control.loading) {
                    e.currentTarget.style.boxShadow =
                      control.id === 'auto' && isAutoMode
                        ? '0 8px 20px rgba(239,68,68,0.3)'
                        : control.id === 'auto' && !isAutoMode
                          ? '0 8px 20px rgba(22,163,74,0.3)'
                          : control.id === 'manual' && isManualMode
                            ? '0 8px 20px rgba(79,70,229,0.3)'
                            : '0 6px 16px rgba(0,0,0,0.15)';
                    e.currentTarget.style.transform = 'scale(1.08)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = boxShadow;
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                {control.loading ? (
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      border: '2px solid #d1d5db',
                      borderTop: '2px solid #4f46e5',
                      animation: 'spin 1s linear infinite'
                    }}
                  />
                ) : (
                  control.icon
                )}
              </button>
              {/* 红点徽章 */}
              {(control as any).badge && (control as any).badge > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    minWidth: '20px',
                    height: '20px',
                    backgroundColor: '#ef4444',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    padding: '0 6px',
                    boxShadow: '0 2px 8px rgba(239,68,68,0.4)',
                    border: '2px solid white'
                  }}
                >
                  {(control as any).badge > 99 ? '99+' : (control as any).badge}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* GPS测试面板（仅开发环境） */}
      {import.meta.env.DEV && showTestPanel && (
        <div
          style={{
            position: 'fixed',
            top: 'calc(50% - 80px)',
            right: '80px',
            zIndex: 300, // 🔥 优化：使用标准z-index规范，绘制工具栏
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
            border: '1px solid #e5e7eb',
            padding: '16px',
            minWidth: '280px'
          }}
        >
          <h3
            style={{
              fontSize: '14px',
              fontWeight: 600,
              marginBottom: '12px',
              color: '#111827'
            }}
          >
            GPS 测试工具
          </h3>

          {/* 路线选择 */}
          <div
            style={{
              marginBottom: '12px'
            }}
          >
            <label
              style={{
                fontSize: '12px',
                color: '#6b7280',
                marginBottom: '6px',
                display: 'block',
                fontWeight: 500
              }}
            >
              选择测试路线：
            </label>
            <select
              value={selectedTestRoute}
              onChange={(e) => setSelectedTestRoute(e.target.value)}
              disabled={isTestRunning}
              style={{
                width: '100%',
                fontSize: '12px',
                padding: '8px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                backgroundColor: isTestRunning ? '#f3f4f6' : 'white',
                color: '#111827',
                cursor: isTestRunning ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {testRoutes.map(route => (
                <option key={route.id} value={route.id}>
                  {route.name} ({route.duration})
                </option>
              ))}
            </select>
          </div>

          {/* 自定义路线配置 */}
          {selectedTestRoute === 'customRoute' && (
            <div
              style={{
                marginBottom: '12px',
                padding: '12px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                border: '1px solid #e5e7eb'
              }}
            >
              <div style={{ marginBottom: '8px', fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                自定义路线配置
              </div>

              {/* 起点设置 */}
              <div style={{ marginBottom: '8px' }}>
                <label style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                  起点坐标 (纬度, 经度):
                </label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <input
                    type="text"
                    value={customStartInput}
                    onChange={(e) => handleStartInputChange(e.target.value)}
                    placeholder="例: 23.13, 113.26"
                    disabled={isTestRunning}
                    style={{
                      flex: 1,
                      fontSize: '11px',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      backgroundColor: isTestRunning ? '#f3f4f6' : 'white'
                    }}
                  />
                  <button
                    onClick={() => setIsSelectingStartPoint(!isSelectingStartPoint)}
                    disabled={isTestRunning}
                    style={{
                      fontSize: '11px',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      backgroundColor: isSelectingStartPoint ? '#3b82f6' : '#6b7280',
                      color: 'white',
                      border: 'none',
                      cursor: isTestRunning ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {isSelectingStartPoint ? '点击地图' : '地图选点'}
                  </button>
                </div>
                {customStartPoint && (
                  <div style={{ fontSize: '10px', color: '#059669', marginTop: '2px' }}>
                    ✓ 已设置: {customStartPoint.lat.toFixed(6)}, {customStartPoint.lng.toFixed(6)}
                  </div>
                )}
              </div>

              {/* 终点设置 */}
              <div>
                <label style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                  终点坐标 (纬度, 经度):
                </label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <input
                    type="text"
                    value={customEndInput}
                    onChange={(e) => handleEndInputChange(e.target.value)}
                    placeholder="例: 23.14, 113.27"
                    disabled={isTestRunning}
                    style={{
                      flex: 1,
                      fontSize: '11px',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      backgroundColor: isTestRunning ? '#f3f4f6' : 'white'
                    }}
                  />
                  <button
                    onClick={() => setIsSelectingEndPoint(!isSelectingEndPoint)}
                    disabled={isTestRunning}
                    style={{
                      fontSize: '11px',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      backgroundColor: isSelectingEndPoint ? '#3b82f6' : '#6b7280',
                      color: 'white',
                      border: 'none',
                      cursor: isTestRunning ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {isSelectingEndPoint ? '点击地图' : '地图选点'}
                  </button>
                </div>
                {customEndPoint && (
                  <div style={{ fontSize: '10px', color: '#059669', marginTop: '2px' }}>
                    ✓ 已设置: {customEndPoint.lat.toFixed(6)}, {customEndPoint.lng.toFixed(6)}
                  </div>
                )}
              </div>

              {/* 提示信息 */}
              {(isSelectingStartPoint || isSelectingEndPoint) && (
                <div style={{
                  marginTop: '8px',
                  padding: '6px 8px',
                  backgroundColor: '#dbeafe',
                  borderRadius: '6px',
                  fontSize: '10px',
                  color: '#1e40af'
                }}>
                  💡 请在地图上点击选择{isSelectingStartPoint ? '起点' : '终点'}位置
                </div>
              )}
            </div>
          )}

          {/* 控制按钮 */}
          <div
            style={{
              display: 'flex',
              gap: '8px'
            }}
          >
            {!isTestRunning ? (
              <button
                onClick={handleStartTest}
                style={{
                  flex: 1,
                  fontSize: '12px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  backgroundColor: '#16a34a',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#15803d';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(22,163,74,0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#16a34a';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                启动
              </button>
            ) : (
              <button
                onClick={handleStopTest}
                style={{
                  flex: 1,
                  fontSize: '12px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  backgroundColor: '#EF4444',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#DC2626';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(239,68,68,0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#EF4444';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                停止
              </button>
            )}
            <button
              onClick={() => setShowTestPanel(false)}
              style={{
                fontSize: '12px',
                padding: '8px 12px',
                borderRadius: '8px',
                backgroundColor: '#f3f4f6',
                color: '#6b7280',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#e5e7eb';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#f3f4f6';
              }}
            >
              关闭
            </button>
          </div>

          {/* 说明文字 */}
          <div
            style={{
              marginTop: '12px',
              fontSize: '12px',
              color: '#6b7280',
              paddingTop: '12px',
              borderTop: '1px solid #e5e7eb'
            }}
          >
            {isTestRunning ? (
              <p
                style={{
                  color: '#16a34a',
                  margin: 0
                }}
              >
                运行中...查看控制台日志
              </p>
            ) : (
              <p style={{ margin: 0 }}>
                模拟GPS轨迹自动触发绘制
              </p>
            )}
          </div>
        </div>
      )}

      {/* 分享功能已重构为足迹系统，暂时移除旧模态框 */}

      {/* 百宝箱浮窗 */}
      {showBackpack && (
        <BackpackPanel
          onClose={() => setShowBackpack(false)}
          onNewItemCountChange={(count) => setNewItemCount(count)}
        />
      )}

    </>
  );
}
