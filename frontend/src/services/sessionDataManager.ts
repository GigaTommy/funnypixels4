/**
 * 当前绘制会话数据管理器
 * 负责收集、存储和管理当前绘制session的所有数据
 * 确保分享功能使用真实的session数据，不依赖任何mock数据
 */

import { logger } from '../utils/logger';

export interface SessionData {
  // 会话基本信息
  sessionId: string;
  userId: string;
  username: string;
  displayName?: string;
  avatar?: string;

  // 联盟信息
  alliance?: {
    name: string;
    flag: string;
    color: string;
  };

  // 绘制统计
  stats: {
    sessionStartPixels: number; // 会话开始时的总像素数
    sessionEndPixels: number;   // 会话结束时的总像素数
    sessionPixels: number;      // 本会话绘制的像素数
    drawStartTime: number;      // 绘制开始时间
    drawEndTime: number;        // 绘制结束时间
    drawTime: number;           // 绘制时长（秒）
  };

  // 地图数据
  mapData: {
    center: { lat: number; lng: number };
    zoom: number;
    bounds: { north: number; south: number; east: number; west: number };
  };

  // GPS轨迹数据
  trackPoints: Array<{ lat: number; lng: number; timestamp: number }>;

  // 绘制记录
  drawRecords: Array<{
    gridId: string;
    lat: number;
    lng: number;
    timestamp: number;
    color: string;
  }>;

  // 会话状态
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

class SessionDataManager {
  private static instance: SessionDataManager;
  private currentSession: SessionData | null = null;
  private lastEndedSession: SessionData | null = null; // 🔧 保存最后结束的session数据
  private drawStartPixelCount: number = 0;
  private drawStartTime: number = 0;

  private constructor() {}

  static getInstance(): SessionDataManager {
    if (!SessionDataManager.instance) {
      SessionDataManager.instance = new SessionDataManager();
    }
    return SessionDataManager.instance;
  }

  /**
   * 开始新的绘制会话
   */
  startSession(userData: any): string {
    try {
      const sessionId = `session_${userData.id}_${Date.now()}`;
      const now = Date.now();

      // 从用户数据中获取当前总像素数作为会话起始值
      const currentTotalPixels = userData.total_pixels || 0;

      this.currentSession = {
        sessionId,
        userId: userData.id,
        username: userData.username || '匿名用户',
        displayName: userData.display_name,
        avatar: userData.avatar_url,
        alliance: userData.alliance ? {
          name: userData.alliance.name,
          flag: userData.alliance.flag,
          color: userData.alliance.color
        } : undefined,
        stats: {
          sessionStartPixels: currentTotalPixels,
          sessionEndPixels: currentTotalPixels,
          sessionPixels: 0,
          drawStartTime: now,
          drawEndTime: now,
          drawTime: 0
        },
        mapData: {
          center: { lat: 39.9042, lng: 116.4074 }, // 默认北京坐标
          zoom: 12,
          bounds: { north: 40, south: 39.8, east: 116.5, west: 116.3 }
        },
        trackPoints: [],
        drawRecords: [],
        isActive: true,
        createdAt: now,
        updatedAt: now
      };

      this.drawStartPixelCount = currentTotalPixels;
      this.drawStartTime = now;

      logger.info('✅ SessionDataManager: 开始新的绘制会话', {
        sessionId,
        userId: userData.id,
        startPixels: currentTotalPixels
      });

      return sessionId;
    } catch (error) {
      logger.error('❌ SessionDataManager: 开始会话失败', error);
      throw error;
    }
  }

  /**
   * 结束当前绘制会话
   */
  endSession(): SessionData | null {
    if (!this.currentSession) {
      logger.warn('⚠️ SessionDataManager: 没有活跃的会话可以结束');
      return null;
    }

    try {
      const now = Date.now();

      // 更新会话结束信息
      this.currentSession.stats.drawEndTime = now;
      this.currentSession.stats.drawTime = Math.floor((now - this.currentSession.stats.drawStartTime) / 1000);
      this.currentSession.isActive = false;
      this.currentSession.updatedAt = now;

      logger.info('✅ SessionDataManager: 绘制会话结束', {
        sessionId: this.currentSession.sessionId,
        drawTime: this.currentSession.stats.drawTime,
        sessionPixels: this.currentSession.stats.sessionPixels
      });

      const sessionData = { ...this.currentSession };
      this.currentSession = null;

      // 🔧 保存最后结束的session数据，以备后续访问
      this.lastEndedSession = sessionData;

      return sessionData;
    } catch (error) {
      logger.error('❌ SessionDataManager: 结束会话失败', error);
      return null;
    }
  }

