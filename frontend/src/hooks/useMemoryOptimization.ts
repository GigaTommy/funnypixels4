import { useRef, useCallback, useEffect, useMemo } from 'react';
import { logger } from '../utils/logger';

interface MemoryOptimizationConfig {
  maxPixelsInMemory: number; // 内存中最大像素数量
  cleanupInterval: number; // 清理间隔（毫秒）
  maxDistanceFromCenter: number; // 距离中心点最大距离（度）
  enableVirtualization: boolean; // 是否启用虚拟化
  enableMemoryMonitoring: boolean; // 是否启用内存监控
  virtualViewportSize: number; // 虚拟视窗大小
}

interface PixelData {
  [gridId: string]: any;
}

interface ViewportBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface MemoryStats {
  pixelCount: number;
  estimatedMemoryMB: number;
  maxPixelsInMemory: number;
  cleanupInterval: number;
  enableVirtualization: boolean;
  cacheHitRate: number;
  lastCleanupTime: number;
  memoryPressure: 'low' | 'medium' | 'high';
}

export function useMemoryOptimization(
  pixels: PixelData,
  centerLat: number,
  centerLng: number,
  viewportBounds?: ViewportBounds,
  config: Partial<MemoryOptimizationConfig> = {}
) {
  const {
    maxPixelsInMemory = 100000, // 默认最大10万个像素，匹配WebGL渲染能力
    cleanupInterval = 30000, // 30秒清理一次
    maxDistanceFromCenter = 0.1, // 距离中心0.1度
    enableVirtualization = true,
    enableMemoryMonitoring = true,
    virtualViewportSize = 0.05 // 虚拟视窗大小（度）
  } = config;

  const lastCleanupTime = useRef<number>(Date.now());
  const pixelCount = useRef<number>(0);
  const cacheHits = useRef<number>(0);
  const cacheMisses = useRef<number>(0);
  const memoryPressureLevel = useRef<'low' | 'medium' | 'high'>('low');

  // 计算距离
  const calculateDistance = useCallback((lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const dLat = lat2 - lat1;
    const dLng = lng2 - lng1;
    return Math.sqrt(dLat * dLat + dLng * dLng);
  }, []);

  // 检查像素是否在视窗内
  const isPixelInViewport = useCallback((pixel: any, bounds: ViewportBounds): boolean => {
    if (!bounds) return true;
    
    return (
      pixel.lat >= bounds.south &&
      pixel.lat <= bounds.north &&
      pixel.lng >= bounds.west &&
      pixel.lng <= bounds.east
    );
  }, []);

  // 检查像素是否在虚拟视窗内
  const isPixelInVirtualViewport = useCallback((pixel: any): boolean => {
    if (!enableVirtualization) return true;
    
    const virtualBounds = {
      north: centerLat + virtualViewportSize,
      south: centerLat - virtualViewportSize,
      east: centerLng + virtualViewportSize,
      west: centerLng - virtualViewportSize
    };
    
    return isPixelInViewport(pixel, virtualBounds);
  }, [centerLat, centerLng, virtualViewportSize, enableVirtualization, isPixelInViewport]);

  // 智能清理算法
  const intelligentCleanup = useCallback((pixels: PixelData): PixelData => {
    const now = Date.now();
    const pixelEntries = Object.entries(pixels);
    
    if (pixelEntries.length <= maxPixelsInMemory) {
      return pixels;
    }

    // 多维度评分系统
    const scoredPixels = pixelEntries.map(([gridId, pixel]) => {
      const distance = calculateDistance(centerLat, centerLng, pixel.lat, pixel.lng);
      const inViewport = viewportBounds ? isPixelInViewport(pixel, viewportBounds) : false;
      const inVirtualViewport = isPixelInVirtualViewport(pixel);
      const age = now - (pixel.timestamp || now);
      
      // 计算综合评分（越高越重要）
      let score = 0;
      
      // 距离评分（越近分数越高）
      score += Math.max(0, 100 - distance * 1000);
      
      // 视窗内加分
      if (inViewport) score += 50;
      if (inVirtualViewport) score += 30;
      
      // 时间评分（越新分数越高）
      score += Math.max(0, 20 - age / (24 * 60 * 60 * 1000)); // 按天计算
      
      return {
        gridId,
        pixel,
        score,
        distance,
        inViewport,
        inVirtualViewport
      };
    });

    // 按评分排序
    scoredPixels.sort((a, b) => b.score - a.score);

    // 保留评分最高的像素
    const pixelsToKeep = scoredPixels.slice(0, maxPixelsInMemory);
    
    const cleanedPixels: PixelData = {};
    pixelsToKeep.forEach(({ gridId, pixel }) => {
      cleanedPixels[gridId] = pixel;
    });

    const removedCount = pixelEntries.length - pixelsToKeep.length;
    if (removedCount > 0) {
      logger.info(`🧹 智能内存清理: 清理了 ${removedCount} 个像素，保留 ${pixelsToKeep.length} 个`);
      
      // 更新内存压力等级
      const memoryUsage = (pixelsToKeep.length * 200) / 1024 / 1024; // MB
      if (memoryUsage > 50) {
        memoryPressureLevel.current = 'high';
      } else if (memoryUsage > 20) {
        memoryPressureLevel.current = 'medium';
      } else {
        memoryPressureLevel.current = 'low';
      }
    }

    return cleanedPixels;
  }, [centerLat, centerLng, maxPixelsInMemory, calculateDistance, viewportBounds, isPixelInViewport, isPixelInVirtualViewport]);

  // 虚拟化渲染 - 只返回视窗内的像素
  const virtualizedPixels = useMemo(() => {
    if (!enableVirtualization || !viewportBounds) {
      return pixels;
    }

    const virtualPixels: PixelData = {};
    Object.entries(pixels).forEach(([gridId, pixel]) => {
      if (isPixelInViewport(pixel, viewportBounds)) {
        virtualPixels[gridId] = pixel;
      }
    });

    cacheHits.current++;
    return virtualPixels;
  }, [pixels, viewportBounds, enableVirtualization, isPixelInViewport]);

  // 定期清理 - 修复：这里不应该自动清理，应该由外部组件管理
  useEffect(() => {
    // 移除自动清理逻辑，避免与外部状态管理冲突
    // 清理应该在使用时显式调用
  }, []);

  // 内存监控
  useEffect(() => {
    if (!enableMemoryMonitoring) return;

    const checkMemoryUsage = () => {
      if ('memory' in performance) {
        const memoryInfo = (performance as any).memory;
        const usedMB = memoryInfo.usedJSHeapSize / 1024 / 1024;
        const totalMB = memoryInfo.totalJSHeapSize / 1024 / 1024;
        
        if (usedMB > 100) { // 超过100MB警告
          logger.warn(`⚠️ 内存使用过高: ${usedMB.toFixed(2)}MB / ${totalMB.toFixed(2)}MB`);
          
          // 触发紧急清理
          const event = new CustomEvent('emergency-memory-cleanup', {
            detail: { timestamp: Date.now(), memoryUsage: usedMB }
          });
          window.dispatchEvent(event);
        }
      }
    };

    const interval = setInterval(checkMemoryUsage, 30000); // 每30秒检查一次
    return () => clearInterval(interval);
  }, [enableMemoryMonitoring]);

  // 获取内存使用统计
  const getMemoryStats = useCallback((): MemoryStats => {
    const pixelCount = Object.keys(pixels).length;
    const estimatedMemoryMB = (pixelCount * 200) / 1024 / 1024; // 估算每个像素200字节
    const totalRequests = cacheHits.current + cacheMisses.current;
    const cacheHitRate = totalRequests > 0 ? (cacheHits.current / totalRequests) * 100 : 0;
    
    return {
      pixelCount,
      estimatedMemoryMB: Math.round(estimatedMemoryMB * 100) / 100,
      maxPixelsInMemory,
      cleanupInterval,
      enableVirtualization,
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      lastCleanupTime: lastCleanupTime.current,
      memoryPressure: memoryPressureLevel.current
    };
  }, [pixels, maxPixelsInMemory, cleanupInterval, enableVirtualization]);

  // 强制清理
  const forceCleanup = useCallback(() => {
    logger.info('🧹 强制内存清理');
    const cleanedPixels = intelligentCleanup(pixels);
    
    const event = new CustomEvent('memory-cleanup', {
      detail: { 
        timestamp: Date.now(), 
        forced: true,
        pixels: cleanedPixels
      }
    });
    window.dispatchEvent(event);
    
    return cleanedPixels;
  }, [pixels, intelligentCleanup]);

  // 紧急清理
  const emergencyCleanup = useCallback(() => {
    logger.info('🚨 紧急内存清理');
    
    // 只保留视窗内的像素
    const emergencyPixels: PixelData = {};
    Object.entries(pixels).forEach(([gridId, pixel]) => {
      if (viewportBounds && isPixelInViewport(pixel, viewportBounds)) {
        emergencyPixels[gridId] = pixel;
      }
    });
    
    const event = new CustomEvent('emergency-memory-cleanup', {
      detail: { 
        timestamp: Date.now(), 
        pixels: emergencyPixels,
        originalCount: Object.keys(pixels).length,
        cleanedCount: Object.keys(emergencyPixels).length
      }
    });
    window.dispatchEvent(event);
    
    return emergencyPixels;
  }, [pixels, viewportBounds, isPixelInViewport]);

  // 缓存统计
  const getCacheStats = useCallback(() => {
    const totalRequests = cacheHits.current + cacheMisses.current;
    return {
      hits: cacheHits.current,
      misses: cacheMisses.current,
      total: totalRequests,
      hitRate: totalRequests > 0 ? (cacheHits.current / totalRequests) * 100 : 0
    };
  }, []);

  return {
    virtualizedPixels,
    intelligentCleanup,
    getMemoryStats,
    forceCleanup,
    emergencyCleanup,
    getCacheStats,
    config: {
      maxPixelsInMemory,
      cleanupInterval,
      maxDistanceFromCenter,
      enableVirtualization,
      enableMemoryMonitoring,
      virtualViewportSize
    }
  };
}
