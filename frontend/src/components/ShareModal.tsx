import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Share2,
  Download,
  MapPin,
  Clock,
  Palette,
  TrendingUp,
  Eye,
  Copy,
  MessageCircle,
  X,
  Sparkles,
  Route,
  Navigation,
  Camera,
  Heart,
  Zap,
  BarChart3
} from 'lucide-react';
import { logger } from '../utils/logger';
import { config } from '../config/env';
import { toast } from '../services/toast';
import { soundService } from '../services/soundService';
import { sessionHistoryService, type SessionHistoryItem } from '../services/sessionHistoryService';
import { drawingSessionService } from '../services/drawingSessionService';
import { AllianceFlagRenderer } from './ui/AllianceFlagRenderer';
// import TrajectoryMapGenerator, { type PixelData, type ShareStats } from './TrajectoryMapGenerator'; // Removed - migrating away from trajectory generation

// Temporary type definitions to replace removed TrajectoryMapGenerator
interface PixelData {
  id: string | number;
  latitude: number;
  longitude: number;
  created_at: string;
  district?: string;
}

interface ShareStats {
  pixelCount: number;
  duration: string;
  districtCount: number;
  primaryArea: string;
}

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  sessionData?: SessionHistoryItem;
}

interface ShareImageData {
  routeMap?: string;     // 路线地图图片
  sessionStats?: string; // 统计信息图片
  shareCard?: string;    // 分享卡片图片
}

