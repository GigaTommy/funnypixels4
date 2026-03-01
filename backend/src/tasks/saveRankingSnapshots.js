/**
 * P1-4: Event Ranking Snapshot Task
 * Saves ranking snapshots every 5 minutes for active events
 * Also cleans up old snapshots (>7 days) every hour
 */

const cron = require('node-cron');
const eventService = require('../services/eventService');
const logger = require('../utils/logger');

/**
 * Start ranking snapshot tasks
 */
function startRankingSnapshotTasks() {
  // Task 1: Save snapshots every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    logger.debug('📸 Starting ranking snapshot task...');

    try {
      await eventService.saveAllActiveEventSnapshots();
      logger.debug('✅ Ranking snapshot task completed');
    } catch (error) {
      logger.error('❌ Ranking snapshot task failed:', error);
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Shanghai'
  });

  // Task 2: Cleanup old snapshots every hour
  cron.schedule('0 * * * *', async () => {
    logger.debug('🗑️ Starting old snapshot cleanup task...');

    try {
      const deleted = await eventService.cleanupOldSnapshots();
      if (deleted > 0) {
        logger.info(`✅ Cleanup task completed: ${deleted} old snapshots removed`);
      } else {
        logger.debug('✅ Cleanup task completed: no old snapshots to remove');
      }
    } catch (error) {
      logger.error('❌ Snapshot cleanup task failed:', error);
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Shanghai'
  });

  logger.info('✅ Ranking snapshot tasks scheduled:');
  logger.info('   - Save snapshots: every 5 minutes');
  logger.info('   - Cleanup old data: every hour (keep 7 days)');
}

module.exports = {
  startRankingSnapshotTasks
};
