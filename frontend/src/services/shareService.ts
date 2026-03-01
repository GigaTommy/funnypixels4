import { AuthService } from './auth';
import { logger } from '../utils/logger';
import { AllianceAPI } from './alliance';
import { config } from '../config/env';
import { sessionDataManager, SessionData } from './sessionDataManager';

// 分享平台类型
export type SharePlatform = 'wechat' | 'weibo' | 'douyin' | 'xiaohongshu';

// 足迹分享数据接口 - 基于真实session数据
export interface ShareSessionData {
  userId: string;
  username: string;
  displayName?: string;
  avatar?: string;
  alliance?: {
    name: string;
    flag: string;
    color: string;
  };
  stats: {
    totalPixels: number;      // 会话结束时的总像素数
    sessionPixels: number;    // 本会话绘制的像素数
    drawTime: number;         // 绘制时长（秒）
  };
  mapData: {
    center: { lat: number; lng: number };
    zoom: number;
    bounds: { north: number; south: number; east: number; west: number };
  };
  // GPS轨迹数据 - 来自真实的session记录
  trackPoints?: Array<{ lat: number; lng: number; timestamp: number }>;
  sessionId: string;          // 必须的会话ID
  timestamp: string;          // 会话创建时间
  // 额外的session信息
  drawRecords?: Array<{        // 绘制记录
    gridId: string;
    lat: number;
    lng: number;
    timestamp: number;
    color: string;
  }>;
  sessionStart?: string;      // 会话开始时间
  sessionEnd?: string;        // 会话结束时间
}

// 分享配置
export interface ShareConfig {
  title: string;
  description: string;
  imageUrl: string;
  url: string;
  platform: SharePlatform;
}

// 二维码生成配置
export interface QRCodeConfig {
  text: string;
  width: number;
  height: number;
  color: string;
  backgroundColor: string;
}

class ShareService {
  private static readonly API_BASE_URL = config.API_BASE_URL;

  // 生成足迹分享图 - 使用真实的session数据
  static async generateShareImage(data: ShareSessionData): Promise<string> {
    try {
      // 验证session数据完整性
      if (!data.sessionId) {
        throw new Error('缺少会话ID，无法生成分享图片');
      }

      if (!data.stats.sessionPixels || data.stats.sessionPixels <= 0) {
        logger.warn('⚠️ ShareService: 当前会话没有绘制数据，sessionPixels为0');
        // 不抛出错误，而是继续处理，但记录警告
      }

      // 检查认证状态
      if (!this.checkAuthStatus()) {
        throw new Error('用户未认证，请先登录');
      }

      const token = this.getAuthToken();
      logger.info('ShareService: 生成战果缩略图 - 使用真实session数据', {
        sessionId: data.sessionId,
        sessionPixels: data.stats.sessionPixels,
        totalPixels: data.stats.totalPixels,
        drawTime: data.stats.drawTime,
        trackPointsCount: data.trackPoints?.length || 0,
        drawRecordsCount: data.drawRecords?.length || 0,
        tokenStatus: !!token
      });

      // 准备请求数据 - 完全基于真实的session数据
      const requestData = {
        sessionId: data.sessionId,
        bounds: data.mapData.bounds,
        zoomLevel: data.mapData.zoom || 18,
        trackPoints: data.trackPoints || [],  // 来自真实session的轨迹点
        drawRecords: data.drawRecords || [],  // 来自真实session的绘制记录
        // 统计数据全部来自真实session
        stats: {
          sessionPixels: data.stats.sessionPixels,    // 本会话真实绘制的像素数
          totalPixels: data.stats.totalPixels,        // 会话结束时的真实总像素数
          drawTime: data.stats.drawTime               // 真实的绘制时长
        },
        username: data.username || '匿名用户',
        // 添加session时间信息
        sessionStart: data.sessionStart,
        sessionEnd: data.sessionEnd,
        // 添加用户信息
        userInfo: {
          displayName: data.displayName,
          avatar: data.avatar,
          alliance: data.alliance
        }
      };

      logger.info('ShareService: 发送缩略图生成请求:', {
        sessionId: requestData.sessionId,
        bounds: requestData.bounds,
        zoomLevel: requestData.zoomLevel,
        trackPointsCount: requestData.trackPoints?.length,
        stats: requestData.stats,
        username: requestData.username
      });

      let response = await fetch(`${this.API_BASE_URL}/api/share/thumbnail`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestData)
      });

