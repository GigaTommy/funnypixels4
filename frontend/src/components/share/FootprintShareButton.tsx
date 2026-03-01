import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Navigation,
  MapPin,
  Share2,
  QrCode,
  Route,
  Sparkles
} from 'lucide-react';
import FootprintMap from '../track/FootprintMap';
import FootprintService from '../../services/footprintService';
import { logger } from '../../utils/logger';
import { soundService } from '../../services/soundService';

interface FootprintShareButtonProps {
  sessionId: string;
  sessionData?: any;
  userData?: {
    name: string;
    avatar?: string;
    alliance?: {
      name: string;
      flag?: string;
    };
  };
  style?: React.CSSProperties;
  variant?: 'button' | 'icon' | 'card';
  size?: 'small' | 'medium' | 'large';
}

/**
 * 足迹图分享按钮组件
 * 提供多种样式和尺寸，适配不同的使用场景
 */
export default function FootprintShareButton({
  sessionId,
  sessionData,
  userData,
  style,
  variant = 'button',
  size = 'medium'
}: FootprintShareButtonProps) {
  const [showFootprintMap, setShowFootprintMap] = useState(false);

  const handleOpenFootprintMap = () => {
    logger.info('📍 打开足迹图:', sessionId);
    setShowFootprintMap(true);
    soundService.play('click');
  };

  const handleCloseFootprintMap = () => {
    setShowFootprintMap(false);
  };

  // 根据变体和尺寸获取样式
  const getButtonStyles = (): React.CSSProperties => {
    const baseStyles: React.CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontWeight: '500',
      outline: 'none'
    };

    // 尺寸样式
    const sizeStyles = {
      small: {
        padding: '6px 12px',
        fontSize: '12px',
        minHeight: '32px'
      },
      medium: {
        padding: '8px 16px',
        fontSize: '14px',
        minHeight: '40px'
      },
      large: {
        padding: '12px 24px',
        fontSize: '16px',
        minHeight: '48px'
      }
    };

    // 变体样式
    const variantStyles = {
      button: {
        backgroundColor: '#10b981',
        color: 'white',
        boxShadow: '0 4px 12px rgba(16,185,129,0.3)'
      },
      icon: {
        backgroundColor: 'transparent',
        color: '#6b7280',
        padding: '8px'
      },
      card: {
        backgroundColor: '#ffffff',
        color: '#1f2937',
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }
    };

    return {
      ...baseStyles,
      ...sizeStyles[size],
      ...variantStyles[variant],
      ...style
    };
  };

  // 获取按钮内容
  const getButtonContent = () => {
    switch (variant) {
      case 'icon':
        return <Route size={size === 'small' ? 16 : size === 'large' ? 24 : 20} />;

      case 'card':
        return (
          <>
            <div style={{
              width: '32px',
              height: '32px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Navigation size={16} style={{ color: 'white' }} />
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>
                足迹图
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                查看行车轨迹
              </div>
            </div>
            <Sparkles size={16} style={{ color: '#f59e0b', marginLeft: 'auto' }} />
          </>
        );

      default: // button
        return (
          <>
            <Route size={size === 'small' ? 14 : size === 'large' ? 20 : 16} />
            {size !== 'small' && <span>足迹图</span>}
          </>
        );
    }
  };

  // 获取悬停和点击样式
  const getInteractionStyles = () => {
    const baseHover = {
      transform: 'translateY(-1px)',
      boxShadow: '0 6px 16px rgba(0,0,0,0.15)'
    };

    const baseActive = {
      transform: 'translateY(0)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
    };

    switch (variant) {
      case 'button':
        return {
          hover: { ...baseHover, backgroundColor: '#059669' },
          active: { ...baseActive, backgroundColor: '#047857' }
        };

      case 'icon':
        return {
          hover: { ...baseHover, color: '#10b981', backgroundColor: '#f0fdf4' },
          active: { ...baseActive, color: '#059669', backgroundColor: '#dcfce7' }
        };

      case 'card':
        return {
          hover: { ...baseHover, borderColor: '#10b981', backgroundColor: '#f0fdf4' },
          active: { ...baseActive, borderColor: '#059669', backgroundColor: '#dcfce7' }
        };

      default:
        return { hover: baseHover, active: baseActive };
    }
  };

  const interactionStyles = getInteractionStyles();

  return (
    <>
      <motion.button
        style={getButtonStyles()}
        whileHover={{
          scale: 1.02,
          ...interactionStyles.hover
        }}
        whileTap={{
          scale: 0.98,
          ...interactionStyles.active
        }}
        onClick={handleOpenFootprintMap}
        onMouseEnter={(e) => {
          Object.assign(e.currentTarget.style, interactionStyles.hover);
        }}
        onMouseLeave={(e) => {
          Object.assign(e.currentTarget.style, {
            transform: 'translateY(0)',
            boxShadow: variant === 'button' ? '0 4px 12px rgba(16,185,129,0.3)' :
                      variant === 'icon' ? 'none' : '0 1px 3px rgba(0,0,0,0.1)'
          });
        }}
      >
        {getButtonContent()}
      </motion.button>

      {/* 足迹图弹窗 */}
      <FootprintMap
        isOpen={showFootprintMap}
        onClose={handleCloseFootprintMap}
        sessionId={sessionId}
        sessionData={sessionData}
        userData={userData}
      />
    </>
  );
}

/**
 * 足迹图分享链接生成器
 * 使用FootprintService提供真实的分享功能
 */
export class FootprintShareManager {
  /**
   * 生成足迹图分享链接
   */
  static generateShareUrl(sessionId: string): string {
    return FootprintService.generateShareUrl(sessionId);
  }

  /**
   * 复制分享链接到剪贴板
   */
  static async copyShareUrl(sessionId: string): Promise<boolean> {
    return await FootprintService.copyShareUrl(sessionId);
  }

  /**
   * 分享到社交媒体
   */
  static shareToSocialMedia(sessionId: string, platform: 'wechat' | 'weibo' | 'qq'): void {
    FootprintService.shareToSocialMedia(sessionId, platform);
  }

  /**
   * 生成分享图片数据URL
   */
  static async generateShareImage(sessionId: string, sessionData: any): Promise<string> {
    // 这里可以实现Canvas生成分享图片
    logger.info('生成分享图片:', sessionId);
    return '';
  }
}