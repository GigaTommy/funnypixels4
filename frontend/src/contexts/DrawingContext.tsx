import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { unifiedSessionManager, type DrawingMode, type UnifiedSession } from '../services/unifiedSessionManager';
import { logger } from '../utils/logger';

// 绘制状态接口
export interface DrawingState {
  mode: DrawingMode;
  session: UnifiedSession | null;
  isLoading: boolean;
  canDraw: boolean;
  pixelCount: number;
  lastDrawTime: string | null;
  error: string | null;
}

// 绘制动作类型
export type DrawingAction =
  | { type: 'SET_MODE'; payload: DrawingMode }
  | { type: 'SET_SESSION'; payload: UnifiedSession | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_CAN_DRAW'; payload: boolean }
  | { type: 'SET_PIXEL_COUNT'; payload: number }
  | { type: 'SET_LAST_DRAW_TIME'; payload: string | null }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESET_STATE' };

// 初始状态
const initialState: DrawingState = {
  mode: 'idle',
  session: null,
  isLoading: false,
  canDraw: false,
  pixelCount: 0,
  lastDrawTime: null,
  error: null
};

// 状态reducer
function drawingReducer(state: DrawingState, action: DrawingAction): DrawingState {
  switch (action.type) {
    case 'SET_MODE':
      return { ...state, mode: action.payload };
    case 'SET_SESSION':
      return { ...state, session: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_CAN_DRAW':
      return { ...state, canDraw: action.payload };
    case 'SET_PIXEL_COUNT':
      return { ...state, pixelCount: action.payload };
    case 'SET_LAST_DRAW_TIME':
      return { ...state, lastDrawTime: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'RESET_STATE':
      return initialState;
    default:
      return state;
  }
}

// Context接口
export interface DrawingContextType {
  state: DrawingState;
  actions: {
    // 模式切换
    switchToGpsMode: () => Promise<boolean>;
    switchToManualMode: () => Promise<boolean>;
    switchToTestMode: () => Promise<boolean>;
    switchToIdleMode: () => Promise<boolean>;

    // 会话管理
    startSession: (mode: DrawingMode, options?: any) => Promise<boolean>;
    endSession: () => Promise<boolean>;
    pauseSession: () => Promise<boolean>;
    resumeSession: () => Promise<boolean>;
    refreshSession: () => Promise<boolean>;

    // 绘制相关
    recordPixel: (pixelData: any) => Promise<boolean>;
    updateCanDraw: (canDraw: boolean) => void;
    incrementPixelCount: () => void;
    clearError: () => void;
  };

  // 计算属性
  getters: {
    modeDescription: string;
    isGpsMode: boolean;
    isManualMode: boolean;
    isTestMode: boolean;
    isIdleMode: boolean;
    hasActiveSession: boolean;
    sessionDuration: number;
  };
}

// 创建Context
const DrawingContext = createContext<DrawingContextType | undefined>(undefined);

// Provider组件
export function DrawingProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(drawingReducer, initialState);

  // 同步unifiedSessionManager的状态
  useEffect(() => {
    const unsubscribe = unifiedSessionManager.subscribe(() => {
      dispatch({ type: 'SET_SESSION', payload: unifiedSessionManager.getCurrentSession() });
      dispatch({ type: 'SET_MODE', payload: unifiedSessionManager.getCurrentMode() });

      const hasSession = unifiedSessionManager.isSessionActive();
      dispatch({ type: 'SET_CAN_DRAW', payload: hasSession });
    });

    // 初始化状态
    const currentSession = unifiedSessionManager.getCurrentSession();
    const currentMode = unifiedSessionManager.getCurrentMode();

    if (currentSession) {
      dispatch({ type: 'SET_SESSION', payload: currentSession });
    }
    dispatch({ type: 'SET_MODE', payload: currentMode });
    dispatch({ type: 'SET_CAN_DRAW', payload: unifiedSessionManager.isSessionActive() });

    // 清理函数
    return () => {
      unsubscribe();
    };
  }, []);

  // Actions
  const actions = {
    // 模式切换
    switchToGpsMode: async (): Promise<boolean> => {
      if (!unifiedSessionManager.canSwitchToMode('gps')) {
        logger.warn('无法切换到GPS模式: 当前模式不允许切换');
        return false;
      }

      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      try {
        const result = await unifiedSessionManager.startSession('gps', {
          drawingType: 'gps',
          sessionName: `GPS绘制-${new Date().toLocaleTimeString()}`
        });

        if (result.success) {
          logger.info('✅ 切换到GPS模式成功');
          return true;
        } else {
          throw new Error(result.error);
        }

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : '切换GPS模式失败';
        logger.error('❌ 切换到GPS模式失败:', errorMsg);
        dispatch({ type: 'SET_ERROR', payload: errorMsg });
        return false;
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },

    switchToManualMode: async (): Promise<boolean> => {
      if (!unifiedSessionManager.canSwitchToMode('manual')) {
        logger.warn('无法切换到手动模式: 当前模式不允许切换');
        return false;
      }

      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      try {
        const result = await unifiedSessionManager.startSession('manual', {
          drawingType: 'manual',
          sessionName: `手动绘制-${new Date().toLocaleTimeString()}`
        });

        if (result.success) {
          logger.info('✅ 切换到手动模式成功');
          return true;
        } else {
          throw new Error(result.error);
        }

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : '切换手动模式失败';
        logger.error('❌ 切换到手动模式失败:', errorMsg);
        dispatch({ type: 'SET_ERROR', payload: errorMsg });
        return false;
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },

    switchToTestMode: async (): Promise<boolean> => {
      if (!unifiedSessionManager.canSwitchToMode('test')) {
        logger.warn('无法切换到测试模式: 当前模式不允许切换');
        return false;
      }

      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      try {
        const result = await unifiedSessionManager.startSession('test', {
          drawingType: 'test',
          sessionName: `GPS测试-${new Date().toLocaleTimeString()}`
        });

        if (result.success) {
          logger.info('✅ 切换到测试模式成功');
          return true;
        } else {
          throw new Error(result.error);
        }

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : '切换测试模式失败';
        logger.error('❌ 切换到测试模式失败:', errorMsg);
        dispatch({ type: 'SET_ERROR', payload: errorMsg });
        return false;
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },

    switchToIdleMode: async (): Promise<boolean> => {
      dispatch({ type: 'SET_LOADING', payload: true });

      try {
        const result = await unifiedSessionManager.endSession();

        if (result.success) {
          logger.info('✅ 切换到空闲模式成功');
          return true;
        } else {
          throw new Error(result.error);
        }

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : '切换空闲模式失败';
        logger.error('❌ 切换到空闲模式失败:', errorMsg);
        dispatch({ type: 'SET_ERROR', payload: errorMsg });
        return false;
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },

    // 会话管理
    startSession: async (mode: DrawingMode, options?: any): Promise<boolean> => {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      try {
        const result = await unifiedSessionManager.startSession(mode, {
          drawingType: mode === 'test' ? 'gps' : mode, // test模式使用gps类型
          ...options
        });

        return result.success;

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : '创建会话失败';
        dispatch({ type: 'SET_ERROR', payload: errorMsg });
        return false;
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },

    endSession: async (): Promise<boolean> => {
      const result = await unifiedSessionManager.endSession();
      dispatch({ type: 'SET_PIXEL_COUNT', payload: 0 });
      dispatch({ type: 'SET_LAST_DRAW_TIME', payload: null });
      return result.success;
    },

    pauseSession: async (): Promise<boolean> => {
      const result = await unifiedSessionManager.pauseSession();
      return result.success;
    },

    resumeSession: async (): Promise<boolean> => {
      const result = await unifiedSessionManager.resumeSession();
      return result.success;
    },

    refreshSession: async (): Promise<boolean> => {
      return await unifiedSessionManager.refreshSession();
    },

    // 绘制相关
    recordPixel: async (pixelData: any): Promise<boolean> => {
      try {
        // 暂时实现：像素记录功能
        logger.info('🎨 像素记录功能暂未实现');

        // 更新状态
        dispatch({ type: 'SET_PIXEL_COUNT', payload: state.pixelCount + 1 });
        dispatch({ type: 'SET_LAST_DRAW_TIME', payload: new Date().toISOString() });

        return true;

      } catch (error) {
        logger.error('❌ 记录像素失败:', error);
        return false;
      }
    },

    updateCanDraw: (canDraw: boolean) => {
      dispatch({ type: 'SET_CAN_DRAW', payload: canDraw });
    },

    incrementPixelCount: () => {
      dispatch({ type: 'SET_PIXEL_COUNT', payload: state.pixelCount + 1 });
    },

    clearError: () => {
      dispatch({ type: 'SET_ERROR', payload: null });
    }
  };

  // 计算属性
  const getters = {
    modeDescription: (() => {
      switch (state.mode) {
        case 'gps': return 'GPS自动绘制';
        case 'manual': return '手动绘制';
        case 'test': return 'GPS测试模式';
        case 'idle': return '空闲模式';
        default: return '未知模式';
      }
    })(),

    isGpsMode: state.mode === 'gps' || state.mode === 'test', // GPS测试模式也启用GPS绘制
    isManualMode: state.mode === 'manual',
    isTestMode: state.mode === 'test',
    isIdleMode: state.mode === 'idle',
    hasActiveSession: state.session !== null && state.session.status === 'active',

    sessionDuration: (() => {
      if (!state.session?.startTime) return 0;
      const start = new Date(state.session.startTime);
      const now = new Date();
      return Math.floor((now.getTime() - start.getTime()) / 1000); // 秒
    })()
  };

  const contextValue: DrawingContextType = {
    state,
    actions,
    getters
  };

  return (
    <DrawingContext.Provider value={contextValue}>
      {children}
    </DrawingContext.Provider>
  );
}

// Hook for using the context
export function useDrawing(): DrawingContextType {
  const context = useContext(DrawingContext);
  if (context === undefined) {
    throw new Error('useDrawing must be used within a DrawingProvider');
  }
  return context;
}

// 便捷hooks
export function useDrawingMode(): DrawingMode {
  const { state } = useDrawing();
  return state.mode;
}

export function useCanDraw(): boolean {
  const { state } = useDrawing();
  return state.canDraw;
}

export function useActiveSession(): UnifiedSession | null {
  const { state } = useDrawing();
  return state.session;
}

export function useSessionManager() {
  const { actions, getters } = useDrawing();
  return { actions, getters };
}