import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin,
  Navigation,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Maximize2,
  Layers,
  Settings,
  X,
  Play,
  Pause,
  SkipForward,
  SkipBack
} from 'lucide-react';
import { logger } from '../utils/logger';
import { sessionHistoryService, type SessionHistoryItem } from '../services/sessionHistoryService';
import { soundService } from '../services/soundService';
import { toast } from '../services/toast';

interface TrackMapViewerProps {
  isOpen: boolean;
  onClose: () => void;
  sessionData: SessionHistoryItem;
}

interface TrackPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  pixelCount?: number;
}

interface MapStyle {
  name: string;
  url: string;
  attribution: string;
}

export default function TrackMapViewer({ isOpen, onClose, sessionData }: TrackMapViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [trackPoints, setTrackPoints] = useState<TrackPoint[]>([]);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1);
  const [showStats, setShowStats] = useState(true);
  const [mapStyle, setMapStyle] = useState(0);

  const mapStyles: MapStyle[] = [
    {
      name: '标准地图',
      url: 'https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8',
      attribution: '高德地图'
    },
    {
      name: '卫星地图',
      url: 'https://webst01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=6',
      attribution: '高德地图'
    },
    {
      name: '简洁地图',
      url: 'https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7',
      attribution: '高德地图'
    }
  ];

  useEffect(() => {
    if (isOpen) {
      loadTrackData();
    }
  }, [isOpen, sessionData]);

  useEffect(() => {
    if (isPlaying && trackPoints.length > 0) {
      const interval = setInterval(() => {
        setCurrentFrame((prev) => {
          if (prev >= trackPoints.length - 1) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 100 / playSpeed);

      return () => clearInterval(interval);
    }
  }, [isPlaying, trackPoints, playSpeed]);

  useEffect(() => {
    if (trackPoints.length > 0) {
      drawMap();
    }
  }, [trackPoints, zoom, offset, currentFrame, mapStyle]);

  const loadTrackData = async () => {
    setIsLoading(true);
    try {
      logger.info('📍 加载轨迹数据:', sessionData.id);

      // 从后端API获取真实的足迹数据
      const { default: FootprintService } = await import('../services/footprintService');
      const trackStatistics = await FootprintService.getFootprintData(sessionData.id);

      setTrackPoints(trackStatistics.trackPoints.map(point => ({
        latitude: point.latitude,
        longitude: point.longitude,
        timestamp: point.timestamp,
        pixelCount: trackStatistics.pixelCount
      })));

      logger.info(`✅ 加载了${trackStatistics.trackPoints.length}个轨迹点`);
    } catch (error) {
      logger.error('❌ 加载轨迹数据失败:', error);
      toast.error('加载轨迹数据失败');
    } finally {
      setIsLoading(false);
    }
  };


  const drawMap = () => {
    const canvas = canvasRef.current;
    if (!canvas || trackPoints.length === 0) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制背景
    ctx.fillStyle = '#f0f4f8';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 计算轨迹边界
    const bounds = calculateTrackBounds();
    const padding = 50;

    // 坐标转换函数
    const toCanvasCoords = (lat: number, lng: number) => {
      const x = ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) *
                (canvas.width - 2 * padding) + padding;
      const y = canvas.height - (((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) *
                (canvas.height - 2 * padding) + padding);
      return { x, y };
    };

    // 应用缩放和偏移
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-canvas.width / 2 + offset.x, -canvas.height / 2 + offset.y);

    // 绘制网格
    drawGrid(ctx, canvas.width, canvas.height, padding);

    // 绘制轨迹
    if (trackPoints.length > 1) {
      // 绘制已完成部分
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      for (let i = 0; i <= currentFrame && i < trackPoints.length; i++) {
        const point = trackPoints[i];
        const coords = toCanvasCoords(point.latitude, point.longitude);

        if (i === 0) {
          ctx.moveTo(coords.x, coords.y);
        } else {
          ctx.lineTo(coords.x, coords.y);
        }
      }
      ctx.stroke();

      // 绘制未完成部分（灰色虚线）
      if (currentFrame < trackPoints.length - 1) {
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);

        ctx.beginPath();
        for (let i = currentFrame; i < trackPoints.length; i++) {
          const point = trackPoints[i];
          const coords = toCanvasCoords(point.latitude, point.longitude);

          if (i === currentFrame) {
            ctx.moveTo(coords.x, coords.y);
          } else {
            ctx.lineTo(coords.x, coords.y);
          }
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // 绘制轨迹点
    trackPoints.forEach((point, index) => {
      const coords = toCanvasCoords(point.latitude, point.longitude);

      if (index === 0) {
        // 起点 - 绿色
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(coords.x, coords.y, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('起', coords.x, coords.y);
      } else if (index === trackPoints.length - 1) {
        // 终点 - 红色
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(coords.x, coords.y, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('终', coords.x, coords.y);
      } else if (index === currentFrame) {
        // 当前位置 - 脉动效果
        const pulse = Math.sin(Date.now() * 0.005) * 0.5 + 1;
        ctx.fillStyle = '#8b5cf6';
        ctx.beginPath();
        ctx.arc(coords.x, coords.y, 6 * pulse, 0, Math.PI * 2);
        ctx.fill();
      } else if (index <= currentFrame) {
        // 已完成点 - 蓝色
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.arc(coords.x, coords.y, 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // 未完成点 - 灰色
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.arc(coords.x, coords.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    ctx.restore();

    // 绘制统计信息
    if (showStats) {
      drawStats(ctx, canvas);
    }
  };

  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number, padding: number) => {
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;

    // 绘制网格线
    const gridSize = 50;
    for (let x = padding; x < width - padding; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
      ctx.stroke();
    }

    for (let y = padding; y < height - padding; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }
  };

  const drawStats = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const stats = sessionData.metadata?.statistics;
    const padding = 20;

    // 绘制半透明背景
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(padding, padding, 200, 120);

    // 绘制统计文字
    ctx.fillStyle = '#1f2937';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';

    const statsLines = [
      `进度: ${currentFrame + 1}/${trackPoints.length}`,
      `像素数: ${stats?.pixelCount || 0}`,
      `时长: ${sessionHistoryService.formatSessionDuration(stats?.duration || 0)}`,
      `效率: ${sessionHistoryService.calculateSessionEfficiency(
        stats?.pixelCount || 0,
        stats?.duration || 0
      )} 像素/分钟`
    ];

    statsLines.forEach((line, index) => {
      ctx.fillText(line, padding + 10, padding + 20 + index * 25);
    });
  };

  const calculateTrackBounds = () => {
    if (trackPoints.length === 0) {
      return { minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 };
    }

    let minLat = trackPoints[0].latitude;
    let maxLat = trackPoints[0].latitude;
    let minLng = trackPoints[0].longitude;
    let maxLng = trackPoints[0].longitude;

    trackPoints.forEach(point => {
      minLat = Math.min(minLat, point.latitude);
      maxLat = Math.max(maxLat, point.latitude);
      minLng = Math.min(minLng, point.longitude);
      maxLng = Math.max(maxLng, point.longitude);
    });

    // 添加一些边距
    const latPadding = (maxLat - minLat) * 0.1;
    const lngPadding = (maxLng - minLng) * 0.1;

    return {
      minLat: minLat - latPadding,
      maxLat: maxLat + latPadding,
      minLng: minLng - lngPadding,
      maxLng: maxLng + lngPadding
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.2, 3));
    soundService.play('click');
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.2, 0.5));
    soundService.play('click');
  };

  const handleReset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setCurrentFrame(0);
    setIsPlaying(false);
    soundService.play('click');
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
    soundService.play('click');
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `轨迹图-${sessionData.session_name}.png`;
    link.href = canvas.toDataURL();
    link.click();

    soundService.play('click');
    logger.info('📥 轨迹图已下载');
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
              borderRadius: '16px',
              width: '100%',
              maxWidth: '1200px',
              height: '80vh',
              maxHeight: '800px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 头部工具栏 */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#f8fafc'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Navigation size={24} style={{ color: '#3b82f6' }} />
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#1f2937' }}>
                  {sessionData.session_name} - 轨迹回放
                </h3>
                <span style={{
                  padding: '4px 8px',
                  backgroundColor: '#e0e7ff',
                  color: '#3730a3',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600'
                }}>
                  {sessionData.drawing_type === 'gps' ? 'GPS轨迹' : '手动绘制'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* 地图样式选择 */}
                <select
                  value={mapStyle}
                  onChange={(e) => setMapStyle(Number(e.target.value))}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  {mapStyles.map((style, index) => (
                    <option key={index} value={index}>{style.name}</option>
                  ))}
                </select>

                {/* 统计信息开关 */}
                <button
                  onClick={() => setShowStats(!showStats)}
                  style={{
                    padding: '8px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: showStats ? '#dbeafe' : '#f3f4f6',
                    color: showStats ? '#3b82f6' : '#6b7280',
                    cursor: 'pointer'
                  }}
                >
                  <Layers size={18} />
                </button>

                {/* 缩放控制 */}
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={handleZoomOut}
                    style={{
                      padding: '8px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: '#f3f4f6',
                      color: '#6b7280',
                      cursor: 'pointer'
                    }}
                  >
                    <ZoomOut size={18} />
                  </button>
                  <button
                    onClick={handleZoomIn}
                    style={{
                      padding: '8px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: '#f3f4f6',
                      color: '#6b7280',
                      cursor: 'pointer'
                    }}
                  >
                    <ZoomIn size={18} />
                  </button>
                </div>

                {/* 重置 */}
                <button
                  onClick={handleReset}
                  style={{
                    padding: '8px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#f3f4f6',
                    color: '#6b7280',
                    cursor: 'pointer'
                  }}
                >
                  <RotateCcw size={18} />
                </button>

                {/* 下载 */}
                <button
                  onClick={handleDownload}
                  style={{
                    padding: '8px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#f3f4f6',
                    color: '#6b7280',
                    cursor: 'pointer'
                  }}
                >
                  <Download size={18} />
                </button>

                {/* 关闭 */}
                <button
                  onClick={onClose}
                  style={{
                    padding: '8px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#f3f4f6',
                    color: '#6b7280',
                    cursor: 'pointer'
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* 主内容区域 */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* 画布区域 */}
              <div
                style={{
                  flex: 1,
                  position: 'relative',
                  backgroundColor: '#f8fafc',
                  cursor: isDragging ? 'grabbing' : 'grab'
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                {isLoading ? (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        width: '48px',
                        height: '48px',
                        border: '4px solid #e5e7eb',
                        borderTop: '4px solid #3b82f6',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto 16px'
                      }} />
                      <p style={{ color: '#6b7280', margin: 0 }}>加载轨迹数据中...</p>
                    </div>
                  </div>
                ) : (
                  <canvas
                    ref={canvasRef}
                    width={800}
                    height={600}
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'block'
                    }}
                  />
                )}
              </div>

              {/* 播放控制栏 */}
              {trackPoints.length > 0 && (
                <div style={{
                  padding: '16px 20px',
                  borderTop: '1px solid #e5e7eb',
                  backgroundColor: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px'
                }}>
                  {/* 播放按钮 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={() => setCurrentFrame(0)}
                      style={{
                        padding: '8px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: '#f3f4f6',
                        color: '#6b7280',
                        cursor: 'pointer'
                      }}
                    >
                      <SkipBack size={18} />
                    </button>

                    <button
                      onClick={handlePlayPause}
                      style={{
                        padding: '8px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        cursor: 'pointer'
                      }}
                    >
                      {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                    </button>

                    <button
                      onClick={() => setCurrentFrame(trackPoints.length - 1)}
                      style={{
                        padding: '8px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: '#f3f4f6',
                        color: '#6b7280',
                        cursor: 'pointer'
                      }}
                    >
                      <SkipForward size={18} />
                    </button>
                  </div>

                  {/* 进度条 */}
                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      <span style={{ fontSize: '14px', color: '#6b7280', minWidth: '60px' }}>
                        {currentFrame + 1}/{trackPoints.length}
                      </span>
                      <input
                        type="range"
                        min="0"
                        max={trackPoints.length - 1}
                        value={currentFrame}
                        onChange={(e) => setCurrentFrame(Number(e.target.value))}
                        style={{
                          flex: 1,
                          height: '6px',
                          borderRadius: '3px',
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      />
                    </div>
                  </div>

                  {/* 播放速度 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>速度:</span>
                    <select
                      value={playSpeed}
                      onChange={(e) => setPlaySpeed(Number(e.target.value))}
                      style={{
                        padding: '4px 8px',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        fontSize: '14px',
                        cursor: 'pointer'
                      }}
                    >
                      <option value={0.5}>0.5x</option>
                      <option value={1}>1x</option>
                      <option value={2}>2x</option>
                      <option value={4}>4x</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}