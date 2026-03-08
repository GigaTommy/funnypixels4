const puppeteer = require('puppeteer-core');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs').promises;
const { db } = require('../config/database');

class ShareController {
  // 生成战果图
  static async generateBattleResult(req, res) {
    try {
      const { userId, username, displayName, avatar, alliance, stats, mapData, trackPoints, timestamp } = req.body;

      // 生成HTML模板
      const html = await ShareController.generateBattleResultHTML({
        username: displayName || username,
        avatar,
        alliance,
        stats,
        mapData,
        trackPoints,
        timestamp
      });

      // 使用Puppeteer生成图片
      const imageBuffer = await ShareController.generateImageFromHTML(html);

      // 保存图片到服务器
      const fileName = `battle-result-${userId}-${Date.now()}.png`;
      const filePath = path.join(__dirname, '../../public/uploads', fileName);

      // 确保上传目录存在
      const uploadDir = path.dirname(filePath);
      await fs.mkdir(uploadDir, { recursive: true });

      await fs.writeFile(filePath, imageBuffer);

      // 返回图片URL
      const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${fileName}`;

      res.json({
        success: true,
        imageUrl
      });

    } catch (error) {
      console.error('生成战果图失败:', error);
      console.error('错误详情:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      res.status(500).json({
        success: false,
        error: '生成战果图失败',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // 生成战果图HTML模板
  static async generateBattleResultHTML(data) {
    const { username, avatar, alliance, stats, mapData, trackPoints, timestamp } = data;

    // 计算轨迹边界和中心点
    let trackBounds = null;
    let trackCenter = mapData.center;
    if (trackPoints && trackPoints.length > 0) {
      const lats = trackPoints.map(p => p.lat);
      const lngs = trackPoints.map(p => p.lng);
      trackBounds = {
        north: Math.max(...lats),
        south: Math.min(...lats),
        east: Math.max(...lngs),
        west: Math.min(...lngs)
      };
      trackCenter = {
        lat: (trackBounds.north + trackBounds.south) / 2,
        lng: (trackBounds.east + trackBounds.west) / 2
      };
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            width: 800px;
            height: 600px;
            overflow: hidden;
          }
          
          .container {
            width: 100%;
            height: 100%;
            position: relative;
            display: flex;
            flex-direction: column;
          }
          
          .header {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
            padding: 20px;
            border-radius: 0 0 20px 20px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
          }
          
          .user-info {
            display: flex;
            align-items: center;
            gap: 15px;
            margin-bottom: 15px;
          }
          
          .avatar {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: ${avatar ? `url(${avatar})` : 'linear-gradient(45deg, #ff6b6b, #4ecdc4)'};
            background-size: cover;
            background-position: center;
            border: 3px solid #fff;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
          }
          
          .user-details {
            flex: 1;
          }
          
          .username {
            font-size: 24px;
            font-weight: bold;
            color: #2d3748;
            margin-bottom: 5px;
          }
          
          .alliance {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 16px;
            color: #718096;
          }
          
          .alliance-flag {
            width: 24px;
            height: 24px;
            display: inline-block;
            background-size: contain;
            background-repeat: no-repeat;
            background-position: center;
          }
          
          .stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
            margin-top: 15px;
          }
          
          .stat-item {
            text-align: center;
            padding: 15px;
            background: rgba(255, 255, 255, 0.8);
            border-radius: 12px;
            backdrop-filter: blur(10px);
          }
          
          .stat-value {
            font-size: 28px;
            font-weight: bold;
            color: #2d3748;
            margin-bottom: 5px;
          }
          
          .stat-label {
            font-size: 12px;
            color: #718096;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          
          .map-section {
            flex: 1;
            margin: 20px;
            background: rgba(255, 255, 255, 0.9);
            border-radius: 20px;
            padding: 20px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
          }

          .map-canvas {
            width: 100%;
            height: 280px;
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            border-radius: 15px;
            margin-bottom: 15px;
            position: relative;
            overflow: hidden;
            box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.1);
          }

          #trackCanvas {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
          }
          
          .qr-section {
            position: absolute;
            bottom: 20px;
            right: 20px;
            background: white;
            padding: 15px;
            border-radius: 15px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
            text-align: center;
          }
          
          .qr-code {
            width: 80px;
            height: 80px;
            background: #f7fafc;
            border-radius: 8px;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            color: #718096;
          }
          
          .qr-text {
            font-size: 10px;
            color: #a0aec0;
            font-weight: 500;
          }
          
          .timestamp {
            position: absolute;
            bottom: 20px;
            left: 20px;
            font-size: 12px;
            color: rgba(255, 255, 255, 0.8);
            background: rgba(0, 0, 0, 0.3);
            padding: 8px 12px;
            border-radius: 20px;
            backdrop-filter: blur(10px);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="user-info">
              <div class="avatar"></div>
              <div class="user-details">
                <div class="username">${username}</div>
                ${alliance ? `
                  <div class="alliance">
                    ${alliance.flag_pattern_id ?
          `<span class="alliance-flag" style="background-image: url('/api/sprites/icon/2/complex/${alliance.flag_pattern_id}.png')"></span>` :
          `<span class="alliance-flag" style="font-size: 20px;">${alliance.flag}</span>`}
                    <span>${alliance.name}</span>
                  </div>
                ` : ''}
              </div>
            </div>
            
            <div class="stats-grid">
              <div class="stat-item">
                <div class="stat-value">${stats.sessionPixels}</div>
                <div class="stat-label">本次绘制</div>
              </div>
              <div class="stat-item">
                <div class="stat-value">${stats.totalPixels}</div>
                <div class="stat-label">总绘制</div>
              </div>
              <div class="stat-item">
                <div class="stat-value">${Math.floor(stats.drawTime / 60)}:${(stats.drawTime % 60).toString().padStart(2, '0')}</div>
                <div class="stat-label">绘制时长</div>
              </div>
              <div class="stat-item">
                <div class="stat-value">${stats.currentPixels}</div>
                <div class="stat-label">当前占领</div>
              </div>
            </div>
          </div>
          
          <div class="map-section">
            <div class="map-canvas">
              <canvas id="trackCanvas" width="720" height="280"></canvas>
            </div>
            <div style="font-size: 16px; color: #4a5568; text-align: center; font-weight: 600;">
              ${trackPoints && trackPoints.length > 0 ? `运动轨迹 ${trackPoints.length} 个点` : `在像素战争中绘制了 ${stats.sessionPixels} 个像素点`}
            </div>
          </div>
          
          <div class="qr-section">
            <div class="qr-code">QR</div>
            <div class="qr-text">扫码参与</div>
          </div>
          
          <div class="timestamp">
            ${new Date(timestamp).toLocaleString('zh-CN')}
          </div>
        </div>

        <script>
          // 绘制轨迹
          function drawTrack() {
            const canvas = document.getElementById('trackCanvas');
            if (!canvas) return;

            const ctx = canvas.getContext('2d');
            const trackPoints = ${JSON.stringify(trackPoints || [])};

            if (!trackPoints || trackPoints.length === 0) {
              // 没有轨迹数据，显示占位符
              ctx.fillStyle = '#cbd5e0';
              ctx.font = '20px sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText('🗺️ 暂无轨迹数据', canvas.width / 2, canvas.height / 2);
              return;
            }

            // 计算边界
            const lats = trackPoints.map(p => p.lat);
            const lngs = trackPoints.map(p => p.lng);
            const bounds = {
              north: Math.max(...lats),
              south: Math.min(...lats),
              east: Math.max(...lngs),
              west: Math.min(...lngs)
            };

            // 添加边距
            const latRange = bounds.north - bounds.south;
            const lngRange = bounds.east - bounds.west;
            const margin = 0.15; // 15% 边距
            bounds.north += latRange * margin;
            bounds.south -= latRange * margin;
            bounds.east += lngRange * margin;
            bounds.west -= lngRange * margin;

            // 坐标转换函数
            function latLngToCanvas(lat, lng) {
              const x = ((lng - bounds.west) / (bounds.east - bounds.west)) * canvas.width;
              const y = ((bounds.north - lat) / (bounds.north - bounds.south)) * canvas.height;
              return { x, y };
            }

            // 绘制网格背景
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 1;
            for (let i = 0; i <= 10; i++) {
              // 垂直线
              const x = (canvas.width / 10) * i;
              ctx.beginPath();
              ctx.moveTo(x, 0);
              ctx.lineTo(x, canvas.height);
              ctx.stroke();

              // 水平线
              const y = (canvas.height / 10) * i;
              ctx.beginPath();
              ctx.moveTo(0, y);
              ctx.lineTo(canvas.width, y);
              ctx.stroke();
            }

            // 绘制轨迹底层阴影
            if (trackPoints.length > 1) {
              ctx.shadowColor = 'rgba(52, 152, 219, 0.3)';
              ctx.shadowBlur = 15;
              ctx.shadowOffsetX = 0;
              ctx.shadowOffsetY = 3;

              ctx.strokeStyle = '#3498db';
              ctx.lineWidth = 6;
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';

              ctx.beginPath();
              const start = latLngToCanvas(trackPoints[0].lat, trackPoints[0].lng);
              ctx.moveTo(start.x, start.y);

              for (let i = 1; i < trackPoints.length; i++) {
                const point = latLngToCanvas(trackPoints[i].lat, trackPoints[i].lng);
                ctx.lineTo(point.x, point.y);
              }
              ctx.stroke();

              // 关闭阴影
              ctx.shadowColor = 'transparent';
              ctx.shadowBlur = 0;
              ctx.shadowOffsetX = 0;
              ctx.shadowOffsetY = 0;
            }

            // 绘制起点（绿色）
            const startPoint = latLngToCanvas(trackPoints[0].lat, trackPoints[0].lng);
            ctx.fillStyle = '#2ecc71';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(startPoint.x, startPoint.y, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // 起点标签
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('起点', startPoint.x, startPoint.y - 15);

            // 绘制终点（红色）
            if (trackPoints.length > 1) {
              const endPoint = latLngToCanvas(trackPoints[trackPoints.length - 1].lat, trackPoints[trackPoints.length - 1].lng);
              ctx.fillStyle = '#e74c3c';
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.arc(endPoint.x, endPoint.y, 8, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();

              // 终点标签
              ctx.fillStyle = '#ffffff';
              ctx.font = 'bold 12px sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText('终点', endPoint.x, endPoint.y - 15);
            }

            // 绘制轨迹点（半透明小圆点）
            ctx.fillStyle = 'rgba(52, 152, 219, 0.4)';
            for (let i = 1; i < trackPoints.length - 1; i++) {
              const point = latLngToCanvas(trackPoints[i].lat, trackPoints[i].lng);
              ctx.beginPath();
              ctx.arc(point.x, point.y, 2, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          // 页面加载完成后绘制
          window.onload = drawTrack;
        </script>
      </body>
      </html>
    `;
  }

  // 使用Puppeteer生成图片
  static async generateImageFromHTML(html) {
    let browser;
    let userDataDir;
    try {
      // 尝试多个可能的Chrome路径
      const possibleChromePaths = [
        process.env.CHROME_PATH,
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Users\\' + process.env.USERNAME + '\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'
      ].filter(Boolean);

      let executablePath = null;
      for (const path of possibleChromePaths) {
        try {
          const fs = require('fs');
          if (fs.existsSync(path)) {
            executablePath = path;
            break;
          }
        } catch (e) {
          // 继续尝试下一个路径
        }
      }

      if (!executablePath) {
        throw new Error('Chrome浏览器未找到，请确保已安装Chrome浏览器');
      }

      console.log('使用Chrome路径:', executablePath);

      // 🔧 创建临时用户数据目录，防止文件锁定
      const os = require('os');
      userDataDir = path.join(os.tmpdir(), `puppeteer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
      await fs.mkdir(userDataDir, { recursive: true });

      // 尝试使用系统已安装的Chrome
      browser = await puppeteer.launch({
        headless: true,
        executablePath: executablePath,
        userDataDir: userDataDir, // 使用临时目录
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-software-rasterizer',
          '--disable-extensions',
          '--disable-background-networking',
          '--disable-default-apps',
          '--disable-sync',
          '--no-first-run',
          '--no-zygote',
          '--single-process' // 单进程模式，避免多进程文件锁定
        ]
      });

      const page = await browser.newPage();
      await page.setViewport({ width: 800, height: 600 });
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const screenshot = await page.screenshot({
        type: 'png',
        fullPage: false
      });

      return screenshot;
    } catch (error) {
      console.error('Puppeteer启动失败，尝试备用方案:', error);
      console.error('错误详情:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });

      // 备用方案：生成简单的HTML文件供用户下载
      const fallbackHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>战果图生成失败</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .error { color: red; }
          </style>
        </head>
        <body>
          <h1>战果图生成失败</h1>
          <p class="error">由于技术原因，无法生成图片。请稍后重试。</p>
          <p>错误信息: ${error.message}</p>
        </body>
        </html>
      `;

      return Buffer.from(fallbackHtml, 'utf-8');
    } finally {
      // 🔧 关闭浏览器并清理临时目录
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          console.error('关闭浏览器失败:', closeError);
        }
      }

      // 🔧 延迟清理临时目录，确保所有文件锁已释放
      if (userDataDir) {
        setTimeout(async () => {
          try {
            await fs.rm(userDataDir, { recursive: true, force: true, maxRetries: 3 });
            console.log('临时目录已清理:', userDataDir);
          } catch (cleanupError) {
            console.warn('清理临时目录失败:', cleanupError.message);
            // 不抛出错误，因为这是清理操作
          }
        }, 2000); // 延迟2秒清理，给文件锁更多释放时间
      }
    }
  }

