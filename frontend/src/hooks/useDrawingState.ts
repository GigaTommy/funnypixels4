import { useState, useEffect, useCallback, useRef } from 'react';
import { logger } from '../utils/logger';
import { UserService } from '../services/api';
import { pixelDrawService, UserDrawState } from '../services/pixelDrawService';

interface DrawingState {
  drawablePixels: number;
  isFrozen: boolean;
  freezeTimeLeft: number;
  totalPixels: number;
  isDrawing: boolean;
  itemPixelPoints: number;
  naturalPixelPoints: number;
  maxNaturalPixelPoints: number;
  lastSyncTime: number;
  isSyncing: boolean;
}

const MAX_PIXELS = 64;
const FREEZE_DURATION = 10; // 10秒冻结期

export const useDrawingState = () => {
  const [state, setState] = useState<DrawingState>({
    drawablePixels: MAX_PIXELS,
    isFrozen: false,
    freezeTimeLeft: 0,
    totalPixels: 0,
    isDrawing: false,
    itemPixelPoints: 0,
    naturalPixelPoints: MAX_PIXELS,
    maxNaturalPixelPoints: MAX_PIXELS,
    lastSyncTime: Date.now(),
    isSyncing: false
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const freezeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncTimeRef = useRef<number>(Date.now());
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTriggerTimeRef = useRef<number>(0);

  // 从后端获取用户状态 - 优化版本
  const fetchUserState = useCallback(async () => {
    try {
      // 设置同步状态
      setState(prev => ({ ...prev, isSyncing: true }));

      // 只在开发环境且不是定期同步时显示详细日志
      if (process.env.NODE_ENV === 'development' && Date.now() - lastSyncTimeRef.current > 25000) {
        logger.info('🔄 开始同步用户绘制状态...');
      }
      
      // 使用新的像素绘制服务获取用户状态
      const drawStateResult = await pixelDrawService.validateUserDrawState();
      
      if (drawStateResult.success && drawStateResult.data) {
        const userDrawState: UserDrawState = drawStateResult.data;
        
        // 计算总像素点数（道具点数 + 自然累计点数）
        const itemPoints = userDrawState.itemPoints ?? 0;
        const naturalPoints = userDrawState.naturalPoints ?? 0;
        const totalPixelPoints = itemPoints + naturalPoints;
        
        // 检查是否处于冷冻期
        const isFrozen = !userDrawState.canDraw && userDrawState.reason === '用户处于冷冻期';
        const freezeTimeLeft = userDrawState.freezeTimeLeft || 0;
        
        setState(prev => {
          // 只有当状态真正发生变化时才更新
          const newState = {
            ...prev,
            drawablePixels: totalPixelPoints,
            isFrozen,
            freezeTimeLeft,
            itemPixelPoints: itemPoints,
            naturalPixelPoints: naturalPoints,
            maxNaturalPixelPoints: MAX_PIXELS,
            lastSyncTime: Date.now(),
            isSyncing: false
          };
          
          // 检查状态是否真的发生了变化 - 使用深度比较
          const hasChanged = 
            prev.drawablePixels !== newState.drawablePixels ||
            prev.isFrozen !== newState.isFrozen ||
            prev.freezeTimeLeft !== newState.freezeTimeLeft ||
            prev.itemPixelPoints !== newState.itemPixelPoints ||
            prev.naturalPixelPoints !== newState.naturalPixelPoints ||
            prev.totalPixels !== (userDrawState.totalPoints ?? 0); // 添加totalPoints检查
          
          if (hasChanged) {
                         if (process.env.NODE_ENV === 'development') {
               logger.info('🔄 用户绘制状态已更新:', {
                 drawablePixels: newState.drawablePixels,
                 totalPixels: userDrawState.totalPoints ?? 0,
                 isFrozen: newState.isFrozen,
                 freezeTimeLeft: newState.freezeTimeLeft,
                 itemPoints,
                 naturalPoints
               });
             }
             return {
               ...newState,
               totalPixels: userDrawState.totalPoints ?? 0 // 确保更新totalPixels
             };
          } else {
            if (process.env.NODE_ENV === 'development') {
              logger.info('🔄 用户绘制状态无变化，跳过更新');
            }
            return { ...prev, isSyncing: false };
          }
        });
        
        lastSyncTimeRef.current = Date.now();
        
                 if (process.env.NODE_ENV === 'development') {
           logger.info('✅ 用户绘制状态同步成功:', {
             totalPixelPoints,
             itemPixelPoints: itemPoints,
             naturalPixelPoints: naturalPoints,
             isFrozen,
             freezeTimeLeft,
             canDraw: userDrawState.canDraw,
             reason: userDrawState.reason,
             totalPoints: userDrawState.totalPoints
           });
         }
      } else {
        logger.error('❌ 获取用户绘制状态失败:', drawStateResult.error);
        setState(prev => ({ ...prev, isSyncing: false }));
      }
    } catch (error) {
      logger.error('❌ 同步用户绘制状态失败:', error);
      setState(prev => ({ ...prev, isSyncing: false }));
    }
  }, []);

  // 定期同步用户状态 - 优化版本
  useEffect(() => {
    // 初始同步
    fetchUserState();
    
    // 每30秒同步一次用户状态（减少同步频率，提高性能）
    const syncInterval = setInterval(fetchUserState, 30000);
    
    return () => {
      clearInterval(syncInterval);
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [fetchUserState]);

  // 开始绘制
  const startDrawing = useCallback(() => {
    setState(prev => ({
      ...prev,
      isDrawing: true
    }));
    logger.info('🎨 开始绘制模式');
  }, []);

  // 停止绘制
  const stopDrawing = useCallback(() => {
    setState(prev => ({
      ...prev,
      isDrawing: false
    }));
    logger.info('⏹️ 停止绘制模式');
  }, []);

  // 消耗绘制点数（乐观更新）
  const consumePixel = useCallback(() => {
    setState(prev => {
      if (prev.drawablePixels > 0 && !prev.isFrozen && prev.isDrawing) {
        const newDrawablePixels = prev.drawablePixels - 1;
        const newTotalPixels = prev.totalPixels + 1;
        
        // 优先消耗道具点数
        let newItemPixelPoints = prev.itemPixelPoints;
        let newNaturalPixelPoints = prev.naturalPixelPoints;
        
        if (newItemPixelPoints > 0) {
          newItemPixelPoints -= 1;
        } else if (newNaturalPixelPoints > 0) {
          newNaturalPixelPoints -= 1;
        }
        
        // 如果点数消耗完，进入冻结期
        if (newDrawablePixels === 0) {
          return {
            ...prev,
            drawablePixels: newDrawablePixels,
            totalPixels: newTotalPixels,
            itemPixelPoints: newItemPixelPoints,
            naturalPixelPoints: newNaturalPixelPoints,
            isFrozen: true,
            freezeTimeLeft: FREEZE_DURATION
          };
        }
        
        return {
          ...prev,
          drawablePixels: newDrawablePixels,
          totalPixels: newTotalPixels,
          itemPixelPoints: newItemPixelPoints,
          naturalPixelPoints: newNaturalPixelPoints
        };
      }
      return prev;
    });
  }, []);

  // 回滚状态（绘制失败时）
  const rollbackState = useCallback(() => {
    setState(prev => {
      const newDrawablePixels = prev.drawablePixels + 1;
      const newTotalPixels = prev.totalPixels - 1;

      // 恢复道具点数或自然点数
      let newItemPixelPoints = prev.itemPixelPoints;
      let newNaturalPixelPoints = prev.naturalPixelPoints;

      if (prev.itemPixelPoints < MAX_PIXELS) {
        newItemPixelPoints += 1;
      } else {
        newNaturalPixelPoints += 1;
      }

      return {
        ...prev,
        drawablePixels: newDrawablePixels,
        totalPixels: newTotalPixels,
        itemPixelPoints: newItemPixelPoints,
        naturalPixelPoints: newNaturalPixelPoints
      };
    });
  }, []);

  // 手动触发像素消耗（用于实际像素放置时调用）
  const manualConsumePixel = useCallback(() => {
    if (state.drawablePixels > 0 && !state.isFrozen && state.isDrawing) {
      consumePixel();
      logger.info('💾 手动消耗像素点数');
    } else {
      logger.info('⚠️ 无法消耗像素点数:', {
        drawablePixels: state.drawablePixels,
        isFrozen: state.isFrozen,
        isDrawing: state.isDrawing
      });
    }
  }, [state.drawablePixels, state.isFrozen, state.isDrawing, consumePixel]);

  // 冻结期倒计时
  useEffect(() => {
    if (state.isFrozen && state.freezeTimeLeft > 0) {
      freezeTimerRef.current = setInterval(() => {
        setState(prev => {
          const newFreezeTimeLeft = prev.freezeTimeLeft - 1;
          
          if (newFreezeTimeLeft <= 0) {
            // 冻结期结束，恢复1个像素点数
            const newNaturalPixelPoints = Math.min(
              prev.naturalPixelPoints + 1,
              prev.maxNaturalPixelPoints
            );
            const newDrawablePixels = prev.itemPixelPoints + newNaturalPixelPoints;
            
            logger.info('🔄 冻结期结束，恢复像素点数');
            
            return {
              ...prev,
              isFrozen: false,
              freezeTimeLeft: 0,
              naturalPixelPoints: newNaturalPixelPoints,
              drawablePixels: newDrawablePixels
            };
          }
          
          return {
            ...prev,
            freezeTimeLeft: newFreezeTimeLeft
          };
        });
      }, 1000);
    } else {
      if (freezeTimerRef.current) {
        clearInterval(freezeTimerRef.current);
        freezeTimerRef.current = null;
      }
    }

    return () => {
      if (freezeTimerRef.current) {
        clearInterval(freezeTimerRef.current);
      }
    };
  }, [state.isFrozen, state.freezeTimeLeft]);

  // 强制刷新用户状态
  const forceRefreshState = useCallback(() => {
    logger.info('🔄 强制刷新用户状态');
    fetchUserState();
  }, [fetchUserState]);

  // 手动触发同步（用于绘制操作后立即同步）
  const triggerSync = useCallback(() => {
    const now = Date.now();
    
    // 添加时间间隔检查，避免过于频繁的调用
    if (now - lastTriggerTimeRef.current < 3000) {
      logger.info('🔄 触发间隔过短，跳过调用');
      return;
    }
    
    // 添加防抖机制，避免频繁调用
    if (state.isSyncing) {
      logger.info('🔄 同步正在进行中，跳过重复调用');
      return;
    }
    
    // 清除之前的超时
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }
    
    // 设置新的超时，防抖2000ms，进一步增加防抖时间
    syncTimeoutRef.current = setTimeout(() => {
      // 再次检查是否正在同步
      if (!state.isSyncing) {
        logger.info('🔄 手动触发状态同步');
        lastTriggerTimeRef.current = Date.now();
        fetchUserState();
      }
      syncTimeoutRef.current = null;
    }, 2000);
  }, [fetchUserState, state.isSyncing]);

  // 重置绘制状态
  const resetDrawingState = useCallback(() => {
    setState({
      drawablePixels: MAX_PIXELS,
      isFrozen: false,
      freezeTimeLeft: 0,
      totalPixels: 0,
      isDrawing: false,
      itemPixelPoints: 0,
      naturalPixelPoints: MAX_PIXELS,
      maxNaturalPixelPoints: MAX_PIXELS,
      lastSyncTime: Date.now(),
      isSyncing: false
    });
    logger.info('🔄 重置绘制状态');
  }, []);

  return {
    // 状态
    ...state,
    MAX_PIXELS,
    
    // 方法
    startDrawing,
    stopDrawing,
    consumePixel,
    manualConsumePixel,
    rollbackState,
    fetchUserState,
    forceRefreshState,
    triggerSync,
    resetDrawingState,
    
    // 计算属性
    canDraw: state.drawablePixels > 0 && !state.isFrozen && state.isDrawing,
    displayText: state.isFrozen 
      ? `${state.freezeTimeLeft}s` 
      : `${state.drawablePixels}/${state.maxNaturalPixelPoints}`,
    
    // 调试信息
    lastSyncTime: lastSyncTimeRef.current
  };
};
