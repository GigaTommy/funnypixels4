#!/usr/bin/env node

const { db } = require('../src/config/database');

async function verifyCustomFlagSku() {
  try {
    console.log('🔍 验证自定义联盟旗帜SKU...');
    
    const result = await db('shop_skus')
      .where('name', '自定义联盟旗帜')
      .first();
    
    if (result) {
      console.log('✅ 自定义联盟旗帜SKU已成功添加:');
      console.log(`  - ID: ${result.id}`);
      console.log(`  - 名称: ${result.name}`);
      console.log(`  - 价格: ${result.price} ${result.currency}`);
      console.log(`  - 类型: ${result.type}`);
      console.log(`  - 活跃状态: ${result.active ? '是' : '否'}`);
      console.log(`  - 验证状态: ${result.verified ? '是' : '否'}`);
      
      if (result.metadata) {
        const metadata = JSON.parse(result.metadata);
        console.log(`  - 元数据:`, metadata);
      }
    } else {
      console.log('❌ 未找到自定义联盟旗帜SKU');
    }
    
    // 检查自定义旗帜相关表
    console.log('\n🔍 检查自定义旗帜相关表...');
    
    const customFlagOrders = await db('custom_flag_orders').count('* as count').first();
    console.log(`  - custom_flag_orders 表: ${customFlagOrders.count} 条记录`);
    
    const userCustomPatterns = await db('user_custom_patterns').count('* as count').first();
    console.log(`  - user_custom_patterns 表: ${userCustomPatterns.count} 条记录`);
    
  } catch (error) {
    console.error('❌ 验证失败:', error.message);
  } finally {
    await db.destroy();
  }
}

verifyCustomFlagSku();
