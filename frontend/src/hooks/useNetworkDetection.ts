import { useState, useEffect, useCallback, useRef } from 'react';
import { logger } from '../utils/logger';

export interface NetworkInfo {
  isOnline: boolean;
  type: string;
  effectiveType: string;
  downlink: number;
  rtt: number;
  saveData: boolean;
  quality: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';
}

export interface NetworkDetectionOptions {
  autoRetry?: boolean;
  retryInterval?: number;
  maxRetries?: number;
  enableHealthCheck?: boolean;
  healthCheckUrl?: string;
}

export interface NetworkDetectionResult {
  network: NetworkInfo;
  isRetrying: boolean;
  retryCount: number;
  lastRetryTime: number | null;
  retry: () => Promise<boolean>;
  checkHealth: () => Promise<boolean>;
  reset: () => void;
}

const useNetworkDetection = (options: NetworkDetectionOptions = {}): NetworkDetectionResult => {
  const {
    autoRetry = true,
    retryInterval = 10000, // 10秒
    maxRetries = 10,
    enableHealthCheck = true,
    healthCheckUrl = '/api/health'
  } = options;

  const [network, setNetwork] = useState<NetworkInfo>({
    isOnline: navigator.onLine,
    type: 'unknown',
    effectiveType: 'unknown',
    downlink: 0,
    rtt: 0,
    saveData: false,
    quality: 'unknown'
  });

  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [lastRetryTime, setLastRetryTime] = useState<number | null>(null);

  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 获取网络质量等级
  const getNetworkQuality = useCallback((info: Partial<NetworkInfo>): NetworkInfo['quality'] => {
    if (!info.effectiveType || info.effectiveType === 'unknown') {
      return 'unknown';
    }

    switch (info.effectiveType) {
      case '4g':
        return info.downlink && info.downlink >= 5 ? 'excellent' :
               info.downlink && info.downlink >= 2 ? 'good' : 'fair';
      case '3g':
        return info.downlink && info.downlink >= 1.5 ? 'fair' : 'poor';
      case '2g':
      case 'slow-2g':
        return 'poor';
      default:
        return 'unknown';
    }
  }, []);

  // 获取网络信息
  const getNetworkInfo = useCallback((): NetworkInfo => {
    const isOnline = navigator.onLine;
    let info: Partial<NetworkInfo> = {
      isOnline,
      type: 'unknown',
      effectiveType: 'unknown',
      downlink: 0,
      rtt: 0,
      saveData: false
    };

    // 获取网络连接信息（如果支持）
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      info = {
        ...info,
        type: connection.type || 'unknown',
        effectiveType: connection.effectiveType || 'unknown',
        downlink: connection.downlink || 0,
        rtt: connection.rtt || 0,
        saveData: connection.saveData || false
      };
    }

    return {
      ...info,
      quality: getNetworkQuality(info)
    } as NetworkInfo;
  }, [getNetworkQuality]);

  // 更新网络状态
  const updateNetworkState = useCallback(() => {
    const newNetworkInfo = getNetworkInfo();
    setNetwork(newNetworkInfo);
    logger.info('网络状态更新:', newNetworkInfo);
    return newNetworkInfo;
  }, [getNetworkInfo]);

  // 健康检查
  const checkHealth = useCallback(async (): Promise<boolean> => {
    if (!enableHealthCheck) {
      return navigator.onLine;
    }

    try {
      // 取消之前的请求
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      const timeoutId = setTimeout(() => {
        abortControllerRef.current?.abort();
      }, 5000); // 5秒超时

      const response = await fetch(healthCheckUrl, {
        method: 'HEAD',
        cache: 'no-cache',
        signal: abortControllerRef.current.signal
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        logger.warn('网络健康检查失败:', error);
      }
      return false;
    }
  }, [enableHealthCheck, healthCheckUrl]);

  // 手动重试
  const retry = useCallback(async (): Promise<boolean> => {
    if (isRetrying || retryCount >= maxRetries) {
      logger.warn('重试被跳过:', { isRetrying, retryCount, maxRetries });
      return false;
    }

    logger.info(`开始网络重试 (第${retryCount + 1}次)`);
    setIsRetrying(true);
    setRetryCount(prev => prev + 1);
    setLastRetryTime(Date.now());

    try {
      // 更新网络状态
      const networkInfo = updateNetworkState();

      if (networkInfo.isOnline) {
        // 进行健康检查
        const isHealthy = await checkHealth();

        if (isHealthy) {
          logger.info('网络重试成功');
          setRetryCount(0);
          return true;
        } else {
          logger.warn('网络健康检查失败，但显示为在线状态');
        }
      } else {
        logger.warn('网络仍处于离线状态');
      }

      return false;
    } catch (error) {
      logger.error('网络重试异常:', error);
      return false;
    } finally {
      setIsRetrying(false);
    }
  }, [isRetrying, retryCount, maxRetries, updateNetworkState, checkHealth]);

  // 重置状态
  const reset = useCallback(() => {
    setRetryCount(0);
    setLastRetryTime(null);
    setIsRetrying(false);

    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // 网络状态变化监听
  useEffect(() => {
    const handleOnline = () => {
      logger.info('网络已连接');
      updateNetworkState();

      // 网络恢复时进行健康检查
      checkHealth().then(isHealthy => {
        if (isHealthy) {
          reset();
        }
      });
    };

    const handleOffline = () => {
      logger.warn('网络连接断开');
      updateNetworkState();
    };

    const handleConnectionChange = () => {
      logger.info('网络连接属性变化');
      updateNetworkState();
    };

    // 添加事件监听器
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 监听网络连接变化（如果支持）
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      connection.addEventListener('change', handleConnectionChange);
    }

    // 初始状态
    updateNetworkState();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);

      if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        connection.removeEventListener('change', handleConnectionChange);
      }

      reset();
    };
  }, [updateNetworkState, checkHealth, reset]);

  // 自动重试机制
  useEffect(() => {
    if (!autoRetry || network.isOnline || isRetrying || retryCount >= maxRetries) {
      return;
    }

    retryTimerRef.current = setTimeout(() => {
      retry();
    }, retryInterval);

    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [autoRetry, network.isOnline, isRetrying, retryCount, maxRetries, retryInterval, retry]);

  return {
    network,
    isRetrying,
    retryCount,
    lastRetryTime,
    retry,
    checkHealth,
    reset
  };
};

export default useNetworkDetection;