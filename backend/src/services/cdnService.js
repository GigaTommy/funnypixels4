/**
 * CDN服务
 * 支持多种存储后端：
 * - local: 本地文件系统（开发环境）
 * - s3: AWS S3（生产环境）
 * - oss: 阿里云OSS（生产环境）
 */

const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  HeadBucketCommand,
  CopyObjectCommand,
  ListObjectsV2Command
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class CDNService {
  constructor() {
    // 读取provider配置，默认开发环境使用local
    this.provider = process.env.CDN_PROVIDER || 'local';

    this.config = {
      region: process.env.AWS_REGION || 'us-east-1',
      bucket: process.env.CDN_BUCKET || 'funnypixels-patterns',
      baseUrl: process.env.CDN_BASE_URL || (this.provider === 'local' ? 'http://localhost:3001/uploads' : 'https://cdn.funnypixels.com'),
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      // 本地存储路径
      localStoragePath: process.env.CDN_LOCAL_PATH || path.join(__dirname, '../../uploads/patterns')
    };

    // 缓存配置
    this.cacheConfig = {
      maxAge: 365 * 24 * 60 * 60, // 1年
      public: true,
      immutable: true
    };

    // 根据provider初始化客户端
    this.initClient();
  }

  /**
   * 初始化存储客户端
   */
  initClient() {
    if (this.provider === 'local') {
      logger.info(`📁 CDN使用本地存储: ${this.config.localStoragePath}`);
      // 确保本地存储目录存在
      this.ensureLocalDir();
    } else if (this.provider === 's3') {
      logger.info(`☁️ CDN使用AWS S3: ${this.config.bucket}`);
      this.s3 = new S3Client({
        region: this.config.region,
        credentials: {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey
        }
      });
    } else if (this.provider === 'oss') {
      logger.info(`☁️ CDN使用阿里云OSS: ${this.config.bucket}`);
      // TODO: 初始化OSS客户端
      const OSS = require('ali-oss');
      this.ossClient = new OSS({
        region: process.env.OSS_REGION || 'oss-cn-shanghai',
        accessKeyId: process.env.OSS_ACCESS_KEY_ID,
        accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
        bucket: this.config.bucket
      });
    }
  }

  /**
   * 确保本地存储目录存在
   */
  async ensureLocalDir() {
    try {
      await fs.mkdir(this.config.localStoragePath, { recursive: true });
    } catch (error) {
      logger.error('创建本地存储目录失败:', error);
    }
  }

  /**
   * 上传文件到CDN
   * @param {string} key - 文件键
   * @param {string|Buffer} data - 文件数据
   * @param {Object} options - 上传选项
   * @returns {Object} 上传结果
   */
  async upload(key, data, options = {}) {
    try {
      const {
        contentType = 'image/webp',
        cacheControl = `public, max-age=${this.cacheConfig.maxAge}, immutable`,
        metadata = {}
      } = options;

      const buffer = this.prepareData(data);

      // 根据provider选择不同的上传方式
      if (this.provider === 'local') {
        return await this.uploadToLocal(key, buffer, options);
      } else if (this.provider === 's3') {
        return await this.uploadToS3(key, buffer, options);
      } else if (this.provider === 'oss') {
        return await this.uploadToOSS(key, buffer, options);
      }

      throw new Error(`不支持的CDN provider: ${this.provider}`);

    } catch (error) {
      logger.error(`❌ CDN上传失败: ${key}`, { error: error.message });
      throw error;
    }
  }

  /**
   * 上传到本地文件系统（开发环境）
   */
  async uploadToLocal(key, buffer, options = {}) {
    // 确保key不包含重复的patterns前缀
    let normalizedKey = key;
    if (key.startsWith('patterns/') && this.config.localStoragePath.endsWith('/patterns')) {
      normalizedKey = key.substring('patterns/'.length);
      logger.debug(`🔧 修正重复路径: ${key} -> ${normalizedKey}`);
    }

    const filePath = path.join(this.config.localStoragePath, normalizedKey);
    const dir = path.dirname(filePath);

    // 确保目录存在
    await fs.mkdir(dir, { recursive: true });

    // 写入文件
    await fs.writeFile(filePath, buffer);

    // 生成本地访问URL - 使用原始key保持URL一致性
    const url = `${this.config.baseUrl}/${key.replace(/\\/g, '/')}`;

    logger.info(`📁 本地存储成功: ${key} -> ${url}`);
    logger.debug(`📁 文件路径: ${filePath}`);

    return {
      success: true,
      key,
      url,
      etag: null,
      size: buffer.length
    };
  }

  /**
   * 上传到AWS S3（生产环境）
   */
  async uploadToS3(key, buffer, options = {}) {
    const {
      contentType = 'image/webp',
      cacheControl = `public, max-age=${this.cacheConfig.maxAge}, immutable`,
      metadata = {}
    } = options;

    // 准备上传参数
    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: cacheControl,
      Metadata: {
        ...metadata,
        uploadedAt: new Date().toISOString(),
        service: 'funnypixels-pattern-storage'
      },
      ACL: 'public-read'
    });

    // 执行上传
    const result = await this.s3.send(command);

    const url = `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com/${key}`;

    logger.info(`☁️ S3上传成功: ${key} -> ${url}`);

    return {
      success: true,
      key,
      url,
      etag: result.ETag,
      size: buffer.length
    };
  }

  /**
   * 上传到阿里云OSS（生产环境）
   */
  async uploadToOSS(key, buffer, options = {}) {
    const {
      contentType = 'image/webp',
      cacheControl = `public, max-age=${this.cacheConfig.maxAge}, immutable`
    } = options;

    const result = await this.ossClient.put(key, buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': cacheControl
      }
    });

    // 生成CDN URL
    const url = `${this.config.baseUrl}/${key}`;

    logger.info(`☁️ OSS上传成功: ${key} -> ${url}`);

    return {
      success: true,
      key,
      url,
      etag: result.etag,
      size: buffer.length
    };
  }

  /**
   * 上传自定义旗帜（包含缩略图生成）
   * @param {Object} options
   * @param {string|Buffer} options.data - 原始图片数据（base64或Buffer）
   * @param {string} options.orderId - 订单ID
   * @param {string} options.userId - 用户ID
   * @returns {Promise<{cdnUrl, storagePath, hash, size, thumbnailBase64}>}
   */
  async uploadCustomFlag({ data, orderId, userId }) {
    try {
      const crypto = require('crypto');
      const sharp = require('sharp');

      // 1. 准备原始数据
      const buffer = this.prepareData(data);

      // 2. 计算哈希值（用于去重和分片存储）
      const hash = crypto.createHash('sha256').update(buffer).digest('hex');

      // 3. 生成存储路径（哈希分片）
      const subDir1 = hash.substring(0, 2);
      const subDir2 = hash.substring(2, 4);
      const filename = `${hash.substring(4, 20)}.webp`; // 截取部分hash作为文件名
      const key = `patterns/${subDir1}/${subDir2}/${filename}`;

      // 4. 生成高清版（32×32 WebP，质量70，针对巨量渲染优化）
      const highResBuffer = await sharp(buffer)
        .resize(32, 32, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .webp({
          quality: 70,
          effort: 6,
          smartSubsample: true,
          nearLossless: false
        })
        .toBuffer();

      // 5. 生成缩略图（12×12 WebP base64，用于payload降级）
      const thumbnailBuffer = await sharp(buffer)
        .resize(12, 12, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .webp({
          quality: 60,
          effort: 4,
          smartSubsample: true
        })
        .toBuffer();

      const thumbnailBase64 = `data:image/webp;base64,${thumbnailBuffer.toString('base64')}`;

      // 6. 上传高清版到CDN
      const uploadResult = await this.upload(key, highResBuffer, {
        contentType: 'image/webp',
        metadata: {
          orderId,
          userId,
          type: 'custom_flag'
        }
      });

      logger.info(`✅ 自定义旗帜上传成功: ${orderId}`, {
        cdnUrl: uploadResult.url,
        size: uploadResult.size,
        thumbnailSize: thumbnailBuffer.length
      });

      return {
        cdnUrl: uploadResult.url,
        storagePath: key,
        hash,
        size: uploadResult.size,
        thumbnailBase64
      };

    } catch (error) {
      logger.error('自定义旗帜上传失败:', error);
      throw new Error(`自定义旗帜上传失败: ${error.message}`);
    }
  }

  /**
   * 批量上传文件
   * @param {Array} files - 文件数组
   * @param {Object} options - 上传选项
   * @returns {Array} 上传结果
   */
  async batchUpload(files, options = {}) {
    const results = [];
    const { concurrency = 5 } = options;

    try {
      // 分批处理
      for (let i = 0; i < files.length; i += concurrency) {
        const batch = files.slice(i, i + concurrency);

        const batchPromises = batch.map(async (file) => {
          try {
            const result = await this.upload(file.key, file.data, file.options);
            return { success: true, result };
          } catch (error) {
            return { success: false, error: error.message, key: file.key };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;

      logger.info(`☁️ CDN批量上传完成: 成功${successCount}个, 失败${failureCount}个`);

      return results;

    } catch (error) {
      logger.error('CDN批量上传失败:', error);
      throw error;
    }
  }

  /**
   * 删除CDN文件
   * @param {string} key - 文件键
   * @returns {Object} 删除结果
   */
  async delete(key) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: key
      });

      await this.s3.send(command);

      logger.info(`🗑️ CDN删除成功: ${key}`);

      return {
        success: true,
        key
      };

    } catch (error) {
      logger.error(`❌ CDN删除失败: ${key}`, { error: error.message });
      throw error;
    }
  }

  /**
   * 批量删除CDN文件
   * @param {Array} keys - 文件键数组
   * @returns {Object} 删除结果
   */
  async batchDelete(keys) {
    try {
      if (keys.length === 0) {
        return { success: true, deleted: 0 };
      }

      const command = new DeleteObjectsCommand({
        Bucket: this.config.bucket,
        Delete: {
          Objects: keys.map(key => ({ Key: key }))
        }
      });

      const result = await this.s3.send(command);

      const deletedCount = result.Deleted ? result.Deleted.length : 0;
      const errorCount = result.Errors ? result.Errors.length : 0;

      logger.info(`🗑️ CDN批量删除完成: 成功${deletedCount}个, 失败${errorCount}个`);

      return {
        success: true,
        deleted: deletedCount,
        errors: errorCount,
        details: result
      };

    } catch (error) {
      logger.error('CDN批量删除失败:', error);
      throw error;
    }
  }

  /**
   * 检查文件是否存在
   * @param {string} key - 文件键
   * @returns {boolean} 是否存在
   */
  async exists(key) {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.config.bucket,
        Key: key
      });

      await this.s3.send(command);
      return true;

    } catch (error) {
      if (error.name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * 获取文件信息
   * @param {string} key - 文件键
   * @returns {Object} 文件信息
   */
  async getFileInfo(key) {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.config.bucket,
        Key: key
      });

      const result = await this.s3.send(command);

      return {
        key,
        size: result.ContentLength,
        lastModified: result.LastModified,
        etag: result.ETag,
        contentType: result.ContentType,
        metadata: result.Metadata
      };

    } catch (error) {
      if (error.name === 'NotFound') {
        return null;
      }
      throw error;
    }
  }

  /**
   * 生成预签名URL
   * @param {string} key - 文件键
   * @param {Object} options - 选项
   * @returns {string} 预签名URL
   */
  async generatePresignedUrl(key, options = {}) {
    try {
      const {
        expires = 3600 // 1小时
      } = options;

      const command = new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key
      });

      const url = await getSignedUrl(this.s3, command, { expiresIn: expires });

      return url;

    } catch (error) {
      logger.error(`预签名URL生成失败: ${key}`, error);
      throw error;
    }
  }

  /**
   * 生成上传用的预签名URL (PUT)
   * @param {string} key - 文件键
   * @param {Object} options - 选项
   * @returns {Object} 预签名上传信息 { url, key, method, headers }
   */
  async generatePresignedUploadUrl(key, options = {}) {
    try {
      const {
        expires = 3600, // 1小时
        contentType = 'image/webp',
        metadata = {}
      } = options;

      const command = new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        ContentType: contentType,
        Metadata: metadata
      });

      const url = await getSignedUrl(this.s3, command, { expiresIn: expires });

      return {
        url,
        key,
        method: 'PUT',
        headers: {
          'Content-Type': contentType
        }
      };

    } catch (error) {
      logger.error(`预签名上传URL生成失败: ${key}`, error);
      throw error;
    }
  }

  /**
   * 获取文件列表
   * @param {string} prefix - 前缀
   * @param {Object} options - 选项
   * @returns {Array} 文件列表
   */
  async listFiles(prefix = '', options = {}) {
    try {
      const {
        maxKeys = 1000,
        delimiter = '/'
      } = options;

      const command = new ListObjectsV2Command({
        Bucket: this.config.bucket,
        Prefix: prefix,
        MaxKeys: maxKeys,
        Delimiter: delimiter
      });

      const result = await this.s3.send(command);

      return {
        files: result.Contents || [],
        folders: result.CommonPrefixes || [],
        isTruncated: result.IsTruncated,
        nextContinuationToken: result.NextContinuationToken
      };

    } catch (error) {
      logger.error('文件列表获取失败:', error);
      throw error;
    }
  }

  /**
   * 复制文件
   * @param {string} sourceKey - 源文件键
   * @param {string} destKey - 目标文件键
   * @param {Object} options - 选项
   * @returns {Object} 复制结果
   */
  async copyFile(sourceKey, destKey, options = {}) {
    try {
      const command = new CopyObjectCommand({
        Bucket: this.config.bucket,
        CopySource: `${this.config.bucket}/${sourceKey}`,
        Key: destKey,
        MetadataDirective: 'COPY'
      });

      const result = await this.s3.send(command);

      logger.info(`📋 CDN复制成功: ${sourceKey} -> ${destKey}`);

      return {
        success: true,
        sourceKey,
        destKey,
        etag: result.CopyObjectResult?.ETag
      };

    } catch (error) {
      logger.error(`❌ CDN复制失败: ${sourceKey} -> ${destKey}`, { error: error.message });
      throw error;
    }
  }

  /**
   * 获取存储统计
   * @param {string} prefix - 前缀
   * @returns {Object} 存储统计
   */
  async getStorageStats(prefix = '') {
    try {
      let totalSize = 0;
      let fileCount = 0;
      let continuationToken = null;

      do {
        const command = new ListObjectsV2Command({
          Bucket: this.config.bucket,
          Prefix: prefix,
          MaxKeys: 1000
        });

        if (continuationToken) {
          command.input.ContinuationToken = continuationToken;
        }

        const result = await this.s3.send(command);

        if (result.Contents) {
          for (const file of result.Contents) {
            totalSize += file.Size;
            fileCount++;
          }
        }

        continuationToken = result.NextContinuationToken;

      } while (continuationToken);

      return {
        totalSize,
        fileCount,
        averageSize: fileCount > 0 ? totalSize / fileCount : 0,
        prefix
      };

    } catch (error) {
      logger.error('存储统计获取失败:', error);
      throw error;
    }
  }

  /**
   * 清理过期文件
   * @param {string} prefix - 前缀
   * @param {number} maxAge - 最大年龄（秒）
   * @returns {Object} 清理结果
   */
  async cleanupExpiredFiles(prefix = '', maxAge = 30 * 24 * 60 * 60) { // 30天
    try {
      const cutoffDate = new Date(Date.now() - maxAge * 1000);
      const expiredKeys = [];

      let continuationToken = null;

      do {
        const command = new ListObjectsV2Command({
          Bucket: this.config.bucket,
          Prefix: prefix,
          MaxKeys: 1000
        });

        if (continuationToken) {
          command.input.ContinuationToken = continuationToken;
        }

        const result = await this.s3.send(command);

        if (result.Contents) {
          for (const file of result.Contents) {
            if (file.LastModified < cutoffDate) {
              expiredKeys.push(file.Key);
            }
          }
        }

        continuationToken = result.NextContinuationToken;

      } while (continuationToken);

      if (expiredKeys.length > 0) {
        const deleteResult = await this.batchDelete(expiredKeys);

        logger.info(`🧹 清理过期文件完成: ${expiredKeys.length}个文件`);

        return {
          success: true,
          deleted: deleteResult.deleted,
          errors: deleteResult.errors
        };
      }

      return {
        success: true,
        deleted: 0,
        errors: 0
      };

    } catch (error) {
      logger.error('清理过期文件失败:', error);
      throw error;
    }
  }

  /**
   * 准备数据
   * @param {string|Buffer} data - 原始数据
   * @returns {Buffer} 处理后的数据
   */
  prepareData(data) {
    if (Buffer.isBuffer(data)) {
      return data;
    }

    if (typeof data === 'string') {
      // 如果是Base64字符串，转换为Buffer
      if (data.startsWith('data:')) {
        const base64Data = data.split(',')[1];
        return Buffer.from(base64Data, 'base64');
      }

      // 如果是普通字符串，转换为Buffer
      return Buffer.from(data, 'utf8');
    }

    throw new Error('不支持的数据类型');
  }

  /**
   * 获取数据大小
   * @param {string|Buffer} data - 数据
   * @returns {number} 数据大小
   */
  getDataSize(data) {
    if (Buffer.isBuffer(data)) {
      return data.length;
    }

    if (typeof data === 'string') {
      if (data.startsWith('data:')) {
        const base64Data = data.split(',')[1];
        return Buffer.byteLength(base64Data, 'base64');
      }

      return Buffer.byteLength(data, 'utf8');
    }

    return 0;
  }

  /**
   * 生成CDN URL
   * @param {string} key - 文件键
   * @returns {string} CDN URL
   */
  generateUrl(key) {
    return `${this.config.baseUrl}/${key}`;
  }

  /**
   * 验证CDN配置
   * @returns {boolean} 配置是否有效
   */
  validateConfig() {
    const required = ['region', 'bucket', 'accessKeyId', 'secretAccessKey'];

    for (const field of required) {
      if (!this.config[field]) {
        logger.error(`CDN配置缺失: ${field}`);
        return false;
      }
    }

    return true;
  }

  /**
   * 删除单个文件
   * @param {string} key - 文件键
   * @returns {boolean} 删除是否成功
   */
  async deleteFile(key) {
    try {
      if (this.provider === 'local') {
        // 本地文件删除
        const fs = require('fs').promises;
        const path = require('path');
        const fullPath = path.join(this.config.localStoragePath, key);

        try {
          await fs.unlink(fullPath);
          logger.info(`🗑️ 本地文件删除成功: ${key}`);
          return true;
        } catch (error) {
          logger.warn(`⚠️ 本地文件删除失败: ${key}`, error.message);
          return false;
        }
      } else if (this.provider === 's3') {
        // S3删除
        const command = new DeleteObjectCommand({
          Bucket: this.config.bucket,
          Key: key
        });
        await this.s3.send(command);

        logger.info(`🗑️ S3文件删除成功: ${key}`);
        return true;
      } else if (this.provider === 'oss') {
        // OSS删除
        await this.ossClient.delete(key);
        logger.info(`🗑️ OSS文件删除成功: ${key}`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`❌ 文件删除失败: ${key}`, error);
      return false;
    }
  }

  /**
   * 测试CDN连接
   * @returns {boolean} 连接是否正常
   */
  async testConnection() {
    try {
      if (!this.validateConfig()) {
        return false;
      }

      if (this.provider === 'local') {
        // 本地模式：检查目录是否可写
        const fs = require('fs').promises;
        await fs.access(this.config.localStoragePath, fs.constants.W_OK);
        logger.info('✅ 本地存储连接测试成功');
        return true;
      } else if (this.provider === 's3') {
        // S3模式：尝试列出存储桶
        const command = new HeadBucketCommand({ Bucket: this.config.bucket });
        await this.s3.send(command);
        logger.info('✅ S3连接测试成功');
        return true;
      } else if (this.provider === 'oss') {
        // OSS模式：测试存储桶
        await this.ossClient.headBucket(this.config.bucket);
        logger.info('✅ OSS连接测试成功');
        return true;
      }

      return false;
    } catch (error) {
      logger.error('❌ CDN连接测试失败:', error);
      return false;
    }
  }
}

module.exports = CDNService;
