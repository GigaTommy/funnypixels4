/**
 * CDN存储实现（阿里云OSS / AWS S3 / 腾讯云COS）
 * 用于生产环境，将Material文件上传到云存储并通过CDN加速
 *
 * 配置环境变量：
 * - CDN_PROVIDER: 'aliyun' | 'aws' | 'tencent'
 * - CDN_ACCESS_KEY_ID: 访问密钥ID
 * - CDN_ACCESS_KEY_SECRET: 访问密钥Secret
 * - CDN_BUCKET: 存储桶名称
 * - CDN_REGION: 区域
 * - CDN_DOMAIN: CDN域名（可选，不配置则使用默认域名）
 */

const MaterialStorageAdapter = require('./MaterialStorageAdapter');
const logger = require('../../utils/logger');

class CDNStorage extends MaterialStorageAdapter {
  constructor(config = {}) {
    super();
    this.provider = config.provider || process.env.CDN_PROVIDER || 'aliyun';
    this.accessKeyId = config.accessKeyId || process.env.CDN_ACCESS_KEY_ID;
    this.accessKeySecret = config.accessKeySecret || process.env.CDN_ACCESS_KEY_SECRET;
    this.bucket = config.bucket || process.env.CDN_BUCKET;
    this.region = config.region || process.env.CDN_REGION;
    this.cdnDomain = config.cdnDomain || process.env.CDN_DOMAIN;

    // 验证必需配置
    if (!this.accessKeyId || !this.accessKeySecret || !this.bucket) {
      throw new Error('CDN存储配置不完整，请配置 CDN_ACCESS_KEY_ID, CDN_ACCESS_KEY_SECRET, CDN_BUCKET');
    }

    // 初始化CDN客户端
    this.client = this._initClient();
  }

  /**
   * 初始化CDN客户端
   */
  _initClient() {
    switch (this.provider) {
    case 'aliyun':
      return this._initAliyunOSS();
    case 'aws':
      return this._initAWSS3();
    case 'tencent':
      return this._initTencentCOS();
    default:
      throw new Error(`不支持的CDN提供商: ${this.provider}`);
    }
  }

  /**
   * 初始化阿里云OSS客户端
   */
  _initAliyunOSS() {
    try {
      const OSS = require('ali-oss');
      return new OSS({
        accessKeyId: this.accessKeyId,
        accessKeySecret: this.accessKeySecret,
        bucket: this.bucket,
        region: this.region
      });
    } catch (error) {
      logger.error('❌ 初始化阿里云OSS失败，请安装依赖: npm install ali-oss');
      throw error;
    }
  }

  /**
   * 初始化AWS S3客户端
   */
  _initAWSS3() {
    try {
      const { S3Client } = require('@aws-sdk/client-s3');
      return new S3Client({
        region: this.region,
        credentials: {
          accessKeyId: this.accessKeyId,
          secretAccessKey: this.accessKeySecret
        }
      });
    } catch (error) {
      logger.error('❌ 初始化AWS S3失败，请安装依赖: npm install @aws-sdk/client-s3');
      throw error;
    }
  }

  /**
   * 初始化腾讯云COS客户端
   */
  _initTencentCOS() {
    try {
      const COS = require('cos-nodejs-sdk-v5');
      return new COS({
        SecretId: this.accessKeyId,
        SecretKey: this.accessKeySecret
      });
    } catch (error) {
      logger.error('❌ 初始化腾讯云COS失败，请安装依赖: npm install cos-nodejs-sdk-v5');
      throw error;
    }
  }

  /**
   * 上传文件到CDN
   */
  async upload(buffer, options) {
    const { fileName, variantType, materialId, format } = options;

    // 构建存储路径
    const materialIdPrefix = materialId.substring(0, 2);
    const materialIdSuffix = materialId.substring(2, 4);
    const storagePath = `materials/${variantType}/${materialIdPrefix}/${materialIdSuffix}/${fileName}`;

    // 计算文件哈希
    const fileHash = this.computeHash(buffer);

    // 根据不同提供商上传
    let cdnUrl;
    switch (this.provider) {
    case 'aliyun':
      cdnUrl = await this._uploadToAliyun(storagePath, buffer);
      break;
    case 'aws':
      cdnUrl = await this._uploadToAWS(storagePath, buffer);
      break;
    case 'tencent':
      cdnUrl = await this._uploadToTencent(storagePath, buffer);
      break;
    default:
      throw new Error(`不支持的CDN提供商: ${this.provider}`);
    }

    logger.info(`✅ CDN文件已上传: ${cdnUrl}`);

    return {
      cdnUrl,
      storagePath,
      fileHash
    };
  }

  /**
   * 上传到阿里云OSS
   */
  async _uploadToAliyun(objectName, buffer) {
    const result = await this.client.put(objectName, buffer);
    // 如果配置了CDN域名，使用CDN域名，否则使用OSS默认域名
    if (this.cdnDomain) {
      return `https://${this.cdnDomain}/${objectName}`;
    }
    return result.url;
  }

  /**
   * 上传到AWS S3
   */
  async _uploadToAWS(key, buffer) {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer
    });
    await this.client.send(command);

    // 如果配置了CDN域名，使用CDN域名，否则使用S3默认域名
    if (this.cdnDomain) {
      return `https://${this.cdnDomain}/${key}`;
    }
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  /**
   * 上传到腾讯云COS
   */
  async _uploadToTencent(key, buffer) {
    return new Promise((resolve, reject) => {
      this.client.putObject({
        Bucket: this.bucket,
        Region: this.region,
        Key: key,
        Body: buffer
      }, (err, data) => {
        if (err) {
          reject(err);
        } else {
          // 如果配置了CDN域名，使用CDN域名，否则使用COS默认域名
          if (this.cdnDomain) {
            resolve(`https://${this.cdnDomain}/${key}`);
          } else {
            resolve(`https://${this.bucket}.cos.${this.region}.myqcloud.com/${key}`);
          }
        }
      });
    });
  }

  /**
   * 从CDN删除文件
   */
  async delete(storagePath) {
    try {
      switch (this.provider) {
      case 'aliyun':
        await this.client.delete(storagePath);
        break;
      case 'aws':
        const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
        const deleteCommand = new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: storagePath
        });
        await this.client.send(deleteCommand);
        break;
      case 'tencent':
        await new Promise((resolve, reject) => {
          this.client.deleteObject({
            Bucket: this.bucket,
            Region: this.region,
            Key: storagePath
          }, (err, data) => {
            if (err) reject(err);
            else resolve(data);
          });
        });
        break;
      }
      logger.info(`✅ CDN文件已删除: ${storagePath}`);
      return true;
    } catch (error) {
      logger.error(`❌ 删除CDN文件失败: ${storagePath}`, error);
      throw error;
    }
  }

  /**
   * 获取文件访问URL
   */
  getUrl(storagePath) {
    if (this.cdnDomain) {
      return `https://${this.cdnDomain}/${storagePath}`;
    }

    // 返回默认域名
    switch (this.provider) {
    case 'aliyun':
      return `https://${this.bucket}.${this.region}.aliyuncs.com/${storagePath}`;
    case 'aws':
      return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${storagePath}`;
    case 'tencent':
      return `https://${this.bucket}.cos.${this.region}.myqcloud.com/${storagePath}`;
    default:
      throw new Error(`不支持的CDN提供商: ${this.provider}`);
    }
  }
}

module.exports = CDNStorage;
