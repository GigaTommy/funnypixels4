import React, { useState, useCallback } from 'react';
import { AuthService, LoginRequest } from '../../services/auth';
import { useLegalLinks } from '../../hooks/useLegalLinks';
import LoginMessage from './LoginMessage';

interface LoginFormProps {
  onLoginSuccess: () => void;
  onSwitchToRegister: () => void;
}

export default function LoginForm({ onLoginSuccess, onSwitchToRegister }: LoginFormProps) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { openUserAgreement, openPrivacyPolicy } = useLegalLinks();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  // 处理登录
  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username && !email) {
      setError('请输入用户名或邮箱');
      return;
    }
    if (!password) {
      setError('请输入密码');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const loginData: LoginRequest = {
        email: email || '',
        password: password || '',
      };

      await AuthService.login(loginData);
      onLoginSuccess();

    } catch (error: any) {
      setError(error.response?.data?.error || '登录失败');
    } finally {
      setIsLoading(false);
    }
  }, [username, email, password, onLoginSuccess]);

  // 快速填充测试用户（仅在开发环境显示）
  const fillTestUser = (userType: 'user1' | 'user2') => {
    if (userType === 'user1') {
      setUsername('testuser1');
      setEmail('test1@example.com');
      setPassword('***'); // 密码已隐藏
    } else {
      setUsername('testuser2');
      setEmail('test2@example.com');
      setPassword('***'); // 密码已隐藏
    }
  };

  // 检查是否为开发环境
  const isDevelopment = import.meta.env.DEV;

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
        🎨 PixelWar 登录
      </h2>

      {/* 开发环境测试用户提示 */}
      {isDevelopment && (
        <div style={{
          marginBottom: '20px',
          padding: '15px',
          background: '#fff3cd',
          borderRadius: '8px',
          border: '1px solid #ffeaa7'
        }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px', color: '#856404' }}>
            🧪 开发环境 - 测试用户
          </div>
          <div style={{ fontSize: '12px', color: '#856404', marginBottom: '10px' }}>
            测试用户已通过数据库种子数据初始化，可使用以下信息登录：
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={() => fillTestUser('user1')}
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
              测试用户1
            </button>
            <button
              type="button"
              onClick={() => fillTestUser('user2')}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              测试用户2
            </button>
          </div>
          <div style={{ fontSize: '11px', color: '#856404', marginTop: '8px' }}>
            用户名: testuser1/testuser2 | 密码: *** (请查看数据库种子文件)
          </div>
        </div>
      )}

      <LoginMessage error={error} />

      <form onSubmit={handleLogin}>
        {/* 用户名输入 */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            👤 用户名
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="请输入用户名"
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

        {/* 密码输入 */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            🔒 密码
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="请输入密码"
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '16px'
            }}
          />
        </div>

        {/* 登录按钮 */}
        <button
          type="submit"
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '12px',
            background: isLoading ? '#6c757d' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            marginBottom: '15px'
          }}
        >
          {isLoading ? '⏳ 登录中...' : '🚀 登录'}
        </button>

        {/* 切换到注册 */}
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: '#666' }}>还没有账号？</span>
          <button
            type="button"
            onClick={onSwitchToRegister}
            style={{
              background: 'none',
              border: 'none',
              color: '#007bff',
              cursor: 'pointer',
              textDecoration: 'underline',
              marginLeft: '5px'
            }}
          >
            立即注册
          </button>
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
      </form>
    </div>
  );
}
