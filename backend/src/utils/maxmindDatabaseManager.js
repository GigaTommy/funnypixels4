const fs = require('fs');
const path = require('path');
const axios = require('axios');
const logger = require('./logger');

/**
 * MaxMind数据库管理器
 * 负责下载、更新和管理GeoLite2数据库文件
 */
class MaxMindDatabaseManager {
  constructor() {
    // 数据库文件路径配置
    this.dataDir = path.join(__dirname, '../../data/geolocation');
    this.dbPath = path.join(this.dataDir, 'GeoLite2-City.mmdb');

    // P3TERX/GeoLite.mmdb CDN链接 (定期更新)
    this.downloadUrls = [
      // 主要源
      'https://github.com/P3TERX/GeoLite.mmdb/releases/latest/download/GeoLite2-City.mmdb',
      // jsDelivr CDN
      'https://fastly.jsdelivr.net/gh/P3TERX/GeoLite.mmdb@latest/GeoLite2-City.mmdb',
      'https://gcore.jsdelivr.net/gh/P3TERX/GeoLite.mmdb@latest/GeoLite2-City.mmdb',
      // 更多备用源
      'https://cdn.jsdelivr.net/gh/P3TERX/GeoLite.mmdb@latest/GeoLite2-City.mmdb',
      'https://unpkg.com/@p3terx/geolite2-db@latest/GeoLite2-City.mmdb',
      // 原始MaxMind下载源（需要license key，但可以尝试）
      'https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=G7LkC5y2mP1rVt7Y&suffix=tar.gz'
    ];

    // 确保数据目录存在
    this.ensureDataDir();
  }

  /**
   * 确保数据目录存在
   */
  ensureDataDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
      logger.info(`📁 创建数据库目录: ${this.dataDir}`);
    }
  }

  /**
   * 检查数据库文件是否存在且有效
   */
  async isDatabaseValid() {
    try {
      if (!fs.existsSync(this.dbPath)) {
        return false;
      }

      const stats = fs.statSync(this.dbPath);
      const fileSize = stats.size;
      const lastModified = stats.mtime;

      // 文件大小检查 (GeoLite2-City.mmdb 通常 > 50MB)
      if (fileSize < 50 * 1024 * 1024) {
        logger.warn(`⚠️ 数据库文件过小: ${fileSize} bytes (正常应 > 50MB)`);
        return false;
      }

      // 检查文件是否过期 (超过40天需要更新)
      const now = new Date();
      const daysSinceModified = (now - lastModified) / (1000 * 60 * 60 * 24);
      if (daysSinceModified > 40) {
        logger.warn(`⚠️ 数据库文件已过期: ${Math.floor(daysSinceModified)} 天前修改`);
        return false;
      }

      logger.info(`✅ 数据库文件有效: ${fileSize} bytes, ${Math.floor(daysSinceModified)} 天前修改`);
      return true;
    } catch (error) {
      logger.error('❌ 检查数据库文件失败:', error);
      return false;
    }
  }

  /**
   * 下载GeoLite2数据库文件
   */
  async downloadDatabase() {
    logger.info('🔄 开始下载 GeoLite2 数据库...');

    for (let i = 0; i < this.downloadUrls.length; i++) {
      const url = this.downloadUrls[i];
      logger.info(`📥 尝试从源 ${i + 1}/${this.downloadUrls.length} 下载: ${url}`);

      try {
        await this._downloadFromUrl(url);
        logger.info('✅ GeoLite2 数据库下载完成');
        return true;
      } catch (error) {
        logger.warn(`❌ 从源 ${i + 1} 下载失败:`, error.message);
        continue;
      }
    }

    throw new Error('所有下载源都失败了');
  }

  /**
   * 从指定URL下载文件
   */
  async _downloadFromUrl(url) {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      timeout: 300000, // 5分钟超时
      headers: {
        'User-Agent': 'FunnyPixels-Geolocation/1.0'
      }
    });

    const totalSize = parseInt(response.headers['content-length'] || '0');
    let downloadedSize = 0;

    // 创建写入流
    const writer = fs.createWriteStream(this.dbPath);

    // 监听下载进度
    response.data.on('data', (chunk) => {
      downloadedSize += chunk.length;
      if (totalSize > 0) {
        const progress = Math.round((downloadedSize / totalSize) * 100);
        logger.info(`📊 下载进度: ${progress}% (${downloadedSize}/${totalSize} bytes)`);
      }
    });

    // 管道传输
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        logger.info(`✅ 文件写入完成: ${this.dbPath}`);
        resolve();
      });
      writer.on('error', reject);
      response.data.on('error', reject);
    });
  }

  /**
   * 确保数据库可用（如果不存在或无效则下载）
   */
  async ensureDatabase() {
    if (await this.isDatabaseValid()) {
      logger.info('✅ 数据库文件已存在且有效');
      return this.dbPath;
    }

    logger.info('🔄 数据库文件不存在或无效，开始下载...');
    await this.downloadDatabase();

    if (await this.isDatabaseValid()) {
      logger.info('✅ 数据库文件下载并验证成功');
      return this.dbPath;
    } else {
      throw new Error('数据库文件下载后验证失败');
    }
  }

  /**
   * 获取数据库文件路径
   */
  getDatabasePath() {
    return this.dbPath;
  }

  /**
   * 获取数据库文件信息
   */
  getDatabaseInfo() {
    try {
      if (!fs.existsSync(this.dbPath)) {
        return {
          exists: false,
          size: 0,
          lastModified: null,
          path: this.dbPath
        };
      }

      const stats = fs.statSync(this.dbPath);
      return {
        exists: true,
        size: stats.size,
        lastModified: stats.mtime,
        path: this.dbPath,
        sizeFormatted: this._formatBytes(stats.size)
      };
    } catch (error) {
      logger.error('❌ 获取数据库信息失败:', error);
      return {
        exists: false,
        size: 0,
        lastModified: null,
        path: this.dbPath,
        error: error.message
      };
    }
  }

  /**
   * 格式化字节大小
   */
  _formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 手动更新数据库
   */
  async updateDatabase() {
    logger.info('🔄 手动更新 GeoLite2 数据库...');

    // 备份现有文件
    if (fs.existsSync(this.dbPath)) {
      const backupPath = `${this.dbPath}.backup.${Date.now()}`;
      fs.renameSync(this.dbPath, backupPath);
      logger.info(`💾 备份现有数据库到: ${backupPath}`);
    }

    try {
      await this.downloadDatabase();
      if (await this.isDatabaseValid()) {
        logger.info('✅ 数据库更新成功');
        return true;
      } else {
        throw new Error('更新后的数据库验证失败');
      }
    } catch (error) {
      logger.error('❌ 数据库更新失败:', error);
      // 恢复备份（如果存在）
      const backupFiles = fs.readdirSync(this.dataDir)
        .filter(file => file.startsWith('GeoLite2-City.mmdb.backup.'));

      if (backupFiles.length > 0) {
        const latestBackup = backupFiles.sort().pop();
        const backupPath = path.join(this.dataDir, latestBackup);
        fs.copyFileSync(backupPath, this.dbPath);
        logger.info(`🔄 恢复备份文件: ${backupPath}`);
      }

      throw error;
    }
  }
}

module.exports = new MaxMindDatabaseManager();