import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { logger } from '../../utils/logger';
import {
  RiSmartphoneLine,
  RiMailLine,
  RiLoader4Line,
  RiCheckLine,
  RiErrorWarningLine,
  RiSendPlaneLine,
  RiShieldCheckLine,
  RiArrowLeftLine,
  RiArrowRightLine,
  RiGlobalLine,
  RiUserLine
} from 'react-icons/ri';
import { PhoneInput } from './PhoneInput';
import { VerificationCodeInput } from './VerificationCodeInput';
import { AuthService } from '../../services/auth';
import LoginMessage from './LoginMessage';
import DocumentViewer from '../DocumentViewer';

interface PhoneLoginFormEnhancedProps {
  onLoginSuccess: () => void;
  onSwitchToEmailLogin: () => void;
  onSwitchToRegister: () => void;
}

export default function PhoneLoginFormEnhanced({ onLoginSuccess, onSwitchToEmailLogin, onSwitchToRegister }: PhoneLoginFormEnhancedProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [currentStep, setCurrentStep] = useState<'phone' | 'code'>('phone');
  const [countryCode, setCountryCode] = useState('+86');

  // 验证手机号格式
  const validatePhoneNumber = (phone: string) => {
    const phoneRegex = /^1[3-9]\d{9}$/;
    return phoneRegex.test(phone.replace(/\D/g, ''));
  };

  // 发送验证码
  const handleSendCode = useCallback(async () => {
    if (!validatePhoneNumber(phoneNumber)) {
      setError('请输入正确的手机号码');
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
          phone: `${countryCode}${phoneNumber}`,
          type: 'login'
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('验证码已发送到您的手机');
        setCurrentStep('code');
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
  }, [phoneNumber, countryCode]);

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

    if (!validatePhoneNumber(phoneNumber)) {
      setError('请输入正确的手机号码');
      return;
    }

    if (!verificationCode || verificationCode.length !== 6) {
      setError('请输入6位验证码');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: `${countryCode}${phoneNumber}`,
          verificationCode
        })
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

  // 重置状态
  const handleReset = () => {
    setCurrentStep('phone');
    setVerificationCode('');
    setError(null);
    setSuccess(null);
  };

  // 国家代码列表
  const countryCodes = [
    { code: '+86', country: '中国', flag: '🇨🇳' },
    { code: '+1', country: '美国', flag: '🇺🇸' },
    { code: '+44', country: '英国', flag: '🇬🇧' },
    { code: '+81', country: '日本', flag: '🇯🇵' },
    { code: '+82', country: '韩国', flag: '🇰🇷' },
    { code: '+65', country: '新加坡', flag: '🇸🇬' },
    { code: '+852', country: '香港', flag: '🇭🇰' },
    { code: '+886', country: '台湾', flag: '🇹🇼' },
  ];

  return (
    <div className="space-y-6">
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

      {/* 步骤指示器 */}
      <div className="flex items-center justify-center space-x-3 py-6">
        <div className={`flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300 ${
          currentStep === 'phone'
            ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/25'
            : 'bg-green-500/20 text-green-400 border border-green-500/30'
        }`}>
          <span className="text-sm font-bold">1</span>
        </div>
        <div className={`h-0.5 w-20 transition-all duration-300 ${
          currentStep === 'code'
            ? 'bg-gradient-to-r from-purple-500 to-pink-500'
            : 'bg-white/20'
        }`}></div>
        <div className={`flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300 ${
          currentStep === 'code'
            ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/25'
            : 'bg-white/10 text-white/60 border border-white/20'
        }`}>
          <span className="text-sm font-bold">2</span>
        </div>
      </div>

      <form onSubmit={handleLogin} className="space-y-6">
        {/* 国家代码选择 */}
        <div>
          <label className="block text-sm font-medium text-white/80 mb-3">
            <RiGlobalLine className="inline mr-2" />
            选择国家/地区
          </label>
          <div className="relative">
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="w-full px-4 py-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-300 appearance-none text-white/90 placeholder-white/40"
            >
              {countryCodes.map((country) => (
                <option key={country.code} value={country.code} className="bg-gray-800 text-white">
                  {country.flag} {country.country} {country.code}
                </option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none text-white/60">
              <RiArrowRightLine />
            </div>
          </div>
        </div>

        {/* 手机号输入 */}
        {currentStep === 'phone' && (
          <div>
            <label className="block text-sm font-medium text-white/80 mb-3">
              <RiSmartphoneLine className="inline mr-2" />
              手机号码
            </label>
            <div className="relative">
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                placeholder="请输入11位手机号"
                maxLength={11}
                className="w-full px-4 py-4 pl-16 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-300 text-white/90 placeholder-white/40"
                required
              />
              <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white/60 font-medium">
                {countryCode}
              </div>
              {validatePhoneNumber(phoneNumber) && (
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-green-400">
                  <RiCheckLine className="text-xl" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* 验证码输入 */}
        {currentStep === 'code' && (
          <div>
            <label className="block text-sm font-medium text-white/80 mb-3">
              <RiShieldCheckLine className="inline mr-2" />
              验证码
            </label>
            <div className="text-xs text-white/50 mb-3 px-1">
              已发送至：{countryCode} {phoneNumber}
            </div>
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
                disabled={isSendingCode || countdown > 0}
                whileHover={{ scale: isSendingCode || countdown > 0 ? 1 : 1.02 }}
                whileTap={{ scale: isSendingCode || countdown > 0 ? 1 : 0.98 }}
                className="px-6 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl hover:from-purple-600 hover:to-pink-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed transition-all duration-300 flex items-center gap-2 text-sm font-medium shadow-lg shadow-purple-500/25"
              >
                {isSendingCode ? (
                  <RiLoader4Line className="animate-spin" />
                ) : (
                  <RiSendPlaneLine />
                )}
                {countdown > 0 ? `${countdown}s` : '重发'}
              </motion.button>
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="space-y-4">
          {currentStep === 'phone' ? (
            <motion.button
              type="button"
              onClick={handleSendCode}
              disabled={!validatePhoneNumber(phoneNumber) || isSendingCode}
              whileHover={{ scale: validatePhoneNumber(phoneNumber) && !isSendingCode ? 1.02 : 1 }}
              whileTap={{ scale: validatePhoneNumber(phoneNumber) && !isSendingCode ? 0.98 : 1 }}
              className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl hover:from-purple-600 hover:to-pink-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed transition-all duration-300 font-semibold shadow-xl shadow-purple-500/25 flex items-center justify-center gap-3"
            >
              {isSendingCode ? (
                <>
                  <RiLoader4Line className="animate-spin" />
                  发送中...
                </>
              ) : (
                <>
                  发送验证码
                  <RiArrowRightLine />
                </>
              )}
            </motion.button>
          ) : (
            <>
              <motion.button
                type="submit"
                disabled={isLoading || !verificationCode || verificationCode.length !== 6}
                whileHover={{ scale: !isLoading && verificationCode && verificationCode.length === 6 ? 1.02 : 1 }}
                whileTap={{ scale: !isLoading && verificationCode && verificationCode.length === 6 ? 0.98 : 1 }}
                className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl hover:from-purple-600 hover:to-pink-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed transition-all duration-300 font-semibold shadow-xl shadow-purple-500/25 flex items-center justify-center gap-3"
              >
                {isLoading ? (
                  <>
                    <RiLoader4Line className="animate-spin" />
                    登录中...
                  </>
                ) : (
                  <>
                    验证并登录
                    <RiArrowRightLine />
                  </>
                )}
              </motion.button>

              <motion.button
                type="button"
                onClick={handleReset}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-4 bg-white/10 backdrop-blur-md text-white/80 rounded-2xl hover:bg-white/20 transition-all duration-300 font-medium flex items-center justify-center gap-3 border border-white/20"
              >
                <RiArrowLeftLine />
                重新输入手机号
              </motion.button>
            </>
          )}
        </div>
      </form>

      {/* 底部链接 */}
      <div className="flex justify-between items-center text-sm pt-6 border-t border-white/10">
        <motion.button
          type="button"
          onClick={onSwitchToEmailLogin}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="text-purple-300 hover:text-purple-200 font-medium flex items-center gap-2 transition-colors duration-300"
        >
          <RiMailLine />
          邮箱登录
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

      {/* 用户协议和隐私政策链接 */}
      <div className="text-center text-xs text-gray-400 mt-6">
        <span>点击"登录"即表示您同意</span>
        <div className="mt-1">
          <a
            href="/user-agreement.html"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-300 hover:text-purple-200 underline decoration-dotted underline-offset-2 px-1 py-0.5 text-xs"
          >
            《用户协议》
          </a>
          <span className="mx-1">和</span>
          <a
            href="/privacy-policy.html"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-300 hover:text-purple-200 underline decoration-dotted underline-offset-2 px-1 py-0.5 text-xs"
          >
            《隐私政策》
          </a>
        </div>
      </div>

      {/* 开发环境提示 */}
      {import.meta.env.DEV && (
        <div className="mt-6 p-4 bg-yellow-500/20 backdrop-blur-md border border-yellow-500/30 rounded-2xl">
          <div className="flex items-center gap-3 text-yellow-300 text-sm">
            <RiUserLine />
            <span>开发环境：测试手机号 13800138000</span>
          </div>
        </div>
      )}

    </div>
  );
}