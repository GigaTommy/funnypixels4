#!/usr/bin/env node

/**
 * 检查pixels表中的最新记录
 */

const { db } = require('../../backend/src/config/database');

async function checkLatestPixel() {
  try {
    console.log('🔍 查询pixels表最新记录\n');

    // 1. 查询所有记录，按创建时间倒序
    console.log('📊 pixels表所有记录（按创建时间倒序）:');
    const allPixels = await db('pixels')
      .select('*')
      .orderBy('created_at', 'desc');

    if (allPixels.length === 0) {
      console.log('   (表中暂无记录)');
    } else {
      allPixels.forEach((pixel, index) => {
        console.log(`   ${index + 1}. ID: ${pixel.id}, Grid: ${pixel.grid_id}, 坐标: (${pixel.latitude}, ${pixel.longitude}), 颜色: ${pixel.color}, 用户: ${pixel.user_id}, 创建时间: ${pixel.created_at}`);
      });
    }

    // 2. 专门查找我们期望的grid_id
    const expectedGridId = 'grid_2932654_1131256';
    console.log(`\n🔍 查找特定的grid_id: ${expectedGridId}`);

    const specificPixel = await db('pixels')
      .where('grid_id', expectedGridId)
      .first();

    if (specificPixel) {
      console.log('✅ 找到匹配的记录:');
      console.log(`   ID: ${specificPixel.id}`);
      console.log(`   Grid: ${specificPixel.grid_id}`);
      console.log(`   坐标: (${specificPixel.latitude}, ${specificPixel.longitude})`);
      console.log(`   颜色: ${specificPixel.color}`);
      console.log(`   用户: ${specificPixel.user_id}`);
      console.log(`   创建时间: ${specificPixel.created_at}`);
    } else {
      console.log(`❌ 未找到grid_id为 ${expectedGridId} 的记录`);
    }

    // 3. 查询测试用户的记录
    const testUserId = '6284d571-36b4-4170-8ec1-746f34dbe905';
    console.log(`\n👤 查询测试用户 ${testUserId} 的所有记录:`);

    const userPixels = await db('pixels')
      .where('user_id', testUserId)
      .orderBy('created_at', 'desc');

    if (userPixels.length === 0) {
      console.log('   (测试用户暂无记录)');
    } else {
      userPixels.forEach((pixel, index) => {
        console.log(`   ${index + 1}. ID: ${pixel.id}, Grid: ${pixel.grid_id}, 颜色: ${pixel.color}, 创建时间: ${pixel.created_at}`);
      });
    }

    // 4. 查询今天的新增记录
    const today = new Date().toISOString().slice(0, 10);
    console.log(`\n📅 今天(${today})新增的记录:`);

    const todayPixels = await db('pixels')
      .whereRaw('DATE(created_at) = ?', [today])
      .orderBy('created_at', 'desc');

    if (todayPixels.length === 0) {
      console.log('   (今天暂无新增记录)');
    } else {
      todayPixels.forEach((pixel, index) => {
        console.log(`   ${index + 1}. ID: ${pixel.id}, Grid: ${pixel.grid_id}, 颜色: ${pixel.color}, 用户: ${pixel.user_id}, 创建时间: ${pixel.created_at}`);
      });
    }

    await db.destroy();
    console.log('\n✅ 查询完成');

  } catch (error) {
    console.error('❌ 查询失败:', error.message);
    console.error('错误详情:', error.stack);
  }
}

checkLatestPixel();