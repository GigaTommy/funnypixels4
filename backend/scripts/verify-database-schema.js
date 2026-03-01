#!/usr/bin/env node

/**
 * 验证数据库表结构脚本
 * 检查生产环境数据库表结构是否正确
 */

const { db } = require('../src/config/database');

async function verifyDatabaseSchema() {
  console.log('🔍 验证数据库表结构...\n');
  
  try {
    // 1. 检查 user_pixel_states 表结构
    console.log('1. 检查 user_pixel_states 表结构...');
    const columns = await db.raw(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'user_pixel_states' 
      ORDER BY ordinal_position
    `);
    
    console.log('表字段列表:');
    columns.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    // 2. 检查关键字段是否存在
    const columnNames = columns.rows.map(row => row.column_name);
    const requiredFields = [
      'is_in_natural_accumulation',
      'last_activity_time',
      'item_pixel_points',
      'natural_pixel_points',
      'max_natural_pixel_points'
    ];
    
    console.log('\n2. 检查关键字段...');
    const missingFields = [];
    requiredFields.forEach(field => {
      if (columnNames.includes(field)) {
        console.log(`✅ ${field} - 存在`);
      } else {
        console.log(`❌ ${field} - 缺失`);
        missingFields.push(field);
      }
    });
    
    // 3. 检查用户状态数据
    console.log('\n3. 检查用户状态数据...');
    const userStates = await db('user_pixel_states')
      .select('user_id', 'pixel_points', 'is_in_natural_accumulation', 'last_activity_time')
      .limit(3);
    
    console.log('用户状态示例:');
    userStates.forEach(state => {
      console.log(`  用户 ${state.user_id}: 点数=${state.pixel_points}, 自然累计=${state.is_in_natural_accumulation}, 活动时间=${state.last_activity_time}`);
    });
    
    // 4. 总结
    console.log('\n4. 验证结果:');
    if (missingFields.length === 0) {
      console.log('✅ 所有必需字段都存在，数据库表结构正确');
    } else {
      console.log(`❌ 发现 ${missingFields.length} 个缺失字段:`, missingFields);
      console.log('需要运行数据库修复脚本');
    }
    
  } catch (error) {
    console.error('❌ 验证过程中发生错误:', error);
    console.error('错误详情:', error.message);
    throw error;
  } finally {
    await db.destroy();
  }
}

// 运行验证
if (require.main === module) {
  verifyDatabaseSchema()
    .then(() => {
      console.log('\n🎉 验证完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 验证失败:', error);
      process.exit(1);
    });
}

module.exports = verifyDatabaseSchema;
