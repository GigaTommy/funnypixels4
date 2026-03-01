const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');
const axios = require('axios');

/**
 * 生成高德地图风格的分享卡片（支持GPS轨迹和像素绘制）
 * @param {Request} req - Express请求对象
 * @param {Response} res - Express响应对象
 */
async function generateShareImage(req, res) {
  try {
    const {
      // GPS轨迹相关参数
      trackPoints,
      startTime,
      endTime,
      date,
      username,
      distance,
      // 像素绘制相关参数
      pixelData,
      drawTime,
      pixelCount,
      // 地图相关参数
      centerLat,
      centerLng,
      zoomLevel = 15,
      bounds,
      // 模式选择
      mode = 'gps' // 'gps' 或 'pixel'
    } = req.body;

    const isPixelMode = mode === 'pixel';

    logger.info('🎨 生成分享图片请求:', {
      mode,
      isPixelMode,
      trackPointsCount: trackPoints?.length || 0,
      pixelCount: pixelCount || 0
    });

    // 创建简单的SVG占位符图像
    const svgImage = `
      <svg width="1200" height="1800" xmlns="http://www.w3.org/2000/svg">
        <!-- 白色背景 -->
        <rect width="1200" height="1800" fill="#ffffff" />

        <!-- 标题 -->
        <text x="40" y="60" font-family="PingFang SC, Microsoft YaHei, sans-serif"
              font-size="32" font-weight="bold" fill="#333">
          ${isPixelMode ? '像素绘制战果' : 'GPS轨迹分享'}
        </text>

        <!-- 用户信息 -->
        <text x="40" y="110" font-family="PingFang SC" font-size="24" fill="#666">
          用户: ${username || '匿名用户'}
        </text>

        <!-- 统计信息 -->
        ${isPixelMode ? `
          <text x="40" y="160" font-family="PingFang SC" font-size="20" fill="#666">
            像素数量: ${pixelCount || 0}
          </text>
          <text x="40" y="210" font-family="PingFang SC" font-size="20" fill="#666">
            绘制时长: ${drawTime || '未知'}
          </text>
        ` : `
          <text x="40" y="160" font-family="PingFang SC" font-size="20" fill="#666">
            轨迹点数: ${trackPoints?.length || 0}
          </text>
          <text x="40" y="210" font-family="PingFang SC" font-size="20" fill="#666">
            GPS时段: ${startTime || '未知'} - ${endTime || '未知'}
          </text>
          <text x="40" y="260" font-family="PingFang SC" font-size="20" fill="#666">
            总距离: ${distance || '未知'}
          </text>
        `}

        <!-- 地图占位区域 -->
        <rect x="40" y="300" width="1120" height="800"
              fill="#f0f0f0" stroke="#ddd" stroke-width="2" />
        <text x="600" y="700" font-family="PingFang SC" font-size="24"
              text-anchor="middle" fill="#999">
          地图预览区域
        </text>
        <text x="600" y="740" font-family="PingFang SC" font-size="18"
              text-anchor="middle" fill="#999">
          ${isPixelMode
            ? `像素中心: ${centerLat?.toFixed(4) || '未知'}, ${centerLng?.toFixed(4) || '未知'}`
            : `轨迹中心: ${centerLat?.toFixed(4) || '未知'}, ${centerLng?.toFixed(4) || '未知'}`
          }
        </text>

        <!-- 底部信息 -->
        <text x="600" y="1300" font-family="PingFang SC" font-size="18"
              text-anchor="middle" fill="#666">
          FunnyPixels - 像素绘制游戏
        </text>
        <text x="600" y="1340" font-family="PingFang SC" font-size="16"
              text-anchor="middle" fill="#999">
          生成时间: ${new Date().toLocaleString('zh-CN')}
        </text>

        <!-- 模式标识 -->
        <rect x="40" y="1400" width="200" height="60" rx="30"
              fill="${isPixelMode ? '#10b981' : '#3b82f6'}" />
        <text x="140" y="1438" font-family="PingFang SC" font-size="20" font-weight="bold"
              text-anchor="middle" fill="white">
          ${isPixelMode ? '像素模式' : 'GPS模式'}
        </text>
      </svg>
    `;

    // 使用 Sharp 将 SVG 转换为 PNG
    const buffer = await Buffer.from(svgImage);
    const imageBuffer = await sharp(buffer)
      .png()
      .toBuffer();

    // 设置响应头
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(imageBuffer);

  } catch (err) {
    logger.error('❌ 生成分享图片失败:', err);
    res.status(500).json({
      success: false,
      error: '生成分享图片失败',
      details: err.message
    });
  }
}

/**
 * 格式化距离显示
 */
function formatDistance(meters) {
  if (meters < 1000) {
    return `${meters.toFixed(0)}米`;
  } else {
    return `${(meters / 1000).toFixed(2)}公里`;
  }
}

/**
 * 格式化时间显示
 */
function formatTime(minutes) {
  if (!minutes) return '0分钟';
  if (minutes < 60) {
    return `${Math.round(minutes)}分钟`;
  } else {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}小时${mins}分钟`;
  }
}

module.exports = {
  generateShareImage,
  formatDistance,
  formatTime
};