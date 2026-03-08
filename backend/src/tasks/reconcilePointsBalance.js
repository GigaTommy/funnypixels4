/**
 * 积分余额对账定时任务
 * 每天凌晨3点执行，比对 wallet_ledger SUM 与 user_points.total_points
 * 发现不一致时写入 system_alerts 表，管理员可在 admin 面板查看
 */

const cron = require('node-cron');
const { db } = require('../config/database');
const logger = require('../utils/logger');
const rewardConfigService = require('../services/rewardConfigService');

async function reconcileBalances() {
  logger.info('🔄 Starting points balance reconciliation...');

  try {
    // 查询 user_points 与 wallet_ledger SUM 不一致的用户
    // 排除无流水历史的用户（P0修复前积累的积分没有 ledger 记录）
    const mismatches = await db.raw(`
      SELECT
        up.user_id,
        up.total_points AS recorded_balance,
        COALESCE(SUM(wl.delta_points), 0)::int AS ledger_sum,
        up.total_points - COALESCE(SUM(wl.delta_points), 0)::int AS drift
      FROM user_points up
      LEFT JOIN wallet_ledger wl ON wl.user_id = up.user_id
      GROUP BY up.user_id, up.total_points
      HAVING up.total_points != COALESCE(SUM(wl.delta_points), 0)::int
        AND COUNT(wl.id) > 0
      ORDER BY ABS(up.total_points - COALESCE(SUM(wl.delta_points), 0)::int) DESC
      LIMIT 100
    `);

    const rows = mismatches.rows || [];

    if (rows.length === 0) {
      logger.info('✅ Points balance reconciliation passed — no mismatches found');
      return { success: true, mismatches: 0 };
    }

    // 记录不一致的用户到日志
    logger.warn(`⚠️ Points balance reconciliation found ${rows.length} mismatches`);

    // 写入 system_alerts 表，推送给管理员
    const totalDrift = rows.reduce((sum, r) => sum + Math.abs(r.drift), 0);
    const driftThreshold = rewardConfigService.get('reconciliation.drift_critical_threshold', 1000);
    const usersThreshold = rewardConfigService.get('reconciliation.users_warning_threshold', 10);
    const severity = totalDrift > driftThreshold ? 'critical' : rows.length > usersThreshold ? 'warning' : 'info';

    await db('system_alerts').insert({
      type: 'reconciliation',
      severity,
      title: `积分对账异常：${rows.length} 名用户余额不一致`,
      message: `检测到 ${rows.length} 名用户的 user_points.total_points 与 wallet_ledger 流水汇总不匹配，总偏差 ${totalDrift} 积分。请在用户管理中核查并修正。`,
      details: JSON.stringify({
        total_mismatches: rows.length,
        total_drift: totalDrift,
        users: rows.slice(0, 20).map(r => ({
          user_id: r.user_id,
          recorded_balance: r.recorded_balance,
          ledger_sum: r.ledger_sum,
          drift: r.drift
        }))
      }),
      created_at: new Date()
    });

    return { success: true, mismatches: rows.length, details: rows };
  } catch (error) {
    logger.error('❌ Points balance reconciliation failed:', error);

    // 对账任务本身失败也写入告警
    try {
      await db('system_alerts').insert({
        type: 'system',
        severity: 'critical',
        title: '积分对账任务执行失败',
        message: error.message,
        created_at: new Date()
      });
    } catch (_) {
      // 避免递归错误
    }

    return { success: false, error: error.message };
  }
}

function startPointsReconciliationTask() {
  // 每天凌晨 3:00 执行
  cron.schedule('0 3 * * *', async () => {
    await reconcileBalances();
  }, {
    scheduled: true,
    timezone: 'Asia/Shanghai'
  });

  logger.info('✅ Points balance reconciliation task scheduled (03:00 Asia/Shanghai)');
}

module.exports = {
  startPointsReconciliationTask,
  reconcileBalances
};
