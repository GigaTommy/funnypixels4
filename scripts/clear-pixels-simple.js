#!/usr/bin/env node

/**
 * 清理pixels表脚本
 * 使用后端的数据库配置来清理所有像素记录
 */

// 设置环境变量
process.env.LOCAL_VALIDATION = 'false'; // 使用远程数据库

async function clearPixels() {
  try {
    console.log('🧹 开始清理pixels表...\n');
    
    // 1. 加载后端数据库配置
    console.log('📋 步骤 1: 加载数据库配置...');
    const { db } = require('./backend/src/config/database');
    
    // 等待连接初始化
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 2. 测试数据库连接
    console.log('📋 步骤 2: 测试数据库连接...');
    const testResult = await db.raw('SELECT 1 as test');
    console.log('✅ 数据库连接成功');
    
    // 3. 检查pixels表当前记录数
    console.log('\n📋 步骤 3: 检查当前pixels表记录数...');
    const countResult = await db('pixels').count('* as total');
    const currentCount = parseInt(countResult[0].total);
    console.log(`📊 当前pixels表记录数: ${currentCount}`);
    
    if (currentCount === 0) {
      console.log('✅ pixels表已经是空的，无需清理');
      return;
    }
    
    // 4. 显示要删除的记录详情
    console.log('\n📋 步骤 4: 显示要删除的记录详情...');
    const pixelsToDelete = await db('pixels').select('id', 'grid_id', 'latitude', 'longitude', 'color', 'pattern_id', 'created_at');
    
    console.log('🗑️ 将要删除的记录:');
    pixelsToDelete.forEach((pixel, index) => {
      console.log(`  ${index + 1}. ID: ${pixel.id}, Grid: ${pixel.grid_id}, 坐标: (${pixel.latitude}, ${pixel.longitude}), 颜色: ${pixel.color}, Pattern: ${pixel.pattern_id}`);
    });
    
    // 5. 确认删除操作
    console.log('\n⚠️ 警告: 即将删除所有像素记录！');
    console.log('这个操作是不可逆的，请确认您真的要删除所有像素数据。');
    
    // 6. 执行删除操作
    console.log('\n📋 步骤 5: 执行删除操作...');
    const deleteResult = await db('pixels').del();
    console.log(`✅ 成功删除 ${deleteResult} 条记录`);
    
    // 7. 验证删除结果
    console.log('\n📋 步骤 6: 验证删除结果...');
    const finalCountResult = await db('pixels').count('* as total');
    const finalCount = parseInt(finalCountResult[0].total);
    console.log(`📊 删除后pixels表记录数: ${finalCount}`);
    
    if (finalCount === 0) {
      console.log('✅ 清理完成！pixels表现在是空的');
    } else {
      console.log('❌ 清理可能不完整，还有记录剩余');
    }
    
    // 8. 重置自增ID（可选）
    console.log('\n📋 步骤 7: 重置自增ID...');
    await db.raw('ALTER SEQUENCE pixels_id_seq RESTART WITH 1');
    console.log('✅ 自增ID已重置为1');
    
  } catch (error) {
    console.error('❌ 清理pixels表失败:', error);
  }
}

// 执行清理
clearPixels();
