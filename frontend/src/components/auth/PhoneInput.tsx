import React from 'react';
import { formatPhoneNumber } from '../../utils/phoneUtils';

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const PhoneInput: React.FC<PhoneInputProps> = ({
  value,
  onChange,
  placeholder = "请输入手机号",
  className = '',
  disabled = false
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    if (formatted.length <= 13) {
      onChange(formatted);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        position: 'absolute',
        top: '50%',
        transform: 'translateY(-50%)',
        left: '16px',
        display: 'flex',
        alignItems: 'center',
        color: '#6b7280'
      }}>
        <span style={{
          fontSize: '14px',
          fontWeight: '500'
        }}>+86</span>
        <div style={{
          width: '1px',
          height: '16px',
          backgroundColor: '#d1d5db',
          margin: '0 12px'
        }}></div>
      </div>
      <input
        type="tel"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          width: '80%',
          height: '48px',
          paddingLeft: '64px',
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
    </div>
  );
};