  /**
   * 记录绘制操作
   */
  recordDraw(gridId: string, lat: number, lng: number, color: string): void {
    if (!this.currentSession || !this.currentSession.isActive) {
      logger.warn('⚠️ SessionDataManager: 没有活跃会话，忽略绘制记录');
      return;
    }

    const drawRecord = {
      gridId,
      lat,
      lng,
      timestamp: Date.now(),
      color
    };

    this.currentSession.drawRecords.push(drawRecord);
    this.currentSession.stats.sessionPixels++;
    this.currentSession.stats.sessionEndPixels = this.drawStartPixelCount + this.currentSession.stats.sessionPixels;
    this.currentSession.updatedAt = Date.now();

    logger.debug('🎨 SessionDataManager: 记录绘制操作', {
      sessionId: this.currentSession.sessionId,
      gridId,
      totalDraws: this.currentSession.drawRecords.length,
      sessionPixels: this.currentSession.stats.sessionPixels
    });
  }

  /**
   * 更新地图数据
   */
  updateMapData(mapData: Partial<SessionData['mapData']>): void {
    if (!this.currentSession) {
      logger.warn('⚠️ SessionDataManager: 没有活跃会话，忽略地图数据更新');
      return;
    }

    this.currentSession.mapData = {
      ...this.currentSession.mapData,
      ...mapData
    };
    this.currentSession.updatedAt = Date.now();

    logger.debug('🗺️ SessionDataManager: 更新地图数据', {
      sessionId: this.currentSession.sessionId,
      center: this.currentSession.mapData.center,
      zoom: this.currentSession.mapData.zoom
    });
  }

  /**
   * 添加轨迹点
   */
  addTrackPoint(lat: number, lng: number): void {
    if (!this.currentSession) {
      logger.warn('⚠️ SessionDataManager: 没有活跃会话，忽略轨迹点');
      return;
    }

    const trackPoint = {
      lat,
      lng,
      timestamp: Date.now()
    };

    this.currentSession.trackPoints.push(trackPoint);
    this.currentSession.updatedAt = Date.now();

    // 限制轨迹点数量，避免内存占用过多
    const maxTrackPoints = 1000;
    if (this.currentSession.trackPoints.length > maxTrackPoints) {
      this.currentSession.trackPoints = this.currentSession.trackPoints.slice(-maxTrackPoints);
    }

    logger.debug('📍 SessionDataManager: 添加轨迹点', {
      sessionId: this.currentSession.sessionId,
      trackPointsCount: this.currentSession.trackPoints.length
    });
  }

  /**
   * 获取当前会话数据
   */
  getCurrentSession(): SessionData | null {
    return this.currentSession ? { ...this.currentSession } : null;
  }

  /**
   * 🔧 获取最后结束的会话数据
   */
  getLastEndedSession(): SessionData | null {
    return this.lastEndedSession ? { ...this.lastEndedSession } : null;
  }

  /**
   * 获取会话统计信息
   */
  getSessionStats(): Partial<SessionData['stats']> | null {
    if (!this.currentSession) return null;

    const now = Date.now();
    const currentDrawTime = this.currentSession.isActive ?
      Math.floor((now - this.currentSession.stats.drawStartTime) / 1000) :
      this.currentSession.stats.drawTime;

    return {
      sessionStartPixels: this.currentSession.stats.sessionStartPixels,
      sessionEndPixels: this.currentSession.stats.sessionEndPixels,
      sessionPixels: this.currentSession.stats.sessionPixels,
      drawTime: currentDrawTime
    };
  }

  /**
   * 检查是否有活跃会话
   */
  hasActiveSession(): boolean {
    return this.currentSession?.isActive || false;
  }

  /**
   * 获取会话ID
   */
  getSessionId(): string | null {
    return this.currentSession?.sessionId || null;
  }

  /**
   * 清除当前会话
   */
  clearSession(): void {
    if (this.currentSession) {
      logger.info('🧹 SessionDataManager: 清除当前会话', {
        sessionId: this.currentSession.sessionId
      });
    }
    this.currentSession = null;
    this.drawStartPixelCount = 0;
    this.drawStartTime = 0;
  }

  /**
   * 更新用户信息（用于用户数据变更时同步）
   */
  updateUserInfo(userData: any): void {
    if (!this.currentSession) {
      logger.warn('⚠️ SessionDataManager: 没有活跃会话，忽略用户信息更新');
      return;
    }

    this.currentSession.username = userData.username || this.currentSession.username;
    this.currentSession.displayName = userData.display_name || this.currentSession.displayName;
    this.currentSession.avatar = userData.avatar_url || this.currentSession.avatar;

    if (userData.alliance) {
      this.currentSession.alliance = {
        name: userData.alliance.name,
        flag: userData.alliance.flag,
        color: userData.alliance.color
      };
    }

    this.currentSession.updatedAt = Date.now();

    logger.debug('👤 SessionDataManager: 更新用户信息', {
      sessionId: this.currentSession.sessionId,
      username: this.currentSession.username
    });
  }
}

// 导出单例实例
export const sessionDataManager = SessionDataManager.getInstance();