#!/usr/bin/env node

/**
 * 像素历史数据归档脚本
 * 将旧数据归档到对象存储（S3/OSS）
 * 
 * 使用方法:
 * node scripts/archive-pixels-history.js archive 2024-12-01
 * node scripts/archive-pixels-history.js restore 2024-12-01
 * node scripts/archive-pixels-history.js list-archives
 */

const { db } = require('../src/config/database');
const fs = require('fs').promises;
const path = require('path');
const { createReadStream, createWriteStream } = require('fs');
const { pipeline } = require('stream/promises');
const zlib = require('zlib');

class PixelsHistoryArchiver {
  constructor() {
    this.tableName = 'pixels_history';
    this.archiveDir = path.join(__dirname, '../data-export');
    this.batchSize = 10000; // 批量处理大小
  }

  /**
   * 归档指定日期之前的数据
   * @param {string} archiveDateStr - 归档日期字符串 (YYYY-MM-DD)
   * @param {Object} options - 选项
   */
  async archiveData(archiveDateStr, options = {}) {
    try {
      console.log(`📦 开始归档数据: ${archiveDateStr}`);
      
      const archiveDate = new Date(archiveDateStr);
      if (isNaN(archiveDate.getTime())) {
        throw new Error('无效的日期格式，请使用 YYYY-MM-DD 格式');
      }

      // 确保归档目录存在
      await this.ensureArchiveDir();

      // 获取需要归档的数据
      const totalCount = await db(this.tableName)
        .where('history_date', '<', archiveDate)
        .count('* as count')
        .first();

      console.log(`📊 需要归档的记录数: ${totalCount.count}`);

      if (totalCount.count === 0) {
        console.log('✅ 没有需要归档的数据');
        return;
      }

      // 分批归档数据
      let archivedCount = 0;
      let batchNumber = 1;
      const archiveFiles = [];

      while (archivedCount < totalCount.count) {
        console.log(`📦 处理批次 ${batchNumber}...`);
        
        const batch = await db(this.tableName)
          .where('history_date', '<', archiveDate)
          .orderBy('id')
          .limit(this.batchSize)
          .select('*');

        if (batch.length === 0) {
          break;
        }

        // 生成归档文件名
        const archiveFileName = `pixels_history_archive_${archiveDateStr}_batch_${batchNumber}.json.gz`;
        const archiveFilePath = path.join(this.archiveDir, archiveFileName);

        // 写入归档文件
        await this.writeArchiveFile(archiveFilePath, batch);
        archiveFiles.push(archiveFileName);

        // 删除已归档的数据
        const ids = batch.map(record => record.id);
        await db(this.tableName)
          .whereIn('id', ids)
          .del();

        archivedCount += batch.length;
        batchNumber++;

        console.log(`✅ 批次 ${batchNumber - 1} 完成，已归档 ${archivedCount}/${totalCount.count} 条记录`);
      }

      // 创建归档清单
      const manifest = {
        archiveDate: archiveDateStr,
        totalRecords: archivedCount,
        batchCount: batchNumber - 1,
        archiveFiles: archiveFiles,
        createdAt: new Date().toISOString(),
        version: '1.0'
      };

      const manifestPath = path.join(this.archiveDir, `pixels_history_manifest_${archiveDateStr}.json`);
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

      console.log(`✅ 归档完成！`);
      console.log(`📁 归档文件: ${archiveFiles.length} 个`);
      console.log(`📋 清单文件: ${path.basename(manifestPath)}`);
      console.log(`💾 总记录数: ${archivedCount}`);

    } catch (error) {
      console.error('❌ 归档数据时发生错误:', error.message);
      throw error;
    }
  }

  /**
   * 从归档文件恢复数据
   * @param {string} archiveDateStr - 归档日期字符串
   * @param {Object} options - 选项
   */
  async restoreData(archiveDateStr, options = {}) {
    try {
      console.log(`🔄 开始恢复数据: ${archiveDateStr}`);
      
      // 查找归档清单
      const manifestPath = path.join(this.archiveDir, `pixels_history_manifest_${archiveDateStr}.json`);
      
      try {
        await fs.access(manifestPath);
      } catch (error) {
        throw new Error(`找不到归档清单文件: ${manifestPath}`);
      }

      const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
      console.log(`📋 找到归档清单: ${manifest.totalRecords} 条记录，${manifest.batchCount} 个批次`);

      let restoredCount = 0;

      // 恢复每个批次
      for (let i = 0; i < manifest.archiveFiles.length; i++) {
        const archiveFile = manifest.archiveFiles[i];
        const archiveFilePath = path.join(this.archiveDir, archiveFile);
        
        console.log(`🔄 恢复批次 ${i + 1}/${manifest.batchCount}: ${archiveFile}`);

        // 读取归档文件
        const batch = await this.readArchiveFile(archiveFilePath);
        
        // 插入数据
        const chunks = this.chunkArray(batch, this.batchSize);
        for (const chunk of chunks) {
          await db(this.tableName).insert(chunk);
        }

        restoredCount += batch.length;
        console.log(`✅ 批次 ${i + 1} 恢复完成，已恢复 ${restoredCount}/${manifest.totalRecords} 条记录`);
      }

      console.log(`✅ 数据恢复完成！总共恢复 ${restoredCount} 条记录`);

    } catch (error) {
      console.error('❌ 恢复数据时发生错误:', error.message);
      throw error;
    }
  }

