/**
 * 前端图片处理工具类
 * 实现完整的像素化处理流程：块平均 -> 抖动 -> 颜色量化
 */

import { quantizeColor, quantizeColorTo256, hexToRgb, rgbToHex, ColorRGB } from '../../../shared/constants/colorPalette';
import { logger } from './logger';

export interface PixelData {
  r: number;
  g: number;
  b: number;
  a: number;
  x: number;
  y: number;
  color: string;
}

export interface PixelPoint {
  x: number;
  y: number;
  color: string;
}

/**
 * 图片处理工具类
 */
export class ImageProcessor {
  
  /**
   * 完整的图片处理流程
   * @param imageData 原始图片的ImageData
   * @param targetWidth 目标宽度
   * @param targetHeight 目标高度
   * @returns 处理后的像素点数组
   */
  static async processImage(
    imageData: ImageData,
    targetWidth: number,
    targetHeight: number
  ): Promise<PixelPoint[]> {
    logger.info(`🖼️ 开始完整图片处理: ${imageData.width}x${imageData.height} -> ${targetWidth}x${targetHeight}`);

    // 1. ✅ 使用 Canvas 高质量缩放代替块平均算法
    const scaled = this.pixelateImageHighQuality(
      imageData,
      targetWidth,
      targetHeight
    );
    logger.info(`✅ Canvas 高质量缩放完成: ${scaled.length}个像素`);

    // 2. ✅ 应用抖动算法 - 对所有图片使用，提升细节还原度
    const processed = this.applyFloydSteinbergDithering(
      scaled,
      targetWidth,
      targetHeight
    );
    logger.info(`✅ 应用Floyd-Steinberg抖动: ${targetWidth}x${targetHeight}`);

    // 3. ✅ 颜色量化 - 映射到256色调色板（与后端保持一致）
    const quantized = this.quantizeToPalette(processed);
    logger.info(`✅ 颜色量化到256色完成: ${quantized.length}个像素`);

    // 4. 转换为像素点格式
    const pixelPoints = this.convertToPixelPoints(quantized, targetWidth, targetHeight);
    logger.info(`✅ 像素点转换完成: ${pixelPoints.length}个有效像素`);

    return pixelPoints;
  }
  
  /**
   * ✅ Canvas 高质量缩放（替代块平均算法）
   * 使用浏览器原生的高质量缩放算法，保留更多细节
   * @param imageData 原始图片数据
   * @param targetWidth 目标宽度
   * @param targetHeight 目标高度
   * @returns 缩放后的像素数据
   */
  static pixelateImageHighQuality(
    imageData: ImageData,
    targetWidth: number,
    targetHeight: number
  ): PixelData[] {
    // 1. 创建源 Canvas
    const srcCanvas = document.createElement('canvas');
    const srcCtx = srcCanvas.getContext('2d')!;
    srcCanvas.width = imageData.width;
    srcCanvas.height = imageData.height;
    srcCtx.putImageData(imageData, 0, 0);

    // 2. 创建目标 Canvas
    const targetCanvas = document.createElement('canvas');
    const targetCtx = targetCanvas.getContext('2d', { willReadFrequently: true })!;
    targetCanvas.width = targetWidth;
    targetCanvas.height = targetHeight;

    // 3. ✅ 关键：禁用平滑处理，保留像素边缘锐度
    targetCtx.imageSmoothingEnabled = false;  // 禁用平滑，避免过度模糊
    targetCtx.drawImage(srcCanvas, 0, 0, targetWidth, targetHeight);

    // 4. 获取缩放后的像素数据
    const scaledData = targetCtx.getImageData(0, 0, targetWidth, targetHeight);

    // 5. 转换为 PixelData 格式
    const pixels: PixelData[] = [];
    for (let y = 0; y < targetHeight; y++) {
      for (let x = 0; x < targetWidth; x++) {
        const index = (y * targetWidth + x) * 4;
        pixels.push({
          r: scaledData.data[index],
          g: scaledData.data[index + 1],
          b: scaledData.data[index + 2],
          a: scaledData.data[index + 3],
          x, y,
          color: rgbToHex(
            scaledData.data[index],
            scaledData.data[index + 1],
            scaledData.data[index + 2]
          )
        });
      }
    }

    return pixels;
  }

