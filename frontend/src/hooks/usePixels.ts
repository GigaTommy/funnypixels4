import { useState, useEffect, useCallback, useRef } from 'react';
import { logger } from '../utils/logger';
import { PixelAPI, Pixel } from '../services/api';
import socket from '../services/socket';
import { useMemoryOptimization } from './useMemoryOptimization';

interface UsePixelsReturn {
  pixels: { [gridId: string]: Pixel };
  isLoading: boolean;
  error: string | null;
  createPixel: (lat: number, lng: number, patternId: string, sessionId?: string | null) => Promise<boolean>;
  loadPixelsInBounds: (minLat: number, maxLat: number, minLng: number, maxLng: number) => Promise<void>;
  loadAllPixels: () => Promise<void>;
  getPixel: (lat: number, lng: number) => Promise<Pixel | null>;
  memoryStats: any;
  forceCleanup: () => void;
}

export function usePixels(
  centerLat: number = 39.9042,
  centerLng: number = 116.4074
): UsePixelsReturn {
  const [pixels, setPixels] = useState<{ [gridId: string]: Pixel }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 内存优化 - 恢复原始设置
  const { intelligentCleanup, getMemoryStats, forceCleanup } = useMemoryOptimization(
    pixels,
    centerLat,
    centerLng,
    undefined, // viewportBounds
    {
      maxPixelsInMemory: 10000, // 1万个像素
      cleanupInterval: 30000, // 30秒清理一次
      maxDistanceFromCenter: 0.2, // 20km范围内
      enableVirtualization: true // 启用虚拟化
    }
  );

  // 防抖引用
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastLoadTimeRef = useRef<number>(0);

  // 创建像素
  const createPixel = useCallback(async (lat: number, lng: number, patternId: string, sessionId?: string | null): Promise<boolean> => {
    try {
      setError(null);

      // 🆕 传递sessionId到PixelAPI
      const result = await PixelAPI.createPixel(lat, lng, patternId, 0, 0, 0, false, sessionId);

      // 更新本地像素状态
      setPixels(prev => {
        const newPixels = {
          ...prev,
          [result.pixel.grid_id]: result.pixel
        };

        // 如果像素数量过多，进行清理
        if (Object.keys(newPixels).length > 10000) {
          return intelligentCleanup(newPixels);
        }

        return newPixels;
      });

      logger.info('像素创建成功:', result);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '创建像素失败';
      setError(errorMessage);
      logger.error('创建像素失败:', err);
      return false;
    }
  }, [intelligentCleanup]);

  /**
   * Grid ID 计算 - 与后端保持一致
   */
  const calculateGridId = useCallback((lat: number, lng: number): string => {
    const GRID_SIZE = 0.0001;
    const EPSILON = 1e-10;
    const latRaw = (lat + 90) / GRID_SIZE;
    const lngRaw = (lng + 180) / GRID_SIZE;
    const latGridIndex = Math.floor(latRaw + EPSILON);
    const lngGridIndex = Math.floor(lngRaw + EPSILON);
    return `grid_${lngGridIndex}_${latGridIndex}`;
  }, []);

  /**
   * 计算视野内的网格ID
   */
  const calculateVisibleGridIds = useCallback((
    minLat: number,
    maxLat: number,
    minLng: number,
    maxLng: number,
    zoom: number
  ): string[] => {
    const GRID_SIZE = 0.0001;

    // 根据缩放级别调整采样率
    let step: number;
    if (zoom < 13) {
      step = 100;
    } else if (zoom < 15) {
      step = 10;
    } else if (zoom < 17) {
      step = 5;
    } else {
      step = 1;
    }

    const gridIds: string[] = [];
    for (let lat = Math.floor(minLat / GRID_SIZE) * GRID_SIZE; lat <= maxLat; lat += GRID_SIZE * step) {
      for (let lng = Math.floor(minLng / GRID_SIZE) * GRID_SIZE; lng <= maxLng; lng += GRID_SIZE * step) {
        gridIds.push(calculateGridId(lat, lng));
      }
    }

    return gridIds;
  }, [calculateGridId]);

  // 防抖加载像素
  const debouncedLoadPixels = useCallback(async (
    minLat: number,
    maxLat: number,
    minLng: number,
    maxLng: number
  ): Promise<void> => {
    const now = Date.now();

    // 防抖：如果距离上次加载时间太短，取消之前的请求
    if (now - lastLoadTimeRef.current < 500) {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }

      loadTimeoutRef.current = setTimeout(() => {
        loadPixelsInBounds(minLat, maxLat, minLng, maxLng);
      }, 500);
      return;
    }

    lastLoadTimeRef.current = now;

    try {
      setIsLoading(true);
      setError(null);

      // 使用默认缩放级别计算网格
      const zoom = 18;
      const gridIds = calculateVisibleGridIds(minLat, maxLat, minLng, maxLng, zoom);

      // 恢复原始查询数量
      const maxGridIds = 1000; // 限制最多查询1000个网格
      const queryGridIds = gridIds.length > maxGridIds
        ? gridIds.filter((_, index) => index % Math.ceil(gridIds.length / maxGridIds) === 0)
        : gridIds;

      // 🔥 使用 grid_id 批量查询
      const pixelData = await PixelAPI.getPixelsBatch(queryGridIds);

      // 转换为需要的格式
      const flattenedPixels: { [gridId: string]: Pixel } = {};
      let totalPixels = 0;

      for (const gridId of queryGridIds) {
        const gridData = pixelData[gridId];
        if (gridData && gridData.pixels && Array.isArray(gridData.pixels)) {
          totalPixels += gridData.pixels.length;
          gridData.pixels.forEach((pixel: any) => {
            if (pixel && pixel.grid_id) {
              flattenedPixels[pixel.grid_id] = {
                ...pixel,
                id: pixel.id || pixel.grid_id,
                lat: typeof pixel.latitude === 'string' ? parseFloat(pixel.latitude) : pixel.latitude,
                lng: typeof pixel.longitude === 'string' ? parseFloat(pixel.longitude) : pixel.longitude,
                latitude: pixel.latitude,
                longitude: pixel.longitude
              };
            }
          });
        }
      }

      // 更新本地像素状态，并进行内存优化
      setPixels(prev => {
        const newPixels = {
          ...prev,
          ...flattenedPixels
        };

        // 如果像素数量过多，进行清理
        if (Object.keys(newPixels).length > 10000) {
          return intelligentCleanup(newPixels);
        }

        return newPixels;
      });

      logger.info(`✅ 加载了 ${totalPixels} 个像素 (查询了 ${queryGridIds.length} 个网格)`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加载像素失败';
      setError(errorMessage);
      logger.error('加载像素失败:', err);
    } finally {
      setIsLoading(false);
    }
  }, [intelligentCleanup, calculateVisibleGridIds]);

  // 加载指定范围内的像素
  const loadPixelsInBounds = useCallback(async (
    minLat: number, 
    maxLat: number, 
    minLng: number, 
    maxLng: number
  ): Promise<void> => {
    await debouncedLoadPixels(minLat, maxLat, minLng, maxLng);
  }, [debouncedLoadPixels]);

  // 加载所有像素（已弃用，改为按需加载）
  const loadAllPixels = useCallback(async (): Promise<void> => {
    logger.warn('⚠️ loadAllPixels 已弃用，请使用 loadPixelsInBounds 进行按需加载');
    
    try {
      setIsLoading(true);
      setError(null);
      
      // 只加载当前视野范围内的像素
      const bounds = {
        minLat: centerLat - 0.1,
        maxLat: centerLat + 0.1,
        minLng: centerLng - 0.1,
        maxLng: centerLng + 0.1
      };
      
      await loadPixelsInBounds(bounds.minLat, bounds.maxLat, bounds.minLng, bounds.maxLng);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加载像素失败';
      setError(errorMessage);
      logger.error('加载像素失败:', err);
    } finally {
      setIsLoading(false);
    }
  }, [centerLat, centerLng, loadPixelsInBounds]);

  // 获取单个像素
  const getPixel = useCallback(async (lat: number, lng: number): Promise<Pixel | null> => {
    try {
      setError(null);
      
      const result = await PixelAPI.getPixel(lat, lng);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取像素失败';
      setError(errorMessage);
      logger.error('获取像素失败:', err);
      return null;
    }
  }, []);

  // 监听WebSocket像素更新
  useEffect(() => {
    const handlePixelUpdate = (data: any) => {
      // 后端发送的数据结构是: { gridId, lat, lng, color, patternId, userId, drawType, timestamp }
      // 需要构造成Pixel对象格式
      const pixel: Pixel = {
        id: data.gridId, // 使用gridId作为临时id
        grid_id: data.gridId,
        lat: data.lat,
        lng: data.lng,
        latitude: data.lat,
        longitude: data.lng,
        color: data.color, // 重要：保持emoji信息
        pattern_id: data.patternId,
        user_id: data.userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      setPixels(prev => {
        const newPixels = {
          ...prev,
          [data.gridId]: pixel
        };

        // 如果像素数量过多，进行清理
        if (Object.keys(newPixels).length > 10000) {
          return intelligentCleanup(newPixels);
        }

        return newPixels;
      });
      logger.info('收到像素更新:', data, '构造的像素对象:', pixel);
    };

    socket.on('pixelUpdate', handlePixelUpdate);
    
    return () => {
      socket.off('pixelUpdate', handlePixelUpdate);
    };
  }, [intelligentCleanup]);

  // 监听内存清理事件
  useEffect(() => {
    const handleMemoryCleanup = () => {
      setPixels(prev => {
        if (Object.keys(prev).length > 5000) {
          logger.info('🧹 触发内存清理');
          return intelligentCleanup(prev);
        }
        return prev;
      });
    };

    window.addEventListener('memory-cleanup', handleMemoryCleanup);
    
    return () => {
      window.removeEventListener('memory-cleanup', handleMemoryCleanup);
    };
  }, [intelligentCleanup]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
    };
  }, []);

  // 🔥 自动加载视野范围内的像素
  useEffect(() => {
    const loadExistingPixels = async () => {
      try {
        logger.info('🔍 [AUTO] 开始加载视野范围内的像素...');

        // 使用当前视野范围加载像素
        const bounds = {
          minLat: centerLat - 0.1,
          maxLat: centerLat + 0.1,
          minLng: centerLng - 0.1,
          maxLng: centerLng + 0.1
        };

        await loadPixelsInBounds(bounds.minLat, bounds.maxLat, bounds.minLng, bounds.maxLng);

        logger.info('✅ [AUTO] 视野范围内像素加载完成');
      } catch (error) {
        logger.error('❌ [AUTO] 加载像素失败:', error);
      }
    };

    // 延迟加载，确保地图已初始化
    const timeoutId = setTimeout(loadExistingPixels, 2000);

    return () => clearTimeout(timeoutId);
  }, [centerLat, centerLng, loadPixelsInBounds]);

  return {
    pixels,
    isLoading,
    error,
    createPixel,
    loadPixelsInBounds,
    loadAllPixels,
    getPixel,
    memoryStats: getMemoryStats(),
    forceCleanup
  };
}
