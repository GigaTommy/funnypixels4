/**
 * GPS集成示例 - 展示如何在AmapCanvas中集成增强GPS服务
 * 这个文件展示了集成方法，可以参考这个代码修改AmapCanvas.tsx
 */

import { enhancedGpsService, EnhancedGPSPosition, GPSDrawResult } from '../services/enhancedGpsService';
import { pixelDrawService } from '../services/pixelDrawService';
import { logger } from '../utils/logger';

/**
 * GPS集成管理器
 */
export class GPSIntegrationManager {
  private isInitialized = false;
  private mapInstance: any = null;
  private gpsMarker: any = null;
  private accuracyCircle: any = null;

  /**
   * 初始化GPS集成
   */
  async initialize(mapInstance: any) {
    if (this.isInitialized) {
      return;
    }

    this.mapInstance = mapInstance;

    // 1. 注册位置更新回调
    enhancedGpsService.onPositionUpdate(this.handlePositionUpdate.bind(this));

    // 2. 注册绘制请求回调
    enhancedGpsService.onDrawRequest(this.handleDrawRequest.bind(this));

    this.isInitialized = true;
    logger.debug('✅ GPS集成管理器初始化完成');
  }

  /**
   * 开始GPS跟踪
   */
  async startTracking(): Promise<boolean> {
    if (!this.isInitialized) {
      throw new Error('GPS集成管理器未初始化');
    }

    const success = await enhancedGpsService.startTracking();
    if (success) {
      this.createGPSMarker();
      logger.debug('✅ GPS跟踪启动成功');
    } else {
      logger.error('❌ GPS跟踪启动失败');
    }

    return success;
  }

  /**
   * 停止GPS跟踪
   */
  stopTracking() {
    enhancedGpsService.stopTracking();
    this.removeGPSMarker();
    logger.debug('🛑 GPS跟踪已停止');
  }

  /**
   * 处理位置更新
   */
  private handlePositionUpdate(position: EnhancedGPSPosition) {
    logger.debug(`📍 位置更新: (${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}) 精度:${position.accuracy.toFixed(1)}m 置信度:${position.confidence.toFixed(2)}`);

    // 1. 更新地图上的GPS标记
    this.updateGPSMarker(position);

    // 2. 移动地图到当前位置（可选）
    this.moveMapToPosition(position);
  }

  /**
   * 处理绘制请求
   */
  private async handleDrawRequest(result: GPSDrawResult) {
    logger.debug(`🎨 收到绘制请求: 网格${result.gridId} 位置(${result.position.latitude.toFixed(6)}, ${result.position.longitude.toFixed(6)})`);

    try {
      // 执行像素绘制
      const drawResult = await pixelDrawService.drawPixelGps({
        lat: result.position.latitude,
        lng: result.position.longitude,
        // 可以在这里添加其他绘制参数，如颜色、图案等
      });

      // 通知GPS服务绘制结果
      enhancedGpsService.markDrawResult(result.gridId, drawResult.success);

      if (drawResult.success) {
        logger.debug(`✅ GPS像素绘制成功: 网格${result.gridId}`);
        // 这里可以添加成功后的UI更新逻辑
        this.onDrawSuccess(result.position, result.gridId);
      } else {
        logger.error(`❌ GPS像素绘制失败: 网格${result.gridId}, 错误: ${drawResult.error}`);
        this.onDrawError(result.position, result.gridId, drawResult.error || '绘制失败');
      }

    } catch (error) {
      logger.error(`❌ GPS绘制异常: 网格${result.gridId}`, error);
      enhancedGpsService.markDrawResult(result.gridId, false);
      this.onDrawError(result.position, result.gridId, '绘制异常');
    }
  }

