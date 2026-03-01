import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RiRefreshLine,
  RiLoader4Line,
  RiCheckLine,
  RiErrorWarningLine,
  RiArrowRightLine,
  RiShieldCheckLine
} from 'react-icons/ri';

interface SlideCaptchaProps {
  onVerify: (success: boolean, token?: string) => void;
  phoneNumber?: string;
  disabled?: boolean;
}

export default function SlideCaptcha({ onVerify, phoneNumber, disabled = false }: SlideCaptchaProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sliderPosition, setSliderPosition] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [puzzlePosition, setPuzzlePosition] = useState(0);
  const [captchaToken, setCaptchaToken] = useState<string>('');
  const sliderRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 生成拼图位置
  const generatePuzzlePosition = () => {
    const position = Math.floor(Math.random() * 40) + 30;
    setPuzzlePosition(position);
    return position;
  };

  // 初始化验证码
  useEffect(() => {
    if (!disabled) {
      generatePuzzlePosition();
      setCaptchaToken(Date.now().toString());
    }
  }, [disabled]);

  // 处理滑块拖动
  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled || isVerified) return;

    setIsDragging(true);
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !containerRef.current || disabled) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const maxPosition = containerRect.width - 60;

    let newPosition = e.clientX - containerRect.left - 30;

    newPosition = Math.max(0, Math.min(newPosition, maxPosition));
    setSliderPosition(newPosition);

    const targetPosition = (puzzlePosition / 100) * maxPosition;
    if (Math.abs(newPosition - targetPosition) < 10) {
      handleVerify();
    }
  };

  const handleMouseUp = () => {
    if (!isDragging) return;

    setIsDragging(false);

    if (!isVerified) {
      setTimeout(() => {
        setSliderPosition(0);
      }, 300);
    }
  };

  // 鼠标事件监听
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isVerified, disabled]);

  // 触摸事件处理
  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled || isVerified) return;

    setIsDragging(true);
    e.preventDefault();
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !containerRef.current || disabled) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const maxPosition = containerRect.width - 60;

    const touch = e.touches[0];
    let newPosition = touch.clientX - containerRect.left - 30;

    newPosition = Math.max(0, Math.min(newPosition, maxPosition));
    setSliderPosition(newPosition);

    const targetPosition = (puzzlePosition / 100) * maxPosition;
    if (Math.abs(newPosition - targetPosition) < 10) {
      handleVerify();
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;

    setIsDragging(false);

    if (!isVerified) {
      setTimeout(() => {
        setSliderPosition(0);
      }, 300);
    }
  };

  // 处理验证
  const handleVerify = async () => {
    setIsVerifying(true);
    setError(null);

    try {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const success = Math.random() > 0.1;

      if (success) {
        setIsVerified(true);
        setSliderPosition(100);
        setCaptchaToken(Date.now().toString());
        onVerify(true, captchaToken);
      } else {
        setError('验证失败，请重试');
        setTimeout(() => {
          setSliderPosition(0);
          generatePuzzlePosition();
        }, 1000);
      }
    } catch (error) {
      setError('验证异常，请重试');
      setTimeout(() => {
        setSliderPosition(0);
      }, 1000);
    } finally {
      setIsVerifying(false);
    }
  };

  // 重置验证码
  const handleReset = () => {
    setIsVerified(false);
    setSliderPosition(0);
    setError(null);
    generatePuzzlePosition();
    setCaptchaToken(Date.now().toString());
  };

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white/80 text-sm">
          <RiShieldCheckLine />
          滑动验证
        </div>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleReset}
          disabled={disabled || isVerifying}
          className="p-2 text-white/60 hover:text-white/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 rounded-xl hover:bg-white/10"
        >
          <RiRefreshLine />
        </motion.button>
      </div>

      {/* 验证区域 */}
      <div
        ref={containerRef}
        className="relative h-14 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-2xl overflow-hidden border border-white/10"
      >
        {/* 背景装饰 */}
        <div className="absolute inset-0 bg-white/5"></div>

        {/* 背景文字 */}
        <div className="absolute inset-0 flex items-center justify-center text-white/60 select-none z-10">
          {isVerified ? (
            <span className="text-green-400 flex items-center gap-2 font-medium">
              <RiCheckLine />
              验证成功
            </span>
          ) : (
            <span className="text-sm">
              向右滑动到 {puzzlePosition}%
            </span>
          )}
        </div>

        {/* 拼图缺口 */}
        <AnimatePresence mode="wait">
          {!isVerified && (
            <motion.div
              initial={{ x: 0 }}
              animate={{ x: sliderPosition }}
              className="absolute top-1/2 transform -translate-y-1/2 w-12 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl shadow-lg z-20"
              style={{
                left: `${puzzlePosition}%`,
                transform: 'translate(-50%, -50%)'
              }}
            />
          )}
        </AnimatePresence>

        {/* 滑块 */}
        <motion.div
          ref={sliderRef}
          initial={{ x: 0 }}
          animate={{ x: sliderPosition }}
          whileHover={{ scale: isDragging ? 1 : 1.05 }}
          whileTap={{ scale: 0.95 }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={`absolute top-1/2 transform -translate-y-1/2 w-16 h-10 rounded-full cursor-pointer flex items-center justify-center transition-all duration-200 z-30 ${
            isDragging ? 'shadow-2xl scale-110' : 'shadow-lg'
          } ${
            isVerified
              ? 'bg-gradient-to-r from-green-500 to-emerald-500'
              : 'bg-gradient-to-r from-purple-500 to-pink-500'
          }`}
          style={{
            left: `${Math.min(sliderPosition, 100)}%`
          }}
        >
          {isVerifying ? (
            <RiLoader4Line className="animate-spin text-white" />
          ) : isVerified ? (
            <RiCheckLine className="text-white text-lg" />
          ) : (
            <RiArrowRightLine className="text-white" />
          )}
        </motion.div>

        {/* 进度条 */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
          <motion.div
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
            initial={{ width: 0 }}
            animate={{ width: `${sliderPosition}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>
      </div>

      {/* 错误提示 */}
      <AnimatePresence mode="wait">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-4 p-3 bg-red-500/20 backdrop-blur-md border border-red-500/30 rounded-xl flex items-center gap-2 text-red-300"
          >
            <RiErrorWarningLine />
            <span className="text-sm">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 提示信息 */}
      <div className="mt-4 text-xs text-white/50 text-center">
        {phoneNumber && `验证码将发送至 ${phoneNumber}`}
      </div>
    </div>
  );
}