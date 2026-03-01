import React from 'react';
import { logger } from '../../utils/logger';

const commonProps = {
  shapeRendering: "crispEdges" as const,
};

// 像素艺术头像组件 - 用于渲染颜色数据
const PixelArtAvatar: React.FC<{
  colorData: string;
  size: number;
  alt?: string;
}> = ({ colorData, size, alt }) => {
  // 解析颜色数据
  const colors = colorData.split(',');
  const gridSize = Math.ceil(Math.sqrt(colors.length));
  
  // 计算像素尺寸，确保能完整填充容器
  const pixelSize = size / gridSize;
  
  // 计算居中偏移量（现在应该接近0）
  const totalPixelSize = gridSize * pixelSize;
  const offsetX = (size - totalPixelSize) / 2;
  const offsetY = (size - totalPixelSize) / 2;
  
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox={`0 0 ${size} ${size}`} 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      {...commonProps}
    >
      {colors.map((color, index) => {
        const x = (index % gridSize) * pixelSize + offsetX;
        const y = Math.floor(index / gridSize) * pixelSize + offsetY;
        
        return (
          <rect
            key={index}
            x={x}
            y={y}
            width={pixelSize}
            height={pixelSize}
            fill={color.trim()}
          />
        );
      })}
    </svg>
  );
};

export const PixelTargetIcon: React.FC = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" {...commonProps}>
    <rect x="7" y="1" width="8" height="2" fill="#d14b4b"/>
    <rect x="7" y="19" width="8" height="2" fill="#d14b4b"/>
    <rect x="1" y="7" width="2" height="8" fill="#d14b4b"/>
    <rect x="19" y="7" width="2" height="8" fill="#d14b4b"/>
    <rect x="4" y="2" width="3" height="2" fill="#d14b4b"/>
    <rect x="15" y="2" width="3" height="2" fill="#d14b4b"/>
    <rect x="4" y="18" width="3" height="2" fill="#d14b4b"/>
    <rect x="15" y="18" width="3" height="2" fill="#d14b4b"/>
    <rect x="2" y="4" width="2" height="3" fill="#d14b4b"/>
    <rect x="18" y="4" width="2" height="3" fill="#d14b4b"/>
    <rect x="2" y="15" width="2" height="3" fill="#d14b4b"/>
    <rect x="18" y="15" width="2" height="3" fill="#d14b4b"/>
    <rect x="9" y="4" width="4" height="2" fill="white"/>
    <rect x="9" y="16" width="4" height="2" fill="white"/>
    <rect x="4" y="9" width="2" height="4" fill="white"/>
    <rect x="16" y="9" width="2" height="4" fill="white"/>
    <rect x="7" y="5" width="2" height="2" fill="white"/>
    <rect x="13" y="5" width="2" height="2" fill="white"/>
    <rect x="7" y="15" width="2" height="2" fill="white"/>
    <rect x="13" y="15" width="2" height="2" fill="white"/>
    <rect x="9" y="9" width="4" height="4" fill="#d14b4b"/>
  </svg>
);

export const PixelCloseIcon: React.FC = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" {...commonProps}>
    <path d="M8 0H20L28 8V20L20 28H8L0 20V8L8 0Z" fill="#4a4a4a"/>
    <path d="M9 7L11 9L12 11V12L11 13L9 15L7 17L8 18L10 16L12 14H13H14L16 16L18 18L19 17L17 15L15 13L14 12V11L15 10L17 8L19 6L18 5L16 7L14 9H13H12L10 7L8 5L7 6L9 7Z" fill="white"/>
  </svg>
);

export const PixelReportFlagIcon: React.FC = () => (
  <svg width="22" height="24" viewBox="0 0 22 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...commonProps}>
    <path d="M4 24H6V0H4V24Z" fill="#4a4a4a"/>
    <path d="M6 0H18V4H8V7H20V11H8V14H18V18H6V0Z" fill="#4a4a4a"/>
  </svg>
);

export const PixelHeartIcon: React.FC = () => (
  <svg width="20" height="18" viewBox="0 0 20 18" fill="none" xmlns="http://www.w3.org/2000/svg" {...commonProps}>
    <path d="M10 0C8 0 6 1 5 2C4 3 3 4 3 6C3 8 4 10 6 12C8 14 10 16 10 16C10 16 12 14 14 12C16 10 17 8 17 6C17 4 16 3 15 2C14 1 12 0 10 0Z" fill="#d14b4b"/>
  </svg>
);

