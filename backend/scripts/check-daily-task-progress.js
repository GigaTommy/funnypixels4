#!/usr/bin/env node

/**
 * 检查每日任务进度诊断脚本
 * 检查用户的最近绘画和任务更新情况
 */

const knex = require('knex')(require('../knexfile').development);

async function checkDailyTaskProgress(username = 'bcd') {
  console.log(`=== 检查用户 ${username} 的每日任务进度 ===\n`);

  try {
    // 1. 查找用户
    const user = await knex('users').where('username', username).first();
    if (!user) {
      console.log(`❌ 用户 ${username} 不存在`);
      return;
    }

    console.log(`👤 用户: ${user.username} (ID: ${user.id})\n`);

    // 2. 获取今天的日期
    const today = new Date().toISOString().split('T')[0];
    console.log(`📅 今天日期: ${today}\n`);

    // 3. 检查最近的绘画会话
    const recentSessions = await knex('drawing_sessions')
      .where('user_id', user.id)
      .orderBy('updated_at', 'desc')
      .limit(5)
      .select('id', 'status', 'metadata', 'created_at', 'updated_at');

    console.log(`🎨 最近 5 个会话:\n`);
    recentSessions.forEach((session, i) => {
      const pixelCount = session.metadata?.statistics?.pixelCount || 0;
      const status = session.status;
      const updatedAt = new Date(session.updated_at).toLocaleString('zh-CN');
      console.log(`  ${i + 1}. Session ${session.id.substring(0, 8)}...`);
      console.log(`     状态: ${status}, 像素: ${pixelCount}, 更新时间: ${updatedAt}`);
    });

    // 4. 检查今天的每日任务
    console.log(`\n📋 今天的每日任务:\n`);
    const todayTasks = await knex('user_daily_tasks')
      .where('user_id', user.id)
      .where('task_date', today)
      .orderBy('id');

    if (todayTasks.length === 0) {
      console.log(`  ⚠️  今天还没有生成每日任务！`);
    } else {
      todayTasks.forEach((task, i) => {
        const progress = (task.current / task.target * 100).toFixed(1);
        const status = task.is_completed ? '✅ 已完成' : '⏳ 进行中';
        console.log(`  ${i + 1}. [${task.type}] ${task.title}`);
        console.log(`     进度: ${task.current}/${task.target} (${progress}%) ${status}`);
        console.log(`     奖励: ${task.reward_points} 积分`);
      });
    }

    // 5. 检查今天绘制的像素总数（从会话统计）
    console.log(`\n🔍 今天实际绘制的像素总数:\n`);
    const todayStart = new Date(today + 'T00:00:00Z');
    const tomorrowStart = new Date(today + 'T23:59:59Z');

    const todaySessions = await knex('drawing_sessions')
      .where('user_id', user.id)
      .where('status', 'completed')
      .whereBetween('updated_at', [todayStart, tomorrowStart])
      .select('id', 'metadata', 'updated_at');

    let totalPixels = 0;
    let sessionCount = 0;
    console.log(`  今天已完成的会话:\n`);
    todaySessions.forEach(session => {
      const pixels = session.metadata?.statistics?.pixelCount || 0;
      totalPixels += pixels;
      if (pixels > 0) sessionCount++;
      const time = new Date(session.updated_at).toLocaleTimeString('zh-CN');
      console.log(`    - ${time}: ${pixels} pixels (Session ${session.id.substring(0, 8)}...)`);
    });

    console.log(`\n  ✅ 总计: ${sessionCount} 个会话, ${totalPixels} 个像素\n`);

    // 6. 对比任务进度和实际数据
    console.log(`📊 数据对比:\n`);
    const drawPixelsTask = todayTasks.find(t => t.type === 'draw_pixels');
    const drawSessionsTask = todayTasks.find(t => t.type === 'draw_sessions');

    if (drawPixelsTask) {
      const diff = totalPixels - drawPixelsTask.current;
      if (diff !== 0) {
        console.log(`  ⚠️  像素任务不匹配!`);
        console.log(`     任务记录: ${drawPixelsTask.current}`);
        console.log(`     实际绘制: ${totalPixels}`);
        console.log(`     差值: ${diff}`);
      } else {
        console.log(`  ✅ 像素任务匹配 (${totalPixels} pixels)`);
      }
    } else {
      console.log(`  ⚠️  今天没有像素绘制任务`);
    }

    if (drawSessionsTask) {
      const diff = sessionCount - drawSessionsTask.current;
      if (diff !== 0) {
        console.log(`  ⚠️  会话任务不匹配!`);
        console.log(`     任务记录: ${drawSessionsTask.current}`);
        console.log(`     实际完成: ${sessionCount}`);
        console.log(`     差值: ${diff}`);
      } else {
        console.log(`  ✅ 会话任务匹配 (${sessionCount} sessions)`);
      }
    }

  } catch (error) {
    console.error('❌ 检查失败:', error.message);
  } finally {
    await knex.destroy();
  }
}

// 从命令行参数获取用户名，默认为 bcd
const username = process.argv[2] || 'bcd';
checkDailyTaskProgress(username);
