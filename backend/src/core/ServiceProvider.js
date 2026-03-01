// @ts-check
/**
 * 服务提供者 - 注册所有服务到 DI 容器
 *
 * 这个文件是应用程序的依赖注入配置中心
 * 所有服务、配置、工具都在这里注册
 */

const Container = require('./Container');

/**
 * 创建并配置依赖注入容器
 * @returns {Container}
 */
function createContainer() {
  const container = new Container();

  // ============================================
  // 基础设施层 (Infrastructure)
  // ============================================

  // 数据库连接
  container.singleton('db', () => {
    const { db } = require('../config/database');
    return db;
  });

  // Redis 客户端
  container.singleton('redis', () => {
    const { getRedis } = require('../config/redis');
    return getRedis();
  });

  // 日志工具
  container.singleton('logger', () => {
    return require('../utils/logger');
  });

  // i18n 实例
  container.singleton('i18n', () => {
    const { i18next } = require('../config/i18n');
    return i18next;
  });

  // ============================================
  // 工具层 (Utilities)
  // ============================================

  container.singleton('gridUtils', () => {
    return require('../../shared/utils/gridUtils');
  });

  container.singleton('i18nHelpers', () => {
    return require('../utils/i18n');
  });

  // ============================================
  // Repository 层 (Data Access)
  // ============================================

  // 用户 Repository
  container.singleton('userRepository', (c) => {
    const UserRepository = require('../repositories/UserRepository');
    return new UserRepository(c.get('db'));
  });

  // 像素 Repository
  container.singleton('pixelRepository', (c) => {
    const PixelRepository = require('../repositories/PixelRepository');
    return new PixelRepository(c.get('db'));
  });

  // 联盟 Repository
  container.singleton('allianceRepository', (c) => {
    const AllianceRepository = require('../repositories/AllianceRepository');
    return new AllianceRepository(c.get('db'));
  });

  // ============================================
  // 服务层 (Services)
  // ============================================

  // 缓存服务
  container.singleton('cacheService', (c) => {
    const CacheService = require('../services/cacheService');
    return new CacheService(c.get('redis'), c.get('logger'));
  });

  // 瓦片变更队列服务
  container.singleton('tileChangeQueueService', (c) => {
    const TileChangeQueueService = require('../services/tileChangeQueueService');
    return new TileChangeQueueService(c.get('redis'), c.get('logger'));
  });

  // 战斗报告服务
  container.singleton('battleReportService', (c) => {
    const BattleReportService = require('../services/battleReportService');
    return new BattleReportService(c.get('db'), c.get('logger'));
  });

  // 批量像素处理服务
  container.singleton('batchPixelService', (c) => {
    const BatchPixelService = require('../services/batchPixelService');
    return new BatchPixelService(
      c.get('db'),
      c.get('cacheService'),
      c.get('tileChangeQueueService'),
      c.get('battleReportService'),
      c.get('gridUtils'),
      c.get('logger')
    );
  });

  // 排行榜缓存服务
  container.singleton('regionLeaderboardCacheService', (c) => {
    const RegionLeaderboardCacheService = require('../services/regionLeaderboardCacheService');
    return new RegionLeaderboardCacheService(c.get('cacheService'), c.get('logger'));
  });

  // 排行榜维护服务
  container.singleton('leaderboardMaintenanceService', (c) => {
    const LeaderboardMaintenanceService = require('../services/leaderboardMaintenanceService');
    return new LeaderboardMaintenanceService(c.get('db'), c.get('logger'));
  });

  // 增量排行榜服务
  container.singleton('incrementalLeaderboardService', (c) => {
    const IncrementalLeaderboardService = require('../services/incrementalLeaderboardService');
    return new IncrementalLeaderboardService(
      c.get('db'),
      c.get('cacheService'),
      c.get('logger')
    );
  });

  // 热点服务
  container.singleton('hotspotService', (c) => {
    const HotspotService = require('../services/hotspotService');
    return new HotspotService(c.get('db'), c.get('logger'));
  });

  // 排名段位服务
  container.singleton('rankTierService', (c) => {
    const RankTierService = require('../services/rankTierService');
    return new RankTierService(c.get('cacheService'), c.get('logger'));
  });

  // 隐私屏蔽服务
  container.singleton('privacyMaskingService', (c) => {
    const PrivacyMaskingService = require('../services/privacyMaskingService');
    return new PrivacyMaskingService(c.get('db'), c.get('cacheService'), c.get('logger'));
  });

  // ============================================
  // 控制器层 (Controllers)
  // ============================================

  // 注意：控制器通常不需要实例化，它们使用静态方法
  // 但为了支持依赖注入，可以这样注册：
  container.singleton('leaderboardController', (c) => {
    const LeaderboardController = require('../controllers/leaderboardController');
    // 可以注入依赖到控制器类，或者保持静态方法
    return LeaderboardController;
  });

  return container;
}

/**
 * 全局容器实例（单例模式）
 * @type {Container|null}
 */
let globalContainer = null;

/**
 * 获取全局容器实例
 * @returns {Container}
 */
function getContainer() {
  if (!globalContainer) {
    globalContainer = createContainer();
  }
  return globalContainer;
}

/**
 * 重置全局容器（主要用于测试）
 */
function resetContainer() {
  if (globalContainer) {
    globalContainer.clear();
  }
  globalContainer = null;
}

module.exports = {
  Container,
  createContainer,
  getContainer,
  resetContainer
};