export default function ShareModal({ isOpen, onClose, sessionId, sessionData }: ShareModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [shareImages, setShareImages] = useState<ShareImageData>({});
  const [shareLink, setShareLink] = useState('');
  const [selectedShareType, setSelectedShareType] = useState<'route' | 'stats' | 'card'>('route');
  const [isSharing, setIsSharing] = useState(false);

  // 新增状态变量，用于 TrajectoryMapGenerator
  const [isGeneratingTrajectory, setIsGeneratingTrajectory] = useState(false);
  const [trajectoryPixels, setTrajectoryPixels] = useState<PixelData[]>([]);
  const [trajectoryStats, setTrajectoryStats] = useState<ShareStats | null>(null);

  // 会话数据
  const session = sessionData;
  const stats = session?.metadata?.statistics;

  useEffect(() => {
    if (isOpen && sessionId) {
      generateShareContent();
    }
  }, [isOpen, sessionId]);

  const generateShareContent = async () => {
    if (!session) return;

    setIsGenerating(true);
    soundService.play('click');

    try {
      logger.info('🎨 开始生成分享内容:', sessionId);

      // 生成分享链接
      const link = await generateShareLink(session);
      setShareLink(link);

      // 生成各种分享图片
      const images = await Promise.allSettled([
        generateRouteMap(session),
        generateStatsImage(session),
        generateShareCard(session)
      ]);

      const result: ShareImageData = {};

      if (images[0].status === 'fulfilled') {
        result.routeMap = images[0].value;
      }
      if (images[1].status === 'fulfilled') {
        result.sessionStats = images[1].value;
      }
      if (images[2].status === 'fulfilled') {
        result.shareCard = images[2].value;
      }

      setShareImages(result);
      logger.info('✅ 分享内容生成完成');
    } catch (error) {
      logger.error('❌ 生成分享内容失败:', error);
      toast.error('生成分享内容失败');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateShareLink = (session: SessionHistoryItem): string => {
    const baseUrl = config.API_BASE_URL || window.location.origin;
    return `${baseUrl}/api/share/page/session/${session.id}`;
  };

  const generateRouteMap = async (session: SessionHistoryItem): Promise<string> => {
    try {
      logger.info('🗺️ 生成路线地图...');

      // 从后端API获取真实的足迹数据
      const { default: FootprintService } = await import('../services/footprintService');
      const trackStatistics = await FootprintService.getFootprintData(session.id);

      // 创建Canvas绘制路线图
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 600;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (!ctx) return '';

      // 绘制背景
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 绘制标题
      ctx.fillStyle = '#1f2937';
      ctx.font = 'bold 32px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(session.session_name, canvas.width / 2, 60);

      // 绘制会话类型
      ctx.font = '20px Arial';
      ctx.fillStyle = '#6b7280';
      ctx.fillText(session.drawing_type === 'gps' ? 'GPS绘制轨迹' : '手动绘制', canvas.width / 2, 100);

      // 使用真实轨迹数据绘制
      if (trackStatistics.trackPoints.length > 0) {
        if (session.drawing_type === 'gps') {
          await drawGPSTrack(ctx, trackStatistics);
        } else {
          await drawManualPattern(ctx, trackStatistics);
        }
      }

      // 添加水印
      ctx.font = '16px Arial';
      ctx.fillStyle = '#9ca3af';
      ctx.textAlign = 'right';
      ctx.fillText('FunnyPixels - 像素绘制游戏', canvas.width - 20, canvas.height - 20);

      return canvas.toDataURL('image/png');
    } catch (error) {
      logger.error('生成路线地图失败:', error);
      return '';
    }
  };

  // 新增：使用 TrajectoryMapGenerator 生成高质量轨迹图
  const generateAdvancedTrajectoryMap = async (session: SessionHistoryItem): Promise<void> => {
    if (isGeneratingTrajectory) return;

    setIsGeneratingTrajectory(true);
    soundService.play('click');

    try {
      logger.info('🚀 开始生成高级轨迹图:', session.id);

      // 1. 获取像素数据
      const { default: FootprintService } = await import('../services/footprintService');
      const trackStatistics = await FootprintService.getFootprintData(session.id);

      if (trackStatistics.trackPoints.length < 2) {
        toast.error('像素点不足，无法生成轨迹图');
        setIsGeneratingTrajectory(false);
        return;
      }

      // 转换轨迹点数据为 PixelData 格式
      const pixelData: PixelData[] = trackStatistics.trackPoints.map((point: any, index: number) => ({
        id: index,
        latitude: point.latitude,
        longitude: point.longitude,
        created_at: new Date(point.timestamp).toISOString(),
        district: point.district || (trackStatistics.startPoint?.city) || '未知区域'
      }));

      // 2. 准备统计数据
      const shareStats: ShareStats = {
        pixelCount: trackStatistics.pixelCount,
        duration: trackStatistics.formattedDuration,
        districtCount: new Set(trackStatistics.trackPoints.map((p: any) => p.district)).size,
        primaryArea: trackStatistics.startPoint?.city || '未知区域'
      };

      setTrajectoryPixels(pixelData);
      setTrajectoryStats(shareStats);

      logger.info('✅ 轨迹数据准备完成');
    } catch (error) {
      logger.error('❌ 准备轨迹数据失败:', error);
      toast.error('准备轨迹数据失败，请重试');
      setIsGeneratingTrajectory(false);
    }
  };

  // TrajectoryMapGenerator 的回调函数
  const handleTrajectoryGenerated = (dataUrl: string) => {
    logger.info('🎉 高级轨迹图生成成功');

    // 将生成的图片设置为 routeMap
    setShareImages(prev => ({
      ...prev,
      routeMap: dataUrl
    }));

    setIsGeneratingTrajectory(false);
    toast.success('轨迹图生成成功');
  };

  const handleTrajectoryError = (error: Error) => {
    logger.error('❌ 高级轨迹图生成失败:', error);
    toast.error('轨迹图生成失败，请重试');
    setIsGeneratingTrajectory(false);
  };

  const drawGPSTrack = async (ctx: CanvasRenderingContext2D, trackStatistics: any) => {
    // 使用真实GPS轨迹数据绘制
    const trackPoints = trackStatistics.trackPoints;
    if (trackPoints.length === 0) return;

    // 计算轨迹边界
    let minLat = trackPoints[0].latitude;
    let maxLat = trackPoints[0].latitude;
    let minLng = trackPoints[0].longitude;
    let maxLng = trackPoints[0].longitude;

    trackPoints.forEach((point: any) => {
      minLat = Math.min(minLat, point.latitude);
      maxLat = Math.max(maxLat, point.latitude);
      minLng = Math.min(minLng, point.longitude);
      maxLng = Math.max(maxLng, point.longitude);
    });

    const padding = 50;
    const centerX = 400;
    const centerY = 300;

    // 坐标转换函数
    const toCanvasCoords = (lat: number, lng: number) => {
      const x = ((lng - minLng) / (maxLng - minLng || 1)) * (800 - 2 * padding) + padding;
      const y = 600 - (((lat - minLat) / (maxLat - minLat || 1)) * (600 - 2 * padding - 150) + padding + 100);
      return { x, y };
    };

    // 转换所有轨迹点
    const points = trackPoints.map((point: any) => toCanvasCoords(point.latitude, point.longitude));

    // 绘制轨迹线
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    points.forEach((point: any, index: number) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.stroke();

    // 绘制起点和终点
    // 起点 - 绿色
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(points[0].x, points[0].y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('起', points[0].x, points[0].y);

    // 终点 - 红色
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(points[points.length - 1].x, points[points.length - 1].y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.fillText('终', points[points.length - 1].x, points[points.length - 1].y);

    // 绘制距离标记
    ctx.fillStyle = '#1f2937';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`移动距离: ${trackStatistics.formattedDistance}`, centerX, 530);
  };

  const drawManualPattern = async (ctx: CanvasRenderingContext2D, trackStatistics: any) => {
    // 使用真实像素数据绘制图案
    const centerX = 400;
    const centerY = 300;
    const pixelCount = trackStatistics.pixelCount;
    const trackPoints = trackStatistics.trackPoints;

    if (trackPoints.length > 0) {
      // 计算像素点边界
      let minLat = trackPoints[0].latitude;
      let maxLat = trackPoints[0].latitude;
      let minLng = trackPoints[0].longitude;
      let maxLng = trackPoints[0].longitude;

      trackPoints.forEach((point: any) => {
        minLat = Math.min(minLat, point.latitude);
        maxLat = Math.max(maxLat, point.latitude);
        minLng = Math.min(minLng, point.longitude);
        maxLng = Math.max(maxLng, point.longitude);
      });

      const padding = 100;
      const drawWidth = 600;
      const drawHeight = 300;

      // 绘制像素点
      trackPoints.forEach((point: any) => {
        const x = ((point.longitude - minLng) / (maxLng - minLng || 1)) * drawWidth + padding;
        const y = 600 - (((point.latitude - minLat) / (maxLat - minLat || 1)) * drawHeight + 150);

        ctx.fillStyle = point.color || '#3b82f6';
        ctx.fillRect(x - 3, y - 3, 6, 6);
      });
    }

    // 绘制像素数量
    ctx.fillStyle = '#1f2937';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`总像素数: ${pixelCount}`, centerX, 530);
  };


  const generateStatsImage = async (session: SessionHistoryItem): Promise<string> => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 800;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (!ctx) return '';

      // 绘制背景
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 绘制渐变标题背景
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
      gradient.addColorStop(0, '#3b82f6');
      gradient.addColorStop(1, '#8b5cf6');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, 120);

      // 绘制标题
      ctx.fillStyle = 'white';
      ctx.font = 'bold 28px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('🎨 绘制统计报告', canvas.width / 2, 50);
      ctx.font = '18px Arial';
      ctx.fillText(session.session_name, canvas.width / 2, 90);

      // 绘制统计数据
      const statsData = [
        {
          icon: '📍',
          label: '绘制类型',
          value: session.drawing_type === 'gps' ? 'GPS绘制' : '手动绘制',
          color: '#3b82f6'
        },
        {
          icon: '🎨',
          label: '像素数量',
          value: `${stats?.pixelCount || 0} 像素`,
          color: '#10b981'
        },
        {
          icon: '⏱️',
          label: '绘制时长',
          value: sessionHistoryService.formatSessionDuration(stats?.duration || 0),
          color: '#f59e0b'
        },
        {
          icon: '📏',
          label: '移动距离',
          value: sessionHistoryService.formatDistance(stats?.distance || 0),
          color: '#ef4444'
        },
        {
          icon: '⚡',
          label: '绘制效率',
          value: `${sessionHistoryService.calculateSessionEfficiency(
            stats?.pixelCount || 0,
            stats?.duration || 0
          )} 像素/分钟`,
          color: '#8b5cf6'
        }
      ];

      let yOffset = 160;
      statsData.forEach((stat) => {
        // 统计卡片背景
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(30, yOffset - 25, canvas.width - 60, 70);

        // 图标
        ctx.font = '24px Arial';
        ctx.fillText(stat.icon, 60, yOffset + 10);

        // 标签
        ctx.fillStyle = '#6b7280';
        ctx.font = '16px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(stat.label, 100, yOffset + 5);

        // 数值
        ctx.fillStyle = stat.color;
        ctx.font = 'bold 20px Arial';
        ctx.fillText(stat.value, 100, yOffset + 30);

        yOffset += 90;
      });

      // 添加底部信息
      ctx.fillStyle = '#9ca3af';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`开始时间: ${new Date(session.start_time).toLocaleString('zh-CN')}`, canvas.width / 2, 720);
      ctx.fillText(`结束时间: ${new Date(session.end_time || '').toLocaleString('zh-CN')}`, canvas.width / 2, 750);

      return canvas.toDataURL('image/png');
    } catch (error) {
      logger.error('生成统计图片失败:', error);
      return '';
    }
  };

  const generateShareCard = async (session: SessionHistoryItem): Promise<string> => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 900;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (!ctx) return '';

      // 创建渐变背景
      const bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      bgGradient.addColorStop(0, '#667eea');
      bgGradient.addColorStop(1, '#764ba2');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 绘制装饰圆圈
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.beginPath();
      ctx.arc(500, 150, 80, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(100, 750, 120, 0, Math.PI * 2);
      ctx.fill();

      // 绘制主标题
      ctx.fillStyle = 'white';
      ctx.font = 'bold 48px Arial';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 10;
      ctx.fillText('FunnyPixels', canvas.width / 2, 120);
      ctx.font = '24px Arial';
      ctx.fillText('像素艺术创作', canvas.width / 2, 160);
      ctx.shadowBlur = 0;

      // 绘制白色卡片背景
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.roundRect(40, 200, canvas.width - 80, 500, 20);
      ctx.fill();

      // 绘制会话名称
      ctx.fillStyle = '#1f2937';
      ctx.font = 'bold 32px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(session.session_name, canvas.width / 2, 250);

      // 绘制类型标签
      const typeText = session.drawing_type === 'gps' ? '📍 GPS轨迹绘制' : '🎨 手动像素创作';
      ctx.font = '20px Arial';
      ctx.fillStyle = '#6b7280';
      ctx.fillText(typeText, canvas.width / 2, 290);

      // 绘制成就图标和数字
      const achievements = [
        { icon: '🎨', value: `${stats?.pixelCount || 0}`, label: '像素' },
        { icon: '⏱️', value: sessionHistoryService.formatSessionDuration(stats?.duration || 0), label: '时长' },
        { icon: '⚡', value: `${sessionHistoryService.calculateSessionEfficiency(
          stats?.pixelCount || 0,
          stats?.duration || 0
        )}`, label: '效率' }
      ];

      const cardWidth = (canvas.width - 120) / 3;
      achievements.forEach((achievement, index) => {
        const x = 60 + index * cardWidth;

        // 卡片背景
        ctx.fillStyle = '#f8fafc';
        ctx.roundRect(x, 330, cardWidth - 20, 120, 15);
        ctx.fill();

        // 图标
        ctx.font = '36px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(achievement.icon, x + (cardWidth - 20) / 2, 380);

        // 数值
        ctx.fillStyle = '#1f2937';
        ctx.font = 'bold 24px Arial';
        ctx.fillText(achievement.value, x + (cardWidth - 20) / 2, 420);

        // 标签
        ctx.fillStyle = '#6b7280';
        ctx.font = '16px Arial';
        ctx.fillText(achievement.label, x + (cardWidth - 20) / 2, 445);
      });

      // 绘制邀请文字
      ctx.fillStyle = '#4b5563';
      ctx.font = '18px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('快来加入FunnyPixels', canvas.width / 2, 550);
      ctx.fillText('一起创作属于你的像素艺术！', canvas.width / 2, 580);

      // 绘制二维码提示
      ctx.fillStyle = '#9ca3af';
      ctx.font = '14px Arial';
      ctx.fillText('扫码体验更多精彩', canvas.width / 2, 850);

      return canvas.toDataURL('image/png');
    } catch (error) {
      logger.error('生成分享卡片失败:', error);
      return '';
    }
  };

  const handleShare = async (type: 'wechat' | 'weibo' | 'copy_link') => {
    if (!shareLink) return;

    setIsSharing(true);
    soundService.play('click');

    try {
      switch (type) {
        case 'copy_link':
          await navigator.clipboard.writeText(shareLink);
          toast.success('分享链接已复制到剪贴板');
          break;
        case 'wechat':
          // 微信分享提示
          toast.info('请使用微信扫一扫功能分享');
          break;
        case 'weibo':
          // 微博分享
          const text = `我在FunnyPixels完成了${session?.session_name}，绘制了${stats?.pixelCount || 0}个像素！快来一起创作吧！`;
          const weiboUrl = `https://service.weibo.com/share/share.php?url=${encodeURIComponent(shareLink)}&title=${encodeURIComponent(text)}`;
          window.open(weiboUrl, '_blank');
          break;
      }
    } catch (error) {
      logger.error('分享失败:', error);
      toast.error('分享失败');
    } finally {
      setIsSharing(false);
    }
  };

  const handleDownload = (imageType: 'route' | 'stats' | 'card') => {
    const imageUrl = shareImages[imageType];
    if (!imageUrl) {
      toast.error('图片生成中，请稍后再试');
      return;
    }

    soundService.play('click');
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `${session?.session_name}-${imageType}-${Date.now()}.png`;
    link.click();
    toast.success('图片下载中...');
  };

  const getCurrentImage = () => {
    switch (selectedShareType) {
      case 'route': return shareImages.routeMap;
      case 'stats': return shareImages.sessionStats;
      case 'card': return shareImages.shareCard;
      default: return shareImages.routeMap;
    }
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
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px'
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 50 }}
            style={{
              backgroundColor: 'white',
              borderRadius: '20px',
              maxWidth: '900px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'hidden',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 关闭按钮 */}
            <button
              onClick={onClose}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: 'rgba(0,0,0,0.1)',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.1)';
              }}
            >
              <X size={20} />
            </button>

            {/* 头部 */}
            <div style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              padding: '24px',
              textAlign: 'center',
              color: 'white'
            }}>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring' }}
                style={{ marginBottom: '8px' }}
              >
                <Sparkles size={32} style={{ margin: '0 auto' }} />
              </motion.div>
              <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 'bold' }}>
                分享你的创作
              </h2>
              <p style={{ margin: '8px 0 0 0', opacity: 0.9 }}>
                让更多人看到你的像素艺术作品
              </p>
            </div>

            {/* 内容区域 */}
            <div style={{ padding: '24px', maxHeight: 'calc(90vh - 200px)', overflow: 'auto' }}>
              {/* 分享预览 */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{
                  display: 'flex',
                  gap: '12px',
                  marginBottom: '16px',
                  justifyContent: 'center',
                  flexWrap: 'wrap'
                }}>
                  {[
                    { type: 'route', label: '路线图', icon: Route },
                    { type: 'stats', label: '统计图', icon: BarChart3 },
                    { type: 'card', label: '分享卡', icon: Camera }
                  ].map(({ type, label, icon: Icon }) => (
                    <button
                      key={type}
                      onClick={() => setSelectedShareType(type as any)}
                      style={{
                        padding: '12px 20px',
                        borderRadius: '12px',
                        border: selectedShareType === type ? '2px solid #667eea' : '1px solid #e5e7eb',
                        backgroundColor: selectedShareType === type ? '#f0f4ff' : 'white',
                        color: selectedShareType === type ? '#667eea' : '#6b7280',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '14px',
                        fontWeight: '500',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <Icon size={18} />
                      {label}
                    </button>
                  ))}
                </div>

                {/* 高级轨迹图生成按钮 */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  marginBottom: '16px'
                }}>
                  <button
                    onClick={() => session && generateAdvancedTrajectoryMap(session)}
                    disabled={isGeneratingTrajectory || !session}
                    style={{
                      padding: '12px 24px',
                      borderRadius: '12px',
                      border: '2px solid #10b981',
                      backgroundColor: isGeneratingTrajectory ? '#f0fdf4' : '#ecfdf5',
                      color: isGeneratingTrajectory ? '#6b7280' : '#10b981',
                      cursor: isGeneratingTrajectory ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      transition: 'all 0.2s ease',
                      opacity: isGeneratingTrajectory ? 0.7 : 1
                    }}
                    onMouseEnter={(e) => {
                      if (!isGeneratingTrajectory) {
                        e.currentTarget.style.backgroundColor = '#10b981';
                        e.currentTarget.style.color = 'white';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isGeneratingTrajectory) {
                        e.currentTarget.style.backgroundColor = '#ecfdf5';
                        e.currentTarget.style.color = '#10b981';
                      }
                    }}
                  >
                    {isGeneratingTrajectory ? (
                      <>
                        <div style={{
                          width: '16px',
                          height: '16px',
                          border: '2px solid #e5e7eb',
                          borderTop: '2px solid #10b981',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite'
                        }} />
                        生成中...
                      </>
                    ) : (
                      <>
                        <Zap size={18} />
                        生成高清轨迹图
                      </>
                    )}
                  </button>
                </div>

                {/* 图片预览 */}
                <div style={{
                  backgroundColor: '#f8fafc',
                  borderRadius: '16px',
                  padding: '16px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  minHeight: '300px',
                  position: 'relative'
                }}>
                  {isGenerating ? (
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
                      <p style={{ color: '#6b7280', margin: 0 }}>正在生成分享图片...</p>
                    </div>
                  ) : getCurrentImage() ? (
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <img
                        src={getCurrentImage()}
                        alt="分享预览"
                        style={{
                          maxWidth: '100%',
                          maxHeight: '400px',
                          borderRadius: '12px',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.1)'
                        }}
                      />
                      {session?.alliance_pattern_id && (
                        <div style={{
                          position: 'absolute',
                          top: '16px',
                          right: '16px',
                          backgroundColor: 'rgba(255,255,255,0.95)',
                          borderRadius: '12px',
                          padding: '8px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <AllianceFlagRenderer
                            patternId={session.alliance_pattern_id}
                            patternType={session.alliance_pattern_type || 'color'}
                            size="lg"
                            className="flex-shrink-0"
                          />
                          {session.alliance_name && (
                            <span style={{
                              fontSize: '14px',
                              fontWeight: '600',
                              color: '#1f2937'
                            }}>
                              {session.alliance_name}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', color: '#9ca3af' }}>
                      <Camera size={48} style={{ marginBottom: '8px' }} />
                      <p>图片生成失败</p>
                    </div>
                  )}
                </div>
              </div>

              {/* 统计信息 */}
              {session && (
                <div style={{
                  backgroundColor: '#f8fafc',
                  borderRadius: '16px',
                  padding: '20px',
                  marginBottom: '24px'
                }}>
                  <h3 style={{
                    margin: '0 0 16px 0',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    color: '#1f2937'
                  }}>
                    📊 会话统计
                  </h3>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: '16px'
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6', marginBottom: '4px' }}>
                        {stats?.pixelCount || 0}
                      </div>
                      <div style={{ fontSize: '14px', color: '#6b7280' }}>绘制像素</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981', marginBottom: '4px' }}>
                        {sessionHistoryService.formatSessionDuration(stats?.duration || 0)}
                      </div>
                      <div style={{ fontSize: '14px', color: '#6b7280' }}>绘制时长</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b', marginBottom: '4px' }}>
                        {sessionHistoryService.calculateSessionEfficiency(
                          stats?.pixelCount || 0,
                          stats?.duration || 0
                        )}
                      </div>
                      <div style={{ fontSize: '14px', color: '#6b7280' }}>像素/分钟</div>
                    </div>
                    {(stats?.distance || 0) > 0 && (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444', marginBottom: '4px' }}>
                          {sessionHistoryService.formatDistance(stats?.distance || 0)}
                        </div>
                        <div style={{ fontSize: '14px', color: '#6b7280' }}>移动距离</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 分享按钮 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <button
                  onClick={() => handleShare('wechat')}
                  disabled={isSharing || !shareLink}
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    border: 'none',
                    backgroundColor: '#10b981',
                    color: 'white',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: isSharing ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.2s ease',
                    opacity: isSharing ? 0.5 : 1
                  }}
                >
                  <MessageCircle size={20} />
                  微信分享
                </button>

                <button
                  onClick={() => handleShare('weibo')}
                  disabled={isSharing || !shareLink}
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    border: 'none',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: isSharing ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.2s ease',
                    opacity: isSharing ? 0.5 : 1
                  }}
                >
                  <Share2 size={20} />
                  微博分享
                </button>

                <button
                  onClick={() => handleShare('copy_link')}
                  disabled={isSharing || !shareLink}
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    border: 'none',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: isSharing ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.2s ease',
                    opacity: isSharing ? 0.5 : 1
                  }}
                >
                  <Copy size={20} />
                  复制链接
                </button>

                <button
                  onClick={() => handleDownload(selectedShareType)}
                  disabled={isGenerating || !getCurrentImage()}
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    border: 'none',
                    backgroundColor: '#8b5cf6',
                    color: 'white',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: (isGenerating || !getCurrentImage()) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.2s ease',
                    opacity: (isGenerating || !getCurrentImage()) ? 0.5 : 1
                  }}
                >
                  <Download size={20} />
                  下载图片
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* TrajectoryMapGenerator - Removed - migrating away from trajectory generation */}
      {/* TODO: Implement MapLibre-based trajectory map generation */}
    </AnimatePresence>
  );
}
