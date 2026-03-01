/**
 * 足迹图服务
 * 用于获取和管理足迹图相关数据
 */

import { logger } from '../utils/logger';
import { TrackCalculator, type TrackStatistics } from '../utils/trackCalculator';

export interface SessionDetail {
  id: string;
  user_id: string;
  session_name: string;
  drawing_type: 'gps' | 'manual';
  start_time?: string;
  end_time?: string;
  start_city?: string;
  end_city?: string;
  start_province?: string;
  end_province?: string;
  metadata?: {
    statistics?: {
      pixelCount?: number;
      duration?: number;
      distance?: number;
    };
  };
  created_at: string;
  updated_at: string;
}

export interface PixelsHistoryItem {
  id: number;
  user_id: string;
  session_id?: string;
  grid_id: string;
  latitude: number;
  longitude: number;
  color: string;
  created_at: string;
}

/**
 * 足迹图服务类
 */
export class FootprintService {
  /**
   * 获取会话详细信息
   */
  static async getSessionDetails(sessionId: string): Promise<SessionDetail> {
    try {
      const response = await fetch(`/api/drawing-sessions/${sessionId}`, {
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || '获取会话详情失败');
      }

      return result.data;
    } catch (error) {
      logger.error('获取会话详情失败:', error);
      throw error;
    }
  }

  /**
   * 获取会话的像素历史记录
   */
  static async getSessionPixelsHistory(sessionId: string): Promise<PixelsHistoryItem[]> {
    try {
      const response = await fetch(`/api/pixels-history/session/${sessionId}`, {
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || '获取像素历史失败');
      }

      return result.data || [];
    } catch (error) {
      logger.error('获取像素历史失败:', error);
      throw error;
    }
  }

  /**
   * 获取完整的足迹图数据
   */
  static async getFootprintData(sessionId: string): Promise<TrackStatistics> {
    try {
      logger.info('📍 获取足迹图数据:', sessionId);

      // 并行获取会话详情和像素历史
      const [sessionDetails, pixelsHistory] = await Promise.all([
        this.getSessionDetails(sessionId),
        this.getSessionPixelsHistory(sessionId)
      ]);

      // 转换为轨迹点
      const trackPoints = this.convertPixelsToTrackPoints(pixelsHistory);

      // 计算统计信息
      const statistics = await this.calculateStatistics(sessionDetails, trackPoints);

      logger.info('✅ 足迹图数据获取成功:', statistics);
      return statistics;
    } catch (error) {
      logger.error('❌ 获取足迹图数据失败:', error);
      throw error;
    }
  }

  /**
   * 将像素历史记录转换为轨迹点
   */
  private static convertPixelsToTrackPoints(pixelsHistory: PixelsHistoryItem[]): Array<{
    latitude: number;
    longitude: number;
    timestamp: number;
    gridId?: string;
    color?: string;
  }> {
    return pixelsHistory
      .map(pixel => ({
        latitude: parseFloat(pixel.latitude.toString()),
        longitude: parseFloat(pixel.longitude.toString()),
        timestamp: new Date(pixel.created_at).getTime(),
        gridId: pixel.grid_id,
        color: pixel.color
      }))
      .filter(point =>
        !isNaN(point.latitude) &&
        !isNaN(point.longitude) &&
        point.latitude !== 0 &&
        point.longitude !== 0
      );
  }

