import React from 'react';

interface TextareaProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
  disabled?: boolean;
  maxLength?: number;
}

export const Textarea: React.FC<TextareaProps> = ({
  value = '',
  onChange,
  placeholder,
  className = '',
  rows = 4,
  disabled = false,
  maxLength
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (onChange) {
      onChange(e.target.value);
    }
  };

  return (
    <textarea
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "思源黑体", "Noto Sans CJK SC", "Noto Sans SC", Roboto, sans-serif'
      }}
      className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${className}`}
      rows={rows}
      disabled={disabled}
      maxLength={maxLength}
    />
  );
};
