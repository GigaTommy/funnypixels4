import React, { useState, useEffect } from 'react';

interface NetworkStatusProps {
  onNetworkChange?: (isOnline: boolean) => void;
}

const NetworkStatus: React.FC<NetworkStatusProps> = ({ onNetworkChange }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOfflineMessage, setShowOfflineMessage] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOfflineMessage(false);
      onNetworkChange?.(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineMessage(true);
      onNetworkChange?.(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [onNetworkChange]);

  // 自动隐藏离线消息（当网络恢复时）
  useEffect(() => {
    if (isOnline && showOfflineMessage) {
      const timer = setTimeout(() => {
        setShowOfflineMessage(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, showOfflineMessage]);

  if (!isOnline) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)',
        color: 'white',
        padding: '12px 20px',
        textAlign: 'center',
        zIndex: 10000,
        fontSize: '14px',
        fontWeight: '500',
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
      }}>
        📡 网络连接已断开，请检查网络设置
      </div>
    );
  }

  if (showOfflineMessage) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        background: 'linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%)',
        color: 'white',
        padding: '12px 20px',
        textAlign: 'center',
        zIndex: 10000,
        fontSize: '14px',
        fontWeight: '500',
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
        animation: 'slideDown 0.3s ease-out'
      }}>
        ✅ 网络连接已恢复
      </div>
    );
  }

  return null;
};

export default NetworkStatus;