export const PixelShareIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...commonProps}>
    <path d="M15 5L10 0L5 5H8V12H12V5H15Z" fill="#4a4a4a"/>
    <path d="M2 15V20H18V15H15V18H5V15H2Z" fill="#4a4a4a"/>
  </svg>
);

export const PixelUserPlusIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...commonProps}>
    <circle cx="7" cy="6" r="4" fill="#4a4a4a"/>
    <path d="M0 18C0 14 3 11 7 11C11 11 14 14 14 18" fill="#4a4a4a"/>
    <path d="M16 6V10M18 8H14" stroke="#4a4a4a" strokeWidth="2" fill="none"/>
  </svg>
);

export const PixelUserCheckIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...commonProps}>
    <circle cx="7" cy="6" r="4" fill="#4a4a4a"/>
    <path d="M0 18C0 14 3 11 7 11C11 11 14 14 14 18" fill="#4a4a4a"/>
    <path d="M16 6L18 8L22 4" stroke="#4a4a4a" strokeWidth="2" fill="none"/>
  </svg>
);

// 像素风格头像组件
export const PixelAvatar: React.FC<{
  src?: string;
  alt?: string;
  fallback?: string;
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}> = ({ src, alt = 'Avatar', fallback, size = 'md', isLoading = false }) => {
  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-20 h-20',
    lg: 'w-24 h-24'
  };

  const svgSize = {
    sm: 60,
    md: 80,
    lg: 96
  };

  
  // 检查是否是像素艺术颜色数据（以逗号分隔的颜色代码）
  const isPixelArtData = src && typeof src === 'string' && src.includes(',') && src.startsWith('#');

  // 如果正在加载，显示加载状态
  if (isLoading) {
    return (
      <div
        className={`${sizeClasses[size]} rounded-full bg-[#e5e7eb] flex items-center justify-center overflow-hidden animate-pulse`}
        style={{ border: '2px solid #d1d5db' }}
      >
        <div className="w-1/2 h-1/2 bg-[#9ca3af] rounded-full animate-ping"></div>
      </div>
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-full bg-[#c2d0da] flex items-center justify-center overflow-hidden`}
      style={{ border: '2px solid #d1d5db' }}
    >
      {src && !isPixelArtData ? (
        <img 
          src={src} 
          alt={alt}
          className="w-full h-full object-cover"
          style={{ imageRendering: 'pixelated' }}
          onError={(e) => {
            logger.error('❌ 头像加载失败:', { src, error: e });
          }}
          onLoad={() => {
            logger.info('✅ 头像加载成功:', src);
          }}
        />
      ) : isPixelArtData ? (
        <PixelArtAvatar 
          colorData={src} 
          size={svgSize[size]}
          alt={alt}
        />
      ) : (
        <svg width={svgSize[size]} height={svgSize[size]} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" {...commonProps}>
          {/* Skin */}
          <rect x="12" y="14" width="16" height="15" fill="#f2d5b3"/>
          <rect x="13" y="13" width="14" height="1" fill="#f2d5b3"/>
          <rect x="14" y="12" width="12" height="1" fill="#f2d5b3"/>
          {/* Hair */}
          <path d="M12 14H28V11H27V10H25V9H23V8H17V9H15V10H13V11H12V14Z" fill="#5c3c20"/>
          <path d="M12 11H13V10H12V11Z M27 11H28V10H27V11Z" fill="#f2d5b3"/>
          <rect x="15" y="10" width="2" height="1" fill="#5c3c20"/>
          <rect x="23" y="10" width="2" height="1" fill="#5c3c20"/>
          <rect x="17" y="9" width="6" height="1" fill="#5c3c20"/>
          {/* Eyes */}
          <rect x="15" y="17" width="3" height="3" fill="#3d2b1f"/>
          <rect x="22" y="17" width="3" height="3" fill="#3d2b1f"/>
          <rect x="16" y="17" width="1" height="1" fill="white"/>
          <rect x="23" y="17" width="1" height="1" fill="white"/>
          {/* Mouth */}
          <rect x="18" y="24" width="4" height="1" fill="#9e6255"/>
          <rect x="17" y="23" width="1" height="1" fill="#9e6255"/>
          <rect x="22" y="23" width="1" height="1" fill="#9e6255"/>
          {/* Shirt */}
          <rect y="28" width="40" height="12" fill="#2c4b82"/>
          <rect x="11" y="28" width="18" height="2" fill="#3e64aa"/>
          <rect x="12" y="27" width="16" height="1" fill="#3e64aa"/>
        </svg>
      )}
    </div>
  );
};
