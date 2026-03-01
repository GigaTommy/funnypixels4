import React, { useState } from 'react';

import { replaceAlert } from '../../utils/toastHelper';
import { Download, Share2 } from 'lucide-react';
import ShareService from '../../services/shareService';

interface TrackShareButtonProps {
  // GPS轨迹相关参数
  trackPoints?: [number, number][];
  startTime?: string;
  endTime?: string;
  date?: string;
  // 像素绘制相关参数
  sessionId?: string;
  bounds?: { north: number; south: number; east: number; west: number };
  zoomLevel?: number;
  drawRecords?: Array<{
    gridId: string;
    lat: number;
    lng: number;
    timestamp: number;
    color: string;
  }>;
  stats?: {
    sessionPixels: number;
    totalPixels: number;
    drawTime: number;
  };
  userInfo?: {
    displayName?: string;
    avatar?: string;
    alliance?: {
      name: string;
      flag: string;
      color: string;
    };
  };
  // 通用参数
  username: string;
  avatar?: string;
}

export default function TrackShareButton({
  trackPoints,
  startTime,
  endTime,
  date,
  sessionId,
  bounds,
  zoomLevel,
  drawRecords,
  stats,
  userInfo,
  username,
  avatar
}: TrackShareButtonProps) {
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // 检测是否为像素模式
  const isPixelMode = !!(sessionId && bounds && stats);
  const buttonText = isPixelMode ? '生成战果图' : '生成分享图';
  const loadingText = isPixelMode ? '生成战果中...' : '生成分享中...';
  const successText = isPixelMode ? '战果图已生成并开始下载' : '分享图已生成并开始下载';

  const handleGenerate = async () => {
    setLoading(true);
    try {
      // 检测是否为像素模式
      const isPixelMode = !!(sessionId && bounds && stats);

      const url = await ShareService.generateTrackShareImage({
        // GPS轨迹参数
        trackPoints,
        startTime,
        endTime,
        date,
        // 像素绘制参数
        sessionId,
        bounds,
        zoomLevel,
        drawRecords,
        stats,
        userInfo,
        // 通用参数
        username,
        avatar
      });

      setImageUrl(url);

      // 自动下载图片
      const link = document.createElement('a');
      link.href = url;
      link.download = isPixelMode
        ? `像素绘制战果_${sessionId?.substring(0, 8)}_${Date.now()}.png`
        : `GPS轨迹分享_${Date.now()}.png`;
      link.click();
    } catch (err) {
      console.error('生成分享图片失败:', err);
      replaceAlert.error('生成分享图片失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
      >
        {loading ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            {loadingText}
          </>
        ) : (
          <>
            <Share2 size={16} />
            {buttonText}
          </>
        )}
      </button>

      {imageUrl && (
        <div className="mt-2 text-sm text-gray-500 flex items-center gap-1">
          <Download size={14} />
          {successText}
        </div>
      )}
    </div>
  );
}