import React from 'react';
import { LucideIcon } from 'lucide-react';

interface InputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'datetime-local';
  icon?: LucideIcon;
  error?: string;
  disabled?: boolean;
  className?: string;
  fullWidth?: boolean;
  style?: React.CSSProperties;
  maxLength?: number;
  readOnly?: boolean;
}

export const Input: React.FC<InputProps> = ({
  value,
  onChange,
  placeholder,
  type = 'text',
  icon: Icon,
  error,
  disabled = false,
  className = '',
  fullWidth = false,
  style = {},
  maxLength,
  readOnly = false
}) => {
  return (
    <div className={`relative ${fullWidth ? 'w-full' : ''}`}>
      {Icon && (
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
          <Icon className="w-4 h-4" />
        </div>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        maxLength={maxLength}
        style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "思源黑体", "Noto Sans CJK SC", "Noto Sans SC", Roboto, sans-serif',
          ...style
        }}
        className={`
          px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl
          focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500
          transition-all duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
          ${Icon ? 'pl-10' : ''}
          ${error ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500' : ''}
          ${className}
        `}
      />
      {error && (
        <p className="mt-1 text-sm text-red-500">{error}</p>
      )}
    </div>
  );
};
