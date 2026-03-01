const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');

/**
 * 生成绘制会话缩略图
 * POST /api/share/thumbnail
 */
async function generateThumbnail(req, res) {
  try {
    const {
      sessionId,
      bounds,
      zoomLevel = 18,
      trackPoints = [],
      drawRecords = [],
      stats = {},
      username = '用户',
      sessionStart,
      sessionEnd,
      userInfo = {}
    } = req.body;

    logger.info('🎨 生成缩略图请求:', {
      sessionId,
      trackPointsCount: trackPoints.length,
      drawRecordsCount: drawRecords.length,
      stats
    });

    // 使用 Sharp 创建一个简单的缩略图
    // 因为 Canvas 渲染系统已被移除，这里创建一个简单的占位符图像
    const svgImage = `
      <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:#f8fafc" />
            <stop offset="100%" style="stop-color:#e2e8f0" />
          </linearGradient>
        </defs>
        <rect width="800" height="600" fill="url(#bg)" />
        <text x="400" y="50" font-family="PingFang SC, Microsoft YaHei, sans-serif"
              font-size="32" font-weight="bold" text-anchor="middle" fill="#1f2937">
          绘制成果
        </text>
        <text x="400" y="85" font-family="PingFang SC"
              font-size="18" text-anchor="middle" fill="#6b7280">
          ${username}
        </text>
        <text x="133" y="120" font-family="PingFang SC" font-size="12"
              text-anchor="middle" fill="#9ca3af">本次绘制</text>
        <text x="133" y="145" font-family="PingFang SC" font-size="16" font-weight="bold"
              text-anchor="middle" fill="#10b981">${stats.sessionPixels || 0} 像素</text>
        <text x="400" y="120" font-family="PingFang SC" font-size="12"
              text-anchor="middle" fill="#9ca3af">总绘制</text>
        <text x="400" y="145" font-family="PingFang SC" font-size="16" font-weight="bold"
              text-anchor="middle" fill="#3b82f6">${stats.totalPixels || 0} 像素</text>
        <text x="667" y="120" font-family="PingFang SC" font-size="12"
              text-anchor="middle" fill="#9ca3af">绘制时长</text>
        <text x="667" y="145" font-family="PingFang SC" font-size="16" font-weight="bold"
              text-anchor="middle" fill="#f59e0b">${formatDrawTime(stats.drawTime || 0)}</text>

        <!-- 地图区域 -->
        <rect x="50" y="220" width="700" height="300" fill="#f8f9fa" stroke="#dee2e6" stroke-width="2" />
        ${trackPoints.length > 0 || drawRecords.length > 0
          ? '<text x="400" y="370" font-family="PingFang SC" font-size="16" text-anchor="middle" fill="#9ca3af">绘制数据已生成</text>'
          : '<text x="400" y="370" font-family="PingFang SC" font-size="16" text-anchor="middle" fill="#9ca3af">暂无绘制数据</text>'
        }

        <!-- 底部信息 -->
        <text x="400" y="560" font-family="PingFang SC" font-size="12" text-anchor="middle" fill="#6b7280">
          会话 ID: ${sessionId?.substring(0, 8) || 'N/A'} | ${sessionStart ? new Date(sessionStart).toLocaleDateString('zh-CN') : new Date().toLocaleDateString('zh-CN')}
        </text>
      </svg>
    `;

    // 生成图片URL
    const timestamp = Date.now();
    const filename = `thumbnail-${sessionId || 'unknown'}-${timestamp}.png`;
    const uploadsDir = path.join(__dirname, '../../public/uploads');
    const battleThumbnailsDir = path.join(uploadsDir, 'battle-thumbnails');

    // 确保目录存在
    await fs.mkdir(battleThumbnailsDir, { recursive: true });

    // 使用 Sharp 保存图片
    const filePath = path.join(battleThumbnailsDir, filename);
    const buffer = await Buffer.from(svgImage);
    const imageBuffer = await sharp(buffer)
      .png()
      .toBuffer();

    await fs.writeFile(filePath, imageBuffer);

    const imageUrl = `/uploads/battle-thumbnails/${filename}`;

    logger.info('✅ 缩略图生成成功:', {
      sessionId,
      filename,
      imageUrl,
      size: imageBuffer.length
    });

    res.json({
      success: true,
      data: {
        thumbnailUrl: imageUrl,
        filename,
        size: imageBuffer.length
      }
    });

  } catch (error) {
    logger.error('❌ 缩略图生成失败:', error);
    res.status(500).json({
      success: false,
      error: '缩略图生成失败',
      details: error.message
    });
  }
}

/**
 * 格式化绘制时间
 */
function formatDrawTime(minutes) {
  if (!minutes) return '0分钟';
  if (minutes < 60) return `${Math.round(minutes)}分钟`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}小时${mins}分钟`;
}

module.exports = {
  generateThumbnail
};