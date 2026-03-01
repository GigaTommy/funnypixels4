/**
 * 数据迁移脚本：将现有的complex图案迁移到CDN架构
 *
 * 功能：
 * 1. 为所有complex图案生成CDN缩略图
 * 2. 更新数据库中的CDN字段
 * 3. 支持增量迁移和断点续传
 */

const { db } = require('../src/config/database');
const logger = require('../src/utils/logger');
const CDNService = require('../src/services/cdnService');

class PatternCdnMigrator {
  constructor() {
    this.cdnService = new CDNService();
    this.processedCount = 0;
    this.errorCount = 0;
    this.skipCount = 0;
    this.startTime = Date.now();
  }

  /**
   * 执行迁移
   */
  async migrate(options = {}) {
    const {
      batchSize = 10,
      skipMigrated = true,
      dryRun = false
    } = options;

    try {
      logger.info('🚀 开始图案CDN迁移', {
        batchSize,
        skipMigrated,
        dryRun: dryRun ? '是' : '否'
      });

      // 检查CDN服务状态
      await this.checkCdnService();

      // 获取需要迁移的图案
      const patterns = await this.getPatternsToMigrate(skipMigrated);
      logger.info(`📊 找到 ${patterns.length} 个需要迁移的图案`);

      if (patterns.length === 0) {
        logger.info('✅ 没有需要迁移的图案');
        return;
      }

      // 分批处理
      for (let i = 0; i < patterns.length; i += batchSize) {
        const batch = patterns.slice(i, i + batchSize);
        await this.processBatch(batch, dryRun);

        // 显示进度
        const progress = Math.min(i + batchSize, patterns.length);
        const percent = (progress / patterns.length * 100).toFixed(1);
        logger.info(`📈 迁移进度: ${progress}/${patterns.length} (${percent}%)`);
      }

      // 输出最终统计
      this.printFinalStats();

    } catch (error) {
      logger.error('❌ CDN迁移失败:', error);
      throw error;
    }
  }

  /**
   * 检查CDN服务状态
   */
  async checkCdnService() {
    try {
      logger.info('🔍 检查CDN服务状态...');

      // 测试上传一个小文件
      const testBuffer = Buffer.from('test', 'utf8');
      const testResult = await this.cdnService.upload('test/migration-check.txt', testBuffer);

      logger.info('✅ CDN服务正常', { testUrl: testResult.url });

      // 清理测试文件
      await this.cdnService.deleteFile('test/migration-check.txt');

    } catch (error) {
      logger.error('❌ CDN服务异常，无法执行迁移:', error);
      throw new Error('CDN服务不可用，请检查配置');
    }
  }

  /**
   * 获取需要迁移的图案
   */
  async getPatternsToMigrate(skipMigrated) {
    let query = db('pattern_assets')
      .where('render_type', 'complex')
      .whereNotNull('payload')
      .where('payload', '!=', '');

    if (skipMigrated) {
      query = query.whereNull('file_url');
    }

    return await query.select('*').orderBy('created_at', 'asc');
  }

  /**
   * 处理一批图案
   */
  async processBatch(patterns, dryRun) {
    for (const pattern of patterns) {
      try {
        await this.processPattern(pattern, dryRun);
        this.processedCount++;
      } catch (error) {
        logger.error(`❌ 图案迁移失败: ${pattern.id}`, error);
        this.errorCount++;
      }
    }
  }

  /**
   * 处理单个图案
   */
  async processPattern(pattern, dryRun) {
    logger.info(`🔄 处理图案: ${pattern.id}`, {
      name: pattern.name,
      key: pattern.key,
      payloadSize: pattern.payload?.length || 0
    });

    // 验证payload
    if (!pattern.payload) {
      logger.warn(`⚠️ 图案缺少payload，跳过: ${pattern.id}`);
      this.skipCount++;
      return;
    }

    if (dryRun) {
      logger.info(`🔍 [DRY RUN] 将处理图案: ${pattern.id}`);
      return;
    }

    try {
      // 使用CDNService上传自定义旗帜
      const cdnResult = await this.cdnService.uploadCustomFlag({
        data: pattern.payload,
        orderId: pattern.id,
        userId: pattern.created_by
      });

      // 更新数据库
      await db('pattern_assets')
        .where('id', pattern.id)
        .update({
          file_url: cdnResult.cdnUrl,
          file_path: cdnResult.storagePath,
          file_hash: cdnResult.hash,
          file_size: cdnResult.size,
          updated_at: new Date()
        });

      logger.info(`✅ 图案迁移成功: ${pattern.id}`, {
        cdnUrl: cdnResult.cdnUrl,
        originalSize: pattern.payload.length,
        thumbnailSize: cdnResult.thumbnailBase64.length
      });

    } catch (error) {
      logger.error(`❌ 图案处理失败: ${pattern.id}`, error);
      throw error;
    }
  }

