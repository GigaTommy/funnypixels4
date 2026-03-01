import axios from 'axios';
import { logger } from '../utils/logger';
import { TokenManager } from './auth';

export interface UploadResult {
  imageUrl: string;
  originalName: string;
  size: number;
  compressedSize: number;
  mimetype: string;
}

export class ImageUploadService {
  private static readonly API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

  /**
   * 上传图片到服务器
   * @param file 图片文件对象
   * @returns Promise<UploadResult> 上传结果，包含图片URL等信息
   */
  static async uploadImage(file: File): Promise<UploadResult> {
    try {
      logger.info('开始上传图片', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      });

      // 验证文件
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('不支持的文件格式，请使用 JPG、PNG、GIF 或 WebP 格式');
      }

      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        throw new Error('文件大小不能超过5MB');
      }

      // 创建FormData
      const formData = new FormData();
      formData.append('image', file);

      // 获取有效的认证token
      const token = TokenManager.getToken();
      if (!token) {
        throw new Error('请先登录后再上传图片');
      }

      logger.info('使用token进行图片上传', { hasToken: !!token });

      // 发送请求
      const response = await axios.post<{
        success: boolean;
        data: UploadResult;
        message: string;
      }>(`${this.API_BASE_URL}/api/images/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          // 使用TokenManager获取有效的认证token
          'Authorization': `Bearer ${token}`,
          'X-Refresh-Token': TokenManager.getRefreshToken() || ''
        },
        timeout: 30000 // 30秒超时
      });

      // 检查是否需要刷新token
      if (response.headers['x-token-refreshed'] === 'true' && response.headers['x-new-access-token']) {
        logger.info('检测到token已刷新，更新本地token');
        TokenManager.setTokens(response.headers['x-new-access-token'], TokenManager.getRefreshToken());
      }

      if (!response.data.success) {
        throw new Error(response.data.message || '上传失败');
      }

      logger.info('图片上传成功', {
        imageUrl: response.data.data.imageUrl,
        originalSize: file.size,
        compressedSize: response.data.data.compressedSize
      });

      return response.data.data;

  } catch (error) {
      logger.error('图片上传失败:', error);

      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const errorData = error.response?.data;

        logger.error('图片上传错误详情:', {
          status,
          errorData,
          message: error.message,
          config: {
            url: error.config?.url,
            method: error.config?.method,
            headers: error.config?.headers
          }
        });

        if (status === 413) {
          throw new Error('文件过大，请选择小于5MB的图片');
        } else if (status === 400) {
          throw new Error(errorData?.error || '图片格式不支持');
        } else if (status === 401) {
          throw new Error('请先登录');
        } else if (status === 403) {
          // 详细的403错误处理
          if (errorData?.error === '访问令牌无效或已过期') {
            // 清除无效token并要求重新登录
            TokenManager.clearTokens();
            throw new Error('登录已过期，请重新登录');
          } else if (errorData?.error === '用户不存在') {
            TokenManager.clearTokens();
            throw new Error('用户信息无效，请重新登录');
          } else {
            throw new Error(errorData?.error || '无权限上传图片');
          }
        } else if (error.code === 'ECONNABORTED') {
          throw new Error('上传超时，请检查网络连接');
        }
      }

      throw new Error(error instanceof Error ? error.message : '图片上传失败');
    }
  }

  /**
   * 获取完整的图片URL
   * @param imageUrl 服务器返回的相对路径
   * @returns 完整的可访问URL
   */
  static getFullImageUrl(imageUrl: string): string {
    if (!imageUrl) return '';

    // 如果已经是完整URL，直接返回
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }

    // 构建完整URL
    const baseUrl = this.API_BASE_URL.replace(/\/api$/, ''); // 移除 /api 后缀
    return `${baseUrl}${imageUrl}`;
  }

  /**
   * 压缩图片（如果需要）
   * @param file 原始文件
   * @param maxWidth 最大宽度
   * @param maxHeight 最大高度
   * @param quality 图片质量 (0-1)
   * @returns Promise<File> 压缩后的文件
   */
  static async compressImage(
    file: File,
    maxWidth: number = 1200,
    maxHeight: number = 1200,
    quality: number = 0.85
  ): Promise<File> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // 计算新尺寸
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }

        // 设置canvas尺寸
        canvas.width = width;
        canvas.height = height;

        // 绘制压缩后的图片
        ctx?.drawImage(img, 0, 0, width, height);

        // 转换为Blob
        canvas.toBlob((blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now()
            });
            resolve(compressedFile);
          } else {
            reject(new Error('图片压缩失败'));
          }
        }, file.type, quality);
      };

      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * 智能上传（自动压缩大图）
   * @param file 图片文件
   * @returns Promise<UploadResult> 上传结果
   */
  static async smartUpload(file: File): Promise<UploadResult> {
    try {
      // 如果图片超过1MB，先压缩
      if (file.size > 1024 * 1024) {
        logger.info('图片过大，进行压缩', {
          fileName: file.name,
          originalSize: file.size
        });

        const compressedFile = await this.compressImage(file);
        return await this.uploadImage(compressedFile);
      } else {
        return await this.uploadImage(file);
      }
    } catch (error) {
      logger.error('智能上传失败:', error);
      throw error;
    }
  }
}