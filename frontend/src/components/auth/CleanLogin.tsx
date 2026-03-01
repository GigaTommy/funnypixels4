import React, { useState } from 'react';
import {
  RiSmartphoneLine,
  RiMailLine,
  RiUserLine,
  RiShieldCheckLine,
  RiWechatLine,
  RiLoader4Line,
  RiArrowRightLine,
  RiCheckLine,
  RiErrorWarningLine,
  RiEyeLine,
  RiEyeOffLine,
  RiCloseLine,
  RiTimeLine
} from 'react-icons/ri';
import { logger } from '../../utils/logger';
import { AuthService } from '../../services/auth';
import { useCountdown } from '../../utils/phoneUtils';
import WeChatQRLogin from './WeChatQRLogin';
import DocumentViewer from '../DocumentViewer';
import LoginMessage from './LoginMessage';
import pixelLogo from '../../assets/login-avatar.png';
import '../../styles/pixel-login.css';

interface CleanLoginProps {
  onLoginSuccess: () => void;
}

export default function CleanLogin({ onLoginSuccess }: CleanLoginProps) {
  const [loginType, setLoginType] = useState<'phone' | 'account'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [account, setAccount] = useState(''); // 账号登录使用
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [countryCode, setCountryCode] = useState('+86');
  const { countdown, isCounting, startCountdown } = useCountdown(60);

  // 验证手机号格式
  const validatePhoneNumber = (phone: string) => {
    const phoneRegex = /^1[3-9]\d{9}$/;
    return phoneRegex.test(phone.replace(/\D/g, ''));
  };

  const handleLogin = async () => {
    if (!agreeToTerms) {
      setError('请先同意用户协议和隐私政策');
      return;
    }

    setError(null);
    setSuccess(null);

    if (loginType === 'phone') {
      if (!phoneNumber || !validatePhoneNumber(phoneNumber)) {
        setError('请输入正确的手机号码');
        return;
      }

      if (!verificationCode) {
        setError('请输入验证码');
        return;
      }

      await handlePhoneLogin();
    } else {
      if (!account) {
        setError('请输入账号');
        return;
      }

      if (!password) {
        setError('请输入密码');
        return;
      }

      await handleAccountLogin();
    }
  };

  const handlePhoneLogin = async () => {
    setIsLoading(true);

    try {
      logger.info('🔐 尝试手机号验证码登录:', { phone: phoneNumber });

      // 使用手机号+验证码登录
      await AuthService.loginWithPhoneCode(phoneNumber, verificationCode);

      setSuccess('登录成功，正在跳转...');

      // 延迟回调，让用户看到成功提示
      setTimeout(() => {
        onLoginSuccess();
      }, 1000);

    } catch (error: any) {
      logger.error('手机号验证码登录失败:', error);
      const errorMessage = error.response?.data?.error || error.message || '登录失败，请稍后重试';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // 发送验证码
  const handleSendVerificationCode = async () => {
    if (!phoneNumber || !validatePhoneNumber(phoneNumber)) {
      setError('请输入正确的手机号码');
      return;
    }

    setIsSendingCode(true);
    setError(null);

    try {
      await AuthService.sendVerificationCode({
        phone: phoneNumber,
        type: 'login'
      });

      setSuccess('验证码已发送');
      startCountdown(); // 开始倒计时

      // 开发环境显示验证码
      if (process.env.NODE_ENV === 'development') {
        logger.info('开发环境 - 验证码已发送，请查看控制台');
      }

    } catch (error: any) {
      logger.error('发送验证码失败:', error);
      const errorMessage = error.response?.data?.error || error.message || '发送验证码失败，请稍后重试';
      setError(errorMessage);
    } finally {
      setIsSendingCode(false);
    }
  };

  // 判断输入内容类型（用户名、邮箱、手机号）
  const detectAccountType = (input: string): 'username' | 'email' | 'phone' => {
    // 邮箱格式检测
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(input)) {
      return 'email';
    }

    // 手机号格式检测（中国手机号）
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (phoneRegex.test(input.replace(/\D/g, ''))) {
      return 'phone';
    }

    // 默认作为用户名处理
    return 'username';
  };

  const handleAccountLogin = async () => {
    setIsLoading(true);

    try {
      logger.info('🔐 尝试账号登录:', { account, password });

      // 检测账号类型
      const accountType = detectAccountType(account);
      logger.info('📝 账号类型检测结果:', { account, accountType });

      // 根据账号类型构建登录请求
      let loginData: any = {
        password: password
      };

      switch (accountType) {
        case 'email':
          loginData.email = account;
          break;
        case 'phone':
          loginData.phone = account.replace(/\D/g, ''); // 清理手机号格式
          break;
        case 'username':
          loginData.username = account;
          break;
      }

      await AuthService.login(loginData);

      setSuccess('登录成功，正在跳转...');

      // 延迟回调，让用户看到成功提示
      setTimeout(() => {
        onLoginSuccess();
      }, 1000);

    } catch (error: any) {
      logger.error('账号登录失败:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || '登录失败，请稍后重试';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // 微信登录成功处理
  const handleWeChatLoginSuccess = (userInfo: any) => {
    logger.info('🔐 微信登录成功:', userInfo);

    setSuccess('微信登录成功，正在跳转...');

    // 延迟回调，让用户看到成功提示
    setTimeout(() => {
      onLoginSuccess();
    }, 1000);
  };

  // 微信登录错误处理
  const handleWeChatLoginError = (errorMessage: string) => {
    logger.error('微信登录失败:', errorMessage);
    setError(errorMessage);
  };

  // 处理政策查看 - 不再需要，直接使用状态管理

  return (
    <div className="pixel-login-container">
      {/* Pixel Background */}
      <div className="pixel-background"></div>

      {/* Login Modal */}
      <div className="pixel-modal">
        {/* Close Button */}
        <button
          onClick={() => window.history.back()}
          className="pixel-close-btn"
        >
          <RiCloseLine size={24} />
        </button>
        {/* Header */}
        <div className="pixel-header">
          <div className="pixel-title-row">
            <img src={pixelLogo} alt="FunnyPixels Logo" className="pixel-logo" />
            <h1 className="pixel-title">完成登录/注册，开启有趣的像素之旅</h1>
          </div>
        </div>

        {/* 错误/成功提示 */}
        <LoginMessage error={error} success={success} />

        <div className="pixel-content">
          {/* Left Section - Login Forms */}
          <div className="pixel-left-section">
            {/* Tabs */}
            <div className="pixel-tabs">
              <button
                className={`pixel-tab ${loginType === 'phone' ? 'active' : ''}`}
                onClick={() => setLoginType('phone')}
              >
                <RiSmartphoneLine className="text-lg" />
                手机号登录
              </button>
              <button
                className={`pixel-tab ${loginType === 'account' ? 'active' : ''}`}
                onClick={() => setLoginType('account')}
              >
                <RiUserLine className="text-lg" />
                账号登录
              </button>
            </div>

            {/* Phone Login Form */}
            {loginType === 'phone' && (
              <div className="pixel-form">
                <div className="pixel-input-group">
                  <div className="pixel-phone-input">
                    <select
                      className="pixel-country-code"
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                    >
                      <option value="+86">+86</option>
                      <option value="+1">+1</option>
                      <option value="+44">+44</option>
                      <option value="+81">+81</option>
                    </select>
                    <input
                      type="tel"
                      placeholder="请输入手机号"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="pixel-input"
                    />
                  </div>
                </div>

                <div className="pixel-input-group">
                  <div className="pixel-verification-input">
                    <input
                      type="text"
                      placeholder="请输入验证码"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      className="pixel-input"
                      maxLength={6}
                    />
                    <button
                      className="pixel-get-code-btn"
                      onClick={handleSendVerificationCode}
                      disabled={isCounting || isSendingCode}
                    >
                      {isSendingCode ? (
                        <>
                          <RiLoader4Line className="animate-spin" />
                          发送中...
                        </>
                      ) : isCounting ? (
                        <>
                          <RiTimeLine />
                          {countdown}s
                        </>
                      ) : (
                        '获取验证码'
                      )}
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleLogin}
                  disabled={isLoading || !agreeToTerms}
                  className="pixel-submit-btn"
                >
                  {isLoading ? (
                    <>
                      <RiLoader4Line className="animate-spin" />
                      登录中...
                    </>
                  ) : (
                    <>
                      登录 / 注册
                      <RiArrowRightLine />
                    </>
                  )}
                </button>

                <div className="pixel-terms">
                  <input
                    type="checkbox"
                    checked={agreeToTerms}
                    onChange={(e) => setAgreeToTerms(e.target.checked)}
                    className="pixel-checkbox"
                  />
                  <span className="pixel-terms-text">
                    我已阅读并同意 <a
                      href="/user-agreement.html"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pixel-policy-link"
                    >《用户协议》</a> 和 <a
                      href="/privacy-policy.html"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pixel-policy-link"
                    >《隐私政策》</a>，未注册的手机号将自动创建账号
                  </span>
                </div>
              </div>
            )}

            {/* Account Login Form */}
            {loginType === 'account' && (
              <div className="pixel-form">
                <div className="pixel-input-group">
                  <div className="pixel-account-input">
                    <input
                      type="text"
                      placeholder="请输入用户名/邮箱/手机号"
                      value={account}
                      onChange={(e) => setAccount(e.target.value)}
                      className="pixel-input"
                    />
                  </div>
                </div>

                <div className="pixel-input-group">
                  <div className="pixel-password-input">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="请输入密码"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pixel-input"
                    />
                    <button
                      className="pixel-eye-btn"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <RiEyeOffLine size={20} /> : <RiEyeLine size={20} />}
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleLogin}
                  disabled={isLoading || !agreeToTerms}
                  className="pixel-submit-btn"
                >
                  {isLoading ? (
                    <>
                      <RiLoader4Line className="animate-spin" />
                      登录中...
                    </>
                  ) : (
                    '登录'
                  )}
                </button>

                <a href="#" className="pixel-forgot-password">
                  忘记密码?
                </a>

                <div className="pixel-terms">
                  <input
                    type="checkbox"
                    checked={agreeToTerms}
                    onChange={(e) => setAgreeToTerms(e.target.checked)}
                    className="pixel-checkbox"
                  />
                  <span className="pixel-terms-text">
                    我已阅读并同意{' '}
                    <a
                      href="/user-agreement.html"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pixel-policy-link"
                      style={{
                        color: '#6366f1',
                        textDecoration: 'underline',
                        padding: '0',
                        fontSize: 'inherit'
                      }}
                    >
                      《用户协议》
                    </a>
                    {' '}和{' '}
                    <a
                      href="/privacy-policy.html"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pixel-policy-link"
                      style={{
                        color: '#6366f1',
                        textDecoration: 'underline',
                        padding: '0',
                        fontSize: 'inherit'
                      }}
                    >
                      《隐私政策》
                    </a>
                  </span>
                </div>
              </div>
            )}

            {/* 安全提示 */}
            <div className="pixel-security-tip">
              <RiShieldCheckLine />
              <span>安全登录，数据加密保护</span>
            </div>
          </div>

          {/* Right Section - WeChat QR Code Login */}
          <div className="pixel-right-section">
            <div className="pixel-qr-header">微信扫码登录</div>
            <div className="pixel-qr-container">
              <WeChatQRLogin
                onLoginSuccess={handleWeChatLoginSuccess}
                onError={handleWeChatLoginError}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Decorative Pixel Elements */}
      <div className="pixel-decorations">
        <div className="pixel-cloud pixel-cloud-1"></div>
        <div className="pixel-cloud pixel-cloud-2"></div>
        <div className="pixel-star pixel-star-1"></div>
        <div className="pixel-star pixel-star-2"></div>
        <div className="pixel-star pixel-star-3"></div>
      </div>

    </div>
  );
}