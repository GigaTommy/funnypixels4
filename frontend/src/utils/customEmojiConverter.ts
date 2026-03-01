/**
 * 自定义图片转自定义emoji转换器
 * 将复杂图案转换为Canvas原生支持的emoji格式
 */

import { logger } from './logger';

export interface CustomEmojiData {
  id: string;
  unicode: string;
  width: number;
  height: number;
  fontFamily: string;
  fontSize: number;
  dataUrl?: string; // 用于字体文件方式
  imageElement?: HTMLImageElement; // 添加图像元素用于Canvas直接绘制
  canvas?: HTMLCanvasElement; // 添加canvas缓存
}

export interface PatternToEmojiOptions {
  size?: number; // 目标大小，默认18px
  quality?: 'low' | 'medium' | 'high'; // 转换质量
  method?: 'font' | 'svg' | 'canvas'; // 转换方法
}

export class CustomEmojiConverter {
  private static instance: CustomEmojiConverter;
  private customEmojiMap = new Map<string, CustomEmojiData>();
  private fontLoaded = false;
  private unicodeCounter = 0xE000; // Unicode私有区域起始

  static getInstance(): CustomEmojiConverter {
    if (!CustomEmojiConverter.instance) {
      CustomEmojiConverter.instance = new CustomEmojiConverter();
    }
    return CustomEmojiConverter.instance;
  }

  /**
   * 将PNG base64图片转换为自定义emoji
   */
  async convertImageToEmoji(
    patternId: string,
    base64Data: string,
    options: PatternToEmojiOptions = {}
  ): Promise<CustomEmojiData> {
    const { size = 18, quality = 'medium', method = 'canvas' } = options;

    // 检查是否已转换过
    if (this.customEmojiMap.has(patternId)) {
      return this.customEmojiMap.get(patternId)!;
    }

    let customEmoji: CustomEmojiData;

    switch (method) {
      case 'canvas':
        customEmoji = await this.convertViaCanvas(patternId, base64Data, size, quality);
        break;
      case 'svg':
        customEmoji = await this.convertViaSVG(patternId, base64Data, size, quality);
        break;
      case 'font':
        customEmoji = await this.convertViaFont(patternId, base64Data, size, quality);
        break;
      default:
        throw new Error(`不支持的转换方法: ${method}`);
    }

    this.customEmojiMap.set(patternId, customEmoji);
    return customEmoji;
  }

  /**
   * 将RLE编码图案转换为自定义emoji
   */
  async convertRLEToEmoji(
    patternId: string,
    rleData: any[],
    width: number,
    height: number,
    options: PatternToEmojiOptions = {}
  ): Promise<CustomEmojiData> {
    const { size = 18, quality = 'medium' } = options;

    // 检查是否已转换过
    if (this.customEmojiMap.has(patternId)) {
      return this.customEmojiMap.get(patternId)!;
    }

    // 将RLE数据转换为Canvas图像
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    canvas.width = width;
    canvas.height = height;

    // 禁用抗锯齿，保持像素风格
    ctx.imageSmoothingEnabled = false;

    // 解析RLE数据并绘制到Canvas
    let pixelIndex = 0;
    for (const segment of rleData) {
      ctx.fillStyle = segment.color;
      for (let i = 0; i < segment.count && pixelIndex < width * height; i++) {
        const x = pixelIndex % width;
        const y = Math.floor(pixelIndex / width);
        ctx.fillRect(x, y, 1, 1);
        pixelIndex++;
      }
    }

    // 转换为base64
    const base64Data = canvas.toDataURL('image/png');
    
    // 使用Canvas方法转换为emoji
    const customEmoji = await this.convertViaCanvas(patternId, base64Data, size, quality);
    this.customEmojiMap.set(patternId, customEmoji);
    
    return customEmoji;
  }

  /**
   * 通过Canvas方式转换
   */
  private async convertViaCanvas(
    patternId: string,
    base64Data: string,
    size: number,
    quality: string
  ): Promise<CustomEmojiData> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          // 创建Canvas进行图像处理
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d')!;
          
          // 设置目标大小
          canvas.width = size;
          canvas.height = size;
          
          // 禁用抗锯齿，保持像素风格
          ctx.imageSmoothingEnabled = false;
          