  // 生成二维码
  static generateQRCode = async (req, res) => {
    try {
      const { text, width, height, color, backgroundColor } = req.body;

      const qrCodeDataURL = await QRCode.toDataURL(text, {
        width: width || 200,
        height: height || 200,
        color: {
          dark: color || '#000000',
          light: backgroundColor || '#FFFFFF'
        },
        margin: 2
      });

      res.json({
        success: true,
        qrCodeUrl: qrCodeDataURL
      });

    } catch (error) {
      console.error('生成二维码失败:', error);
      res.status(500).json({
        success: false,
        error: '生成二维码失败'
      });
    }
  };

  // 获取分享统计
  static getShareStats = async (req, res) => {
    try {
      const userId = req.user.id;

      const stats = await db('user_shares')
        .where('user_id', userId)
        .select('platform', 'created_at');

      const totalShares = stats.length;
      const platformStats = {
        wechat: stats.filter(s => s.platform === 'wechat').length,
        weibo: stats.filter(s => s.platform === 'weibo').length,
        douyin: stats.filter(s => s.platform === 'douyin').length,
        xiaohongshu: stats.filter(s => s.platform === 'xiaohongshu').length
      };

      const lastShare = stats.length > 0 ? stats[stats.length - 1].created_at : null;

      res.json({
        success: true,
        totalShares,
        platformStats,
        lastShareTime: lastShare
      });

    } catch (error) {
      console.error('获取分享统计失败:', error);
      res.status(500).json({
        success: false,
        error: '获取分享统计失败'
      });
    }
  };

