import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { logger } from '../../utils/logger';
import {
  RiMailLine,
  RiLockLine,
  RiEyeLine,
  RiEyeOffLine,
  RiLoader4Line,
  RiCheckLine,
  RiErrorWarningLine,
  RiSendPlaneLine,
  RiShieldCheckLine,
  RiArrowRightLine,
  RiArrowLeftLine
} from 'react-icons/ri';
import { AuthService } from '../../services/auth';

interface EmailLoginFormProps {
  onLoginSuccess: () => void;
  onSwitchToPhoneLogin: () => void;
  onSwitchToRegister: () => void;
}

export default function EmailLoginForm({ onLoginSuccess, onSwitchToPhoneLogin, onSwitchToRegister }: EmailLoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginMethod, setLoginMethod] = useState<'password' | 'code'>('code');
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  // 验证邮箱格式
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // 发送验证码
  const handleSendCode = useCallback(async () => {
    if (!validateEmail(email)) {
      setError('请输入正确的邮箱地址');
      return;
    }

    setIsSendingCode(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          type: 'login'
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('验证码已发送到您的邮箱');
        startCountdown(60);

        if (import.meta.env.DEV && data.code) {
          logger.info(`🧪 开发环境验证码: ${data.code}`);
        }
      } else {
        setError(data.error || '验证码发送失败');
      }
    } catch (error) {
      logger.error('发送验证码失败:', error);
      setError('验证码发送失败，请稍后重试');
    } finally {
      setIsSendingCode(false);
    }
  }, [email]);

  // 开始倒计时
  const startCountdown = (seconds: number) => {
    setCountdown(seconds);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // 处理登录
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!validateEmail(email)) {
      setError('请输入正确的邮箱地址');
      return;
    }

    if (loginMethod === 'code' && !verificationCode) {
      setError('请输入验证码');
      return;
    }

    if (loginMethod === 'password' && !password) {
      setError('请输入密码');
      return;
    }

    setIsLoading(true);

    try {
      let loginData;
      if (loginMethod === 'code') {
        loginData = {
          email,
          verificationCode,
        };
      } else {
        loginData = {
          email,
          password,
        };
      }

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginData)
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('登录成功，正在跳转...');

        if (data.tokens) {
          localStorage.setItem('authToken', data.tokens.accessToken);
          localStorage.setItem('refreshToken', data.tokens.refreshToken);
        }

        if (data.user) {
          localStorage.setItem('userInfo', JSON.stringify(data.user));
        }

        setTimeout(() => {
          onLoginSuccess();
        }, 1000);
      } else {
        setError(data.error || '登录失败');
      }
    } catch (error) {
      logger.error('登录失败:', error);
      setError('登录失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin} className="space-y-6">
      {/* 错误/成功提示 */}
      <AnimatePresence mode="wait">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-red-500/20 backdrop-blur-md border border-red-500/30 rounded-2xl flex items-center gap-3 text-red-300"
          >
            <RiErrorWarningLine className="text-xl flex-shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-green-500/20 backdrop-blur-md border border-green-500/30 rounded-2xl flex items-center gap-3 text-green-300"
          >
            <RiCheckLine className="text-xl flex-shrink-0" />
            <span className="text-sm font-medium">{success}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 登录方式切换 */}
      <div className="bg-white/5 backdrop-blur-md rounded-2xl p-1.5 border border-white/10">
        <div className="grid grid-cols-2">
          <motion.button
            type="button"
            onClick={() => {
              setLoginMethod('code');
              setError(null);
              setPassword('');
            }}
            whileHover={{ scale: loginMethod === 'code' ? 1 : 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-300 ${
              loginMethod === 'code'
                ? 'bg-white/20 text-white shadow-lg'
                : 'text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            验证码登录
          </motion.button>
          <motion.button
            type="button"
            onClick={() => {
              setLoginMethod('password');
              setError(null);
              setVerificationCode('');
            }}
            whileHover={{ scale: loginMethod === 'password' ? 1 : 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-300 ${
              loginMethod === 'password'
                ? 'bg-white/20 text-white shadow-lg'
                : 'text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            密码登录
          </motion.button>
        </div>
      </div>

      {/* 邮箱输入 */}
      <div>
        <label className="block text-sm font-medium text-white/80 mb-3">
          <RiMailLine className="inline mr-2" />
          邮箱地址
        </label>
        <div className="relative">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="请输入邮箱地址"
            className="w-full px-4 py-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-300 text-white/90 placeholder-white/40"
            required
          />
          {validateEmail(email) && (
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-green-400">
              <RiCheckLine className="text-xl" />
            </div>
          )}
        </div>
      </div>

      {/* 验证码输入 */}
      {loginMethod === 'code' && (
        <div>
          <label className="block text-sm font-medium text-white/80 mb-3">
            <RiShieldCheckLine className="inline mr-2" />
            验证码
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
              placeholder="请输入6位验证码"
              maxLength={6}
              className="flex-1 px-4 py-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-300 text-white/90 placeholder-white/40"
              required
            />
            <motion.button
              type="button"
              onClick={handleSendCode}
              disabled={!validateEmail(email) || isSendingCode || countdown > 0}
              whileHover={{ scale: (!validateEmail(email) || isSendingCode || countdown > 0) ? 1 : 1.02 }}
              whileTap={{ scale: (!validateEmail(email) || isSendingCode || countdown > 0) ? 1 : 0.98 }}
              className="px-6 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl hover:from-purple-600 hover:to-pink-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed transition-all duration-300 flex items-center gap-2 text-sm font-medium shadow-lg shadow-purple-500/25"
            >
              {isSendingCode ? (
                <RiLoader4Line className="animate-spin" />
              ) : (
                <RiSendPlaneLine />
              )}
              {countdown > 0 ? `${countdown}s` : '发送验证码'}
            </motion.button>
          </div>
        </div>
      )}

      {/* 密码输入 */}
      {loginMethod === 'password' && (
        <div>
          <label className="block text-sm font-medium text-white/80 mb-3">
            <RiLockLine className="inline mr-2" />
            密码
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              className="w-full px-4 py-4 pr-16 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-300 text-white/90 placeholder-white/40"
              required
            />
            <motion.button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white transition-colors duration-300"
            >
              {showPassword ? <RiEyeOffLine /> : <RiEyeLine />}
            </motion.button>
          </div>
        </div>
      )}

      {/* 登录按钮 */}
      <motion.button
        type="submit"
        disabled={isLoading || !validateEmail(email) || (loginMethod === 'code' ? !verificationCode : !password)}
        whileHover={{ scale: (isLoading || !validateEmail(email) || (loginMethod === 'code' ? !verificationCode : !password)) ? 1 : 1.02 }}
        whileTap={{ scale: (isLoading || !validateEmail(email) || (loginMethod === 'code' ? !verificationCode : !password)) ? 1 : 0.98 }}
        className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl hover:from-purple-600 hover:to-pink-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed transition-all duration-300 font-semibold shadow-xl shadow-purple-500/25 flex items-center justify-center gap-3"
      >
        {isLoading ? (
          <>
            <RiLoader4Line className="animate-spin" />
            登录中...
          </>
        ) : (
          <>
            {loginMethod === 'code' ? '验证码登录' : '密码登录'}
            <RiArrowRightLine />
          </>
        )}
      </motion.button>

      {/* 底部链接 */}
      <div className="flex justify-between items-center text-sm pt-6 border-t border-white/10">
        <motion.button
          type="button"
          onClick={onSwitchToPhoneLogin}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="text-purple-300 hover:text-purple-200 font-medium flex items-center gap-2 transition-colors duration-300"
        >
          <RiArrowLeftLine />
          手机号登录
        </motion.button>
        <motion.button
          type="button"
          onClick={onSwitchToRegister}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="text-purple-300 hover:text-purple-200 font-medium transition-colors duration-300"
        >
          注册新账户
        </motion.button>
      </div>
    </form>
  );
}