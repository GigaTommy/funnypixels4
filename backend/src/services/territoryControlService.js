/**
 * 领地控制变更服务
 * 监测领地控制权变化并写入 territory_control_history 表
 * 用于 World State Feed 的领地变化事件
 */

const { db } = require('../config/database');
const { getRedis } = require('../config/redis');
const logger = require('../utils/logger');
const cron = require('node-cron');

class TerritoryControlService {
  constructor() {
    this.isRunning = false;
    this.lastCheck = null;
  }

  /**
   * 启动定时检测服务
   * 每30分钟检查一次领地控制权变化
   */
  start() {
    if (this.isRunning) {
      logger.warn('TerritoryControlService 已在运行中');
      return;
    }

    this.isRunning = true;
    logger.info('启动领地控制变更检测服务...');

    // 每30分钟检查一次领地控制权变化
    cron.schedule('*/30 * * * *', async () => {
      await this.detectAndRecordTerritoryChanges();
    });

    // 启动后立即执行一次
    this.detectAndRecordTerritoryChanges();

    logger.info('领地控制变更检测服务已启动');
  }

  /**
   * 停止服务
   */
  stop() {
    this.isRunning = false;
    logger.info('领地控制变更检测服务已停止');
  }

  /**
   * 检测并记录领地控制权变化
   * 对比 territory_control 表中的当前控制数据和上次快照，
   * 如果控制联盟发生变化则写入 territory_control_history
   */
  async detectAndRecordTerritoryChanges() {
    if (!this.isRunning) return;

    try {
      logger.info('开始检测领地控制权变化...');

      // 检查 territory_control 表是否存在
      const hasControlTable = await db.schema.hasTable('territory_control');
      if (!hasControlTable) {
        logger.info('territory_control 表不存在，跳过检测');
        return;
      }

      // 检查 territory_control_history 表是否存在
      const hasHistoryTable = await db.schema.hasTable('territory_control_history');
      if (!hasHistoryTable) {
        logger.info('territory_control_history 表不存在，跳过检测');
        return;
      }

      // 获取Redis用于缓存上一次的领地快照
      let redis;
      try {
        redis = getRedis();
      } catch (e) {
        // Redis不可用，使用数据库方式
      }

      // 获取当前所有领地控制状态（只取有联盟控制的）
      const currentTerritories = await db('territory_control')
        .whereNotNull('alliance_id')
        .where('pixel_count', '>', 0)
        .select(
          'h3_index',
          'alliance_id',
          'alliance_name',
          'pixel_count',
          'control_percentage',
          'updated_at'
        );

      if (currentTerritories.length === 0) {
        logger.debug('当前没有联盟控制的领地，跳过检测');
        this.lastCheck = new Date();
        return;
      }

      // 获取上次快照（从Redis或从territory_control_history推导）
      const SNAPSHOT_KEY = 'territory:control:snapshot';
      let previousSnapshot = {};

      if (redis) {
        try {
          const cached = await redis.get(SNAPSHOT_KEY);
          if (cached) {
            previousSnapshot = JSON.parse(cached);
          }
        } catch (e) {
          logger.debug('Redis快照读取失败，将从history表推导');
        }
      }

      // 如果没有快照，从最近的history记录推导
      if (Object.keys(previousSnapshot).length === 0) {
        const latestHistory = await db('territory_control_history')
          .select('territory_name', 'alliance_id')
          .orderBy('changed_at', 'desc')
          .limit(200);

        // 按territory_name去重，保留最新记录
        for (const record of latestHistory) {
          if (!previousSnapshot[record.territory_name]) {
            previousSnapshot[record.territory_name] = record.alliance_id;
          }
        }
      }

      // 对比变化
      const changes = [];
      const newSnapshot = {};

      for (const territory of currentTerritories) {
        const territoryName = this._formatTerritoryName(territory);
        newSnapshot[territoryName] = territory.alliance_id;

        const previousAllianceId = previousSnapshot[territoryName] || null;

        // 控制权变化：不同联盟控制了这个领地
        if (previousAllianceId !== territory.alliance_id) {
          changes.push({
            territory_name: territoryName,
            alliance_id: territory.alliance_id,
            previous_alliance_id: previousAllianceId,
            metadata: JSON.stringify({
              h3_index: territory.h3_index,
              pixel_count: territory.pixel_count,
              control_percentage: territory.control_percentage,
              alliance_name: territory.alliance_name
            }),
            changed_at: new Date()
          });
        }
      }

      // 批量写入变化记录
      if (changes.length > 0) {
        // 分批写入，每批最多50条
        const chunkSize = 50;
        for (let i = 0; i < changes.length; i += chunkSize) {
          const chunk = changes.slice(i, i + chunkSize);
          await db('territory_control_history').insert(chunk);
        }

        logger.info(`检测到 ${changes.length} 处领地控制权变化，已写入history表`);
      } else {
        logger.debug('未检测到领地控制权变化');
      }

      // 更新快照到Redis（30分钟过期，与检测周期一致）
      if (redis) {
        try {
          await redis.setEx(SNAPSHOT_KEY, 1800, JSON.stringify(newSnapshot));
        } catch (e) {
          logger.debug('Redis快照写入失败（非关键）:', e.message);
        }
      }

      this.lastCheck = new Date();

    } catch (error) {
      logger.error('检测领地控制权变化失败:', error);
    }
  }

  /**
   * 手动记录领地变更（可由外部服务调用）
   * @param {string} territoryName - 领地名称
   * @param {number} allianceId - 新控制联盟ID
   * @param {number|null} previousAllianceId - 前控制联盟ID
   * @param {Object} metadata - 额外元数据
   */
  async checkAndRecordTerritoryChange(territoryName, allianceId, previousAllianceId = null, metadata = {}) {
    try {
      // 检查 territory_control_history 表是否存在
      const hasTable = await db.schema.hasTable('territory_control_history');
      if (!hasTable) {
        logger.warn('territory_control_history 表不存在，无法记录变更');
        return null;
      }

      // 避免重复记录：检查最近5分钟内是否已有相同变更
      const recentDuplicate = await db('territory_control_history')
        .where('territory_name', territoryName)
        .where('alliance_id', allianceId)
        .where('changed_at', '>', db.raw("NOW() - INTERVAL '5 minutes'"))
        .first();

      if (recentDuplicate) {
        logger.debug(`领地 ${territoryName} 近期已有相同变更记录，跳过`);
        return null;
      }

      const [record] = await db('territory_control_history')
        .insert({
          territory_name: territoryName,
          alliance_id: allianceId,
          previous_alliance_id: previousAllianceId,
          metadata: JSON.stringify(metadata),
          changed_at: new Date()
        })
        .returning('*');

      logger.info(`领地变更已记录: ${territoryName} -> 联盟 ${allianceId}`);
      return record;

    } catch (error) {
      logger.error('记录领地变更失败:', error);
      return null;
    }
  }

  /**
   * 格式化领地名称
   * 将h3_index和alliance_name组合为可读的领地名称
   */
  _formatTerritoryName(territory) {
    // 优先使用alliance_name拼接区域标识
    if (territory.alliance_name) {
      // 使用h3_index的后6位作为区域标识
      const regionCode = territory.h3_index.slice(-6);
      return `区域 ${regionCode}`;
    }
    return `区域 ${territory.h3_index.slice(-6)}`;
  }

  /**
   * 获取服务状态
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastCheck: this.lastCheck
    };
  }
}

module.exports = new TerritoryControlService();
