#!/usr/bin/env node

/**
 * 检查像素记录
 */

const { db } = require('../../backend/src/config/database');

async function checkPixels() {
  try {
    console.log('🔍 检查像素记录...\n');

    // 检查pixels表
    const pixels = await db('pixels').select('*').orderBy('created_at', 'desc').limit(5);
    console.log(`📊 pixels表中共有 ${await db('pixels').count('* as count').first().then(r => r.count)} 条记录`);
    console.log('最新的5条像素记录:');
    console.log(pixels);

    // 检查pixels_history表
    const historyCount = await db('pixels_history').count('* as count').first();
    console.log(`\n📚 pixels_history表中共有 ${historyCount.count} 条记录`);
    const pixelsHistory = await db('pixels_history').select('*').orderBy('created_at', 'desc').limit(5);
    console.log('最新的5条历史记录:');
    console.log(pixelsHistory);

    // 检查今天的记录
    const todayPixels = await db('pixels')
      .whereRaw('DATE(created_at) = CURRENT_DATE')
      .count('* as count')
      .first();
    console.log(`\n📅 今天新增的像素: ${todayPixels.count} 条`);

    await db.destroy();
  } catch (error) {
    console.error('❌ 查询失败:', error);
    process.exit(1);
  }
}

checkPixels();