/**
 * Material存储工厂
 * 根据环境自动选择存储实现：
 * - 开发环境：LocalFileStorage（本地文件系统）
 * - 生产环境：CDNStorage（云存储CDN）
 */

const path = require('path');
const LocalFileStorage = require('./LocalFileStorage');
const CDNStorage = require('./CDNStorage');
const logger = require('../../utils/logger');
const { getBaseURL } = require('../../config/urlConfig');

let storageInstance = null;

/**
 * 获取Material存储实例（单例模式）
 */
function getMaterialStorage() {
  if (storageInstance) {
    return storageInstance;
  }

  const env = process.env.NODE_ENV || 'development';
  const useLocalStorage = process.env.USE_LOCAL_STORAGE === 'true';

  // 开发环境 或 明确配置使用本地存储
  if (env === 'development' || useLocalStorage) {
    logger.info('🔧 使用本地文件系统存储 Material');

    // ✅ 修复：确保baseDir指向public目录
    let baseDir = undefined;
    if (process.env.UPLOAD_DIR) {
      baseDir = path.isAbsolute(process.env.UPLOAD_DIR)
        ? path.join(process.env.UPLOAD_DIR, 'materials')
        : path.join(__dirname, '../../../', process.env.UPLOAD_DIR, 'materials');
    } else {
      // 默认路径：backend/public/uploads/materials
      baseDir = path.join(__dirname, '../../public/uploads/materials');
    }

    // 🔧 使用智能 URL 配置，自动适配开发/生产环境
    storageInstance = new LocalFileStorage({
      baseDir,
      baseUrl: getBaseURL() // 自动根据环境获取正确的 baseUrl
    });

    logger.info(`📦 Material Storage baseUrl: ${getBaseURL()}`);
  } else {
    // 生产环境使用CDN
    logger.info('🌐 使用CDN存储 Material');
    storageInstance = new CDNStorage({
      provider: process.env.CDN_PROVIDER,
      accessKeyId: process.env.CDN_ACCESS_KEY_ID,
      accessKeySecret: process.env.CDN_ACCESS_KEY_SECRET,
      bucket: process.env.CDN_BUCKET,
      region: process.env.CDN_REGION,
      cdnDomain: process.env.CDN_DOMAIN
    });
  }

  return storageInstance;
}

/**
 * 重置存储实例（用于测试）
 */
function resetMaterialStorage() {
  storageInstance = null;
}

module.exports = {
  getMaterialStorage,
  resetMaterialStorage,
  LocalFileStorage,
  CDNStorage
};
