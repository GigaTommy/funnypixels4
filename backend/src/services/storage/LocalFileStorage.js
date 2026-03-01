/**
 * 本地文件系统存储实现
 * 用于开发环境，将Material文件存储到本地文件系统
 */

const fs = require('fs').promises;
const path = require('path');
const MaterialStorageAdapter = require('./MaterialStorageAdapter');
const logger = require('../../utils/logger');
const { getBaseURL } = require('../../config/urlConfig');

class LocalFileStorage extends MaterialStorageAdapter {
  constructor(config = {}) {
    super();
    // 默认配置 - 指向public目录
    this.baseDir = config.baseDir || path.join(__dirname, '../../public/uploads/materials');

    // 🔧 智能获取 baseUrl：优先使用传入的配置，然后使用 urlConfig，最后 fallback 到环境变量
    this.baseUrl = config.baseUrl || getBaseURL();

    this.urlPrefix = '/uploads/materials';

    logger.debug(`📁 LocalFileStorage initialized: baseUrl=${this.baseUrl}, baseDir=${this.baseDir}`);
  }

  /**
   * 上传文件到本地文件系统
   */
  async upload(buffer, options) {
    const { fileName, variantType, materialId, format } = options;

    // 构建存储路径：materials/{variantType}/{materialId首2字符}/{materialId第3-4字符}/{fileName}
    // 例如：materials/sprite_sheet/ab/cd/abcd1234-5678-90ef-ghij-klmnopqrstuv.webp
    const materialIdPrefix = materialId.substring(0, 2);
    const materialIdSuffix = materialId.substring(2, 4);
    const relativePath = path.join(variantType, materialIdPrefix, materialIdSuffix, fileName);
    const storagePath = `materials/${variantType}/${materialIdPrefix}/${materialIdSuffix}/${fileName}`;
    const fullPath = path.join(this.baseDir, variantType, materialIdPrefix, materialIdSuffix, fileName);

    // 确保目录存在
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });

    // 写入文件
    await fs.writeFile(fullPath, buffer);

    // ✅ 生成相对路径（不包含IP，避免IP变更后需要更新数据库）
    // 格式: /uploads/materials/avatars/.../avatar.png
    const cdnUrl = `${this.urlPrefix}/${variantType}/${materialIdPrefix}/${materialIdSuffix}/${fileName}`;

    // 计算文件哈希
    const fileHash = this.computeHash(buffer);

    logger.info(`✅ 本地文件已保存: ${storagePath} (相对路径: ${cdnUrl})`);

    return {
      cdnUrl,  // ✅ 相对路径，运行时动态构建完整URL
      storagePath,
      fileHash
    };
  }

  /**
   * 删除本地文件
   */
  async delete(storagePath) {
    try {
      // storagePath格式：materials/sprite_sheet/ab/cd/filename.webp
      const fullPath = path.join(this.baseDir, storagePath.replace('materials/', ''));
      await fs.unlink(fullPath);
      logger.info(`✅ 本地文件已删除: ${storagePath}`);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.warn(`⚠️ 文件不存在: ${storagePath}`);
        return true; // 文件不存在也视为删除成功
      }
      logger.error(`❌ 删除文件失败: ${storagePath}`, error);
      throw error;
    }
  }

  /**
   * 获取文件访问URL
   */
  getUrl(storagePath) {
    // storagePath格式：materials/sprite_sheet/ab/cd/filename.webp
    const relativePath = storagePath.replace('materials/', '');
    return `${this.baseUrl}${this.urlPrefix}/${relativePath}`;
  }
}

module.exports = LocalFileStorage;