  /**
   * 创建GPS标记
   */
  private createGPSMarker() {
    if (!this.mapInstance || !(window as any).AMap) {
      return;
    }

    const AMap = (window as any).AMap;

    // 创建GPS定位图标
    this.gpsMarker = new AMap.Marker({
      position: [0, 0],
      map: this.mapInstance,
      icon: new AMap.Icon({
        image: 'data:image/svg+xml,' + encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="8" fill="#2196F3" stroke="#fff" stroke-width="2"/>
            <circle cx="12" cy="12" r="3" fill="#fff"/>
          </svg>
        `),
        size: new AMap.Size(24, 24),
        imageSize: new AMap.Size(24, 24)
      }),
      zIndex: 2000,
      title: 'GPS定位点'
    });

    // 创建精度圆圈
    this.accuracyCircle = new AMap.Circle({
      center: [0, 0],
      radius: 10,
      map: this.mapInstance,
      fillColor: '#2196F3',
      fillOpacity: 0.1,
      strokeColor: '#2196F3',
      strokeOpacity: 0.5,
      strokeWeight: 1,
      zIndex: 1999
    });

    logger.debug('🎯 GPS标记已创建');
  }

  /**
   * 移除GPS标记
   */
  private removeGPSMarker() {
    if (this.gpsMarker && this.mapInstance) {
      this.mapInstance.remove(this.gpsMarker);
      this.gpsMarker = null;
    }

    if (this.accuracyCircle && this.mapInstance) {
      this.mapInstance.remove(this.accuracyCircle);
      this.accuracyCircle = null;
    }

    logger.debug('🗑️ GPS标记已移除');
  }

  /**
   * 更新GPS标记位置
   */
  private updateGPSMarker(position: EnhancedGPSPosition) {
    if (!this.gpsMarker || !this.accuracyCircle) {
      return;
    }

    const lnglat = [position.longitude, position.latitude];

    // 更新标记位置
    this.gpsMarker.setPosition(lnglat);

    // 更新精度圆圈
    this.accuracyCircle.setCenter(lnglat);
    this.accuracyCircle.setRadius(position.accuracy);

    // 根据置信度调整标记样式
    const opacity = Math.max(0.3, position.confidence);
    this.gpsMarker.setOpacity(opacity);
  }

  /**
   * 移动地图到位置
   */
  private moveMapToPosition(position: EnhancedGPSPosition) {
    if (!this.mapInstance) {
      return;
    }

    // 只有在置信度较高时才移动地图
    if (position.confidence > 0.7) {
      this.mapInstance.panTo([position.longitude, position.latitude]);
    }
  }

  /**
   * 绘制成功回调
   */
  private onDrawSuccess(position: EnhancedGPSPosition, gridId: string) {
    // 这里可以添加绘制成功的UI反馈
    // 例如：显示绿色闪光效果、播放音效等
    logger.debug(`🎉 网格 ${gridId} 绘制成功反馈`);
  }

  /**
   * 绘制错误回调
   */
  private onDrawError(position: EnhancedGPSPosition, gridId: string, error: string) {
    // 这里可以添加绘制失败的UI反馈
    // 例如：显示红色提示、记录错误日志等
    logger.warn(`⚠️ 网格 ${gridId} 绘制失败: ${error}`);
  }

  /**
   * 获取状态信息
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      gpsService: enhancedGpsService.getStatus()
    };
  }

  /**
   * 清理资源
   */
  destroy() {
    this.stopTracking();
    this.removeGPSMarker();
    this.isInitialized = false;
    this.mapInstance = null;
  }
}

/**
 * 使用示例
 */
export const gpsUsageExample = {
  /**
   * 在React组件中的使用方法
   */
  useInReactComponent: `
    // 在AmapCanvas.tsx中使用
    const gpsManager = useRef<GPSIntegrationManager | null>(null);

    // 地图初始化时
    useEffect(() => {
      if (mapRef.current && !gpsManager.current) {
        gpsManager.current = new GPSIntegrationManager();
        gpsManager.current.initialize(mapRef.current);
      }
    }, [isMapLoaded]);

    // 开启GPS时
    const enableGPS = async () => {
      if (gpsManager.current) {
        const success = await gpsManager.current.startTracking();
        if (success) {
          setGpsEnabled(true);
        }
      }
    };

    // 关闭GPS时
    const disableGPS = () => {
      if (gpsManager.current) {
        gpsManager.current.stopTracking();
        setGpsEnabled(false);
      }
    };

    // 组件卸载时
    useEffect(() => {
      return () => {
        if (gpsManager.current) {
          gpsManager.current.destroy();
        }
      };
    }, []);
  `,

  /**
   * 配置说明
   */
  configuration: `
    // 可以在enhancedGpsService.ts中调整这些参数：

    GPS_CONFIG.DRAWING = {
      GRID_ENTRY_THRESHOLD: 8,  // 进入网格多少米内触发绘制（推荐5-10米）
      TIME_IN_GRID: 2000,       // 在网格内停留多久后绘制（推荐1-3秒）
      MIN_ACCURACY: 25,         // 最小精度要求（推荐15-30米）
      CONFIDENCE_THRESHOLD: 0.6 // 置信度阈值（推荐0.5-0.8）
    };
  `
};

export default GPSIntegrationManager;