      // 如果返回403或401，尝试刷新token后重试
      if (response.status === 403 || response.status === 401) {
        logger.info('ShareService: token可能过期，尝试刷新...');
        const refreshSuccess = await this.tryRefreshToken();

        if (refreshSuccess) {
          // 使用新token重试
          const newToken = this.getAuthToken();
          response = await fetch(`${this.API_BASE_URL}/api/share/thumbnail`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${newToken}`
            },
            body: JSON.stringify(requestData)
          });
        }
      }

      if (!response.ok) {
        logger.error('ShareService: 生成战果缩略图失败，状态码:', response.status);
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 403) {
          throw new Error('权限不足，请重新登录');
        } else if (response.status === 401) {
          throw new Error('认证失败，请重新登录');
        } else if (response.status === 400) {
          throw new Error(errorData.error || '请求参数错误');
        } else {
          throw new Error(`生成战果缩略图失败 (${response.status}): ${errorData.error || '未知错误'}`);
        }
      }

      const result = await response.json();
      logger.info('ShareService: 战果缩略图生成成功:', result);

      if (result.success && result.data && result.data.thumbnailUrl) {
        // 如果是相对路径，添加API_BASE_URL前缀
        let thumbnailUrl = result.data.thumbnailUrl;
        if (!thumbnailUrl.startsWith('http://') && !thumbnailUrl.startsWith('https://')) {
          thumbnailUrl = `${this.API_BASE_URL}${thumbnailUrl.startsWith('/') ? '' : '/'}${thumbnailUrl}`;
          logger.info('ShareService: 转换相对路径为绝对路径:', {
            original: result.data.thumbnailUrl,
            absolute: thumbnailUrl
          });
        }
        return thumbnailUrl;
      } else {
        throw new Error(result.error || '战果缩略图生成失败');
      }

    } catch (error: any) {
      logger.error('ShareService: 生成战果缩略图异常:', error);

      // 如果是网络错误，提供更好的错误信息
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('网络连接失败，请检查网络后重试');
      }

      // 降级到前端生成（如果后端生成失败）
      logger.warn('ShareService: 后端缩略图生成失败，降级到前端生成');
      return this.generateFallbackImage(data);
    }
  }

  // 生成GPS轨迹分享图片（兼容像素绘制分享）
  static async generateTrackShareImage(data: {
    // GPS轨迹相关参数
    trackPoints?: [number, number][];
    startTime?: string;
    endTime?: string;
    date?: string;
    username: string;
    avatar?: string;
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
  }): Promise<string> {
    try {
      // 检查认证状态
      if (!this.checkAuthStatus()) {
        throw new Error('用户未认证，请先登录');
      }

      const token = this.getAuthToken();

      // 检测是否为像素模式
      const isPixelMode = !!(data.sessionId && data.bounds && data.stats);

      logger.info('ShareService: 生成分享图片', {
        mode: isPixelMode ? '像素绘制' : 'GPS轨迹',
        sessionId: data.sessionId,
        trackPointsCount: data.trackPoints?.length,
        drawRecordsCount: data.drawRecords?.length,
        tokenStatus: !!token
      });

      const response = await fetch(`${this.API_BASE_URL}/api/share-image/generate-share-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        logger.error('ShareService: 生成分享图片失败，状态码:', response.status);
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`生成分享图片失败 (${response.status}): ${errorData.error || '未知错误'}`);
      }

      // 返回图片的blob URL
      const blob = await response.blob();
      return URL.createObjectURL(blob);

    } catch (error: any) {
      logger.error('ShareService: 生成分享图片异常:', error);
      throw new Error(`生成分享图片失败: ${error.message}`);
    }
  }

  // 降级方案：前端生成图片 - 基于真实session数据
  private static async generateFallbackImage(data: ShareSessionData): Promise<string> {
    try {
      logger.info('ShareService: 使用前端降级方案生成图片 - 基于真实session数据', {
        sessionId: data.sessionId,
        sessionPixels: data.stats.sessionPixels,
        hasTrackPoints: data.trackPoints && data.trackPoints.length > 0,
        hasDrawRecords: data.drawRecords && data.drawRecords.length > 0
      });

      // 创建Canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('无法创建Canvas上下文');

      // 设置尺寸 (9:16比例)
      canvas.width = 360;
      canvas.height = 640;

      // 绘制背景
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#f8fafc');
      gradient.addColorStop(1, '#e2e8f0');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 绘制标题
      ctx.fillStyle = '#1f2937';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('绘制成果', canvas.width / 2, 50);

      // 绘制用户信息
      ctx.font = '16px sans-serif';
      ctx.fillStyle = '#6b7280';
      ctx.fillText(data.username || '匿名用户', canvas.width / 2, 80);

      // 显示会话ID（验证数据真实性）
      ctx.font = '10px sans-serif';
      ctx.fillStyle = '#9ca3af';
      ctx.fillText(`会话: ${data.sessionId}`, canvas.width / 2, 100);

      // 绘制统计数据 - 全部来自真实session
      const statsY = 150;
      const stats = [
        { label: '本次绘制', value: `${data.stats.sessionPixels} 像素` },
        { label: '总绘制', value: `${data.stats.totalPixels} 像素` },
        { label: '绘制时长', value: this.formatDrawTime(data.stats.drawTime) }
      ];

      stats.forEach((stat, index) => {
        const x = (canvas.width / 3) * index + (canvas.width / 6);

        // 标签
        ctx.fillStyle = '#9ca3af';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(stat.label, x, statsY);

        // 数值
        ctx.fillStyle = '#374151';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText(stat.value, x, statsY + 25);
      });

      // 绘制真实轨迹或绘制记录
      const hasRealTrackData = (data.trackPoints && data.trackPoints.length > 1) ||
                              (data.drawRecords && data.drawRecords.length > 0);

      if (hasRealTrackData) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.beginPath();

        const mapY = 250;
        const mapHeight = 200;
        const mapWidth = canvas.width - 80;
        const mapX = 40;

        // 优先使用轨迹点，其次使用绘制记录
        const pointsToDraw = data.trackPoints && data.trackPoints.length > 1 ?
          data.trackPoints :
          data.drawRecords?.map(record => ({ lat: record.lat, lng: record.lng, timestamp: record.timestamp }));

        if (pointsToDraw && pointsToDraw.length > 1) {
          pointsToDraw.forEach((point, index) => {
            const x = mapX + (index / (pointsToDraw!.length - 1)) * mapWidth;
            const y = mapY + Math.sin(index * 0.2) * 50; // 简单的波形轨迹

            if (index === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          });

          ctx.stroke();

          // 绘制起点和终点
          ctx.fillStyle = '#10b981';
          ctx.beginPath();
          ctx.arc(mapX, mapY, 4, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(mapX + mapWidth, mapY, 4, 0, Math.PI * 2);
          ctx.fill();

          // 显示数据来源
          ctx.font = '10px sans-serif';
          ctx.fillStyle = '#6b7280';
          const dataSource = data.trackPoints && data.trackPoints.length > 1 ? 'GPS轨迹' : '绘制记录';
          ctx.fillText(`${dataSource} (${pointsToDraw.length}个点)`, canvas.width / 2, mapY + mapHeight + 20);
        }
      } else {
        // 没有真实数据的提示
        ctx.fillStyle = '#9ca3af';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('暂无绘制数据', canvas.width / 2, 350);
        ctx.font = '10px sans-serif';
        ctx.fillText('请先进行像素绘制', canvas.width / 2, 370);
      }

      // 返回base64图片
      return canvas.toDataURL('image/png');

    } catch (error) {
      logger.error('ShareService: 前端降级生成失败:', error);
      throw new Error('无法生成战果图片，请稍后重试');
    }
  }

  // 格式化绘制时长
  private static formatDrawTime(seconds: number): string {
    if (seconds < 60) {
      return `${seconds}秒`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}分${remainingSeconds}秒`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}小时${minutes}分`;
    }
  }

  // 获取分享配置
  static getShareConfig(platform: SharePlatform, imageUrl: string): ShareConfig {
    const baseUrl = window.location.origin;
    const shareUrl = `${baseUrl}/share/track`;

    const configs: Record<SharePlatform, ShareConfig> = {
      wechat: {
        title: '我在像素战争中绘制了像素！',
        description: '一起来参与像素战争，占领属于你的领地！',
        imageUrl,
        url: shareUrl,
        platform: 'wechat'
      },
      weibo: {
        title: '像素战争战果分享',
        description: `我在像素战争中绘制了像素点，一起来参与这场创意战争！`,
        imageUrl,
        url: shareUrl,
        platform: 'weibo'
      },
      douyin: {
        title: '像素战争战果',
        description: '一起来参与像素战争，占领属于你的领地！',
        imageUrl,
        url: shareUrl,
        platform: 'douyin'
      },
      xiaohongshu: {
        title: '像素战争战果分享',
        description: '一起来参与像素战争，占领属于你的领地！',
        imageUrl,
        url: shareUrl,
        platform: 'xiaohongshu'
      }
    };

    return configs[platform];
  }

  // 分享到指定平台
  static async shareToPlatform(platform: SharePlatform, config: ShareConfig): Promise<boolean> {
    try {
      switch (platform) {
        case 'wechat':
          return this.shareToWechat(config);
        case 'weibo':
          return this.shareToWeibo(config);
        case 'douyin':
          return this.shareToDouyin(config);
        case 'xiaohongshu':
          return this.shareToXiaohongshu(config);
        default:
          throw new Error(`不支持的分享平台: ${platform}`);
      }
    } catch (error) {
      logger.error(`分享到${platform}失败:`, error);
      return false;
    }
  }

  // 分享到微信
  private static async shareToWechat(config: ShareConfig): Promise<boolean> {
    // 微信分享需要特殊处理，可能需要调用微信JS-SDK
    if (typeof window !== 'undefined' && (window as any).WeixinJSBridge) {
      (window as any).WeixinJSBridge.invoke('shareTimeline', {
        title: config.title,
        desc: config.description,
        link: config.url,
        imgUrl: config.imageUrl
      });
      return true;
    } else {
      // 降级处理：复制链接到剪贴板
      await this.copyToClipboard(config.url);
      // 触发自定义事件，让UI组件显示提示
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('showShareTip', {
          detail: { platform: '微信', message: '分享链接已复制到剪贴板，请在微信中粘贴分享' }
        }));
      }
      return true;
    }
  }

  // 分享到微博
  private static async shareToWeibo(config: ShareConfig): Promise<boolean> {
    const url = `https://service.weibo.com/share/share.php?url=${encodeURIComponent(config.url)}&title=${encodeURIComponent(config.title)}&pic=${encodeURIComponent(config.imageUrl)}`;
    window.open(url, '_blank');
    return true;
  }

  // 分享到抖音
  private static async shareToDouyin(config: ShareConfig): Promise<boolean> {
    // 抖音分享需要特殊处理，可能需要调用抖音SDK
    // 目前使用降级方案：复制链接并显示提示
    await this.copyToClipboard(config.url);
    // 触发自定义事件，让UI组件显示提示
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('showShareTip', {
        detail: { platform: '抖音', message: '分享链接已复制到剪贴板，请在抖音中粘贴分享' }
      }));
    }
    return true;
  }

  // 分享到小红书
  private static async shareToXiaohongshu(config: ShareConfig): Promise<boolean> {
    // 小红书分享需要特殊处理
    // 目前使用降级方案：复制链接并显示提示
    await this.copyToClipboard(config.url);
    // 触发自定义事件，让UI组件显示提示
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('showShareTip', {
        detail: { platform: '小红书', message: '分享链接已复制到剪贴板，请在小红书APP中粘贴分享' }
      }));
    }
    return true;
  }

  // 复制到剪贴板
  static async copyToClipboard(text: string): Promise<void> {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
    } else {
      // 降级方案
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  }

  // 获取认证token
  private static getAuthToken(): string | null {
    // 使用与AuthService一致的token获取方式
    const token = localStorage.getItem('funnypixels_token');
    if (!token) {
      logger.warn('ShareService: 未找到认证token');
    }
    return token;
  }

  // 检查用户认证状态
  private static checkAuthStatus(): boolean {
    const token = this.getAuthToken();
    const isAuthenticated = !!token;
    logger.info('ShareService: 认证状态检查:', { isAuthenticated, hasToken: !!token });
    return isAuthenticated;
  }

  // 尝试刷新token
  private static async tryRefreshToken(): Promise<boolean> {
    try {
      const refreshToken = localStorage.getItem('pixelwar_refresh_token');
      if (!refreshToken) {
        logger.warn('ShareService: 未找到刷新token');
        return false;
      }

      logger.info('ShareService: 尝试刷新token...');
      const response = await fetch(`${this.API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refreshToken })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.tokens) {
          localStorage.setItem('funnypixels_token', result.tokens.accessToken);
                      localStorage.setItem('funnypixels_refresh_token', result.tokens.refreshToken);
          logger.info('ShareService: token刷新成功');
          return true;
        }
      }
      
      logger.warn('ShareService: token刷新失败');
      return false;
    } catch (error) {
      logger.error('ShareService: token刷新异常:', error);
      return false;
    }
  }

  // 生成二维码
  static async generateQRCode(config: QRCodeConfig): Promise<string> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/api/share/generate-qrcode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify(config)
      });

      if (!response.ok) {
        throw new Error('生成二维码失败');
      }

      const result = await response.json();
      return result.qrCodeUrl;
    } catch (error) {
      logger.error('生成二维码失败:', error);
      throw error;
    }
  }

  // 获取用户分享统计数据
  static async getShareStats(): Promise<{
    totalShares: number;
    platformStats: Record<SharePlatform, number>;
    lastShareTime: string | null;
  }> {
    try {
      const token = this.getAuthToken();
      logger.info('ShareService: 获取分享统计，token状态:', !!token);
      
      let response = await fetch(`${this.API_BASE_URL}/api/share/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      // 如果返回403或401，尝试刷新token后重试
      if (response.status === 403 || response.status === 401) {
        logger.info('ShareService: token可能过期，尝试刷新...');
        const refreshSuccess = await this.tryRefreshToken();
        
        if (refreshSuccess) {
          // 使用新token重试
          const newToken = this.getAuthToken();
          response = await fetch(`${this.API_BASE_URL}/api/share/stats`, {
            headers: {
              'Authorization': `Bearer ${newToken}`
            }
          });
        }
      }

      if (!response.ok) {
        logger.error('ShareService: 获取分享统计失败，状态码:', response.status);
        if (response.status === 403) {
          throw new Error('权限不足，请重新登录');
        } else if (response.status === 401) {
          throw new Error('认证失败，请重新登录');
        } else {
          throw new Error(`获取分享统计失败: ${response.status}`);
        }
      }

      return await response.json();
    } catch (error) {
      logger.error('获取分享统计失败:', error);
      return {
        totalShares: 0,
        platformStats: { wechat: 0, weibo: 0, douyin: 0, xiaohongshu: 0 },
        lastShareTime: null
      };
    }
  }

  // 记录分享行为
  static async recordShare(platform: SharePlatform, imageUrl: string): Promise<void> {
    try {
      await fetch(`${this.API_BASE_URL}/api/share/record`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          platform,
          imageUrl,
          timestamp: new Date().toISOString()
        })
      });
    } catch (error) {
      logger.error('记录分享失败:', error);
    }
  }
}

export default ShareService;
