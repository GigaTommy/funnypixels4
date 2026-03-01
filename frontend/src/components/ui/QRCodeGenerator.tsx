import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

interface QRCodeGeneratorProps {
  value: string;
  size?: number;
  logoUrl?: string;
  title?: string;
  onGenerated?: (dataUrl: string) => void;
}

/**
 * 二维码生成组件
 * 使用真实的qrcode库生成二维码，支持自定义logo
 */
export default function QRCodeGenerator({
  value,
  size = 200,
  logoUrl,
  title,
  onGenerated
}: QRCodeGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    generateQRCode();
  }, [value, size, logoUrl]);

  const generateQRCode = async () => {
    if (!canvasRef.current || !value) return;

    setIsGenerating(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (!ctx) {
      setIsGenerating(false);
      return;
    }

    try {
      // 设置canvas尺寸
      canvas.width = size;
      canvas.height = size;

      // 清空画布
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);

      // 使用qrcode库生成真实的二维码
      const qrDataUrl = await QRCode.toDataURL(value, {
        width: size,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'H'
      });

      // 将生成的二维码绘制到canvas上
      const qrImage = new Image();
      await new Promise<void>((resolve, reject) => {
        qrImage.onload = () => {
          ctx.drawImage(qrImage, 0, 0, size, size);
          resolve();
        };
        qrImage.onerror = reject;
        qrImage.src = qrDataUrl;
      });

      // 如果有logo，在中心绘制logo
      if (logoUrl) {
        await drawLogo(ctx, logoUrl, size);
      }

      // 转换为DataURL
      const finalDataUrl = canvas.toDataURL('image/png');
      setQrDataUrl(finalDataUrl);

      // 回调
      if (onGenerated) {
        onGenerated(finalDataUrl);
      }

    } catch (error) {
      console.error('二维码生成失败:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const drawLogo = async (ctx: CanvasRenderingContext2D, logoUrl: string, size: number) => {
    return new Promise<void>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        const logoSize = size * 0.2; // Logo占二维码的20%
        const logoX = (size - logoSize) / 2;
        const logoY = (size - logoSize) / 2;

        // 绘制白色背景
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(logoX - 5, logoY - 5, logoSize + 10, logoSize + 10);

        // 绘制logo
        ctx.drawImage(img, logoX, logoY, logoSize, logoSize);
        resolve();
      };

      img.onerror = () => {
        console.warn('Logo加载失败，使用默认图标');
        drawDefaultLogo(ctx, size);
        resolve();
      };

      img.src = logoUrl;
    });
  };

  const drawDefaultLogo = (ctx: CanvasRenderingContext2D, size: number) => {
    const logoSize = size * 0.2;
    const logoX = (size - logoSize) / 2;
    const logoY = (size - logoSize) / 2;

    // 绘制默认图标（简单的像素风格）
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(logoX, logoY, logoSize, logoSize);

    ctx.fillStyle = '#ffffff';
    ctx.font = `${logoSize * 0.4}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('FP', logoX + logoSize / 2, logoY + logoSize / 2);
  };

  const downloadQRCode = () => {
    if (!qrDataUrl) return;

    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `qrcode-${Date.now()}.png`;
    link.click();
  };

  return (
    <div style={{ textAlign: 'center' }}>
      {title && (
        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 'bold' }}>
          {title}
        </h3>
      )}

      <div style={{ position: 'relative', display: 'inline-block' }}>
        <canvas
          ref={canvasRef}
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            maxWidth: '100%',
            height: 'auto'
          }}
        />

        {isGenerating && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255,255,255,0.8)',
            borderRadius: '8px'
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              border: '3px solid #e5e7eb',
              borderTop: '3px solid #3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
          </div>
        )}
      </div>

      {qrDataUrl && (
        <div style={{ marginTop: '16px' }}>
          <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#6b7280', wordBreak: 'break-all' }}>
            {value}
          </p>
          <button
            onClick={downloadQRCode}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#3b82f6',
              color: 'white',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#2563eb';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#3b82f6';
            }}
          >
            下载二维码
          </button>
        </div>
      )}
    </div>
  );
}