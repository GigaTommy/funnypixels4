import { useState, useEffect, useCallback } from 'react';
import { logger } from '../utils/logger';
import { io, Socket } from 'socket.io-client';
import { PixelAPI } from '../services/api';
import { patternAssetsService } from '../services/patternAssetsService';

// 像素数据类型
export interface Pixel {
  id: string;
  grid_id: string;
  lat: number;
  lng: number;
  latitude?: number;
  longitude?: number;
  color?: string;
  pattern_id?: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * 优化版 usePixels Hook - 适配 MapLibreTileLayerManagerOptimized
 * 新的图层管理器会自动加载视窗内的像素，这个hook主要负责：
 * 1. 创建新像素
 * 2. 监听WebSocket更新
 * 3. 管理本地像素状态（用于其他组件）
 */
export function usePixelsOptimized(centerLat: number, centerLng: number) {
  const [pixels, setPixels] = useState<Record<string, Pixel>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  // 创建单个像素
  const createPixel = useCallback(async (lat: number, lng: number, patternId?: string): Promise<Pixel | null> => {
    try {
      setError(null);

      // 计算网格ID - 与后端保持一致的带偏移计算方式
      const GRID_SIZE = 0.0001;
      const EPSILON = 1e-10;
      const latRaw = (lat + 90) / GRID_SIZE;
      const lngRaw = (lng + 180) / GRID_SIZE;
      const latGridIndex = Math.floor(latRaw + EPSILON);
      const lngGridIndex = Math.floor(lngRaw + EPSILON);
      const gridId = `grid_${lngGridIndex}_${latGridIndex}`;

      const pixelData = {
        latitude: lat,
        longitude: lng,
        gridId: gridId,
        patternId: patternId,
        renderType: 'color'
      };

      const result = await PixelAPI.createPixel(
        lat,
        lng,
        patternId || '',
        0, // patternAnchorX
        0, // patternAnchorY
        0, // patternRotation
        false // patternMirror
      );

      // 立即更新本地状态
      if (result) {
        setPixels(prev => ({
          ...prev,
          [result.id]: result
        }));

        // 如果有优化图层管理器，也通知它更新
        if ((window as any).globalTileLayerManager) {
          (window as any).globalTileLayerManager.updatePixel(result);
        }
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '创建像素失败';
      setError(errorMessage);
      logger.error('创建像素失败:', err);
      return null;
    }
  }, []);

  // 获取单个像素（网格查询）
  const getPixel = useCallback(async (lat: number, lng: number): Promise<Pixel | null> => {
    try {
      setError(null);

      const gridId = `grid_${Math.floor(lat / 0.0001)}_${Math.floor(lng / 0.0001)}`;

      // TODO: getPixelByGridId 方法不存在，需要实现或使用其他方法
      logger.warn('⚠️ getPixelByGridId 方法尚未实现');
      return null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取像素失败';
      setError(errorMessage);
      logger.error('获取像素失败:', err);
      return null;
    }
  }, []);

  // 清理内存
  const forceCleanup = useCallback(() => {
    setPixels({});
    logger.info('🧹 强制清理所有像素数据');
  }, []);

  // 初始化WebSocket连接
  useEffect(() => {
    // 创建WebSocket连接
    const newSocket = io(import.meta.env.VITE_WS_URL || 'ws://localhost:3001', {
      transports: ['polling', 'websocket'], // Try polling first, then websocket
      timeout: 20000
    });

    newSocket.on('connect', () => {
      logger.info('✅ WebSocket连接成功');
      setSocket(newSocket);
    });

    newSocket.on('disconnect', () => {
      logger.warn('⚠️ WebSocket连接断开');
      setSocket(null);
    });

    // 监听像素更新事件
    newSocket.on('pixelUpdate', (data: any) => {
      const pixel: Pixel = {
        id: data.gridId,
        grid_id: data.gridId,
        lat: data.lat,
        lng: data.lng,
        latitude: data.lat,
        longitude: data.lng,
        color: data.color,
        pattern_id: data.patternId,
        user_id: data.userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // 更新本地状态
      setPixels(prev => {
        const newPixels = {
          ...prev,
          [data.gridId]: pixel
        };
        return newPixels;
      });

      // 通知优化图层管理器更新
      if ((window as any).globalTileLayerManager) {
        (window as any).globalTileLayerManager.updatePixel(pixel);
      }

      logger.info('收到像素更新:', data);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  // 监听优化图层管理器的状态
  useEffect(() => {
    const checkLayerManager = () => {
      if ((window as any).globalTileLayerManager) {
        const stats = (window as any).globalTileLayerManager.getStats?.();
        if (stats) {
          logger.info('📊 优化图层管理器状态:', stats);
        }
      }
    };

    // 定期检查状态
    const interval = setInterval(checkLayerManager, 5000);
    return () => clearInterval(interval);
  }, []);

  // 🔥 修复：添加初始像素加载，与原版usePixels保持一致
  useEffect(() => {
    const loadInitialPixels = async () => {
      try {
        logger.info('🔍 [AUTO] 开始加载视野范围内的像素...');

        // 计算网格ID - 与后端保持一致
        const GRID_SIZE = 0.0001;
        const EPSILON = 1e-10;

        // 计算视野范围内的网格ID
        const gridIds: string[] = [];
        const range = 0.01; // 查询范围
        const minLat = centerLat - range;
        const maxLat = centerLat + range;
        const minLng = centerLng - range;
        const maxLng = centerLng + range;

        // 使用合理的采样步长
        const step = 1; // 全分辨率采样

        for (let lat = minLat; lat <= maxLat; lat += GRID_SIZE * step) {
          for (let lng = minLng; lng <= maxLng; lng += GRID_SIZE * step) {
            const latRaw = (lat + 90) / GRID_SIZE;
            const lngRaw = (lng + 180) / GRID_SIZE;
            const latGridIndex = Math.floor(latRaw + EPSILON);
            const lngGridIndex = Math.floor(lngRaw + EPSILON);
            gridIds.push(`grid_${lngGridIndex}_${latGridIndex}`);
          }
        }

        // 限制查询数量
        const maxGridIds = Math.min(gridIds.length, 1000);
        const queryGridIds = gridIds.length > maxGridIds
          ? gridIds.filter((_, index) => index % Math.ceil(gridIds.length / maxGridIds) === 0)
          : gridIds;

        logger.info(`🔍 准备查询 ${queryGridIds.length} 个网格`);

        // 批量查询像素
        const pixelData = await PixelAPI.getPixelsBatch(queryGridIds);

        // 转换为需要的格式并更新状态
        const flattenedPixels: Record<string, Pixel> = {};
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
                  lat: typeof pixel.latitude === 'string' ? parseFloat(pixel.latitude) : pixel.latitude || pixel.lat,
                  lng: typeof pixel.longitude === 'string' ? parseFloat(pixel.longitude) : pixel.longitude || pixel.lng,
                  latitude: pixel.latitude || pixel.lat,
                  longitude: pixel.longitude || pixel.lng
                };
              }
            });
          }
        }

        // 更新本地像素状态
        setPixels(flattenedPixels);
        logger.info(`✅ 加载了 ${totalPixels} 个像素 (查询了 ${queryGridIds.length} 个网格)`);

        // 如果有优化图层管理器，也通知它更新
        if ((window as any).globalTileLayerManager) {
          const pixelsArray = Object.values(flattenedPixels);
          (window as any).globalTileLayerManager.updatePixels(pixelsArray);
        }

      } catch (error) {
        logger.error('❌ [AUTO] 加载像素失败:', error);
      }
    };

    // 延迟执行，确保地图已初始化
    const timer = setTimeout(loadInitialPixels, 2000);

    return () => clearTimeout(timer);
  }, [centerLat, centerLng]);

  // 初始化时触发图层管理器加载像素（保留原有逻辑）
  useEffect(() => {
    // 延迟执行，确保地图和图层管理器已初始化
    const timer = setTimeout(() => {
      // 检查图层管理器是否存在并触发加载
      if ((window as any).globalTileLayerManager) {
        const manager = (window as any).globalTileLayerManager;

        // 使用公共方法触发加载
        if (typeof manager.forceUpdateVisibleTiles === 'function') {
          logger.info('🚀 触发图层管理器初始加载');
          manager.forceUpdateVisibleTiles();
        } else {
          logger.error('❌ 图层管理器缺少forceUpdateVisibleTiles方法');
        }
      } else {
        logger.warn('⚠️ 图层管理器未找到，将在重试后触发');
        // 如果图层管理器还未初始化，等待并重试
        setTimeout(() => {
          if ((window as any).globalTileLayerManager && typeof (window as any).globalTileLayerManager.forceUpdateVisibleTiles === 'function') {
            logger.info('🚀 延迟触发图层管理器加载');
            (window as any).globalTileLayerManager.forceUpdateVisibleTiles();
          }
        }, 1000);
      }
    }, 1500); // 等待1.5秒确保所有组件都已初始化

    return () => clearTimeout(timer);
  }, []);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [socket]);

  return {
    pixels,
    isLoading,
    error,
    createPixel,
    getPixel,
    forceCleanup,
    socket,
    // 保留旧版本的接口兼容性
    loadPixelsInBounds: async () => {
      logger.info('ℹ️ 优化图层管理器会自动加载视窗内的像素');
    },
    loadAllPixels: async () => {
      logger.info('ℹ️ 优化图层管理器会自动加载视窗内的像素');
    }
  };
}

export default usePixelsOptimized;