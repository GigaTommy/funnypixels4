#!/usr/bin/env node

/**
 * 清除今天的旧每日任务，让系统用新模板（无签到任务）重新生成
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { db } = require('../src/config/database');

async function clearTodayTasks() {
  try {
    const today = new Date().toISOString().split('T')[0];

    console.log(`🗑️  清除 ${today} 的旧任务...`);

    // 清除今天的任务
    const deletedTasks = await db('user_daily_tasks')
      .where('task_date', today)
      .del();

    console.log(`✅ 已清除 ${deletedTasks} 个旧任务`);

    // 清除今天的全部完成奖励
    const deletedBonus = await db('user_daily_task_bonus')
      .where('bonus_date', today)
      .del();

    console.log(`✅ 已清除 ${deletedBonus} 个奖励记录`);

    console.log('\n🎉 清理完成！用户下次访问"每日任务"时将自动生成新任务（无签到任务）');
    console.log('\n📋 新任务类型：');
    console.log('   - 绘制像素');
    console.log('   - 完成绘画会话');
    console.log('   - 收集宝箱 🆕');
    console.log('   - 使用漂流瓶 🆕');
    console.log('   - 社交互动');
    console.log('   - 探索地图');

    await db.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ 清理失败:', error);
    await db.destroy();
    process.exit(1);
  }
}

clearTodayTasks();
