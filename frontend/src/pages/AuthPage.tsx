import React, { useState, useEffect } from 'react';
import { logger } from '../utils/logger';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs';
import { PhoneInput } from '../components/auth/PhoneInput';
import { VerificationCodeInput } from '../components/auth/VerificationCodeInput';
import { SocialLoginButton } from '../components/auth/SocialLoginButton';
import { AuthService } from '../services/auth';
import { Eye, EyeOff, Sparkles } from 'lucide-react';
import { validatePhoneNumber } from '../utils/phoneUtils';
import { config } from '../config/env';
import LoginForm from '../components/auth/LoginForm';
import PhoneLoginForm from '../components/auth/PhoneLoginForm';
import { useLegalLinks } from '../hooks/useLegalLinks';

interface AuthPageProps {
  onAuthSuccess: () => void;
}

export default function AuthPage({ onAuthSuccess }: AuthPageProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // 检查是否已经登录
  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (AuthService.isAuthenticated()) {
          const user = await AuthService.getCurrentUser();
          if (user) {
            logger.info('✅ 用户已登录:', user.username);
            onAuthSuccess();
            return;
          }
        }
      } catch (error) {
        logger.info('❌ 认证检查失败，需要重新登录');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [onAuthSuccess]);

  const handleLoginSuccess = () => {
    logger.info('🎉 登录成功');
    onAuthSuccess();
  };

  const handleRegisterSuccess = () => {
    logger.info('🎉 注册成功');
    onAuthSuccess();
  };

  const [activeTab, setActiveTab] = useState("login");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loginType, setLoginType] = useState<'email' | 'phone'>('email'); // 新增：登录类型
  const { legalInfo, openUserAgreement, openPrivacyPolicy } = useLegalLinks();

  // 登录表单状态
  const [loginEmail, setLoginEmail] = useState('');
  const [loginCode, setLoginCode] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginMethod, setLoginMethod] = useState<'email' | 'password'>('email');

  // 注册表单状态
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerCode, setRegisterCode] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  // 验证邮箱格式
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // 处理登录
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (loginMethod === 'email') {
      // 邮箱验证码登录
      if (!validateEmail(loginEmail)) {
        setLoginError('请输入正确的邮箱地址');
        return;
      }
      if (!loginCode) {
        setLoginError('请输入验证码');
        return;
      }

      try {
        setLoginLoading(true);
        setLoginError(null);

        const loginData = {
          email: loginEmail,
          verificationCode: loginCode,
        };

        await AuthService.login(loginData);
        handleLoginSuccess();

      } catch (error: any) {
        setLoginError(error.response?.data?.error || '登录失败');
      } finally {
        setLoginLoading(false);
      }
    } else {
      // 邮箱密码登录
      if (!validateEmail(loginEmail)) {
        setLoginError('请输入正确的邮箱地址');
        return;
      }
      if (!loginPassword) {
        setLoginError('请输入密码');
        return;
      }

      try {
        setLoginLoading(true);
        setLoginError(null);

        const loginData = {
          email: loginEmail,
          password: loginPassword,
        };

        await AuthService.login(loginData);
        handleLoginSuccess();

      } catch (error: any) {
        setLoginError(error.response?.data?.error || '登录失败');
      } finally {
        setLoginLoading(false);
      }
    }
  };

  // 处理注册
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateEmail(registerEmail)) {
      setRegisterError('请输入正确的邮箱地址');
      return;
    }
    if (!registerCode) {
      setRegisterError('请输入验证码');
      return;
    }
    if (!registerPassword) {
      setRegisterError('请输入密码');
      return;
    }
    if (registerPassword.length < 6) {
      setRegisterError('密码长度至少6个字符');
      return;
    }
    if (registerPassword !== registerConfirmPassword) {
      setRegisterError('两次输入的密码不一致');
      return;
    }

    try {
      setRegisterLoading(true);
      setRegisterError(null);

      const registerData = {
        email: registerEmail,
        verificationCode: registerCode,
        password: registerPassword,
      };

      await AuthService.register(registerData);
      handleRegisterSuccess();

    } catch (error: any) {
      setRegisterError(error.response?.data?.error || '注册失败');
    } finally {
      setRegisterLoading(false);
    }
  };

  // 发送验证码
  const handleSendLoginCode = async () => {
    if (!validateEmail(loginEmail)) {
      setLoginError('请输入正确的邮箱地址');
      return;
    }

    try {
      const response = await fetch(`${config.API_BASE_URL}/api/auth/send-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: loginEmail,
          type: 'login'
        }),
      });

      const data = await response.json();
      if (data.success) {
        logger.info('登录验证码发送成功');
        // 可以添加成功提示
      } else {
        setLoginError(data.error || '验证码发送失败');
      }
    } catch (error) {
      logger.error('发送登录验证码失败:', error);
      setLoginError('验证码发送失败，请稍后重试');
    }
  };

  const handleSendRegisterCode = async () => {
    if (!validateEmail(registerEmail)) {
      setRegisterError('请输入正确的邮箱地址');
      return;
    }

    try {
      const response = await fetch(`${config.API_BASE_URL}/api/auth/send-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: registerEmail,
          type: 'register'
        }),
      });

      const data = await response.json();
      if (data.success) {
        logger.info('注册验证码发送成功');
        // 可以添加成功提示
      } else {
        setRegisterError(data.error || '验证码发送失败');
      }
    } catch (error) {
      logger.error('发送注册验证码失败:', error);
      setRegisterError('验证码发送失败，请稍后重试');
    }
  };

  // 第三方登录
  const handleSocialLogin = (type: string) => {
    logger.info(`${type}登录`);
  };

  if (isLoading) {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="text-2xl font-semibold text-gray-700 mb-4">
            ⏳ 检查登录状态...
          </div>
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      background: 'linear-gradient(to bottom right, #eff6ff, #ffffff, #eef2ff)'
    }}>
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px 24px'
      }}>
        <div style={{
          width: '100%',
          maxWidth: '448px',
          margin: '0 auto'
        }}>
          {/* Logo区域 */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              textAlign: 'center',
              marginBottom: '32px'
            }}
          >
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '64px',
              height: '64px',
              background: 'linear-gradient(to bottom right, #3b82f6, #2563eb)',
              borderRadius: '16px',
              marginBottom: '8px'
            }}>
              <Sparkles style={{ width: '32px', height: '32px', color: 'white' }} />
            </div>
            <h1 style={{
              fontSize: '24px',
              fontWeight: '600',
              color: '#111827',
              marginBottom: '8px'
            }}>有趣的像素</h1>
            <p style={{
              fontSize: '16px',
              color: '#6b7280'
            }}>用脚步绘制世界</p>
          </motion.div>

          {/* 表单切换 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            style={{
              marginTop: '24px',
              marginBottom: '32px',
              display: 'flex',
              justifyContent: 'center'
            }}
          >
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList style={{
                display: 'flex',
                backgroundColor: '#f3f4f6',
                borderRadius: '12px',
                padding: '4px',
                gap: '4px',
                maxWidth: '280px',
                margin: '0 auto'
              }}>
                <TabsTrigger
                  value="login"
                  style={{
                    flex: 1,
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    backgroundColor: activeTab === 'login' ? 'white' : 'transparent',
                    color: activeTab === 'login' ? '#1f2937' : '#6b7280',
                    boxShadow: activeTab === 'login' ? '0 2px 4px rgba(0, 0, 0, 0.1)' : 'none'
                  }}
                >
                  登录
                </TabsTrigger>
                <TabsTrigger
                  value="register"
                  style={{
                    flex: 1,
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    backgroundColor: activeTab === 'register' ? 'white' : 'transparent',
                    color: activeTab === 'register' ? '#1f2937' : '#6b7280',
                    boxShadow: activeTab === 'register' ? '0 2px 4px rgba(0, 0, 0, 0.1)' : 'none'
                  }}
                >
                  注册
                </TabsTrigger>
              </TabsList>

              {/* 登录表单 */}
              <TabsContent value="login">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    padding: '16px'
                  }}
                >
                  <div style={{
                    textAlign: 'center',
                    marginBottom: '24px'
                  }}>
                    <h2 style={{
                      fontSize: '18px',
                      fontWeight: '600',
                      color: '#111827',
                      marginBottom: '8px'
                    }}>欢迎回来</h2>
                    <p style={{
                      fontSize: '16px',
                      color: '#6b7280',
                      marginBottom: '16px'
                    }}>请登录您的账户</p>

                    {/* 登录方式选择 */}
                    <div style={{
                      display: 'flex',
                      backgroundColor: '#f3f4f6',
                      borderRadius: '12px',
                      padding: '4px',
                      gap: '4px',
                      maxWidth: '320px',
                      margin: '0 auto'
                    }}>
                      <button
                        type="button"
                        onClick={() => {
                          setLoginType('email');
                          setLoginError(null);
                        }}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: 'none',
                          fontSize: '13px',
                          fontWeight: '500',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          backgroundColor: loginType === 'email' ? 'white' : 'transparent',
                          color: loginType === 'email' ? '#1f2937' : '#6b7280',
                          boxShadow: loginType === 'email' ? '0 2px 4px rgba(0, 0, 0, 0.1)' : 'none'
                        }}
                      >
                        📧 邮箱登录
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLoginType('phone');
                          setLoginError(null);
                        }}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: 'none',
                          fontSize: '13px',
                          fontWeight: '500',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          backgroundColor: loginType === 'phone' ? 'white' : 'transparent',
                          color: loginType === 'phone' ? '#1f2937' : '#6b7280',
                          boxShadow: loginType === 'phone' ? '0 2px 4px rgba(0, 0, 0, 0.1)' : 'none'
                        }}
                      >
                        📱 手机登录
                      </button>
                    </div>
                  </div>

                  {/* 根据登录类型显示不同的表单 */}
                  {loginType === 'phone' ? (
                    <PhoneLoginForm
                      onLoginSuccess={handleLoginSuccess}
                      onSwitchToEmailLogin={() => setLoginType('email')}
                      onSwitchToRegister={() => setActiveTab('register')}
                    />
                  ) : (
                    <div>
                      {loginError && (
                        <div style={{
                          padding: '12px',
                          backgroundColor: '#fef2f2',
                          border: '1px solid #fecaca',
                          borderRadius: '12px',
                          color: '#dc2626',
                          fontSize: '14px',
                          marginBottom: '24px'
                        }}>
                          ❌ {loginError}
                        </div>
                      )}

                      {/* 邮箱登录方式选择 */}
                      <div style={{
                        display: 'flex',
                        backgroundColor: '#f3f4f6',
                        borderRadius: '12px',
                        padding: '4px',
                        gap: '4px',
                        maxWidth: '280px',
                        margin: '0 auto 24px'
                      }}>
                        <button
                          type="button"
                          onClick={() => {
                            setLoginMethod('email');
                            setLoginError(null);
                            setLoginPassword('');
                          }}
                          style={{
                            flex: 1,
                            padding: '8px 16px',
                            borderRadius: '8px',
                            border: 'none',
                            fontSize: '14px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            backgroundColor: loginMethod === 'email' ? 'white' : 'transparent',
                            color: loginMethod === 'email' ? '#1f2937' : '#6b7280',
                            boxShadow: loginMethod === 'email' ? '0 2px 4px rgba(0, 0, 0, 0.1)' : 'none'
                          }}
                        >
                          验证码登录
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setLoginMethod('password');
                            setLoginError(null);
                            setLoginCode('');
                          }}
                          style={{
                            flex: 1,
                            padding: '8px 16px',
                            borderRadius: '8px',
                            border: 'none',
                            fontSize: '14px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            backgroundColor: loginMethod === 'password' ? 'white' : 'transparent',
                            color: loginMethod === 'password' ? '#1f2937' : '#6b7280',
                            boxShadow: loginMethod === 'password' ? '0 2px 4px rgba(0, 0, 0, 0.1)' : 'none'
                          }}
                        >
                          密码登录
                        </button>
                      </div>

                      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {loginMethod === 'email' ? (
                          <>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <label style={{
                                fontSize: '16px',
                                fontWeight: '500',
                                color: '#374151'
                              }}>邮箱地址</label>
                              <input
                                type="email"
                                value={loginEmail}
                                onChange={(e) => setLoginEmail(e.target.value)}
                                placeholder="请输入邮箱地址"
                                style={{
                                  width: '90%',
                                  height: '48px',
                                  padding: '0 16px',
                                  border: '2px solid #e5e7eb',
                                  borderRadius: '12px',
                                  fontSize: '16px',
                                  transition: 'border-color 0.2s',
                                  outline: 'none'
                                }}
                                onFocus={(e) => {
                                  e.target.style.borderColor = '#3b82f6';
                                }}
                                onBlur={(e) => {
                                  e.target.style.borderColor = '#e5e7eb';
                                }}
                              />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <label style={{
                                fontSize: '16px',
                                fontWeight: '500',
                                color: '#374151'
                              }}>验证码</label>
                              <VerificationCodeInput
                                value={loginCode}
                                onChange={setLoginCode}
                                phoneNumber={loginEmail}
                                onSendCode={handleSendLoginCode}
                                placeholder="请输入验证码"
                              />
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <label style={{
                                fontSize: '16px',
                                fontWeight: '500',
                                color: '#374151'
                              }}>邮箱地址</label>
                              <input
                                type="email"
                                value={loginEmail}
                                onChange={(e) => setLoginEmail(e.target.value)}
                                placeholder="请输入邮箱地址"
                                style={{
                                  width: '90%',
                                  height: '48px',
                                  padding: '0 16px',
                                  border: '2px solid #e5e7eb',
                                  borderRadius: '12px',
                                  fontSize: '16px',
                                  transition: 'border-color 0.2s',
                                  outline: 'none'
                                }}
                                onFocus={(e) => {
                                  e.target.style.borderColor = '#3b82f6';
                                }}
                                onBlur={(e) => {
                                  e.target.style.borderColor = '#e5e7eb';
                                }}
                              />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <label style={{
                                fontSize: '16px',
                                fontWeight: '500',
                                color: '#374151'
                              }}>密码</label>
                              <div style={{ position: 'relative' }}>
                                <input
                                  type={showPassword ? 'text' : 'password'}
                                  value={loginPassword}
                                  onChange={(e) => setLoginPassword(e.target.value)}
                                  placeholder="请输入密码"
                                  style={{
                                    width: '83%',
                                    height: '48px',
                                    padding: '0 48px 0 16px',
                                    border: '2px solid #e5e7eb',
                                    borderRadius: '12px',
                                    fontSize: '16px',
                                    transition: 'border-color 0.2s',
                                    outline: 'none'
                                  }}
                                  onFocus={(e) => {
                                    e.target.style.borderColor = '#3b82f6';
                                  }}
                                  onBlur={(e) => {
                                    e.target.style.borderColor = '#e5e7eb';
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowPassword(!showPassword)}
                                  style={{
                                    position: 'absolute',
                                    right: '12px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#6b7280',
                                    padding: '4px'
                                  }}
                                >
                                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                              </div>
                            </div>
                          </>
                        )}

                        <button
                          type="submit"
                          disabled={loginLoading}
                          style={{
                            width: '100%',
                            height: '48px',
                            borderRadius: '12px',
                            background: 'linear-gradient(to right, #3b82f6, #2563eb)',
                            color: 'white',
                            fontSize: '16px',
                            fontWeight: '500',
                            border: 'none',
                            cursor: loginLoading ? 'not-allowed' : 'pointer',
                            opacity: loginLoading ? 0.7 : 1,
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          onMouseEnter={(e) => {
                            if (!loginLoading) {
                              e.currentTarget.style.background = 'linear-gradient(to right, #2563eb, #1d4ed8)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!loginLoading) {
                              e.currentTarget.style.background = 'linear-gradient(to right, #3b82f6, #2563eb)';
                            }
                          }}
                        >
                          {loginLoading ? '⏳ 登录中...' : '登录'}
                        </button>
                      </form>

                      {/* 分隔线 */}
                      <div style={{
                        position: 'relative',
                        margin: '24px 0'
                      }}>
                        <div style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          display: 'flex',
                          alignItems: 'center'
                        }}>
                          <div style={{
                            width: '100%',
                            borderTop: '1px solid #e5e7eb'
                          }}></div>
                        </div>
                        <div style={{
                          position: 'relative',
                          display: 'flex',
                          justifyContent: 'center'
                        }}>
                          <span style={{
                            backgroundColor: 'white',
                            padding: '0 16px',
                            fontSize: '14px',
                            color: '#6b7280'
                          }}>其他登录方式</span>
                        </div>
                      </div>

                      {/* 第三方登录 */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '16px'
                      }}>
                        <button
                          onClick={() => handleSocialLogin('微信')}
                          style={{
                            width: '100%',
                            height: '48px',
                            borderRadius: '12px',
                            border: '1px solid #e5e7eb',
                            backgroundColor: 'transparent',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f0fdf4';
                            e.currentTarget.style.borderColor = '#22c55e';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.borderColor = '#e5e7eb';
                          }}
                        >
                          <div style={{
                            width: '24px',
                            height: '24px',
                            backgroundColor: '#22c55e',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '16px'
                          }}>
                            💬
                          </div>
                        </button>
                        <button
                          onClick={() => handleSocialLogin('小红书')}
                          style={{
                            width: '100%',
                            height: '48px',
                            borderRadius: '12px',
                            border: '1px solid #e5e7eb',
                            backgroundColor: 'transparent',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#fef2f2';
                            e.currentTarget.style.borderColor = '#ef4444';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.borderColor = '#e5e7eb';
                          }}
                        >
                          <div style={{
                            width: '24px',
                            height: '24px',
                            backgroundColor: '#ef4444',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '16px'
                          }}>
                            📖
                          </div>
                        </button>
                        <button
                          onClick={() => handleSocialLogin('抖音')}
                          style={{
                            width: '100%',
                            height: '48px',
                            borderRadius: '12px',
                            border: '1px solid #e5e7eb',
                            backgroundColor: 'transparent',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f3f4f6';
                            e.currentTarget.style.borderColor = '#374151';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.borderColor = '#e5e7eb';
                          }}
                        >
                          <div style={{
                            width: '24px',
                            height: '24px',
                            backgroundColor: '#000000',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '16px'
                          }}>
                            🎵
                          </div>
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              </TabsContent>

              {/* 注册表单 */}
              <TabsContent value="register">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    padding: '32px'
                  }}
                >
                  <div style={{
                    textAlign: 'center',
                    marginBottom: '2px'
                  }}>
                    <h2 style={{
                      fontSize: '18px',
                      fontWeight: '600',
                      color: '#111827',
                      marginBottom: '8px'
                    }}>创建您的账户</h2>
                    <p style={{
                      fontSize: '16px',
                      color: '#6b7280'
                    }}>加入FunnyPixels社区</p>
                  </div>

                  {registerError && (
                    <div style={{
                      padding: '12px',
                      backgroundColor: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '12px',
                      color: '#dc2626',
                      fontSize: '14px',
                      marginBottom: '24px'
                    }}>
                      ❌ {registerError}
                    </div>
                  )}

                  <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{
                        fontSize: '16px',
                        fontWeight: '500',
                        color: '#374151'
                      }}>邮箱地址</label>
                      <input
                        type="email"
                        value={registerEmail}
                        onChange={(e) => setRegisterEmail(e.target.value)}
                        placeholder="请输入邮箱地址"
                        style={{
                          width: '90%',
                          height: '48px',
                          padding: '0 16px',
                          border: '2px solid #e5e7eb',
                          borderRadius: '12px',
                          fontSize: '16px',
                          transition: 'border-color 0.2s',
                          outline: 'none'
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = '#3b82f6';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = '#e5e7eb';
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{
                        fontSize: '16px',
                        fontWeight: '500',
                        color: '#374151'
                      }}>验证码</label>
                      <VerificationCodeInput
                        value={registerCode}
                        onChange={setRegisterCode}
                        phoneNumber={registerEmail}
                        onSendCode={handleSendRegisterCode}
                        placeholder="请输入验证码"
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{
                        fontSize: '16px',
                        fontWeight: '500',
                        color: '#374151'
                      }}>设置密码</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showPassword ? "text" : "password"}
                          value={registerPassword}
                          onChange={(e) => setRegisterPassword(e.target.value)}
                          placeholder="请设置6-20位密码"
                          style={{
                            width: '82%',
                            height: '48px',
                            paddingLeft: '16px',
                            paddingRight: '48px',
                            backgroundColor: '#f9fafb',
                            border: '1px solid #e5e7eb',
                            borderRadius: '12px',
                            fontSize: '16px',
                            fontWeight: '400',
                            outline: 'none',
                            transition: 'all 0.2s'
                          }}
                          onFocus={(e) => {
                            e.target.style.borderColor = '#3b82f6';
                            e.target.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.2)';
                          }}
                          onBlur={(e) => {
                            e.target.style.borderColor = '#e5e7eb';
                            e.target.style.boxShadow = 'none';
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          style={{
                            position: 'absolute',
                            right: '12px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: '#9ca3af',
                            padding: '4px',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '32px',
                            height: '32px'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = '#6b7280';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = '#9ca3af';
                          }}
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{
                        fontSize: '16px',
                        fontWeight: '500',
                        color: '#374151'
                      }}>确认密码</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          value={registerConfirmPassword}
                          onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                          placeholder="请再次输入密码"
                          style={{
                            width: '82%',
                            height: '48px',
                            paddingLeft: '16px',
                            paddingRight: '48px',
                            backgroundColor: '#f9fafb',
                            border: '1px solid #e5e7eb',
                            borderRadius: '12px',
                            fontSize: '16px',
                            fontWeight: '400',
                            outline: 'none',
                            transition: 'all 0.2s'
                          }}
                          onFocus={(e) => {
                            e.target.style.borderColor = '#3b82f6';
                            e.target.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.2)';
                          }}
                          onBlur={(e) => {
                            e.target.style.borderColor = '#e5e7eb';
                            e.target.style.boxShadow = 'none';
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          style={{
                            position: 'absolute',
                            right: '12px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: '#9ca3af',
                            padding: '4px',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '32px',
                            height: '32px'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = '#6b7280';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = '#9ca3af';
                          }}
                        >
                          {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={registerLoading}
                      style={{
                        width: '100%',
                        height: '48px',
                        borderRadius: '12px',
                        background: 'linear-gradient(to right, #3b82f6, #2563eb)',
                        color: 'white',
                        fontSize: '16px',
                        fontWeight: '500',
                        border: 'none',
                        cursor: registerLoading ? 'not-allowed' : 'pointer',
                        opacity: registerLoading ? 0.7 : 1,
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      onMouseEnter={(e) => {
                        if (!registerLoading) {
                          e.currentTarget.style.background = 'linear-gradient(to right, #2563eb, #1d4ed8)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!registerLoading) {
                          e.currentTarget.style.background = 'linear-gradient(to right, #3b82f6, #2563eb)';
                        }
                      }}
                    >
                      {registerLoading ? '⏳ 注册中...' : '立即注册'}
                    </button>
                  </form>

                  {/* 协议提示 */}
                  <div style={{
                    marginTop: '24px',
                    textAlign: 'center'
                  }}>
                    <p style={{
                      fontSize: '14px',
                      color: '#6b7280',
                      lineHeight: '1.6'
                    }}>
                      注册即表示同意
                      <span
                        style={{
                          color: '#2563eb',
                          cursor: 'pointer',
                          textDecoration: 'underline'
                        }}
                        onClick={openUserAgreement}
                      >《用户协议》</span>
                      和
                      <span
                        style={{
                          color: '#2563eb',
                          cursor: 'pointer',
                          textDecoration: 'underline'
                        }}
                        onClick={openPrivacyPolicy}
                      >《隐私政策》</span>
                    </p>
                  </div>
                </motion.div>
              </TabsContent>
            </Tabs>
          </motion.div>

        </div>
      </div>
    </div>
  );
}
