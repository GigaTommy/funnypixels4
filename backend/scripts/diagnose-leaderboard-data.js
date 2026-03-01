#!/usr/bin/env node

/**
 * 排行榜数据诊断脚本
 * 用于检查排行榜未显示最新像素统计数据的问题
 */

const { db } = require('../src/config/database');
const LeaderboardMaintenanceService = require('../src/services/leaderboardMaintenanceService');
const pixelsHistoryService = require('../src/services/pixelsHistoryService');

class LeaderboardDiagnostics {
  constructor() {
    this.leaderboardService = new LeaderboardMaintenanceService();
  }

  /**
   * 检查像素历史队列状态
   */
  async checkPixelsHistoryQueue() {
    console.log('\n🔍 检查像素历史队列状态...');

    try {
      // 检查最近的像素历史记录
      const recentHistory = await db('pixels_history')
        .orderBy('created_at', 'desc')
        .limit(10)
        .select('*');

      console.log(`📝 最近的像素历史记录数量: ${recentHistory.length}`);
      if (recentHistory.length > 0) {
        console.log('📝 最新记录时间:', recentHistory[0].created_at);
        console.log('📝 最旧记录时间:', recentHistory[recentHistory.length - 1].created_at);
      }

      return { recentHistoryCount: recentHistory.length };
    } catch (error) {
      console.error('❌ 检查队列状态失败:', error.message);
      return { error: error.message };
    }
  }

  /**
   * 检查pixels表与pixels_history表的数据一致性
   */
  async checkDataConsistency() {
    console.log('\n🔍 检查数据一致性...');

    try {
      // 检查pixels表总数
      const pixelsCount = await db('pixels').count('* as count').first();
      console.log(`📊 pixels表总记录数: ${pixelsCount.count}`);

      // 检查pixels_history表总数
      const historyCount = await db('pixels_history').count('* as count').first();
      console.log(`📊 pixels_history表总记录数: ${historyCount.count}`);

      // 检查最近24小时的数据
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const recentPixels = await db('pixels')
        .where('created_at', '>=', yesterday)
        .count('* as count')
        .first();

      const recentHistory = await db('pixels_history')
        .where('created_at', '>=', yesterday)
        .count('* as count')
        .first();

      console.log(`📊 最近24小时 pixels表记录: ${recentPixels.count}`);
      console.log(`📊 最近24小时 pixels_history表记录: ${recentHistory.count}`);

      return {
        pixelsTotal: parseInt(pixelsCount.count),
        historyTotal: parseInt(historyCount.count),
        recent24hPixels: parseInt(recentPixels.count),
        recent24hHistory: parseInt(recentHistory.count)
      };
    } catch (error) {
      console.error('❌ 检查数据一致性失败:', error.message);
      return { error: error.message };
    }
  }

  /**
   * 检查排行榜表数据状态
   */
  async checkLeaderboardTables() {
    console.log('\n🔍 检查排行榜表数据状态...');

    try {
      const periods = ['daily', 'weekly', 'monthly', 'yearly'];
      const results = {};

      for (const period of periods) {
        const { periodStart } = this.leaderboardService.getPeriodRange(period, new Date());

        // 检查个人排行榜
        const personalCount = await db('leaderboard_personal')
          .where('period', period)
          .where('period_start', periodStart)
          .count('* as count')
          .first();

        // 检查联盟排行榜
        const allianceCount = await db('leaderboard_alliance')
          .where('period', period)
          .where('period_start', periodStart)
          .count('* as count')
          .first();

        // 检查地区排行榜
        const regionCount = await db('leaderboard_region')
          .where('period', period)
          .where('period_start', periodStart)
          .count('* as count')
          .first();

        // 检查最后更新时间
        const lastUpdate = await db('leaderboard_personal')
          .where('period', period)
          .where('period_start', periodStart)
          .orderBy('last_updated', 'desc')
          .select('last_updated')
          .first();

        results[period] = {
          periodStart: periodStart.toISOString(),
          personalCount: parseInt(personalCount.count),
          allianceCount: parseInt(allianceCount.count),
          regionCount: parseInt(regionCount.count),
          lastUpdate: lastUpdate ? lastUpdate.last_updated : null
        };

        console.log(`📊 ${period} 排行榜 - 个人:${personalCount.count}, 联盟:${allianceCount.count}, 地区:${regionCount.count}`);
        console.log(`📊 ${period} 最后更新: ${lastUpdate ? lastUpdate.last_updated : '无数据'}`);
      }

      return results;
    } catch (error) {
      console.error('❌ 检查排行榜表失败:', error.message);
      return { error: error.message };
    }
  }