  /**
   * 块平均算法 - 计算每个目标像素对应原始图片块的平均颜色
   * （已被 pixelateImageHighQuality 替代，保留用于参考）
   * @param imageData 原始图片数据
   * @param targetWidth 目标宽度
   * @param targetHeight 目标高度
   * @returns 像素化后的像素数据
   */
  static pixelateImageWithBlockAveraging(
    imageData: ImageData, 
    targetWidth: number, 
    targetHeight: number
  ): PixelData[] {
    const pixelatedData: PixelData[] = [];
    const blockWidth = imageData.width / targetWidth;
    const blockHeight = imageData.height / targetHeight;
    
    for (let targetY = 0; targetY < targetHeight; targetY++) {
      for (let targetX = 0; targetX < targetWidth; targetX++) {
        // 计算当前目标像素在原始图片中对应的矩形块范围
        const startX = Math.floor(targetX * blockWidth);
        const endX = Math.floor((targetX + 1) * blockWidth);
        const startY = Math.floor(targetY * blockHeight);
        const endY = Math.floor((targetY + 1) * blockHeight);
        
        // 计算块内所有像素的平均颜色
        let totalR = 0, totalG = 0, totalB = 0, totalA = 0;
        let pixelCount = 0;
        
        for (let y = startY; y < endY && y < imageData.height; y++) {
          for (let x = startX; x < endX && x < imageData.width; x++) {
            const pixelIndex = (y * imageData.width + x) * 4;
            totalR += imageData.data[pixelIndex];
            totalG += imageData.data[pixelIndex + 1];
            totalB += imageData.data[pixelIndex + 2];
            totalA += imageData.data[pixelIndex + 3];
            pixelCount++;
          }
        }
        
        // 计算平均颜色
        const avgR = pixelCount > 0 ? Math.round(totalR / pixelCount) : 0;
        const avgG = pixelCount > 0 ? Math.round(totalG / pixelCount) : 0;
        const avgB = pixelCount > 0 ? Math.round(totalB / pixelCount) : 0;
        const avgA = pixelCount > 0 ? Math.round(totalA / pixelCount) : 0;
        
        pixelatedData.push({
          r: avgR,
          g: avgG,
          b: avgB,
          a: avgA,
          x: targetX,
          y: targetY,
          color: rgbToHex(avgR, avgG, avgB)
        });
      }
    }
    
    return pixelatedData;
  }
  
  /**
   * Floyd-Steinberg抖动算法
   * 改善颜色过渡，减少颜色条带效应
   * @param pixels 像素数据数组
   * @param width 图片宽度
   * @param height 图片高度
   * @returns 抖动后的像素数据
   */
  static applyFloydSteinbergDithering(
    pixels: PixelData[], 
    width: number, 
    height: number
  ): PixelData[] {
    // 创建像素网格用于抖动处理
    const pixelGrid: PixelData[][] = [];
    for (let y = 0; y < height; y++) {
      pixelGrid[y] = [];
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        pixelGrid[y][x] = pixels[index] ? { ...pixels[index] } : { r: 0, g: 0, b: 0, a: 0, x, y, color: '#000000' };
      }
    }
    
    // 从左到右，从上到下处理每个像素
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixel = pixelGrid[y][x];
        if (!pixel || pixel.a < 30) continue; // 跳过透明像素
        
        // ✅ 量化当前像素的颜色到256色调色板（与后端保持一致）
        const quantizedColor = quantizeColorTo256(pixel.r, pixel.g, pixel.b);
        
        // 计算量化误差
        const errorR = pixel.r - quantizedColor.r;
        const errorG = pixel.g - quantizedColor.g;
        const errorB = pixel.b - quantizedColor.b;
        
        // 更新当前像素为量化后的颜色
        pixelGrid[y][x] = {
          ...pixel,
          r: quantizedColor.r,
          g: quantizedColor.g,
          b: quantizedColor.b,
          color: quantizedColor.hex
        };
        