  /**
   * 计算轨迹统计信息
   */
  private static async calculateStatistics(
    sessionDetails: SessionDetail,
    trackPoints: Array<{
      latitude: number;
      longitude: number;
      timestamp: number;
    }>
  ): Promise<TrackStatistics> {
    if (trackPoints.length === 0) {
      throw new Error('没有找到轨迹数据');
    }

    // 按时间排序
    trackPoints.sort((a, b) => a.timestamp - b.timestamp);

    // 计算总距离
    let totalDistance = 0;
    for (let i = 1; i < trackPoints.length; i++) {
      const prevPoint = trackPoints[i - 1];
      const currPoint = trackPoints[i];

      const distance = this.calculateDistance(
        prevPoint.latitude, prevPoint.longitude,
        currPoint.latitude, currPoint.longitude
      );

      totalDistance += distance;
    }

    // 获取时长信息
    const startTime = sessionDetails.start_time
      ? new Date(sessionDetails.start_time).getTime()
      : trackPoints[0]?.timestamp || Date.now();

    const endTime = sessionDetails.end_time
      ? new Date(sessionDetails.end_time).getTime()
      : trackPoints[trackPoints.length - 1]?.timestamp || Date.now();

    const duration = Math.floor((endTime - startTime) / 1000);

    // 获取像素数量
    const pixelCount = sessionDetails.metadata?.statistics?.pixelCount || trackPoints.length;

    return {
      totalDistance,
      formattedDistance: this.formatDistance(totalDistance),
      duration,
      formattedDuration: this.formatDuration(duration),
      pixelCount,
      startPoint: {
        latitude: trackPoints[0].latitude,
        longitude: trackPoints[0].longitude,
        city: sessionDetails.start_city,
        province: sessionDetails.start_province,
        address: sessionDetails.start_city ? `${sessionDetails.start_province || ''}${sessionDetails.start_city}` : undefined
      },
      endPoint: {
        latitude: trackPoints[trackPoints.length - 1].latitude,
        longitude: trackPoints[trackPoints.length - 1].longitude,
        city: sessionDetails.end_city,
        province: sessionDetails.end_province,
        address: sessionDetails.end_city ? `${sessionDetails.end_province || ''}${sessionDetails.end_city}` : undefined
      },
      trackPoints: trackPoints.map(point => ({
        latitude: point.latitude,
        longitude: point.longitude,
        timestamp: point.timestamp,
        gridId: (point as any).gridId,
        color: (point as any).color
      })),
      sessionId: sessionDetails.id,
      sessionName: sessionDetails.session_name,
      drawingType: sessionDetails.drawing_type
    };
  }

  /**
   * 计算两点之间的距离（米）
   * 使用Haversine公式
   */
  private static calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // 地球半径（米）
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * 角度转弧度
   */
  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * 格式化距离显示
   */
  private static formatDistance(distance: number): string {
    if (distance < 1000) {
      return `${distance.toFixed(1)} m`;
    } else {
      return `${(distance / 1000).toFixed(1)} km`;
    }
  }

  /**
   * 格式化时长显示
   */
  private static formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
  }

  /**
   * 生成分享链接
   */
  static generateShareUrl(sessionId: string): string {
    const baseUrl = window.location.origin;
    return `${baseUrl}/share/footprint/${sessionId}`;
  }

  /**
   * 复制分享链接到剪贴板
   */
  static async copyShareUrl(sessionId: string): Promise<boolean> {
    try {
      const url = this.generateShareUrl(sessionId);
      await navigator.clipboard.writeText(url);
      return true;
    } catch (error) {
      logger.error('复制分享链接失败:', error);
      return false;
    }
  }

  /**
   * 分享到社交媒体
   */
  static shareToSocialMedia(sessionId: string, platform: 'wechat' | 'weibo' | 'qq'): void {
    const url = this.generateShareUrl(sessionId);
    const title = '我在FunnyPixels绘制了有趣的轨迹，快来看看吧！';

    switch (platform) {
      case 'weibo':
        const weiboUrl = `https://service.weibo.com/share/share.php?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;
        window.open(weiboUrl, '_blank');
        break;

      case 'wechat':
        // 微信分享需要用户手动操作
        logger.info('请使用微信扫一扫功能分享链接:', url);
        break;

      case 'qq':
        const qqUrl = `https://connect.qq.com/widget/shareqq/index.html?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;
        window.open(qqUrl, '_blank');
        break;
    }
  }
}

export default FootprintService;