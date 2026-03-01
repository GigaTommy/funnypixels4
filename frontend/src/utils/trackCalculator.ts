/**
 * 轨迹数据计算工具类
 * 直接从后端API获取真实的会话和轨迹数据
 */

import { logger } from './logger';

export interface TrackPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  gridId?: string;
  color?: string;
  accuracy?: number;
  speed?: number;
}

export interface TrackStatistics {
  totalDistance: number; // 总距离（米）
  formattedDistance: string; // 格式化距离
  duration: number; // 总时长（秒）
  formattedDuration: string; // 格式化时长
  pixelCount: number; // 绘制格子数
  startPoint?: {
    latitude: number;
    longitude: number;
    address?: string;
    city?: string;
    province?: string;
  };
  endPoint?: {
    latitude: number;
    longitude: number;
    address?: string;
    city?: string;
    province?: string;
  };
  maxSpeed?: number; // 最大速度
  avgSpeed?: number; // 平均速度
  trackPoints: TrackPoint[]; // 轨迹点数据
  sessionId: string;
  sessionName: string;
  drawingType: 'gps' | 'manual';
}

/**
 * 轨迹计算器类 */
export class TrackCalculator {
  /**
   * 从后端API获取会话的轨迹统计信息
   */
  static async getSessionTrackStatistics(sessionId: string): Promise<TrackStatistics> {
    try {
      logger.info('📍 获取会话轨迹统计:', sessionId);

      // 获取会话详情
      const sessionResponse = await fetch(`/api/drawing-sessions/${sessionId}`, {
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!sessionResponse.ok) {
        throw new Error(`获取会话信息失败: ${sessionResponse.status}`);
      }

      const sessionResult = await sessionResponse.json();
      if (!sessionResult.success) {
        throw new Error(`API错误: ${sessionResult.message}`);
      }

      const session = sessionResult.data;

      // 获取会话的像素历史记录
      const pixelsResponse = await fetch(`/api/pixels-history/session/${sessionId}`, {
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!pixelsResponse.ok) {
        throw new Error(`获取像素历史失败: ${pixelsResponse.status}`);
      }

      const pixelsResult = await pixelsResponse.json();
      if (!pixelsResult.success) {
        throw new Error(`API错误: ${pixelsResult.message}`);
      }

      const pixelsHistory = pixelsResult.data || [];

      // 转换像素历史为轨迹点
      const trackPoints = this.convertPixelsToTrackPoints(pixelsHistory);

      // 计算统计信息
      const statistics = await this.calculateStatisticsFromSession(session, trackPoints);

      logger.info('✅ 会话轨迹统计获取成功:', statistics);
      return statistics;

    } catch (error) {
      logger.error('❌ 获取会话轨迹统计失败:', error);
      throw error;
    }
  }

  /**
   * 将像素历史记录转换为轨迹点
   */
  private static convertPixelsToTrackPoints(pixelsHistory: any[]): TrackPoint[] {
    return pixelsHistory.map(pixel => ({
      latitude: parseFloat(pixel.latitude),
      longitude: parseFloat(pixel.longitude),
      timestamp: new Date(pixel.created_at).getTime(),
      gridId: pixel.grid_id,
      color: pixel.color
    })).filter(point =>
      !isNaN(point.latitude) &&
      !isNaN(point.longitude) &&
      point.latitude !== 0 &&
      point.longitude !== 0
    );
  }

  /**
   * 从会话信息和轨迹点计算统计信息
   */
  private static async calculateStatisticsFromSession(session: any, trackPoints: TrackPoint[]): Promise<TrackStatistics> {
    if (trackPoints.length === 0) {
      throw new Error('没有找到轨迹数据');
    }

    let totalDistance = 0;
    let maxSpeed = 0;
    let totalSpeed = 0;
    let speedCount = 0;

    // 按时间排序轨迹点
    trackPoints.sort((a, b) => a.timestamp - b.timestamp);

    // 计算每段距离和速度
    for (let i = 1; i < trackPoints.length; i++) {
      const prevPoint = trackPoints[i - 1];
      const currPoint = trackPoints[i];

      const distance = this.calculateDistance(
        prevPoint.latitude, prevPoint.longitude,
        currPoint.latitude, currPoint.longitude
      );

      totalDistance += distance;

      // 计算速度（如果有时戳差）
      if (prevPoint.timestamp && currPoint.timestamp) {
        const timeDiff = (currPoint.timestamp - prevPoint.timestamp) / 1000; // 转换为秒
        if (timeDiff > 0) {
          const speed = distance / timeDiff; // 米/秒
          totalSpeed += speed;
          speedCount++;

          if (speed > maxSpeed) {
            maxSpeed = speed;
          }
        }
      }
    }

    // 获取会话基本信息
    const startTime = session.start_time ? new Date(session.start_time).getTime() :
                     trackPoints[0]?.timestamp || Date.now();
    const endTime = session.end_time ? new Date(session.end_time).getTime() :
                   trackPoints[trackPoints.length - 1]?.timestamp || Date.now();

    const duration = Math.floor((endTime - startTime) / 1000);
    const avgSpeed = speedCount > 0 ? totalSpeed / speedCount : 0;

    // 获取会话统计信息（如果有的话）
    const sessionStats = session.metadata?.statistics || {};
    const pixelCount = sessionStats.pixelCount || trackPoints.length;

    // 构建起点和终点信息
    const startPoint = {
      latitude: trackPoints[0].latitude,
      longitude: trackPoints[0].longitude,
      city: session.start_city,
      province: session.start_province,
      address: session.start_city ? `${session.start_province || ''}${session.start_city}` : undefined
    };

    const endPoint = {
      latitude: trackPoints[trackPoints.length - 1].latitude,
      longitude: trackPoints[trackPoints.length - 1].longitude,
      city: session.end_city,
      province: session.end_province,
      address: session.end_city ? `${session.end_province || ''}${session.end_city}` : undefined
    };

    const statistics: TrackStatistics = {
      totalDistance,
      formattedDistance: this.formatDistance(totalDistance),
      duration,
      formattedDuration: this.formatDuration(duration),
      pixelCount,
      startPoint,
      endPoint,
      maxSpeed,
      avgSpeed,
      trackPoints,
      sessionId: session.id,
      sessionName: session.session_name,
      drawingType: session.drawing_type || 'manual'
    };

    return statistics;
  }

  /**
   * 格式化距离显示
   */
  static formatDistance(distance: number): string {
    if (distance < 1000) {
      return `${distance.toFixed(1)} m`;
    } else {
      return `${(distance / 1000).toFixed(1)} km`;
    }
  }

  /**
   * 格式化时长显示
   */
  static formatDuration(seconds: number): string {
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
   * 计算两点之间的距离（米）
   * 使用Haversine公式
   */
  static calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
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
   * 地址逆编码（异步）
   * 调用高德地图API获取地址信息
   */
  private static async geocodeLocation(latitude: number, longitude: number): Promise<string | undefined> {
    try {
      // 调用高德地图逆地理编码API
      const response = await fetch(
        `https://restapi.amap.com/v3/geocode/regeo?location=${longitude},${latitude}&key=0aca7174681d53a1a41441a433e1cbab&output=json&radius=1000`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.status === '1' && data.regeocode) {
          return data.regeocode.formatted_address;
        }
      }
    } catch (error) {
      logger.warn('地址逆编码失败:', error);
    }

    return undefined;
  }

  /**
   * 生成模拟轨迹数据（用于测试）
   */
  static generateMockTrackData(centerLat: number, centerLng: number, points: number = 50): TrackPoint[] {
    const trackPoints: TrackPoint[] = [];
    const radius = 0.01; // 大约1km半径
    const baseTime = Date.now() - 3600000; // 1小时前

    for (let i = 0; i < points; i++) {
      const angle = (i / points) * Math.PI * 2;
      const r = radius + (Math.random() - 0.5) * 0.002; // 添加随机偏移

      trackPoints.push({
        latitude: centerLat + Math.cos(angle) * r,
        longitude: centerLng + Math.sin(angle) * r,
        timestamp: baseTime + i * (3600000 / points), // 1小时内均匀分布
        accuracy: 5 + Math.random() * 10,
        speed: 5 + Math.random() * 15
      });
    }

    return trackPoints;
  }

  /**
   * 计算轨迹边界框
   */
  static calculateBounds(trackPoints: TrackPoint[]): {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  } {
    if (trackPoints.length === 0) {
      throw new Error('轨迹点为空');
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

    // 添加边距
    const latPadding = (maxLat - minLat) * 0.1;
    const lngPadding = (maxLng - minLng) * 0.1;

    return {
      minLat: minLat - latPadding,
      maxLat: maxLat + latPadding,
      minLng: minLng - lngPadding,
      maxLng: maxLng + lngPadding
    };
  }

  /**
   * 平滑轨迹点（减少噪音）
   */
  static smoothTrackPoints(trackPoints: TrackPoint[], windowSize: number = 3): TrackPoint[] {
    if (trackPoints.length <= windowSize) {
      return trackPoints;
    }

    const smoothedPoints: TrackPoint[] = [];

    for (let i = 0; i < trackPoints.length; i++) {
      if (i === 0 || i === trackPoints.length - 1) {
        // 保留起点和终点
        smoothedPoints.push(trackPoints[i]);
      } else {
        // 对中间点进行平滑
        let sumLat = 0;
        let sumLng = 0;
        let count = 0;

        for (let j = Math.max(0, i - Math.floor(windowSize / 2));
             j <= Math.min(trackPoints.length - 1, i + Math.floor(windowSize / 2));
             j++) {
          sumLat += trackPoints[j].latitude;
          sumLng += trackPoints[j].longitude;
          count++;
        }

        smoothedPoints.push({
          ...trackPoints[i],
          latitude: sumLat / count,
          longitude: sumLng / count
        });
      }
    }

    return smoothedPoints;
  }
}

/**
 * 生成分享链接
 */
export function generateShareTrackUrl(sessionId: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/share/track/${sessionId}`;
}