  // 记录分享行为
  static recordShare = async (req, res) => {
    try {
      const userId = req.user.id;
      const { platform, imageUrl, timestamp } = req.body;

      await db('user_shares').insert({
        user_id: userId,
        platform,
        image_url: imageUrl,
        created_at: timestamp || new Date()
      });

      res.json({
        success: true,
        message: '分享记录已保存'
      });

    } catch (error) {
      console.error('记录分享失败:', error);
      res.status(500).json({
        success: false,
        error: '记录分享失败'
      });
    }
  };

  /**
   * 生成足迹图
   * POST /api/share/generate-footprint
   */
  static async generateFootprint(req, res) {
    try {
      const userId = req.user.id;
      const { sessionId, options = {} } = req.body;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: '缺少会话ID'
        });
      }

      // 获取会话详细信息
      const session = await db('drawing_sessions')
        .where({ id: sessionId, user_id: userId })
        .first();

      if (!session) {
        return res.status(404).json({
          success: false,
          error: '会话不存在'
        });
      }

      // 获取会话的像素历史
      const pixelsHistory = await db('pixels_history')
        .where({ session_id: sessionId })
        .orderBy('created_at', 'asc');

      // 聚合同一个位置的像素
      const pixelMap = new Map();
      pixelsHistory.forEach(pixel => {
        const key = `${pixel.latitude},${pixel.longitude}`;
        if (!pixelMap.has(key)) {
          pixelMap.set(key, {
            latitude: pixel.latitude,
            longitude: pixel.longitude,
            color: pixel.color,
            count: 0
          });
        }
        pixelMap.get(key).count++;
      });

      const trackPoints = Array.from(pixelMap.values());

      // 计算统计数据
      const stats = {
        totalPixels: trackPoints.length,
        totalPixelCount: trackPoints.reduce((sum, point) => sum + point.count, 0),
        startTime: session.start_time,
        endTime: session.end_time,
        duration: session.start_time && session.end_time
          ? new Date(session.end_time) - new Date(session.start_time)
          : null,
        distance: this.calculateTrackDistance(trackPoints)
      };

      // 生成足迹图图像
      const imageUrl = await this.generateFootprintImage(trackPoints, options);

      // 保存分享记录
      await db('user_shares').insert({
        user_id: userId,
        platform: 'footprint',
        image_url: imageUrl,
        created_at: new Date()
      });

      res.json({
        success: true,
        data: {
          sessionId,
          trackPoints,
          stats,
          imageUrl,
          createdAt: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('生成足迹图失败:', error);
      res.status(500).json({
        success: false,
        error: '生成足迹图失败',
        message: error.message
      });
    }
  }

  /**
   * 获取足迹图数据
   * GET /api/share/footprint/:sessionId
   */
  static async getFootprint(req, res) {
    try {
      const { sessionId } = req.params;

      // 获取会话详细信息
      const session = await db('drawing_sessions')
        .where({ id: sessionId })
        .first();

      if (!session) {
        return res.status(404).json({
          success: false,
          error: '会话不存在'
        });
      }

      // 获取会话的像素历史
      const pixelsHistory = await db('pixels_history')
        .where({ session_id: sessionId })
        .orderBy('created_at', 'asc');

      // 聚合同一个位置的像素
      const pixelMap = new Map();
      pixelsHistory.forEach(pixel => {
        const key = `${pixel.latitude},${pixel.longitude}`;
        if (!pixelMap.has(key)) {
          pixelMap.set(key, {
            latitude: pixel.latitude,
            longitude: pixel.longitude,
            color: pixel.color,
            count: 0,
            timestamp: pixel.created_at
          });
        }
        pixelMap.get(key).count++;
      });

      const trackPoints = Array.from(pixelMap.values());

      // 计算统计数据
      const stats = {
        totalPixels: trackPoints.length,
        totalPixelCount: trackPoints.reduce((sum, point) => sum + point.count, 0),
        startTime: session.start_time,
        endTime: session.end_time,
        duration: session.start_time && session.end_time
          ? new Date(session.end_time) - new Date(session.start_time)
          : null,
        distance: this.calculateTrackDistance(trackPoints)
      };

      res.json({
        success: true,
        data: {
          session: {
            id: session.id,
            name: session.session_name,
            type: session.drawing_type,
            startCity: session.start_city,
            endCity: session.end_city
          },
          trackPoints,
          stats
        }
      });

    } catch (error) {
      console.error('获取足迹图数据失败:', error);
      res.status(500).json({
        success: false,
        error: '获取足迹图数据失败',
        message: error.message
      });
    }
  }

  /**
   * 计算轨迹距离
   */
  static calculateTrackDistance(trackPoints) {
    if (trackPoints.length < 2) return 0;

    let totalDistance = 0;
    for (let i = 1; i < trackPoints.length; i++) {
      const prev = trackPoints[i - 1];
      const curr = trackPoints[i];
      totalDistance += this.getDistanceFromLatLonInKm(
        prev.latitude, prev.longitude,
        curr.latitude, curr.longitude
      );
    }
    return Math.round(totalDistance * 100) / 100;
  }

  /**
   * 计算两点间距离（公里）
   */
  static getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // 地球半径（公里）
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * 角度转弧度
   */
  static deg2rad(deg) {
    return deg * (Math.PI / 180);
  }

  /**
   * 生成足迹图图像（简化版，实际应该调用Canvas API）
   */
  static async generateFootprintImage(trackPoints, options = {}) {
    // 这里应该调用Canvas API生成足迹图
    // 暂时返回占位符URL
    const baseUrl = process.env.CDN_BASE_URL || 'http://localhost:3001';
    return `${baseUrl}/api/share/footprint-image/${Date.now()}.png`;
  }


  /**
   * 记录分享行为并奖励
   * POST /api/share/record-action
   */
  static async recordShareAction(req, res) {
    try {
      const userId = req.user.id;
      const { shareType, shareTarget, sessionId } = req.body;

      // 1. 记录分享行为
      const [shareRecord] = await db('share_tracking').insert({
        user_id: userId,
        share_type: shareType,  // 'session', 'achievement', 'profile'
        share_target: shareTarget,  // 'wechat', 'weibo', 'xiaohongshu', 'system'
        session_id: sessionId,
        created_at: new Date()
      }).returning('*');

      // 2. 发放分享奖励（从配置读取，默认每次5积分，每日上限10次）
      const rewardConfigService = require('../services/rewardConfigService');
      const SHARE_REWARD = rewardConfigService.get('reward_config.share_points', 5);
      const DAILY_SHARE_REWARD_CAP = rewardConfigService.get('reward_config.share_daily_cap', 10);

      const today = new Date().toISOString().split('T')[0];
      const todayShareCount = await db('share_tracking')
        .where('user_id', userId)
        .whereRaw("created_at::date = ?", [today])
        .count('id as count')
        .first();

      const shareCountToday = parseInt(todayShareCount.count) || 0;
      let rewardGiven = 0;

      if (shareCountToday <= DAILY_SHARE_REWARD_CAP) {
        await UserPoints.addPoints(userId, SHARE_REWARD, '分享内容奖励', `share:${shareRecord.id}`);
        rewardGiven = SHARE_REWARD;
      }

      // 3. 生成追踪链接（包含用户ID用于追踪）
      const trackingUrl = await ShareController.generateTrackingUrl(userId, shareType, sessionId);

      res.json({
        success: true,
        reward: rewardGiven,
        dailySharesRemaining: Math.max(0, DAILY_SHARE_REWARD_CAP - shareCountToday),
        trackingUrl,
        shareId: shareRecord.id
      });

    } catch (error) {
      console.error('记录分享行为失败:', error);
      res.status(500).json({
        success: false,
        error: '记录分享行为失败',
        message: error.message
      });
    }
  }

  /**
   * 生成追踪链接
   */
  static async generateTrackingUrl(userId, shareType, sessionId) {
    const baseUrl = process.env.APP_BASE_URL || 'https://funnypixels.app';
    const user = await db('users').where('id', userId).first('referral_code');
    const referralCode = user?.referral_code || '';

    if (shareType === 'session' && sessionId) {
      return `${baseUrl}/share/session/${sessionId}?ref=${referralCode}`;
    }

    return `${baseUrl}?ref=${referralCode}`;
  }

  /**
   * 获取分享点击统计
   * GET /api/share/tracking-stats
   */
  static async getShareTrackingStats(req, res) {
    try {
      const userId = req.user.id;

      // 统计分享行为
      const shares = await db('share_tracking')
        .where('user_id', userId)
        .select('share_type', 'share_target', 'created_at');

      // 统计分享被点击次数（这需要前端在打开分享链接时上报）
      const clicks = await db('share_clicks')
        .where('sharer_id', userId)
        .count('* as count')
        .first();

      res.json({
        success: true,
        data: {
          totalShares: shares.length,
          totalClicks: parseInt(clicks?.count || 0),
          shares: shares
        }
      });

    } catch (error) {
      console.error('获取分享统计失败:', error);
      res.status(500).json({
        success: false,
        error: '获取分享统计失败'
      });
    }
  }

  /**
   * 获取会话分享页面 (H5)
   * GET /api/share/page/session/:sessionId
   */
  static async getSessionSharePage(req, res) {
    try {
      const { sessionId } = req.params;

      // 获取会话详细信息
      const session = await db('drawing_sessions')
        .where({ id: sessionId })
        .first();

      if (!session) {
        return res.status(404).send('会话不存在');
      }

      // 获取用户信息
      const user = await db('users')
        .where({ id: session.user_id })
        .select('username', 'display_name', 'avatar_url')
        .first();

      // 获取联盟信息
      let alliance = null;
      if (session.alliance_id) {
        alliance = await db('alliances')
          .where({ id: session.alliance_id })
          .select('name', 'flag_unicode_char', 'flag_pattern_id', 'color')
          .first();
      }

      // 获取会话的像素统计 (Unique Grids)
      const pixelsHistory = await db('pixels_history')
        .where({ session_id: sessionId })
        .select('latitude', 'longitude');

      // 聚合同一个位置的像素 (Simple deduplication by string key)
      const uniqueGrids = new Set();
      pixelsHistory.forEach(pixel => {
        const key = `${pixel.latitude},${pixel.longitude}`; // Assuming lat/lng are close enough or pre-snapped
        // Better: Use gridId if available, but backend might not store it directly in history?
        // Let's assume history has lat/lng snapped.
        // Or re-calculate gridId?
        // Ideally 'pixels_history' should have grid_id. 
        // Checking schema... assuming simple dedupe for now or just count all if history is 1:1 with unique draws (unlikely).
        // Actually, previous logic in getFootprint deduplicated:
        /*
          const pixelMap = new Map();
          pixelsHistory.forEach...
        */
        uniqueGrids.add(key);
      });

      const uniquePixelCount = uniqueGrids.size;

      const duration = session.start_time && session.end_time
        ? Math.floor((new Date(session.end_time) - new Date(session.start_time)) / 1000)
        : 0;

      // 生成HTML
      const html = ShareController.generateSessionShareHTML({
        username: user?.display_name || user?.username || 'FunnyPixel Artist',
        pixelCount: uniquePixelCount,
        duration: duration,
        sessionId: sessionId,
        alliance: alliance ? {
          name: alliance.name,
          flag: alliance.flag_unicode_char || '🚩',
          color: alliance.color
        } : null
      });

      res.send(html);

    } catch (error) {
      console.error('获取分享页面失败:', error);
      res.status(500).send('服务器内部错误');
    }
  }

  /**
   * 生成会话分享HTML
   */
  static generateSessionShareHTML({ username, pixelCount, duration, sessionId, alliance }) {
    const formatDuration = (seconds) => {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      if (h > 0) return `${h}小时${m}分`;
      return `${m}分钟`;
    };

    const durationStr = formatDuration(duration);

    // Config: Universal Link or Scheme
    const appScheme = `funnypixels://session/${sessionId}`;
    const downloadUrl = process.env.SHARE_APP_DOWNLOAD_URL || 'https://apps.apple.com/app/id6739506634';

    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>我的 FunnyPixels 战绩</title>
    <meta name="description" content="${username} 在 FunnyPixels 完成一次绘制：${pixelCount} 像素，${durationStr}。一起加入像素世界！">
    <meta property="og:title" content="FunnyPixels 绘制战绩">
    <meta property="og:description" content="${username} 完成 ${pixelCount} 像素，耗时 ${durationStr}。">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="FunnyPixels">
    <meta name="twitter:card" content="summary">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background: radial-gradient(circle at top, #eef2ff 0%, #f8fafc 40%, #e2e8f0 100%);
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            min-height: 100vh;
            color: #2d3748;
        }
        .hero {
            width: 100%;
            background: linear-gradient(135deg, #111827 0%, #1f2937 45%, #334155 100%);
            color: white;
            padding: 28px 20px 36px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        .hero::after {
            content: "";
            position: absolute;
            width: 220px;
            height: 220px;
            border-radius: 999px;
            background: radial-gradient(circle, rgba(255,255,255,0.16), transparent 70%);
            top: -80px;
            right: -60px;
        }
        .hero-title {
            font-size: 26px;
            font-weight: 800;
            letter-spacing: 0.2px;
        }
        .hero-subtitle {
            margin-top: 6px;
            font-size: 14px;
            color: rgba(226,232,240,0.9);
        }
        .card {
            background: white;
            border-radius: 20px;
            box-shadow: 0 18px 40px rgba(15, 23, 42, 0.15);
            width: 88%;
            max-width: 420px;
            margin-top: -24px;
            padding: 24px;
            text-align: center;
            border: 1px solid #e2e8f0;
        }
        .logo {
            width: 60px;
            height: 60px;
            background: #4f46e5;
            border-radius: 15px;
            margin: 0 auto 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 30px;
            color: white;
            box-shadow: 0 8px 18px rgba(79, 70, 229, 0.35);
        }
        .title {
            font-size: 24px;
            font-weight: 800;
            margin-bottom: 10px;
            color: #1a202c;
        }
        .subtitle {
            font-size: 14px;
            color: #718096;
            margin-bottom: 20px;
        }
        .identity {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            background: #f8fafc;
            border-radius: 999px;
            padding: 6px 14px;
            font-size: 13px;
            color: #475569;
            border: 1px solid #e2e8f0;
            margin-bottom: 18px;
        }
        .stats-row {
            display: flex;
            justify-content: space-around;
            margin-bottom: 22px;
            gap: 12px;
        }
        .stat-item {
            display: flex;
            flex-direction: column;
        }
        .stat-card {
            background: #f8fafc;
            border-radius: 14px;
            padding: 14px 10px;
            border: 1px solid #e2e8f0;
            min-width: 120px;
        }
        .stat-value {
            font-size: 28px;
            font-weight: 800;
            color: #111827;
        }
        .stat-label {
            font-size: 12px;
            color: #94a3b8;
            text-transform: uppercase;
            margin-top: 5px;
        }
        .action-btn {
            display: block;
            width: 100%;
            padding: 15px 0;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 600;
            text-decoration: none;
            margin-bottom: 12px;
            transition: transform 0.1s;
        }
        .action-btn:active {
            transform: scale(0.98);
        }
        .btn-primary {
            background: #111827;
            color: white;
            box-shadow: 0 8px 18px rgba(17, 24, 39, 0.25);
        }
        .btn-secondary {
            background: #f7fafc;
            color: #4a5568;
            border: 1px solid #e2e8f0;
        }
        .share-row {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
            margin-top: 10px;
        }
        .share-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 12px;
            border-radius: 10px;
            border: 1px solid #e2e8f0;
            background: white;
            color: #1f2937;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
        }
        .share-btn.primary {
            background: #4f46e5;
            color: white;
            border: none;
        }
        .footer {
            margin-top: auto;
            padding: 20px;
            font-size: 12px;
            color: #cbd5e0;
        }
        /* WeChat Tip Overlay */
        .wechat-tip {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            z-index: 9999;
            text-align: right;
            padding-top: 20px;
            padding-right: 20px;
        }
        .wechat-tip img {
            width: 80%;
            max-width: 300px;
        }
    </style>
</head>
<body>
    <div class="hero">
        <div class="hero-title" id="heroTitle">FunnyPixels 绘制战绩</div>
        <div class="hero-subtitle" id="heroSubtitle">把你的足迹分享给更多人</div>
    </div>
    <div class="card">
        <div class="logo">🎨</div>
        <div class="title">FunnyPixels</div>
        <div class="subtitle" id="cardSubtitle">你的像素创作总结</div>

        ${alliance ? `
        <div style="margin-bottom: 20px;">
            <div style="font-size: 48px; margin-bottom: 10px;">${alliance.flag}</div>
            <div style="font-size: 20px; font-weight: 800; color: ${alliance.color || '#2d3748'};">${alliance.name}</div>
        </div>
        ` : `<div class="identity">🎯 ${username}</div>`}
        
        <div class="stats-row">
            <div class="stat-item stat-card">
                <div class="stat-value">${pixelCount}</div>
                <div class="stat-label" id="statPixelsLabel">绘制像素</div>
            </div>
            <div class="stat-item stat-card">
                <div class="stat-value">${durationStr}</div>
                <div class="stat-label" id="statDurationLabel">时长</div>
            </div>
        </div>

        <a href="${appScheme}" class="action-btn btn-primary" id="openAppBtn">打开 FunnyPixels</a>
        <a href="${downloadUrl}" class="action-btn btn-secondary" id="downloadBtn">下载 App</a>
        <a href="/" class="action-btn btn-secondary" id="openWebBtn">打开网页版</a>

        <div class="share-row">
            <button class="share-btn primary" id="systemShareBtn">系统分享</button>
            <button class="share-btn" id="copyLinkBtn">复制链接</button>
            <button class="share-btn" id="shareRedditBtn">分享到 Reddit</button>
            <button class="share-btn" id="shareXBtn">分享到 X</button>
        </div>
    </div>

    <div class="footer" id="footerText">
        Powered by FunnyPixels Team
    </div>

    <div class="wechat-tip" id="wechatTip" onclick="this.style.display='none'">
        <div style="color: white; font-size: 18px; margin-right: 20px;" id="wechatTipText">
            点击右上角 ...<br>选择在浏览器打开
        </div>
    </div>

    <script>
        const lang = (navigator.language || 'en').toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
        const i18n = {
            'zh-CN': {
                heroTitle: 'FunnyPixels 绘制战绩',
                heroSubtitle: '把你的足迹分享给更多人',
                cardSubtitle: '你的像素创作总结',
                statPixelsLabel: '绘制像素',
                statDurationLabel: '时长',
                openApp: '打开 FunnyPixels',
                downloadApp: '下载 App',
                openWeb: '打开网页版',
                systemShare: '系统分享',
                copyLink: '复制链接',
                shareReddit: '分享到 Reddit',
                shareX: '分享到 X',
                footerText: 'Powered by FunnyPixels Team',
                wechatTip: '点击右上角 ...\\n选择在浏览器打开',
                shareTitle: 'FunnyPixels 绘制战绩',
                shareText: '我在 FunnyPixels 完成了 {pixelCount} 个像素，耗时 {durationStr}，快来一起创作！',
                linkCopied: '链接已复制',
                copyFailed: '复制失败，请手动复制链接'
            },
            'en': {
                heroTitle: 'FunnyPixels Session',
                heroSubtitle: 'Share your pixel footprints',
                cardSubtitle: 'Your drawing summary',
                statPixelsLabel: 'Pixels',
                statDurationLabel: 'Duration',
                openApp: 'Open FunnyPixels',
                downloadApp: 'Download App',
                openWeb: 'Open Web',
                systemShare: 'System Share',
                copyLink: 'Copy Link',
                shareReddit: 'Share to Reddit',
                shareX: 'Share to X',
                footerText: 'Powered by FunnyPixels Team',
                wechatTip: 'Tap the top-right menu\\nOpen in browser',
                shareTitle: 'FunnyPixels Session',
                shareText: 'I created {pixelCount} pixels in {durationStr} on FunnyPixels. Join the fun!',
                linkCopied: 'Link copied',
                copyFailed: 'Copy failed. Please copy the link manually.'
            }
        };

        const translate = i18n[lang] || i18n['en'];
        const setText = (id, text) => {
            const el = document.getElementById(id);
            if (el && text) {
                el.textContent = text;
            }
        };

        setText('heroTitle', translate.heroTitle);
        setText('heroSubtitle', translate.heroSubtitle);
        setText('cardSubtitle', translate.cardSubtitle);
        setText('statPixelsLabel', translate.statPixelsLabel);
        setText('statDurationLabel', translate.statDurationLabel);
        setText('openAppBtn', translate.openApp);
        setText('downloadBtn', translate.downloadApp);
        setText('openWebBtn', translate.openWeb);
        setText('systemShareBtn', translate.systemShare);
        setText('copyLinkBtn', translate.copyLink);
        setText('shareRedditBtn', translate.shareReddit);
        setText('shareXBtn', translate.shareX);
        setText('footerText', translate.footerText);
        setText('wechatTipText', translate.wechatTip);

        const shareUrl = window.location.href;
        const shareText = translate.shareText
            .replace('{pixelCount}', '${pixelCount}')
            .replace('{durationStr}', '${durationStr}');

        // Check if UA is WeChat
        function isWeChat() {
            return /MicroMessenger/i.test(navigator.userAgent);
        }

        if (isWeChat()) {
            document.getElementById('openAppBtn').onclick = function(e) {
                e.preventDefault();
                document.getElementById('wechatTip').style.display = 'block';
            };
            document.getElementById('systemShareBtn').onclick = function(e) {
                e.preventDefault();
                document.getElementById('wechatTip').style.display = 'block';
            };
        }

        // App deep link fallback
        document.getElementById('openAppBtn').addEventListener('click', function() {
            if (isWeChat()) return;
            const timer = setTimeout(() => {
                window.location.href = '${downloadUrl}';
            }, 1400);
            window.addEventListener('pagehide', () => clearTimeout(timer));
        });

        // System share
        document.getElementById('systemShareBtn').addEventListener('click', async function() {
            if (navigator.share) {
                try {
                    await navigator.share({ title: translate.shareTitle, text: shareText, url: shareUrl });
                    return;
                } catch (e) {}
            }
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(shareUrl);
                alert(translate.linkCopied);
            }
        });

        // Copy link
        document.getElementById('copyLinkBtn').addEventListener('click', async function() {
            try {
                if (navigator.clipboard) {
                    await navigator.clipboard.writeText(shareUrl);
                    alert(translate.linkCopied);
                } else {
                    const input = document.createElement('input');
                    input.value = shareUrl;
                    document.body.appendChild(input);
                    input.select();
                    document.execCommand('copy');
                    document.body.removeChild(input);
                    alert(translate.linkCopied);
                }
            } catch (e) {
                alert(translate.copyFailed);
            }
        });

        // Share to Reddit
        document.getElementById('shareRedditBtn').addEventListener('click', function() {
            const url = 'https://www.reddit.com/submit?url=' + encodeURIComponent(shareUrl) + '&title=' + encodeURIComponent(shareText);
            window.open(url, '_blank');
        });

        // Share to X
        document.getElementById('shareXBtn').addEventListener('click', function() {
            const url = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(shareText) + '&url=' + encodeURIComponent(shareUrl);
            window.open(url, '_blank');
        });
    </script>
</body>
</html>
    `;
  }
}



module.exports = {
  generateBattleResult: ShareController.generateBattleResult,
  generateQRCode: ShareController.generateQRCode,
  getShareStats: ShareController.getShareStats,
  recordShare: ShareController.recordShare,
  generateFootprint: ShareController.generateFootprint,
  getFootprint: ShareController.getFootprint,
  getSessionSharePage: ShareController.getSessionSharePage,
  recordShareAction: ShareController.recordShareAction,
  getShareTrackingStats: ShareController.getShareTrackingStats
};
