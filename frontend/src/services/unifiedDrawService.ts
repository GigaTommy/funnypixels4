import { unifiedSessionManager, type DrawingMode } from './unifiedSessionManager';
import { pixelDrawService } from './pixelDrawService';
import { logger } from '../utils/logger';

export interface DrawOptions {
  lat: number;
  lng: number;
  color?: string;
  patternId?: string;
  gridId?: string;
  source?: 'gps' | 'manual' | 'test';
  coordinateSystem?: 'WGS84' | 'GCJ02'; // 新增坐标系统标识
}

export interface DrawResult {
  success: boolean;
  pixel?: {
    id: string;
    x: number;
    y: number;
    color: string;
    patternId: string;
  };
  message?: string;
  error?: string;
  consumedPoints?: number;
}

class UnifiedDrawService {
  private isInitialized = false;
  private useMapLibreGL: boolean = false;

  // 初始化服务
  initialize(userId: string) {
    unifiedSessionManager.setUserId(userId);

    // 检测是否使用MapLibre GL
    this.useMapLibreGL = import.meta.env.VITE_USE_MAPLIBRE === 'true';

    this.isInitialized = true;
    logger.info(`✅ 统一绘制服务已初始化 (${this.useMapLibreGL ? 'MapLibre GL' : 'AMap'})`);
  }

  // 检查是否已初始化
  private checkInitialized(): boolean {
    if (!this.isInitialized) {
      logger.error('❌ 统一绘制服务未初始化');
      return false;
    }
    return true;
  }

