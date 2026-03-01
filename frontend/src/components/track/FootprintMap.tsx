import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin,
  Navigation,
  QrCode,
  Share2,
  Download,
  Users,
  Clock,
  Ruler,
  Grid3X3,
  Maximize2,
  Settings,
  User,
  Calendar,
  ChevronRight,
  Flag,
  PlayCircle,
  Eye
} from 'lucide-react';
import QRCodeGenerator from '../ui/QRCodeGenerator';
import { type TrackStatistics, type TrackPoint } from '../../utils/trackCalculator';
import FootprintService from '../../services/footprintService';
import { logger } from '../../utils/logger';
import { toast } from '../../services/toast';
import { soundService } from '../../services/soundService';

interface FootprintMapProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  sessionData?: any;
  userData?: {
    name: string;
    avatar?: string;
    alliance?: {
      name: string;
      flag?: string;
    };
  };
}

export default function FootprintMap({ isOpen, onClose, sessionId, sessionData, userData }: FootprintMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [trackStatistics, setTrackStatistics] = useState<TrackStatistics | null>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [showQRCode, setShowQRCode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showPlayback, setShowPlayback] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);

  // 模拟用户数据
  const userInfo = userData || {
    name: 'ginochow',
    avatar: '/default-avatar.png',
    alliance: {
      name: '月形联盟',
      flag: '🏁'
    }
  };

  useEffect(() => {
    if (isOpen && sessionId) {
      loadTrackData();
    }
  }, [isOpen, sessionId]);

  useEffect(() => {
    if (mapInstance && trackStatistics) {
      drawTrackOnMap();
    }
  }, [mapInstance, trackStatistics, currentFrame]);

  const loadTrackData = async () => {
    setIsLoading(true);
    try {
      logger.info('🗺️ 加载足迹图数据:', sessionId);

      // 从后端API获取真实的会话轨迹统计
      const statistics = await FootprintService.getFootprintData(sessionId);

      setTrackStatistics(statistics);
      initializeMap(statistics);

      logger.info('✅ 足迹图数据加载完成');
    } catch (error) {
      logger.error('❌ 加载足迹图数据失败:', error);
      toast.error('加载足迹图失败');
    } finally {
      setIsLoading(false);
    }
  };

  const initializeMap = async (statistics: TrackStatistics) => {
    try {
      // 动态加载高德地图API
      if (!(window as any).AMap) {
        await loadAMapScript();
      }

      const AMap = (window as any).AMap;
      if (!mapContainerRef.current) return;

      const map = new AMap.Map(mapContainerRef.current, {
        center: [statistics.startPoint?.longitude || 113.324520, statistics.startPoint?.latitude || 23.109722],
        zoom: 12,
        zooms: [3, 18],
        mapStyle: 'amap://styles/normal',
        viewMode: '2D',
        resizeEnable: true,
        dragEnable: true,
        zoomEnable: true,
        doubleClickZoom: false
      });

      setMapInstance(map);
    } catch (error) {
      logger.error('❌ 初始化地图失败:', error);
    }
  };

  const loadAMapScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if ((window as any).AMap) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://webapi.amap.com/maps?v=2.0&key=0aca7174681d53a1a41441a433e1cbab& WebGLParams=false';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('高德地图API加载失败'));
      document.head.appendChild(script);
    });
  };

  const drawTrackOnMap = useCallback(() => {
    if (!mapInstance || !trackStatistics) return;

    // 清除之前的轨迹
    mapInstance.clearMap();

    const trackPoints = trackStatistics.trackPoints;

    // 转换轨迹点坐标
    const path = trackPoints.map(point => [point.longitude, point.latitude]);

    // 绘制轨迹线
    const polyline = new (window as any).AMap.Polyline({
      path: path,
      strokeColor: '#3b82f6',
      strokeWeight: 6,
      strokeStyle: 'solid',
      strokeOpacity: 0.8,
      lineJoin: 'round',
      lineCap: 'round'
    });

    mapInstance.add(polyline);

    // 绘制起点标记
    if (trackStatistics.startPoint) {
      const startMarker = new (window as any).AMap.Marker({
        position: [trackStatistics.startPoint.longitude, trackStatistics.startPoint.latitude],
        offset: new (window as any).AMap.Pixel(-15, -15),
        content: createStartMarker()
      });
      mapInstance.add(startMarker);
    }

    // 绘制终点标记
    if (trackStatistics.endPoint) {
      const endMarker = new (window as any).AMap.Marker({
        position: [trackStatistics.endPoint.longitude, trackStatistics.endPoint.latitude],
        offset: new (window as any).AMap.Pixel(-15, -15),
        content: createEndMarker()
      });
      mapInstance.add(endMarker);
    }

    // 自适应地图视野
    mapInstance.setFitView([polyline]);

  }, [mapInstance, trackStatistics, currentFrame]);

  const createStartMarker = (): HTMLElement => {
    const marker = document.createElement('div');
    marker.style.cssText = `
      width: 30px;
      height: 30px;
      background: #10b981;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 12px;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    `;
    marker.textContent = '起';
    return marker;
  };

  const createEndMarker = (): HTMLElement => {
    const marker = document.createElement('div');
    marker.style.cssText = `
      width: 30px;
      height: 30px;
      background: linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000),
                  linear-gradient(45deg, #000 25%, #fff 25%, #fff 75%, #000 75%, #000);
      background-size: 10px 10px;
      background-position: 0 0, 5px 5px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    `;
    return marker;
  };

  const handleDownload = () => {
    if (!mapInstance) return;

    // 使用地图截图功能
    mapInstance.getStatus((status: any) => {
      logger.info('地图状态:', status);
      toast.info('截图功能开发中...');
    });
  };

  const handleShare = () => {
    FootprintService.copyShareUrl(sessionId).then(success => {
      if (success) {
        toast.success('分享链接已复制');
      } else {
        toast.error('复制链接失败');
      }
    });
  };

  const handleGenerateQRCode = () => {
    setShowQRCode(true);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('zh-CN').replace(/\//g, '.') + ' ' +
           date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px'
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            style={{
              backgroundColor: 'white',
              borderRadius: '20px',
              width: '100%',
              maxWidth: isFullscreen ? '95vw' : '1200px',
              height: isFullscreen ? '90vh' : '80vh',
              maxHeight: '800px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 用户信息头部 */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <User size={20} />
                </div>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{userInfo.name}</div>
                  <div style={{ fontSize: '12px', opacity: 0.9 }}>
                    {formatDate(Date.now())}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 12px',
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  borderRadius: '20px',
                  fontSize: '12px'
                }}>
                  <Grid3X3 size={16} />
                  有趣的像素
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 12px',
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  borderRadius: '20px',
                  fontSize: '12px'
                }}>
                  <Navigation size={16} />
                  足迹
                </div>
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  style={{
                    padding: '6px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    color: 'white',
                    cursor: 'pointer'
                  }}
                >
                  <Maximize2 size={18} />
                </button>
              </div>
            </div>

            {/* 主要内容区域 */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* 地图容器 */}
              <div
                ref={mapContainerRef}
                style={{
                  flex: 1,
                  position: 'relative',
                  backgroundColor: '#f0f4f8'
                }}
              >
                {isLoading && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(255,255,255,0.9)'
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        width: '48px',
                        height: '48px',
                        border: '4px solid #e5e7eb',
                        borderTop: '4px solid #667eea',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto 16px'
                      }} />
                      <p style={{ color: '#6b7280', margin: 0 }}>加载足迹图中...</p>
                    </div>
                  </div>
                )}
              </div>

              {/* 统计信息面板 */}
              {trackStatistics && (
                <div style={{
                  padding: '20px',
                  borderTop: '1px solid #e5e7eb',
                  backgroundColor: '#f8fafc'
                }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: '16px',
                    marginBottom: '16px'
                  }}>
                    <div style={{
                      backgroundColor: 'white',
                      padding: '16px',
                      borderRadius: '12px',
                      textAlign: 'center',
                      border: '1px solid #e5e7eb'
                    }}>
                      <Ruler style={{ color: '#3b82f6', margin: '0 auto 8px' }} size={24} />
                      <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937' }}>
                        {trackStatistics.formattedDistance}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>行驶距离</div>
                    </div>

                    <div style={{
                      backgroundColor: 'white',
                      padding: '16px',
                      borderRadius: '12px',
                      textAlign: 'center',
                      border: '1px solid #e5e7eb'
                    }}>
                      <Clock style={{ color: '#10b981', margin: '0 auto 8px' }} size={24} />
                      <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937' }}>
                        {trackStatistics.formattedDuration}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>绘制时长</div>
                    </div>

                    <div style={{
                      backgroundColor: 'white',
                      padding: '16px',
                      borderRadius: '12px',
                      textAlign: 'center',
                      border: '1px solid #e5e7eb'
                    }}>
                      <Grid3X3 style={{ color: '#f59e0b', margin: '0 auto 8px' }} size={24} />
                      <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937' }}>
                        {trackStatistics.pixelCount}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>绘制格子数</div>
                    </div>

                    <div style={{
                      backgroundColor: 'white',
                      padding: '16px',
                      borderRadius: '12px',
                      textAlign: 'center',
                      border: '1px solid #e5e7eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}>
                      <span style={{ fontSize: '24px' }}>{userInfo.alliance?.flag || '🏁'}</span>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1f2937' }}>
                          {userInfo.alliance?.name || '无联盟'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>所属联盟</div>
                      </div>
                    </div>
                  </div>

                  {/* 路线详情 */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px',
                    padding: '12px 16px',
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    border: '1px solid #e5e7eb'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <MapPin style={{ color: '#10b981' }} size={20} />
                      <div>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>起点</div>
                        <div style={{ fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>
                          {trackStatistics.startPoint?.address ||
                           `${trackStatistics.startPoint?.latitude.toFixed(6)}, ${trackStatistics.startPoint?.longitude.toFixed(6)}`}
                        </div>
                      </div>
                    </div>
                    <ChevronRight style={{ color: '#9ca3af' }} size={20} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Flag style={{ color: '#ef4444' }} size={20} />
                      <div>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>终点</div>
                        <div style={{ fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>
                          {trackStatistics.endPoint?.address ||
                           `${trackStatistics.endPoint?.latitude.toFixed(6)}, ${trackStatistics.endPoint?.longitude.toFixed(6)}`}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <div style={{
                      fontSize: '14px',
                      color: '#6b7280',
                      fontStyle: 'italic',
                      flex: 1
                    }}>
                      快点来，一起用脚步为世界绘制更多图案吧~
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={handleGenerateQRCode}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '12px',
                          border: 'none',
                          backgroundColor: '#8b5cf6',
                          color: 'white',
                          fontSize: '14px',
                          fontWeight: '500',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#7c3aed';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#8b5cf6';
                        }}
                      >
                        <QrCode size={16} />
                        二维码
                      </button>

                      <button
                        onClick={handleShare}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '12px',
                          border: 'none',
                          backgroundColor: '#3b82f6',
                          color: 'white',
                          fontSize: '14px',
                          fontWeight: '500',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#2563eb';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#3b82f6';
                        }}
                      >
                        <Share2 size={16} />
                        分享
                      </button>

                      <button
                        onClick={handleDownload}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '12px',
                          border: 'none',
                          backgroundColor: '#10b981',
                          color: 'white',
                          fontSize: '14px',
                          fontWeight: '500',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#059669';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#10b981';
                        }}
                      >
                        <Download size={16} />
                        下载
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 二维码弹窗 */}
            <AnimatePresence>
              {showQRCode && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1100,
                    padding: '20px'
                  }}
                  onClick={() => setShowQRCode(false)}
                >
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    style={{
                      backgroundColor: 'white',
                      padding: '24px',
                      borderRadius: '16px',
                      textAlign: 'center',
                      maxWidth: '320px'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 'bold', color: '#1f2937' }}>
                      扫码查看足迹详情
                    </h3>
                    <QRCodeGenerator
                      value={FootprintService.generateShareUrl(sessionId)}
                      size={200}
                      title="FunnyPixels 足迹分享"
                      logoUrl="/favicon.ico"
                    />
                    <p style={{ margin: '16px 0 0 0', fontSize: '12px', color: '#6b7280', lineHeight: '1.4' }}>
                      快来加入FunnyPixels，一起用脚步为世界绘制更多图案吧~
                    </p>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}