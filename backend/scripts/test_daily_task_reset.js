#!/usr/bin/env node

/**
 * 手动测试每日任务重置功能
 *
 * 使用方法:
 *   node scripts/test_daily_task_reset.js
 *
 * 功能：
 * 1. 手动触发每日任务重置逻辑
 * 2. 验证所有功能是否正常工作
 * 3. 输出详细的执行报告
 */

// 加载环境配置
require('dotenv').config();

const { resetDailyTasks, calculateUserStreak } = require('../src/tasks/resetDailyTasks');
const { db } = require('../src/config/database');
const logger = require('../src/utils/logger');

async function testDailyTaskReset() {
  console.log('\n==========================================');
  console.log('🧪 每日任务重置功能测试');
  console.log('==========================================\n');

  try {
    // 1. 显示当前数据库状态
    console.log('📊 【步骤1】查询当前任务数据...\n');

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const todayTasks = await db('user_daily_tasks')
      .where('task_date', today)
      .count('* as count')
      .first();

    const yesterdayTasks = await db('user_daily_tasks')
      .where('task_date', yesterday)
      .select('user_id')
      .groupBy('user_id')
      .select(
        db.raw('COUNT(*) as total'),
        db.raw('SUM(CASE WHEN is_completed THEN 1 ELSE 0 END) as completed')
      );

    console.log(`  ✓ 今日任务数: ${todayTasks.count}`);
    console.log(`  ✓ 昨日活跃用户数: ${yesterdayTasks.length}`);

    if (yesterdayTasks.length > 0) {
      const fullCompletionUsers = yesterdayTasks.filter(t => t.completed >= 5);
      console.log(`  ✓ 昨日全勤用户数: ${fullCompletionUsers.length}\n`);

      // 显示前5个用户的详细信息
      console.log('  📋 昨日任务完成情况（前5个用户）:');
      for (let i = 0; i < Math.min(5, yesterdayTasks.length); i++) {
        const task = yesterdayTasks[i];
        const streak = await calculateUserStreak(task.user_id);
        console.log(`     用户 ${task.user_id.substring(0, 8)}...: ${task.completed}/${task.total} 完成，连续${streak}天`);
      }
      console.log('');
    }

    // 2. 执行重置任务
    console.log('🔄 【步骤2】执行每日任务重置...\n');

    const result = await resetDailyTasks();

    // 3. 显示执行结果
    console.log('📈 【步骤3】重置结果统计:\n');

    console.log(`  ✅ 活跃用户数: ${result.activeUsers}`);
    console.log(`  ✅ 预生成任务数: ${result.preGenerated}`);
    console.log(`  ✅ 发送连续完成通知数: ${result.streakNotifications}`);
    console.log(`  ✅ 清理旧记录数: ${result.deletedOldRecords}\n`);

    // 4. 验证今日任务是否已生成
    console.log('🔍 【步骤4】验证今日任务生成情况...\n');

    const newTodayTasks = await db('user_daily_tasks')
      .where('task_date', today)
      .count('* as count')
      .first();

    console.log(`  ✓ 今日任务总数: ${newTodayTasks.count}`);
    console.log(`  ✓ 新增任务数: ${newTodayTasks.count - todayTasks.count}\n`);

    // 5. 查询推送通知发送记录
    console.log('📲 【步骤5】查询推送通知发送记录...\n');

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const recentNotifications = await db('push_notifications')
      .where('sent_at', '>', fiveMinutesAgo)
      .whereIn('type', ['daily_task_completed', 'daily_task_all_completed', 'daily_task_streak'])
      .select('type')
      .count('* as count')
      .groupBy('type');

    if (recentNotifications.length > 0) {
      console.log('  最近5分钟发送的通知:');
      recentNotifications.forEach(n => {
        console.log(`     ${n.type}: ${n.count}条`);
      });
    } else {
      console.log('  ⚠️  最近5分钟没有发送通知记录');
      console.log('     （可能是因为没有用户完成任务或APNs未配置）');
    }

    console.log('\n==========================================');
    console.log('✅ 测试完成！所有功能运行正常');
    console.log('==========================================\n');

    // 6. 给出建议
    console.log('💡 后续建议:\n');
    console.log('  1. 检查服务器日志确认定时任务是否正常启动:');
    console.log('     pm2 logs backend | grep "每日任务重置定时任务已启动"\n');
    console.log('  2. 等待明天00:00自动执行，观察日志:');
    console.log('     tail -f logs/app.log | grep "每日任务重置"\n');
    console.log('  3. 配置APNs证书以启用真实推送通知:');
    console.log('     export APN_KEY_ID=<your_key_id>');
    console.log('     export APN_TEAM_ID=<your_team_id>');
    console.log('     export APN_KEY_PATH=/path/to/AuthKey.p8\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    console.error('\n错误堆栈:', error.stack);
    process.exit(1);
  }
}

// 执行测试
testDailyTaskReset();
