/**
 * Material存储适配器 - 抽象基类
 * 定义Material文件存储的统一接口
 */

class MaterialStorageAdapter {
  /**
   * 上传Material文件
   * @param {Buffer} buffer - 文件buffer
   * @param {Object} options - 上传选项
   * @param {string} options.fileName - 文件名
   * @param {string} options.variantType - Material变体类型 (sprite_sheet/distance_field/source)
   * @param {string} options.materialId - Material ID
   * @param {string} options.format - 文件格式 (webp/png等)
   * @returns {Promise<{cdnUrl: string, storagePath: string, fileHash: string}>}
   */
  async upload(buffer, options) {
    throw new Error('upload方法必须被子类实现');
  }

  /**
   * 删除Material文件
   * @param {string} storagePath - 存储路径
   * @returns {Promise<boolean>}
   */
  async delete(storagePath) {
    throw new Error('delete方法必须被子类实现');
  }

  /**
   * 获取文件访问URL
   * @param {string} storagePath - 存储路径
   * @returns {string} 可访问的URL
   */
  getUrl(storagePath) {
    throw new Error('getUrl方法必须被子类实现');
  }

  /**
   * 计算文件哈希值
   * @param {Buffer} buffer
   * @returns {string} SHA256哈希
   */
  computeHash(buffer) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }
}

module.exports = MaterialStorageAdapter;
