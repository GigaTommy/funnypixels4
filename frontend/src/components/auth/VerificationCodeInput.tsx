import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { useCountdown } from '../../utils/phoneUtils';
import { validatePhoneNumber } from '../../utils/phoneUtils';

interface VerificationCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  phoneNumber: string;
  onSendCode?: () => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const VerificationCodeInput: React.FC<VerificationCodeInputProps> = ({
  value,
  onChange,
  phoneNumber,
  onSendCode,
  placeholder = "请输入验证码",
  className = '',
  disabled = false
}) => {
  const { countdown, isCounting, startCountdown } = useCountdown(60);
  const [isSmallScreen, setIsSmallScreen] = useState(false);

  // 检测屏幕尺寸
  useEffect(() => {
    const checkScreenSize = () => {
      setIsSmallScreen(window.innerWidth < 480);
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const handleSendCode = () => {
    if (!validatePhoneNumber(phoneNumber)) {
      return;
    }
    startCountdown();
    onSendCode?.();
  };

  const isPhoneValid = validatePhoneNumber(phoneNumber);
  const canSendCode = isPhoneValid && !isCounting && !disabled;

  return (
    <div style={{
      display: 'flex',
      gap: '8px',
      width: '100%',
      minWidth: 0 // 确保容器可以收缩
    }}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          flex: 1,
          minWidth: 0, // 允许输入框收缩
          height: '48px',
          paddingLeft: '16px',
          paddingRight: '16px',
          backgroundColor: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          fontSize: '16px',
          fontWeight: '400',
          outline: 'none',
          transition: 'all 0.2s',
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? 'not-allowed' : 'text'
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
        onClick={handleSendCode}
        disabled={!canSendCode}
        style={{
          height: '48px',
          paddingLeft: '12px',
          paddingRight: '12px',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
          backgroundColor: 'transparent',
          color: '#2563eb',
          fontSize: '14px',
          fontWeight: '500',
          whiteSpace: 'nowrap',
          opacity: !canSendCode ? 0.5 : 1,
          cursor: !canSendCode ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          minWidth: 'fit-content'
        }}
        onMouseEnter={(e) => {
          if (canSendCode) {
            e.currentTarget.style.backgroundColor = '#eff6ff';
            e.currentTarget.style.borderColor = '#3b82f6';
          }
        }}
        onMouseLeave={(e) => {
          if (canSendCode) {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.borderColor = '#e5e7eb';
          }
        }}
      >
        {isCounting ? `${countdown}s` : (isSmallScreen ? '发送' : '发送验证码')}
      </button>
    </div>
  );
};
