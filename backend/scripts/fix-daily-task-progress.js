#!/usr/bin/env node

/**
 * 修复每日任务进度
 * 手动更新指定会话的任务进度
 */

const knex = require('knex')(require('../knexfile').development);
const DailyTaskController = require('../src/controllers/dailyTaskController');

async function fixDailyTaskProgress(sessionId) {
  console.log(`=== 修复会话 ${sessionId} 的任务进度 ===\n`);

  try {
    // 1. 获取会话信息
    const session = await knex('drawing_sessions')
      .where('id', sessionId)
      .first();

    if (!session) {
      console.log(`❌ 会话不存在`);
      return;
    }

    console.log(`📌 会话信息:`);
    console.log(`   用户 ID: ${session.user_id}`);
    console.log(`   状态: ${session.status}`);
    console.log(`   更新时间: ${session.updated_at}`);

    const pixelCount = session.metadata?.statistics?.pixelCount || 0;
    console.log(`   像素数: ${pixelCount}\n`);

    if (session.status !== 'completed') {
      console.log(`⚠️  会话未完成，无需更新任务`);
      return;
    }

    // 2. 更新任务进度
    console.log(`🔄 开始更新任务进度...\n`);

    // 更新会话数任务
    console.log(`  更新 draw_sessions 任务 (+1)...`);
    await DailyTaskController.updateTaskProgress(session.user_id, 'draw_sessions', 1);

    // 更新像素数任务
    if (pixelCount > 0) {
      console.log(`  更新 draw_pixels 任务 (+${pixelCount})...`);
      await DailyTaskController.updateTaskProgress(session.user_id, 'draw_pixels', pixelCount);
    }

    console.log(`\n✅ 任务进度更新完成！`);

    // 3. 显示更新后的任务状态
    const today = new Date(session.updated_at).toISOString().split('T')[0];
    const tasks = await knex('user_daily_tasks')
      .where('user_id', session.user_id)
      .where('task_date', today)
      .orderBy('id');

    console.log(`\n📋 更新后的任务状态:\n`);
    tasks.forEach((task, i) => {
      const progress = (task.current / task.target * 100).toFixed(1);
      const status = task.is_completed ? '✅' : '⏳';
      console.log(`  ${i + 1}. ${status} [${task.type}] ${task.title}`);
      console.log(`     ${task.current}/${task.target} (${progress}%)`);
    });

  } catch (error) {
    console.error('❌ 修复失败:', error);
  } finally {
    await knex.destroy();
  }
}

// 从命令行获取 session ID
const sessionId = process.argv[2];
if (!sessionId) {
  console.log('用法: node fix-daily-task-progress.js <session_id>');
  console.log('示例: node fix-daily-task-progress.js 9128bad0-f215-4199-8817-89269eb014e3');
  process.exit(1);
}

fixDailyTaskProgress(sessionId);
