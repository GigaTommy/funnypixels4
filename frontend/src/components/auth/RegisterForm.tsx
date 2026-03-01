import React, { useState, useCallback } from 'react';
import { AuthService, RegisterRequest } from '../../services/auth';
import LoginMessage from './LoginMessage';

interface RegisterFormProps {
  onRegisterSuccess: () => void;
  onSwitchToLogin: () => void;
}

export default function RegisterForm({ onRegisterSuccess, onSwitchToLogin }: RegisterFormProps) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [showVerificationCode, setShowVerificationCode] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [isSendingCode, setIsSendingCode] = useState(false);



  // 验证表单
  const validateForm = useCallback(() => {
    if (!username.trim()) {
      setError('请输入用户名');
      return false;
    }

    if (username.length < 3 || username.length > 20) {
      setError('用户名长度应在3-20个字符之间');
      return false;
    }

    if (!email) {
      setError('请输入邮箱');
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('请输入有效的邮箱地址');
      return false;
    }

    if (!password) {
      setError('请输入密码');
      return false;
    }

    if (password.length < 6) {
      setError('密码长度至少6位');
      return false;
    }

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return false;
    }

    return true;
  }, [username, email, password, confirmPassword]);

  // 处理注册
  const handleRegister = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const registerData: RegisterRequest = {
        email,
        password,
        verificationCode: verificationCode || '',
      };

      await AuthService.register(registerData);
      onRegisterSuccess();
      
    } catch (error: any) {
      setError(error.response?.data?.error || '注册失败');
    } finally {
      setIsLoading(false);
    }
  }, [username, email, password, phone, validateForm, onRegisterSuccess]);

  // 处理发送验证码
  const handleSendVerificationCode = useCallback(async () => {
    if (!phone) {
      setError('请先输入手机号');
      return;
    }

    try {
      setIsSendingCode(true);
      setError(null);
      
      // 这里可以调用发送验证码的API
      // await AuthService.sendVerificationCode(phone);
      
      setShowVerificationCode(true);
      setCountdown(60);
      
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
    } catch (error: any) {
      setError(error.response?.data?.error || '发送验证码失败');
    } finally {
      setIsSendingCode(false);
    }
  }, [phone]);

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
        🎨 PixelWar 注册
      </h2>

      <LoginMessage error={error} />

      <form onSubmit={handleRegister}>
                {/* 用户名输入 */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            👤 用户名
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="请输入用户名（3-20个字符）"
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '16px'
            }}
          />
        </div>

                {/* 邮箱输入 */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            📧 邮箱
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="请输入邮箱"
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '16px'
            }}
          />
        </div>

        {/* 手机号输入（可选） */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            📱 手机号（可选）
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="请输入手机号（可选）"
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '16px'
            }}
          />
        </div>

        {/* 验证码输入 */}
        {showVerificationCode && (
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              📱 验证码
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="请输入验证码"
                style={{
                  flex: 1,
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '16px'
                }}
              />
              <button
                type="button"
                onClick={handleSendVerificationCode}
                disabled={isSendingCode || countdown > 0}
                style={{
                  padding: '12px 20px',
                  background: isSendingCode ? '#6c757d' : '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isSendingCode ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {isSendingCode ? '发送中...' : countdown > 0 ? `${countdown}s` : '发送验证码'}
              </button>
            </div>
          </div>
        )}

        {/* 密码输入 */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            🔒 密码
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="请输入密码（至少6位）"
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '16px'
            }}
          />
        </div>

        {/* 确认密码输入 */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            🔒 确认密码
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="请再次输入密码"
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '16px'
            }}
          />
        </div>

        {/* 注册按钮 */}
        <button
          type="submit"
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '12px',
            background: isLoading ? '#6c757d' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            marginBottom: '15px'
          }}
        >
          {isLoading ? '⏳ 注册中...' : '🚀 注册'}
        </button>

        {/* 切换到登录 */}
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: '#666' }}>已有账号？</span>
          <button
            type="button"
            onClick={onSwitchToLogin}
            style={{
              background: 'none',
              border: 'none',
              color: '#007bff',
              cursor: 'pointer',
              textDecoration: 'underline',
              marginLeft: '5px'
            }}
          >
            立即登录
          </button>
        </div>

        {/* 用户协议和隐私政策链接 */}
        <div style={{ textAlign: 'center', fontSize: '12px', color: '#999', marginTop: '20px' }}>
          <span>点击"注册"即表示您同意</span>
          <div style={{ marginTop: '5px' }}>
            <a
              href="/user-agreement.html"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#1890ff',
                textDecoration: 'underline',
                padding: '2px 4px'
              }}
            >
              《用户协议》
            </a>
            <span style={{ margin: '0 5px' }}>和</span>
            <a
              href="/privacy-policy.html"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#1890ff',
                textDecoration: 'underline',
                padding: '2px 4px'
              }}
            >
              《隐私政策》
            </a>
          </div>
        </div>
      </form>
    </div>
  );
}