  /**
   * 检查排行榜维护服务状态
   */
  async checkMaintenanceService() {
    console.log('\n🔍 检查排行榜维护服务状态...');

    try {
      const status = this.leaderboardService.getStatus();
      console.log('📊 维护服务状态:', status);

      return status;
    } catch (error) {
      console.error('❌ 检查维护服务状态失败:', error.message);
      return { error: error.message };
    }
  }

  /**
   * 手动触发排行榜更新
   */
  async manualUpdate() {
    console.log('\n🔄 手动触发排行榜更新...');

    try {
      await this.leaderboardService.updateAllLeaderboards();
      console.log('✅ 排行榜更新完成');
      return { success: true };
    } catch (error) {
      console.error('❌ 手动更新失败:', error.message);
      return { error: error.message };
    }
  }

  /**
   * 运行完整诊断
   */
  async runFullDiagnostics() {
    console.log('🚀 开始排行榜数据诊断...\n');

    const report = {
      timestamp: new Date().toISOString(),
      diagnostics: {}
    };

    // 1. 检查像素历史队列
    report.diagnostics.queueStatus = await this.checkPixelsHistoryQueue();

    // 2. 检查数据一致性
    report.diagnostics.dataConsistency = await this.checkDataConsistency();

    // 3. 检查排行榜表状态
    report.diagnostics.leaderboardTables = await this.checkLeaderboardTables();

    // 4. 检查维护服务状态
    report.diagnostics.maintenanceService = await this.checkMaintenanceService();

    console.log('\n📋 诊断报告摘要:');
    console.log('================');

    // 分析问题
    const issues = [];

    if (report.diagnostics.dataConsistency.recent24hHistory < report.diagnostics.dataConsistency.recent24hPixels) {
      issues.push('⚠️ pixels_history表数据可能滞后于pixels表');
    }

    if (!report.diagnostics.maintenanceService.isRunning) {
      issues.push('⚠️ 排行榜维护服务未运行');
    }

    const now = new Date();
    Object.entries(report.diagnostics.leaderboardTables).forEach(([period, data]) => {
      if (data.lastUpdate) {
        const lastUpdate = new Date(data.lastUpdate);
        const hoursSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60);

        if (hoursSinceUpdate > 1.5) { // 超过1.5小时
          issues.push(`⚠️ ${period}排行榜数据超过1.5小时未更新`);
        }
      } else {
        issues.push(`⚠️ ${period}排行榜无数据`);
      }
    });

    if (issues.length === 0) {
      console.log('✅ 未发现明显问题');
    } else {
      console.log('🔍 发现以下问题:');
      issues.forEach(issue => console.log(`  ${issue}`));
    }

    return report;
  }
}

// 主函数
async function main() {
  const diagnostics = new LeaderboardDiagnostics();

  const args = process.argv.slice(2);
  const command = args[0] || 'full';

  try {
    switch (command) {
      case 'queue':
        await diagnostics.checkPixelsHistoryQueue();
        break;
      case 'consistency':
        await diagnostics.checkDataConsistency();
        break;
      case 'tables':
        await diagnostics.checkLeaderboardTables();
        break;
      case 'service':
        await diagnostics.checkMaintenanceService();
        break;
      case 'update':
        await diagnostics.manualUpdate();
        break;
      case 'full':
      default:
        const report = await diagnostics.runFullDiagnostics();

        // 可选：将报告写入文件
        if (args.includes('--save')) {
          const fs = require('fs');
          const reportPath = `./leaderboard-diagnostics-${Date.now()}.json`;
          fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
          console.log(`\n📄 诊断报告已保存到: ${reportPath}`);
        }
        break;
    }
  } catch (error) {
    console.error('❌ 诊断过程中发生错误:', error);
  } finally {
    await db.destroy();
    process.exit(0);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = LeaderboardDiagnostics;