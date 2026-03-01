import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import QRCode from 'qrcode';
import {
  RiWechatLine,
  RiLoader4Line,
  RiRefreshLine,
  RiSmartphoneLine,
  RiCheckLine,
  RiTimeLine,
  RiErrorWarningLine
} from 'react-icons/ri';
import { logger } from '../../utils/logger';
import { config } from '../../config/env';

interface WeChatQRLoginProps {
  onLoginSuccess: (userInfo: any) => void;
  onError?: (error: string) => void;
}

interface LoginState {
  status: 'generating' | 'waiting' | 'scanned' | 'confirmed' | 'expired' | 'error';
  message?: string;
}

export const WeChatQRLogin: React.FC<WeChatQRLoginProps> = ({
  onLoginSuccess,
  onError
}) => {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [loginState, setLoginState] = useState<LoginState>({ status: 'generating' });
  const pollingTimer = useRef<NodeJS.Timeout | null>(null);
  const expireTimer = useRef<NodeJS.Timeout | null>(null);
  const [loginStateId, setLoginStateId] = useState<string>('');

  // 微信开放平台配置
  const WECHAT_CONFIG = useMemo(() => ({
    appId: config.WECHAT.APP_ID,
    redirectUri: config.WECHAT.REDIRECT_URI,
    scope: config.WECHAT.SCOPE,
    responseType: config.WECHAT.RESPONSE_TYPE
  }), []);

  // 生成随机state参数，防止CSRF攻击
  const generateState = useCallback(() => {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
  }, []);

  // 生成微信授权URL
  const generateWeChatAuthUrl = useCallback((state: string) => {
    const params = new URLSearchParams({
      appid: WECHAT_CONFIG.appId,
      redirect_uri: WECHAT_CONFIG.redirectUri,
      response_type: WECHAT_CONFIG.responseType,
      scope: WECHAT_CONFIG.scope,
      state: state
    });

    return `https://open.weixin.qq.com/connect/qrconnect?${params.toString()}#wechat_redirect`;
  }, [WECHAT_CONFIG]);

  // 生成二维码
  const generateQRCode = useCallback(async () => {
    try {
      setLoginState({ status: 'generating' });
      clearAllTimers();

      // 暂时禁用微信登录功能，显示开发中提示
      const errorMessage = '微信登录功能开发中，敬请期待！';
      setLoginState({ status: 'error', message: errorMessage });
      onError?.(errorMessage);
      return;

      // 检查微信配置
      if (!WECHAT_CONFIG.appId || WECHAT_CONFIG.appId === 'YOUR_WECHAT_APP_ID') {
        const errorMessage = '微信登录功能未配置，请联系管理员添加微信AppID';
        setLoginState({ status: 'error', message: errorMessage });
        onError?.(errorMessage);
        return;
      }

      const state = generateState();
      setLoginStateId(state);

      const authUrl = generateWeChatAuthUrl(state);
      logger.info('🔐 生成微信登录二维码:', { authUrl, state });

      // 生成二维码图片
      const qrDataUrl = await QRCode.toDataURL(authUrl, {
        width: 200,
        margin: 2,
        color: {
          dark: '#07C160', // 微信绿色
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      });

      setQrCodeUrl(qrDataUrl);
      setLoginState({ status: 'waiting', message: '请使用微信扫码登录' });

      // 开始轮询登录状态
      startPolling(state);

      // 设置5分钟后二维码过期
      expireTimer.current = setTimeout(() => {
        setLoginState({ status: 'expired', message: '二维码已过期，请刷新重试' });
        clearAllTimers();
      }, 5 * 60 * 1000);

    } catch (error) {
      logger.error('生成微信登录二维码失败:', error);
      const errorMessage = error instanceof Error ? error.message : '生成二维码失败';
      setLoginState({ status: 'error', message: errorMessage });
      onError?.(errorMessage);
    }
  }, [generateState, generateWeChatAuthUrl]);

  // 轮询登录状态
  const startPolling = useCallback((state: string) => {
    let retryCount = 0;
    const maxRetries = 150; // 5分钟内最多轮询150次

    const timer = setInterval(async () => {
      try {
        retryCount++;

        // 检查是否超过最大重试次数
        if (retryCount > maxRetries) {
          setLoginState({ status: 'expired', message: '二维码已过期，请刷新重试' });
          clearAllTimers();
          return;
        }

        // 调用后端API检查登录状态
        const response = await fetch(`/api/auth/wechat/status?state=${state}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || '检查登录状态失败');
        }

        switch (data.status) {
          case 'scanned':
            setLoginState({ status: 'scanned', message: '扫码成功，请在手机上确认登录' });
            break;

          case 'confirmed':
            setLoginState({ status: 'confirmed', message: '登录成功！' });
            clearAllTimers();
            onLoginSuccess(data.userInfo);
            break;

          case 'expired':
            setLoginState({ status: 'expired', message: '二维码已过期，请刷新重试' });
            clearAllTimers();
            break;

          case 'error':
            setLoginState({ status: 'error', message: data.message || '登录失败' });
            clearAllTimers();
            onError?.(data.message || '登录失败');
            break;

          case 'waiting':
          default:
            // 继续等待
            break;
        }

      } catch (error) {
        logger.error('轮询微信登录状态失败:', error);
        // 不要因为单次网络错误就停止轮询
        if (retryCount > 10) { // 连续失败10次才停止
          setLoginState({ status: 'error', message: '网络连接异常，请重试' });
          clearAllTimers();
        }
      }
    }, 2000); // 每2秒轮询一次

    pollingTimer.current = timer;
  }, [onLoginSuccess]);

  // 清理所有定时器
  const clearAllTimers = useCallback(() => {
    if (pollingTimer.current) {
      clearInterval(pollingTimer.current);
      pollingTimer.current = null;
    }
    if (expireTimer.current) {
      clearTimeout(expireTimer.current);
      expireTimer.current = null;
    }
  }, []);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, [clearAllTimers]);

  // 初始化时生成二维码
  useEffect(() => {
    generateQRCode();
  }, [generateQRCode]);

  // 刷新二维码
  const handleRefresh = () => {
    generateQRCode();
  };

  // 状态图标
  const getStatusIcon = () => {
    switch (loginState.status) {
      case 'generating':
        return <RiLoader4Line className="animate-spin text-xl" />;
      case 'waiting':
        return <RiSmartphoneLine className="text-xl" />;
      case 'scanned':
        return <RiCheckLine className="text-xl text-green-500" />;
      case 'confirmed':
        return <RiCheckLine className="text-xl text-green-500" />;
      case 'expired':
        return <RiTimeLine className="text-xl text-orange-500" />;
      case 'error':
        return <RiErrorWarningLine className="text-xl text-red-500" />;
      default:
        return <RiWechatLine className="text-xl" />;
    }
  };

  return (
    <div className="wechat-qr-login">
      <div className="wechat-login-header">
        <RiWechatLine className="wechat-icon" />
        <h3>微信扫码登录</h3>
      </div>

      <div className="qr-container">
        {qrCodeUrl && (
          <div className="qr-image-wrapper">
            <img
              src={qrCodeUrl}
              alt="微信扫码登录"
              className="qr-image"
            />

            {/* 状态遮罩 */}
            {loginState.status !== 'waiting' && loginState.status !== 'generating' && (
              <div className="qr-overlay">
                <div className="qr-overlay-content">
                  {getStatusIcon()}
                  <p className="qr-overlay-message">{loginState.message}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {!qrCodeUrl && loginState.status === 'generating' && (
          <div className="qr-loading">
            <RiLoader4Line className="animate-spin text-4xl text-green-500" />
            <p>正在生成二维码...</p>
          </div>
        )}
      </div>

      {/* 状态消息 */}
      <div className="login-status">
        <div className="status-icon">
          {getStatusIcon()}
        </div>
        <p className="status-message">{loginState.message}</p>
      </div>

      {/* 操作按钮 */}
      {(loginState.status === 'expired' || loginState.status === 'error') && (
        <button
          onClick={handleRefresh}
          className="refresh-button"
        >
          <RiRefreshLine className="refresh-icon" />
          刷新二维码
        </button>
      )}

      {/* 使用提示 */}
      <div className="login-tips">
        <p>使用提示：</p>
        <ul>
          <li>打开微信，扫描上方二维码</li>
          <li>在微信中确认登录</li>
          <li>二维码5分钟后自动过期</li>
        </ul>
      </div>
    </div>
  );
};

export default WeChatQRLogin;