import React, { useState } from 'react';
import { X, Download, MessageCircle } from 'lucide-react';
import { logger } from '../utils/logger';
import sellerQrcode from '../assets/seller-qrcode.jpg';

interface CustomerServiceProps {
  isOpen?: boolean;
}

export default function CustomerService({ isOpen = false }: CustomerServiceProps) {
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [showSaveTip, setShowSaveTip] = useState(false);

  const handleImageLoad = () => {
    setIsImageLoading(false);
    logger.info('客服二维码加载完成');
  };

  const handleImageError = () => {
    setIsImageLoading(false);
    logger.error('客服二维码加载失败');
  };

  const handleSaveImage = () => {
    try {
      const link = document.createElement('a');
      link.href = sellerQrcode;
      link.download = 'funnypixels-customer-service.jpg';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setShowSaveTip(true);
      setTimeout(() => setShowSaveTip(false), 2000);

      logger.info('用户保存客服二维码');
    } catch (error) {
      logger.error('保存二维码失败:', error);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '24px',
      padding: '32px 16px',
      backgroundColor: 'white',
      borderRadius: '16px',
      border: '1px solid #e5e7eb',
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
      minHeight: '400px',
      justifyContent: 'center'
    }}>
      {/* 标题区域 */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
        textAlign: 'center'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 20px',
          backgroundColor: '#f0f9ff',
          borderRadius: '12px',
          border: '1px solid #bae6fd'
        }}>
          <MessageCircle size={24} style={{ color: '#0284c7' }} />
          <h2 style={{
            fontSize: '20px',
            fontWeight: 700,
            color: '#0c4a6e',
            margin: 0
          }}>
            官方客服
          </h2>
        </div>

        <p style={{
          fontSize: '16px',
          color: '#64748b',
          margin: 0,
          lineHeight: 1.5
        }}>
          扫描二维码添加官方客服微信<br />
          获取游戏帮助、反馈问题、咨询合作
        </p>
      </div>

      {/* 二维码区域 */}
      <div style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px'
      }}>
        {/* 二维码容器 */}
        <div style={{
          position: 'relative',
          width: '280px',
          height: '280px',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          border: '4px solid white',
          backgroundColor: '#f8fafc'
        }}>
          {isImageLoading && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#f1f5f9',
              color: '#64748b',
              fontSize: '14px'
            }}>
              加载中...
            </div>
          )}

          <img
            src={sellerQrcode}
            alt="官方客服微信二维码"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: isImageLoading ? 'none' : 'block'
            }}
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        </div>

        {/* 保存按钮 */}
        <button
          onClick={handleSaveImage}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            borderRadius: '8px',
            backgroundColor: '#0284c7',
            color: 'white',
            border: 'none',
            fontSize: '16px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 12px rgba(2,132,199,0.3)'
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#0369a1';
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 16px rgba(2,132,199,0.4)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#0284c7';
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(2,132,199,0.3)';
          }}
        >
          <Download size={18} />
          保存二维码
        </button>

        {/* 保存成功提示 */}
        {showSaveTip && (
          <div style={{
            position: 'absolute',
            top: '-40px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '8px 16px',
            backgroundColor: '#10b981',
            color: 'white',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 600,
            boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
            whiteSpace: 'nowrap'
          }}>
            ✓ 二维码已保存
          </div>
        )}
      </div>

      {/* 提示信息 */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        textAlign: 'center',
        maxWidth: '320px'
      }}>
        <div style={{
          padding: '16px',
          backgroundColor: '#fefce8',
          borderRadius: '8px',
          border: '1px solid #fde047'
        }}>
          <p style={{
            margin: 0,
            fontSize: '14px',
            color: '#854d0e',
            lineHeight: 1.4
          }}>
            <strong>客服时间：</strong>9:00-22:00<br />
            <strong>服务内容：</strong>游戏问题、账号帮助、充值咨询、建议反馈
          </p>
        </div>

        <p style={{
          margin: 0,
          fontSize: '14px',
          color: '#6b7280',
          fontStyle: 'italic'
        }}>
          如客服暂未回复，请稍后重试或留言说明问题
        </p>
      </div>
    </div>
  );
}