  // 统一的绘制入口
  async drawPixel(options: DrawOptions): Promise<DrawResult> {
    if (!this.checkInitialized()) {
      return {
        success: false,
        error: '绘制服务未初始化'
      };
    }

    const currentSession = unifiedSessionManager.getCurrentSession();
    const currentMode = unifiedSessionManager.getCurrentMode();

    // 检查会话状态
    if (!currentSession || currentSession.status !== 'active') {
      return {
        success: false,
        error: '没有活跃的绘制会话'
      };
    }

    // 验证绘制权限
    const hasPermission = await this.checkDrawPermission(options.source || currentMode);
    if (!hasPermission) {
      return {
        success: false,
        error: '没有绘制权限'
      };
    }

    try {
      logger.info(`🎨 开始绘制像素: 模式=${currentMode}, 坐标=(${options.lat}, ${options.lng})`);

      // 根据模式调用不同的绘制方法
      let pixelResult: any;
      const drawStartTime = Date.now();

      switch (currentMode) {
        case 'gps':
        case 'test':
          pixelResult = await this.drawGpsPixel(options);
          break;
        case 'manual':
          pixelResult = await this.drawManualPixel(options);
          break;
        default:
          throw new Error(`不支持的绘制模式: ${currentMode}`);
      }

      const drawDuration = Date.now() - drawStartTime;

      if (pixelResult && pixelResult.success) {
        // 🔥 修复：后端返回的数据结构是 { success: true, data: { pixel: {...}, consumptionResult: {...} } }
        // 需要从 pixelResult.data 中提取实际的 pixel 和 consumptionResult
        const actualPixel = pixelResult.data?.pixel;
        const consumptionResult = pixelResult.data?.consumptionResult;

        logger.debug('🔍 pixelResult 数据结构:', {
          hasData: !!pixelResult.data,
          hasPixel: !!actualPixel,
          hasConsumptionResult: !!consumptionResult,
          pixelResultKeys: Object.keys(pixelResult),
          dataKeys: pixelResult.data ? Object.keys(pixelResult.data) : []
        });

        // 记录到会话（功能暂未实现）
        const sessionRecordSuccess = true; // 暂时返回成功

        if (!sessionRecordSuccess) {
          logger.warn('⚠️ 像素绘制成功，但记录到会话失败');
        }

        logger.info(`✅ 像素绘制成功: 模式=${currentMode}, 耗时=${drawDuration}ms`);

        return {
          success: true,
          pixel: actualPixel,
          message: '绘制成功',
          consumedPoints: consumptionResult?.consumed || 1
        };

      } else {
        throw new Error(pixelResult?.error || '绘制失败');
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      logger.error('❌ 绘制像素失败:', errorMsg);

      return {
        success: false,
        error: errorMsg
      };
    }
  }

  // GPS绘制
  private async drawGpsPixel(options: DrawOptions): Promise<any> {
    const sessionId = unifiedSessionManager.getCurrentSessionId();
    const drawParams = {
      lat: options.lat,
      lng: options.lng,
      color: options.color,
      patternId: options.patternId,
      sessionId: sessionId
    };

    try {
      // 统一使用pixelDrawService，支持WGS84坐标
      logger.debug('使用统一绘制服务');
      return await pixelDrawService.drawPixelGps(drawParams);
    } catch (error) {
      logger.error('GPS绘制失败:', error);
      throw error;
    }
  }

  // 手动绘制
  private async drawManualPixel(options: DrawOptions): Promise<any> {
    const sessionId = unifiedSessionManager.getCurrentSessionId();
    const drawParams = {
      lat: options.lat,
      lng: options.lng,
      color: options.color,
      patternId: options.patternId,
      sessionId: sessionId
    };

    try {
      // 统一使用pixelDrawService，支持WGS84坐标
      logger.debug('使用统一手动绘制服务');
      return await pixelDrawService.drawPixelManual(drawParams);
    } catch (error) {
      logger.error('手动绘制失败:', error);
      throw error;
    }
  }

  // 检查绘制权限
  private async checkDrawPermission(source: DrawingMode): Promise<boolean> {
    try {
      const currentSession = unifiedSessionManager.getCurrentSession();
      const currentMode = unifiedSessionManager.getCurrentMode();

      // 没有活跃会话
      if (!currentSession || currentSession.status !== 'active') {
        logger.warn('⚠️ 没有活跃会话，无法绘制');
        return false;
      }

      // 检查模式匹配
      if (source && source !== currentMode) {
        logger.warn(`⚠️ 绘制源模式(${source})与当前模式(${currentMode})不匹配`);
        return false;
      }

      // TODO: 实现权限检查
      // 暂时跳过权限检查
      logger.debug('权限检查功能暂未实现');

      return true;

    } catch (error) {
      logger.error('❌ 检查绘制权限失败:', error);
      return false;
    }
  }

  // 批量绘制
  async drawPixelsBatch(pixels: DrawOptions[]): Promise<DrawResult[]> {
    if (!this.checkInitialized()) {
      return pixels.map(() => ({
        success: false,
        error: '绘制服务未初始化'
      }));
    }

    const currentSession = unifiedSessionManager.getCurrentSession();
    if (!currentSession || currentSession.status !== 'active') {
      return pixels.map(() => ({
        success: false,
        error: '没有活跃的绘制会话'
      }));
    }

    logger.info(`🎨 开始批量绘制: ${pixels.length}个像素`);

    const results: DrawResult[] = [];
    const batchSize = 5; // 每批处理5个像素

    for (let i = 0; i < pixels.length; i += batchSize) {
      const batch = pixels.slice(i, i + batchSize);

      // 并行处理当前批次
      const batchPromises = batch.map(pixel => this.drawPixel(pixel));
      const batchResults = await Promise.all(batchPromises);

      results.push(...batchResults);

      // 批次间稍作延迟，避免过载
      if (i + batchSize < pixels.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const successCount = results.filter(r => r.success).length;
    logger.info(`✅ 批量绘制完成: ${successCount}/${pixels.length} 成功`);

    return results;
  }

  // 撤销上一次绘制功能暂未实现
  // async undoLastDraw(): Promise<boolean> {
  //   if (!this.checkInitialized()) {
  //     return false;
  //   }
  //   try {
  //     logger.info('↩️ 撤销上一次绘制');
  //     // TODO: 实现撤销功能
  //     return false;
  //   } catch (error) {
  //     logger.error('❌ 撤销绘制失败:', error);
  //     return false;
  //   }
  // }

  // 获取绘制统计
  async getDrawStatistics(): Promise<any> {
    if (!this.checkInitialized()) {
      return null;
    }

    try {
      const sessionStats = await unifiedSessionManager.getSessionStatistics();
      // TODO: 从统一会话管理器获取用户统计信息
      return {
        session: sessionStats,
        user: {
          totalPixels: 0, // TODO: 从会话管理器获取
          pixelPoints: 0,
          todayPixels: 0
        },
        mode: unifiedSessionManager.getCurrentMode(),
        sessionDuration: sessionStats?.session?.duration || 0
      };

    } catch (error) {
      logger.error('❌ 获取绘制统计失败:', error);
      return null;
    }
  }

  // 检查绘制状态
  async checkDrawStatus(): Promise<{
    canDraw: boolean;
    reason?: string;
    pixelPoints?: number;
    cooldownUntil?: Date;
  }> {
    if (!this.checkInitialized()) {
      return {
        canDraw: false,
        reason: '绘制服务未初始化'
      };
    }

    try {
      const currentSession = unifiedSessionManager.getCurrentSession();

      // 检查会话状态
      if (!currentSession || currentSession.status !== 'active') {
        return {
          canDraw: false,
          reason: '没有活跃的绘制会话'
        };
      }

      // TODO: 实现用户状态检查
      // 暂时简化状态检查
      logger.debug('用户状态检查功能暂未实现，暂时返回可绘制状态');

      return {
        canDraw: true,
        pixelPoints: 100 // 暂时返回默认值
      };

    } catch (error) {
      logger.error('❌ 检查绘制状态失败:', error);
      return {
        canDraw: false,
        reason: '检查状态失败'
      };
    }
  }

  // 预加载绘制资源
  async preloadResources(): Promise<void> {
    if (!this.checkInitialized()) {
      return;
    }

    try {
      logger.info('📦 绘制资源初始化完成');

      // TODO: 实现资源预加载功能

      logger.info('✅ 绘制资源初始化完成');

    } catch (error) {
      logger.error('❌ 预加载绘制资源失败:', error);
    }
  }

  // 清理资源
  cleanup(): void {
    this.isInitialized = false;
    logger.info('🧹 统一绘制服务已清理');
  }
}

// 创建单例实例
export const unifiedDrawService = new UnifiedDrawService();

// 导出类型
export type { UnifiedDrawService };