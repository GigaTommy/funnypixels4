#!/usr/bin/env node

const { db } = require('../src/config/database');

async function addTestUserPoints() {
  try {
    console.log('💰 为测试用户添加积分...');
    
    const userId = 'fe89a000-5f45-4118-aa99-46e6985bc519';
    
    // 检查用户积分记录是否存在
    let userPoints = await db('user_points')
      .where('user_id', userId)
      .first();
    
    if (!userPoints) {
      console.log('📝 创建用户积分记录...');
      await db('user_points').insert({
        user_id: userId,
        total_points: 10000,
        created_at: new Date(),
        updated_at: new Date()
      });
      console.log('✅ 用户积分记录创建成功');
    } else {
      console.log('🔄 更新用户积分...');
      await db('user_points')
        .where('user_id', userId)
        .update({
          total_points: 10000,
          updated_at: new Date()
        });
      console.log('✅ 用户积分更新成功');
    }
    
    // 验证积分
    const updatedUserPoints = await db('user_points')
      .where('user_id', userId)
      .first();
    
    console.log('📊 用户积分状态:', {
      total_points: updatedUserPoints.total_points
    });
    
  } catch (error) {
    console.error('❌ 添加积分失败:', error);
  } finally {
    await db.destroy();
  }
}

addTestUserPoints();
