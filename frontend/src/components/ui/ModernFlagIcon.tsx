import React from 'react';
import { normalizeCountryCode } from '../../utils/countryCodeMapping';

interface ModernFlagIconProps {
  country?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  style?: React.CSSProperties;
}

// 尺寸配置
const SIZE_CONFIG = {
  xs: { width: 16, height: 12 },
  sm: { width: 20, height: 15 },
  md: { width: 24, height: 18 },
  lg: { width: 32, height: 24 }
};

/**
 * 现代化国旗图标组件
 * 使用 flag-icons CSS 库的SVG图标
 * 支持中文国家名和ISO国家代码
 */
export const ModernFlagIcon: React.FC<ModernFlagIconProps> = ({
  country,
  size = 'sm',
  className = '',
  style = {}
}) => {
  const countryCode = normalizeCountryCode(country);
  const config = SIZE_CONFIG[size];

  // 构建CSS类名
  const flagClassName = `fi fi-${countryCode.toLowerCase()}`;

  const containerStyle: React.CSSProperties = {
    width: `${config.width}px`,
    height: `${config.height}px`,
    borderRadius: '2px',
    overflow: 'hidden',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    border: '1px solid #e5e7eb',
    ...style
  };

  return (
    <div
      className={`${className} modern-flag-icon`}
      style={containerStyle}
      title={`${country || 'Unknown'} (${countryCode})`}
    >
      <span
        className={flagClassName}
        style={{
          width: `${config.width - 2}px`,
          height: `${config.height - 2}px`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      />
    </div>
  );
};

export default ModernFlagIcon;