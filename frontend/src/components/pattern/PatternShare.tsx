import React, { useState, useCallback } from 'react';
import { logger } from '../../utils/logger';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, Copy, Download, QrCode, Link, Facebook, Twitter, Instagram, MessageCircle, Globe } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';

import { replaceAlert } from '../../utils/toastHelper';
import { Input } from '../ui/Input';

interface PatternShareProps {
  isOpen: boolean;
  onClose: () => void;
  pattern: {
    id: string;
    name: string;
    description: string;
    preview_url: string;
    author: {
      username: string;
    };
  };
}

interface SharePlatform {
  key: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  url: string;
}

export const PatternShare: React.FC<PatternShareProps> = ({
  isOpen,
  onClose,
  pattern
}) => {
  const [shareUrl, setShareUrl] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);

  // 分享平台配置
  const sharePlatforms: SharePlatform[] = [
    {
      key: 'facebook',
      name: 'Facebook',
      icon: <Facebook size={20} />,
      color: '#1877F2',
      url: 'https://www.facebook.com/sharer/sharer.php'
    },
    {
      key: 'twitter',
      name: 'Twitter',
      icon: <Twitter size={20} />,
      color: '#1DA1F2',
      url: 'https://twitter.com/intent/tweet'
    },
    {
      key: 'instagram',
      name: 'Instagram',
      icon: <Instagram size={20} />,
      color: '#E4405F',
      url: 'https://www.instagram.com'
    },
    {
      key: 'wechat',
      name: '微信',
      icon: <MessageCircle size={20} />,
      color: '#07C160',
      url: 'weixin://'
    },
    {
      key: 'weibo',
      name: '微博',
      icon: <Globe size={20} />,
      color: '#E6162D',
      url: 'https://service.weibo.com/share/share.php'
    }
  ];

  // 生成分享链接
  const generateShareUrl = useCallback(() => {
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/pattern/${pattern.id}`;
    setShareUrl(url);
    return url;
  }, [pattern.id]);

  // 生成二维码
  const generateQRCode = useCallback(async () => {
    if (!shareUrl) {
      generateShareUrl();
    }
    
    setIsGeneratingQR(true);
    try {
      // 使用 QR Server API 生成二维码
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareUrl)}`;
      setQrCodeUrl(qrApiUrl);
    } catch (error) {
      logger.error('生成二维码失败:', error);
    } finally {
      setIsGeneratingQR(false);
    }
  }, [shareUrl, generateShareUrl]);

  // 复制链接
  const copyToClipboard = useCallback(async () => {
    if (!shareUrl) {
      generateShareUrl();
    }
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      logger.error('复制失败:', error);
      // 降级方案
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [shareUrl, generateShareUrl]);

  // 下载二维码
  const downloadQRCode = useCallback(async () => {
    if (!qrCodeUrl) {
      await generateQRCode();
    }
    
    try {
      const response = await fetch(qrCodeUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pattern-${pattern.id}-qr.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('下载二维码失败:', error);
    }
  }, [qrCodeUrl, generateQRCode, pattern.id]);

  // 分享到社交媒体
  const shareToPlatform = useCallback((platform: SharePlatform) => {
    const url = generateShareUrl();
    const text = `看看这个超棒的像素图案：${pattern.name} - ${pattern.description}`;
    
    let shareUrl = '';
    
    switch (platform.key) {
      case 'facebook':
        shareUrl = `${platform.url}?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`;
        break;
      case 'twitter':
        shareUrl = `${platform.url}?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
        break;
      case 'weibo':
        shareUrl = `${platform.url}?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`;
        break;
      case 'wechat':
        // 微信分享需要特殊处理，这里只是示例
        replaceAlert.error('请使用微信扫描二维码分享');
        return;
      case 'instagram':
        // Instagram 分享需要特殊处理
        replaceAlert.error('请复制链接到 Instagram 分享');
        return;
      default:
        shareUrl = platform.url;
    }
    
    if (shareUrl) {
      window.open(shareUrl, '_blank', 'width=600,height=400');
    }
  }, [pattern.name, pattern.description, generateShareUrl]);

  // 初始化分享链接
  React.useEffect(() => {
    if (isOpen && !shareUrl) {
      generateShareUrl();
    }
  }, [isOpen, shareUrl, generateShareUrl]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl"
      >
        {/* 头部 */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold">分享图案</h2>
          <Button variant="ghost" onClick={onClose}>
            ✕
          </Button>
        </div>

        {/* 图案信息 */}
        <div className="p-6 border-b">
          <div className="flex items-center gap-4">
            <img
              src={pattern.preview_url}
              alt={pattern.name}
              className="w-16 h-16 object-cover rounded-lg"
            />
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{pattern.name}</h3>
              <p className="text-gray-600 text-sm">{pattern.description}</p>
              <p className="text-gray-500 text-xs mt-1">作者：{pattern.author.username}</p>
            </div>
          </div>
        </div>

        {/* 分享链接 */}
        <div className="p-6 border-b">
          <h4 className="font-medium mb-3">分享链接</h4>
          <div className="flex gap-2">
            <Input
              value={shareUrl}
              onChange={() => {}} // 只读输入框，onChange为必需属性但无需处理
              readOnly
              className="flex-1"
            />
            <Button
              onClick={copyToClipboard}
              variant={copied ? 'primary' : 'outline'}
              icon={copied ? undefined : Copy}
            >
              {copied ? '已复制' : '复制'}
            </Button>
          </div>
        </div>

        {/* 二维码 */}
        <div className="p-6 border-b">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium">二维码</h4>
            <Button
              onClick={downloadQRCode}
              variant="outline"
              size="sm"
              icon={Download}
            >
              下载
            </Button>
          </div>
          <div className="flex justify-center">
            {isGeneratingQR ? (
              <div className="w-48 h-48 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                  <p className="text-gray-600 text-sm">生成中...</p>
                </div>
              </div>
            ) : qrCodeUrl ? (
              <img
                src={qrCodeUrl}
                alt="分享二维码"
                className="w-48 h-48 border rounded-lg"
              />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
                <Button
                  onClick={generateQRCode}
                  variant="outline"
                  icon={QrCode}
                >
                  生成二维码
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* 社交媒体分享 */}
        <div className="p-6">
          <h4 className="font-medium mb-4">分享到社交媒体</h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {sharePlatforms.map((platform) => (
              <Button
                key={platform.key}
                onClick={() => shareToPlatform(platform)}
                variant="outline"
                className="flex flex-col items-center gap-2 p-4 h-auto"
                style={{ borderColor: platform.color, color: platform.color }}
              >
                {platform.icon}
                <span className="text-xs">{platform.name}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* 底部操作 */}
        <div className="flex justify-end gap-2 p-6 border-t">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={copyToClipboard} icon={Share2}>
            复制链接
          </Button>
        </div>
      </motion.div>
    </div>
  );
};
