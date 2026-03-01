import React, { useState, useCallback } from 'react';
import { logger } from '../../utils/logger';
import { PhoneInput } from './PhoneInput';
import { VerificationCodeInput } from './VerificationCodeInput';
import { GraphicVerification } from './GraphicVerification';
import { AuthService, LoginRequest } from '../../services/auth';
import { useLegalLinks } from '../../hooks/useLegalLinks';
import MobileAuthService from '../../services/mobileAuthService';
import LoginMessage from './LoginMessage';

interface PhoneLoginFormProps {
  onLoginSuccess: () => void;
  onSwitchToEmailLogin: () => void;
  onSwitchToRegister: () => void;
}

interface VerificationChallenge {
  id: string;
  type: 'shape' | 'color' | 'object' | 'pattern';
  question: string;
  options: Array<{
    id: string;
    content: string;
    label: string;
  }>;
  timeLimit: number;
  difficulty: 'easy' | 'medium' | 'hard';
  expiresAt: string;
}

export default function PhoneLoginForm({ onLoginSuccess, onSwitchToEmailLogin, onSwitchToRegister }: PhoneLoginFormProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const { openUserAgreement, openPrivacyPolicy } = useLegalLinks();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<'phone' | 'code' | 'graphic'>('phone');
  const [graphicChallenge, setGraphicChallenge] = useState<VerificationChallenge | null>(null);
  const [isDevelopment, setIsDevelopment] = useState(false);

  // 检测环境
  React.useEffect(() => {
    setIsDevelopment(import.meta.env.DEV);
  }, []);

  // 自动检测手机号
  const handleAutoDetectPhone = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const detectionResult = await MobileAuthService.detectPhoneNumber();

      if (detectionResult.success && detectionResult.phone) {
        setPhoneNumber(detectionResult.phone);
        setCurrentStep('code');
      } else {
        // 如果自动检测失败，提示用户手动输入
        setError(detectionResult.error || '无法自动获取手机号，请手动输入');
      }
    } catch (error: any) {
      logger.error('自动检测手机号失败:', error);
      setError('自动检测失败，请手动输入手机号');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 发送验证码
  const handleSendCode = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 发送验证码请求
      const response = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: phoneNumber,
          type: 'login'
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || '发送验证码失败');
      }

      setCurrentStep('code');

      // 开发环境显示验证码
      if (isDevelopment && data.code) {
        setError(`🧪 开发环境验证码: ${data.code}`);
      }

    } catch (error: any) {
      setError(error.message || '发送验证码失败');
    } finally {
      setIsLoading(false);
    }
  }, [phoneNumber, isDevelopment]);

  // 验证短信验证码
  const handleVerifySmsCode = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 验证短信验证码
      const response = await fetch('/api/sms/verify-sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: phoneNumber,
          smsCode: verificationCode,
          type: 'login'
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || '短信验证失败');
      }

      // 如果返回了图形验证挑战，显示图形验证
      if (data.data?.challenge) {
        setGraphicChallenge(data.data.challenge);
        setCurrentStep('graphic');
      } else {
        // 否则直接登录成功（可能是开发环境）
        await handleLoginSuccess();
      }

    } catch (error: any) {
      setError(error.message || '验证码验证失败');
    } finally {
      setIsLoading(false);
    }
  }, [phoneNumber, verificationCode]);

  // 处理图形验证成功
  const handleGraphicSuccess = useCallback((tokens: any, user: any) => {
    // 存储令牌
    localStorage.setItem('authToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);

    // 存储用户信息
    localStorage.setItem('userInfo', JSON.stringify(user));

    onLoginSuccess();
  }, [onLoginSuccess]);

  // 处理图形验证失败
  const handleGraphicFailure = useCallback((errorMessage: string, remainingAttempts?: number) => {
    if (remainingAttempts !== undefined && remainingAttempts <= 0) {
      // 尝试次数用完，返回到手机号输入
      setCurrentStep('phone');
      setVerificationCode('');
      setGraphicChallenge(null);
    }
    setError(errorMessage);
  }, []);

  // 处理登录成功
  const handleLoginSuccess = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: phoneNumber,
          verificationCode: verificationCode
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || '登录失败');
      }

      // 存储令牌
      localStorage.setItem('authToken', data.tokens.accessToken);
      localStorage.setItem('refreshToken', data.tokens.refreshToken);

      // 存储用户信息
      localStorage.setItem('userInfo', JSON.stringify(data.user));

      onLoginSuccess();

    } catch (error: any) {
      setError(error.message || '登录失败');
    } finally {
      setIsLoading(false);
    }
  }, [phoneNumber, verificationCode, onLoginSuccess]);

  // 重置状态
  const handleReset = () => {
    setCurrentStep('phone');
    setVerificationCode('');
    setGraphicChallenge(null);
    setError(null);
  };

  // 快速填充测试手机号（仅开发环境）
  const fillTestPhone = () => {
    setPhoneNumber('13800138000');
    setCurrentStep('code');
  };

  return (
    <div style={{
      maxWidth: '400px',
      margin: '0 auto',
      padding: '30px',
      background: 'white',
      borderRadius: '10px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
    }}>
      <h2 style={{ textAlign: 'center', marginBottom: '30px', color: '#333' }}>
        📱 手机号登录
      </h2>

      {/* 开发环境测试选项 */}
      {isDevelopment && (
        <div style={{
          marginBottom: '20px',
          padding: '15px',
          background: '#fff3cd',
          borderRadius: '8px',
          border: '1px solid #ffeaa7'
        }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px', color: '#856404' }}>
            🧪 开发环境 - 测试选项
          </div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
            <button
              type="button"
              onClick={fillTestPhone}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              填充测试手机号
            </button>
            <button
              type="button"
              onClick={handleAutoDetectPhone}
              disabled={isLoading}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.5 : 1
              }}
            >
              {isLoading ? '检测中...' : '自动检测手机号'}
            </button>
          </div>
          <div style={{ fontSize: '11px', color: '#856404' }}>
            测试手机号: 13800138000 | 自动检测需在WebView中
          </div>
        </div>
      )}

      {/* 错误提示 */}
      <LoginMessage
        error={error && !error.includes('开发环境验证码') ? error : null}
        info={error && error.includes('开发环境验证码') ? error : null}
      />

      {/* 步骤指示器 */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: currentStep === 'phone' ? '#007bff' : currentStep === 'code' || currentStep === 'graphic' ? '#28a745' : '#e9ecef',
            color: currentStep === 'phone' || currentStep === 'code' || currentStep === 'graphic' ? 'white' : '#6c757d',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: 'bold'
          }}>
            1
          </div>
          <div style={{
            width: '40px',
            height: '2px',
            background: currentStep === 'code' || currentStep === 'graphic' ? '#007bff' : '#e9ecef'
          }}></div>
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: currentStep === 'code' || currentStep === 'graphic' ? '#007bff' : '#e9ecef',
            color: currentStep === 'code' || currentStep === 'graphic' ? 'white' : '#6c757d',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: 'bold'
          }}>
            2
          </div>
          <div style={{
            width: '40px',
            height: '2px',
            background: currentStep === 'graphic' ? '#007bff' : '#e9ecef'
          }}></div>
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: currentStep === 'graphic' ? '#007bff' : '#e9ecef',
            color: currentStep === 'graphic' ? 'white' : '#6c757d',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: 'bold'
          }}>
            3
          </div>
        </div>
      </div>

      {/* 步骤内容 */}
      {currentStep === 'phone' && (
        <div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
              📱 请输入手机号
            </label>
            <PhoneInput
              value={phoneNumber}
              onChange={setPhoneNumber}
              disabled={isLoading}
              placeholder="请输入11位手机号"
            />
          </div>

          <button
            onClick={handleSendCode}
            disabled={!phoneNumber || phoneNumber.length !== 13 || isLoading}
            style={{
              width: '100%',
              padding: '12px',
              background: (!phoneNumber || phoneNumber.length !== 13 || isLoading) ? '#6c757d' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '16px',
              cursor: (!phoneNumber || phoneNumber.length !== 13 || isLoading) ? 'not-allowed' : 'pointer',
              marginBottom: '15px'
            }}
          >
            {isLoading ? '⏳ 发送中...' : '📤 发送验证码'}
          </button>

          {isDevelopment && (
            <div style={{ textAlign: 'center', marginBottom: '15px' }}>
              <button
                type="button"
                onClick={() => setCurrentStep('code')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#6c757d',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  fontSize: '12px'
                }}
              >
                跳过发送验证码（开发环境）
              </button>
            </div>
          )}
        </div>
      )}

      {currentStep === 'code' && (
        <div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
              🔐 请输入验证码
            </label>
            <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '8px' }}>
              已发送至: {phoneNumber}
            </div>
            <VerificationCodeInput
              value={verificationCode}
              onChange={setVerificationCode}
              phoneNumber={phoneNumber}
              onSendCode={handleSendCode}
              disabled={isLoading}
              placeholder="请输入6位验证码"
            />
          </div>

          <button
            onClick={isDevelopment ? handleLoginSuccess : handleVerifySmsCode}
            disabled={!verificationCode || verificationCode.length !== 6 || isLoading}
            style={{
              width: '100%',
              padding: '12px',
              background: (!verificationCode || verificationCode.length !== 6 || isLoading) ? '#6c757d' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '16px',
              cursor: (!verificationCode || verificationCode.length !== 6 || isLoading) ? 'not-allowed' : 'pointer',
              marginBottom: '15px'
            }}
          >
            {isLoading ? '⏳ 验证中...' : (isDevelopment ? '🚀 直接登录' : '🔍 验证短信')}
          </button>

          <div style={{ textAlign: 'center' }}>
            <button
              type="button"
              onClick={handleReset}
              style={{
                background: 'none',
                border: 'none',
                color: '#6c757d',
                cursor: 'pointer',
                textDecoration: 'underline',
                fontSize: '14px'
              }}
            >
              ← 返回重新输入手机号
            </button>
          </div>
        </div>
      )}

      {/* 切换登录方式 */}
      <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
        <div style={{ textAlign: 'center', marginBottom: '10px' }}>
          <span style={{ color: '#666' }}>其他登录方式</span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={onSwitchToEmailLogin}
            style={{
              flex: 1,
              padding: '10px',
              background: '#f8f9fa',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              color: '#495057',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            📧 邮箱登录
          </button>
          <button
            type="button"
            onClick={onSwitchToRegister}
            style={{
              flex: 1,
              padding: '10px',
              background: '#e3f2fd',
              border: '1px solid #bbdefb',
              borderRadius: '4px',
              color: '#1976d2',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            📝 注册账号
          </button>
        </div>
      </div>

      {/* 用户协议和隐私政策链接 */}
      <div style={{ textAlign: 'center', fontSize: '12px', color: '#999', marginTop: '20px' }}>
        <span>点击"登录"即表示您同意</span>
        <div style={{ marginTop: '5px' }}>
          <a
            onClick={openUserAgreement}
            style={{
              color: '#1890ff',
              textDecoration: 'underline',
              padding: '2px 4px',
              cursor: 'pointer'
            }}
          >
            《用户协议》
          </a>
          <span style={{ margin: '0 5px' }}>和</span>
          <a
            onClick={openPrivacyPolicy}
            style={{
              color: '#1890ff',
              textDecoration: 'underline',
              padding: '2px 4px',
              cursor: 'pointer'
            }}
          >
            《隐私政策》
          </a>
        </div>
      </div>

      {/* 图形验证模态框 */}
      {graphicChallenge && (
        <GraphicVerification
          challenge={graphicChallenge}
          phone={phoneNumber}
          onSuccess={handleGraphicSuccess}
          onFailure={handleGraphicFailure}
          onExpired={handleReset}
        />
      )}
    </div>
  );
}