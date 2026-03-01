import { logger } from '../utils/logger';
import { AuthService } from './auth';

export interface DrawingStats {
  distance: number;
  pixels: number;
  duration: number;
  speed?: number;
}

export interface DiscoveryEvent {
  type: 'drift_bottle' | 'treasure';
  id: string;
  distance: number;
  message: string;
  timestamp: number;
  position: {
    lat: number;
    lng: number;
  };
}

export interface ImmersiveModeConfig {
  enableFullscreen: boolean;
  discoveryRadius: {
    driftBottle: number;    // 发现漂流瓶的半径（米）
    treasure: number;       // 发现宝藏的半径（米）
  };
  notifications: {
    pulse: boolean;         // 是否启用脉冲动画
    sound: boolean;         // 是否启用音效
    vibration: boolean;     // 是否启用震动
  };
}

/**
 * 沉浸式绘制模式服务
 * 管理GPS绘制与社交发现的联动逻辑
 */
class ImmersiveModeService {
  private config: ImmersiveModeConfig = {
    enableFullscreen: true,
    discoveryRadius: {
      driftBottle: 50,      // 50米内发现漂流瓶
      treasure: 100         // 100米内发现宝藏
    },
    notifications: {
      pulse: true,
      sound: true,
      vibration: true
    }
  };

  private isActive = false;
  private discoveryCallbacks: Set<(event: DiscoveryEvent) => void> = new Set();
  private statsUpdateCallbacks: Set<(stats: DrawingStats) => void> = new Set();

  /**
   * 进入沉浸式绘制模式
   */
  async enterImmersiveMode(): Promise<void> {
    try {
      logger.info('🎮 进入沉浸式绘制模式');

      // 1. 请求全屏
      if (this.config.enableFullscreen) {
        await this.requestFullscreen();
      }

      // 2. 隐藏非必要UI
      this.hideNonEssentialUI();

      // 3. 启用GPS绘制
      this.isActive = true;
      logger.info('✅ 沉浸式模式已激活');

      // 4. 触发发现检测
      this.startDiscoveryDetection();

    } catch (error) {
      logger.error('❌ 进入沉浸式模式失败:', error);
      throw error;
    }
  }

