/**
 * 设备自适应容器组件
 * 根据设备类型自动调整布局和样式
 */

import React from 'react';
import { useDeviceAdaptation, useDeviceStyles, useDeviceLayout } from '../../hooks/useDeviceAdaptation';

interface DeviceAdaptiveContainerProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  
  // 布局选项
  layout?: 'flex' | 'grid' | 'block';
  direction?: 'row' | 'column';
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around';
  
  // 间距选项
  padding?: 'none' | 'small' | 'medium' | 'large';
  margin?: 'none' | 'small' | 'medium' | 'large';
  gap?: 'none' | 'small' | 'medium' | 'large';
  
  // 响应式选项
  hideOnMobile?: boolean;
  hideOnTablet?: boolean;
  hideOnDesktop?: boolean;
  showOnlyOnMobile?: boolean;
  showOnlyOnTablet?: boolean;
  showOnlyOnDesktop?: boolean;
  
  // 其他选项
  fullHeight?: boolean;
  fullWidth?: boolean;
  scrollable?: boolean;
}

export const DeviceAdaptiveContainer: React.FC<DeviceAdaptiveContainerProps> = ({
  children,
  className = '',
  style = {},
  layout = 'block',
  direction = 'column',
  align = 'stretch',
  justify = 'start',
  padding = 'medium',
  margin = 'none',
  gap = 'none',
  hideOnMobile = false,
  hideOnTablet = false,
  hideOnDesktop = false,
  showOnlyOnMobile = false,
  showOnlyOnTablet = false,
  showOnlyOnDesktop = false,
  fullHeight = false,
  fullWidth = false,
  scrollable = false
}) => {
  const { isMobile, isTablet, isDesktop } = useDeviceAdaptation();
  const deviceStyles = useDeviceStyles();
  const deviceLayout = useDeviceLayout();

  // 检查是否应该显示
  const shouldShow = () => {
    if (hideOnMobile && isMobile) return false;
    if (hideOnTablet && isTablet) return false;
    if (hideOnDesktop && isDesktop) return false;
    if (showOnlyOnMobile && !isMobile) return false;
    if (showOnlyOnTablet && !isTablet) return false;
    if (showOnlyOnDesktop && !isDesktop) return false;
    return true;
  };

  if (!shouldShow()) {
    return null;
  }

  // 计算样式
  const getSpacingValue = (spacing: string) => {
    switch (spacing) {
      case 'none': return '0';
      case 'small': return `${deviceStyles.spacing.sm}px`;
      case 'medium': return `${deviceStyles.spacing.md}px`;
      case 'large': return `${deviceStyles.spacing.lg}px`;
      default: return `${deviceStyles.spacing.md}px`;
    }
  };

  const getFlexDirection = () => {
    if (layout !== 'flex') return 'column';
    return direction;
  };

  const getAlignItems = () => {
    switch (align) {
      case 'start': return 'flex-start';
      case 'center': return 'center';
      case 'end': return 'flex-end';
      case 'stretch': return 'stretch';
      default: return 'stretch';
    }
  };

  const getJustifyContent = () => {
    switch (justify) {
      case 'start': return 'flex-start';
      case 'center': return 'center';
      case 'end': return 'flex-end';
      case 'between': return 'space-between';
      case 'around': return 'space-around';
      default: return 'flex-start';
    }
  };

  const containerStyle: React.CSSProperties = {
    ...style,
    padding: getSpacingValue(padding),
    margin: getSpacingValue(margin),
    gap: getSpacingValue(gap),
    width: fullWidth ? '100%' : style.width,
    height: fullHeight ? '100%' : style.height,
    overflow: scrollable ? 'auto' : style.overflow,
    display: layout === 'flex' ? 'flex' : layout === 'grid' ? 'grid' : 'block',
    flexDirection: layout === 'flex' ? getFlexDirection() : undefined,
    alignItems: layout === 'flex' ? getAlignItems() : undefined,
    justifyContent: layout === 'flex' ? getJustifyContent() : undefined,
    gridTemplateColumns: layout === 'grid' ? `repeat(${deviceLayout.grid.columns}, 1fr)` : undefined,
    gridGap: layout === 'grid' ? getSpacingValue(gap) : undefined
  };

  return (
    <div 
      className={`device-adaptive-container ${className}`}
      style={containerStyle}
    >
      {children}
    </div>
  );
};

/**
 * 设备自适应按钮组件
 */
interface DeviceAdaptiveButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export const DeviceAdaptiveButton: React.FC<DeviceAdaptiveButtonProps> = ({
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  icon,
  children,
  className = '',
  style = {},
  ...props
}) => {
  const { isMobile } = useDeviceAdaptation();
  const deviceStyles = useDeviceStyles();

  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none'
        };
      case 'secondary':
        return {
          backgroundColor: '#6c757d',
          color: 'white',
          border: 'none'
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          color: '#007bff',
          border: '1px solid #007bff'
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          color: '#007bff',
          border: 'none'
        };
      default:
        return {
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none'
        };
    }
  };

  const getSizeStyles = () => {
    const baseSize = deviceStyles.button.minHeight;
    switch (size) {
      case 'small':
        return {
          minHeight: baseSize * 0.8,
          fontSize: deviceStyles.text.small.fontSize,
          padding: `${deviceStyles.spacing.xs}px ${deviceStyles.spacing.sm}px`
        };
      case 'large':
        return {
          minHeight: baseSize * 1.2,
          fontSize: deviceStyles.text.large.fontSize,
          padding: `${deviceStyles.spacing.md}px ${deviceStyles.spacing.lg}px`
        };
      default:
        return {
          minHeight: baseSize,
          fontSize: deviceStyles.text.normal.fontSize,
          padding: `${deviceStyles.spacing.sm}px ${deviceStyles.spacing.md}px`
        };
    }
  };

  const buttonStyle: React.CSSProperties = {
    ...deviceStyles.button,
    ...getVariantStyles(),
    ...getSizeStyles(),
    ...style,
    width: fullWidth ? '100%' : style.width,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: icon ? `${deviceStyles.spacing.xs}px` : '0',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    ...(isMobile && {
      minHeight: Math.max(deviceStyles.button.minHeight, 44) // 移动端最小触摸目标
    })
  };

  return (
    <button
      className={`device-adaptive-button ${className}`}
      style={buttonStyle}
      {...props}
    >
      {icon && <span className="button-icon">{icon}</span>}
      <span className="button-text">{children}</span>
    </button>
  );
};

/**
 * 设备自适应文本组件
 */
interface DeviceAdaptiveTextProps {
  children: React.ReactNode;
  variant?: 'small' | 'normal' | 'large' | 'title';
  color?: string;
  weight?: 'normal' | 'bold';
  align?: 'left' | 'center' | 'right';
  className?: string;
  style?: React.CSSProperties;
}

export const DeviceAdaptiveText: React.FC<DeviceAdaptiveTextProps> = ({
  children,
  variant = 'normal',
  color,
  weight = 'normal',
  align = 'left',
  className = '',
  style = {}
}) => {
  const deviceStyles = useDeviceStyles();

  const textStyle: React.CSSProperties = {
    ...deviceStyles.text[variant],
    color: color || style.color,
    fontWeight: weight,
    textAlign: align,
    ...style
  };

  return (
    <span 
      className={`device-adaptive-text ${className}`}
      style={textStyle}
    >
      {children}
    </span>
  );
};
