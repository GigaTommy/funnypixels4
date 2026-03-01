import { useState, useEffect } from 'react';

// 手机号格式化工具函数
export const formatPhoneNumber = (value: string): string => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 7) return `${numbers.slice(0, 3)} ${numbers.slice(3)}`;
  return `${numbers.slice(0, 3)} ${numbers.slice(3, 7)} ${numbers.slice(7, 11)}`;
};

// 验证手机号格式
export const validatePhoneNumber = (phone: string): boolean => {
  const numbers = phone.replace(/\D/g, '');
  return numbers.length === 11 && /^1[3-9]\d{9}$/.test(numbers);
};

// 发送验证码倒计时Hook

export const useCountdown = (initialCount: number = 60) => {
  const [countdown, setCountdown] = useState(0);
  const [isCounting, setIsCounting] = useState(false);

  const startCountdown = () => {
    setCountdown(initialCount);
    setIsCounting(true);
  };

  useEffect(() => {
    if (isCounting && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      setIsCounting(false);
    }
  }, [isCounting, countdown]);

  return { countdown, isCounting, startCountdown };
};
