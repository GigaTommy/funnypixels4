/**
 * 像素历史分区表维护服务
 *
 * 职责：
 * - 自动创建未来的分区表
 * - 监控分区表使用情况
 * - 清理过期的旧分区（可选）
 */

const { db } = require('../config/database');
const logger = require('../utils/logger');
const cron = require('node-cron');

class PartitionMaintenanceService {
  constructor() {
    this.tableName = 'pixels_history';
    this.monthsAhead = 3; // 提前N个月创建分区
    this.retentionMonths = 36; // 保留多少个月的数据（可选）

    // 启动定时任务：每月1号凌晨2点执行
    this.startScheduledTask();

    logger.info('📅 分区维护服务已启动', {
      monthsAhead: this.monthsAhead,
      retentionMonths: this.retentionMonths
    });
  }

  /**
   * 启动定时任务
   */
  startScheduledTask() {
    // 每月1号凌晨2点执行
    cron.schedule('0 2 1 * *', async () => {
      logger.info('🔄 开始执行分区维护任务...');
      try {
        await this.createFuturePartitions();
        await this.cleanupOldPartitions();
      } catch (error) {
        logger.error('❌ 分区维护任务失败:', error);
      }
    });

    // 启动时也执行一次检查
    this.checkAndCreatePartitions().catch(error => {
      logger.error('启动时分区检查失败:', error);
    });
  }

  /**
   * 检查并创建缺失的分区
   */
  async checkAndCreatePartitions() {
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      logger.info('🔍 检查分区表状态...', {
        currentYear,
        currentMonth
      });

      // 检查当前月份的分区是否存在
      const currentPartition = `${this.tableName}_${currentYear}${String(currentMonth).padStart(2, '0')}`;
      const exists = await this.partitionExists(currentPartition);

      if (!exists) {
        logger.warn(`⚠️ 当前月份分区不存在: ${currentPartition}，立即创建`);
        await this.createPartition(currentYear, currentMonth);
      }

      // 创建未来N个月的分区
      await this.createFuturePartitions();

    } catch (error) {
      logger.error('检查分区失败:', error);
      throw error;
    }
  }

  /**
   * 创建未来N个月的分区
   */
  async createFuturePartitions() {
    const now = new Date();
    const createdPartitions = [];

    for (let i = 1; i <= this.monthsAhead; i++) {
      const futureDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const year = futureDate.getFullYear();
      const month = futureDate.getMonth() + 1;

      const partitionName = `${this.tableName}_${year}${String(month).padStart(2, '0')}`;
      const exists = await this.partitionExists(partitionName);

      if (!exists) {
        await this.createPartition(year, month);
        createdPartitions.push(partitionName);
        logger.info(`✅ 创建分区: ${partitionName}`);
      }
    }

    if (createdPartitions.length > 0) {
      logger.info('📅 分区创建完成', {
        count: createdPartitions.length,
        partitions: createdPartitions
      });
    } else {
      logger.debug('✅ 所有未来分区已存在');
    }

    return createdPartitions;
  }

  /**
   * 检查分区是否存在
   */
  async partitionExists(partitionName) {
    try {
      const result = await db.raw(`
        SELECT EXISTS (
          SELECT 1 FROM pg_tables
          WHERE schemaname = 'public'
          AND tablename = ?
        ) as exists
      `, [partitionName]);

      return result.rows[0].exists;
    } catch (error) {
      logger.error(`检查分区失败: ${partitionName}`, error);
      return false;
    }
  }

  /**
   * 创建单个月份的分区
   */
  async createPartition(year, month) {
    const partitionName = `${this.tableName}_${year}${String(month).padStart(2, '0')}`;

    // 计算分区范围
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    const startDateStr = startDate.toISOString().split('T')[0]; // YYYY-MM-DD
    const endDateStr = endDate.toISOString().split('T')[0];

    try {
      await db.raw(`
        CREATE TABLE IF NOT EXISTS ${partitionName} PARTITION OF ${this.tableName}
        FOR VALUES FROM ('${startDateStr}') TO ('${endDateStr}');
      `);

      logger.info(`✅ 分区创建成功: ${partitionName}`, {
        range: `${startDateStr} TO ${endDateStr}`
      });

      return partitionName;
    } catch (error) {
      logger.error(`❌ 创建分区失败: ${partitionName}`, error);
      throw error;
    }
  }

  /**
   * 清理过期的旧分区（可选）
   */
  async cleanupOldPartitions() {
    try {
      const now = new Date();
      const cutoffDate = new Date(now.getFullYear(), now.getMonth() - this.retentionMonths, 1);

      // 获取所有分区表
      const partitions = await db.raw(`
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename LIKE '${this.tableName}_%'
        ORDER BY tablename DESC
      `);

      const toDrop = [];
      for (const row of partitions.rows) {
        const tablename = row.tablename;
        const match = tablename.match(/_(\d{4})(\d{2})$/);
        if (match) {
          const partitionYear = parseInt(match[1]);
          const partitionMonth = parseInt(match[2]);
          const partitionDate = new Date(partitionYear, partitionMonth - 1, 1);

          if (partitionDate < cutoffDate) {
            toDrop.push(tablename);
          }
        }
      }

      if (toDrop.length > 0) {
        logger.info('🗑️ 清理过期分区', {
          count: toDrop.length,
          partitions: toDrop
        });

        for (const partition of toDrop) {
          await db.raw(`DROP TABLE IF EXISTS ${partition} CASCADE`);
          logger.info(`✅ 已删除分区: ${partition}`);
        }
      } else {
        logger.debug('✅ 没有需要清理的过期分区');
      }

      return toDrop;
    } catch (error) {
      logger.error('清理分区失败:', error);
      throw error;
    }
  }

  /**
   * 获取分区状态统计
   */
  async getPartitionStats() {
    try {
      const result = await db.raw(`
        SELECT
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
          (SELECT COUNT(*) FROM ${this.tableName}) as total_rows
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename LIKE '${this.tableName}_%'
        ORDER BY tablename DESC
      `);

      return result.rows;
    } catch (error) {
      logger.error('获取分区统计失败:', error);
      return [];
    }
  }
}

// 创建单例实例
const partitionMaintenanceService = new PartitionMaintenanceService();

module.exports = partitionMaintenanceService;