          // 绘制图像
          ctx.drawImage(img, 0, 0, size, size);
          
          // 转换为data URL
          const dataUrl = canvas.toDataURL('image/png');

          // 生成自定义Unicode
          const unicode = String.fromCharCode(this.unicodeCounter++);

          // 创建图像元素用于Canvas绘制
          const imageElement = new Image();
          imageElement.src = dataUrl;

          const customEmoji: CustomEmojiData = {
            id: patternId,
            unicode,
            width: size,
            height: size,
            fontFamily: 'CustomPatterns',
            fontSize: size,
            dataUrl,
            imageElement, // 添加图像元素
            canvas: canvas // 添加canvas缓存
          };

          resolve(customEmoji);
        } catch (error) {
          logger.error('Canvas转换失败:', error);
          reject(error);
        }
      };

      img.onerror = (error) => {
        logger.error('图像加载失败详情:', error);
        logger.error('Base64数据长度:', base64Data.length);
        logger.error('Base64数据前100字符:', base64Data.substring(0, 100));
        reject(new Error('图像加载失败'));
      };

      // 确保base64数据格式正确
      let processedBase64 = base64Data;
      if (!base64Data.startsWith('data:image/')) {
        processedBase64 = `data:image/png;base64,${base64Data}`;
      }

      logger.info('convertViaCanvas - 设置图像源长度:', processedBase64.length);
      logger.info('convertViaCanvas - 图像源前100字符:', processedBase64.substring(0, 100));
      img.src = processedBase64;
    });
  }

  /**
   * 通过SVG方式转换
   */
  private async convertViaSVG(
    patternId: string,
    base64Data: string,
    size: number,
    quality: string
  ): Promise<CustomEmojiData> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          // 创建SVG
          const svg = `
            <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
              <image href="${base64Data}" width="${size}" height="${size}" />
            </svg>
          `;
          
          // 转换为data URL
          const dataUrl = `data:image/svg+xml;base64,${btoa(svg)}`;
          
          // 生成自定义Unicode
          const unicode = String.fromCharCode(this.unicodeCounter++);
          
          const customEmoji: CustomEmojiData = {
            id: patternId,
            unicode,
            width: size,
            height: size,
            fontFamily: 'CustomPatterns',
            fontSize: size,
            dataUrl
          };
          
          resolve(customEmoji);
        } catch (error) {
          logger.error('SVG转换失败:', error);
          reject(error);
        }
      };

      img.onerror = (error) => {
        logger.error('SVG图像加载失败详情:', error);
        logger.error('SVG Base64数据长度:', base64Data.length);
        logger.error('SVG Base64数据前100字符:', base64Data.substring(0, 100));
        reject(new Error('图像加载失败'));
      };

      // 确保base64数据格式正确
      let processedBase64 = base64Data;
      if (!base64Data.startsWith('data:image/')) {
        processedBase64 = `data:image/png;base64,${base64Data}`;
      }

      logger.info('convertViaSVG - 设置图像源长度:', processedBase64.length);
      logger.info('convertViaSVG - 图像源前100字符:', processedBase64.substring(0, 100));
      img.src = processedBase64;
    });
  }

  /**
   * 通过字体文件方式转换
   */
  private async convertViaFont(
    patternId: string,
    base64Data: string,
    size: number,
    quality: string
  ): Promise<CustomEmojiData> {
    // 这里需要更复杂的字体文件生成逻辑
    // 暂时使用Canvas方式作为fallback
    return this.convertViaCanvas(patternId, base64Data, size, quality);
  }

  /**
   * 获取自定义emoji数据
   */
  getCustomEmoji(patternId: string): CustomEmojiData | undefined {
    return this.customEmojiMap.get(patternId);
  }

  /**
   * 检查是否已转换
   */
  hasCustomEmoji(patternId: string): boolean {
    return this.customEmojiMap.has(patternId);
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    this.customEmojiMap.clear();
    this.unicodeCounter = 0xE000;
  }

  /**
   * 获取所有自定义emoji
   */
  getAllCustomEmojis(): CustomEmojiData[] {
    return Array.from(this.customEmojiMap.values());
  }
}

// 导出单例实例
export const customEmojiConverter = CustomEmojiConverter.getInstance();
