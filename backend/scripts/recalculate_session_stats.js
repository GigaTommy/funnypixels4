#!/usr/bin/env node

/**
 * 重新计算所有会话的统计信息
 *
 * 用途：修复因异步写入导致的统计数据不准确问题
 *
 * 使用方法：
 *   node scripts/recalculate_session_stats.js
 *   node scripts/recalculate_session_stats.js --session-id=xxx  # 重算指定会话
 *   node scripts/recalculate_session_stats.js --recent=10      # 只重算最近10个会话
 */

require('../src/config/env').loadEnvConfig();
const { db } = require('../src/config/database');
const drawingSessionService = require('../src/services/drawingSessionService');
const logger = require('../src/utils/logger');

async function recalculateStats(sessionId) {
  try {
    // drawingSessionService 是单例，直接使用
    await drawingSessionService.calculateSessionStatistics(sessionId);

    // 获取更新后的统计信息
    const session = await db('drawing_sessions')
      .where('id', sessionId)
      .select('id', 'session_name', 'metadata')
      .first();

    const stats = session.metadata?.statistics || {};
    logger.info(`✅ 重新计算完成: ${sessionId}`, {
      sessionName: session.session_name,
      pixelCount: stats.pixelCount,
      distance: stats.distance,
      duration: stats.duration,
      uniqueGrids: stats.uniqueGrids
    });

    return true;
  } catch (error) {
    logger.error(`❌ 重新计算失败: ${sessionId}`, error);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  let sessionId = null;
  let recentCount = null;

  // 解析命令行参数
  for (const arg of args) {
    if (arg.startsWith('--session-id=')) {
      sessionId = arg.split('=')[1];
    } else if (arg.startsWith('--recent=')) {
      recentCount = parseInt(arg.split('=')[1]);
    }
  }

  try {
    logger.info('🔄 开始重新计算会话统计信息...');

    let sessions = [];

    if (sessionId) {
      // 指定会话
      const session = await db('drawing_sessions')
        .where('id', sessionId)
        .select('id', 'session_name', 'status')
        .first();

      if (!session) {
        logger.error(`会话不存在: ${sessionId}`);
        process.exit(1);
      }

      sessions = [session];
      logger.info(`找到会话: ${session.session_name} (${session.status})`);
    } else {
      // 所有已完成的会话
      let query = db('drawing_sessions')
        .where('status', 'completed')
        .orderBy('created_at', 'desc');

      if (recentCount) {
        query = query.limit(recentCount);
        logger.info(`将重新计算最近 ${recentCount} 个已完成的会话`);
      } else {
        const totalCount = await db('drawing_sessions')
          .where('status', 'completed')
          .count('* as count')
          .first();
        logger.info(`将重新计算所有 ${totalCount.count} 个已完成的会话`);
      }

      sessions = await query.select('id', 'session_name', 'status');
    }

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i];
      logger.info(`[${i + 1}/${sessions.length}] 处理会话: ${session.id} - ${session.session_name}`);

      const success = await recalculateStats(session.id);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }

      // 避免过快执行，给数据库一些喘息时间
      if (i < sessions.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    logger.info('✨ 重新计算完成!');
    logger.info(`成功: ${successCount}, 失败: ${failCount}, 总计: ${sessions.length}`);

    // 显示一些统计信息
    if (successCount > 0) {
      logger.info('\n📊 统计数据汇总:');

      const summaryStats = await db('drawing_sessions')
        .where('status', 'completed')
        .whereRaw("metadata->'statistics' IS NOT NULL")
        .select(
          db.raw("AVG((metadata->'statistics'->>'pixelCount')::int) as avg_pixels"),
          db.raw("MAX((metadata->'statistics'->>'pixelCount')::int) as max_pixels"),
          db.raw("AVG((metadata->'statistics'->>'distance')::numeric) as avg_distance"),
          db.raw("AVG((metadata->'statistics'->>'duration')::numeric) as avg_duration")
        )
        .first();

      logger.info(`  平均像素数: ${Math.round(summaryStats.avg_pixels || 0)}`);
      logger.info(`  最大像素数: ${summaryStats.max_pixels || 0}`);
      logger.info(`  平均距离: ${Math.round(summaryStats.avg_distance || 0)}米`);
      logger.info(`  平均时长: ${Math.round(summaryStats.avg_duration || 0)}秒`);
    }

  } catch (error) {
    logger.error('脚本执行失败:', error);
    process.exit(1);
  } finally {
    await db.destroy();
  }

  process.exit(0);
}

// 运行脚本
main();
