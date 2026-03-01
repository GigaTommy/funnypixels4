import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { logger } from '../utils/logger';
import { AuthService } from '../services/auth';
import {
  RiGameLine,
  RiSparklingLine,
  RiSmartphoneLine,
  RiMailLine,
  RiCloseLine,
  RiArrowRightLine,
  RiLoader4Line,
  RiShieldCheckLine,
  RiWechatLine,
  RiGithubLine,
  RiWeiboLine,
  RiEyeLine,
  RiEyeOffLine,
  RiCheckLine,
  RiErrorWarningLine,
  RiSendPlaneLine,
  RiGlobalLine,
  RiUserLine,
  RiArrowLeftLine,
  RiRefreshLine
} from 'react-icons/ri';
import EmailLoginForm from '../components/auth/EmailLoginForm';
import PhoneLoginFormEnhanced from '../components/auth/PhoneLoginFormEnhanced';
import SlideCaptcha from '../components/auth/SlideCaptcha';

interface AuthPageEnhancedProps {
  onAuthSuccess: () => void;
}

export default function AuthPageEnhanced({ onAuthSuccess }: AuthPageEnhancedProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [loginType, setLoginType] = useState<'phone' | 'email'>('phone');
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [currentStep, setCurrentStep] = useState<'auth' | 'captcha'>('auth');

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
        logger.warn('❌ 认证检查失败，需要重新登录');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [onAuthSuccess]);

  const handleAuthSuccess = () => {
    logger.info('🎉 认证成功');
    if (Math.random() > 0.3) { // 70%概率需要验证码
      setCurrentStep('captcha');
      setShowCaptcha(true);
    } else {
      onAuthSuccess();
    }
  };

  const handleCaptchaSuccess = () => {
    logger.info('🔐 验证码验证成功');
    setShowCaptcha(false);
    onAuthSuccess();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
        <div className="relative">
          {/* 背景装饰 */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-64 h-64 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative text-center"
          >
            <div className="flex items-center justify-center gap-3 text-white/80 text-xl font-medium">
              <RiLoader4Line className="animate-spin text-2xl" />
              加载中...
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 relative overflow-hidden">
      {/* 动态背景 */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-yellow-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>

        {/* 网格背景 */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='grid' width='60' height='60' patternUnits='userSpaceOnUse'%3E%3Cpath d='M 60 0 L 0 0 0 60' fill='none' stroke='white' stroke-width='0.5' opacity='0.1'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23grid)' /%3E%3C/svg%3E")`
          }}
        ></div>
      </div>

      {/* 主要内容 */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-6xl flex items-center justify-center">
          <div className="relative">
            {/* 玻璃态卡片 */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="relative bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden"
              style={{ width: '480px' }}
            >
              {/* 卡片背景装饰 */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent"></div>

              {/* 关闭按钮 */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => window.history.back()}
                className="absolute top-6 right-6 z-20 w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-all duration-300"
              >
                <RiCloseLine className="text-xl" />
              </motion.button>

              <AnimatePresence mode="wait">
                {currentStep === 'auth' ? (
                  <motion.div
                    key="auth"
                    initial={{ opacity: 0, x: 0 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="relative p-12"
                  >
                    {/* Logo区域 */}
                    <motion.div
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="text-center mb-10"
                    >
                      <div className="relative inline-flex items-center justify-center w-20 h-20 mb-6">
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl blur-xl opacity-50 animate-pulse"></div>
                        <div className="relative bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl shadow-2xl flex items-center justify-center">
                          <RiGameLine className="text-white text-3xl" />
                        </div>
                      </div>

                      <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">
                        FunnyPixels
                      </h1>
                      <p className="text-white/70 text-lg font-light">
                        用脚步绘制世界，用色彩连接你我
                      </p>

                      <div className="mt-6 inline-flex items-center px-4 py-2 bg-gradient-to-r from-yellow-400/20 to-orange-400/20 backdrop-blur-md rounded-full border border-yellow-400/30">
                        <RiSparklingLine className="text-yellow-400 mr-2" />
                        <span className="text-yellow-300 text-sm font-medium">
                          新用户专享 1000 像素币
                        </span>
                      </div>
                    </motion.div>

                    {/* 登录/注册切换 */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="mb-8"
                    >
                      <div className="bg-white/5 backdrop-blur-md rounded-2xl p-1.5 border border-white/10">
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => setIsLogin(true)}
                            className={`py-3 px-6 rounded-xl font-semibold transition-all duration-300 ${
                              isLogin
                                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/25'
                                : 'text-white/60 hover:text-white hover:bg-white/5'
                            }`}
                          >
                            登录
                          </button>
                          <button
                            onClick={() => setIsLogin(false)}
                            className={`py-3 px-6 rounded-xl font-semibold transition-all duration-300 ${
                              !isLogin
                                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/25'
                                : 'text-white/60 hover:text-white hover:bg-white/5'
                            }`}
                          >
                            注册
                          </button>
                        </div>
                      </div>
                    </motion.div>

                    {/* 登录方式选择 */}
                    <AnimatePresence mode="wait">
                      {isLogin ? (
                        <motion.div
                          key="login"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className="space-y-6"
                        >
                          {/* 登录类型切换 */}
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="bg-white/5 backdrop-blur-md rounded-2xl p-1.5 border border-white/10"
                          >
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => setLoginType('phone')}
                                className={`py-3 px-4 rounded-xl font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
                                  loginType === 'phone'
                                    ? 'bg-white/20 text-white shadow-lg'
                                    : 'text-white/60 hover:text-white hover:bg-white/10'
                                }`}
                              >
                                <RiSmartphoneLine />
                                手机号登录
                              </button>
                              <button
                                onClick={() => setLoginType('email')}
                                className={`py-3 px-4 rounded-xl font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
                                  loginType === 'email'
                                    ? 'bg-white/20 text-white shadow-lg'
                                    : 'text-white/60 hover:text-white hover:bg-white/10'
                                }`}
                              >
                                <RiMailLine />
                                邮箱登录
                              </button>
                            </div>
                          </motion.div>

                          {/* 登录表单 */}
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="bg-white/5 backdrop-blur-md rounded-2xl p-8 border border-white/10"
                          >
                            {loginType === 'phone' ? (
                              <PhoneLoginFormEnhanced
                                onLoginSuccess={handleAuthSuccess}
                                onSwitchToEmailLogin={() => setLoginType('email')}
                                onSwitchToRegister={() => setIsLogin(false)}
                              />
                            ) : (
                              <EmailLoginForm
                                onLoginSuccess={handleAuthSuccess}
                                onSwitchToPhoneLogin={() => setLoginType('phone')}
                                onSwitchToRegister={() => setIsLogin(false)}
                              />
                            )}
                          </motion.div>

                          {/* 第三方登录 */}
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                            className="bg-white/5 backdrop-blur-md rounded-2xl p-8 border border-white/10"
                          >
                            <div className="text-center">
                              <div className="relative mb-8">
                                <div className="absolute inset-0 flex items-center">
                                  <div className="w-full border-t border-white/20"></div>
                                </div>
                                <div className="relative flex justify-center text-sm">
                                  <span className="px-4 bg-transparent text-white/60">其他登录方式</span>
                                </div>
                              </div>

                              <div className="grid grid-cols-3 gap-4">
                                <motion.button
                                  whileHover={{ scale: 1.05, y: -2 }}
                                  whileTap={{ scale: 0.95 }}
                                  className="p-4 bg-white/10 backdrop-blur-md rounded-2xl hover:bg-white/20 transition-all duration-300 flex flex-col items-center gap-2 group border border-white/10"
                                >
                                  <RiWechatLine className="text-green-400 text-2xl group-hover:scale-110 transition-transform" />
                                  <span className="text-white/80 text-sm">微信</span>
                                </motion.button>
                                <motion.button
                                  whileHover={{ scale: 1.05, y: -2 }}
                                  whileTap={{ scale: 0.95 }}
                                  className="p-4 bg-white/10 backdrop-blur-md rounded-2xl hover:bg-white/20 transition-all duration-300 flex flex-col items-center gap-2 group border border-white/10"
                                >
                                  <RiGithubLine className="text-white/80 text-2xl group-hover:scale-110 transition-transform" />
                                  <span className="text-white/80 text-sm">GitHub</span>
                                </motion.button>
                                <motion.button
                                  whileHover={{ scale: 1.05, y: -2 }}
                                  whileTap={{ scale: 0.95 }}
                                  className="p-4 bg-white/10 backdrop-blur-md rounded-2xl hover:bg-white/20 transition-all duration-300 flex flex-col items-center gap-2 group border border-white/10"
                                >
                                  <RiWeiboLine className="text-red-400 text-2xl group-hover:scale-110 transition-transform" />
                                  <span className="text-white/80 text-sm">微博</span>
                                </motion.button>
                              </div>
                            </div>
                          </motion.div>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="register"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className="text-center py-12"
                        >
                          <div className="text-white/60">
                            <RiLoader4Line className="animate-spin text-4xl mx-auto mb-4" />
                            <p className="text-lg">注册功能开发中...</p>
                            <p className="text-sm mt-2">敬请期待更多精彩内容</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* 底部安全提示 */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.6 }}
                      className="mt-8 text-center"
                    >
                      <div className="flex items-center justify-center gap-2 text-white/50 text-sm">
                        <RiShieldCheckLine />
                        <span>安全登录，数据加密保护</span>
                      </div>
                    </motion.div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="captcha"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="p-12"
                  >
                    <div className="text-center mb-8">
                      <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl mb-4 shadow-2xl">
                        <RiShieldCheckLine className="text-white text-2xl" />
                      </div>
                      <h2 className="text-2xl font-bold text-white mb-2">安全验证</h2>
                      <p className="text-white/70">完成滑动验证以确保账户安全</p>
                    </div>

                    <SlideCaptcha
                      onVerify={(success, token) => {
                        if (success) {
                          handleCaptchaSuccess();
                        }
                      }}
                    />

                    <div className="mt-6 text-center">
                      <button
                        onClick={() => setCurrentStep('auth')}
                        className="text-white/60 hover:text-white transition-colors duration-300 flex items-center gap-2 mx-auto"
                      >
                        <RiArrowLeftLine />
                        返回登录
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* 浮动装饰元素 */}
            <motion.div
              animate={{
                y: [0, -20, 0],
                rotate: [0, 180, 360],
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="absolute -top-10 -left-10 w-20 h-20 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full backdrop-blur-xl border border-white/10"
            />
            <motion.div
              animate={{
                y: [0, 20, 0],
                rotate: [0, -180, -360],
              }}
              transition={{
                duration: 10,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 2
              }}
              className="absolute -bottom-10 -right-10 w-24 h-24 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full backdrop-blur-xl border border-white/10"
            />
          </div>
        </div>
      </div>

      {/* 自定义样式 */}
      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}