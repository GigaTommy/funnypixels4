import React, { useState, useEffect, useCallback } from 'react';
import { logger } from '../utils/logger';

interface NetworkErrorPageProps {
  onRetry?: () => void;
  onOfflineMode?: () => void;
  initialRetryCount?: number;
}

const NetworkErrorPage: React.FC<NetworkErrorPageProps> = ({
  onRetry,
  onOfflineMode,
  initialRetryCount = 0
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [retryCount, setRetryCount] = useState(initialRetryCount);
  const [isRetrying, setIsRetrying] = useState(false);
  const [networkType, setNetworkType] = useState<string>('unknown');
  const [autoRetryCountdown, setAutoRetryCountdown] = useState<number>(10);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // 检测移动设备
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 检测网络类型和质量
  const detectNetworkType = useCallback(() => {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      const type = connection.effectiveType || 'unknown';
      const downlink = connection.downlink || 0;

      logger.info('网络类型检测:', { type, downlink, rtt: connection.rtt });
      setNetworkType(type);
      return { type, downlink, rtt: connection.rtt };
    }
    return { type: 'unknown', downlink: 0, rtt: 0 };
  }, []);

  // 网络状态监听
  useEffect(() => {
    const handleOnline = () => {
      logger.info('网络已连接');
      setIsOnline(true);
      detectNetworkType();
    };

    const handleOffline = () => {
      logger.warn('网络连接断开');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [detectNetworkType]);

  // 自动重试倒计时
  useEffect(() => {
    if (!isOnline && autoRetryCountdown > 0) {
      const timer = setTimeout(() => {
        setAutoRetryCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (!isOnline && autoRetryCountdown === 0) {
      handleAutoRetry();
    }
  }, [isOnline, autoRetryCountdown]);

  // 自动重试
  const handleAutoRetry = useCallback(async () => {
    logger.info(`自动重试网络连接 (第${retryCount + 1}次)`);
    setIsRetrying(true);

    try {
      // 模拟网络检测 - 可以替换为实际的ping请求
      await new Promise(resolve => setTimeout(resolve, 2000));

      if (navigator.onLine) {
        logger.info('自动重试成功');
        setRetryCount(0);
        setAutoRetryCountdown(10);
        onRetry?.();
      } else {
        throw new Error('网络仍未连接');
      }
    } catch (error) {
      logger.warn('自动重试失败:', error);
      setRetryCount(prev => prev + 1);
      setAutoRetryCountdown(10); // 重置倒计时
    } finally {
      setIsRetrying(false);
    }
  }, [retryCount, onRetry]);

  // 手动重试
  const handleManualRetry = useCallback(async () => {
    logger.info(`手动重试网络连接 (第${retryCount + 1}次)`);
    setIsRetrying(true);

    try {
      // 可以添加实际的网络测试，比如请求一个轻量级的API
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/health`, {
        method: 'HEAD',
        cache: 'no-cache',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok || navigator.onLine) {
        logger.info('手动重试成功');
        setRetryCount(0);
        setAutoRetryCountdown(10);
        onRetry?.();
      } else {
        throw new Error('服务器响应异常');
      }
    } catch (error) {
      logger.warn('手动重试失败:', error);
      setRetryCount(prev => prev + 1);
    } finally {
      setIsRetrying(false);
    }
  }, [retryCount, onRetry]);

  // 获取网络质量图标
  const getNetworkIcon = () => {
    if (isRetrying) {
      return '🔄';
    }
    if (!isOnline) {
      return '📡';
    }
    switch (networkType) {
      case '4g':
        return '📶';
      case '3g':
        return '📱';
      case '2g':
        return '📞';
      default:
        return '🌐';
    }
  };

  // 获取网络状态描述
  const getNetworkStatusText = () => {
    if (isRetrying) {
      return '正在重新连接...';
    }
    if (!isOnline) {
      return '网络连接断开';
    }
    return `网络已连接 (${networkType.toUpperCase()})`;
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '20px',
        padding: '40px',
        maxWidth: '500px',
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(10px)'
      }}>
        {/* 网络图标 */}
        <div style={{
          fontSize: '80px',
          marginBottom: '20px',
          animation: isRetrying ? 'spin 2s linear infinite' : 'pulse 2s ease-in-out infinite'
        }}>
          {getNetworkIcon()}
        </div>

        {/* 标题 */}
        <h1 style={{
          fontSize: '28px',
          fontWeight: '700',
          color: '#2d3436',
          margin: '0 0 16px 0',
          lineHeight: '1.3'
        }}>
          网络连接异常
        </h1>

        {/* 状态描述 */}
        <p style={{
          fontSize: '16px',
          color: '#636e72',
          margin: '0 0 32px 0',
          lineHeight: '1.6'
        }}>
          {getNetworkStatusText()}
          {retryCount > 0 && (
            <span style={{
              display: 'block',
              fontSize: '14px',
              marginTop: '8px',
              color: '#e17055'
            }}>
              已尝试 {retryCount} 次
            </span>
          )}
        </p>

        {/* 操作按钮 */}
        <div style={{
          display: 'flex',
          gap: '16px',
          marginBottom: '32px',
          flexDirection: isMobile ? 'column' : 'row'
        }}>
          <button
            onClick={handleManualRetry}
            disabled={isRetrying || isOnline}
            style={{
              flex: 1,
              background: isRetrying || isOnline
                ? '#dfe6e9'
                : 'linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%)',
              color: isRetrying || isOnline ? '#b2bec3' : 'white',
              border: 'none',
              padding: '16px 24px',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: isRetrying || isOnline ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              minHeight: '52px'
            }}
          >
            {isRetrying ? '连接中...' : '重新连接'}
          </button>

          <button
            onClick={onOfflineMode}
            style={{
              flex: 1,
              background: 'transparent',
              color: '#636e72',
              border: '2px solid #dfe6e9',
              padding: '16px 24px',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              minHeight: '52px'
            }}
          >
            离线模式
          </button>
        </div>

        {/* 自动重试倒计时 */}
        {!isOnline && !isRetrying && retryCount < 5 && (
          <div style={{
            fontSize: '14px',
            color: '#636e72',
            marginBottom: '24px'
          }}>
            将在 {autoRetryCountdown} 秒后自动重试
          </div>
        )}

        {/* 故障排除建议 */}
        <div style={{
          textAlign: 'left',
          backgroundColor: '#f8f9fa',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px'
        }}>
          <div style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#2d3436',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            💡 解决建议
          </div>
          <ul style={{
            margin: '0',
            paddingLeft: '20px',
            color: '#636e72',
            fontSize: '14px',
            lineHeight: '1.8'
          }}>
            <li style={{ marginBottom: '4px' }}>检查WiFi或移动网络连接</li>
            <li style={{ marginBottom: '4px' }}>尝试切换到其他网络</li>
            <li style={{ marginBottom: '4px' }}>重启路由器或移动数据</li>
            <li style={{ marginBottom: '4px' }}>检查网络设置和防火墙</li>
            {retryCount > 3 && <li style={{ marginBottom: '4px' }}>联系网络服务提供商</li>}
            {retryCount > 3 && <li style={{ marginBottom: '4px' }}>稍后再试或使用离线模式</li>}
          </ul>
        </div>

        {/* 高级信息切换 */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={{
            background: 'none',
            border: 'none',
            color: '#74b9ff',
            fontSize: '14px',
            cursor: 'pointer',
            textDecoration: 'underline'
          }}
        >
          {showAdvanced ? '隐藏' : '显示'}详细信息
        </button>

        {/* 高级信息 */}
        {showAdvanced && (
          <div style={{
            marginTop: '16px',
            padding: '16px',
            backgroundColor: '#f1f3f4',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#5f6368',
            textAlign: 'left',
            fontFamily: 'monospace'
          }}>
            <div>在线状态: {isOnline ? '在线' : '离线'}</div>
            <div>网络类型: {networkType.toUpperCase()}</div>
            <div>重试次数: {retryCount}</div>
            <div>设备类型: {isMobile ? '移动端' : '桌面端'}</div>
            <div>时间: {new Date().toLocaleString()}</div>
          </div>
        )}
      </div>

      {/* 添加动画样式 */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default NetworkErrorPage;