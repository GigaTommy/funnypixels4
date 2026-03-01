import { PixelInfo } from '../types/pixel';
import { logger } from '../utils/logger';
import { ChatAPI, SendMessageData } from './chat';

export interface ShareOptions {
  type: 'private_message' | 'alliance_channel' | 'social_media' | 'copy_link';
  targetUserId?: string;
  allianceId?: string;
  platform?: 'wechat' | 'weibo' | 'qq' | 'twitter' | 'facebook';
}

export interface ShareResult {
  success: boolean;
  message: string;
  shareUrl?: string;
  data?: any;
}

export class ShareService {
  // 生成像素分享链接
  static generatePixelShareUrl(pixel: PixelInfo): string {
    const baseUrl = window.location.origin;
    return `${baseUrl}/pixel/${pixel.lat}/${pixel.lng}`;
  }

  private static createLocationMetadata(pixel: PixelInfo) {
    const locationParts = [pixel.country_name, pixel.alliance_name].filter(Boolean);

    return {
      lat: pixel.lat,
      lng: pixel.lng,
      label: pixel.username ? `${pixel.username} 的像素` : '像素坐标',
      addressSnippet: locationParts.length ? locationParts.join(' · ') : undefined,
      previewUrl: pixel.avatar_url || undefined,
      pixel: {
        id: pixel.grid_id,
        gridId: pixel.grid_id,
        color: pixel.color,
        lat: pixel.lat,
        lng: pixel.lng
      },
      linkUrl: this.generatePixelShareUrl(pixel)
    };
  }

  private static createLocationContent(pixel: PixelInfo): string {
    const coordinate = `(${pixel.lat.toFixed(4)}, ${pixel.lng.toFixed(4)})`;
    const colorLabel = pixel.color ? ` 颜色: ${pixel.color}` : '';
    if (pixel.username || pixel.display_name) {
      return `${pixel.display_name || pixel.username} 分享的像素 ${coordinate}${colorLabel}`;
    }
    return `分享一个像素坐标 ${coordinate}${colorLabel}`;
  }

  // 生成像素分享图片
  static async generatePixelShareImage(pixel: PixelInfo): Promise<string> {
    // 这里可以实现生成分享图片的逻辑
    // 例如使用 Canvas 绘制像素信息卡片
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 400;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        // 设置背景
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 600, 400);
        
        // 绘制标题
        ctx.fillStyle = '#1f2937';
        ctx.font = 'bold 24px Arial';
        ctx.fillText('像素信息分享', 30, 50);
        
        // 绘制像素颜色
        ctx.fillStyle = pixel.color;
        ctx.fillRect(30, 80, 40, 40);
        ctx.strokeStyle = '#d1d5db';
        ctx.lineWidth = 2;
        ctx.strokeRect(30, 80, 40, 40);
        
        // 绘制坐标信息
        ctx.fillStyle = '#6b7280';
        ctx.font = '16px Arial';
        ctx.fillText(`坐标: (${pixel.lat.toFixed(6)}, ${pixel.lng.toFixed(6)})`, 90, 100);
        
        // 绘制用户信息
        if (pixel.username) {
          ctx.fillText(`绘制人: ${pixel.username}`, 90, 125);
        }
        
        // 绘制时间信息
        if (pixel.timestamp) {
          const date = new Date(pixel.timestamp);
          ctx.fillText(`创建时间: ${date.toLocaleDateString('zh-CN')}`, 90, 150);
        }
        
        // 绘制二维码或链接
        ctx.fillStyle = '#3b82f6';
        ctx.font = '14px Arial';
        ctx.fillText('扫描二维码或点击链接查看详情', 30, 200);
        