  /**
   * 列出所有归档文件
   */
  async listArchives() {
    try {
      console.log('📋 归档文件列表');
      console.log('='.repeat(50));

      // 确保归档目录存在
      await this.ensureArchiveDir();

      // 读取目录中的所有文件
      const files = await fs.readdir(this.archiveDir);
      
      // 过滤出归档相关文件
      const manifestFiles = files.filter(file => file.startsWith('pixels_history_manifest_'));
      const archiveFiles = files.filter(file => file.startsWith('pixels_history_archive_'));

      if (manifestFiles.length === 0) {
        console.log('📭 没有找到归档文件');
        return;
      }

      // 显示归档清单
      for (const manifestFile of manifestFiles) {
        const manifestPath = path.join(this.archiveDir, manifestFile);
        const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
        
        console.log(`\n📦 归档: ${manifest.archiveDate}`);
        console.log(`  记录数: ${manifest.totalRecords}`);
        console.log(`  批次: ${manifest.batchCount}`);
        console.log(`  创建时间: ${manifest.createdAt}`);
        console.log(`  文件: ${manifest.archiveFiles.length} 个`);
      }

      // 显示存储使用情况
      let totalSize = 0;
      for (const file of archiveFiles) {
        const filePath = path.join(this.archiveDir, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
      }

      console.log(`\n💾 总存储大小: ${this.formatBytes(totalSize)}`);

    } catch (error) {
      console.error('❌ 列出归档文件时发生错误:', error.message);
    }
  }

  /**
   * 清理归档文件
   * @param {string} archiveDateStr - 归档日期字符串
   */
  async cleanupArchives(archiveDateStr) {
    try {
      console.log(`🗑️ 清理归档文件: ${archiveDateStr}`);
      
      const manifestPath = path.join(this.archiveDir, `pixels_history_manifest_${archiveDateStr}.json`);
      
      try {
        await fs.access(manifestPath);
      } catch (error) {
        throw new Error(`找不到归档清单文件: ${manifestPath}`);
      }

      const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
      
      // 删除归档文件
      for (const archiveFile of manifest.archiveFiles) {
        const archiveFilePath = path.join(this.archiveDir, archiveFile);
        await fs.unlink(archiveFilePath);
        console.log(`🗑️ 删除文件: ${archiveFile}`);
      }

      // 删除清单文件
      await fs.unlink(manifestPath);
      console.log(`🗑️ 删除清单: ${path.basename(manifestPath)}`);

      console.log(`✅ 清理完成！删除了 ${manifest.archiveFiles.length + 1} 个文件`);

    } catch (error) {
      console.error('❌ 清理归档文件时发生错误:', error.message);
    }
  }

  /**
   * 确保归档目录存在
   */
  async ensureArchiveDir() {
    try {
      await fs.access(this.archiveDir);
    } catch (error) {
      await fs.mkdir(this.archiveDir, { recursive: true });
      console.log(`📁 创建归档目录: ${this.archiveDir}`);
    }
  }

  /**
   * 写入归档文件（压缩）
   * @param {string} filePath - 文件路径
   * @param {Array} data - 数据数组
   */
  async writeArchiveFile(filePath, data) {
    const jsonData = JSON.stringify(data, null, 2);
    const gzip = zlib.createGzip();
    
    await pipeline(
      require('stream').Readable.from([jsonData]),
      gzip,
      createWriteStream(filePath)
    );
  }

  /**
   * 读取归档文件（解压）
   * @param {string} filePath - 文件路径
   * @returns {Array} 数据数组
   */
  async readArchiveFile(filePath) {
    const gunzip = zlib.createGunzip();
    const chunks = [];
    
    await pipeline(
      createReadStream(filePath),
      gunzip,
      require('stream').Writable({
        write(chunk, encoding, callback) {
          chunks.push(chunk);
          callback();
        }
      })
    );

    const jsonData = Buffer.concat(chunks).toString('utf8');
    return JSON.parse(jsonData);
  }

  /**
   * 将数组分块
   * @param {Array} array - 要分块的数组
   * @param {number} chunkSize - 块大小
   * @returns {Array} 分块后的数组
   */
  chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * 格式化字节数
   * @param {number} bytes - 字节数
   * @returns {string} 格式化后的字符串
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const archiver = new PixelsHistoryArchiver();

  try {
    switch (command) {
      case 'archive':
        if (!args[1]) {
          console.error('❌ 请提供归档日期 (YYYY-MM-DD)');
          process.exit(1);
        }
        await archiver.archiveData(args[1]);
        break;

      case 'restore':
        if (!args[1]) {
          console.error('❌ 请提供归档日期 (YYYY-MM-DD)');
          process.exit(1);
        }
        await archiver.restoreData(args[1]);
        break;

      case 'list':
        await archiver.listArchives();
        break;

      case 'cleanup':
        if (!args[1]) {
          console.error('❌ 请提供归档日期 (YYYY-MM-DD)');
          process.exit(1);
        }
        await archiver.cleanupArchives(args[1]);
        break;

      default:
        console.log('📖 使用方法:');
        console.log('  node scripts/archive-pixels-history.js <command> [options]');
        console.log('');
        console.log('🔧 可用命令:');
        console.log('  archive <date>    归档指定日期之前的数据 (YYYY-MM-DD)');
        console.log('  restore <date>    从归档文件恢复数据 (YYYY-MM-DD)');
        console.log('  list              列出所有归档文件');
        console.log('  cleanup <date>    清理指定日期的归档文件 (YYYY-MM-DD)');
        console.log('');
        console.log('📝 示例:');
        console.log('  node scripts/archive-pixels-history.js archive 2024-12-01');
        console.log('  node scripts/archive-pixels-history.js restore 2024-12-01');
        console.log('  node scripts/archive-pixels-history.js list');
        break;
    }
  } catch (error) {
    console.error('❌ 执行命令时发生错误:', error.message);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = PixelsHistoryArchiver;