  /**
   * 输出最终统计
   */
  printFinalStats() {
    const duration = (Date.now() - this.startTime) / 1000;

    logger.info('📊 CDN迁移完成统计:', {
      总耗时: `${duration.toFixed(2)}秒`,
      成功数量: this.processedCount,
      失败数量: this.errorCount,
      跳过数量: this.skipCount,
      平均耗时: duration > 0 ? `${(duration / this.processedCount).toFixed(2)}秒/个` : 'N/A'
    });

    if (this.errorCount > 0) {
      logger.warn(`⚠️ 有 ${this.errorCount} 个图案迁移失败，请检查日志`);
    }
  }

  /**
   * 回滚迁移
   */
  async rollback() {
    try {
      logger.warn('🔄 开始回滚CDN迁移...');

      // 清除所有CDN字段
      const result = await db('pattern_assets')
        .where('render_type', 'complex')
        .whereNotNull('file_url')
        .update({
          file_url: null,
          file_path: null,
          file_hash: null,
          file_size: null,
          updated_at: new Date()
        });

      logger.info(`✅ 已回滚 ${result} 个图案的CDN字段`);

    } catch (error) {
      logger.error('❌ 回滚失败:', error);
      throw error;
    }
  }

  /**
   * 验证迁移结果
   */
  async verify() {
    try {
      logger.info('🔍 验证CDN迁移结果...');

      // 统计各种状态的图案数量
      const stats = await db('pattern_assets')
        .where('render_type', 'complex')
        .select(
          db.raw('COUNT(*) as total'),
          db.raw('COUNT(file_url) as with_cdn'),
          db.raw('COUNT(CASE WHEN file_url IS NULL THEN 1 END) as without_cdn')
        )
        .first();

      logger.info('📊 迁移验证结果:', {
        复杂图案总数: stats.total,
        已迁移到CDN: stats.with_cdn,
        未迁移: stats.without_cdn,
        迁移率: stats.total > 0 ? `${(stats.with_cdn / stats.total * 100).toFixed(1)}%` : 'N/A'
      });

      // 检查CDN URL的可访问性（抽样检查）
      if (stats.with_cdn > 0) {
        await this.sampleCdnUrls();
      }

    } catch (error) {
      logger.error('❌ 验证失败:', error);
      throw error;
    }
  }

  /**
   * 抽样检查CDN URL可访问性
   */
  async sampleCdnUrls(sampleSize = 5) {
    try {
      const samples = await db('pattern_assets')
        .where('render_type', 'complex')
        .whereNotNull('file_url')
        .select('file_url', 'id', 'name')
        .limit(sampleSize);

      logger.info(`🔍 抽样检查 ${samples.length} 个CDN URL...`);

      for (const sample of samples) {
        try {
          const response = await fetch(sample.file_url, {
            method: 'HEAD',
            signal: AbortSignal.timeout(5000) // 5秒超时
          });

          if (response.ok) {
            logger.info(`✅ CDN URL可访问: ${sample.name} (${sample.file_url})`);
          } else {
            logger.warn(`⚠️ CDN URL返回错误: ${sample.name} (${response.status})`);
          }
        } catch (error) {
          logger.error(`❌ CDN URL不可访问: ${sample.name}`, error.message);
        }
      }

    } catch (error) {
      logger.error('❌ CDN URL抽样检查失败:', error);
    }
  }
}

// 命令行接口
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'migrate';

  const migrator = new PatternCdnMigrator();

  try {
    switch (command) {
      case 'migrate':
        const options = {
          batchSize: args.includes('--batch-size') ? parseInt(args[args.indexOf('--batch-size') + 1]) || 10 : 10,
          skipMigrated: !args.includes('--force'),
          dryRun: args.includes('--dry-run')
        };
        await migrator.migrate(options);
        break;

      case 'rollback':
        await migrator.rollback();
        break;

      case 'verify':
        await migrator.verify();
        break;

      default:
        console.log(`
使用方法:
  node scripts/migrate-patterns-to-cdn.js migrate [选项]
  node scripts/migrate-patterns-to-cdn.js rollback
  node scripts/migrate-patterns-to-cdn.js verify

选项:
  --batch-size <数字>    批处理大小 (默认: 10)
  --force               强制迁移所有图案，包括已迁移的
  --dry-run             模拟运行，不实际修改数据

示例:
  node scripts/migrate-patterns-to-cdn.js migrate --batch-size 5
  node scripts/migrate-patterns-to-cdn.js migrate --dry-run
  node scripts/migrate-patterns-to-cdn.js verify
        `);
        process.exit(1);
    }

  } catch (error) {
    logger.error('脚本执行失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = PatternCdnMigrator;