        // 绘制网站信息
        ctx.fillStyle = '#9ca3af';
        ctx.font = '12px Arial';
        ctx.fillText('FunnyPixels - 像素艺术创作平台', 30, 380);
      }
      
      resolve(canvas.toDataURL('image/png'));
    });
  }

  // 分享到私信
  static async shareToPrivateMessage(
    pixel: PixelInfo,
    targetUserId?: string
  ): Promise<ShareResult> {
    try {
      const userId = targetUserId || (pixel as any).user_id || (pixel as any).userId;

      if (!userId) {
        return {
          success: false,
          message: '无法确定私信的接收者'
        };
      }

      const payload: SendMessageData = {
        channelType: 'private',
        channelId: userId,
        messageType: 'location',
        content: this.createLocationContent(pixel),
        metadata: this.createLocationMetadata(pixel)
      };

      const response = await ChatAPI.sendMessage(payload);

      if (!response.success) {
        return {
          success: false,
          message: response.message || '分享到私信失败'
        };
      }

      return {
        success: true,
        message: '已将像素分享到私信',
        data: response.data
      };
    } catch (error) {
      logger.error('分享到私信失败:', error);
      return {
        success: false,
        message: '分享到私信失败',
        data: { error }
      };
    }
  }

  // 分享到联盟频道
  static async shareToAllianceChannel(
    pixel: PixelInfo,
    allianceId?: string
  ): Promise<ShareResult> {
    try {
      const resolvedAllianceId = allianceId || pixel.alliance?.id || (pixel as any).alliance_id;

      if (!resolvedAllianceId) {
        return {
          success: false,
          message: '当前像素没有可用的联盟频道'
        };
      }

      const payload: SendMessageData = {
        channelType: 'alliance',
        channelId: String(resolvedAllianceId),
        messageType: 'location',
        content: this.createLocationContent(pixel),
        metadata: this.createLocationMetadata(pixel)
      };

      const response = await ChatAPI.sendMessage(payload);

      if (!response.success) {
        return {
          success: false,
          message: response.message || '分享到联盟频道失败'
        };
      }

      return {
        success: true,
        message: '已分享到联盟频道',
        data: response.data
      };
    } catch (error) {
      logger.error('分享到联盟频道失败:', error);
      return {
        success: false,
        message: '分享到联盟频道失败',
        data: { error }
      };
    }
  }

  static async shareToGlobalChat(pixel: PixelInfo): Promise<ShareResult> {
    try {
      const payload: SendMessageData = {
        channelType: 'global',
        channelId: 'global',
        messageType: 'location',
        content: this.createLocationContent(pixel),
        metadata: this.createLocationMetadata(pixel)
      };

      const response = await ChatAPI.sendMessage(payload);

      if (!response.success) {
        return {
          success: false,
          message: response.message || '分享到全局聊天失败'
        };
      }

      return {
        success: true,
        message: '已分享到全局聊天',
        data: response.data
      };
    } catch (error) {
      logger.error('分享到全局聊天失败:', error);
      return {
        success: false,
        message: '分享到全局聊天失败',
        data: { error }
      };
    }
  }

  // 分享到社交媒体
  static async shareToSocialMedia(
    pixel: PixelInfo,
    platform: 'wechat' | 'weibo' | 'qq' | 'twitter' | 'facebook'
  ): Promise<ShareResult> {
    try {
      const shareUrl = this.generatePixelShareUrl(pixel);
      const text = `我在 FunnyPixels 上创建了一个像素！坐标: (${pixel.lat.toFixed(6)}, ${pixel.lng.toFixed(6)}) 颜色: ${pixel.color}`;
      
      let shareData: any = {};
      
      switch (platform) {
        case 'wechat':
          // 微信分享逻辑
          shareData = {
            title: 'FunnyPixels 像素分享',
            desc: text,
            link: shareUrl,
            imgUrl: await this.generatePixelShareImage(pixel)
          };
          break;
          
        case 'weibo':
          // 微博分享逻辑
          shareData = {
            url: shareUrl,
            title: text,
            pic: await this.generatePixelShareImage(pixel)
          };
          break;
          
        case 'twitter':
          // Twitter分享逻辑
          shareData = {
            text: `${text} ${shareUrl}`,
            url: shareUrl
          };
          break;
          
        case 'facebook':
          // Facebook分享逻辑
          shareData = {
            href: shareUrl,
            quote: text
          };
          break;
          
        default:
          return {
            success: false,
            message: '不支持的分享平台'
          };
      }
      
      // TODO: 调用相应平台的分享API
      logger.info(`分享到${platform}:`, shareData);
      
      return {
        success: true,
        message: `分享到${platform}成功`,
        data: shareData
      };
    } catch (error) {
      return {
        success: false,
        message: `分享到${platform}失败`,
        data: { error }
      };
    }
  }

  // 复制分享链接
  static async copyShareLink(pixel: PixelInfo): Promise<ShareResult> {
    try {
      const shareUrl = this.generatePixelShareUrl(pixel);
      
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        return {
          success: true,
          message: '链接已复制到剪贴板',
          shareUrl
        };
      } else if (typeof document !== 'undefined') {
        // 降级方案：创建临时输入框
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);

        return {
          success: true,
          message: '链接已复制到剪贴板',
          shareUrl
        };
      }

      return {
        success: false,
        message: '当前环境不支持复制链接'
      };
    } catch (error) {
      return {
        success: false,
        message: '复制链接失败',
        data: { error }
      };
    }
  }

  // 生成分享统计
  static async getShareStats(pixel: PixelInfo): Promise<{
    totalShares: number;
    privateMessageShares: number;
    allianceShares: number;
    socialMediaShares: number;
  }> {
    try {
      // TODO: 调用API获取分享统计
      return {
        totalShares: 0,
        privateMessageShares: 0,
        allianceShares: 0,
        socialMediaShares: 0
      };
    } catch (error) {
      logger.error('获取分享统计失败:', error);
      return {
        totalShares: 0,
        privateMessageShares: 0,
        allianceShares: 0,
        socialMediaShares: 0
      };
    }
  }
}