        // 扩散误差到邻近像素
        this.diffuseError(pixelGrid, x, y, width, height, errorR, errorG, errorB);
      }
    }
    
    // 将网格转换回一维数组
    const ditheredPixels: PixelData[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        ditheredPixels.push(pixelGrid[y][x]);
      }
    }
    
    return ditheredPixels;
  }
  
  /**
   * 扩散误差到邻近像素
   * @param pixelGrid 像素网格
   * @param x 当前像素x坐标
   * @param y 当前像素y坐标
   * @param width 图片宽度
   * @param height 图片高度
   * @param errorR 红色误差
   * @param errorG 绿色误差
   * @param errorB 蓝色误差
   */
  static diffuseError(
    pixelGrid: PixelData[][], 
    x: number, 
    y: number, 
    width: number, 
    height: number, 
    errorR: number, 
    errorG: number, 
    errorB: number
  ): void {
    // Floyd-Steinberg误差扩散矩阵
    const diffusionMatrix = [
      { dx: 1, dy: 0, factor: 7/16 },   // 右
      { dx: -1, dy: 1, factor: 3/16 }, // 左下
      { dx: 0, dy: 1, factor: 5/16 },  // 下
      { dx: 1, dy: 1, factor: 1/16 }   // 右下
    ];
    
    diffusionMatrix.forEach(({ dx, dy, factor }) => {
      const newX = x + dx;
      const newY = y + dy;
      
      if (newX >= 0 && newX < width && newY >= 0 && newY < height) {
        const pixel = pixelGrid[newY][newX];
        if (pixel) {
          pixelGrid[newY][newX] = {
            ...pixel,
            r: Math.max(0, Math.min(255, pixel.r + errorR * factor)),
            g: Math.max(0, Math.min(255, pixel.g + errorG * factor)),
            b: Math.max(0, Math.min(255, pixel.b + errorB * factor)),
            color: rgbToHex(
              Math.max(0, Math.min(255, pixel.r + errorR * factor)),
              Math.max(0, Math.min(255, pixel.g + errorG * factor)),
              Math.max(0, Math.min(255, pixel.b + errorB * factor))
            )
          };
        }
      }
    });
  }
  
  /**
   * ✅ Alpha 预混合（与白色背景混合）
   */
  static blendAlphaWithBackground(
    r: number,
    g: number,
    b: number,
    a: number,
    bgColor = { r: 255, g: 255, b: 255 } // 默认白色背景
  ): { r: number; g: number; b: number; a: number } {
    const alpha = a / 255;
    return {
      r: Math.round(r * alpha + bgColor.r * (1 - alpha)),
      g: Math.round(g * alpha + bgColor.g * (1 - alpha)),
      b: Math.round(b * alpha + bgColor.b * (1 - alpha)),
      a: 255  // 输出完全不透明
    };
  }

  /**
   * 颜色量化 - 将像素数据量化到256色调色板（用于广告图片）
   * @param pixels 像素数据数组
   * @returns 量化后的像素数据
   */
  static quantizeToPalette(pixels: PixelData[]): PixelData[] {
    return pixels.map(pixel => {
      // ✅ Alpha 预混合：处理半透明像素
      if (pixel.a < 255) {
        const blended = this.blendAlphaWithBackground(
          pixel.r, pixel.g, pixel.b, pixel.a
        );
        pixel = { ...pixel, ...blended };
      }

      // ✅ 使用 256 色调色板量化（提升广告图片还原度）
      const quantizedColor = quantizeColorTo256(pixel.r, pixel.g, pixel.b);
      return {
        ...pixel,
        r: quantizedColor.r,
        g: quantizedColor.g,
        b: quantizedColor.b,
        color: quantizedColor.hex
      };
    });
  }
  
  /**
   * 转换为像素点格式
   * @param pixels 像素数据数组
   * @param width 图片宽度
   * @param height 图片高度
   * @returns 像素点数组
   */
  static convertToPixelPoints(
    pixels: PixelData[], 
    width: number, 
    height: number
  ): PixelPoint[] {
    const pixelPoints: PixelPoint[] = [];
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        const pixel = pixels[index];
        
        if (pixel && pixel.a > 30) { // 只包含非透明像素
          pixelPoints.push({
            x: x,
            y: y,
            color: pixel.color
          });
        }
      }
    }
    
    return pixelPoints;
  }
  
  /**
   * 将像素点数组转换为Canvas ImageData
   * @param pixelPoints 像素点数组
   * @param width 图片宽度
   * @param height 图片高度
   * @returns ImageData对象
   */
  static pixelPointsToImageData(
    pixelPoints: PixelPoint[], 
    width: number, 
    height: number
  ): ImageData {
    const imageData = new ImageData(width, height);
    
    // 初始化所有像素为透明
    for (let i = 0; i < imageData.data.length; i += 4) {
      imageData.data[i] = 0;     // R
      imageData.data[i + 1] = 0; // G
      imageData.data[i + 2] = 0; // B
      imageData.data[i + 3] = 0; // A (透明)
    }
    
    // 填充有效像素
    pixelPoints.forEach(point => {
      const index = (point.y * width + point.x) * 4;
      const rgb = hexToRgb(point.color);
      
      imageData.data[index] = rgb.r;     // R
      imageData.data[index + 1] = rgb.g; // G
      imageData.data[index + 2] = rgb.b; // B
      imageData.data[index + 3] = 255;   // A (不透明)
    });
    
    return imageData;
  }
}