  /**
   * 退出沉浸式绘制模式
   */
  async exitImmersiveMode(): Promise<void> {
    try {
      logger.info('🏁 退出沉浸式绘制模式');

      // 1. 退出全屏
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }

      // 2. 恢复UI显示
      this.restoreUI();

      // 3. 停止检测
      this.isActive = false;
      this.stopDiscoveryDetection();

      logger.info('✅ 已退出沉浸式模式');

    } catch (error) {
      logger.error('❌ 退出沉浸式模式失败:', error);
    }
  }

  /**
   * 检测附近的发现物
   */
  private startDiscoveryDetection(): void {
    if (!this.isActive) return;

    // 每隔5秒检测一次
    const detectionInterval = setInterval(() => {
      if (!this.isActive) {
        clearInterval(detectionInterval);
        return;
      }

      this.checkNearbyDiscoveries();
    }, 5000);

    logger.info('🔍 已启动发现检测系统');
  }

  /**
   * 检查附近的漂流瓶和宝藏
   */
  private async checkNearbyDiscoveries(): Promise<void> {
    try {
      // 获取当前位置
      const userPosition = await this.getCurrentUserPosition();
      if (!userPosition) return;

      // 检查漂流瓶
      await this.checkNearbyDriftBottles(userPosition);

      // 检查宝藏
      await this.checkNearbyTreasures(userPosition);

    } catch (error) {
      logger.warn('⚠️ 发现检测失败:', error);
    }
  }

  /**
   * 检查附近的漂流瓶
   */
  private async checkNearbyDriftBottles(userPosition: { lat: number; lng: number }): Promise<void> {
    try {
      // 检查用户是否已认证
      const token = AuthService.getToken();
      if (!token) {
        logger.warn('⚠️ 用户未认证，跳过漂流瓶检查');
        return;
      }

      // 调用后端API检查附近漂流瓶，添加认证头
      const response = await fetch(`/api/drift-bottles/nearby?lat=${userPosition.lat}&lng=${userPosition.lng}&radius=${this.config.discoveryRadius.driftBottle}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();

      if (data.success && data.bottles.length > 0) {
        data.bottles.forEach((bottle: any) => {
          const distance = this.calculateDistance(userPosition, {
            lat: bottle.latitude,
            lng: bottle.longitude
          });

          const discoveryEvent: DiscoveryEvent = {
            type: 'drift_bottle',
            id: bottle.id,
            distance,
            message: `发现了 ${bottle.origin_city} 的漂流瓶！`,
            timestamp: Date.now(),
            position: { lat: bottle.latitude, lng: bottle.longitude }
          };

          this.notifyDiscovery(discoveryEvent);
        });
      }
    } catch (error) {
      logger.warn('检查漂流瓶失败:', error);
    }
  }

  /**
   * 检查附近的宝藏
   */
  private async checkNearbyTreasures(userPosition: { lat: number; lng: number }): Promise<void> {
    try {
      // 检查用户是否已认证
      const token = AuthService.getToken();
      if (!token) {
        logger.warn('⚠️ 用户未认证，跳过宝藏检查');
        return;
      }

      // 调用后端API检查附近宝藏，添加认证头
      const response = await fetch(`/api/qr-treasures/nearby?lat=${userPosition.lat}&lng=${userPosition.lng}&radius=${this.config.discoveryRadius.treasure}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();

      if (data.success && data.treasures.length > 0) {
        data.treasures.forEach((treasure: any) => {
          const distance = this.calculateDistance(userPosition, {
            lat: treasure.latitude,
            lng: treasure.longitude
          });

          const discoveryEvent: DiscoveryEvent = {
            type: 'treasure',
            id: treasure.id,
            distance,
            message: `附近有宝藏！距离 ${Math.round(distance)}米`,
            timestamp: Date.now(),
            position: { lat: treasure.latitude, lng: treasure.longitude }
          };

          this.notifyDiscovery(discoveryEvent);
        });
      }
    } catch (error) {
      logger.warn('检查宝藏失败:', error);
    }
  }

  /**
   * 通知发现事件
   */
  private notifyDiscovery(event: DiscoveryEvent): void {
    logger.info(`🎯 发现${event.type === 'drift_bottle' ? '漂流瓶' : '宝藏'}:`, event);

    // 触发通知反馈
    this.triggerNotificationFeedback();

    // 通知所有监听器
    this.discoveryCallbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        logger.error('发现事件回调失败:', error);
      }
    });
  }

  /**
   * 触发通知反馈
   */
  private triggerNotificationFeedback(): void {
    if (!this.config.notifications) return;

    // 震动反馈
    if (this.config.notifications.vibration && 'vibrate' in navigator) {
      navigator.vibrate([100, 50, 100]);
    }

    // 音效（可以在这里添加音效播放逻辑）
    if (this.config.notifications.sound) {
      // TODO: 播放发现音效
      logger.info('🔔 播放发现音效');
    }
  }

  /**
   * 更新绘制统计
   */
  updateDrawingStats(stats: DrawingStats): void {
    this.statsUpdateCallbacks.forEach(callback => {
      try {
        callback(stats);
      } catch (error) {
        logger.error('统计更新回调失败:', error);
      }
    });
  }

  /**
   * 订阅发现事件
   */
  onDiscovery(callback: (event: DiscoveryEvent) => void): () => void {
    this.discoveryCallbacks.add(callback);
    return () => this.discoveryCallbacks.delete(callback);
  }

  /**
   * 订阅统计更新
   */
  onStatsUpdate(callback: (stats: DrawingStats) => void): () => void {
    this.statsUpdateCallbacks.add(callback);
    return () => this.statsUpdateCallbacks.delete(callback);
  }

  /**
   * 获取当前配置
   */
  getConfig(): ImmersiveModeConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<ImmersiveModeConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('⚙️ 沉浸式模式配置已更新');
  }

  /**
   * 检查是否处于沉浸模式
   */
  isImmersiveModeActive(): boolean {
    return this.isActive;
  }

  // 私有辅助方法
  private async requestFullscreen(): Promise<void> {
    if (document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen();
    }
  }

  private hideNonEssentialUI(): void {
    // 隐藏顶部导航、侧边栏等非必要元素
    const elementsToHide = [
      '.header',
      '.sidebar',
      '.navigation',
      '.controls:not(.immersive)'
    ];

    elementsToHide.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        (el as HTMLElement).style.display = 'none';
      });
    });
  }

  private restoreUI(): void {
    // 恢复UI显示
    const hiddenElements = document.querySelectorAll('[style*="display: none"]');
    hiddenElements.forEach(el => {
      (el as HTMLElement).style.display = '';
    });
  }

  private stopDiscoveryDetection(): void {
    // 停止发现检测逻辑
    logger.info('🛑 已停止发现检测');
  }

  private async getCurrentUserPosition(): Promise<{ lat: number; lng: number } | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          logger.warn('获取用户位置失败:', error);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 10000
        }
      );
    });
  }

  private calculateDistance(pos1: { lat: number; lng: number }, pos2: { lat: number; lng: number }): number {
    const R = 6371000; // 地球半径（米）
    const dLat = (pos2.lat - pos1.lat) * Math.PI / 180;
    const dLng = (pos2.lng - pos1.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(pos1.lat * Math.PI / 180) * Math.cos(pos2.lat * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

export default new ImmersiveModeService();